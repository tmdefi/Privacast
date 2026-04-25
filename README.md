# PrivaCast — Private Prediction Market (Stage 1)

A real Polymarket data dashboard with local private predictions.
Built with plain HTML/CSS/JS — no frameworks, no npm needed.

---

## How to Run in VS Code

### Step 1 — Open the project
1. Open VS Code
2. Go to File → Open Folder
3. Select the `polymarket-dashboard` folder

### Step 2 — Install Live Server
1. Press Ctrl+Shift+X (Extensions panel)
2. Search: Live Server
3. Install the one by "Ritwick Dey"

### Step 3 — Run it
1. Right-click `index.html` in the file explorer
2. Click "Open with Live Server"
3. Your browser opens at http://127.0.0.1:5500

That's it! You should see live markets from Polymarket loading in.

---

## If markets don't load (CORS error)

Browsers block requests to external APIs from local files.
Live Server fixes this for most cases, but if you still get an error:

**Option A — Chrome with CORS disabled (quick test only):**
1. Close all Chrome windows
2. Open Terminal and run:
   - Windows: `chrome.exe --disable-web-security --user-data-dir="C:/tmp"`
   - Mac: `open -na "Google Chrome" --args --disable-web-security --user-data-dir="/tmp/chrome"`

**Option B — Use a CORS proxy (safe for development):**
In index.html, find this line:
```
const res = await fetch('https://gamma-api.polymarket.com/markets?...');
```
Replace it with:
```
const res = await fetch('https://corsproxy.io/?https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=50&order=volume&ascending=false');
```

---

## What's Built (Stage 1)

- Live market data from Polymarket's Gamma API
- Category filter sidebar (Politics, Crypto, Sports, Economics, Science)
- Search + sort (by volume, probability, newest)
- Local private predictions stored in your browser
- Simulated payout calculator
- Positions panel tracking your bets

## What's Coming

- Stage 2: Node.js backend + real user accounts + database
- Stage 3: Zama fhEVM smart contracts — predictions encrypted
  on-chain, invisible to everyone including the blockchain itself

---

## File Structure

```
polymarket-dashboard/
  index.html   ← The entire app (one file!)
  README.md    ← This file
```

## Polymarket API Used

- Base URL: https://gamma-api.polymarket.com
- Endpoint: GET /markets?active=true&closed=false&limit=50
- No API key needed for reading market data
- Docs: https://docs.polymarket.com

---

## Learning Path from Here

1. Edit the colors in the :root CSS variables (top of index.html)
2. Change the number of markets loaded (limit=50 → limit=100)
3. Add a new filter category
4. Learn JavaScript basics: https://javascript.info
5. Next: Stage 2 (Node.js + Express backend)
