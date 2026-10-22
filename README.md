# TAG! Run & Catch — Multiplayer Prototype

Three room modes:
- **Classic Tag — Jolly Playground:** a bright, colourful playground with a rotating padded sweeper, two moving foam gates, bouncing balls, colourful stepping pads, and weaving lanes.
- **Infection:** uses the same playful playground; tagged players join the seekers.
- **Hide & Seek — Secret Forest:** a separate, darker forest with tree clusters, bushes, rocks, cabins and a 20-second hiding phase.

Phone touch controls are included (direction pad + sprint), alongside keyboard controls (WASD/arrow keys + Shift).

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
- Free services may sleep when idle.

## Update existing GitHub repository
Replace `server.js` and `public/index.html`. Keep your existing `package.json` and `package-lock.json` unless dependencies change. `public/index.html` must remain inside the `public` folder.

## Prototype note
This version is syntax-checked, but it has not been fully tested in a live two-player match. The rotating obstacle collision is approximate and should be play-tested. If movement feels blocked too early or a moving obstacle looks out of sync with its collision, we can tune it next.
