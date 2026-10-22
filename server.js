const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' }, pingInterval: 25000, pingTimeout: 20000 });
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_, res) => res.json({ ok: true, service: 'tag-run-catch' }));

const rooms = new Map();
const COLORS = [0x188ee8,0xff9e27,0xa45af2,0x24b56b,0xff4f5f,0x27c4bd,0xffd03d,0xf07cdb];
const ARENA = 20.5, MATCH_SECONDS = 90, TAG_DISTANCE = 1.25;
function code(){let s;do{s=crypto.randomBytes(3).toString('hex').slice(0,6).toUpperCase()}while(rooms.has(s));return s}
function safeName(v){return String(v||'Player').replace(/[<>]/g,'').trim().slice(0,16)||'Player'}
function roomFor(socket){return socket.data.room ? rooms.get(socket.data.room) : null}
function publicRoom(r){return {code:r.code,hostId:r.hostId,phase:r.phase,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,color:p.color,alive:p.alive} ))}}
function roomUpdate(r){io.to(r.code).emit('roomUpdate',publicRoom(r))}
function state(r){return {phase:r.phase,time:r.time,taggerId:r.taggerId,tagged:r.tagged,scores:Object.fromEntries([...r.players].map(([id,p])=>[id,p.score])),players:[...r.players.values()].map(p=>({id:p.id,name:p.name,color:p.color,x:p.x,z:p.z,yaw:p.yaw,alive:p.alive})),winner:r.winner||''}}
function broadcast(r){io.to(r.code).emit('state',state(r))}
function leave(socket){const r=roomFor(socket);if(!r)return;r.players.delete(socket.id);socket.leave(r.code);delete socket.data.room;if(r.hostId===socket.id){r.hostId=r.players.keys().next().value||null}if(!r.players.size){clearInterval(r.timer);rooms.delete(r.code);return}if(r.taggerId===socket.id)r.taggerId=r.players.keys().next().value||null;if(r.phase==='playing'&&r.players.size<2){r.phase='lobby';clearInterval(r.timer);r.time=MATCH_SECONDS;r.winner='Need at least 2 players to continue.'}roomUpdate(r);broadcast(r)}
function finish(r,winner){if(r.phase!=='playing')return;r.phase='ended';r.winner=winner;clearInterval(r.timer);r.timer=null;broadcast(r);roomUpdate(r)}
function start(r){if(r.players.size<2){io.to(r.code).emit('notice',{message:'At least 2 players are needed to start.'});return}clearInterval(r.timer);r.phase='playing';r.time=MATCH_SECONDS;r.tagged=0;r.winner='';const ps=[...r.players.values()];r.taggerId=ps[Math.floor(Math.random()*ps.length)].id;ps.forEach((p,i)=>{p.x=(Math.random()-.5)*26;p.z=(Math.random()-.5)*26;p.yaw=0;p.alive=true;p.score=0;p.lastTag=0});broadcast(r);roomUpdate(r);r.lastTick=Date.now();r.timer=setInterval(()=>{const now=Date.now();const dt=Math.min(.1,(now-r.lastTick)/1000);r.lastTick=now;if(r.phase!=='playing')return;r.time=Math.max(0,r.time-dt);if(r.time<=0){const tagger=r.players.get(r.taggerId);finish(r,tagger?tagger.name+' wins by tagging '+r.tagged+' player(s)!':'Time is up!');return}broadcast(r)},50)}
io.on('connection',socket=>{
 socket.on('createRoom',data=>{if(roomFor(socket))leave(socket);const c=code();const r={code:c,hostId:socket.id,players:new Map(),phase:'lobby',time:MATCH_SECONDS,tagged:0,taggerId:null,timer:null,lastTick:Date.now(),winner:''};rooms.set(c,r);r.players.set(socket.id,{id:socket.id,name:safeName(data?.name),color:COLORS[0],x:0,z:0,yaw:0,alive:true,score:0,lastTag:0,input:{x:0,z:0,sprint:false}});socket.data.room=c;socket.join(c);roomUpdate(r);broadcast(r);socket.emit('notice',{message:'Room created. Share the room code with friends.'})});
 socket.on('joinRoom',data=>{const c=String(data?.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');const r=rooms.get(c);if(!r){socket.emit('notice',{message:'Room not found. Ask the host for the current code.'});return}if(r.players.size>=8){socket.emit('notice',{message:'This room is full (8 players maximum).'});return}if(r.phase==='playing'){socket.emit('notice',{message:'That match is already in progress. Join after it ends.'});return}if(roomFor(socket))leave(socket);const color=COLORS[r.players.size%COLORS.length];r.players.set(socket.id,{id:socket.id,name:safeName(data?.name),color,x:(Math.random()-.5)*10,z:(Math.random()-.5)*10,yaw:0,alive:true,score:0,lastTag:0,input:{x:0,z:0,sprint:false}});socket.data.room=c;socket.join(c);roomUpdate(r);broadcast(r);socket.emit('notice',{message:'Joined room '+c+'. Wait for the host to start.'})});
 socket.on('input',data=>{const r=roomFor(socket);if(!r||r.phase!=='playing')return;const p=r.players.get(socket.id);if(!p||!p.alive)return;let x=Number(data?.x)||0,z=Number(data?.z)||0;const l=Math.hypot(x,z);if(l>1){x/=l;z/=l}p.input={x,z,sprint:!!data?.sprint}});
 socket.on('startMatch',()=>{const r=roomFor(socket);if(!r||r.hostId!==socket.id)return;start(r)});
 socket.on('restartMatch',()=>{const r=roomFor(socket);if(!r||r.hostId!==socket.id)return;start(r)});
 socket.on('leaveRoom',()=>leave(socket));
 socket.on('disconnect',()=>leave(socket));
});
// Authoritative movement, boundaries and tag collision. Client never reports its own position.
setInterval(()=>{const now=Date.now();for(const r of rooms.values()){if(r.phase!=='playing')continue;const dt=.05;for(const p of r.players.values()){if(!p.alive)continue;const input=p.input||{x:0,z:0};const l=Math.hypot(input.x,input.z)||1;const speed=input.sprint?8.0:5.1;p.x=Math.max(-ARENA,Math.min(ARENA,p.x+(input.x/l)*speed*dt));p.z=Math.max(-ARENA,Math.min(ARENA,p.z+(input.z/l)*speed*dt));if(Math.hypot(input.x,input.z)>.05)p.yaw=Math.atan2(input.x,input.z)}
 const tagger=r.players.get(r.taggerId);if(tagger&&tagger.alive&&now-(tagger.lastTag||0)>700){for(const p of r.players.values()){if(p.id===tagger.id||!p.alive)continue;const d=Math.hypot(p.x-tagger.x,p.z-tagger.z);if(d<TAG_DISTANCE){p.alive=false;tagger.score+=100;r.tagged++;tagger.lastTag=now;io.to(r.code).emit('notice',{message:tagger.name+' tagged '+p.name+'!'});const alive=[...r.players.values()].filter(q=>q.alive);if(alive.length<=1){finish(r,tagger.name+' wins! All other players were tagged.')}break}}}
 broadcast(r)}},50);

const PORT=process.env.PORT||3000;
server.listen(PORT,'0.0.0.0',()=>console.log(`Tag Run & Catch server listening on ${PORT}`));
