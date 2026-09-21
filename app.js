// ====================================================
//  ghostboards — chess memory trainer
//  app.js
// ====================================================

// ── Sound Synthesizer (Web Audio API) ───────────────
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  _init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  _tone(freq1, freq2, dur, type = 'triangle', vol = 0.25) {
    if (!this.enabled) return;
    this._init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(freq1, now);
    if (freq2) osc.frequency.exponentialRampToValueAtTime(freq2, now + dur);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  }

  snap() { this._tone(420, 160, 0.06, 'triangle', 0.28); }
  erase() { this._tone(280, 130, 0.08, 'sine', 0.20); }
  tick() { this._tone(800, 800, 0.03, 'sine', 0.14); }

  success() {
    if (!this.enabled) return;
    this._init();
    if (!this.ctx) return;
    [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime + i * 0.09;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    });
  }

  good() {
    if (!this.enabled) return;
    this._init();
    if (!this.ctx) return;
    [587.33, 880.00].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime + i * 0.1;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    });
  }
}

const sounds = new SoundFX();

// ── Constants ────────────────────────────────────────

const THEMES = {
  wood: { name: 'classic wood', light: '#f0d9b5', dark: '#b58863' },
  green: { name: 'tournament green', light: '#ffffdd', dark: '#86a666' },
  blue: { name: 'oceanic blue', light: '#dee3e6', dark: '#8ca2ad' },
  slate: { name: 'slate grey', light: '#e8e8e8', dark: '#63707e' },
  sand: { name: 'warm sand', light: '#eae9d2', dark: '#4b7399' },
  maple: { name: 'vintage maple', light: '#fce4b8', dark: '#c47d3e' }
};

const MODES = {
  easy: { label: 'easy', desc: 'easy: 4-6 pieces (endgame studies)' },
  medium: { label: 'medium', desc: 'medium: 10-20 pieces (tactical middlegames)' },
  hard: { label: 'hard', desc: 'hard: 26-30 pieces (master openings)' }
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

const WHITE_PIECES = ['P', 'N', 'B', 'R', 'Q', 'K'];
const BLACK_PIECES = ['p', 'n', 'b', 'r', 'q', 'k'];

const PIECE_IMG = {
  K: 'assets/wK.svg', Q: 'assets/wQ.svg', R: 'assets/wR.svg',
  B: 'assets/wB.svg', N: 'assets/wN.svg', P: 'assets/wP.svg',
  k: 'assets/bK.svg', q: 'assets/bQ.svg', r: 'assets/bR.svg',
  b: 'assets/bB.svg', n: 'assets/bN.svg', p: 'assets/bP.svg',
  '.': 'assets/eraser.svg'
};

// ── State ─────────────────────────────────────────────

let state = 'idle'; // idle | memorize | recall | result
let activeTab = 'trainer';
let allPositions = [];
let availableDeck = [];
let currentPos = null;
let currentPieces = {};   // truth
let userPieces = {};   // player's recall
let undoStack = [];
let selectedTool = 'P';
let timerId = null;
let timeLeft = 10;
let totalCd = 10;
let isFlipped = false;
let diffMode = 'overlay'; // overlay | user | actual

let isBlitz = false;
let blitzTimer = null;
let blitzLeft = 60;

const DEFAULT_SETTINGS = {
  mode: 'easy', seconds: 10, theme: 'wood',
  customLight: '#f0d9b5', customDark: '#b58863',
  showCoords: true, soundEnabled: true, showGhost: true
};
let settings = { ...DEFAULT_SETTINGS };

const DEFAULT_STATS = {
  lifetimeRounds: 0, totalScore: 0, perfectRounds: 0,
  currentStreak: 0, bestStreak: 0, blitzHighScore: 0,
  dailyCompletedDate: null, dailyStreak: 0,
  pieceStats: {
    P: { total: 0, correct: 0 }, N: { total: 0, correct: 0 },
    B: { total: 0, correct: 0 }, R: { total: 0, correct: 0 },
    Q: { total: 0, correct: 0 }, K: { total: 0, correct: 0 }
  },
  history: []
};
let stats = JSON.parse(JSON.stringify(DEFAULT_STATS));

let session = { rounds: 0, totalScore: 0, streak: 0 };
let customSeconds = 10;
let pieceColor = 'white';

// ── DOM refs ──────────────────────────────────────────

const $ = id => document.getElementById(id);

const boardEl = $('board');
const controlsEl = $('controls');
const timerHudEl = $('timerHud');
const timerCircleEl = $('timerCircle');
const timerNumberEl = $('timerNumber');
const timerPhaseEl = $('timerPhase');
const timerSubEl = $('timerSub');
const diffInspector = $('diffInspector');
const boardToolbar = $('boardToolbar');

const statRoundsEl = $('statRounds');
const statAvgEl = $('statAvg');
const statModeEl = $('statMode');
const streakCountEl = $('streakCount');
const soundStateEl = $('soundState');

// Views
const views = {
  trainer: $('trainerView'),
  blitz: $('blitzView'),
  daily: $('dailyView'),
  custom: $('customView'),
  stats: $('statsView'),
  settings: $('settingsView')
};

// Nav buttons
const navBtns = {
  trainer: $('tabTrainerBtn'),
  blitz: $('tabBlitzBtn'),
  daily: $('tabDailyBtn'),
  custom: $('tabCustomBtn'),
  stats: $('tabStatsBtn'),
  settings: $('tabSettingsBtn')
};

// ── Storage ───────────────────────────────────────────

function loadStorage() {
  try {
    const s = localStorage.getItem('ghostboard_settings');
    const t = localStorage.getItem('ghostboard_stats');
    if (s) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(s) };
    if (t) stats = { ...JSON.parse(JSON.stringify(DEFAULT_STATS)), ...JSON.parse(t) };
  } catch (e) { /* ignore */ }
}

