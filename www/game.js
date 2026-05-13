const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hpEl = document.getElementById('hp');
const goldEl = document.getElementById('gold');
const waveEl = document.getElementById('wave');
const hudEl = document.getElementById('hud');

const LOGICAL_W = 360;
const LOGICAL_H = 640;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const scale = Math.min(window.innerWidth / LOGICAL_W, window.innerHeight / LOGICAL_H);
  canvas.style.width = (LOGICAL_W * scale) + 'px';
  canvas.style.height = (LOGICAL_H * scale) + 'px';
  canvas.width = Math.floor(LOGICAL_W * scale * dpr);
  canvas.height = Math.floor(LOGICAL_H * scale * dpr);
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function getLogicalPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / rect.width * LOGICAL_W,
    y: (clientY - rect.top) / rect.height * LOGICAL_H,
  };
}

const path = [
  { x: 60, y: 0 },
  { x: 60, y: 150 },
  { x: 280, y: 150 },
  { x: 280, y: 350 },
  { x: 80, y: 350 },
  { x: 80, y: 540 },
  { x: 300, y: 540 },
  { x: 300, y: 640 },
];

const TOWER = {
  cost: 50,
  radius: 14,
  projectileSpeed: 280,
  promotionCosts: [125, 250, 1000], // [t0→t1, t1→t2, t2→t3]
  xpThresholds:   [20,  40,  200],  // 같은 인덱스
  buffRates:      [0.10, 0.10, 0.20, 0.30], // 버프 받는 타워의 티어(t0, t1, t2, t3)에 적용
  maxTier: 3, // t0→t1→t2→t3 (탱크 라인부터)
};

const TOWER_ROLES = {
  base: {
    name: '기본', tagline: '균형형 · 지상 단일',
    color: '#3498db', color2: '#1a5680',
    range: 90, fireRate: 1.2, damage: 1.2,
    attackTypes: ['ground'], splash: 0,
    promotions: ['bunker', 'scout'],
  },
  bunker: {
    name: '벙커', tagline: '단발 고화력 · 지상 전담',
    color: '#5d6d7e', color2: '#212f3d',
    range: 100, fireRate: 1, damage: 3.6,
    attackTypes: ['ground'], splash: 0,
    promotions: ['tank', 'buff'],
  },
  scout: {
    name: '스카웃', tagline: '원거리 다목적 · 지상/공중',
    color: '#16a085', color2: '#0e6655',
    range: 140, fireRate: 1.2, damage: 1.6,
    attackTypes: ['ground', 'air'], splash: 0,
    promotions: ['eagle', 'filder'],
  },
  tank: {
    name: '탱크', tagline: '범위 공격 · 지상 (반경 40)',
    color: '#7e5109', color2: '#4a2810',
    range: 90, fireRate: 0.8, damage: 5,
    attackTypes: ['ground'], splash: 40,
    promotions: ['whale', 'trap'],
  },
  whale: {
    name: '웨일', tagline: '광역 폭발 · 지상 (반경 80)',
    color: '#5d4037', color2: '#3e2723',
    range: 120, fireRate: 0.6, damage: 10,
    attackTypes: ['ground'], splash: 80,
    promotions: [],
  },
  trap: {
    name: '트랩', tagline: '사거리 내 일제 타격 · 지상 / 공중',
    color: '#7b241c', color2: '#4a1810',
    range: 90, fireRate: 0.2, damage: 20,
    attackTypes: ['ground', 'air'], splash: 0,
    promotions: [],
    areaSweep: true,
  },
  buff: {
    name: '배이스', tagline: '주변 아군 사거리·XP 강화',
    color: '#d4ac0d', color2: '#9a7d0a',
    range: 90, fireRate: 1, damage: 2,
    attackTypes: ['ground'], splash: 0,
    promotions: ['beacon', 'demon'],
    buffsRange: true,
    boostsXp: true,
  },
  beacon: {
    name: '비콘', tagline: '사거리·공격력·XP 버프 · 지상',
    color: '#f4d03f', color2: '#b9770e',
    range: 120, fireRate: 1, damage: 2,
    attackTypes: ['ground'], splash: 0,
    promotions: [],
    buffsRange: true,
    buffsDamage: true,
    boostsXp: true,
  },
  demon: {
    name: '데몬', tagline: '버프 + 적 슬로우 · 비공격',
    color: '#5b2c6f', color2: '#2c0d3c',
    range: 90, fireRate: 0, damage: 0,
    attackTypes: [], splash: 0,
    promotions: [],
    buffsRange: true,
    boostsXp: true,
    slowsEnemies: true,
    slowFactor: 0.5,
  },
  eagle: {
    name: '이글', tagline: '공중 전담 · 빠른 사격',
    color: '#2874a6', color2: '#1f618d',
    range: 140, fireRate: 2.4, damage: 2.4,
    attackTypes: ['air'], splash: 0,
    promotions: ['skydoom', 'interceptor'],
  },
  skydoom: {
    name: '스카이둠', tagline: '광역 공중 폭격 · 반경 40',
    color: '#1f3a5f', color2: '#0c1c30',
    range: 140, fireRate: 2.4, damage: 4,
    attackTypes: ['air'], splash: 40,
    promotions: [],
  },
  interceptor: {
    name: '인터셉터', tagline: '7발 부채꼴 · 공중 (직선 비유도)',
    color: '#85c1e9', color2: '#5499c7',
    range: 160, fireRate: 5, damage: 2.4,
    attackTypes: ['air'], splash: 0,
    promotions: [],
    fanShot: true,
    projectileCount: 7,
    spreadDeg: 32,
  },
  filder: {
    name: '필더', tagline: '즉발 빔 · 지상 / 공중',
    color: '#52be80', color2: '#239b56',
    range: 120, fireRate: 1.6, damage: 2.4,
    attackTypes: ['ground', 'air'], splash: 0,
    promotions: ['master', 'dealman'],
    instantHit: true,
  },
  master: {
    name: '마스터', tagline: '강화 즉발 빔 · 지상 / 공중',
    color: '#196f3d', color2: '#0e4d2a',
    range: 140, fireRate: 4, damage: 4,
    attackTypes: ['ground', 'air'], splash: 0,
    promotions: [],
    instantHit: true,
  },
  dealman: {
    name: '딜맨', tagline: '관통 빔 · 고HP 우선 · 지상 / 공중',
    color: '#cb4335', color2: '#922b21',
    range: 200, fireRate: 1, damage: 12,
    attackTypes: ['ground', 'air'], splash: 0,
    promotions: [],
    instantHit: true,
    pierces: true,
    targetMode: 'highestHp',
  },
};

function xpMaxFor(t) {
  return TOWER.xpThresholds[t.tier] || 0;
}

function promotionCostFor(t) {
  return TOWER.promotionCosts[t.tier] || 0;
}

const PATH_WIDTH = 28;
const ENEMY_KILL_REWARD = 6;
const HUD_RESERVED_TOP = 36;
const HOLD_DELETE_SECONDS = 1.0;

