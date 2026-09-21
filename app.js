// state & session data
let state = 'idle'; // 'idle' | 'memorize' | 'recall' | 'result'
let allPositions = [];
let availableDeck = [];
let currentPos = null;
let currentPieces = {}; // truth: { 'e4': 'P', ... }
let userPieces = {};    // recall board: { 'e4': 'P', ... }
let selectedTool = 'K';
let timerId = null;
let timeLeft = 10;
let settings = { 
  mode: 'easy', // 'easy' | 'medium' | 'hard'
  seconds: 10,
  theme: 'wood',
  customLight: '#f0d9b5',
  customDark: '#b58863'
};
let session = { rounds: 0, totalScore: 0 };

const MODES = {
  easy: { label: 'easy', desc: 'easy: 4-5 pieces (endgame positions)' },
  medium: { label: 'medium', desc: 'medium: 10-20 pieces (simplified games)' },
  hard: { label: 'hard', desc: 'hard: full boards with some pieces off' }
};

const THEMES = {
  wood: { name: 'classic wood', light: '#f0d9b5', dark: '#b58863' },
  green: { name: 'tournament green', light: '#ffffdd', dark: '#86a666' },
  blue: { name: 'oceanic blue', light: '#dee3e6', dark: '#8ca2ad' },
  slate: { name: 'slate grey', light: '#e8e8e8', dark: '#63707e' },
  sand: { name: 'warm sand', light: '#eae9d2', dark: '#4b7399' },
  maple: { name: 'vintage maple', light: '#fce4b8', dark: '#c47d3e' }
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];
const TRAY_PIECES = ['K', 'Q', 'R', 'B', 'N', 'P', 'k', 'q', 'r', 'b', 'n', 'p', '.'];

const PIECE_IMAGES = {
  'K': 'assets/wK.svg',
  'Q': 'assets/wQ.svg',
  'R': 'assets/wR.svg',
  'B': 'assets/wB.svg',
  'N': 'assets/wN.svg',
  'P': 'assets/wP.svg',
  'k': 'assets/bK.svg',
  'q': 'assets/bQ.svg',
  'r': 'assets/bR.svg',
  'b': 'assets/bB.svg',
  'n': 'assets/bN.svg',
  'p': 'assets/bP.svg',
  '.': 'assets/eraser.svg'
};

const boardEl = document.getElementById('board');
const controlsEl = document.getElementById('controls');
const statusBarEl = document.getElementById('statusBar');
const trainerViewEl = document.getElementById('trainerView');
const settingsViewEl = document.getElementById('settingsView');
const tabTrainerBtn = document.getElementById('tabTrainerBtn');
const tabSettingsBtn = document.getElementById('tabSettingsBtn');
const backToTrainerBtn = document.getElementById('backToTrainerBtn');

// helpers
const sqName = (r, c) => `${FILES[c]}${RANKS[r]}`;
const isLight = (r, c) => (r + c) % 2 === 0;

function applyBoardTheme() {
  let light = '#f0d9b5';
  let dark = '#b58863';

  if (settings.theme === 'custom') {
    light = settings.customLight;
    dark = settings.customDark;
  } else if (THEMES[settings.theme]) {
    light = THEMES[settings.theme].light;
    dark = THEMES[settings.theme].dark;
  }

  document.documentElement.style.setProperty('--board-light', light);
  document.documentElement.style.setProperty('--board-dark', dark);
}

function parseFen(fen) {
  const map = {};
  const placement = fen.split(' ')[0];
  const rows = placement.split('/');
  rows.forEach((rowStr, r) => {
    let c = 0;
    for (const ch of rowStr) {
      if (ch >= '1' && ch <= '8') c += parseInt(ch, 10);
      else {
        map[sqName(r, c)] = ch;
        c++;
      }
    }
  });
  return map;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function getNextPosition() {
  const filtered = allPositions.filter(p => p.difficulty === settings.mode);
  if (!filtered.length) return null;
  if (!availableDeck.length) {
    availableDeck = [...filtered];
    shuffle(availableDeck);
  }
  return availableDeck.pop();
}

function updateStatus(text) {
  if (text) {
    statusBarEl.textContent = text;
    return;
  }
  const avgText = session.rounds > 0 
    ? `${Math.round((session.totalScore / session.rounds) * 100)}%` 
    : '--%';
  statusBarEl.innerHTML = `rounds: ${session.rounds}&nbsp;&nbsp;avg: ${avgText}`;
}

function setSquarePiece(cell, pieceChar) {
  cell.innerHTML = '';
  if (pieceChar && PIECE_IMAGES[pieceChar]) {
    const img = document.createElement('img');
    img.src = PIECE_IMAGES[pieceChar];
    img.alt = pieceChar;
    img.className = 'piece-img';
    cell.appendChild(img);
  }
}

// render board
function renderBoard(pieceMap = {}, interactive = false) {
  boardEl.innerHTML = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = sqName(r, c);
      const cell = document.createElement('div');
      cell.className = `square ${isLight(r, c) ? 'light' : 'dark'}`;
      cell.dataset.sq = sq;
      setSquarePiece(cell, pieceMap[sq]);

      if (interactive) {
        cell.onclick = () => {
          if (selectedTool === '.') {
            delete userPieces[sq];
            setSquarePiece(cell, null);
          } else {
            userPieces[sq] = selectedTool;
            setSquarePiece(cell, selectedTool);
          }
        };
      }
      boardEl.appendChild(cell);
    }
  }
}

