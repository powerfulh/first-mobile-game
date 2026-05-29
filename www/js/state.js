import {
  SAVE_KEY, AIR_INTRO_KEY, BUFF_INTRO_KEY, BOSS_INTRO_KEY, SHIELD_INTRO_KEY,
  TIER4_INTRO_KEY, REGEN_INTRO_KEY, TOWER_ROLES,
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
};

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
}

export function saveGame() {
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

  if (isBossWave(game.wave)) {
    game.bossActive = true;
    spawnBoss();
  }
}

// ============ Intro 플래그 ============
export function hasSeenAirIntro() {
  try { return localStorage.getItem(AIR_INTRO_KEY) === '1'; } catch (e) { return false; }
}
export function setAirIntroSeen() {
  try { localStorage.setItem(AIR_INTRO_KEY, '1'); } catch (e) {}
}

export function hasSeenBuffIntro() {
  try { return localStorage.getItem(BUFF_INTRO_KEY) === '1'; } catch (e) { return false; }
}
export function setBuffIntroSeen() {
  try { localStorage.setItem(BUFF_INTRO_KEY, '1'); } catch (e) {}
}

export function hasSeenBossIntro() {
  try { return localStorage.getItem(BOSS_INTRO_KEY) === '1'; } catch (e) { return false; }
}
export function setBossIntroSeen() {
  try { localStorage.setItem(BOSS_INTRO_KEY, '1'); } catch (e) {}
}

export function hasSeenShieldIntro() {
  try { return localStorage.getItem(SHIELD_INTRO_KEY) === '1'; } catch (e) { return false; }
}
export function setShieldIntroSeen() {
  try { localStorage.setItem(SHIELD_INTRO_KEY, '1'); } catch (e) {}
}

export function hasSeenTier4Intro() {
  try { return localStorage.getItem(TIER4_INTRO_KEY) === '1'; } catch (e) { return false; }
}
export function setTier4IntroSeen() {
  try { localStorage.setItem(TIER4_INTRO_KEY, '1'); } catch (e) {}
}

export function hasSeenRegenIntro() {
  try { return localStorage.getItem(REGEN_INTRO_KEY) === '1'; } catch (e) { return false; }
}
export function setRegenIntroSeen() {
  try { localStorage.setItem(REGEN_INTRO_KEY, '1'); } catch (e) {}
}
