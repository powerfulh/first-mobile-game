import {
	SAVE_KEY, BEST_WAVE_KEY,
	AIR_INTRO_KEY, BUFF_INTRO_KEY, BOSS_INTRO_KEY, SHIELD_INTRO_KEY,
	TIER4_INTRO_KEY, REGEN_INTRO_KEY, BARRIER_INTRO_KEY, PARALLEL_INTRO_KEY,
	MAP_UNLOCK_INTRO_KEY, SHORTCUT_INTRO_KEY,
	ONE_TOUCH_KEY, INTERMISSION_KEY,
	TOWER_ROLES, INITIAL, TOWER_PANEL, UNLOCKED_MAPS_KEY,
} from './core/config.js';
import { getActiveMap, setActiveMap, MAPS } from './core/maps.js';
import { spawnBoss } from './enemy.js';
import { isBossWave, createSpawner, restoreBaseSpawner } from './wave.js';
import { applyTowerPriorityDefaults } from './tower.js';

export const game = {
	...INITIAL, // hp (전역)
	gold: 0, // 시작 돈은 맵별 — resetGame/loadGame이 채움 (그 전엔 placeholder)
	wave: 1,
	mapId: 'map1', // 활성 맵 id (core/maps.js MAPS 키)
	// 게임 월드 엔티티 — 타워/적/발사체를 한 객체로 묶음 (beams/splashes/zaps 등 일시적 시각 효과는 별도 평면 속성).
	entities: {
		towers: [],
		enemies: [],
		projectiles: [],
	},
	beams: [],
	splashes: [],
	zaps: [],
	barrierSpawnFx: [],
	// 동시 진행 웨이브 스포너 목록 (평소 1개, 추가 웨이브 호출 시 2개).
	// 초기엔 빈 배열 — 게임 시작 시 resetGame/loadGame/setupWave가 채움 (그 전엔 활성 스포너 없음).
	// 각 스포너가 자기 wave/spawnTimer/spawnedThisWave/spawnInterval/enemiesPerWave/isBoss 보유 — 자기 적 소멸 시 개별 제거(완료 추적).
	waves: [],
	waveFrontier: 1, // 이번 배치에서 호출된 최고 웨이브 번호 (다음 추가/진행 기준)
	waveState: 'spawning',
	intermissionTimer: 0,
	bossActive: false,
	selectedTower: null,
	selectedEnemy: null,
	towerPanel: TOWER_PANEL.INFO,
	promotionTarget: null,
	modal: null,
	paused: false,
	holdDelete: null,
	settingsOpen: false, // 가장 권력있는 모달, `modal` 에 인트로 중이여도 이전 버튼으로 여전히 띄울 수 있음
	sandbox: false,
	sandboxShieldsEnabled: true,
	toast: null,
	bestWaveReached: 0,
	waveSpawnCounts: {}, // 현재 웨이브 적 타입별 출현 누적 (HUD 요약용)
	airShortcutNext: false, // 다음 공중 적이 지름길 차례인지 (정규↔지름길 교대; airShortcut 맵 전용)
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

// airShortcut 특성 맵 최초 진입 시 지름길 안내 모달 (한 번만). resetGame/loadGame 끝에서 호출.
function maybeShowShortcutIntro() {
	if (!game.modal && getActiveMap().traits?.includes('airShortcut') && !hasSeenIntro(SHORTCUT_INTRO_KEY)) {
		game.modal = { type: 'shortcutIntro' };
	}
}

export function resetGame(mapId = 'map1') {
	setActiveMap(mapId);
	game.mapId = mapId;
	Object.assign(game, INITIAL); // hp (전역)
	game.gold = getActiveMap().startGold; // 시작 돈은 맵별
	game.wave = 1;
	game.entities.enemies = [];
	game.entities.towers = [];
	game.entities.projectiles = [];
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
	game.selectedEnemy = null;
	game.towerPanel = TOWER_PANEL.INFO;
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
	game.airShortcutNext = false;
	game.ghostTower = null;
	maybeShowShortcutIntro();
}

export function saveGame() {
	if (game.sandbox) return; // 샌드박스는 저장 안 함 (일반 게임 데이터 보호)
	persistBestWave(game.wave);
	// saveGame은 웨이브 경계(setupWave 직후)에서만 호출 → game.waves는 베이스 스포너 1개.
	// 간격엔 RNG가 섞여 있어 그 값을 그대로 저장해야 같은 페이스/방어막 확률로 복원됨.
	const base = game.waves[0] || createSpawner(game.wave);
	const data = {
		version: 2,
		mapId: game.mapId,
		wave: game.wave,
		hp: game.hp,
		gold: game.gold,
		spawnInterval: base.spawnInterval,
		enemiesPerWave: base.enemiesPerWave,
		towers: game.entities.towers.map(t => ({
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
		if (data.version === 1) {
			// v1 → v2: 역할 키 변경 (기본 base→novice, 배이스 buff→base). 키당 1회 매핑이라 연쇄 없음.
			const ROLE_MIGRATION_V1 = { base: 'novice', buff: 'base' };
			for (const td of data.towers || []) {
				if (ROLE_MIGRATION_V1[td.role]) td.role = ROLE_MIGRATION_V1[td.role];
			}
			data.version = 2;
		}
		if (data.version !== 2) return null;
		return data;
	} catch (e) {
		return null;
	}
}

export function loadGame(data) {
	const mapId = data.mapId || 'map1'; // 구 세이브 하위호환
	setActiveMap(mapId);
	game.mapId = mapId;
	game.wave = data.wave;
	game.hp = data.hp;
	game.gold = data.gold;
	game.waves = [restoreBaseSpawner(data.wave, data.spawnInterval, data.enemiesPerWave)];
	game.waveFrontier = game.wave;
	game.entities.enemies = [];
	game.entities.projectiles = [];
	game.beams = [];
	game.splashes = [];
	game.zaps = [];
	game.barrierSpawnFx = [];
	game.waveState = 'spawning';
	game.intermissionTimer = 0;
	game.bossActive = false;
	game.selectedTower = null;
	game.selectedEnemy = null;
	game.towerPanel = TOWER_PANEL.INFO;
	game.promotionTarget = null;
	game.modal = null;
	game.paused = false;
	game.holdDelete = null;
	game.waveSpawnCounts = {};
	game.airShortcutNext = false;
	game.ghostTower = null;
	game.bestWaveReached = Math.max(loadBestWave(), game.wave);
	game.entities.towers = (data.towers || [])
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
	checkMapUnlocks(); // 불러온 진행이 이미 해금 조건을 충족하면 반영
	maybeShowShortcutIntro();
}

// ============ Intro 플래그 ============
// 로컬 저장 정보 전체 초기화 (타이틀 설정에서 호출)
export function resetLocalData() {
	const keys = [
		SAVE_KEY, BEST_WAVE_KEY, UNLOCKED_MAPS_KEY,
		AIR_INTRO_KEY, BUFF_INTRO_KEY, BOSS_INTRO_KEY, SHIELD_INTRO_KEY,
		TIER4_INTRO_KEY, REGEN_INTRO_KEY, BARRIER_INTRO_KEY, PARALLEL_INTRO_KEY,
		MAP_UNLOCK_INTRO_KEY, SHORTCUT_INTRO_KEY,
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

// ============ 맵 해금 ============
// unlock.type === 'default' 인 맵은 항상 해금. 그 외(조건부)는 unlockMap으로 해금분만 저장.
// (정의 순서대로 반환 → 맵 선택 순서 안정)
export function getUnlockedMaps() {
	let extra = [];
	try { extra = JSON.parse(localStorage.getItem(UNLOCKED_MAPS_KEY)) || []; } catch (e) {}
	return Object.keys(MAPS).filter(id => MAPS[id].unlock?.type === 'default' || extra.includes(id));
}
export function unlockMap(id) {
	if (!MAPS[id] || MAPS[id].unlock?.type === 'default') return false; // 없는 맵·기본 해금은 저장 불필요
	let extra = [];
	try { extra = JSON.parse(localStorage.getItem(UNLOCKED_MAPS_KEY)) || []; } catch (e) {}
	if (extra.includes(id)) return false;
	try { localStorage.setItem(UNLOCKED_MAPS_KEY, JSON.stringify([...extra, id])); } catch (e) {}
	return true; // 신규 해금
}

// 해금 조건 평가 — 웨이브 진입/세이브 로드 시 호출. 'clearWave': 특정 맵 N웨이브 돌파 시 해금. (샌드박스 제외)
export function checkMapUnlocks() {
	if (game.sandbox) return;
	for (const id in MAPS) {
		const u = MAPS[id].unlock;
		if (u && u.type === 'clearWave' && game.mapId === u.map && game.wave >= u.wave) {
			// 최초 해금 시 안내 모달 (한 번만)
			if (unlockMap(id) && !game.modal && !hasSeenIntro(MAP_UNLOCK_INTRO_KEY)) {
				game.modal = { type: 'mapUnlock' };
			}
		}
	}
}
