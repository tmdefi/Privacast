import { createInstance, SepoliaConfig } from '@zama-fhe/relayer-sdk';
// ── CONFIG ──
const CONTRACT_ADDRESS = '0x015DE98CCD6f34c4FFCe7f87FEf2Ebc002fC2Fd3';
const CONTRACT_ABI = [
  'function marketCount() view returns (uint256)',
  'function hasPosition(uint256 marketId, address user) view returns (bool)',
  'function getMarket(uint256 marketId) view returns (string title, string category, uint256 createdAt, bool resolved, bool outcome, uint256 bettors)',
  'function placePosition(uint256 marketId, bytes32 encryptedAmount, bytes32 encryptedSide, bytes calldata inputProof) external',
  'function createMarket(string title, string category) external returns (uint256)',
  'event PositionPlaced(uint256 indexed marketId, address indexed user)',
];

const SEPOLIA_ID      = '0xaa36a7';
const SEPOLIA_PARAMS  = {
  chainId: SEPOLIA_ID, chainName: 'Sepolia Testnet',
  nativeCurrency: { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://rpc.sepolia.org'],
  blockExplorerUrls: ['https://sepolia.etherscan.io'],
};
const POLYMARKET_URL = 'https://corsproxy.io/?https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=50&order=volume&ascending=false';

// ── STATE ──
let walletAddress  = null;
let walletBalance  = null;
let provider       = null;
let signer         = null;
let contract       = null;
let fhevmInstance  = null;
let fheReady       = false;
let allMarkets     = [];
let activeCategory = 'all';
let allPositions   = JSON.parse(localStorage.getItem('pc_positions_v2') || '{}');

// ── INIT FHE ──
async function initFHE() {
  try {
    setFheStatus('INITIALISING...');
    fhevmInstance = await createInstance(SepoliaConfig);
    fheReady = true;
    setFheStatus('FHE READY');
    document.getElementById('stat-fhe').textContent = 'LIVE';
    document.getElementById('stat-fhe').style.color = 'var(--acid2)';
    console.log('✅ Zama FHE instance ready');
  } catch (e) {
    fheReady = false;
    setFheStatus('FHE OFFLINE');
    document.getElementById('stat-fhe').textContent = 'OFF';
    console.warn('FHE init failed:', e.message);
  }
}

function setFheStatus(msg) {
  const el = document.getElementById('fhe-status');
  if (el) el.textContent = msg;
}

// ── WALLET ──
async function connectWallet() {
  if (!window.ethereum) {
    alert('MetaMask not found!\n\nInstall from https://metamask.io then refresh.');
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    walletAddress  = accounts[0];
    await checkNetwork();
    await setupProvider();
    await fetchBalance();
    renderWalletUI();
    onWalletConnected();
    localStorage.setItem('pc_wallet', walletAddress);
  } catch (e) {
    if (e.code !== 4001) console.error('Wallet error:', e);
  }
}

async function setupProvider() {
  provider = new BrowserProvider(window.ethereum);
  signer   = await provider.getSigner();
  contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  const statusEl = document.getElementById('contract-status');
  if (statusEl) {
    statusEl.textContent = 'LIVE · ' + CONTRACT_ADDRESS.slice(0, 10) + '...';
    statusEl.style.color = 'var(--acid2)';
  }
}

async function fetchBalance() {
  if (!walletAddress || !window.ethereum) return;
  try {
    const hex = await window.ethereum.request({ method: 'eth_getBalance', params: [walletAddress, 'latest'] });
    walletBalance = (parseInt(hex, 16) / 1e18).toFixed(4);
  } catch (e) { walletBalance = '–'; }
  document.getElementById('stat-balance').textContent = walletBalance + ' ETH';
}

async function checkNetwork() {
  const chainId = await window.ethereum.request({ method: 'eth_chainId' });
  const warning = document.getElementById('net-warning');
  warning.classList.toggle('show', chainId !== SEPOLIA_ID);
}

async function switchToSepolia() {
  try {
    await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: SEPOLIA_ID }] });
  } catch (e) {
    if (e.code === 4902) {
      await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [SEPOLIA_PARAMS] });
    }
  }
  await checkNetwork();
}

