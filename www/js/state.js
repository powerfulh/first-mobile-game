import {
  SAVE_KEY, BEST_WAVE_KEY,
  AIR_INTRO_KEY, BUFF_INTRO_KEY, BOSS_INTRO_KEY, SHIELD_INTRO_KEY,
  TIER4_INTRO_KEY, REGEN_INTRO_KEY, BARRIER_INTRO_KEY,
  TOWER_ROLES,
} from './config.js';
import { isBossWave, spawnBoss } from './enemy.js';

export const game = {
  hp: 20,
  gold: 100,
  wave: 1,
  enemies: [],
  towers: [],
  projectiles: [],
  beams: [],
  splashes: [],
  zaps: [],
  barrierSpawnFx: [],
  spawnTimer: 0,
  spawnInterval: 1.2,
  spawnedThisWave: 0,
  enemiesPerWave: 8,
  waveState: 'spawning',
  intermissionTimer: 0,
  bossActive: false,
  selectedTower: null,
  promotionChoiceOpen: false,
  promotionTarget: null,
  modal: null,
  paused: false,
  holdDelete: null,
  settingsOpen: false,
  sandbox: false,
  sandboxShieldsEnabled: true,
  toast: null,
  bestWaveReached: 0,
};

function loadBestWave() {
  try {
    const v = parseInt(localStorage.getItem(BEST_WAVE_KEY), 10);
    return isNaN(v) ? 0 : v;
  } catch (e) {
    return 0;
  }
}

function persistBestWave(wave) {
  try {
    if (wave > loadBestWave()) localStorage.setItem(BEST_WAVE_KEY, String(wave));
  } catch (e) {}
}

export function resetGame() {
  game.hp = 20;
  game.gold = 100;
  game.wave = 1;
  game.enemies = [];
  game.towers = [];
  game.projectiles = [];
  game.beams = [];
  game.splashes = [];
  game.zaps = [];
  game.barrierSpawnFx = [];
  game.spawnTimer = 0;
  game.spawnInterval = 1.2;
  game.spawnedThisWave = 0;
  game.enemiesPerWave = 8;
  game.waveState = 'spawning';
  game.intermissionTimer = 0;
  game.bossActive = false;
  game.selectedTower = null;
  game.promotionChoiceOpen = false;
  game.promotionTarget = null;
  game.modal = null;
  game.paused = false;
  game.holdDelete = null;
  game.settingsOpen = false;
  game.sandbox = false;
  game.sandboxShieldsEnabled = true;
  game.toast = null;
  game.bestWaveReached = loadBestWave();
}

export function saveGame() {
  if (game.sandbox) return; // 샌드박스는 저장 안 함 (일반 게임 데이터 보호)
  persistBestWave(game.wave);
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

export function loadSaveData() {
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

export function loadGame(data) {
  game.wave = data.wave;
  game.hp = data.hp;
  game.gold = data.gold;
  game.spawnInterval = data.spawnInterval;
  game.enemiesPerWave = data.enemiesPerWave;
  game.enemies = [];
  game.projectiles = [];
  game.beams = [];
  game.splashes = [];
  game.zaps = [];
  game.barrierSpawnFx = [];
  game.spawnTimer = 0;
  game.spawnedThisWave = 0;
  game.waveState = 'spawning';
  game.intermissionTimer = 0;
  game.bossActive = false;
  game.selectedTower = null;
  game.promotionChoiceOpen = false;
  game.promotionTarget = null;
  game.modal = null;
  game.paused = false;
  game.holdDelete = null;
  game.bestWaveReached = Math.max(loadBestWave(), game.wave);
  game.towers = (data.towers || [])
    .filter(td => TOWER_ROLES[td.role])
    .map(td => {
      const cfg = TOWER_ROLES[td.role];
      return {
        x: td.x, y: td.y, role: td.role, tier: td.tier,
        range: cfg.range, fireRate: cfg.fireRate, damage: cfg.damage,
        cooldown: 0, angle: 0, xp: td.xp || 0,
        totalDamage: td.totalDamage || 0,
        waveDamage: 0,
      };
    });

  if (isBossWave(game.wave)) {
    game.bossActive = true;
    spawnBoss();
  }
}

// ============ Intro 플래그 ============
// 로컬 저장 정보 전체 초기화 (타이틀 설정에서 호출)
export function resetLocalData() {
  const keys = [
    SAVE_KEY, BEST_WAVE_KEY,
    AIR_INTRO_KEY, BUFF_INTRO_KEY, BOSS_INTRO_KEY, SHIELD_INTRO_KEY,
    TIER4_INTRO_KEY, REGEN_INTRO_KEY, BARRIER_INTRO_KEY,
  ];
  for (const key of keys) {
    try { localStorage.removeItem(key); } catch (e) {}
  }
}

export function hasSeenIntro(key) {
  try { return localStorage.getItem(key) === '1'; } catch (e) { return false; }
}
export function setIntroSeen(key) {
  try { localStorage.setItem(key, '1'); } catch (e) {}
}
