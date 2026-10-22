# Tag! Run & Catch — multiplayer starter

## What is included
- Browser 3D cartoon park (Three.js loaded from a CDN).
- 2–8 players per room with six-character room codes.
- Server-authoritative movement, arena bounds and tag collision.
- Shared 90-second timer, score, tagger selection, lobby, restart.
- Keyboard controls (WASD/arrows, Shift to sprint) and mobile joystick/run control.

## Run it locally
1. Install Node.js 18 or newer from https://nodejs.org/
2. Open a terminal in this folder.
3. Run `npm install`
4. Run `npm start`
5. Open http://localhost:3000 in your browser.

To test two players on one computer, open the page in two different browser tabs and create/join a room. For two devices on the same Wi-Fi, use the computer's LAN IP and port 3000 (allow the port through the computer firewall).

## Publish for friends online
Deploy this whole folder to a Node.js hosting service that supports persistent WebSockets (for example Render or Railway). Set the build/install command to `npm install` and start command to `npm start`. Do not publish only `public/index.html`; the server must be running too. Share the deployed HTTPS URL. The service's free tier, sleep policy, and pricing can change.

## Honest limitations
- This is a playable multiplayer starter, not a polished commercial release.
- Three.js is loaded from a CDN, so initial load needs internet.
- There is no account system, database, anti-cheat hardening, voice chat, matchmaking list, or persistent leaderboard.
- Room codes only work while the server process is running. Restarting the server clears all rooms.
- The host controls start/restart; the server is authoritative for movement and tagging. Client visuals are interpolated but network lag may still be noticeable.
- The simple tag rules end the round when one player remains or time expires. It does not yet include sophisticated catch-up logic or multiple game modes.