function shortenAddr(a) { return a.slice(0, 6) + '...' + a.slice(-4); }

function renderWalletUI() {
  const area = document.getElementById('wallet-area');
  if (!walletAddress) {
    area.innerHTML = `<button class="btn-connect" id="connect-btn">⬡ CONNECT WALLET</button>`;
    document.getElementById('connect-btn').addEventListener('click', connectWallet);
    return;
  }
  const onSepolia = window.ethereum?.chainId === SEPOLIA_ID;
  area.innerHTML = `
    <div class="wallet-chip">
      <span class="wc-net ${onSepolia ? '' : 'wrong'}" id="wc-net-btn">${onSepolia ? 'SEPOLIA' : 'WRONG NET'}</span>
      <span class="wc-addr" id="wc-refresh">${shortenAddr(walletAddress)} &nbsp;<span class="wc-bal">${walletBalance} ETH</span></span>
      <span class="wc-disconnect" id="wc-disconnect">✕</span>
    </div>`;
  document.getElementById('wc-net-btn')?.addEventListener('click', switchToSepolia);
  document.getElementById('wc-refresh')?.addEventListener('click', () => fetchBalance().then(renderWalletUI));
  document.getElementById('wc-disconnect')?.addEventListener('click', disconnectWallet);
}

function disconnectWallet() {
  walletAddress = null; walletBalance = null; provider = null; signer = null; contract = null;
  localStorage.removeItem('pc_wallet');
  renderWalletUI();
  onWalletDisconnected();
}

async function autoReconnect() {
  const saved = localStorage.getItem('pc_wallet');
  if (!saved || !window.ethereum) return;
  try {
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (accounts[0]?.toLowerCase() === saved.toLowerCase()) {
      walletAddress = accounts[0];
      await checkNetwork();
      await setupProvider();
      await fetchBalance();
      renderWalletUI();
      onWalletConnected();
    }
  } catch (e) {}
}

function onWalletConnected() {
  document.getElementById('connect-prompt').classList.remove('show');
  document.getElementById('pos-wallet-label').textContent = 'WALLET: ' + walletAddress;
  document.getElementById('stat-positions').textContent = myPositions().length;
  renderSidebarPositions();
  renderMyPositions();
  renderMarkets(filteredMarkets());
}

function onWalletDisconnected() {
  document.getElementById('connect-prompt').classList.add('show');
  document.getElementById('stat-positions').textContent = '0';
  document.getElementById('stat-balance').textContent = '–';
  document.getElementById('pos-wallet-label').textContent = 'CONNECT WALLET TO VIEW YOUR POSITIONS.';
  document.getElementById('positions-sidebar').innerHTML = '<div class="pos-empty">CONNECT WALLET<br/>TO SEE POSITIONS.</div>';
  document.getElementById('my-positions-container').innerHTML = '';
  const statusEl = document.getElementById('contract-status');
  if (statusEl) statusEl.textContent = 'NOT CONNECTED';
  renderMarkets(filteredMarkets());
}

// ── POSITIONS ──
function myPositions() {
  if (!walletAddress) return [];
  return Object.values(allPositions[walletAddress.toLowerCase()] || {});
}

function savePosition(marketId, data) {
  const key = walletAddress.toLowerCase();
  if (!allPositions[key]) allPositions[key] = {};
  allPositions[key][marketId] = data;
  localStorage.setItem('pc_positions_v2', JSON.stringify(allPositions));
}

