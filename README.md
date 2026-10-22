# TAG! Run & Catch — Upgraded Multiplayer

This is an experimental upgrade of the original Node.js + Express + Socket.IO game. It adds three room modes:

- **Classic Tag**: tagging transfers the IT role to the player caught.
- **Infection**: caught players join the seeker team.
- **Hide & Seek**: a 20-second hiding phase, then the seeker catches hiders; survivors win when time runs out.

It also adds a more obstacle-filled park, a separate forest-style obstacle layout for Hide & Seek, server-side obstacle collision, sprinting, and jump/dodge input hooks. This remains a prototype; jump/dodge currently provide input/action hooks and are not a full physics-based platforming system.

## Local run
1. Install Node.js LTS.
2. Open a terminal in this folder.
3. Run `npm install`
4. Run `npm start`
5. Open `http://localhost:3000`.

## Deploy on Render
- Build command: `npm install`
- Start command: `node server.js`
- Root directory: blank
- Use the free web service for testing; it may sleep when idle.

## Uploading to GitHub
Upload `server.js`, `package.json`, `README.md`, and the **public** folder containing `index.html`. Do not upload only the ZIP. The repository root should contain `server.js` and `package.json`; `public/index.html` must stay inside `public`.

## Important
The game has not been end-to-end tested on two deployed devices. After deploying, test room creation/joining, each mode, collision around obstacles, tag transfer, infection, and Hide & Seek timing before sharing widely.