// ============ Drawing helpers ============
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawButton(btn, label, pressed) {
  ctx.fillStyle = pressed ? '#922b1f' : '#c0392b';
  roundRect(btn.x, btn.y, btn.w, btn.h, 14);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2);
  ctx.textBaseline = 'alphabetic';
}

function hitButton(btn, p) {
  return p.x >= btn.x && p.x <= btn.x + btn.w && p.y >= btn.y && p.y <= btn.y + btn.h;
}

function drawPath(alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#8a7a5a';
  ctx.lineWidth = PATH_WIDTH;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ============ Geometry helpers ============
function pointToSegmentDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function distanceToPath(x, y) {
  let min = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const d = pointToSegmentDist(x, y, path[i].x, path[i].y, path[i + 1].x, path[i + 1].y);
    if (d < min) min = d;
  }
  return min;
}

// ============ Scene manager ============
const scenes = {};
let currentSceneName = null;

function changeScene(name) {
  currentSceneName = name;
  scenes[name].enter?.();
  hudEl.style.display = (name === 'playing') ? 'flex' : 'none';
}

// ============ Title scene ============
const titleButtonsWithSave = {
  continueBtn: { x: 80, y: 372, w: 200, h: 64 },
  start:       { x: 80, y: 460, w: 200, h: 64 },
};
const titleButtonsNoSave = {
  start: { x: 80, y: 400, w: 200, h: 64 },
};
let titleAnim = 0;
let titleSave = null;

function drawContinueButton(btn, wave) {
  ctx.fillStyle = '#c0392b';
  roundRect(btn.x, btn.y, btn.w, btn.h, 14);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '13px sans-serif';
  ctx.fillText('이어서 하기', btn.x + btn.w / 2, btn.y + btn.h / 2 - 13);
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`Wave ${wave}`, btn.x + btn.w / 2, btn.y + btn.h / 2 + 11);
  ctx.textBaseline = 'alphabetic';
}

scenes.title = {
  enter() {
    titleAnim = 0;
    titleSave = loadSaveData();
  },
  update(dt) {
    titleAnim += dt;
  },
  draw() {
    ctx.fillStyle = '#1a2e1a';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    drawPath(0.25);

    ctx.textAlign = 'center';

    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('PROMOTION', LOGICAL_W / 2, 162);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('TOWER', LOGICAL_W / 2, 210);
    ctx.fillText('DEFENSE', LOGICAL_W / 2, 266);

    ctx.fillStyle = '#9ab39a';
    ctx.font = '13px sans-serif';
    ctx.fillText('OFFLINE EDITION', LOGICAL_W / 2, 296);

    const pulse = 0.5 + 0.5 * Math.sin(titleAnim * 3);

    if (titleSave) {
      ctx.globalAlpha = 0.6 + 0.4 * pulse;
      drawContinueButton(titleButtonsWithSave.continueBtn, titleSave.wave);
      ctx.globalAlpha = 1;
      drawButton(titleButtonsWithSave.start, '게임 시작');
    } else {
      ctx.globalAlpha = 0.6 + 0.4 * pulse;
      drawButton(titleButtonsNoSave.start, '게임 시작');
      ctx.globalAlpha = 1;
    }

  },
  pointerDown(p) {
    if (titleSave && hitButton(titleButtonsWithSave.continueBtn, p)) {
      loadGame(titleSave);
      changeScene('playing');
      return;
    }
    const startBtn = titleSave ? titleButtonsWithSave.start : titleButtonsNoSave.start;
    if (hitButton(startBtn, p)) {
      resetGame();
      changeScene('playing');
      return;
    }
  },
};

// ============ Playing scene ============
const game = {
  hp: 20,
  gold: 100,
  wave: 1,
  enemies: [],
  towers: [],
  projectiles: [],
  beams: [],
  splashes: [],
  spawnTimer: 0,
  spawnInterval: 1.2,
  spawnedThisWave: 0,
  enemiesPerWave: 8,
  waveState: 'spawning',
  intermissionTimer: 0,
  selectedTower: null,
  promotionChoiceOpen: false,
  modal: null,
  paused: false,
  holdDelete: null,
};

function resetGame() {
  game.hp = 20;
  game.gold = 100;
  game.wave = 1;
  game.enemies = [];
  game.towers = [];
  game.projectiles = [];
  game.beams = [];
  game.splashes = [];
  game.spawnTimer = 0;
  game.spawnInterval = 1.2;
  game.spawnedThisWave = 0;
  game.enemiesPerWave = 8;
  game.waveState = 'spawning';
  game.intermissionTimer = 0;
  game.selectedTower = null;
  game.promotionChoiceOpen = false;
  game.modal = null;
  game.paused = false;
  game.holdDelete = null;
}

function startNextWave() {
  game.wave++;
  game.enemiesPerWave += game.wave >= 80 ? 0 : game.wave >= 40 ? 1 : 2;
  let interval = Math.max(0.5, game.spawnInterval - 0.08);
  if (game.wave >= 10) {
    // RNG narrowing — 웨이브마다 조밀도가 달라짐
    // 임계 웨이브(10) 직후엔 변동폭을 좁게 시작해 21 웨이브에 걸쳐 wave 30까지 점진 확장
    const ramp = Math.min(1, (game.wave - 9) / 21);
    const minNarrow = 1.0 - ramp * 0.6; // wave 10: ~0.97, wave 30+: 0.40
    const narrow = minNarrow + Math.random() * (1.0 - minNarrow);
    interval *= narrow;
  }
  game.spawnInterval = interval;
  game.spawnedThisWave = 0;
  game.spawnTimer = 0;
  game.waveState = 'spawning';
  saveGame();
}

// ============ Save / Load ============
const SAVE_KEY = 'td_save_v1';

function saveGame() {
  const data = {
    version: 1,
    wave: game.wave,
    hp: game.hp,
    gold: game.gold,
    spawnInterval: game.spawnInterval,
    enemiesPerWave: game.enemiesPerWave,
    towers: game.towers.map(t => ({
      x: t.x, y: t.y, role: t.role, tier: t.tier, xp: t.xp,
      totalDamage: t.totalDamage || 0,
    })),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('save failed', e);
  }
}

function loadSaveData() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== 1) return null;
    return data;
  } catch (e) {
    return null;
  }
}

function loadGame(data) {
  game.wave = data.wave;
  game.hp = data.hp;
  game.gold = data.gold;
  game.spawnInterval = data.spawnInterval;
  game.enemiesPerWave = data.enemiesPerWave;
  game.enemies = [];
  game.projectiles = [];
  game.beams = [];
  game.splashes = [];
  game.spawnTimer = 0;
  game.spawnedThisWave = 0;
  game.waveState = 'spawning';
  game.intermissionTimer = 0;
  game.selectedTower = null;
  game.promotionChoiceOpen = false;
  game.modal = null;
  game.paused = false;
  game.holdDelete = null;
  game.towers = (data.towers || [])
    .filter(td => TOWER_ROLES[td.role])
    .map(td => {
      const cfg = TOWER_ROLES[td.role];
      return {
        x: td.x, y: td.y, role: td.role, tier: td.tier,
        range: cfg.range, fireRate: cfg.fireRate, damage: cfg.damage,
        cooldown: 0, angle: 0, xp: td.xp || 0,
        totalDamage: td.totalDamage || 0,
      };
    });
}

