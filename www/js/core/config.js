import { t } from './i18n.js';

export const LOGICAL_W = 360;
export const LOGICAL_H = 640;

// 새 게임 시작 시 플레이어 초기 HP (전역). 시작 돈은 맵별 — core/maps.js의 startGold.
export const INITIAL = { hp: 20 };

export const TOWER = {
	cost: 50,
	radius: 14,
	projectileSpeed: 280,
	promotionCosts: [125, 250, 1000, 3000], // [t0→t1, t1→t2, t2→t3, t3→t4]
	xpThresholds:   [20,  40,  200,  500],
	buffRates:      [0.10, 0.10, 0.20, 0.30, 0.40], // 받는 타워 티어 (t0~t4)
	maxTier: 4,
};

// 타워 테마색 팔레트 (색1/색2 쌍) — 색상환 72° 균등 분포 5종. 기본 외형(캐논) 5종이 a~e를 하나씩 맡아
// 색만으로 구분되고, 다른 외형 타워는 이 5색을 공유. 4티어는 재료/지정 팔레트를 재활용.
//   a 파랑 #3f80d4/#2b5991 · b 빨강 #e04b47/#a1332f · c 마젠타 #b04fc9/#7c3590 · d 옐로우 #b6c02c/#83891e · e 초록 #29ac66/#1c7a48
export const TOWER_ROLES = {
	novice: {
		name: 'tower.novice.name', tagline: 'tower.novice.tagline',
		color: '#3f80d4', color2: '#2b5991', // a
		range: 90, fireRate: 1.2, damage: 1.2,
		attackTypes: ['ground'], splash: 0,
		promotions: ['bunker', 'scout'],
	},
	bunker: {
		name: 'tower.bunker.name', tagline: 'tower.bunker.tagline',
		color: '#e04b47', color2: '#a1332f', // b
		range: 100, fireRate: 1, damage: 3.6,
		attackTypes: ['ground'], splash: 0,
		projectileSpeed: 300, // 1티어
		promotions: ['tank', 'base'],
	},
	scout: {
		name: 'tower.scout.name', tagline: 'tower.scout.tagline',
		color: '#29ac66', color2: '#1c7a48', // e
		range: 140, fireRate: 1.2, damage: 1.6,
		attackTypes: ['ground', 'air'], splash: 0,
		projectileSpeed: 300, // 1티어
		promotions: ['eagle', 'filder'],
	},
	tank: {
		name: 'tower.tank.name', tagline: 'tower.tank.tagline',
		color: '#b04fc9', color2: '#7c3590', // c
		range: 90, fireRate: 0.8, damage: 5,
		attackTypes: ['ground'], splash: 50,
		projectileSpeed: 320, // 2티어
		promotions: ['whale', 'trap'],
	},
	whale: {
		name: 'tower.whale.name', tagline: 'tower.whale.tagline',
		color: '#b6c02c', color2: '#83891e', // d
		range: 120, fireRate: 0.6, damage: 10,
		attackTypes: ['ground'], splash: 80,
		projectileSpeed: 340, // 3티어
		promotions: [],
	},
	trap: {
		name: 'tower.trap.name', tagline: 'tower.trap.tagline',
		color: '#3f80d4', color2: '#2b5991', // a
		range: 90, fireRate: 0.2, damage: 20,
		attackTypes: ['ground', 'air'], splash: 0,
		promotions: [],
		areaSweep: true,
	},
	base: {
		name: 'tower.base.name', tagline: 'tower.base.tagline',
		color: '#3f80d4', color2: '#2b5991', // a
		range: 90, fireRate: 1, damage: 2,
		attackTypes: ['ground'], splash: 0,
		projectileSpeed: 320, // 2티어
		promotions: ['beacon', 'demon'],
		buffsRange: true,
		boostsXp: true,
	},
	beacon: {
		name: 'tower.beacon.name', tagline: 'tower.beacon.tagline',
		color: '#e04b47', color2: '#a1332f', // b
		range: 120, fireRate: 1, damage: 2,
		attackTypes: ['ground'], splash: 0,
		projectileSpeed: 340, // 3티어
		promotions: [],
		buffsRange: true,
		buffsDamage: true,
		boostsXp: true,
	},
	demon: {
		name: 'tower.demon.name', tagline: 'tower.demon.tagline',
		color: '#29ac66', color2: '#1c7a48', // e
		range: 90, fireRate: 0, damage: 0,
		attackTypes: [], splash: 0,
		promotions: [],
		buffsRange: true,
		boostsXp: true,
		slowsEnemies: true,
		slowFactor: 0.5,
		gainsXpOnEnemyEnter: true,
	},
	eagle: {
		name: 'tower.eagle.name', tagline: 'tower.eagle.tagline',
		color: '#3f80d4', color2: '#2b5991', // a
		range: 140, fireRate: 2.4, damage: 3.2,
		attackTypes: ['air'], splash: 0,
		projectileSpeed: 320, // 2티어
		promotions: ['skydoom', 'interceptor'],
	},
	skydoom: {
		name: 'tower.skydoom.name', tagline: 'tower.skydoom.tagline',
		color: '#b04fc9', color2: '#7c3590', // c
		range: 140, fireRate: 2.4, damage: 5,
		attackTypes: ['air'], splash: 50,
		projectileSpeed: 340, // 3티어
		promotions: [],
	},
	interceptor: {
		name: 'tower.interceptor.name', tagline: 'tower.interceptor.tagline',
		color: '#29ac66', color2: '#1c7a48', // e
		range: 140, fireRate: 4.8, damage: 2,
		attackTypes: ['air'], splash: 0,
		promotions: [],
		fanShot: true,
		projectileCount: 7,
		spreadDeg: 32,
	},
	filder: {
		name: 'tower.filder.name', tagline: 'tower.filder.tagline',
		color: '#3f80d4', color2: '#2b5991', // a
		range: 120, fireRate: 1.6, damage: 2.4,
		attackTypes: ['ground', 'air'], splash: 0,
		promotions: ['master', 'dealman'],
		instantHit: true,
	},
	master: {
		name: 'tower.master.name', tagline: 'tower.master.tagline',
		color: '#29ac66', color2: '#1c7a48', // e
		range: 140, fireRate: 4, damage: 4,
		attackTypes: ['ground', 'air'], splash: 0,
		promotions: [],
		instantHit: true,
	},
	dealman: {
		name: 'tower.dealman.name', tagline: 'tower.dealman.tagline',
		color: '#e04b47', color2: '#a1332f', // b
		range: 180, fireRate: 1, damage: 9.2,
		attackTypes: ['ground', 'air'], splash: 0,
		promotions: [],
		instantHit: true,
		pierces: true,
		targetMode: 'highestHp',
	},
	radar: {
		name: 'tower.radar.name', tagline: 'tower.radar.tagline',
		color: '#3f80d4', color2: '#a1332f', // 팔레트 재활용: a 색1 + b 색2
		range: 100, fireRate: 0.2, damage: 20,
		attackTypes: ['ground', 'air'], splash: 0,
		promotions: [],
		areaSweep: true,
		marksEnemies: true,
		recipe: ['beacon', 'trap'],
		description: ['tower.radar.desc1', 'tower.radar.desc2'],
	},
	assassin: {
		name: 'tower.assassin.name', tagline: 'tower.assassin.tagline',
		color: '#b04fc9', color2: '#7c3590', // 팔레트 재활용: c 색1 + c 색2
		range: 200, fireRate: 0.8, damage: 20,
		attackTypes: ['ground', 'air'], splash: 0,
		promotions: [],
		instantHit: true,
		pierces: true,
		targetMode: 'highestHp',
		disablesModifiers: true,
		recipe: ['dealman', 'demon'],
		description: ['tower.assassin.desc1', 'tower.assassin.desc2'],
	},
	silo: {
		name: 'tower.silo.name', tagline: 'tower.silo.tagline',
		color: '#34495e', color2: '#1a252f',
		range: 120, minRange: 60, fireRate: 0.4, damage: 40,
		attackTypes: ['ground'], splash: 160,
		promotions: [],
		ballistic: true,
		projectileSpeed: 196, // TOWER.projectileSpeed(280)의 70%
		recipe: ['whale', 'skydoom'],
		description: ['tower.silo.desc1', 'tower.silo.desc2', 'tower.silo.desc3'],
	},
	gatling: {
		name: 'tower.gatling.name', tagline: 'tower.gatling.tagline',
		color: '#29ac66', color2: '#1c7a48', // 팔레트 재활용: e 색1 + e 색2
		range: 150, fireRate: 20, damage: 2.2,
		attackTypes: ['air'], splash: 0,
		promotions: [],
		scatterDeg: 12, // ±6° 흩어짐
		projectileCount: 2, // 매 발사마다 2발
		recipe: ['master', 'interceptor'],
		description: ['tower.gatling.desc1', 'tower.gatling.desc2'],
	},
};

