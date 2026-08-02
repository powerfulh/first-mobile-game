import { t } from './i18n.js';

export const LOGICAL_W = 360;
export const LOGICAL_H = 640;

// 새 게임 시작 시 플레이어 초기 HP (전역). 시작 돈은 맵별 — core/maps.js의 startGold.
export const INITIAL = { hp: 20 };

export const TOWER = {
	cost: 50,
	radius: 14,
	projectileSpeed: 280,
	promotionCosts: [125, 250, 1000, 2500, 3500], // [t0→t1 … t4→t5]
	xpThresholds:   [20,  40,  200,  500,  1000],
	buffRates:      [0.10, 0.10, 0.20, 0.30, 0.40, 0.45], // 받는 타워 티어 (t0~t5)
	maxTier: 5,
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

	// ---- 5티어 (합체 3종) — placeholder: 기본(novice) 복제, 실제 디자인 예정 ----
	// 레시피는 4티어 4종 {radar, assassin, silo, gatling} 중 중복 없는 3종(=4가지 조합, 각각 1종 제외).
	yeomra: {
		name: 'tower.yeomra.name', tagline: 'tower.yeomra.tagline',
		color: '#b04fc9', color2: '#1c7a48',
		range: 90, fireRate: 0, damage: 0,
		attackTypes: [], splash: 0,
		promotions: [],
		recipe: ['radar', 'assassin', 'silo'], // 제외: gatling
		buffsRange: true, // 배이스와 동일한 사거리 버프 (외형도 base 계열 분기로 감)
		slowsEnemies: true, slowFactor: 0.25, // 사거리 내 적 이동속도 25%로
		blocksRegen: true, // 사거리 내 재생 적 회복 차단
		description: ['tower.yeomra.desc1', 'tower.yeomra.desc2', 'tower.yeomra.desc3'],
	},
	resolver: {
		name: 'tower.resolver.name', tagline: 'tower.resolver.tagline',
		color: '#b6c02c', color2: '#a1332f',
		range: 80, fireRate: 0.2, damage: 20,
		attackTypes: ['ground', 'air'], splash: 0,
		promotions: [],
		recipe: ['radar', 'assassin', 'gatling'], // 제외: silo
		body: 'energyCore', // 8각 셸 + 중앙 초고에너지 발전기
		buffsAllies: true, // 적이 아닌 아군 타워를 겨냥 — 스윕 + 10초 공격력·공속 2배 버프
		description: ['tower.resolver.desc1', 'tower.resolver.desc2'],
	},
	zeus: {
		name: 'tower.zeus.name', tagline: 'tower.zeus.tagline',
		color: '#3f80d4', color2: '#2b5991', // (색은 추후)
		range: 140, minRange: 100, fireRate: 0.2, damage: 60,
		attackTypes: ['ground'], splash: 200,
		promotions: [],
		recipe: ['radar', 'silo', 'gatling'], // 제외: assassin
		ballistic: true, // 사일로식 비유도 — 발사 시점 착탄점 고정
		arcMissile: true, // 투사체가 고도 아치(크기↑·고도 반비례 투명도)로 상승·하강
		projectileSpeed: 160,
		stuns: true, stunDuration: 1, // 피격 적 1초 스턴
		body: 'missileSilo', // 원형 미사일 격납고
		description: ['tower.zeus.desc2'],
	},
	dragon: {
		name: 'tower.dragon.name', tagline: 'tower.dragon.tagline',
		color: '#b6c02c', color2: '#83891e',
		range: 150, fireRate: 16, damage: 3.6,
		attackTypes: ['ground', 'air'], splash: 0,
		promotions: [],
		recipe: ['assassin', 'silo', 'gatling'], // 제외: radar
		instantHit: true, // 딜맨식 관통 일직선 빔
		pierces: true,
		scatterDeg: 12, // 개틀링식 공격 각도 난수 (fireLineBeam이 반영)
		body: 'condenser', // 육각 몸체 + 오목 응축 패널·집게 + 연속 응축 입자
		description: ['tower.dragon.desc1'],
	},

	// ---- 특수 타워 — 사용자가 배치하지 않고 맵 특성(맵 정의의 fixedTowers)으로만 배치 ----
	broken: {
		name: 'tower.broken.name', tagline: 'tower.broken.tagline',
		color: '#7f8c8d', color2: '#4d5656', // 고장 — 무채색
		range: 90, fireRate: 1, damage: 1,
		attackTypes: ['ground'], splash: 0,
		promotions: ['novice', 'usable'],
		promotionsKeepTier: ['novice'], // '기본'으로 수리 — 티어 변경 없음 (0 유지, 이후 기본 트리 정상 진행)
		undeletable: true, // 삭제 불가 — 홀드 삭제·설정 카드 삭제 버튼 모두 차단 (전직으로만 벗어남)
	},
	// 고장난 타워 전직 — 수리해서 '쓸만한 타워'로 (기존 흐름대로 티어 +1). 삭제 불가 속성 제거.
	usable: {
		name: 'tower.usable.name', tagline: 'tower.usable.tagline',
		color: '#7f8c8d', color2: '#4d5656', // 고장난 타워와 동일 무채색 — 구분은 외형(서포트 몸체)으로
		range: 108, fireRate: 1.2, damage: 1.2,
		attackTypes: ['ground', 'air'], splash: 0,
		projectileSpeed: 300, // 1티어
		promotions: ['recycle', 'overload'],
		promotionsKeepTier: ['recycle'], // 재활용은 티어 변경 없음 (1 유지) — 과부하는 기존 흐름대로 +1
		boostsXp: true, // 사거리 내 타워 웨이브 종료 경험치 5배
	},
	// 쓸만한 타워 전직 — 재활용: 평범한 단일 공격, 대신 삭제 시 투입 금액 100% 환불. XP 강화 능력은 잃음.
	recycle: {
		name: 'tower.recycle.name', tagline: 'tower.recycle.tagline',
		color: '#7f8c8d', color2: '#4d5656', // 특수 타워 계열 무채색 유지
		range: 108, fireRate: 1.2, damage: 2,
		attackTypes: ['ground', 'air'], splash: 0,
		projectileSpeed: 300, // 1티어 (티어 유지 전직)
		promotions: ['lab'],
		refundRate: 2.5, // 삭제 시 투입 금액(배치비 + 전직 비용 합) 250% 환불 (기본 10%)
	},
	// 재활용 전직 — 실험실: 공격 능력 상실, 삭제 환불 50%. 설정 패널에서 '대상 지정'한
	// 3티어 역할의 4티어 합체 때 지정 재료 타워 대신 소모됨 (consumable = 대체 가능 역할 8종).
	lab: {
		name: 'tower.lab.name', tagline: 'tower.lab.tagline',
		color: '#3f80d4', color2: '#2b5991', // a — 기본(novice)과 동일 테마색
		range: 90, fireRate: 0, damage: 0,
		attackTypes: [], splash: 0,
		promotions: [],
		noPromotion: true, // 전직 없음 — 합체 재료로 소모되는 것이 종착
		refundRate: 1, // 삭제 시 투입 금액 100% 환불
		consumable: ['beacon', 'trap', 'dealman', 'demon', 'whale', 'skydoom', 'master', 'interceptor'], // 4티어 레시피의 3티어 재료 8종
	},
	// 쓸만한 타워 전직 — 과부하: 트랩과 동일한 사거리 내 일제 타격. XP 강화 능력은 잃음.
	overload: {
		name: 'tower.overload.name', tagline: 'tower.overload.tagline',
		color: '#7f8c8d', color2: '#4d5656', // 특수 타워 계열 무채색 유지
		range: 90, fireRate: 0.2, damage: 12,
		attackTypes: ['ground', 'air'], splash: 0,
		promotions: ['towerBomb'],
		areaSweep: true,
	},
	// 과부하 전직 — 타워 폭탄: 공격 기능을 잃는 대신 전직 2초 후 자폭한다. 외형은 과부하와 동일.
	// 자폭 = 사거리 내 광역 스윕 10연타 + 사거리 내 '기본(novice)'을 '고장난 타워(broken)'로 강제 replace.
	towerBomb: {
		name: 'tower.towerBomb.name', tagline: 'tower.towerBomb.tagline',
		color: '#7f8c8d', color2: '#4d5656', // 과부하와 동일 무채색 (외형 공유)
		range: 90, fireRate: 0, damage: 16,
		attackTypes: [], splash: 0, // 공격 기능 상실 — 평상시 무공격, damage는 자폭 스윕에만 사용
		promotions: [],
		noPromotion: true,  // 종착 — 전직 없음 (canPromote 차단: XP바·예약 버튼 숨김)
		undeletable: true,  // 타워 삭제 불가 (도화선 도중 수동 삭제 차단)
		towerBomb: true,    // 2초 도화선 → 자폭 트리거 (tower.updateTower 특수 분기)
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

// 공중 테마색 — 공중 적/보스, 공중 인트로 액센트, 공중 지름길 공용.
export const AIR_COLOR = '#a569bd';

// 기본 액센트 빨강 — 버튼/보스/활성 탭/인트로 액센트 공용.
export const ACCENT_RED = '#c0392b';

// UI 팔레트 — 자주 쓰는 강조색 상수화 (값 동일, 톤 조정 단일 지점). 타워 cfg.color2 등 게임 데이터와는 별개.
export const GOLD = '#f1c40f';       // XP 가득·골드 비용·활성 강조
export const INFO_BLUE = '#5dade2';  // 정보/선택/방어막 하이라이트
export const SLATE = '#2c3e50';      // 어두운 패널/비활성 배경
export const MAP_BG_COLOR = '#2d4a2b'; // 맵 배경 잔디 — 플레이 배경/맵 썸네일/해금 아이콘 공용

export const PATH_WIDTH = 28;
export const ENEMY_KILL_REWARD = 6;
export const ENEMY_SPEED_CAP_WAVE = 100; // 이 웨이브 이후 적 기본 이동 속도 고정
export const ENEMY_SLOW_SPEED_FLOOR = 20; // 감속 디버프 적용 시 이동 속도 하한
export const HUD_RESERVED_TOP = 16;
export const HOLD_DELETE_SECONDS = 1.0;
export const WAVE_END_XP_MULTIPLIER = 5;

export const REGEN_HEAL_RATE = 0.12; // hpMax 기준 초당 회복 비율
export const BARRIER_RADIUS = 60;
export const EMP_STUN_RANGE = 80; // EMP 적 처치 지점 기준 장치 대상 탐색 반경
export const EMP_COLOR = '#1a5276'; // EMP 테마색 (짙은 파랑) — 적 결속 에너지·장치 글로우·스턴 타워 본체 공용
export const EMP_STUN_SECONDS = 2; // EMP 장치 유지 = 대상 타워 스턴 시간

export const RESOLVER_BUFF_SECONDS = 11; // 리솔버 버프(공격력·공속 2배) 지속 시간

// 타워 폭탄(과부하 전직) — 전직 즉시 도화선 시작, 도달 시 자폭: 사거리 내 광역 스윕 연타 + 사거리 내 '기본'을 '고장난 타워'로 강제 replace.
export const TOWER_BOMB_FUSE_SECONDS = 2;    // 자폭까지의 도화선 (파이 타이머로 표시)
export const TOWER_BOMB_SWEEP_COUNT = 10;    // 자폭 시 발생하는 광역 스윕 횟수
export const TOWER_BOMB_SWEEP_INTERVAL = 0.1; // 스윕 간 간격(초)

// 충격 분산 적 — 피격 시 분산 횟수 1 소모, 들어온 데미지를 고정값으로 치환.
export const SHOCK_HP_RATIO = 0.75; // 체력 배율 (일반 지상 적 대비)
export const SHOCK_CHARGES_MAX = 3; // 분산 횟수 최대치 (= 공전 플라즈마 실드 수)
export const SHOCK_REGEN_SECONDS = 0.5; // 횟수가 최대 미만일 때 1 회복에 걸리는 시간
export const SHOCK_FIXED_DAMAGE = 0.1; // 분산 발동 시 실제로 들어가는 고정 데미지
export const SHOCK_FX_SECONDS = 0.35; // 분산 발동 시 적 위에 겹치는 방패 이펙트 수명

// 치료 적 — 아군 공중 타입에 락온해 회복시키는 지원 유닛. 락온 중엔 제자리 정지.
export const HEALER_RANGE = 80; // 능력 발동 사거리 — 락온 이후에는 사거리 무관 유지
export const HEALER_HP_THRESHOLD = 0.9; // 체력이 이 비율 이하인 공중 타입만 치료 대상

export const SAVE_KEY = 'td_save_v1';
export const BEST_WAVE_KEY = 'td_best_wave';
export const UNLOCKED_MAPS_KEY = 'td_unlocked_maps';
export const AIR_INTRO_KEY = 'td_seen_air_intro';
export const BUFF_INTRO_KEY = 'td_seen_buff_intro';
export const BOSS_INTRO_KEY = 'td_seen_boss_intro';
export const SHIELD_INTRO_KEY = 'td_seen_shield_intro';
export const TIER4_INTRO_KEY = 'td_seen_tier4_intro';
export const TIER5_INTRO_KEY = 'td_seen_tier5_intro'; // 최초로 4티어 XP 만렙 시 안내 모달
export const REGEN_INTRO_KEY = 'td_seen_regen_intro';
export const BARRIER_INTRO_KEY = 'td_seen_barrier_intro';
export const EMP_INTRO_KEY = 'td_seen_emp_intro';
export const TRANSPORT_INTRO_KEY = 'td_seen_transport_intro';
export const SHOCK_INTRO_KEY = 'td_seen_shock_intro';
export const HEALER_INTRO_KEY = 'td_seen_healer_intro';
export const QUEUE_INTRO_KEY = 'td_seen_queue_intro'; // 전직 예약 안내 모달 (예약 버튼 최초 탭)
export const PARALLEL_INTRO_KEY = 'td_seen_parallel_intro'; // 추가 웨이브(병렬 호출) 안내 모달
export const SHORTCUT_INTRO_KEY = 'td_seen_shortcut_intro'; // 공중 지름길 안내 모달 (airShortcut 맵 최초 진입)
export const UNDERPASS_INTRO_KEY = 'td_seen_underpass_intro'; // 지하도 안내 모달 (underpass 맵 최초 진입)
export const STATS_INTRO_KEY = 'td_seen_stats_intro'; // 통계 레이어 안내 모달 (통계 버튼 최초 탭)
export const FIXED_TOWER_INTRO_KEY = 'td_seen_fixed_tower_intro'; // 맵 특성 고정 타워 안내 모달 (fixedTowers 맵 최초 진입)
export const LAB_SETTINGS_INTRO_KEY = 'td_seen_lab_settings_intro'; // 실험실 설정(대상 지정) 안내 모달 (실험실 설정 버튼 최초 탭)

// 인트로 플래그 키 전체. resetLocalData가 이 배열을 spread 해 초기화 누락을 막는다.
// 새 인트로 추가 시 위 상수 정의와 이 배열에 함께 등록할 것.
export const INTRO_KEYS = [
	AIR_INTRO_KEY, BUFF_INTRO_KEY, BOSS_INTRO_KEY, SHIELD_INTRO_KEY,
	TIER4_INTRO_KEY, TIER5_INTRO_KEY, REGEN_INTRO_KEY, BARRIER_INTRO_KEY, EMP_INTRO_KEY,
	TRANSPORT_INTRO_KEY, SHOCK_INTRO_KEY, HEALER_INTRO_KEY, QUEUE_INTRO_KEY, PARALLEL_INTRO_KEY, SHORTCUT_INTRO_KEY, UNDERPASS_INTRO_KEY,
	STATS_INTRO_KEY, FIXED_TOWER_INTRO_KEY, LAB_SETTINGS_INTRO_KEY,
];

// 볼륨(0~1) — 게임 진행과 무관한 사용자 선호라 resetLocalData 대상에서 제외.
// 배경음·효과음 마스터를 분리해 각각 저장.
export const BGM_VOLUME_KEY = 'td_volume';
export const SFX_VOLUME_KEY = 'td_sfx_volume';
export const ONE_TOUCH_KEY = 'td_one_touch'; // 원터치 배치 on/off (기본 on)
export const INTERMISSION_KEY = 'td_intermission'; // 웨이브 간 인터미션 on/off (기본 on)