function getAirChance(wave) {
  if (wave < 5) return 0;
  return Math.min(0.5, (wave - 4) * 0.02);
}

function getAirHpRatio(wave) {
  if (wave < 30) return 0.6;
  return Math.min(1.0, 0.6 + (wave - 30) * 0.02);
}

const AIR_INTRO_KEY = 'td_seen_air_intro';
function hasSeenAirIntro() {
  try { return localStorage.getItem(AIR_INTRO_KEY) === '1'; } catch (e) { return false; }
}
function setAirIntroSeen() {
  try { localStorage.setItem(AIR_INTRO_KEY, '1'); } catch (e) {}
}

const BUFF_INTRO_KEY = 'td_seen_buff_intro';
function hasSeenBuffIntro() {
  try { return localStorage.getItem(BUFF_INTRO_KEY) === '1'; } catch (e) { return false; }
}
function setBuffIntroSeen() {
  try { localStorage.setItem(BUFF_INTRO_KEY, '1'); } catch (e) {}
}

const airIntroModal = {
  panel: { x: 20, y: 180, w: 320, h: 280 },
  confirmBtn: { x: 110, y: 406, w: 140, h: 40 },
};

const buffIntroModal = {
  panel: { x: 20, y: 180, w: 320, h: 280 },
  confirmBtn: { x: 110, y: 406, w: 140, h: 40 },
};

const pauseButton = { x: 8, y: 592, w: 44, h: 44 };

function drawPauseButton() {
  ctx.fillStyle = 'rgba(26, 37, 53, 0.85)';
  roundRect(pauseButton.x, pauseButton.y, pauseButton.w, pauseButton.h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#fff';
  if (game.paused) {
    // ▶ Play (resume)
    ctx.beginPath();
    ctx.moveTo(pauseButton.x + 15, pauseButton.y + 11);
    ctx.lineTo(pauseButton.x + 15, pauseButton.y + 33);
    ctx.lineTo(pauseButton.x + 33, pauseButton.y + 22);
    ctx.closePath();
    ctx.fill();
  } else {
    // || Pause
    ctx.fillRect(pauseButton.x + 13, pauseButton.y + 11, 5, 22);
    ctx.fillRect(pauseButton.x + 26, pauseButton.y + 11, 5, 22);
  }
}

function drawPausedOverlay() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 60, LOGICAL_W, 32);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('⏸  일시정지', LOGICAL_W / 2, 76);
  ctx.textBaseline = 'alphabetic';
}

function drawAirIntroModal() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  const p = airIntroModal.panel;
  ctx.fillStyle = '#1a2535';
  roundRect(p.x, p.y, p.w, p.h, 12);
  ctx.fill();
  ctx.strokeStyle = '#a569bd';
  ctx.lineWidth = 2;
  ctx.stroke();

  const iconCx = LOGICAL_W / 2;
  const iconCy = p.y + 50;
  const r = 14;
  ctx.fillStyle = '#a569bd';
  ctx.beginPath();
  ctx.moveTo(iconCx, iconCy - r);
  ctx.lineTo(iconCx - r * 0.9, iconCy + r * 0.6);
  ctx.lineTo(iconCx + r * 0.9, iconCy + r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('공중 적 등장!', iconCx, p.y + 102);

  ctx.fillStyle = '#cdd';
  ctx.font = '14px sans-serif';
  ctx.fillText('보라색 삼각형은 공중 적입니다.', iconCx, p.y + 142);
  ctx.fillText('지상 전담 타워는 공격할 수 없으니', iconCx, p.y + 168);
  ctx.fillText('스카웃을 활용해 대비하세요.', iconCx, p.y + 194);

  drawButton(airIntroModal.confirmBtn, '확인');
}

function drawBuffIntroModal() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  const p = buffIntroModal.panel;
  ctx.fillStyle = '#1a2535';
  roundRect(p.x, p.y, p.w, p.h, 12);
  ctx.fill();
  ctx.strokeStyle = '#d4ac0d';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 샘플 배이스 시각 (팔각형 + 점선 링)
  const iconCx = LOGICAL_W / 2;
  const iconCy = p.y + 56;
  const ir = 14;

  const auraPulse = 0.5 + 0.5 * Math.sin(performance.now() / 700);
  ctx.globalAlpha = 0.4 + 0.3 * auraPulse;
  ctx.strokeStyle = '#d4ac0d';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.arc(iconCx, iconCy, ir + 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  ctx.fillStyle = '#d4ac0d';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.PI / 8;
    const px = iconCx + ir * Math.cos(a);
    const py = iconCy + ir * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#9a7d0a';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('티어별 버프율', iconCx, p.y + 112);

  ctx.fillStyle = '#cdd';
  ctx.font = '14px sans-serif';
  ctx.fillText('버프를 받는 타워의 티어에 따라', iconCx, p.y + 152);
  ctx.fillText('효과가 달라집니다.', iconCx, p.y + 178);

  ctx.fillStyle = '#d4ac0d';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('T0 +10%   T1 +10%   T2 +20%   T3 +30%', iconCx, p.y + 218);

  drawButton(buffIntroModal.confirmBtn, '확인');
}

function spawnEnemy() {
  const isAir = Math.random() < getAirChance(game.wave);
  let hpExtra = 0;
  for (let i = 1; i <= 4; i++) {
    hpExtra += Math.max(0, game.wave - i * 50) * 0.1;
  }
  const baseHp = 2 + Math.floor((game.wave - 1) * 0.6 + hpExtra);
  const hp = isAir ? Math.round(baseHp * getAirHpRatio(game.wave) * 10) / 10 : baseHp;
  const speed = 50 + (Math.min(100, game.wave) - 1) * 2;
  game.enemies.push({
    x: path[0].x,
    y: path[0].y,
    type: isAir ? 'air' : 'ground',
    speed,
    segment: 0,
    radius: 10,
    hpMax: hp,
    hp: hp,
    bobPhase: Math.random() * Math.PI * 2,
  });
  if (isAir && !game.modal && !hasSeenAirIntro()) {
    game.modal = { type: 'airIntro' };
  }
}

function updateEnemy(e, dt) {
  if (e.segment >= path.length - 1) {
    game.hp -= 1;
    e.dead = true;
    return;
  }
  const target = path[e.segment + 1];
  const dx = target.x - e.x;
  const dy = target.y - e.y;
  const dist = Math.hypot(dx, dy);
  const move = e.speed * getEnemySpeedFactor(e) * dt;
  if (move >= dist) {
    e.x = target.x;
    e.y = target.y;
    e.segment++;
  } else {
    e.x += (dx / dist) * move;
    e.y += (dy / dist) * move;
  }
}

