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
const ARENA = 20.5, MATCH_SECONDS = 90, HIDE_SECONDS = 20, TAG_DISTANCE = 1.55;
// Server-side rectangular collision obstacles: [centerX, centerZ, halfWidth, halfDepth].
const PARK_OBSTACLES = [[-6,-5,1.3,.5],[6,-5,1.3,.5],[-6,5,.5,1.3],[6,5,.5,1.3],[-13,0,1.25,.5],[13,0,1.25,.5],[-13,-12,1.5,1],[ -7,-14,1.3,1],[1,-15,1.5,1],[10,-13,1.5,1],[15,-5,1,1.5],[14,5,1.5,1],[10,14,1.5,1],[1,15,1.5,1],[-8,14,1.5,1],[-15,6,1,1.5],[-15,-3,1,1.5]];
const FOREST_OBSTACLES = [[-12,-11,1.5,1],[-7,-13,1.5,.9],[1,-12,1.5,1],[11,-10,1.75,1],[-13,-2,1.7,1.05],[-8,3,1.5,1],[8,2,1.65,1],[12,9,1.75,1.05],[-11,11,1.6,1],[0,13,1.75,1.05],[5,-3,1.35,.9],[0,5,1.25,.9],[-4,-5,2,1.7],[6,8,2,1.7],[-2,-15,1.2,1],[13,3,1.3,1],[-14,5,1.1,.9],[3,10,1.1,.9]];
function obstacles(r){return r.mode==='hide' ? FOREST_OBSTACLES : PARK_OBSTACLES}
function blocked(r,x,z){
 if(Math.abs(x)>ARENA||Math.abs(z)>ARENA)return true;
 if(obstacles(r).some(([cx,cz,hx,hz])=>Math.abs(x-cx)<hx+.48&&Math.abs(z-cz)<hz+.48))return true;
 // Match the moving foam gates and rotating centre sweeper in the Classic Tag playground.
 if(r.mode!=='hide'){
  const t=Date.now()/1000;
  for(const [baseX,cz,range,speed,phase] of [[-10,-8,3.5,1.25,0],[10,8,3.5,1.05,2.2]]){
   const cx=baseX+Math.sin(t*speed+phase)*range;
   if(Math.abs(x-cx)<1.85&&Math.abs(z-cz)<.95)return true;
  }
  // Four padded rotating arms; use a generous central collision radius for fairness.
  const radius=Math.hypot(x,z);
  if(radius>1.2&&radius<7.0){const angle=Math.atan2(z,x)-t*1.05;const quarter=Math.PI/2;const nearest=Math.abs(((angle+quarter/2)%quarter+quarter)%quarter-quarter/2);if(nearest<Math.min(.18,.5/Math.max(radius,1)))return true;}
 }
 return false;
}
function code(){let s;do{s=crypto.randomBytes(3).toString('hex').slice(0,6).toUpperCase()}while(rooms.has(s));return s}
function safeName(v){return String(v||'Player').replace(/[<>]/g,'').trim().slice(0,16)||'Player'}
function roomFor(socket){return socket.data.room ? rooms.get(socket.data.room) : null}
function publicRoom(r){return {code:r.code,hostId:r.hostId,phase:r.phase,mode:r.mode,players:[...r.players.values()].map(p=>({id:p.id,name:p.name,color:p.color,alive:p.alive} ))}}
function roomUpdate(r){io.to(r.code).emit('roomUpdate',publicRoom(r))}
function state(r){return {phase:r.phase,time:r.time,mode:r.mode,taggerId:r.taggerId,taggerIds:[...r.taggerIds],hideTime:r.hideTime||0,tagged:r.tagged,scores:Object.fromEntries([...r.players].map(([id,p])=>[id,p.score])),players:[...r.players.values()].map(p=>({id:p.id,name:p.name,color:p.color,x:p.x,z:p.z,yaw:p.yaw,alive:p.alive})),winner:r.winner||''}}
function broadcast(r){io.to(r.code).emit('state',state(r))}
function leave(socket){const r=roomFor(socket);if(!r)return;r.players.delete(socket.id);socket.leave(r.code);delete socket.data.room;if(r.hostId===socket.id){r.hostId=r.players.keys().next().value||null}if(!r.players.size){clearInterval(r.timer);rooms.delete(r.code);return}if(r.taggerId===socket.id)r.taggerId=r.players.keys().next().value||null;r.taggerIds.delete(socket.id);if(r.phase==='playing'&&r.players.size<2){r.phase='lobby';clearInterval(r.timer);r.time=MATCH_SECONDS;r.winner='Need at least 2 players to continue.'}roomUpdate(r);broadcast(r)}
function finish(r,winner){if(r.phase!=='playing')return;r.phase='ended';r.winner=winner;clearInterval(r.timer);r.timer=null;broadcast(r);roomUpdate(r)}
function start(r){if(r.players.size<2){io.to(r.code).emit('notice',{message:'At least 2 players are needed to start.'});return}clearInterval(r.timer);r.mode=r.mode||'classic';r.phase=r.mode==='hide'?'hiding':'playing';r.time=r.mode==='hide'?HIDE_SECONDS:MATCH_SECONDS;r.hideTime=r.mode==='hide'?HIDE_SECONDS:0;r.tagged=0;r.winner='';r.taggerIds=new Set();const ps=[...r.players.values()];r.taggerId=ps[Math.floor(Math.random()*ps.length)].id;r.taggerIds.add(r.taggerId);const spawnPoints=[[-1,0],[1,0],[0,-1],[2,1],[-2,1],[1,2],[-1,-2],[3,0]];ps.forEach((p,i)=>{const sp=spawnPoints[i%spawnPoints.length];p.x=sp[0];p.z=sp[1];p.yaw=0;p.alive=true;p.infected=false;p.score=0;p.lastTag=0;p.jump=0;p.dodge=0});broadcast(r);roomUpdate(r);r.lastTick=Date.now();r.timer=setInterval(()=>{const now=Date.now();const dt=Math.min(.1,(now-r.lastTick)/1000);r.lastTick=now;if(r.phase==='hiding'){r.time=Math.max(0,r.time-dt);r.hideTime=r.time;if(r.time<=0){r.phase='playing';r.time=MATCH_SECONDS;io.to(r.code).emit('notice',{message:'Seekers released! Find the remaining hiders!'});roomUpdate(r)}broadcast(r);return}if(r.phase!=='playing')return;r.time=Math.max(0,r.time-dt);if(r.time<=0){if(r.mode==='hide'){finish(r,'Hiders win! Time ran out.');}else if(r.mode==='infection'){const hiders=[...r.players.values()].filter(p=>!p.infected);finish(r,hiders.length?'Hiders win! '+hiders.length+' survived.':'Infection wins!');}else{const survivors=[...r.players.values()].filter(p=>p.alive);finish(r,survivors.length===1?survivors[0].name+' wins! Last player standing.':survivors.length>1?'Time is up! '+survivors.map(p=>p.name).join(', ')+' survived.':'Everyone was eliminated!');}return}broadcast(r)},50)}
io.on('connection',socket=>{
 socket.on('createRoom',data=>{if(roomFor(socket))leave(socket);const c=code();const mode=['classic','infection','hide'].includes(data?.mode)?data.mode:'classic';const r={code:c,hostId:socket.id,players:new Map(),phase:'lobby',mode,time:MATCH_SECONDS,hideTime:0,tagged:0,taggerId:null,taggerIds:new Set(),timer:null,lastTick:Date.now(),winner:''};rooms.set(c,r);r.players.set(socket.id,{id:socket.id,name:safeName(data?.name),color:COLORS[0],x:0,z:0,yaw:0,alive:true,score:0,lastTag:0,input:{x:0,z:0,sprint:false,jump:false,dodge:false},jump:0,dodge:0,infected:false});socket.data.room=c;socket.join(c);roomUpdate(r);broadcast(r);socket.emit('notice',{message:'Room created. Share the room code with friends.'})});
 socket.on('joinRoom',data=>{const c=String(data?.code||'').toUpperCase().replace(/[^A-Z0-9]/g,'');const r=rooms.get(c);if(!r){socket.emit('notice',{message:'Room not found. Ask the host for the current code.'});return}if(r.players.size>=8){socket.emit('notice',{message:'This room is full (8 players maximum).'});return}if(r.phase==='playing'){socket.emit('notice',{message:'That match is already in progress. Join after it ends.'});return}if(roomFor(socket))leave(socket);const color=COLORS[r.players.size%COLORS.length];r.players.set(socket.id,{id:socket.id,name:safeName(data?.name),color,x:(Math.random()-.5)*10,z:(Math.random()-.5)*10,yaw:0,alive:true,score:0,lastTag:0,input:{x:0,z:0,sprint:false,jump:false,dodge:false},jump:0,dodge:0,infected:false});socket.data.room=c;socket.join(c);roomUpdate(r);broadcast(r);socket.emit('notice',{message:'Joined room '+c+'. Wait for the host to start.'})});
 socket.on('input',data=>{const r=roomFor(socket);if(!r||!['playing','hiding'].includes(r.phase))return;const p=r.players.get(socket.id);if(!p||!p.alive)return;let x=Number(data?.x)||0,z=Number(data?.z)||0;const l=Math.hypot(x,z);if(l>1){x/=l;z/=l}const now=Date.now();const jump=!!data?.jump&&now-(p.lastJump||0)>850;const dodge=!!data?.dodge&&now-(p.lastDodge||0)>1400;if(jump)p.lastJump=now;if(dodge)p.lastDodge=now;p.input={x,z,sprint:!!data?.sprint,jump,dodge}});
 socket.on('startMatch',()=>{const r=roomFor(socket);if(!r||r.hostId!==socket.id)return;start(r)});
 socket.on('restartMatch',()=>{const r=roomFor(socket);if(!r||r.hostId!==socket.id)return;start(r)});
 socket.on('leaveRoom',()=>leave(socket));
 socket.on('disconnect',()=>leave(socket));
});
// Server-authoritative movement, obstacle collisions, and tagging.
setInterval(()=>{
 const now=Date.now();
 for(const r of rooms.values()){
  if(!['playing','hiding'].includes(r.phase)) continue;
  const dt=.05;
  for(const p of r.players.values()){
   if(!p.alive) continue;
   const input=p.input||{x:0,z:0}; const l=Math.hypot(input.x,input.z)||1;
   let speed=input.sprint?8:5.1;
   if(input.dodge) speed=11;
   if(input.jump) p.jump=.5;
   p.jump=Math.max(0,(p.jump||0)-dt);
   const nx=p.x+(input.x/l)*speed*dt, nz=p.z+(input.z/l)*speed*dt;
   if(!blocked(r,nx,p.z)) p.x=nx;
   if(!blocked(r,p.x,nz)) p.z=nz;
   if(Math.hypot(input.x,input.z)>.05) p.yaw=Math.atan2(input.x,input.z);
   p.input.jump=false; p.input.dodge=false;
  }
  if(r.phase==='playing'){
   const seekers=[...r.players.values()].filter(p=>r.mode==='infection'?p.infected:p.id===r.taggerId);
   for(const tagger of seekers){
    if(!tagger.alive||now-(tagger.lastTag||0)<700) continue;
    for(const p of r.players.values()){
     if(p.id===tagger.id||!p.alive||(r.mode==='infection'&&p.infected)) continue;
     if(Math.hypot(p.x-tagger.x,p.z-tagger.z)>=TAG_DISTANCE) continue;
     tagger.score+=100; r.tagged++; tagger.lastTag=now;
     if(r.mode==='classic'){
      p.alive=false;
      io.to(r.code).emit('notice',{message:tagger.name+' tagged '+p.name+' — '+p.name+' is OUT!'});
      const survivors=[...r.players.values()].filter(q=>q.alive);
      if(survivors.length<=1) finish(r,survivors.length===1?survivors[0].name+' wins! Last player standing.':'Everyone was eliminated!');
     } else if(r.mode==='infection'){
      p.infected=true; r.taggerIds.add(p.id);
      io.to(r.code).emit('notice',{message:p.name+' was infected and joins the seekers!'});
     } else {
      p.alive=false;
      io.to(r.code).emit('notice',{message:tagger.name+' found '+p.name+'!'});
     }
     const hiders=[...r.players.values()].filter(q=>q.alive&&(r.mode!=='infection'||!q.infected));
     if(r.mode==='hide'&&hiders.length<=r.taggerIds.size) finish(r,'Seekers win! Everyone was found.');
     if(r.mode==='infection'&&hiders.length===0) finish(r,'Infection wins! Everyone was infected.');
     break;
    }
   }
  }
  broadcast(r);
 }
},50);

const PORT=process.env.PORT||3000;
server.listen(PORT,'0.0.0.0',()=>console.log(`Tag Run & Catch server listening on ${PORT}`));