// 타워 표시 텍스트 다국어화 — name/tagline/description은 i18n 키, 정의 직후 1회 표시 문자열로 변환.
for (const role in TOWER_ROLES) {
	const r = TOWER_ROLES[role];
	r.name = t(r.name);
	if (r.tagline) r.tagline = t(r.tagline);
	if (r.description) r.description = r.description.map(line => t(line));
}

// ============ 합체(fusion) 레시피 ============
// 정의는 각 합체 결과 role의 recipe(재료 role 배열) 한 곳뿐 — arity 무관(2종·3종…).
// 재료 순서 무관 조회를 위해 정규화 키(정렬 join)로 집합→결과 맵과 재료→결과들 역인덱스를 파생.
const FUSION_RESULT_BY_KEY = {};        // 정렬된 재료 role 키 → 결과 role
const FUSION_RESULTS_BY_MATERIAL = {};  // 재료 role → [결과 role, ...] (그 재료가 쓰이는 모든 레시피)
const fusionKey = (roles) => [...roles].sort().join('|');
for (const result in TOWER_ROLES) {
	const recipe = TOWER_ROLES[result].recipe;
	if (!recipe) continue;
	FUSION_RESULT_BY_KEY[fusionKey(recipe)] = result;
	for (const mat of recipe) {
		if (!FUSION_RESULTS_BY_MATERIAL[mat]) FUSION_RESULTS_BY_MATERIAL[mat] = [];
		FUSION_RESULTS_BY_MATERIAL[mat].push(result);
	}
}

