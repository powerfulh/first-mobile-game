import {
	SAVE_KEY, BEST_WAVE_KEY,
	INTRO_KEYS, SHORTCUT_INTRO_KEY,
	ONE_TOUCH_KEY, INTERMISSION_KEY,
	TOWER_ROLES, INITIAL, UNLOCKED_MAPS_KEY,
} from './core/config.js';
import { getActiveMap, setActiveMap, MAPS } from './core/maps.js';
import { spawnBoss } from './enemy.js';
import { isBossWave, createSpawner, restoreBaseSpawner } from './wave.js';
import { setTowerTier, recomputeStats } from './tower.js';

export const game = {
	...INITIAL, // hp (전역)
	gold: 0, // 시작 돈은 맵별 — resetGame/loadGame이 채움 (그 전엔 placeholder)
	wave: 1,
	mapId: 'map1', // 활성 맵 id (core/maps.js MAPS 키)
	// 게임 월드 엔티티 — 타워/적/발사체를 한 객체로 묶음.
	entities: {
		towers: [],
		enemies: [],
		projectiles: [],
	},
	// 일시적 시각 효과 — 매 프레임 갱신·필터·그리기되는 단명 객체 (entities와 대칭으로 묶음).
	effects: {
		beams: [],
		links: [], // 리솔버 버프 연결선 (굵고 오래 남는 에너지 링크)
		splashes: [],
		zaps: [],
		barrierSpawnFx: [],
		shieldBreakFx: [],
		parachuteFx: [], // 수송 적이 일반 적을 투하할 때의 낙하산 연출 { x, y, life, maxLife }
		empDevices: [], // EMP 적 처치 지점의 스턴 장치 { x, y, target, life } — 대상 타워 스턴 유지
	},
	// 동시 진행 웨이브 스포너 목록 (평소 1개, 추가 웨이브 호출 시 2개).
	// 초기엔 빈 배열 — 게임 시작 시 resetGame/loadGame/setupWave가 채움 (그 전엔 활성 스포너 없음).
	// 각 스포너가 자기 wave/spawnTimer/spawnedThisWave/spawnInterval/enemiesPerWave/isBoss 보유 — 자기 적 소멸 시 개별 제거(완료 추적).
	waves: [],
	waveFrontier: 1, // 이번 배치에서 호출된 최고 웨이브 번호 (다음 추가/진행 기준)
	waveState: 'spawning',
	intermissionTimer: 0,
	bossActive: false,
	selectedTower: null, // 선택된 타워 — 열린 패널은 인스턴스의 panel 필드('settings'|'promotion', 없으면 정보 카드)
	selectedEnemy: null,
	fusionMaterials: [], // 합체 재료로 지정된 타워들. 티어4는 최대 1개(트리거 전까지).
	modal: null,
	paused: false,
	holdDelete: null,
	settingsOpen: false, // 가장 권력있는 모달, `modal` 에 인트로 중이여도 이전 버튼으로 여전히 띄울 수 있음
	sandbox: false,
	sandboxShieldsEnabled: true,
	toast: null,
	bestWaveReached: 0,
	waveSpawnCounts: {}, // 현재 웨이브 적 타입별 출현 누적 (HUD 요약용)
	airShortcutNext: false, // 다음 공중 적의 '처음 만나는 숏컷 탑승 여부' (교대; shortcut 마커 맵 전용)
	gameOverKiller: null, // 마지막 골인으로 게임 오버를 유발한 적 — 게임 오버 화면에서 하이라이트용
	ghostTower: null, // 2단계 배치 미리보기 { x, y, role, tier, dragging, range }
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

// 공중 지름길(path에 shortcut 마커 보유) 맵 최초 진입 시 안내 모달 (한 번만). resetGame/loadGame 끝에서 호출.
function maybeShowShortcutIntro() {
	if (!game.modal && getActiveMap().path?.some(p => p.shortcut) && !hasSeenIntro(SHORTCUT_INTRO_KEY)) {
		game.modal = { type: 'shortcutIntro' };
	}
}

// 일시적 시각 효과(game.effects) 전부 비움 — resetGame/loadGame/jumpToWave 공용.
export function clearEffects() {
	game.effects.beams = [];
	game.effects.links = [];
	game.effects.splashes = [];
	game.effects.zaps = [];
	game.effects.barrierSpawnFx = [];
	game.effects.shieldBreakFx = [];
	game.effects.parachuteFx = [];
	game.effects.empDevices = [];
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
	clearEffects();
	game.waves = [createSpawner(1)];
	game.waveFrontier = game.wave;
	game.waveState = 'spawning';
	game.intermissionTimer = 0;
	game.bossActive = false;
	game.selectedTower = null;
	game.selectedEnemy = null;
	game.fusionMaterials = [];
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
	game.gameOverKiller = null;
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
			reservation: t.reservation || null, // 전직 예약 { role, order }
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
		// [260801 이후 삭제] v1 → v2 마이그레이션: 역할 키 변경 (기본 base→novice, 배이스 buff→base).
		// 키당 1회 매핑이라 연쇄 없음. 삭제 시 아래 version === 1 블록 전체와 함께,
		// version 체크를 `!== 2`에서 단일 버전 검사로 되돌릴 것.
		if (data.version === 1) {
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
	clearEffects();
	game.waveState = 'spawning';
	game.intermissionTimer = 0;
	game.bossActive = false;
	game.selectedTower = null;
	game.selectedEnemy = null;
	game.fusionMaterials = [];
	game.modal = null;
	game.paused = false;
	game.holdDelete = null;
	game.sandbox = false; // 샌드박스 갔다가 이어하기 시 플래그 잔류 방지
	game.sandboxShieldsEnabled = true;
	game.waveSpawnCounts = {};
	game.airShortcutNext = false;
	game.ghostTower = null;
	game.gameOverKiller = null;
	game.bestWaveReached = Math.max(loadBestWave(), game.wave);
	game.entities.towers = (data.towers || [])
		.filter(td => TOWER_ROLES[td.role])
		.map(td => {
			const tw = {
				x: td.x, y: td.y,
				cooldown: 0, angle: 0, xp: td.xp || 0,
				totalDamage: td.totalDamage || 0,
				waveDamage: 0,
				reservation: null,
			};
			setTowerTier(tw, td.role, td.tier); // role/tier + cfg·파생값 + 우선순위 기본값
			if (td.canGround !== undefined) tw.canGround = td.canGround;
			if (td.canAir !== undefined) tw.canAir = td.canAir;
			if (td.gaPriority) tw.gaPriority = td.gaPriority;
			if (td.targetPriority) tw.targetPriority = td.targetPriority;
			if (td.reservation && TOWER_ROLES[td.reservation.role]) tw.reservation = td.reservation;
			return tw;
		});

	recomputeStats(); // 로드된 타워 버프 적용 사거리·데미지 캐시
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
		...INTRO_KEYS,
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

// 해금 조건 평가 — 웨이브 진입/세이브 로드 시 호출. 'clearWave': 특정 맵 N웨이브 돌파 시 해금. (샌드박스 포함 — 웨이브 점프로도 해금 가능)
export function checkMapUnlocks() {
	for (const id in MAPS) {
		const u = MAPS[id].unlock;
		if (u && u.type === 'clearWave' && game.mapId === u.map && game.wave >= u.wave) {
			// 신규 해금마다 안내 모달 — 어떤 맵인지 mapId로 전달 (다른 모달이 떠 있으면 생략)
			if (unlockMap(id) && !game.modal) {
				game.modal = { type: 'mapUnlock', mapId: id };
			}
		}
	}
}
