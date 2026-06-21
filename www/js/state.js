import {
	SAVE_KEY, BEST_WAVE_KEY,
	AIR_INTRO_KEY, BUFF_INTRO_KEY, BOSS_INTRO_KEY, SHIELD_INTRO_KEY,
	TIER4_INTRO_KEY, REGEN_INTRO_KEY, BARRIER_INTRO_KEY,
	ONE_TOUCH_KEY, INTERMISSION_KEY,
	TOWER_ROLES,
} from './config.js';
import { spawnBoss } from './enemy.js';
import { isBossWave, createSpawner, restoreBaseSpawner } from './wave.js';
import { applyTowerPriorityDefaults } from './tower.js';

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
	// 동시 진행 웨이브 스포너 목록 (평소 1개, 추가 웨이브 호출 시 2개). reset/loadGame 에서 재구성.
	// 각 스포너가 자기 spawnTimer/spawnedThisWave/spawnInterval/enemiesPerWave 보유 — 자기 적 소멸 시 개별 제거(완료 추적).
	waves: [{ wave: 1, spawnInterval: 1.2, spawnTimer: 0, spawnedThisWave: 0, enemiesPerWave: 8, isBoss: false }],
	waveFrontier: 1, // 이번 배치에서 호출된 최고 웨이브 번호 (다음 추가/진행 기준)
	waveState: 'spawning',
	intermissionTimer: 0,
	bossActive: false,
	selectedTower: null,
	promotionChoiceOpen: false,
	towerSettingsOpen: false,
	promotionTarget: null,
	modal: null,
	paused: false,
	holdDelete: null,
	settingsOpen: false,
	sandbox: false,
	sandboxShieldsEnabled: true,
	toast: null,
	bestWaveReached: 0,
	waveSpawnCounts: {}, // 현재 웨이브 적 타입별 출현 누적 (HUD 요약용)
	ghostTower: null, // 2단계 배치 미리보기 { x, y, dragging }
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
	game.waves = [createSpawner(1)];
	game.waveFrontier = game.wave;
	game.waveState = 'spawning';
	game.intermissionTimer = 0;
	game.bossActive = false;
	game.selectedTower = null;
	game.promotionChoiceOpen = false;
	game.towerSettingsOpen = false;
	game.promotionTarget = null;
	game.modal = null;
	game.paused = false;
	game.holdDelete = null;
	game.settingsOpen = false;
	game.sandbox = false;
	game.sandboxShieldsEnabled = true;
	game.toast = null;
	game.bestWaveReached = loadBestWave();
	game.waveSpawnCounts = {};
	game.ghostTower = null;
}

export function saveGame() {
	if (game.sandbox) return; // 샌드박스는 저장 안 함 (일반 게임 데이터 보호)
	persistBestWave(game.wave);
	// saveGame은 웨이브 경계(setupWave 직후)에서만 호출 → game.waves는 베이스 스포너 1개.
	// 간격엔 RNG가 섞여 있어 그 값을 그대로 저장해야 같은 페이스/방어막 확률로 복원됨.
	const base = game.waves[0] || createSpawner(game.wave);
	const data = {
		version: 1,
		wave: game.wave,
		hp: game.hp,
		gold: game.gold,
		spawnInterval: base.spawnInterval,
		enemiesPerWave: base.enemiesPerWave,
		towers: game.towers.map(t => ({
			x: t.x, y: t.y, role: t.role, tier: t.tier, xp: t.xp,
			totalDamage: t.totalDamage || 0,
			canGround: t.canGround, canAir: t.canAir,
			gaPriority: t.gaPriority, targetPriority: t.targetPriority,
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
	game.waves = [restoreBaseSpawner(data.wave, data.spawnInterval, data.enemiesPerWave)];
	game.waveFrontier = game.wave;
	game.enemies = [];
	game.projectiles = [];
	game.beams = [];
	game.splashes = [];
	game.zaps = [];
	game.barrierSpawnFx = [];
	game.waveState = 'spawning';
	game.intermissionTimer = 0;
	game.bossActive = false;
	game.selectedTower = null;
	game.promotionChoiceOpen = false;
	game.towerSettingsOpen = false;
	game.promotionTarget = null;
	game.modal = null;
	game.paused = false;
	game.holdDelete = null;
	game.waveSpawnCounts = {};
	game.ghostTower = null;
	game.bestWaveReached = Math.max(loadBestWave(), game.wave);
	game.towers = (data.towers || [])
		.filter(td => TOWER_ROLES[td.role])
		.map(td => {
			const cfg = TOWER_ROLES[td.role];
			const tw = {
				x: td.x, y: td.y, role: td.role, tier: td.tier,
				range: cfg.range, fireRate: cfg.fireRate, damage: cfg.damage,
				cooldown: 0, angle: 0, xp: td.xp || 0,
				totalDamage: td.totalDamage || 0,
				waveDamage: 0,
			};
			applyTowerPriorityDefaults(tw); // 역할 기준 기본값 → 저장값으로 덮어쓰기
			if (td.canGround !== undefined) tw.canGround = td.canGround;
			if (td.canAir !== undefined) tw.canAir = td.canAir;
			if (td.gaPriority) tw.gaPriority = td.gaPriority;
			if (td.targetPriority) tw.targetPriority = td.targetPriority;
			return tw;
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

// 원터치 배치 설정 (미설정 기본 on). off일 때만 '0' 저장.
export function getOneTouchPlace() {
	try { return localStorage.getItem(ONE_TOUCH_KEY) !== '0'; } catch (e) { return true; }
}
export function setOneTouchPlace(on) {
	try { localStorage.setItem(ONE_TOUCH_KEY, on ? '1' : '0'); } catch (e) {}
}

// 웨이브 간 인터미션 설정 (미설정 기본 on). off일 때만 '0' 저장.
// off면 한 배치 종료 즉시 다음 웨이브 호출 (대기 없음).
export function getIntermissionEnabled() {
	try { return localStorage.getItem(INTERMISSION_KEY) !== '0'; } catch (e) { return true; }
}
export function setIntermissionEnabled(on) {
	try { localStorage.setItem(INTERMISSION_KEY, on ? '1' : '0'); } catch (e) {}
}