// 재료 role 집합(순서 무관)이 정확히 이루는 합체 결과 role — 없으면 null.
export function fusionResultFor(roles) {
	return FUSION_RESULT_BY_KEY[fusionKey(roles)] || null;
}

// 부분 재료 role들을 모두 포함하는 합체 결과 role 목록 — 재료를 더 지정할 수 있는지(확장 가능성) 판단·힌트용.
export function fusionCandidatesFor(partialRoles) {
	const out = [];
	for (const result in TOWER_ROLES) {
		const recipe = TOWER_ROLES[result].recipe;
		if (recipe && partialRoles.every(r => recipe.includes(r))) out.push(result);
	}
	return out;
}

// role이 어떤 합체 레시피의 재료로 쓰이는지.
export function isFusionMaterialRole(role) {
	return !!FUSION_RESULTS_BY_MATERIAL[role];
}

// role을 재료로 쓰는 레시피들 — 각 { result, others }(others = 그 레시피에서 role을 뺀 나머지 재료).
export function fusionRecipesWithMaterial(role) {
	return (FUSION_RESULTS_BY_MATERIAL[role] || []).map(res => ({
		result: res,
		others: TOWER_ROLES[res].recipe.filter(r => r !== role),
	}));
}

// 선택된 타워 위에 뜨는 패널 (selectedTower 있을 때만 의미). 기본 INFO.
export const TOWER_PANEL = { INFO: 'info', SETTINGS: 'settings', PROMOTION: 'promotion' };