function drawEnemyHpBar(e, cy) {
  const barW = 20;
  const barH = 3;
  const ratio = e.hp / e.hpMax;
  ctx.fillStyle = '#000';
  ctx.fillRect(e.x - barW / 2, cy - e.radius - 8, barW, barH);
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(e.x - barW / 2, cy - e.radius - 8, barW * ratio, barH);
}

function drawEnemy(e) {
  if (e.type === 'air') {
    const bobY = Math.sin(performance.now() / 250 + (e.bobPhase || 0)) * 2;
    const cy = e.y + bobY - 3;
    const r = e.radius;

    ctx.fillStyle = '#a569bd';
    ctx.beginPath();
    ctx.moveTo(e.x, cy - r);
    ctx.lineTo(e.x - r * 0.9, cy + r * 0.6);
    ctx.lineTo(e.x + r * 0.9, cy + r * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    drawEnemyHpBar(e, cy);
  } else {
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    drawEnemyHpBar(e, e.y);
  }
}

// ============ Tower / Projectile ============
function canPlaceTower(x, y) {
  if (game.gold < TOWER.cost) return false;
  if (y < HUD_RESERVED_TOP + TOWER.radius) return false;
  if (x < TOWER.radius || x > LOGICAL_W - TOWER.radius) return false;
  if (y > LOGICAL_H - TOWER.radius) return false;
  if (distanceToPath(x, y) < PATH_WIDTH / 2 + TOWER.radius + 2) return false;
  for (const t of game.towers) {
    if (Math.hypot(x - t.x, y - t.y) < TOWER.radius * 2 + 4) return false;
  }
  return true;
}

function placeTower(x, y) {
  if (!canPlaceTower(x, y)) return false;
  const cfg = TOWER_ROLES.base;
  game.towers.push({
    x, y,
    role: 'base',
    tier: 0,
    range: cfg.range,
    fireRate: cfg.fireRate,
    damage: cfg.damage,
    cooldown: 0,
    angle: 0,
    xp: 0,
    totalDamage: 0,
  });
  game.gold -= TOWER.cost;
  return true;
}

function canPromote(t) {
  return t.tier < TOWER.maxTier && TOWER_ROLES[t.role].promotions.length > 0;
}

function isPromotionReady(t) {
  return canPromote(t) && t.xp >= xpMaxFor(t);
}

function canAffordPromotion(t) {
  return game.gold >= promotionCostFor(t);
}

function getEffectiveRange(t, useChainedSources) {
  if (useChainedSources === undefined) useChainedSources = true;
  const buffRate = TOWER.buffRates[t.tier];
  if (buffRate === undefined) return t.range;
  for (const other of game.towers) {
    if (other === t) continue;
    const otherCfg = TOWER_ROLES[other.role];
    if (!otherCfg.buffsRange) continue;
    const d = Math.hypot(t.x - other.x, t.y - other.y);
    // 소스의 effective range를 1단계까지 따라감 (무한 재귀 방지)
    const otherRange = useChainedSources ? getEffectiveRange(other, false) : otherCfg.range;
    if (d <= otherRange) {
      return t.range * (1 + buffRate);
    }
  }
  return t.range;
}

function getEffectiveDamage(t, useChainedSources) {
  if (useChainedSources === undefined) useChainedSources = true;
  const buffRate = TOWER.buffRates[t.tier];
  if (buffRate === undefined) return t.damage;
  for (const other of game.towers) {
    if (other === t) continue;
    const otherCfg = TOWER_ROLES[other.role];
    if (!otherCfg.buffsDamage) continue;
    const d = Math.hypot(t.x - other.x, t.y - other.y);
    const otherRange = useChainedSources ? getEffectiveRange(other, false) : otherCfg.range;
    if (d <= otherRange) {
      return t.damage * (1 + buffRate);
    }
  }
  return t.damage;
}

const WAVE_END_XP_MULTIPLIER = 5;

function getXpGainAtWaveEnd(t) {
  for (const other of game.towers) {
    if (other === t) continue;
    const otherCfg = TOWER_ROLES[other.role];
    if (!otherCfg.boostsXp) continue;
    const d = Math.hypot(t.x - other.x, t.y - other.y);
    if (d <= getEffectiveRange(other)) {
      return WAVE_END_XP_MULTIPLIER;
    }
  }
  return 1;
}

function getEnemySpeedFactor(e) {
  let factor = 1;
  for (const t of game.towers) {
    const cfg = TOWER_ROLES[t.role];
    if (!cfg.slowsEnemies) continue;
    const range = getEffectiveRange(t);
    const d = Math.hypot(e.x - t.x, e.y - t.y);
    if (d <= range) {
      const slow = cfg.slowFactor !== undefined ? cfg.slowFactor : 0.5;
      if (slow < factor) factor = slow;
    }
  }
  return factor;
}

function promoteTower(t, role) {
  if (!isPromotionReady(t)) return false;
  if (!canAffordPromotion(t)) return false;
  if (!TOWER_ROLES[t.role].promotions.includes(role)) return false;
  const cfg = TOWER_ROLES[role];
  if (!cfg) return false;

  game.gold -= promotionCostFor(t);
  t.role = role;
  t.tier += 1;
  t.range = cfg.range;
  t.fireRate = cfg.fireRate;
  t.damage = cfg.damage;
  t.cooldown = 0;
  t.xp = 0;

  if (cfg.buffsRange && !game.modal && !hasSeenBuffIntro()) {
    game.modal = { type: 'buffIntro' };
  }
  return true;
}

const TARGET_PRIORITY = ['air', 'ground'];

function updateTower(t, dt) {
  t.cooldown = Math.max(0, t.cooldown - dt);

  const cfg = TOWER_ROLES[t.role];
  const attackTypes = cfg.attackTypes || ['ground'];
  const range = getEffectiveRange(t);

  let target = null;
  if (cfg.targetMode === 'highestHp') {
    let bestHp = -Infinity;
    for (const e of game.enemies) {
      if (e.dead) continue;
      if (!attackTypes.includes(e.type)) continue;
      const d = Math.hypot(e.x - t.x, e.y - t.y);
      if (d > range) continue;
      if (e.hp > bestHp) {
        bestHp = e.hp;
        target = e;
      }
    }
  } else {
    for (const wantType of TARGET_PRIORITY) {
      if (!attackTypes.includes(wantType)) continue;
      let bestDist = range + 1;
      let best = null;
      for (const e of game.enemies) {
        if (e.dead) continue;
        if (e.type !== wantType) continue;
        const d = Math.hypot(e.x - t.x, e.y - t.y);
        if (d < bestDist) {
          bestDist = d;
          best = e;
        }
      }
      if (best) {
        target = best;
        break;
      }
    }
  }

  if (target) {
    t.angle = Math.atan2(target.y - t.y, target.x - t.x);
    if (t.cooldown <= 0) {
      const damage = getEffectiveDamage(t);
      if (cfg.areaSweep) {
        // 트랩: 사거리 내 모든 유효 적에 즉시 데미지
        // 데미지 판정 반경에만 buffer 추가 (사거리 표시 / 시각효과는 그대로)
        const hitRange = range + 10;
        for (const e of game.enemies) {
          if (e.dead) continue;
          if (!attackTypes.includes(e.type)) continue;
          const d = Math.hypot(e.x - t.x, e.y - t.y);
          if (d <= hitRange) {
            applyTowerHit(t, e, damage);
          }
        }
        game.splashes.push({
          x: t.x, y: t.y,
          radius: range,
          life: 0.5, maxLife: 0.5,
          color: cfg.color,
        });
      } else if (cfg.instantHit) {
        if (cfg.pierces) {
          fireLineBeam(t, target, damage);
        } else {
          fireInstantBeam(t, target, damage);
        }
      } else if (cfg.fanShot) {
        // 인터셉터: 부채꼴 5발 직선 비유도
        const count = cfg.projectileCount || 5;
        const spreadRad = (cfg.spreadDeg || 32) * Math.PI / 180;
        const half = spreadRad / 2;
        const step = count > 1 ? spreadRad / (count - 1) : 0;
        for (let i = 0; i < count; i++) {
          const angle = t.angle - half + step * i;
          game.projectiles.push({
            x: t.x,
            y: t.y,
            vx: Math.cos(angle) * TOWER.projectileSpeed,
            vy: Math.sin(angle) * TOWER.projectileSpeed,
            damage,
            shooter: t,
            splash: cfg.splash || 0,
            splashColor: cfg.color,
            attackTypes: cfg.attackTypes || ['ground'],
            straightMode: true,
          });
        }
      } else {
        game.projectiles.push({
          x: t.x,
          y: t.y,
          target: target,
          damage,
          speed: TOWER.projectileSpeed,
          shooter: t,
          splash: cfg.splash || 0,
          splashColor: cfg.color,
          attackTypes: cfg.attackTypes || ['ground'],
        });
      }
      t.cooldown = 1 / t.fireRate;
    }
  }
}

function fireInstantBeam(t, target, damage) {
  const cfg = TOWER_ROLES[t.role];
  game.beams.push({
    x1: t.x, y1: t.y,
    x2: target.x, y2: target.y,
    life: 0.15,
    maxLife: 0.15,
    color: cfg.color,
  });
  applyTowerHit(t, target, damage !== undefined ? damage : t.damage);
}

function fireLineBeam(t, target, damage) {
  const cfg = TOWER_ROLES[t.role];
  const range = getEffectiveRange(t);
  const angle = Math.atan2(target.y - t.y, target.x - t.x);
  const endX = t.x + Math.cos(angle) * range;
  const endY = t.y + Math.sin(angle) * range;

  game.beams.push({
    x1: t.x, y1: t.y,
    x2: endX, y2: endY,
    life: 0.2,
    maxLife: 0.2,
    color: cfg.color,
  });

  const attackTypes = cfg.attackTypes || ['ground'];
  const dmg = damage !== undefined ? damage : t.damage;
  for (const e of game.enemies) {
    if (e.dead) continue;
    if (!attackTypes.includes(e.type)) continue;
    const d = pointToSegmentDist(e.x, e.y, t.x, t.y, endX, endY);
    if (d <= e.radius) {
      applyTowerHit(t, e, dmg);
    }
  }
}

function updateBeam(b, dt) {
  b.life -= dt;
  if (b.life <= 0) b.dead = true;
}

function drawBeam(b) {
  const alpha = Math.max(0, b.life / b.maxLife);
  // 외곽 광채
  ctx.globalAlpha = alpha * 0.5;
  ctx.strokeStyle = b.color;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(b.x1, b.y1);
  ctx.lineTo(b.x2, b.y2);
  ctx.stroke();
  // 내부 코어 (흰색)
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(b.x1, b.y1);
  ctx.lineTo(b.x2, b.y2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function applyTowerHit(shooter, target, damage) {
  if (!target || target.dead) return;
  const dealt = Math.min(damage, target.hp);
  target.hp -= damage;
  if (shooter) {
    shooter.totalDamage = Math.round(((shooter.totalDamage || 0) + dealt) * 10) / 10;
    if (canPromote(shooter)) {
      const next = Math.round((shooter.xp + dealt) * 10) / 10;
      shooter.xp = Math.min(next, xpMaxFor(shooter));
    }
  }
  if (target.hp <= 0) {
    target.dead = true;
    game.gold += ENEMY_KILL_REWARD;
  }
}

function applySplashHit(shooter, impactX, impactY, damage, radius, attackTypes) {
  for (const e of game.enemies) {
    if (e.dead) continue;
    if (attackTypes && !attackTypes.includes(e.type)) continue;
    const d = Math.hypot(e.x - impactX, e.y - impactY);
    if (d <= radius) {
      applyTowerHit(shooter, e, damage);
    }
  }
}

function updateProjectile(p, dt) {
  if (p.straightMode) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < -20 || p.x > LOGICAL_W + 20 || p.y < -20 || p.y > LOGICAL_H + 20) {
      p.dead = true;
      return;
    }
    for (const e of game.enemies) {
      if (e.dead) continue;
      if (p.attackTypes && !p.attackTypes.includes(e.type)) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d <= e.radius) {
        if (p.splash > 0) {
          applySplashHit(p.shooter, p.x, p.y, p.damage, p.splash, p.attackTypes);
          game.splashes.push({
            x: p.x, y: p.y,
            radius: p.splash,
            life: 0.3, maxLife: 0.3,
            color: p.splashColor || '#fff',
          });
        } else {
          applyTowerHit(p.shooter, e, p.damage);
        }
        p.dead = true;
        return;
      }
    }
    return;
  }

  if (!p.target || p.target.dead) {
    p.dead = true;
    return;
  }
  const dx = p.target.x - p.x;
  const dy = p.target.y - p.y;
  const dist = Math.hypot(dx, dy);
  const move = p.speed * dt;
  if (move >= dist) {
    if (p.splash > 0) {
      const ix = p.target.x;
      const iy = p.target.y;
      applySplashHit(p.shooter, ix, iy, p.damage, p.splash, p.attackTypes);
      game.splashes.push({
        x: ix, y: iy,
        radius: p.splash,
        life: 0.3, maxLife: 0.3,
        color: p.splashColor || '#fff',
      });
    } else {
      applyTowerHit(p.shooter, p.target, p.damage);
    }
    p.dead = true;
  } else {
    p.x += (dx / dist) * move;
    p.y += (dy / dist) * move;
  }
}