// ── FHE BET ──
async function placeBet(marketId, title, side, prob, inputEl, confirmEl) {
  if (!walletAddress) { connectWallet(); return; }
  const amount = parseFloat(inputEl.value);
  if (!amount || amount <= 0) {
    inputEl.style.borderColor = 'var(--blood)';
    setTimeout(() => inputEl.style.borderColor = '', 800);
    return;
  }

  confirmEl.textContent = '🔐 ENCRYPTING WITH ZAMA FHE...';
  confirmEl.style.color = 'var(--signal)';
  confirmEl.style.display = 'block';

  try {
    if (fheReady && fhevmInstance && contract) {
      // Real FHE encryption — values become ciphertext before leaving the browser
      confirmEl.textContent = '🔐 CREATING ENCRYPTED INPUT...';
      const input = fhevmInstance.createEncryptedInput(CONTRACT_ADDRESS, walletAddress);
      input.add32(Math.round(amount));
      input.addBool(side === 'YES');
      const encrypted = await input.encrypt();

      confirmEl.textContent = '📡 SENDING ENCRYPTED BET TO SEPOLIA...';
      const tx = await contract.placePosition(
        marketId,
        encrypted.handles[0],
        encrypted.handles[1],
        encrypted.inputProof
      );
      confirmEl.textContent = '⏳ WAITING FOR CONFIRMATION...';
      await tx.wait();

      savePosition(marketId, { marketId, title, side, amount, prob, ts: Date.now(), onChain: true, txHash: tx.hash });
      const payout = calcPayout(amount, side, prob);
      confirmEl.textContent = `✅ FHE ON-CHAIN · TX: ${tx.hash.slice(0, 10)}... · ${side} · $${amount} · POTENTIAL: $${payout}`;

    } else {
      // Fallback — local storage with note
      savePosition(marketId, { marketId, title, side, amount, prob, ts: Date.now(), onChain: false });
      const payout = calcPayout(amount, side, prob);
      confirmEl.textContent = `🔒 SAVED LOCALLY · ${shortenAddr(walletAddress)} · ${side} · $${amount} · POTENTIAL: $${payout}`;
      confirmEl.style.color = 'var(--dim)';
    }

    inputEl.value = '';
    document.getElementById('stat-positions').textContent = myPositions().length;
    renderSidebarPositions();
    renderMyPositions();

  } catch (e) {
    confirmEl.textContent = '❌ ERROR: ' + (e.reason || e.message || 'Transaction failed');
    confirmEl.style.color = 'var(--blood)';
    console.error('Bet error:', e);
  }
}

function calcPayout(amount, side, prob) {
  if (!prob) return '–';
  return side === 'YES'
    ? (amount / (prob / 100)).toFixed(2)
    : (amount / ((100 - prob) / 100)).toFixed(2);
}

// ── MARKETS ──
const CMAP = { politics:'Politics',election:'Politics',government:'Politics',president:'Politics',vote:'Politics',congress:'Politics',senate:'Politics',bitcoin:'Crypto',crypto:'Crypto',ethereum:'Crypto',btc:'Crypto',eth:'Crypto',defi:'Crypto',nft:'Crypto',token:'Crypto',blockchain:'Crypto',nba:'Sports',nfl:'Sports',soccer:'Sports',football:'Sports',tennis:'Sports',sports:'Sports',championship:'Sports',fed:'Economics',gdp:'Economics',inflation:'Economics',recession:'Economics',economy:'Economics',stock:'Economics',ai:'Science',science:'Science',nasa:'Science',climate:'Science',space:'Science',tech:'Science',openai:'Science' };
function guessCategory(t) { const s = t.toLowerCase(); for (const [k,v] of Object.entries(CMAP)) if (s.includes(k)) return v; return 'Other'; }
function fmtVol(v) { if (!v) return '$0'; if (v >= 1e6) return '$' + (v/1e6).toFixed(1) + 'M'; if (v >= 1e3) return '$' + (v/1e3).toFixed(0) + 'K'; return '$' + Math.round(v); }
function getProb(m) { try { if (m.outcomePrices) { const p = JSON.parse(m.outcomePrices); return Math.round(parseFloat(p[0]) * 100); } if (m.lastTradePrice) return Math.round(parseFloat(m.lastTradePrice) * 100); } catch (e) {} return null; }
function pClass(p) { if (p === null) return 'mid'; return p >= 65 ? 'high' : p <= 35 ? 'low' : 'mid'; }

function filteredMarkets() {
  const q = document.getElementById('search-input')?.value.toLowerCase() || '';
  const s = document.getElementById('sort-select')?.value || 'volume';
  let f = allMarkets.filter(m => {
    const t = (m.question || m.title || '').toLowerCase();
    return (activeCategory === 'all' || guessCategory(t) === activeCategory) && (!q || t.includes(q));
  });
  f.sort((a, b) => s === 'volume' ? parseFloat(b.volume||0) - parseFloat(a.volume||0) : s === 'prob-high' ? (getProb(b)||0) - (getProb(a)||0) : (getProb(a)||0) - (getProb(b)||0));
  return f;
}