// --- VIEWS SWITCHER ---
function showView(view) {
  if (view === 'settings') {
    trainerViewEl.classList.add('hidden');
    settingsViewEl.classList.remove('hidden');
    tabTrainerBtn.classList.remove('active');
    tabSettingsBtn.classList.add('active');
    renderSettingsView();
  } else {
    settingsViewEl.classList.add('hidden');
    trainerViewEl.classList.remove('hidden');
    tabSettingsBtn.classList.remove('active');
    tabTrainerBtn.classList.add('active');
  }
}

tabTrainerBtn.onclick = () => showView('trainer');
tabSettingsBtn.onclick = () => showView('settings');
backToTrainerBtn.onclick = () => showView('trainer');

// --- SETTINGS VIEW RENDER ---
function renderSettingsView() {
  const themeGridEl = document.getElementById('themeGrid');
  themeGridEl.innerHTML = Object.entries(THEMES).map(([key, t]) => `
    <div class="theme-card ${settings.theme === key ? 'active' : ''}" data-theme="${key}">
      <div class="theme-swatch">
        <div style="background-color: ${t.light}"></div>
        <div style="background-color: ${t.dark}"></div>
        <div style="background-color: ${t.dark}"></div>
        <div style="background-color: ${t.light}"></div>
      </div>
      <span class="theme-name">${t.name}</span>
    </div>
  `).join('');

  themeGridEl.querySelectorAll('[data-theme]').forEach(card => {
    card.onclick = () => {
      settings.theme = card.dataset.theme;
      applyBoardTheme();
      renderSettingsView();
    };
  });

  const modeRow = document.getElementById('settingsModeRow');
  modeRow.innerHTML = Object.keys(MODES).map(m => `
    <button class="toggle-btn ${settings.mode === m ? 'active' : ''}" data-mode="${m}">${m}</button>
  `).join('');
  modeRow.querySelectorAll('[data-mode]').forEach(btn => {
    btn.onclick = () => {
      settings.mode = btn.dataset.mode;
      availableDeck = [];
      renderSettingsView();
      if (state === 'idle') goIdle();
    };
  });

  document.getElementById('modeDesc').textContent = MODES[settings.mode].desc;

  const secRow = document.getElementById('settingsSecondsRow');
  secRow.innerHTML = [5, 10, 15, 20, 30].map(s => `
    <button class="toggle-btn ${settings.seconds === s ? 'active' : ''}" data-sec="${s}">${s}</button>
  `).join('');
  secRow.querySelectorAll('[data-sec]').forEach(btn => {
    btn.onclick = () => {
      settings.seconds = parseInt(btn.dataset.sec, 10);
      renderSettingsView();
      if (state === 'idle') goIdle();
    };
  });

  document.getElementById('customLightColor').value = settings.customLight;
  document.getElementById('customDarkColor').value = settings.customDark;
}

// custom color handling (disallowing pure black)
function isTooDark(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) < 35;
}

document.getElementById('applyCustomColorBtn').onclick = () => {
  const light = document.getElementById('customLightColor').value;
  const dark = document.getElementById('customDarkColor').value;
  const errorHint = document.getElementById('colorErrorHint');

  if (isTooDark(dark)) {
    errorHint.textContent = 'error: dark square cannot be black (#000) to keep black pieces visible.';
    return;
  }

  errorHint.textContent = '';
  settings.customLight = light;
  settings.customDark = dark;
  settings.theme = 'custom';
  applyBoardTheme();
  renderSettingsView();
};

// --- STATE MACHINE TRANSITIONS ---