// 공중 테마색 — 공중 적/보스, 공중 인트로 액센트, 공중 지름길 공용.
export const AIR_COLOR = '#a569bd';

// 기본 액센트 빨강 — 버튼/보스/활성 탭/인트로 액센트 공용.
export const ACCENT_RED = '#c0392b';

// UI 팔레트 — 자주 쓰는 강조색 상수화 (값 동일, 톤 조정 단일 지점). 타워 cfg.color2 등 게임 데이터와는 별개.
export const GOLD = '#f1c40f';       // XP 가득·골드 비용·활성 강조
export const INFO_BLUE = '#5dade2';  // 정보/선택/방어막 하이라이트
export const SLATE = '#2c3e50';      // 어두운 패널/비활성 배경

export const PATH_WIDTH = 28;
export const ENEMY_KILL_REWARD = 6;
export const ENEMY_SPEED_CAP_WAVE = 100; // 이 웨이브 이후 적 기본 이동 속도 고정
export const HUD_RESERVED_TOP = 16;
export const HOLD_DELETE_SECONDS = 1.0;
export const WAVE_END_XP_MULTIPLIER = 5;

export const REGEN_HEAL_RATE = 0.12; // hpMax 기준 초당 회복 비율
export const BARRIER_RADIUS = 60;

export const SAVE_KEY = 'td_save_v1';
export const BEST_WAVE_KEY = 'td_best_wave';
export const UNLOCKED_MAPS_KEY = 'td_unlocked_maps';
export const AIR_INTRO_KEY = 'td_seen_air_intro';
export const BUFF_INTRO_KEY = 'td_seen_buff_intro';
export const BOSS_INTRO_KEY = 'td_seen_boss_intro';
export const SHIELD_INTRO_KEY = 'td_seen_shield_intro';
export const TIER4_INTRO_KEY = 'td_seen_tier4_intro';
export const REGEN_INTRO_KEY = 'td_seen_regen_intro';
export const BARRIER_INTRO_KEY = 'td_seen_barrier_intro';
export const PARALLEL_INTRO_KEY = 'td_seen_parallel_intro'; // 추가 웨이브(병렬 호출) 안내 모달
export const MAP_UNLOCK_INTRO_KEY = 'td_seen_map_unlock'; // 맵 해금 안내 모달
export const SHORTCUT_INTRO_KEY = 'td_seen_shortcut_intro'; // 공중 지름길 안내 모달 (airShortcut 맵 최초 진입)

// 인트로 플래그 키 전체. resetLocalData가 이 배열을 spread 해 초기화 누락을 막는다.
// 새 인트로 추가 시 위 상수 정의와 이 배열에 함께 등록할 것.
export const INTRO_KEYS = [
	AIR_INTRO_KEY, BUFF_INTRO_KEY, BOSS_INTRO_KEY, SHIELD_INTRO_KEY,
	TIER4_INTRO_KEY, REGEN_INTRO_KEY, BARRIER_INTRO_KEY, PARALLEL_INTRO_KEY,
	MAP_UNLOCK_INTRO_KEY, SHORTCUT_INTRO_KEY,
];

// 볼륨(0~1) — 게임 진행과 무관한 사용자 선호라 resetLocalData 대상에서 제외.
// 배경음·효과음 마스터를 분리해 각각 저장.
export const BGM_VOLUME_KEY = 'td_volume';
export const SFX_VOLUME_KEY = 'td_sfx_volume';
export const ONE_TOUCH_KEY = 'td_one_touch'; // 원터치 배치 on/off (기본 on)
export const INTERMISSION_KEY = 'td_intermission'; // 웨이브 간 인터미션 on/off (기본 on)
