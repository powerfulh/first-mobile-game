// 디버그/테스트용 — main.js가 window.td에 노출. 프로덕션 로직 아님.
import { game } from './state.js';
import { TOWER_ROLES } from './core/config.js';
import { setTowerTier, recomputeStats } from './tower.js';

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

// 테스트용 — role 문자열 배열을 받아 현재 배치된 타워를 앞에서부터 1:1로 해당 role 타워로 교체.
// role 배열과 game.entities.towers 중 짧은 쪽만큼만 순회(남는 쪽은 무시). 각 타워의 좌표는 유지.
export function spawnTestTowers(...roles) {
	game.hp = 1;
	const towers = game.entities.towers;
	const n = Math.min(roles.length, towers.length);
	for (let i = 0; i < n; i++) {
		const role = roles[i];
		if (!TOWER_ROLES[role]) continue;
		const { x, y } = towers[i];
		const tw = { x, y, cooldown: 0, angle: 0, xp: 0, totalDamage: 0, waveDamage: 0 };
		setTowerTier(tw, role, tierOf(role));
		towers[i] = tw;
	}
	recomputeStats();
}
