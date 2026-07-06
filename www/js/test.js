// 디버그/테스트용 — main.js가 window.td에 노출. 프로덕션 로직 아님.
import { game } from './state.js';
import { TOWER_ROLES } from './core/config.js';
import { setTowerTier, recomputeStats } from './tower.js';

// 고정 배치 좌표 11개 (논리좌표). spawnTestTowers의 role 배열 인덱스와 1:1 대응.
const TEST_COORDS = [
	{ x: 205.35211267605635, y: 373.66894303575475 },
	{ x: 267.0422535211268, y: 373.66894303575475 },
	{ x: 267.0422535211268, y: 338.17574119540325 },
	{ x: 265.3521126760563, y: 304.37269182363985 },
	{ x: 205.35211267605635, y: 335.640512492521 },
	{ x: 207.04225352112675, y: 300.14731065216944 },
	{ x: 236.61971830985917, y: 319.5840640409334 },
	{ x: 233.23943661971833, y: 355.0772658812849 },
	{ x: 269.5774647887324, y: 425.218593327694 },
	{ x: 208.73239436619718, y: 419.3030596876354 },
	{ x: 237.46478873239437, y: 273.9499473890528 },
];

// role → tier 유도 — 데이터에 tier가 없어 트리(promotions)/레시피(recipe)로 계산.
// novice=0, 전직 자식=부모+1, 합체 결과(recipe)=재료+1.
function tierOf(role) {
	if (role === 'novice') return 0;
	const cfg = TOWER_ROLES[role];
	if (cfg.recipe) return tierOf(cfg.recipe[0]) + 1;
	for (const [parent, c] of Object.entries(TOWER_ROLES)) {
		if ((c.promotions || []).includes(role)) return tierOf(parent) + 1;
	}
	return 0;
}

// 테스트용 — role 문자열 11개를 받아 TEST_COORDS 11곳에 해당 타워를 즉시 생성(비용·배치 판정 무시).
// 알 수 없는 role이나 좌표 수 초과 인덱스는 건너뜀.
export function spawnTestTowers(roles) {
	game.hp = 1
	roles.forEach((role, i) => {
		if (i >= TEST_COORDS.length || !TOWER_ROLES[role]) return;
		const { x, y } = TEST_COORDS[i];
		const tw = { x, y, cooldown: 0, angle: 0, xp: 0, totalDamage: 0, waveDamage: 0 };
		setTowerTier(tw, role, tierOf(role));
		game.entities.towers.push(tw);
	});
	recomputeStats();
}