function save() {
  try {
    localStorage.setItem('ghostboard_settings', JSON.stringify(settings));
    localStorage.setItem('ghostboard_stats', JSON.stringify(stats));
  } catch (e) { /* ignore */ }
}

// ── Helpers ───────────────────────────────────────────

const sqName = (r, c) => isFlipped ? `${FILES[7 - c]}${RANKS[7 - r]}` : `${FILES[c]}${RANKS[r]}`;
const isLight = (r, c) => isFlipped ? (7 - r + (7 - c)) % 2 === 0 : (r + c) % 2 === 0;

function parseFen(fen) {
  const map = {};
  fen.trim().split(' ')[0].split('/').forEach((row, r) => {
    let c = 0;
    for (const ch of row) {
      if (ch >= '1' && ch <= '8') c += +ch;
      else { map[`${FILES[c]}${RANKS[r]}`] = ch; c++; }
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

function getNext(forcedMode = null) {
  const mode = forcedMode || settings.mode;
  const pool = allPositions.filter(p => p.difficulty === mode);
  if (!pool.length) return allPositions[0] || null;
  if (!availableDeck.length) { availableDeck = [...pool]; shuffle(availableDeck); }
  return availableDeck.pop();
}

function updateStatus() {
  statRoundsEl.textContent = session.rounds;
  statAvgEl.textContent = session.rounds > 0
    ? `${Math.round((session.totalScore / session.rounds) * 100)}%`
    : '--%';
  statModeEl.textContent = isBlitz ? 'blitz' : settings.mode;
  streakCountEl.textContent = session.streak;
}

function applyTheme() {
  let light = '#f0d9b5', dark = '#b58863';
  if (settings.theme === 'custom') {
    light = settings.customLight; dark = settings.customDark;
  } else if (THEMES[settings.theme]) {
    light = THEMES[settings.theme].light; dark = THEMES[settings.theme].dark;
  }
  document.documentElement.style.setProperty('--board-light', light);
  document.documentElement.style.setProperty('--board-dark', dark);

  const ranksEl = $('ranksEl'), filesEl = $('filesEl');
  if (ranksEl) ranksEl.style.display = settings.showCoords ? 'flex' : 'none';
  if (filesEl) filesEl.style.display = settings.showCoords ? 'grid' : 'none';

  sounds.enabled = settings.soundEnabled;
  soundStateEl.textContent = settings.soundEnabled ? 'on' : 'off';

  if (isFlipped) {
    if (ranksEl) ranksEl.innerHTML = '<span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>7</span><span>8</span>';
    if (filesEl) filesEl.innerHTML = '<span>h</span><span>g</span><span>f</span><span>e</span><span>d</span><span>c</span><span>b</span><span>a</span>';
  } else {
    if (ranksEl) ranksEl.innerHTML = '<span>8</span><span>7</span><span>6</span><span>5</span><span>4</span><span>3</span><span>2</span><span>1</span>';
    if (filesEl) filesEl.innerHTML = '<span>a</span><span>b</span><span>c</span><span>d</span><span>e</span><span>f</span><span>g</span><span>h</span>';
  }

  updateGhostCSS();
}

function updateGhostCSS() {
  const url = (settings.showGhost && selectedTool !== '.') ? `url(${PIECE_IMG[selectedTool]})` : 'none';
  document.documentElement.style.setProperty('--ghost-img', url);
}

// ── Timer HUD ─────────────────────────────────────────

const CIRC = 2 * Math.PI * 42; // ~263.9

function setTimerHud(sec, total, phase, sub) {
  if (sec === null) {
    timerHudEl.classList.add('hidden');
    return;
  }
  timerHudEl.classList.remove('hidden');
  timerNumberEl.textContent = sec;
  timerPhaseEl.textContent = phase;
  timerSubEl.textContent = sub;
  const ratio = Math.max(0, sec / total);
  timerCircleEl.style.strokeDashoffset = CIRC * (1 - ratio);
  if (sec <= 3) { timerHudEl.classList.add('urgent'); sounds.tick(); }
  else { timerHudEl.classList.remove('urgent'); }
}

// ── Board Rendering ───────────────────────────────────

function setSquare(cell, piece, ghost = false) {
  cell.innerHTML = '';
  if (!piece || !PIECE_IMG[piece]) return;
  const img = document.createElement('img');
  img.src = PIECE_IMG[piece];
  img.alt = piece;
  img.className = ghost ? 'ghost-piece' : 'piece-img';
  img.draggable = (state === 'recall' && !ghost);

  if (state === 'recall' && !ghost) {
    img.addEventListener('dragstart', e => {
      e.dataTransfer.setData('piece', piece);
      e.dataTransfer.setData('src', cell.dataset.sq);
      img.classList.add('dragging');
    });
    img.addEventListener('dragend', () => img.classList.remove('dragging'));
  }
  cell.appendChild(img);
}

function pushUndo() {
  undoStack.push(JSON.stringify(userPieces));
  if (undoStack.length > 40) undoStack.shift();
}

function renderBoard(map = {}, interactive = false, diff = null) {
  boardEl.innerHTML = '';
  updateGhostCSS();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = sqName(r, c);
      const cell = document.createElement('div');
      cell.className = `square ${isLight(r, c) ? 'light' : 'dark'}`;
      cell.dataset.sq = sq;

      if (interactive) {
        cell.classList.add('interactive');

        cell.addEventListener('click', () => {
          pushUndo();
          if (selectedTool === '.') {
            delete userPieces[sq];
            setSquare(cell, null);
            sounds.erase();
          } else {
            userPieces[sq] = selectedTool;
            setSquare(cell, selectedTool);
            sounds.snap();
          }
        });

        cell.addEventListener('contextmenu', e => {
          e.preventDefault();
          if (userPieces[sq]) {
            pushUndo();
            delete userPieces[sq];
            setSquare(cell, null);
            sounds.erase();
          }
        });

        cell.addEventListener('dragover', e => { e.preventDefault(); cell.classList.add('drag-over'); });
        cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
        cell.addEventListener('drop', e => {
          e.preventDefault();
          cell.classList.remove('drag-over');
          const piece = e.dataTransfer.getData('piece');
          const src = e.dataTransfer.getData('src');
          if (!piece || !PIECE_IMG[piece]) return;
          pushUndo();
          if (src && src !== sq) {
            delete userPieces[src];
            const srcCell = boardEl.querySelector(`[data-sq="${src}"]`);
            if (srcCell) setSquare(srcCell, null);
          }
          if (piece === '.') {
            delete userPieces[sq]; setSquare(cell, null); sounds.erase();
          } else {
            userPieces[sq] = piece; setSquare(cell, piece); sounds.snap();
          }
        });
      }

      if (diff === 'overlay') {
        const truth = currentPieces[sq];
        const user = userPieces[sq];
        if (truth && user === truth) {
          cell.classList.add('diff-correct');
          setSquare(cell, user);
        } else if (user && user !== truth) {
          cell.classList.add('diff-wrong');
          setSquare(cell, user);
          if (truth) {
            const g = document.createElement('img');
            g.src = PIECE_IMG[truth]; g.className = 'ghost-piece';
            cell.appendChild(g);
          }
        } else if (truth && !user) {
          cell.classList.add('diff-missed');
          setSquare(cell, truth, true);
        }
      } else if (diff === 'user') {
        setSquare(cell, userPieces[sq]);
      } else if (diff === 'actual') {
        setSquare(cell, currentPieces[sq]);
      } else {
        setSquare(cell, map[sq]);
      }

      boardEl.appendChild(cell);
    }
  }
}

// ── Piece Tray ────────────────────────────────────────

function trayHTML() {
  const makeBtn = (p, key) => `
    <button class="tray-btn ${p === selectedTool ? 'selected' : ''}" data-piece="${p}" title="${p}" draggable="true">
      <img src="${PIECE_IMG[p]}" alt="${p}" class="tray-img">
      <span class="tray-key">${key}</span>
    </button>`;

  const wRow = WHITE_PIECES.map((p, i) => makeBtn(p, i + 1)).join('');
  const bRow = BLACK_PIECES.map((p, i) => makeBtn(p, i + 1)).join('');
  const eraser = `
    <button class="tray-btn ${selectedTool === '.' ? 'selected' : ''}" data-piece="." title="eraser (E)" draggable="true">
      <img src="${PIECE_IMG['.']}" alt="eraser" class="tray-img">
      <span class="tray-key">E</span>
    </button>`;

  return `
    <div class="tray-wrap" id="pieceTray">
      <div class="tray-row">${wRow}</div>
      <div class="tray-row">${bRow}${eraser}</div>
    </div>`;
}

function bindTray() {
  controlsEl.querySelectorAll('.tray-btn').forEach(btn => {
    btn.addEventListener('click', () => selectTool(btn.dataset.piece));
    btn.addEventListener('dragstart', e => {
      e.dataTransfer.setData('piece', btn.dataset.piece);
      selectTool(btn.dataset.piece);
    });
  });
}

function selectTool(p) {
  selectedTool = p;
  controlsEl.querySelectorAll('.tray-btn').forEach(b =>
    b.classList.toggle('selected', b.dataset.piece === p));
  updateGhostCSS();
}

// ── State Machine ─────────────────────────────────────

function goIdle() {
  state = 'idle';
  clearInterval(timerId);
  setTimerHud(null);
  diffInspector.classList.add('hidden');
  boardToolbar.classList.add('hidden');
  renderBoard({}, false);
  updateStatus();

  controlsEl.innerHTML = `
    <div class="idle-controls">
      <div class="control-row">
        <span class="control-label">difficulty</span>
        ${Object.keys(MODES).map(m =>
    `<button class="toggle-btn ${settings.mode === m ? 'active' : ''}" data-mode="${m}">${m}</button>`
  ).join('')}
      </div>
      <div class="control-row">
        <span class="control-label">memorize</span>
        ${[5, 10, 15, 20, 30].map(s =>
    `<button class="toggle-btn ${settings.seconds === s ? 'active' : ''}" data-sec="${s}">${s}s</button>`
  ).join('')}
      </div>
      <button class="btn btn-primary" id="startBtn">[ start ]</button>
    </div>`;

  controlsEl.querySelectorAll('[data-mode]').forEach(btn =>
    btn.addEventListener('click', () => {
      settings.mode = btn.dataset.mode;
      save(); availableDeck = []; goIdle();
    }));

  controlsEl.querySelectorAll('[data-sec]').forEach(btn =>
    btn.addEventListener('click', () => {
      settings.seconds = +btn.dataset.sec;
      save(); goIdle();
    }));

  $('startBtn').addEventListener('click', () => goMemorize());
}

function goMemorize(pos = null) {
  state = 'memorize';
  diffInspector.classList.add('hidden');
  boardToolbar.classList.add('hidden');

  currentPos = pos || getNext();
  if (!currentPos) return;
  currentPieces = parseFen(currentPos.fen);
  userPieces = {};
  undoStack = [];

  renderBoard(currentPieces, false);

  totalCd = isBlitz ? 5 : settings.seconds;
  timeLeft = totalCd;

  const tick = () => {
    setTimerHud(timeLeft, totalCd, 'memorize', currentPos.title || 'study the position');
    if (timeLeft <= 0) { clearInterval(timerId); goRecall(); }
    timeLeft--;
  };

  tick();
  clearInterval(timerId);
  timerId = setInterval(tick, 1000);

  controlsEl.innerHTML = `<button class="btn btn-primary" id="readyBtn">[ ready — start recall ]</button>`;
  $('readyBtn').addEventListener('click', () => { clearInterval(timerId); goRecall(); });
}

function goRecall() {
  state = 'recall';
  clearInterval(timerId);
  setTimerHud(null);
  diffInspector.classList.add('hidden');
  boardToolbar.classList.remove('hidden');

  renderBoard(userPieces, true);

  controlsEl.innerHTML = `
    ${trayHTML()}
    <button class="btn btn-primary" id="checkBtn">[ check recall ]</button>`;

  bindTray();
  $('checkBtn').addEventListener('click', () => goResult());
}

function goResult() {
  state = 'result';
  boardToolbar.classList.add('hidden');
  diffInspector.classList.remove('hidden');

  const total = Object.keys(currentPieces).length;
  const correct = [], missed = [], wrong = [];

  for (const [sq, p] of Object.entries(currentPieces)) {
    const t = p.toUpperCase();
    if (stats.pieceStats[t]) stats.pieceStats[t].total++;
    if (userPieces[sq] === p) {
      correct.push({ sq, p });
      if (stats.pieceStats[t]) stats.pieceStats[t].correct++;
    } else {
      missed.push({ sq, p });
    }
  }
  for (const [sq, p] of Object.entries(userPieces)) {
    if (currentPieces[sq] !== p) wrong.push({ sq, p });
  }

  const net = Math.max(0, correct.length - wrong.length);
  const pct = total > 0 ? Math.round((net / total) * 100) : 0;
  const ratio = total > 0 ? net / total : 0;

  if (pct === 100) { sounds.success(); session.streak++; stats.perfectRounds++; }
  else if (pct >= 70) { sounds.good(); session.streak++; }
  else { session.streak = 0; }

  stats.bestStreak = Math.max(stats.bestStreak, session.streak);
  session.rounds++;
  session.totalScore += ratio;
  stats.lifetimeRounds++;
  stats.totalScore = (stats.totalScore || 0) + ratio;
  stats.currentStreak = session.streak;

  stats.history.unshift({
    title: currentPos.title || 'chess position',
    score: `${net}/${total}`,
    accuracy: pct,
    difficulty: currentPos.difficulty || 'custom'
  });
  if (stats.history.length > 30) stats.history.pop();

  save();
  updateStatus();

  // Diff view
  diffMode = 'overlay';
  updateDiffTabs();
  renderBoard(currentPieces, false, 'overlay');

  const cls = pct === 100 ? 'perfect' : pct >= 70 ? 'good' : 'low';

  controlsEl.innerHTML = `
    <div class="result-block">
      <div class="result-header">
        <span class="result-accuracy ${cls}">${pct}% accuracy</span>
        <span style="font-size:0.82rem;color:var(--muted)">score: ${net} / ${total}</span>
      </div>
      <div class="accuracy-bar">
        <div class="accuracy-fill ${cls}" style="width:${pct}%"></div>
      </div>
      <div class="result-row">
        <span>correct: <b>${correct.length}</b></span>
        <span>wrong: <b>${wrong.length}</b></span>
        <span>missed: <b>${missed.length}</b></span>
      </div>
      <div class="result-meta">
        ${currentPos.title ? `<span>${currentPos.title}</span>` : ''}
        ${currentPos.game ? `<a class="game-link" href="https://lichess.org/${currentPos.game}" target="_blank" rel="noopener">lichess.org/${currentPos.game}</a>` : ''}
      </div>
    </div>
    <button class="btn btn-primary" id="nextBtn">[ next ]</button>`;

  $('nextBtn').addEventListener('click', () => goMemorize());
}

// ── Diff Inspector ────────────────────────────────────

function updateDiffTabs() {
  $('diffViewOverlayBtn').classList.toggle('active', diffMode === 'overlay');
  $('diffViewUserBtn').classList.toggle('active', diffMode === 'user');
  $('diffViewActualBtn').classList.toggle('active', diffMode === 'actual');
}

$('diffViewOverlayBtn').addEventListener('click', () => {
  diffMode = 'overlay'; updateDiffTabs(); renderBoard(currentPieces, false, 'overlay');
});
$('diffViewUserBtn').addEventListener('click', () => {
  diffMode = 'user'; updateDiffTabs(); renderBoard(userPieces, false, 'user');
});
$('diffViewActualBtn').addEventListener('click', () => {
  diffMode = 'actual'; updateDiffTabs(); renderBoard(currentPieces, false, 'actual');
});

// ── Recall Toolbar ────────────────────────────────────

$('btnUndo').addEventListener('click', () => {
  if (undoStack.length > 0) {
    userPieces = JSON.parse(undoStack.pop());
    renderBoard(userPieces, true);
    sounds.snap();
  }
});

$('btnClear').addEventListener('click', () => {
  if (Object.keys(userPieces).length) {
    pushUndo(); userPieces = {};
    renderBoard(userPieces, true);
    sounds.erase();
  }
});

$('btnHint').addEventListener('click', () => {
  const candidates = Object.keys(currentPieces).filter(sq => userPieces[sq] !== currentPieces[sq]);
  if (candidates.length) {
    pushUndo();
    const sq = candidates[Math.floor(Math.random() * candidates.length)];
    userPieces[sq] = currentPieces[sq];
    renderBoard(userPieces, true);
    sounds.snap();
  }
});

$('btnFlip').addEventListener('click', () => {
  isFlipped = !isFlipped;
  applyTheme();
  if (state === 'recall') renderBoard(userPieces, true);
  else if (state === 'result') renderBoard(currentPieces, false, diffMode);
  else if (state === 'memorize') renderBoard(currentPieces, false);
  else renderBoard({}, false);
});

// ── View Routing ──────────────────────────────────────

function showView(name) {
  activeTab = name;
  Object.entries(views).forEach(([k, el]) => el.classList.toggle('hidden', k !== name));
  Object.entries(navBtns).forEach(([k, btn]) => {
    btn.classList.toggle('active', k === name);
    btn.setAttribute('aria-selected', k === name ? 'true' : 'false');
  });

  if (name === 'trainer') { if (state === 'idle') goIdle(); }
  else if (name === 'blitz') renderBlitz();
  else if (name === 'daily') renderDaily();
  else if (name === 'custom') renderCustom();
  else if (name === 'stats') renderStats();
  else if (name === 'settings') renderSettings();
}

Object.entries(navBtns).forEach(([k, btn]) =>
  btn.addEventListener('click', () => showView(k)));

// ── Blitz Mode ────────────────────────────────────────

function renderBlitz() {
  $('blitzHighScore').textContent = stats.blitzHighScore || 0;
  $('startBlitzBtn').onclick = startBlitz;
}

function startBlitz() {
  isBlitz = true;
  blitzLeft = 60;
  showView('trainer');

  clearInterval(blitzTimer);
  blitzTimer = setInterval(() => {
    blitzLeft--;
    if (blitzLeft <= 0) {
      clearInterval(blitzTimer);
      isBlitz = false;
      stats.blitzHighScore = Math.max(stats.blitzHighScore || 0, session.rounds);
      save();
      alert(`blitz complete. you finished ${session.rounds} board${session.rounds !== 1 ? 's' : ''}.`);
      showView('blitz');
    }
  }, 1000);

  goMemorize();
}

// ── Daily Challenge ───────────────────────────────────

function getDailySeed() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function renderDaily() {
  const seed = getDailySeed();
  const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  $('dailyDateString').textContent = dateStr;

  const done = stats.dailyCompletedDate === seed;
  $('dailyStatusText').textContent = done
    ? `completed. streak: ${stats.dailyStreak || 1} days.`
    : 'ready to play today\'s board.';
  $('startDailyBtn').textContent = done ? '[ replay daily ]' : '[ play daily ]';

  $('startDailyBtn').onclick = () => {
    let h = 0;
    for (const c of seed) h = (h << 5) - h + c.charCodeAt(0);
    const pos = allPositions[Math.abs(h) % allPositions.length];
    showView('trainer');
    if (!done) {
      stats.dailyCompletedDate = seed;
      stats.dailyStreak = (stats.dailyStreak || 0) + 1;
      save();
    }
    goMemorize(pos);
  };
}

// ── Custom Position ───────────────────────────────────

function renderCustom() {
  const secRow = $('customSecondsRow');
  secRow.innerHTML = [5, 10, 15, 20, 30].map(s =>
    `<button class="toggle-btn ${customSeconds === s ? 'active' : ''}" data-csec="${s}">${s}s</button>`
  ).join('');

  secRow.querySelectorAll('[data-csec]').forEach(btn =>
    btn.addEventListener('click', () => { customSeconds = +btn.dataset.csec; renderCustom(); }));

  document.querySelectorAll('.chip[data-fen]').forEach(chip =>
    chip.addEventListener('click', () => { $('customFenInput').value = chip.dataset.fen; }));

  $('startCustomBtn').onclick = () => {
    const fen = $('customFenInput').value.trim();
    if (!fen) { alert('please enter a fen string.'); return; }
    settings.seconds = customSeconds;
    const pos = { fen, difficulty: 'custom', title: 'custom position' };
    showView('trainer');
    goMemorize(pos);
  };
}

// ── Stats View ────────────────────────────────────────

function renderStats() {
  $('statsLifetimeRounds').textContent = stats.lifetimeRounds;
  $('statsLifetimeAccuracy').textContent = stats.lifetimeRounds > 0
    ? `${Math.round((stats.totalScore / stats.lifetimeRounds) * 100)}%`
    : '--%';
  $('statsPerfectRounds').textContent = stats.perfectRounds;
  $('statsBestStreak').textContent = stats.bestStreak;

  const pieceGrid = $('pieceStatsGrid');
  pieceGrid.innerHTML = ['P', 'N', 'B', 'R', 'Q', 'K'].map(p => {
    const d = stats.pieceStats[p] || { total: 0, correct: 0 };
    const pct = d.total > 0 ? `${Math.round((d.correct / d.total) * 100)}%` : '--';
    return `
      <div class="piece-stat-item">
        <img src="${PIECE_IMG[p]}" alt="${p}" class="piece-stat-img">
        <span class="piece-stat-pct">${pct}</span>
      </div>`;
  }).join('');

  const histEl = $('historyList');
  if (stats.history?.length > 0) {
    histEl.innerHTML = stats.history.map(r => `
      <div class="history-item">
        <span class="history-name">${r.title}</span>
        <span class="history-score">${r.accuracy}%</span>
      </div>`).join('');
  } else {
    histEl.innerHTML = '<div class="empty-state">no rounds yet.</div>';
  }

  $('resetStatsBtn').onclick = () => {
    if (!confirm('reset all statistics?')) return;
    stats = JSON.parse(JSON.stringify(DEFAULT_STATS));
    session = { rounds: 0, totalScore: 0, streak: 0 };
    save();
    renderStats();
    updateStatus();
  };
}

// ── Settings View ─────────────────────────────────────

function renderSettings() {
  const themeGrid = $('themeGrid');
  themeGrid.innerHTML = Object.entries(THEMES).map(([key, t]) => `
    <div class="theme-card ${settings.theme === key ? 'active' : ''}" data-theme="${key}">
      <div class="theme-swatch">
        <div style="background:${t.light}"></div>
        <div style="background:${t.dark}"></div>
        <div style="background:${t.dark}"></div>
        <div style="background:${t.light}"></div>
      </div>
      <span class="theme-name">${t.name}</span>
    </div>`).join('');

  themeGrid.querySelectorAll('[data-theme]').forEach(card =>
    card.addEventListener('click', () => {
      settings.theme = card.dataset.theme;
      applyTheme(); save(); renderSettings();
    }));

  const modeRow = $('settingsModeRow');
  modeRow.innerHTML = Object.keys(MODES).map(m =>
    `<button class="toggle-btn ${settings.mode === m ? 'active' : ''}" data-mode="${m}">${m}</button>`
  ).join('');
  modeRow.querySelectorAll('[data-mode]').forEach(btn =>
    btn.addEventListener('click', () => {
      settings.mode = btn.dataset.mode;
      save(); availableDeck = []; renderSettings();
    }));

  $('modeDesc').textContent = MODES[settings.mode].desc;

  const secRow = $('settingsSecondsRow');
  secRow.innerHTML = [5, 10, 15, 20, 30].map(s =>
    `<button class="toggle-btn ${settings.seconds === s ? 'active' : ''}" data-sec="${s}">${s}s</button>`
  ).join('');
  secRow.querySelectorAll('[data-sec]').forEach(btn =>
    btn.addEventListener('click', () => {
      settings.seconds = +btn.dataset.sec;
      save(); renderSettings();
    }));

  // Checkboxes
  const coords = $('settingCoordsToggle');
  coords.checked = settings.showCoords;
  coords.onchange = () => { settings.showCoords = coords.checked; applyTheme(); save(); };

  const snd = $('settingSoundToggle');
  snd.checked = settings.soundEnabled;
  snd.onchange = () => { settings.soundEnabled = snd.checked; applyTheme(); save(); };

  const ghost = $('settingGhostToggle');
  ghost.checked = settings.showGhost;
  ghost.onchange = () => { settings.showGhost = ghost.checked; updateGhostCSS(); save(); };

  $('customLightColor').value = settings.customLight;
  $('customDarkColor').value = settings.customDark;
}

// Custom color picker
function tooDark(hex) {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) < 35;
}

$('applyCustomColorBtn').addEventListener('click', () => {
  const light = $('customLightColor').value;
  const dark = $('customDarkColor').value;
  const errEl = $('colorErrorHint');
  if (tooDark(dark)) {
    errEl.textContent = 'dark square cannot be near-black — black pieces would be invisible.';
    return;
  }
  errEl.textContent = '';
  settings.customLight = light;
  settings.customDark = dark;
  settings.theme = 'custom';
  applyTheme(); save(); renderSettings();
});

// ── Keyboard Shortcuts ────────────────────────────────

const PIECE_KEYS_W = { '1': 'P', '2': 'N', '3': 'B', '4': 'R', '5': 'Q', '6': 'K' };
const PIECE_KEYS_B = { '1': 'p', '2': 'n', '3': 'b', '4': 'r', '5': 'q', '6': 'k' };

window.addEventListener('keydown', e => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  const k = e.key.toLowerCase();

  if (k === 'm') {
    settings.soundEnabled = !settings.soundEnabled;
    applyTheme(); save(); return;
  }

  if (k === '?') { $('shortcutsModal').classList.toggle('hidden'); return; }

  if (k === 'f') { $('btnFlip').click(); return; }

  if ((k === 'z') && state === 'recall') { $('btnUndo').click(); return; }
  if (k === 'c' && state === 'recall') { $('btnClear').click(); return; }
  if (k === 'h' && state === 'recall') { $('btnHint').click(); return; }

  if ((k === 'e' || k === 'backspace' || k === 'delete') && state === 'recall') {
    selectTool('.'); return;
  }

  if (e.key === 'Tab' && state === 'recall') {
    e.preventDefault();
    pieceColor = pieceColor === 'white' ? 'black' : 'white';
    if (selectedTool !== '.') {
      const upper = selectedTool.toUpperCase();
      selectTool(pieceColor === 'white' ? upper : upper.toLowerCase());
    }
    return;
  }

  if (PIECE_KEYS_W[k] && state === 'recall') {
    selectTool(pieceColor === 'white' ? PIECE_KEYS_W[k] : PIECE_KEYS_B[k]);
    return;
  }

  if ((k === ' ' || k === 'enter') && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    if (state === 'idle') goMemorize();
    else if (state === 'memorize') { clearInterval(timerId); goRecall(); }
    else if (state === 'recall') goResult();
    else if (state === 'result') goMemorize();
  }
});

// ── Shortcuts Modal ───────────────────────────────────

$('soundToggleBtn').addEventListener('click', () => {
  settings.soundEnabled = !settings.soundEnabled;
  applyTheme(); save();
});

$('shortcutsToggleBtn').addEventListener('click', () => $('shortcutsModal').classList.remove('hidden'));
$('closeShortcutsBtn').addEventListener('click', () => $('shortcutsModal').classList.add('hidden'));
$('modalOkBtn').addEventListener('click', () => $('shortcutsModal').classList.add('hidden'));
$('shortcutsModal').addEventListener('click', e => {
  if (e.target === $('shortcutsModal')) $('shortcutsModal').classList.add('hidden');
});

// ── Init ──────────────────────────────────────────────

loadStorage();
applyTheme();

fetch('positions.json')
  .then(r => r.json())
  .then(data => {
    allPositions = data;
    goIdle();
  })
  .catch(() => {
    controlsEl.textContent = 'error: could not load positions.json';
  });
