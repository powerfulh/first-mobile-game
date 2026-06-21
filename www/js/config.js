export const LOGICAL_W = 360;
export const LOGICAL_H = 640;

export const path = [
	{ x: 60, y: 0 },
	{ x: 60, y: 150 },
	{ x: 280, y: 150 },
	{ x: 280, y: 350 },
	{ x: 80, y: 350 },
	{ x: 80, y: 540 },
	{ x: 300, y: 540 },
	{ x: 300, y: 640 },
];

export const TOWER = {
	cost: 50,
	radius: 14,
	projectileSpeed: 280,
	promotionCosts: [125, 250, 1000, 3000], // [t0→t1, t1→t2, t2→t3, t3→t4]
	xpThresholds:   [20,  40,  200,  500],
	buffRates:      [0.10, 0.10, 0.20, 0.30, 0.40], // 받는 타워 티어 (t0~t4)
	maxTier: 4,
};

// 4티어 레시피 (1:1 양방향). 두 3티어 역할 쌍 → 4티어 역할.
export const TIER4_RECIPES = {
	beacon:      { partner: 'trap',        result: 'radar' },
	trap:        { partner: 'beacon',      result: 'radar' },
	dealman:     { partner: 'demon',       result: 'assassin' },
	demon:       { partner: 'dealman',     result: 'assassin' },
	whale:       { partner: 'skydoom',     result: 'silo' },
	skydoom:     { partner: 'whale',       result: 'silo' },
	master:      { partner: 'interceptor', result: 'gatling' },
	interceptor: { partner: 'master',      result: 'gatling' },
};

export const TOWER_ROLES = {
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
		name: '탱크', tagline: '범위 공격 · 지상 (반경 50)',
		color: '#7e5109', color2: '#4a2810',
		range: 90, fireRate: 0.8, damage: 5,
		attackTypes: ['ground'], splash: 50,
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
		gainsXpOnEnemyEnter: true,
	},
	eagle: {
		name: '이글', tagline: '공중 전담 · 빠른 사격',
		color: '#2874a6', color2: '#1f618d',
		range: 140, fireRate: 2.4, damage: 3.2,
		attackTypes: ['air'], splash: 0,
		promotions: ['skydoom', 'interceptor'],
	},
	skydoom: {
		name: '스카이둠', tagline: '광역 공중 폭격 · 반경 50',
		color: '#1f3a5f', color2: '#0c1c30',
		range: 140, fireRate: 2.4, damage: 5,
		attackTypes: ['air'], splash: 50,
		promotions: [],
	},
	interceptor: {
		name: '인터셉터', tagline: '7발 부채꼴 · 공중 (직선 비유도)',
		color: '#85c1e9', color2: '#5499c7',
		range: 140, fireRate: 4.8, damage: 2,
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
	radar: {
		name: '래이다르', tagline: '사거리 내 일제 + 마킹 · 지상 / 공중',
		color: '#1abc9c', color2: '#117a65',
		range: 100, fireRate: 0.2, damage: 20,
		attackTypes: ['ground', 'air'], splash: 0,
		promotions: [],
		areaSweep: true,
		marksEnemies: true,
		description: [
			'적을 감지하여 사거리와 상관없이 공격할 수 있게 합니다',
			'비콘의 버프 능력을 잃습니다',
		],
	},
	assassin: {
		name: '어쌔신', tagline: '관통 빔 + 방어막 무력화 · 지상 / 공중',
		color: '#5b1b3a', color2: '#2d0a1d',
		range: 200, fireRate: 0.8, damage: 20,
		attackTypes: ['ground', 'air'], splash: 0,
		promotions: [],
		instantHit: true,
		pierces: true,
		targetMode: 'highestHp',
		disablesModifiers: true,
		description: [
			'피해를 입은 적의 방어막을 영구 무력화합니다',
			'데몬의 버프 능력을 잃습니다',
		],
	},
	silo: {
		name: '사일로', tagline: '비유도 광역 폭격 · 지상 (반경 160)',
		color: '#34495e', color2: '#1a252f',
		range: 120, minRange: 60, fireRate: 0.4, damage: 40,
		attackTypes: ['ground'], splash: 160,
		promotions: [],
		ballistic: true,
		projectileSpeed: 196, // TOWER.projectileSpeed(280)의 70%
		description: [
			'유도 없이 발사 시점의 착탄 지점에 광역 폭격',
			'최소 사거리 존재',
			'스카이둠의 공중 공격 능력은 잃습니다',
		],
	},
	gatling: {
		name: '개틀링', tagline: '비유도 연사 탄막 · 공중',
		color: '#566573', color2: '#2c3e50',
		range: 150, fireRate: 20, damage: 2.2,
		attackTypes: ['air'], splash: 0,
		promotions: [],
		scatterDeg: 12, // ±6° 흩어짐
		projectileCount: 2, // 매 발사마다 2발
		description: [
			'약간 부정확하지만 폭발적인 공세를 퍼붓습니다',
			'지상 공격 능력을 잃습니다',
		],
	},
};

export const TARGET_PRIORITY = ['air', 'ground'];

export const PATH_WIDTH = 28;
export const ENEMY_KILL_REWARD = 6;
export const HUD_RESERVED_TOP = 36;
export const HOLD_DELETE_SECONDS = 1.0;
export const WAVE_END_XP_MULTIPLIER = 5;

export const REGEN_START_WAVE = 111;
export const REGEN_HEAL_RATE = 0.12; // hpMax 기준 초당 회복 비율

export const BARRIER_START_WAVE = 151;
export const BARRIER_RADIUS = 60;

export const SAVE_KEY = 'td_save_v1';
export const BEST_WAVE_KEY = 'td_best_wave';
export const AIR_INTRO_KEY = 'td_seen_air_intro';
export const BUFF_INTRO_KEY = 'td_seen_buff_intro';
export const BOSS_INTRO_KEY = 'td_seen_boss_intro';
export const SHIELD_INTRO_KEY = 'td_seen_shield_intro';
export const TIER4_INTRO_KEY = 'td_seen_tier4_intro';
export const REGEN_INTRO_KEY = 'td_seen_regen_intro';
export const BARRIER_INTRO_KEY = 'td_seen_barrier_intro';

// 볼륨(0~1) — 게임 진행과 무관한 사용자 선호라 resetLocalData 대상에서 제외.
// 배경음·효과음 마스터를 분리해 각각 저장.
export const BGM_VOLUME_KEY = 'td_volume';
export const SFX_VOLUME_KEY = 'td_sfx_volume';
export const ONE_TOUCH_KEY = 'td_one_touch'; // 원터치 배치 on/off (기본 on)