function renderMarkets(markets) {
  const cont = document.getElementById('markets-container');
  if (!markets.length) { cont.innerHTML = '<div class="loading-msg">NO MARKETS MATCH THIS FILTER.</div>'; return; }
  const myPos = walletAddress ? (allPositions[walletAddress.toLowerCase()] || {}) : {};
  const grid  = document.createElement('div');
  grid.className = 'markets-grid';

  markets.forEach((m, i) => {
    const id    = m.conditionId || m.id || i;
    const title = m.question || m.title || 'Untitled';
    const prob  = getProb(m), pc = pClass(prob);
    const yw    = prob !== null ? prob : 50, nw = 100 - yw;
    const hasPos = !!myPos[id];

    const card = document.createElement('div');
    card.className = 'market-card' + (hasPos ? ' has-position' : '');
    card.innerHTML = `
      ${hasPos ? `<div class="pos-badge">🔒 ${myPos[id].side}</div>` : ''}
      <div><div class="card-cat">${guessCategory(title)}</div><div class="card-title">${title}</div></div>
      <div class="prob-display">
        <div class="prob-big ${pc}">${prob !== null ? prob + '%' : '?'}</div>
        <div class="prob-sides">
          <div class="prob-track-labels"><span>YES</span><span>${prob !== null ? prob + '%' : '–'}</span></div>
          <div class="prob-track"><div class="prob-fill yes" style="width:${yw}%"></div></div>
          <div class="prob-track-labels"><span>NO</span><span>${prob !== null ? nw + '%' : '–'}</span></div>
          <div class="prob-track"><div class="prob-fill no" style="width:${nw}%"></div></div>
        </div>
      </div>
      <div class="card-stats">
        <div class="cs"><div class="cs-label">Volume</div><div class="cs-val">${fmtVol(m.volume||m.volumeNum)}</div></div>
        <div class="cs"><div class="cs-label">Liquidity</div><div class="cs-val">${fmtVol(m.liquidity||m.liquidityNum)}</div></div>
      </div>
      <div class="bet-section">
        <div class="bet-lbl">🔒 ${walletAddress ? 'PLACE ENCRYPTED PREDICTION' : 'CONNECT WALLET TO PREDICT'}</div>
        ${walletAddress
          ? `<div class="bet-row">
              <input type="number" class="bet-input" placeholder="USDC AMT" min="1" data-market-id="${id}" />
              <button class="bet-btn yes" data-market-id="${id}" data-title="${title.replace(/"/g,'&quot;')}" data-side="YES" data-prob="${prob}">YES</button>
              <button class="bet-btn no"  data-market-id="${id}" data-title="${title.replace(/"/g,'&quot;')}" data-side="NO"  data-prob="${prob}">NO</button>
            </div>`
          : `<div class="login-required" data-connect="true">CONNECT WALLET TO PREDICT →</div>`
        }
        <div class="bet-confirm" data-confirm="${id}"></div>
      </div>`;
    grid.appendChild(card);
  });

  cont.innerHTML = '';
  cont.appendChild(grid);
  attachBetListeners();
}

function attachBetListeners() {
  document.querySelectorAll('.bet-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id    = btn.dataset.marketId;
      const title = btn.dataset.title;
      const side  = btn.dataset.side;
      const prob  = parseInt(btn.dataset.prob) || null;
      const inp   = document.querySelector(`.bet-input[data-market-id="${id}"]`);
      const conf  = document.querySelector(`.bet-confirm[data-confirm="${id}"]`);
      placeBet(id, title, side, prob, inp, conf);
    });
  });
  document.querySelectorAll('[data-connect]').forEach(el => {
    el.addEventListener('click', connectWallet);
  });
}

function updateSidebarCounts(markets) {
  const cats = { Politics:0, Crypto:0, Sports:0, Economics:0, Science:0, Other:0 };
  markets.forEach(m => { const c = guessCategory(m.question||m.title||''); cats[c]=(cats[c]||0)+1; });
  document.getElementById('cnt-all').textContent = markets.length;
  Object.entries(cats).forEach(([c,n]) => { const el = document.getElementById('cnt-'+c); if (el) el.textContent = n; });
}