// [STATE: IDLE]
function goIdle() {
  state = 'idle';
  clearInterval(timerId);
  renderBoard();
  updateStatus();

  controlsEl.innerHTML = `
    <div class="setting-row">
      <span>mode:</span>
      ${Object.keys(MODES).map(m => `
        <button class="toggle-btn ${settings.mode === m ? 'active' : ''}" data-mode="${m}">${m}</button>
      `).join('')}
    </div>
    <div class="setting-row">
      <span>seconds:</span>
      ${[5, 10, 15, 20, 30].map(s => `
        <button class="toggle-btn ${settings.seconds === s ? 'active' : ''}" data-sec="${s}">${s}</button>
      `).join('')}
    </div>
    <button class="btn" id="startBtn">[ start ]</button>
  `;

  controlsEl.querySelectorAll('[data-mode]').forEach(btn => {
    btn.onclick = () => {
      settings.mode = btn.dataset.mode;
      availableDeck = [];
      goIdle();
    };
  });

  controlsEl.querySelectorAll('[data-sec]').forEach(btn => {
    btn.onclick = () => {
      settings.seconds = parseInt(btn.dataset.sec, 10);
      goIdle();
    };
  });

  document.getElementById('startBtn').onclick = () => goMemorize();
}

// [STATE: MEMORIZE]
function goMemorize() {
  state = 'memorize';
  showView('trainer');
  currentPos = getNextPosition();
  if (!currentPos) return;
  currentPieces = parseFen(currentPos.fen);
  userPieces = {};

  renderBoard(currentPieces, false);
  timeLeft = settings.seconds;
  
  const tick = () => {
    const secStr = String(timeLeft).padStart(2, '0');
    updateStatus(`memorize: ${secStr}s`);
    if (timeLeft <= 0) {
      clearInterval(timerId);
      goRecall();
    }
    timeLeft--;
  };

  tick();
  clearInterval(timerId);
  timerId = setInterval(tick, 1000);

  controlsEl.innerHTML = `<button class="btn" id="readyBtn">[ ready ]</button>`;
  document.getElementById('readyBtn').onclick = () => {
    clearInterval(timerId);
    goRecall();
  };
}

// [STATE: RECALL]
function goRecall() {
  state = 'recall';
  clearInterval(timerId);
  updateStatus('');
  renderBoard(userPieces, true);

  controlsEl.innerHTML = `
    <div class="tray" id="tray">
      ${TRAY_PIECES.map(p => `
        <button class="tray-btn ${p === selectedTool ? 'selected' : ''}" data-piece="${p}" title="${p}">
          <img src="${PIECE_IMAGES[p]}" alt="${p}" class="tray-img">
        </button>
      `).join('')}
    </div>
    <button class="btn" id="checkBtn">[ check ]</button>
  `;

  controlsEl.querySelectorAll('.tray-btn').forEach(btn => {
    btn.onclick = () => {
      controlsEl.querySelectorAll('.tray-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedTool = btn.dataset.piece;
    };
  });

  document.getElementById('checkBtn').onclick = () => goResult();
}

// [STATE: RESULT]
function goResult() {
  state = 'result';
  const total = Object.keys(currentPieces).length;
  const correct = [];
  const missed = [];
  const wrong = [];

  for (const [sq, p] of Object.entries(currentPieces)) {
    if (userPieces[sq] === p) correct.push(p + sq);
    else missed.push(p + sq);
  }
  for (const [sq, p] of Object.entries(userPieces)) {
    if (currentPieces[sq] !== p) wrong.push(p + sq);
  }

  const netScore = Math.max(0, correct.length - wrong.length);
  const roundRatio = total > 0 ? netScore / total : 0;
  session.rounds += 1;
  session.totalScore += roundRatio;

  renderBoard(currentPieces, false);
  updateStatus();

  controlsEl.innerHTML = `
    <div class="results-info">
      <div>score: ${netScore}/${total}</div>
      <div class="results-list">correct: ${correct.join(' ') || 'none'}</div>
      <div class="results-list">missed: ${missed.join(' ') || 'none'}</div>
      <div class="results-list">wrong: ${wrong.join(' ') || 'none'}</div>
      ${currentPos.game ? `
        <a class="game-link" href="https://lichess.org/${currentPos.game}" target="_blank" rel="noopener">lichess.org/${currentPos.game}</a>
      ` : ''}
    </div>
    <button class="btn" id="nextBtn">[ next ]</button>
  `;

  document.getElementById('nextBtn').onclick = () => goMemorize();
}

// init
applyBoardTheme();
fetch('positions.json')
  .then(res => res.json())
  .then(data => {
    allPositions = data;
    goIdle();
  })
  .catch(err => {
    controlsEl.textContent = 'error loading positions.json';
  });