function updateSplash(s, dt) {
  s.life -= dt;
  if (s.life <= 0) s.dead = true;
}

function drawSplash(s) {
  const t = 1 - s.life / s.maxLife;
  const r = s.radius * (0.3 + 0.7 * t);
  const alpha = 1 - t;
  ctx.globalAlpha = alpha * 0.35;
  ctx.fillStyle = s.color;
  ctx.beginPath();
  ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = alpha * 0.85;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawCannonBody(t, cfg, selected) {
  ctx.fillStyle = cfg.color;
  ctx.beginPath();
  ctx.arc(t.x, t.y, TOWER.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = selected ? '#fff' : cfg.color2;
  ctx.lineWidth = selected ? 3 : 2;
  ctx.stroke();

  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate(t.angle);
  ctx.fillStyle = cfg.color2;
  ctx.fillRect(0, -3, TOWER.radius + 4, 6);
  ctx.restore();
}

function drawBeamEmitterBody(t, cfg, selected) {
  const r = TOWER.radius;

  // 육각형 본체 (pointy-top)
  ctx.fillStyle = cfg.color;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 - Math.PI / 2;
    const px = t.x + r * Math.cos(a);
    const py = t.y + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = selected ? '#fff' : cfg.color2;
  ctx.lineWidth = selected ? 3 : 2;
  ctx.stroke();

  // 중앙 에너지 코어 (살짝 펄스)
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 350);
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.4 + 0.25 * pulse;
  ctx.beginPath();
  ctx.arc(t.x, t.y, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawAreaSweepBody(t, cfg, selected) {
  const r = TOWER.radius;

  // 다이아몬드 본체 (정사각형 45° 회전)
  ctx.fillStyle = cfg.color;
  ctx.beginPath();
  ctx.moveTo(t.x, t.y - r);
  ctx.lineTo(t.x + r, t.y);
  ctx.lineTo(t.x, t.y + r);
  ctx.lineTo(t.x - r, t.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = selected ? '#fff' : cfg.color2;
  ctx.lineWidth = selected ? 3 : 2;
  ctx.stroke();

  // 중앙 작은 코어 (위협 신호)
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(t.x, t.y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawSupportBody(t, cfg, selected) {
  const r = TOWER.radius;

  // 팔각형 본체
  ctx.fillStyle = cfg.color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.PI / 8;
    const px = t.x + r * Math.cos(a);
    const py = t.y + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = selected ? '#fff' : cfg.color2;
  ctx.lineWidth = selected ? 3 : 2;
  ctx.stroke();

  // 회전 배럴 — 공격 가능한 경우에만
  if ((cfg.attackTypes || []).length > 0) {
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.angle);
    ctx.fillStyle = cfg.color2;
    ctx.fillRect(0, -3, r + 4, 6);
    ctx.restore();
  }

  // 외곽 점선 펄스링 — 사거리 버프 오라
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 700);
  ctx.globalAlpha = 0.35 + 0.3 * pulse;
  ctx.strokeStyle = cfg.color;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.arc(t.x, t.y, r + 7, 0, Math.PI * 2);
  ctx.stroke();

  // 두 번째 링 — 공격력 버프 오라 (비콘 전용, 반대 위상)
  if (cfg.buffsDamage) {
    const pulse2 = 0.5 + 0.5 * Math.sin(performance.now() / 700 + Math.PI);
    ctx.globalAlpha = 0.35 + 0.3 * pulse2;
    ctx.beginPath();
    ctx.arc(t.x, t.y, r + 12, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

function drawTower(t) {
  const cfg = TOWER_ROLES[t.role];
  const selected = (t === game.selectedTower);

  if (isPromotionReady(t)) {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
    ctx.globalAlpha = 0.35 + 0.45 * pulse;
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(t.x, t.y, TOWER.radius + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (cfg.instantHit) {
    drawBeamEmitterBody(t, cfg, selected);
  } else if (cfg.buffsRange) {
    drawSupportBody(t, cfg, selected);
  } else if (cfg.areaSweep) {
    drawAreaSweepBody(t, cfg, selected);
  } else {
    drawCannonBody(t, cfg, selected);
  }

  if (canPromote(t)) {
    const xpMax = xpMaxFor(t);
    const ratio = xpMax > 0 ? t.xp / xpMax : 0;
    const bw = 24, bh = 3;
    const bx = t.x - bw / 2;
    const by = t.y + TOWER.radius + 5;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = ratio >= 1 ? '#f1c40f' : '#5dade2';
    ctx.fillRect(bx, by, bw * ratio, bh);
  }
}

function drawTowerRange(t, fillAlpha, strokeAlpha) {
  const range = getEffectiveRange(t);
  ctx.globalAlpha = fillAlpha;
  ctx.fillStyle = '#3498db';
  ctx.beginPath();
  ctx.arc(t.x, t.y, range, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = strokeAlpha;
  ctx.strokeStyle = '#5dade2';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

const towerInfoPanel = { x: 16, y: 496, w: 328, h: 144 };
const infoCloseButton = { x: 308, y: 504, w: 28, h: 28 };
const infoPromotionButton = { x: 30, y: 600, w: 300, h: 32 };
const promotionPanel = { x: 16, y: 376, w: 328, h: 248 };
const promotionCloseButton = { x: 308, y: 384, w: 28, h: 28 };
const promotionCardSlots = [
  { x: 24, y: 432, w: 312, h: 84 },
  { x: 24, y: 526, w: 312, h: 84 },
];

function drawCloseX(btn) {
  ctx.fillStyle = '#c0392b';
  roundRect(btn.x, btn.y, btn.w, btn.h, 6);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('×', btn.x + btn.w / 2, btn.y + btn.h / 2);
  ctx.textBaseline = 'alphabetic';
}

function drawPromotionButton(t) {
  const ready = isPromotionReady(t);
  const afford = canAffordPromotion(t);
  const active = ready && afford;
  const cost = promotionCostFor(t);
  const xpMax = xpMaxFor(t);

  ctx.globalAlpha = active ? 1 : 0.55;
  if (active) {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 250);
    ctx.fillStyle = `rgba(241, 196, 15, ${0.85 + 0.15 * pulse})`;
  } else {
    ctx.fillStyle = '#3a3f48';
  }
  roundRect(infoPromotionButton.x, infoPromotionButton.y, infoPromotionButton.w, infoPromotionButton.h, 8);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = active ? '#fff' : '#555';
  ctx.lineWidth = active ? 2 : 1;
  ctx.stroke();

  ctx.fillStyle = active ? '#1a1300' : '#888';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let label;
  if (!ready) label = `전직 (XP ${t.xp} / ${xpMax})`;
  else if (!afford) label = `전직 (${cost}G · 골드 부족)`;
  else label = `전직 (${cost}G)`;
  ctx.fillText(label, infoPromotionButton.x + infoPromotionButton.w / 2, infoPromotionButton.y + infoPromotionButton.h / 2);
  ctx.textBaseline = 'alphabetic';
}

function drawTowerInfoPanel(t) {
  const cfg = TOWER_ROLES[t.role];
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#1a2535';
  roundRect(towerInfoPanel.x, towerInfoPanel.y, towerInfoPanel.w, towerInfoPanel.h, 10);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = cfg.color;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  const nameWidth = ctx.measureText(cfg.name).width;
  ctx.fillText(cfg.name, towerInfoPanel.x + 14, towerInfoPanel.y + 22);

  ctx.fillStyle = cfg.color;
  ctx.font = '11px sans-serif';
  ctx.fillText(`Tier ${t.tier}`, towerInfoPanel.x + 14 + nameWidth + 8, towerInfoPanel.y + 22);

  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#cdd';
  const sx = towerInfoPanel.x + 14;
  const sy = towerInfoPanel.y + 50;
  const total = Math.round((t.totalDamage || 0) * 10) / 10;
  const atkLabels = { ground: '지상', air: '공중' };
  const hasAttack = (cfg.attackTypes || []).length > 0;
  const atkText = hasAttack ? cfg.attackTypes.map(a => atkLabels[a] || a).join('/') : '없음';

  if (hasAttack) {
    const effDmg = getEffectiveDamage(t);
    const dmgBuffPct = effDmg > t.damage ? Math.round((effDmg / t.damage - 1) * 100) : 0;
    const dpsValue = Math.round(effDmg * t.fireRate * 10) / 10;
    const dmgValue = Math.round(effDmg * 10) / 10;
    const dmgStr = dmgBuffPct > 0
      ? `데미지: ${dmgValue} (+${dmgBuffPct}%, ${dpsValue}/초)`
      : `데미지: ${t.damage} (${dpsValue}/초)`;
    ctx.fillText(dmgStr, sx, sy);
    ctx.fillText(`발사속도: ${t.fireRate.toFixed(1)}/초`, sx, sy + 18);
  } else {
    ctx.fillText('데미지: —', sx, sy);
    ctx.fillText('발사속도: —', sx, sy + 18);
  }

  const effRange = getEffectiveRange(t);
  const buffPct = effRange > t.range ? Math.round((effRange / t.range - 1) * 100) : 0;
  const rangeStr = buffPct > 0
    ? `사거리: ${Math.round(effRange)} (+${buffPct}%)`
    : `사거리: ${t.range}`;
  ctx.fillText(rangeStr, sx + 160, sy);
  ctx.fillText(`공격 대상: ${atkText}`, sx + 160, sy + 18);
  ctx.fillText(`누적 데미지: ${total}`, sx, sy + 36);

  if (canPromote(t)) {
    const xpMax = xpMaxFor(t);
    const bx = sx;
    const by = sy + 44;
    const bw = 240;
    const bh = 8;
    const ratio = xpMax > 0 ? t.xp / xpMax : 0;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = t.xp >= xpMax ? '#f1c40f' : '#5dade2';
    ctx.fillRect(bx, by, bw * ratio, bh);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.fillText(`XP ${t.xp} / ${xpMax}`, bx + bw + 8, by + bh - 1);

    drawPromotionButton(t);
  }

  drawCloseX(infoCloseButton);
}

function drawPromotionCard(slot, role, cost) {
  const cfg = TOWER_ROLES[role];
  const canAfford = game.gold >= cost;

  ctx.globalAlpha = 0.95;
  ctx.fillStyle = canAfford ? '#222d40' : '#1a1f28';
  roundRect(slot.x, slot.y, slot.w, slot.h, 10);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = canAfford ? cfg.color : '#444';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = cfg.color;
  ctx.beginPath();
  ctx.arc(slot.x + 36, slot.y + slot.h / 2, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = cfg.color2;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(cfg.name, slot.x + 68, slot.y + 32);

  ctx.fillStyle = '#bcd';
  ctx.font = '12px sans-serif';
  ctx.fillText(`사거리 ${cfg.range}  ·  데미지 ${cfg.damage}  ·  속도 ${cfg.fireRate.toFixed(1)}/s`, slot.x + 68, slot.y + 56);

  ctx.fillStyle = '#8aa';
  ctx.font = '11px sans-serif';
  ctx.fillText(cfg.tagline || '', slot.x + 68, slot.y + 74);

  ctx.textAlign = 'right';
  ctx.fillStyle = canAfford ? '#f1c40f' : '#666';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`${cost}G`, slot.x + slot.w - 14, slot.y + 32);
}

function drawPromotionPanel(t) {
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = '#0f1620';
  roundRect(promotionPanel.x, promotionPanel.y, promotionPanel.w, promotionPanel.h, 12);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('전직 가능!', promotionPanel.x + promotionPanel.w / 2, promotionPanel.y + 28);

  ctx.fillStyle = '#bcd';
  ctx.font = '12px sans-serif';
  ctx.fillText('역할을 선택하세요', promotionPanel.x + promotionPanel.w / 2, promotionPanel.y + 48);

  const promotions = TOWER_ROLES[t.role].promotions;
  const cost = promotionCostFor(t);
  for (let i = 0; i < promotions.length && i < promotionCardSlots.length; i++) {
    drawPromotionCard(promotionCardSlots[i], promotions[i], cost);
  }

  drawCloseX(promotionCloseButton);
}

function drawProjectile(p) {
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function updateHUD() {
  hpEl.textContent = `HP: ${game.hp}`;
  goldEl.textContent = `Gold: ${game.gold}`;
  waveEl.textContent = `Wave: ${game.wave}`;
}

scenes.playing = {
  enter() {
    // 호출자(타이틀 시작 / 이어서 하기 / 게임오버 다시 시작)가 resetGame() 또는 loadGame()을 미리 호출
  },
  update(dt) {
    if (game.modal) return;
    if (game.paused) return;
    if (game.holdDelete) {
      game.holdDelete.accumulated += dt;
      if (game.holdDelete.accumulated >= HOLD_DELETE_SECONDS) {
        const dead = game.holdDelete.tower;
        game.towers = game.towers.filter(x => x !== dead);
        if (game.selectedTower === dead) {
          game.selectedTower = null;
          game.promotionChoiceOpen = false;
        }
        game.holdDelete = null;
      }
    }
    if (game.waveState === 'spawning') {
      game.spawnTimer += dt;
      if (game.spawnTimer >= game.spawnInterval && game.spawnedThisWave < game.enemiesPerWave) {
        game.spawnTimer = 0;
        game.spawnedThisWave++;
        spawnEnemy();
      }
    } else if (game.waveState === 'intermission') {
      game.intermissionTimer -= dt;
      if (game.intermissionTimer <= 0) {
        startNextWave();
      }
    }

    for (const e of game.enemies) updateEnemy(e, dt);
    for (const t of game.towers) updateTower(t, dt);
    for (const p of game.projectiles) updateProjectile(p, dt);
    for (const b of game.beams) updateBeam(b, dt);
    for (const s of game.splashes) updateSplash(s, dt);

    game.enemies = game.enemies.filter(e => !e.dead);
    game.projectiles = game.projectiles.filter(p => !p.dead);
    game.beams = game.beams.filter(b => !b.dead);
    game.splashes = game.splashes.filter(s => !s.dead);

    if (game.waveState === 'spawning' &&
        game.spawnedThisWave >= game.enemiesPerWave &&
        game.enemies.length === 0) {
      for (const t of game.towers) {
        if (canPromote(t)) {
          const gain = getXpGainAtWaveEnd(t);
          t.xp = Math.min(Math.round((t.xp + gain) * 10) / 10, xpMaxFor(t));
        }
      }
      game.waveState = 'intermission';
      game.intermissionTimer = 3;
    }

    updateHUD();

    if (game.hp <= 0) {
      game.hp = 0;
      game.selectedTower = null;
      game.promotionChoiceOpen = false;
      updateHUD();
      changeScene('gameOver');
    }
  },
  draw() {
    ctx.fillStyle = '#2d4a2b';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    drawPath();

    for (const t of game.towers) {
      if (t === game.selectedTower) continue;
      drawTowerRange(t, 0.05, 0.12);
    }
    if (game.selectedTower) {
      drawTowerRange(game.selectedTower, 0.18, 0.5);
    }

    for (const t of game.towers) drawTower(t);
    for (const e of game.enemies) drawEnemy(e);
    for (const pr of game.projectiles) drawProjectile(pr);
    for (const b of game.beams) drawBeam(b);
    for (const s of game.splashes) drawSplash(s);

    if (game.holdDelete) {
      const progress = Math.min(1, game.holdDelete.accumulated / HOLD_DELETE_SECONDS);
      const t = game.holdDelete.tower;
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(t.x, t.y, TOWER.radius + 7, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.stroke();
    }

    if (game.waveState === 'intermission') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, LOGICAL_H / 2 - 28, LOGICAL_W, 56);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`다음 웨이브까지 ${Math.ceil(game.intermissionTimer)}초`, LOGICAL_W / 2, LOGICAL_H / 2 + 6);
    }

    if (game.selectedTower) {
      if (game.promotionChoiceOpen) {
        drawPromotionPanel(game.selectedTower);
      } else {
        drawTowerInfoPanel(game.selectedTower);
      }
    } else {
      ctx.textAlign = 'center';
      ctx.font = '12px sans-serif';
      ctx.fillStyle = game.gold >= TOWER.cost ? 'rgba(255,255,255,0.7)' : 'rgba(255,150,150,0.7)';
      ctx.fillText(`빈 곳을 탭하여 타워 배치 (${TOWER.cost}G)`, LOGICAL_W / 2, LOGICAL_H - 28);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText('타워를 꾹 눌러 삭제', LOGICAL_W / 2, LOGICAL_H - 12);
    }

    if (!game.selectedTower && !game.modal) drawPauseButton();
    if (game.paused) drawPausedOverlay();

    if (game.modal) {
      if (game.modal.type === 'airIntro') drawAirIntroModal();
      else if (game.modal.type === 'buffIntro') drawBuffIntroModal();
    }
  },
  pointerDown(p) {
    if (game.modal) {
      if (game.modal.type === 'airIntro' && hitButton(airIntroModal.confirmBtn, p)) {
        setAirIntroSeen();
        game.modal = null;
      } else if (game.modal.type === 'buffIntro' && hitButton(buffIntroModal.confirmBtn, p)) {
        setBuffIntroSeen();
        game.modal = null;
      }
      return;
    }

    if (!game.selectedTower && hitButton(pauseButton, p)) {
      game.paused = !game.paused;
      return;
    }
    if (game.selectedTower && game.promotionChoiceOpen) {
      if (hitButton(promotionCloseButton, p)) {
        game.promotionChoiceOpen = false;
        return;
      }
      const promotions = TOWER_ROLES[game.selectedTower.role].promotions;
      for (let i = 0; i < promotions.length && i < promotionCardSlots.length; i++) {
        if (hitButton(promotionCardSlots[i], p)) {
          if (promoteTower(game.selectedTower, promotions[i])) {
            game.promotionChoiceOpen = false;
          }
          return;
        }
      }
      if (hitButton(promotionPanel, p)) {
        return;
      }
      game.promotionChoiceOpen = false;
      return;
    }

    if (game.selectedTower) {
      if (hitButton(infoCloseButton, p)) {
        game.selectedTower = null;
        return;
      }
      if (canPromote(game.selectedTower) && hitButton(infoPromotionButton, p)) {
        if (isPromotionReady(game.selectedTower) && canAffordPromotion(game.selectedTower)) {
          game.promotionChoiceOpen = true;
        }
        return;
      }
    }

    // 타워 hit는 정보 패널 안 빈 영역보다 먼저 검사 — 패널에 가려진 타워도 선택 / 꾹 누름 삭제 가능
    for (const t of game.towers) {
      if (Math.hypot(p.x - t.x, p.y - t.y) <= TOWER.radius + 4) {
        game.selectedTower = t;
        game.promotionChoiceOpen = false;
        game.holdDelete = { tower: t, accumulated: 0 };
        return;
      }
    }

    if (game.selectedTower && hitButton(towerInfoPanel, p)) {
      return;
    }

    if (game.selectedTower) {
      game.selectedTower = null;
      game.promotionChoiceOpen = false;
      return;
    }
    placeTower(p.x, p.y);
  },
};

// ============ Game Over scene ============
const gameOverButtons = {
  restart: { x: 80, y: 360, w: 200, h: 56 },
  toTitle: { x: 80, y: 432, w: 200, h: 56 },
};

scenes.gameOver = {
  enter() {},
  update() {},
  draw() {
    scenes.playing.draw();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText('GAME OVER', LOGICAL_W / 2, 200);

    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Wave ${game.wave}에서 패배`, LOGICAL_W / 2, 252);

    drawButton(gameOverButtons.restart, '다시 시작');
    drawButton(gameOverButtons.toTitle, '타이틀로');
  },
  pointerDown(p) {
    if (hitButton(gameOverButtons.restart, p)) {
      resetGame();
      changeScene('playing');
    } else if (hitButton(gameOverButtons.toTitle, p)) {
      changeScene('title');
    }
  },
};

// ============ Input ============
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const p = getLogicalPoint(e.clientX, e.clientY);
  scenes[currentSceneName]?.pointerDown?.(p);
});

canvas.addEventListener('pointerup', () => {
  if (game.holdDelete) game.holdDelete = null;
});

canvas.addEventListener('pointermove', (e) => {
  if (game.holdDelete) {
    const p = getLogicalPoint(e.clientX, e.clientY);
    const dt = game.holdDelete.tower;
    if (Math.hypot(p.x - dt.x, p.y - dt.y) > TOWER.radius + 8) {
      game.holdDelete = null;
    }
  }
});

canvas.addEventListener('pointercancel', () => {
  if (game.holdDelete) game.holdDelete = null;
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

// ============ Game loop ============
let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  scenes[currentSceneName]?.update(dt);
  scenes[currentSceneName]?.draw();
  requestAnimationFrame(loop);
}

changeScene('title');
requestAnimationFrame(loop);