function renderSidebarPositions() {
  const el = document.getElementById('positions-sidebar');
  const pa = myPositions();
  if (!pa.length) { el.innerHTML = '<div class="pos-empty">NO POSITIONS YET.</div>'; return; }
  el.innerHTML = pa.slice(-6).reverse().map(p => `
    <div class="pos-item">
      <span class="pos-name" title="${p.title}">${p.title.slice(0,20)}…</span>
      <span class="pos-val ${p.side==='YES'?'yes':'no'}">${p.side} $${p.amount}</span>
    </div>`).join('');
}

function renderMyPositions() {
  const cont = document.getElementById('my-positions-container');
  const pa   = myPositions();
  if (!pa.length) { cont.innerHTML = '<div style="font-family:var(--mono);font-size:12px;color:var(--dimmer);padding:20px 0">NO PREDICTIONS YET.</div>'; return; }
  cont.innerHTML = `<table class="pos-table">
    <thead><tr><th>MARKET</th><th>SIDE</th><th>AMOUNT</th><th>ON-CHAIN</th><th>DATE</th></tr></thead>
    <tbody>${pa.reverse().map(p => `<tr>
      <td style="font-family:var(--cond);font-size:14px;max-width:280px">${p.title}</td>
      <td><span style="font-family:var(--head);font-size:20px;color:${p.side==='YES'?'var(--signal)':'var(--blood)'}">${p.side}</span></td>
      <td style="font-family:var(--mono)">$${p.amount}</td>
      <td style="font-family:var(--mono);font-size:11px">${p.onChain ? '✅ FHE' : '🔒 LOCAL'}</td>
      <td style="font-family:var(--mono);font-size:11px;color:var(--dimmer)">${new Date(p.ts).toLocaleDateString()}</td>
    </tr>`).join('')}</tbody>
  </table>`;
}

// ── EVENT LISTENERS ──
function setupListeners() {
  document.getElementById('connect-btn')?.addEventListener('click', connectWallet);
  document.getElementById('connect-prompt-btn')?.addEventListener('click', connectWallet);
  document.getElementById('net-warning')?.addEventListener('click', switchToSepolia);
  document.getElementById('search-input')?.addEventListener('input', () => renderMarkets(filteredMarkets()));
  document.getElementById('sort-select')?.addEventListener('change', () => renderMarkets(filteredMarkets()));

  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('page-' + tab.dataset.page)?.classList.add('active');
      if (tab.dataset.page === 'positions') renderMyPositions();
    });
  });

  document.querySelectorAll('.cat-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.cat-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      activeCategory = item.dataset.cat;
      renderMarkets(filteredMarkets());
    });
  });

  if (window.ethereum) {
    window.ethereum.on('accountsChanged', accs => {
      if (accs.length) { walletAddress = accs[0]; localStorage.setItem('pc_wallet', walletAddress); setupProvider().then(() => { fetchBalance().then(renderWalletUI); onWalletConnected(); }); }
      else disconnectWallet();
    });
    window.ethereum.on('chainChanged', () => { checkNetwork(); fetchBalance().then(renderWalletUI); });
  }
}

// ── BOOT ──
async function init() {
  setupListeners();

  if (!localStorage.getItem('pc_wallet')) {
    document.getElementById('connect-prompt').classList.add('show');
  }

  // Init FHE in background
  initFHE();

  // Auto reconnect wallet
  autoReconnect();

  // Load markets
  try {
    const r = await fetch(POLYMARKET_URL);
    if (!r.ok) throw new Error('API ' + r.status);
    const data = await r.json();
    allMarkets = (Array.isArray(data) ? data : (data.markets || data.data || [])).filter(m => m.question || m.title);
    document.getElementById('stat-markets').textContent = allMarkets.length;
    updateSidebarCounts(allMarkets);
    renderMarkets(filteredMarkets());
  } catch (e) {
    document.getElementById('markets-container').innerHTML = `
      <div class="error-msg">
        <strong>⚠ CANNOT REACH POLYMARKET API</strong><br/><br/>
        Make sure you ran <strong>npm run dev</strong> inside the vite-app folder.
      </div>`;
    document.getElementById('stat-markets').textContent = '0';
  }
}

init();
