import { ctx } from './canvas.js';
import {
	LOGICAL_W, LOGICAL_H, TOWER, TOWER_ROLES, TIER4_RECIPES,
	PATH_WIDTH, HUD_RESERVED_TOP, WAVE_END_XP_MULTIPLIER, BUFF_INTRO_KEY,
} from './config.js';
import { game, hasSeenIntro } from './state.js';
import { distanceToPath, roundRect, drawCloseX, hitButton, drawPanel } from './helpers.js';
import {
	applyTowerHit, fireInstantBeam, fireLineBeam, spawnZap,
} from './attack.js';
import { isBlockedByBarrier, drawEnemySprite } from './enemy.js';

// ============ Promotion / XP helpers ============
export function xpMaxFor(t) {
	return TOWER.xpThresholds[t.tier] || 0;
}

export function promotionCostFor(t) {
	return TOWER.promotionCosts[t.tier] || 0;
}

export function canPromote(t) {
	if (t.tier >= TOWER.maxTier) return false;
	if (t.tier === 3) return !!TIER4_RECIPES[t.role]; // 4티어는 레시피 등록된 3티어만
	return TOWER_ROLES[t.role].promotions.length > 0;
}

export function isPromotionReady(t) {
	return canPromote(t) && (game.sandbox || t.xp >= xpMaxFor(t));
}

export function canAffordPromotion(t) {
	return game.sandbox || game.gold >= promotionCostFor(t);
}

// ============ Tier 4 helpers ============
export function getTier4Recipe(t) {
	return TIER4_RECIPES[t.role] || null;
}

export function isCompatibleTier4Partner(target, candidate) {
	// 두 3티어 타워가 서로의 레시피 파트너인지
	if (!target || !candidate || target === candidate) return false;
	if (target.tier !== 3 || candidate.tier !== 3) return false;
	const recipe = TIER4_RECIPES[target.role];
	return !!recipe && recipe.partner === candidate.role;
}

export function hasReadyTier4Candidate() {
	// 게임 내에 XP 가득 찬 4티어 후보 3티어가 존재하는지
	for (const t of game.towers) {
		if (t.tier === 3 && TIER4_RECIPES[t.role] && t.xp >= xpMaxFor(t)) {
			return true;
		}
	}
	return false;
}

// ============ Buff / range helpers ============
export function getEffectiveRange(t, visited) {
	visited = visited || new Set();
	if (visited.has(t)) return t.range;
	visited.add(t);
	try {
		const buffRate = TOWER.buffRates[t.tier];
		if (buffRate === undefined) return t.range;
		for (const other of game.towers) {
			if (other === t) continue;
			const otherCfg = TOWER_ROLES[other.role];
			if (!otherCfg.buffsRange) continue;
			const d = Math.hypot(t.x - other.x, t.y - other.y);
			const otherRange = getEffectiveRange(other, visited);
			if (d <= otherRange) {
				return t.range * (1 + buffRate);
			}
		}
		return t.range;
	} finally {
		visited.delete(t);
	}
}

export function getEffectiveDamage(t, visited) {
	visited = visited || new Set();
	if (visited.has(t)) return t.damage;
	visited.add(t);
	try {
		const buffRate = TOWER.buffRates[t.tier];
		if (buffRate === undefined) return t.damage;
		for (const other of game.towers) {
			if (other === t) continue;
			const otherCfg = TOWER_ROLES[other.role];
			if (!otherCfg.buffsDamage) continue;
			const d = Math.hypot(t.x - other.x, t.y - other.y);
			const otherRange = getEffectiveRange(other);
			if (d <= otherRange) {
				return t.damage * (1 + buffRate);
			}
		}
		return t.damage;
	} finally {
		visited.delete(t);
	}
}

export function getXpGainAtWaveEnd(t) {
	for (const other of game.towers) {
		if (other === t) continue;
		const otherCfg = TOWER_ROLES[other.role];
		if (!otherCfg.boostsXp) continue;
		const d = Math.hypot(t.x - other.x, t.y - other.y);
		if (d <= getEffectiveRange(other)) {
			return WAVE_END_XP_MULTIPLIER;
		}
	}
	return 1;
}

export function getEnemySpeedFactor(e) {
	let factor = 1;
	for (const t of game.towers) {
		const cfg = TOWER_ROLES[t.role];
		if (!cfg.slowsEnemies) continue;
		const range = getEffectiveRange(t);
		const d = Math.hypot(e.x - t.x, e.y - t.y);
		if (d <= range) {
			const slow = cfg.slowFactor !== undefined ? cfg.slowFactor : 0.5;
			if (slow < factor) factor = slow;
		}
	}
	return factor;
}

// ============ 공격 우선순위 ============
// 타워 인스턴스의 공격 우선순위 상태를 cfg 기본값으로 초기화 (배치/전직 시 호출).
//  - canGround/canAir: 공격 가능 타입 (cfg.attackTypes 기반)
//  - gaPriority: 지상/공중 우선 ('ground'|'air'|'equal'). 둘 다 가능하면 기본 공중 우선.
//  - targetPriority: 공통 표적 우선순위. cfg.targetMode==='highestHp'면 가장 강함, 아니면 가장 가까움.
export function applyTowerPriorityDefaults(t) {
	const cfg = TOWER_ROLES[t.role];
	const types = cfg.attackTypes || [];
	t.canGround = types.includes('ground');
	t.canAir = types.includes('air');
	t.gaPriority = (t.canGround && t.canAir) ? 'air' : 'equal';
	t.targetPriority = cfg.targetMode === 'highestHp' ? 'strongest' : 'closest';
}

export function allowedTypesOf(t) {
	const types = [];
	if (t.canGround) types.push('ground');
	if (t.canAir) types.push('air');
	return types;
}

function gaCapsOf(cfg) {
	const types = cfg.attackTypes || [];
	return (types.includes('ground') ? 'G' : '') + (types.includes('air') ? 'A' : '');
}

// 전직 시: 지상/공중 가능 여부가 그대로이고 새 역할에 지정 기본값(targetMode)이 없으면
// 기존 우선순위 설정 유지, 아니면 새 역할 기준 기본값으로 리셋.
function applyTowerPriorityOnPromote(t, oldRole) {
	const newCfg = TOWER_ROLES[t.role];
	const sameCaps = gaCapsOf(TOWER_ROLES[oldRole]) === gaCapsOf(newCfg);
	if (sameCaps && !newCfg.targetMode) return;
	applyTowerPriorityDefaults(t);
}

// ============ Placement ============
export function canPlaceTower(x, y) {
	if (!game.sandbox && game.gold < TOWER.cost) return false;
	if (y < HUD_RESERVED_TOP + TOWER.radius) return false;
	if (x < TOWER.radius || x > LOGICAL_W - TOWER.radius) return false;
	if (y > LOGICAL_H - TOWER.radius) return false;
	if (distanceToPath(x, y) < PATH_WIDTH / 2 + TOWER.radius + 2) return false;
	for (const t of game.towers) {
		if (Math.hypot(x - t.x, y - t.y) < TOWER.radius * 2 + 4) return false;
	}
	return true;
}

export function placeTower(x, y) {
	if (!canPlaceTower(x, y)) return false;
	const cfg = TOWER_ROLES.base;
	const tw = {
		x, y,
		role: 'base',
		tier: 0,
		range: cfg.range,
		fireRate: cfg.fireRate,
		damage: cfg.damage,
		cooldown: 0,
		angle: 0,
		xp: 0,
		totalDamage: 0,
		waveDamage: 0,
	};
	applyTowerPriorityDefaults(tw);
	game.towers.push(tw);
	if (!game.sandbox) game.gold -= TOWER.cost;
	return true;
}

export function promoteTower(t, role) {
	if (!isPromotionReady(t)) return false;
	if (!canAffordPromotion(t)) return false;
	if (!TOWER_ROLES[t.role].promotions.includes(role)) return false;
	const cfg = TOWER_ROLES[role];
	if (!cfg) return false;

	if (!game.sandbox) game.gold -= promotionCostFor(t);
	const prevRole = t.role;
	t.role = role;
	t.tier += 1;
	t.range = cfg.range;
	t.fireRate = cfg.fireRate;
	t.damage = cfg.damage;
	t.cooldown = 0;
	t.xp = 0;
	applyTowerPriorityOnPromote(t, prevRole); // 능력 동일·기본값 미지정이면 설정 유지

	if (cfg.buffsRange && !game.modal && !hasSeenIntro(BUFF_INTRO_KEY)) {
		game.modal = { type: 'buffIntro' };
	}
	return true;
}

export function promoteToTier4(secondTower) {
	// 대상(첫 타워)이 사라지고 secondTower 자리에 4티어 타워 생성
	const target = game.promotionTarget;
	if (!target) return false;
	if (!isCompatibleTier4Partner(target, secondTower)) return false;
	if (!isPromotionReady(target) || !isPromotionReady(secondTower)) return false;
	const cost = promotionCostFor(secondTower);
	if (!game.sandbox && game.gold < cost) return false;

	const recipe = TIER4_RECIPES[secondTower.role];
	const resultRole = recipe.result;
	const cfg = TOWER_ROLES[resultRole];
	if (!cfg) return false;

	if (!game.sandbox) game.gold -= cost;

	// 대상 타워 제거
	game.towers = game.towers.filter(x => x !== target);
	game.promotionTarget = null;

	// 두 번째 타워 자리에 4티어로 변환
	const prevRole = secondTower.role;
	secondTower.role = resultRole;
	secondTower.tier = 4;
	secondTower.range = cfg.range;
	secondTower.fireRate = cfg.fireRate;
	secondTower.damage = cfg.damage;
	secondTower.cooldown = 0;
	secondTower.xp = 0;
	applyTowerPriorityOnPromote(secondTower, prevRole); // 능력 동일·기본값 미지정이면 설정 유지
	return true;
}

// ============ Update / Fire ============
export function updateTower(t, dt) {
	t.cooldown = Math.max(0, t.cooldown - dt);

	const cfg = TOWER_ROLES[t.role];
	const allowed = allowedTypesOf(t);
	const range = getEffectiveRange(t);

	// 영향권 진입 시 XP 부여 (데몬류 비공격 타워의 수급 수단)
	if (cfg.gainsXpOnEnemyEnter) {
		if (!t.inRangeEnemies) t.inRangeEnemies = new Set();
		const next = new Set();
		for (const e of game.enemies) {
			if (e.dead) continue;
			const d = Math.hypot(e.x - t.x, e.y - t.y);
			if (d > range) continue;
			next.add(e);
			if (!t.inRangeEnemies.has(e) && canPromote(t)) {
				t.xp = Math.min(xpMaxFor(t), Math.round((t.xp + 1) * 10) / 10);
			}
		}
		t.inRangeEnemies = next;
	}

	// areaSweep은 자기 사거리 내만 처리 (마킹 풀 무시). 그 외 모든 단일 타겟 타워는 마킹 적 포함.
	const includeMarked = !cfg.areaSweep;
	const minRange = cfg.minRange || 0;

	// 단일 타워의 타게팅에서는 장벽 차단 검사 안 함 — 조준은 정상,
	// 발사된 빔/투사체가 장벽에 막혀 장벽이 대신 데미지 받음.
	// 표적 선정: 지상/공중 우선(1순위) → 공통 우선순위(2순위)
	let target = null;
	{
		const useHp = (t.targetPriority === 'strongest' || t.targetPriority === 'weakest');
		const preferHigher = (t.targetPriority === 'farthest' || t.targetPriority === 'strongest');
		let bestTier = Infinity;
		let bestVal = 0;
		for (const e of game.enemies) {
			if (e.dead) continue;
			if (e.isBarrier) continue;
			if (e.type === 'ground' ? !t.canGround : !t.canAir) continue;
			const d = Math.hypot(e.x - t.x, e.y - t.y);
			if (d < minRange) continue;
			if (d > range && !(includeMarked && e.marked)) continue;
			// 지상/공중 티어 (낮을수록 우선). 동등이면 모두 0.
			let tier = 0;
			if (t.gaPriority === 'air') tier = (e.type === 'air') ? 0 : 1;
			else if (t.gaPriority === 'ground') tier = (e.type === 'ground') ? 0 : 1;
			const val = useHp ? e.hp : d;
			if (target === null || tier < bestTier
				|| (tier === bestTier && (preferHigher ? val > bestVal : val < bestVal))) {
				target = e;
				bestTier = tier;
				bestVal = val;
			}
		}
	}

	if (target) {
		t.angle = Math.atan2(target.y - t.y, target.x - t.x);
		if (t.cooldown <= 0) {
			const damage = getEffectiveDamage(t);
			if (cfg.areaSweep) {
				// 트랩: 사거리 내 모든 유효 적에 즉시 데미지 (+10 buffer)
				// areaSweep은 광선 형태라 장벽이 적을 가려주는 효과 유지 (장벽 자체는 데미지 받음)
				const hitRange = range + 10;
				const sweepBlocked = allowed.includes('air');
				for (const e of game.enemies) {
					if (e.dead) continue;
					if (!allowed.includes(e.type)) continue;
					const d = Math.hypot(e.x - t.x, e.y - t.y);
					if (d > hitRange) continue;
					if (!e.isBarrier && sweepBlocked && isBlockedByBarrier(t.x, t.y, e)) continue;
					applyTowerHit(t, e, damage);
				}
				spawnZap(t.x, t.y, range, cfg.color);
			} else if (cfg.instantHit) {
				if (cfg.pierces) {
					fireLineBeam(t, target, damage);
				} else {
					fireInstantBeam(t, target, damage);
				}
			} else if (cfg.fanShot) {
				const count = cfg.projectileCount || 5;
				const spreadRad = (cfg.spreadDeg || 32) * Math.PI / 180;
				const half = spreadRad / 2;
				const step = count > 1 ? spreadRad / (count - 1) : 0;
				for (let i = 0; i < count; i++) {
					const angle = t.angle - half + step * i;
					game.projectiles.push({
						x: t.x,
						y: t.y,
						vx: Math.cos(angle) * TOWER.projectileSpeed,
						vy: Math.sin(angle) * TOWER.projectileSpeed,
						damage,
						shooter: t,
						splash: cfg.splash || 0,
						splashColor: cfg.color,
						attackTypes: allowed,
						straightMode: true,
					});
				}
			} else if (cfg.scatterDeg) {
				// 매 발사마다 projectileCount발, 각 발은 t.angle에 ±scatterDeg/2 난수
				const count = cfg.projectileCount || 1;
				const scatterRad = cfg.scatterDeg * Math.PI / 180;
				for (let i = 0; i < count; i++) {
					const angle = t.angle + (Math.random() - 0.5) * scatterRad;
					game.projectiles.push({
						x: t.x,
						y: t.y,
						vx: Math.cos(angle) * TOWER.projectileSpeed,
						vy: Math.sin(angle) * TOWER.projectileSpeed,
						damage,
						shooter: t,
						splash: cfg.splash || 0,
						splashColor: cfg.color,
						attackTypes: allowed,
						straightMode: true,
					});
				}
			} else if (cfg.ballistic) {
				// 발사 시점의 좌표를 고정 착탄점으로 잡고 직선 발사. 적이 회피해도 그 자리 폭격.
				const tx = target.x;
				const ty = target.y;
				const dx = tx - t.x;
				const dy = ty - t.y;
				const dist = Math.hypot(dx, dy) || 1;
				const speed = cfg.projectileSpeed || TOWER.projectileSpeed;
				game.projectiles.push({
					x: t.x,
					y: t.y,
					vx: (dx / dist) * speed,
					vy: (dy / dist) * speed,
					tx, ty,
					damage,
					shooter: t,
					splash: cfg.splash || 0,
					splashColor: cfg.color,
					attackTypes: allowed,
					ballisticMode: true,
				});
			} else {
				game.projectiles.push({
					x: t.x,
					y: t.y,
					target: target,
					damage,
					speed: TOWER.projectileSpeed,
					shooter: t,
					splash: cfg.splash || 0,
					splashColor: cfg.color,
					attackTypes: allowed,
				});
			}
			t.cooldown = 1 / t.fireRate;
		}
	}
}

// ============ Draw — 본체 ============
function drawCannonBody(t, cfg, selected) {
	ctx.fillStyle = cfg.color;
	ctx.beginPath();
	ctx.arc(t.x, t.y, TOWER.radius, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = selected ? '#fff' : cfg.color2;
	ctx.lineWidth = selected ? 3 : 2;
	ctx.stroke();

	ctx.save();
	ctx.translate(t.x, t.y);
	ctx.rotate(t.angle);
	ctx.fillStyle = cfg.color2;
	ctx.fillRect(0, -3, TOWER.radius + 4, 6);
	ctx.restore();
}

function drawBeamEmitterBody(t, cfg, selected) {
	const r = TOWER.radius;
	ctx.fillStyle = cfg.color;
	ctx.beginPath();
	for (let i = 0; i < 6; i++) {
		const a = i * Math.PI / 3 - Math.PI / 2;
		const px = t.x + r * Math.cos(a);
		const py = t.y + r * Math.sin(a);
		if (i === 0) ctx.moveTo(px, py);
		else ctx.lineTo(px, py);
	}
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = selected ? '#fff' : cfg.color2;
	ctx.lineWidth = selected ? 3 : 2;
	ctx.stroke();

	const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 350);
	ctx.fillStyle = '#fff';
	ctx.globalAlpha = 0.4 + 0.25 * pulse;
	ctx.beginPath();
	ctx.arc(t.x, t.y, r * 0.42, 0, Math.PI * 2);
	ctx.fill();
	ctx.globalAlpha = 1;
}

function drawAreaSweepBody(t, cfg, selected) {
	const r = TOWER.radius;
	ctx.fillStyle = cfg.color;
	ctx.beginPath();
	ctx.moveTo(t.x, t.y - r);
	ctx.lineTo(t.x + r, t.y);
	ctx.lineTo(t.x, t.y + r);
	ctx.lineTo(t.x - r, t.y);
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = selected ? '#fff' : cfg.color2;
	ctx.lineWidth = selected ? 3 : 2;
	ctx.stroke();

	ctx.fillStyle = '#fff';
	ctx.globalAlpha = 0.55;
	ctx.beginPath();
	ctx.arc(t.x, t.y, 3, 0, Math.PI * 2);
	ctx.fill();
	ctx.globalAlpha = 1;
}

function drawSupportBody(t, cfg, selected) {
	const r = TOWER.radius;
	ctx.fillStyle = cfg.color;
	ctx.beginPath();
	for (let i = 0; i < 8; i++) {
		const a = i * Math.PI / 4 + Math.PI / 8;
		const px = t.x + r * Math.cos(a);
		const py = t.y + r * Math.sin(a);
		if (i === 0) ctx.moveTo(px, py);
		else ctx.lineTo(px, py);
	}
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = selected ? '#fff' : cfg.color2;
	ctx.lineWidth = selected ? 3 : 2;
	ctx.stroke();

	// 배럴 (공격 가능 시)
	if ((cfg.attackTypes || []).length > 0) {
		ctx.save();
		ctx.translate(t.x, t.y);
		ctx.rotate(t.angle);
		ctx.fillStyle = cfg.color2;
		ctx.fillRect(0, -3, r + 4, 6);
		ctx.restore();
	}

	// 외곽 점선 펄스링
	const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 700);
	ctx.globalAlpha = 0.35 + 0.3 * pulse;
	ctx.strokeStyle = cfg.color;
	ctx.lineWidth = 2;
	ctx.setLineDash([4, 3]);
	ctx.beginPath();
	ctx.arc(t.x, t.y, r + 7, 0, Math.PI * 2);
	ctx.stroke();

	// 두 번째 링 — 비콘 전용
	if (cfg.buffsDamage) {
		const pulse2 = 0.5 + 0.5 * Math.sin(performance.now() / 700 + Math.PI);
		ctx.globalAlpha = 0.35 + 0.3 * pulse2;
		ctx.beginPath();
		ctx.arc(t.x, t.y, r + 12, 0, Math.PI * 2);
		ctx.stroke();
	}

	ctx.setLineDash([]);
	ctx.globalAlpha = 1;
}

function drawGatlingBody(t, cfg, selected) {
	const r = TOWER.radius;

	// 본체 원
	ctx.fillStyle = cfg.color;
	ctx.beginPath();
	ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = selected ? '#fff' : cfg.color2;
	ctx.lineWidth = selected ? 3 : 2;
	ctx.stroke();

	// 다발 배럴 (3개 평행, t.angle 방향)
	ctx.save();
	ctx.translate(t.x, t.y);
	ctx.rotate(t.angle);

	// 발사 직후 짧은 반동 (cooldown 마지막 30%)
	const interval = 1 / t.fireRate;
	const recoiling = t.cooldown > interval * 0.7;
	const recoilOffset = recoiling ? -1.5 : 0;

	ctx.fillStyle = cfg.color2;
	for (let i = -1; i <= 1; i++) {
		const offY = i * 3.5;
		ctx.fillRect(recoilOffset, offY - 1.2, r + 4, 2.4);
	}

	// 배럴 끝 강조
	ctx.fillStyle = '#1a252f';
	for (let i = -1; i <= 1; i++) {
		const offY = i * 3.5;
		ctx.fillRect(r + recoilOffset + 2, offY - 1.2, 2, 2.4);
	}

	ctx.restore();

	// 중심 캡(회전축 표시)
	ctx.fillStyle = '#bdc3c7';
	ctx.beginPath();
	ctx.arc(t.x, t.y, 2, 0, Math.PI * 2);
	ctx.fill();
}

function drawAssassinBody(t, cfg, selected) {
	const r = TOWER.radius;
	const time = performance.now();

	// 본체 — 칼날 다이아몬드 (다른 타워와 비슷한 크기)
	ctx.save();
	ctx.translate(t.x, t.y);
	ctx.rotate(t.angle);

	ctx.fillStyle = cfg.color;
	ctx.beginPath();
	ctx.moveTo(r + 2, 0);          // 앞 (날카롭게 뻗음)
	ctx.lineTo(0, -r * 0.9);
	ctx.lineTo(-r * 0.9, 0);
	ctx.lineTo(0, r * 0.9);
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = selected ? '#fff' : cfg.color2;
	ctx.lineWidth = selected ? 3 : 2;
	ctx.stroke();

	// 중심 짙은 코어
	ctx.fillStyle = cfg.color2;
	ctx.beginPath();
	ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
	ctx.fill();

	// 붉은 빛점 (위협 펄스)
	const pulse = 0.5 + 0.5 * Math.sin(time / 250);
	ctx.fillStyle = `rgba(231, 76, 60, ${0.6 + 0.4 * pulse})`;
	ctx.beginPath();
	ctx.arc(0, 0, 1.8 + pulse * 0.5, 0, Math.PI * 2);
	ctx.fill();

	ctx.restore();
}

function drawSiloBody(t, cfg, selected) {
	const r = TOWER.radius;
	const x = t.x - r;
	const y = t.y - r;
	const w = r * 2;

	// 본체 - 사각형 격납고
	ctx.fillStyle = cfg.color;
	ctx.fillRect(x, y, w, w);
	ctx.strokeStyle = selected ? '#fff' : cfg.color2;
	ctx.lineWidth = selected ? 3 : 2;
	ctx.strokeRect(x, y, w, w);

	// 격납고 도어 분할 라인 (십자)
	ctx.strokeStyle = cfg.color2;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(x, t.y);
	ctx.lineTo(x + w, t.y);
	ctx.moveTo(t.x, y);
	ctx.lineTo(t.x, y + w);
	ctx.stroke();

	// 모서리 리벳
	ctx.fillStyle = cfg.color2;
	const rivetR = 1.5;
	const off = 3;
	ctx.beginPath();
	ctx.arc(x + off, y + off, rivetR, 0, Math.PI * 2);
	ctx.arc(x + w - off, y + off, rivetR, 0, Math.PI * 2);
	ctx.arc(x + off, y + w - off, rivetR, 0, Math.PI * 2);
	ctx.arc(x + w - off, y + w - off, rivetR, 0, Math.PI * 2);
	ctx.fill();

	// 미사일 (angle 방향, 발사 직후 잠시 숨김)
	const ready = t.cooldown < (1 / t.fireRate) * 0.7;
	if (ready) {
		ctx.save();
		ctx.translate(t.x, t.y);
		ctx.rotate(t.angle);

		ctx.fillStyle = '#bdc3c7';
		ctx.beginPath();
		ctx.moveTo(-4, -2);
		ctx.lineTo(4, -2);
		ctx.lineTo(8, 0);
		ctx.lineTo(4, 2);
		ctx.lineTo(-4, 2);
		ctx.closePath();
		ctx.fill();
		ctx.strokeStyle = '#34495e';
		ctx.lineWidth = 1;
		ctx.stroke();

		// 헤드 붉은 점
		ctx.fillStyle = '#c0392b';
		ctx.beginPath();
		ctx.arc(5, 0, 1.2, 0, Math.PI * 2);
		ctx.fill();

		ctx.restore();
	}

	// 좌상단 작동 LED (깜빡임)
	const blink = (performance.now() % 900) < 450;
	ctx.fillStyle = blink ? '#f1c40f' : 'rgba(241, 196, 15, 0.25)';
	ctx.beginPath();
	ctx.arc(x + 3, y + 3, 1.6, 0, Math.PI * 2);
	ctx.fill();
}

function drawTier4Halo(cx, cy, haloR) {
	// 4티어 공통 외관 — 회전하는 6개 점
	const time = performance.now();
	for (let i = 0; i < 6; i++) {
		const angle = (Math.PI * 2 * i / 6) + time / 500;
		const px = cx + Math.cos(angle) * haloR;
		const py = cy + Math.sin(angle) * haloR;
		const alpha = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(time / 280 + i * 1.1));
		ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
		ctx.beginPath();
		ctx.arc(px, py, 1.6, 0, Math.PI * 2);
		ctx.fill();
	}
}

function drawRadarAntenna(t) {
	// 회전 안테나(디시) — 본체 위에 별도 디시 + sweeping 빔
	const sweep = (performance.now() / 600) % (Math.PI * 2);
	ctx.save();
	ctx.translate(t.x, t.y);
	ctx.rotate(sweep);

	// 디시 윤곽
	ctx.fillStyle = '#0e6655';
	ctx.beginPath();
	ctx.arc(0, 0, 6, -Math.PI * 0.4, Math.PI * 0.4);
	ctx.lineTo(0, 0);
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = '#fff';
	ctx.lineWidth = 1;
	ctx.stroke();

	// 스윕 라인 (옅게 길게)
	ctx.strokeStyle = 'rgba(26, 188, 156, 0.45)';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(TOWER.radius + 10, 0);
	ctx.stroke();
	ctx.restore();
}

// 타워 외형(4티어 후광 + 본체 + 레이더 안테나)만 그림.
// 게임 전용 요소(전직 펄스·XP 바)는 제외 → drawTower와 위키가 공유하는 단일 소스.
function drawTowerBody(t, cfg, selected) {
	if (t.tier === 4) drawTier4Halo(t.x, t.y, TOWER.radius + 8);

	if (cfg.disablesModifiers) {
		drawAssassinBody(t, cfg, selected);
	} else if (cfg.scatterDeg) {
		drawGatlingBody(t, cfg, selected);
	} else if (cfg.instantHit) {
		drawBeamEmitterBody(t, cfg, selected);
	} else if (cfg.buffsRange) {
		drawSupportBody(t, cfg, selected);
	} else if (cfg.areaSweep) {
		drawAreaSweepBody(t, cfg, selected);
	} else if (cfg.ballistic) {
		drawSiloBody(t, cfg, selected);
	} else {
		drawCannonBody(t, cfg, selected);
	}

	if (cfg.marksEnemies) drawRadarAntenna(t);
}

// 게임 밖(위키 등)에서 타워 외형을 그릴 때 사용. (cx, cy) 중심·게임과 동일 크기.
// 합성 타워 객체를 만들어 drawTowerBody를 재사용 — 외형 정의는 한 곳뿐.
export function drawTowerSprite(role, cx, cy, opts = {}) {
	const cfg = TOWER_ROLES[role];
	if (!cfg) return;
	const isTier4 = Object.values(TIER4_RECIPES).some(r => r.result === role);
	const t = {
		x: 0, y: 0, role, // 원점에 그린 뒤 translate/scale로 배치
		tier: isTier4 ? 4 : 1,
		angle: opts.angle ?? -Math.PI / 2, // 기본: 위쪽을 향함
		cooldown: 0,
		fireRate: cfg.fireRate || 1,
	};
	// 본체는 TOWER.radius 기준으로 그려짐 → 원하는 반지름이면 비율만큼 확대/축소.
	const scale = (opts.radius || TOWER.radius) / TOWER.radius;
	ctx.save();
	ctx.translate(cx, cy);
	if (scale !== 1) ctx.scale(scale, scale);
	drawTowerBody(t, cfg, false);
	ctx.restore();
}

export function drawTower(t) {
	const cfg = TOWER_ROLES[t.role];
	const selected = (t === game.selectedTower);
	const isTarget = (t === game.promotionTarget);

	if (isPromotionReady(t)) {
		const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
		ctx.globalAlpha = 0.35 + 0.45 * pulse;
		ctx.strokeStyle = isTarget ? '#1abc9c' : '#f1c40f';
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.arc(t.x, t.y, TOWER.radius + 5, 0, Math.PI * 2);
		ctx.stroke();
		ctx.globalAlpha = 1;
	}

	drawTowerBody(t, cfg, selected);

	if (canPromote(t)) {
		const xpMax = xpMaxFor(t);
		const ratio = xpMax > 0 ? t.xp / xpMax : 0;
		const bw = 24, bh = 3;
		const bx = t.x - bw / 2;
		const by = t.y + TOWER.radius + 5;
		ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
		ctx.fillRect(bx, by, bw, bh);
		ctx.fillStyle = ratio >= 1 ? '#f1c40f' : '#5dade2';
		ctx.fillRect(bx, by, bw * ratio, bh);
	}
}

export function drawTowerRange(t, fillAlpha, strokeAlpha) {
	const cfg = TOWER_ROLES[t.role];
	const range = getEffectiveRange(t);
	const minRange = cfg.minRange || 0;

	ctx.globalAlpha = fillAlpha;
	ctx.fillStyle = '#3498db';
	ctx.beginPath();
	ctx.arc(t.x, t.y, range, 0, Math.PI * 2);
	if (minRange > 0) {
		// 도넛 — 내경을 반대 방향으로 추가 후 evenodd로 가운데 비움
		ctx.arc(t.x, t.y, minRange, 0, Math.PI * 2, true);
	}
	ctx.fill('evenodd');

	ctx.globalAlpha = strokeAlpha;
	ctx.strokeStyle = '#5dade2';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.arc(t.x, t.y, range, 0, Math.PI * 2);
	ctx.stroke();
	if (minRange > 0) {
		ctx.beginPath();
		ctx.arc(t.x, t.y, minRange, 0, Math.PI * 2);
		ctx.stroke();
	}
	ctx.globalAlpha = 1;
}

// ============ Tower info panel / Promotion panel ============
export const towerInfoPanel = { x: 16, y: 496, w: 328, h: 144 };
export const infoSettingsButton = { x: 308, y: 504, w: 28, h: 28 };
export const infoPromotionButton = { x: 30, y: 600, w: 300, h: 32 };
export const promotionPanel = { x: 16, y: 376, w: 328, h: 248 };
export const promotionCloseButton = { x: 308, y: 384, w: 28, h: 28 };
export const promotionCardSlots = [
	{ x: 24, y: 432, w: 312, h: 84 },
	{ x: 24, y: 526, w: 312, h: 84 },
];
// 4티어 결과 카드 — 단일 카드라 영역 전체를 채움
export const tier4ResultCardSlot = { x: 24, y: 432, w: 312, h: 178 };

// 정보 카드 전직 버튼의 현재 상태 (라벨 + 활성/액션 종류)
// action: 'cancelTarget' | 'fuseTier4' | 'setTarget' | 'openTier3Choice' | null
export function getPromotionButtonState(t) {
	const ready = isPromotionReady(t);
	const cost = promotionCostFor(t);
	const xpMax = xpMaxFor(t);

	if (t.tier === 3) {
		if (!ready) {
			return { active: false, action: null, label: `전직 (XP ${t.xp} / ${xpMax})` };
		}
		if (t === game.promotionTarget) {
			return { active: true, action: 'cancelTarget', label: '대상 취소' };
		}
		if (game.promotionTarget && isCompatibleTier4Partner(game.promotionTarget, t)) {
			const afford = game.sandbox || game.gold >= cost;
			return {
				active: afford,
				action: afford ? 'openTier4Choice' : null,
				label: afford
					? `전직 (${cost.toLocaleString()}G)`
					: `전직 (${cost.toLocaleString()}G · 골드 부족)`,
			};
		}
		return { active: true, action: 'setTarget', label: '4티어 대상 지정' };
	}

	// t.tier < 3 — 기존 로직
	const afford = canAffordPromotion(t);
	const active = ready && afford;
	let label;
	if (!ready) label = `전직 (XP ${t.xp} / ${xpMax})`;
	else if (!afford) label = `전직 (${cost.toLocaleString()}G · 골드 부족)`;
	else label = `전직 (${cost.toLocaleString()}G)`;
	return { active, action: active ? 'openTier3Choice' : null, label };
}

function drawPromotionButton(t) {
	const { active, label } = getPromotionButtonState(t);

	ctx.globalAlpha = active ? 1 : 0.55;
	if (active) {
		const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 250);
		ctx.fillStyle = `rgba(241, 196, 15, ${0.85 + 0.15 * pulse})`;
	} else {
		ctx.fillStyle = '#3a3f48';
	}
	roundRect(infoPromotionButton.x, infoPromotionButton.y, infoPromotionButton.w, infoPromotionButton.h, 8);
	ctx.fill();
	ctx.globalAlpha = 1;
	ctx.strokeStyle = active ? '#fff' : '#555';
	ctx.lineWidth = active ? 2 : 1;
	ctx.stroke();

	ctx.fillStyle = active ? '#1a1300' : '#888';
	ctx.font = 'bold 14px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(label, infoPromotionButton.x + infoPromotionButton.w / 2, infoPromotionButton.y + infoPromotionButton.h / 2);
	ctx.textBaseline = 'alphabetic';
}

export function drawTowerInfoPanel(t) {
	const cfg = TOWER_ROLES[t.role];
	drawPanel(towerInfoPanel.x, towerInfoPanel.y, towerInfoPanel.w, towerInfoPanel.h, { stroke: cfg.color, alpha: 0.9 });

	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = '#fff';
	ctx.font = 'bold 14px sans-serif';
	const nameWidth = ctx.measureText(cfg.name).width;
	ctx.fillText(cfg.name, towerInfoPanel.x + 14, towerInfoPanel.y + 22);

	ctx.font = 'bold 11px sans-serif';
	const tierX = towerInfoPanel.x + 14 + nameWidth + 8;
	const tierY = towerInfoPanel.y + 22;
	const tierStr = `Tier ${t.tier}`;
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
	ctx.lineWidth = 2.5;
	ctx.lineJoin = 'round';
	ctx.strokeText(tierStr, tierX, tierY);
	ctx.fillStyle = cfg.color;
	ctx.fillText(tierStr, tierX, tierY);
	ctx.lineWidth = 1;

	ctx.font = '12px sans-serif';
	ctx.fillStyle = '#cdd';
	const sx = towerInfoPanel.x + 14;
	const sy = towerInfoPanel.y + 50;
	const total = Math.round((t.totalDamage || 0) * 10) / 10;
	const atkLabels = { ground: '지상', air: '공중' };
	const hasAttack = (cfg.attackTypes || []).length > 0;
	const activeTypes = [];
	if (t.canGround) activeTypes.push('ground');
	if (t.canAir) activeTypes.push('air');
	const atkText = activeTypes.length ? activeTypes.map(a => atkLabels[a] || a).join('/') : '없음';

	if (hasAttack) {
		const effDmg = getEffectiveDamage(t);
		const dmgBuffPct = effDmg > t.damage ? Math.round((effDmg / t.damage - 1) * 100) : 0;
		const dpsValue = Math.round(effDmg * t.fireRate * 10) / 10;
		const dmgValue = Math.round(effDmg * 10) / 10;
		const dmgStr = dmgBuffPct > 0
			? `데미지: ${dmgValue} (+${dmgBuffPct}%, ${dpsValue}/초)`
			: `데미지: ${t.damage} (${dpsValue}/초)`;
		ctx.fillText(dmgStr, sx, sy);
		ctx.fillText(`발사속도: ${t.fireRate.toFixed(1)}/초`, sx, sy + 18);
	} else {
		ctx.fillText('데미지: —', sx, sy);
		ctx.fillText('발사속도: —', sx, sy + 18);
	}

	const effRange = getEffectiveRange(t);
	const buffPct = effRange > t.range ? Math.round((effRange / t.range - 1) * 100) : 0;
	const rangeStr = buffPct > 0
		? `사거리: ${Math.round(effRange)} (+${buffPct}%)`
		: `사거리: ${t.range}`;
	ctx.fillText(rangeStr, sx + 160, sy);
	ctx.fillText(`공격 대상: ${atkText}`, sx + 160, sy + 18);
	const wave = Math.round((t.waveDamage || 0) * 10) / 10;
	ctx.fillText(`웨이브 누적 데미지: ${wave.toLocaleString()}`, sx, sy + 36);
	ctx.fillText(`누적 데미지: ${total.toLocaleString()}`, sx + 160, sy + 36);

	if (canPromote(t)) {
		const xpMax = xpMaxFor(t);
		const bx = sx;
		const by = sy + 44;
		const bw = 240;
		const bh = 8;
		const ratio = xpMax > 0 ? t.xp / xpMax : 0;
		ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
		ctx.fillRect(bx, by, bw, bh);
		ctx.fillStyle = t.xp >= xpMax ? '#f1c40f' : '#5dade2';
		ctx.fillRect(bx, by, bw * ratio, bh);
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
		ctx.lineWidth = 1;
		ctx.strokeRect(bx, by, bw, bh);
		ctx.fillStyle = '#fff';
		ctx.font = '10px sans-serif';
		ctx.fillText(`XP ${t.xp} / ${xpMax}`, bx + bw + 8, by + bh - 1);

		drawPromotionButton(t);
	}

	drawGearButton(infoSettingsButton);
}

// 정보 카드 우상단 기어 버튼 (닫기 X를 대체) — 터치 시 타워 설정 카드 진입.
function drawGearButton(btn) {
	const cx = btn.x + btn.w / 2;
	const cy = btn.y + btn.h / 2;
	ctx.fillStyle = '#2c3e50';
	roundRect(btn.x, btn.y, btn.w, btn.h, 6);
	ctx.fill();
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
	ctx.lineWidth = 1;
	ctx.stroke();
	// 기어 아이콘 (이빨 + 링 + 중심)
	ctx.strokeStyle = '#fff';
	ctx.fillStyle = '#fff';
	const r = 5;
	ctx.lineWidth = 2;
	ctx.beginPath();
	for (let i = 0; i < 8; i++) {
		const a = (Math.PI * 2 * i) / 8;
		ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
		ctx.lineTo(cx + Math.cos(a) * (r + 2.5), cy + Math.sin(a) * (r + 2.5));
	}
	ctx.stroke();
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(cx, cy, 1.6, 0, Math.PI * 2);
	ctx.fill();
}

// ---- 설정 카드 우선순위 컨트롤 ----
const PRIORITY_LABELS = { closest: '가장 가까움', farthest: '가장 멈', strongest: '가장 강함', weakest: '가장 약함' };
const PRIORITY_CYCLE = ['closest', 'farthest', 'strongest', 'weakest'];
// 그리는 순서 = 타게팅 계산 순서: 지상/공중(1순위) 위, 공통 우선순위(2순위) 아래.
// 지상/공중 행: [지상 스프라이트] [부등호] [공중 스프라이트] — 각 셀이 버튼.
const SETTINGS_GA = {
	ground: { x: 96, y: 556, w: 48, h: 32 },
	sign: { x: 156, y: 556, w: 48, h: 32 },
	air: { x: 216, y: 556, w: 48, h: 32 },
};
const SETTINGS_PRIORITY_BTN = { x: 38, y: 596, w: 284, h: 24 };

function towerAttacks(cfg) {
	return (cfg.attackTypes || []).length > 0;
}
function towerDualCapable(cfg) {
	const types = cfg.attackTypes || [];
	return types.includes('ground') && types.includes('air');
}

// 타워 설정 카드 — 정보 카드의 기어 버튼으로 진입. 공격 우선순위 설정.
export function drawTowerSettingsCard(t) {
	const cfg = TOWER_ROLES[t.role];
	const p = towerInfoPanel;
	drawPanel(p.x, p.y, p.w, p.h, { stroke: cfg.color, alpha: 0.9 });

	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = '#fff';
	ctx.font = 'bold 14px sans-serif';
	ctx.fillText(`${cfg.name} 설정`, p.x + 14, p.y + 22);

	// 우선순위 영역
	ctx.fillStyle = '#9ab';
	ctx.font = 'bold 11px sans-serif';
	ctx.fillText('우선순위', p.x + 14, p.y + 46);

	const ax = p.x + 14;
	const ay = p.y + 54;
	const aw = p.w - 28;
	const ah = p.y + p.h - 14 - ay;
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
	ctx.lineWidth = 1;
	roundRect(ax, ay, aw, ah, 6);
	ctx.stroke();

	if (!towerAttacks(cfg)) {
		ctx.fillStyle = '#7a8a99';
		ctx.font = '12px sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText('공격하지 않는 타워', p.x + p.w / 2, ay + ah / 2 + 4);
		ctx.textAlign = 'left';
		return;
	}

	// 1순위 — 지상/공중 우선 (둘 다 가능한 타워만). 각 셀이 버튼.
	if (towerDualCapable(cfg)) {
		drawGaCell(SETTINGS_GA.ground, 'ground', t.canGround);
		drawGaCell(SETTINGS_GA.air, 'air', t.canAir);
		// 부등호(지상/공중 우선). 스윕류는 단일 표적 정렬이 무의미 → '=' 고정·비활성(흐리게) 표시.
		const s = SETTINGS_GA.sign;
		const sweep = cfg.areaSweep;
		const sign = sweep ? '=' : (t.gaPriority === 'ground' ? '>' : t.gaPriority === 'air' ? '<' : '=');
		ctx.globalAlpha = sweep ? 0.45 : 1;
		drawCellButton(s);
		ctx.fillStyle = '#f1c40f';
		ctx.font = 'bold 20px sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(sign, s.x + s.w / 2, s.y + s.h / 2);
		ctx.textBaseline = 'alphabetic';
		ctx.textAlign = 'left';
		ctx.globalAlpha = 1;
	}

	// 2순위 — 공통 표적 우선순위 (토글 버튼).
	// 범위(스윕) 공격은 사거리 내 전체를 때려 단일 표적 우선순위가 무의미 → 영역 생략.
	if (!cfg.areaSweep) {
		const b = SETTINGS_PRIORITY_BTN;
		drawCellButton(b);
		ctx.fillStyle = '#fff';
		ctx.font = 'bold 13px sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(`표적: ${PRIORITY_LABELS[t.targetPriority]}`, b.x + b.w / 2, b.y + b.h / 2);
		ctx.textBaseline = 'alphabetic';
		ctx.textAlign = 'left';
	}
}

// 버튼 배경 (셀 공통) — 눌러서 토글됨이 보이도록.
function drawCellButton(cell) {
	ctx.fillStyle = '#2c3e50';
	roundRect(cell.x, cell.y, cell.w, cell.h, 6);
	ctx.fill();
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
	ctx.lineWidth = 1;
	ctx.stroke();
}

function drawGaCell(cell, type, enabled) {
	drawCellButton(cell);
	const cx = cell.x + cell.w / 2;
	const cy = cell.y + cell.h / 2;
	drawEnemySprite(type, cx, cy, 9);
	if (!enabled) drawProhibition(cx, cy, 12); // 금지 기호 덮어씌움
}

function drawProhibition(cx, cy, r) {
	ctx.strokeStyle = '#e74c3c';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.stroke();
	const d = r * Math.SQRT1_2;
	ctx.beginPath();
	ctx.moveTo(cx - d, cy + d);
	ctx.lineTo(cx + d, cy - d);
	ctx.stroke();
}

// 설정 카드 탭 처리 — 소비 시 true. 공통 우선순위 순회 / 지상·공중 토글·우선 순회.
export function handleTowerSettingsTap(t, p) {
	const cfg = TOWER_ROLES[t.role];
	if (!towerAttacks(cfg)) return false;
	if (!cfg.areaSweep && hitButton(SETTINGS_PRIORITY_BTN, p)) {
		const i = PRIORITY_CYCLE.indexOf(t.targetPriority);
		t.targetPriority = PRIORITY_CYCLE[(i + 1) % PRIORITY_CYCLE.length];
		return true;
	}
	if (towerDualCapable(cfg)) {
		if (hitButton(SETTINGS_GA.ground, p)) {
			// 최소 한 타입은 유지 (마지막 하나는 끌 수 없음)
			if (t.canGround) { if (t.canAir) t.canGround = false; } else t.canGround = true;
			return true;
		}
		if (hitButton(SETTINGS_GA.air, p)) {
			if (t.canAir) { if (t.canGround) t.canAir = false; } else t.canAir = true;
			return true;
		}
		if (!cfg.areaSweep && hitButton(SETTINGS_GA.sign, p)) {
			// 지상 > 공중 > 동등 > 지상
			t.gaPriority = t.gaPriority === 'ground' ? 'air' : t.gaPriority === 'air' ? 'equal' : 'ground';
			return true;
		}
	}
	return false;
}

function drawPromotionCard(slot, role, cost) {
	const cfg = TOWER_ROLES[role];
	const canAfford = game.gold >= cost;

	drawPanel(slot.x, slot.y, slot.w, slot.h, {
		fill: canAfford ? '#222d40' : '#1a1f28',
		stroke: canAfford ? cfg.color : '#444',
		alpha: 0.95,
	});

	drawTowerSprite(role, slot.x + 36, slot.y + slot.h / 2, { radius: 18 });

	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = '#fff';
	ctx.font = 'bold 18px sans-serif';
	ctx.fillText(cfg.name, slot.x + 68, slot.y + 32);

	ctx.fillStyle = '#bcd';
	ctx.font = '12px sans-serif';
	ctx.fillText(`사거리 ${cfg.range}  ·  데미지 ${cfg.damage}  ·  속도 ${cfg.fireRate.toFixed(1)}/s`, slot.x + 68, slot.y + 56);

	ctx.fillStyle = '#8aa';
	ctx.font = '11px sans-serif';
	ctx.fillText(cfg.tagline || '', slot.x + 68, slot.y + 74);

	ctx.textAlign = 'right';
	ctx.fillStyle = canAfford ? '#f1c40f' : '#666';
	ctx.font = 'bold 16px sans-serif';
	ctx.fillText(`${cost.toLocaleString()}G`, slot.x + slot.w - 14, slot.y + 32);
}

function drawTier4ResultCard(slot, role, cost) {
	const cfg = TOWER_ROLES[role];
	const canAfford = game.gold >= cost;

	drawPanel(slot.x, slot.y, slot.w, slot.h, {
		fill: canAfford ? '#222d40' : '#1a1f28',
		stroke: canAfford ? cfg.color : '#444',
		alpha: 0.95,
	});

	// 외관 미리보기 — 게임과 동일한 4티어 타워 그래픽 (후광 포함)
	drawTowerSprite(role, slot.x + 42, slot.y + 42, { radius: 22 });

	// 이름 + 비용
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = '#fff';
	ctx.font = 'bold 20px sans-serif';
	ctx.fillText(cfg.name, slot.x + 80, slot.y + 32);

	ctx.textAlign = 'right';
	ctx.fillStyle = canAfford ? '#f1c40f' : '#666';
	ctx.font = 'bold 16px sans-serif';
	ctx.fillText(`${cost.toLocaleString()}G`, slot.x + slot.w - 14, slot.y + 32);

	// 스탯
	ctx.textAlign = 'left';
	ctx.fillStyle = '#bcd';
	ctx.font = '12px sans-serif';
	ctx.fillText(
		`사거리 ${cfg.range}  ·  데미지 ${cfg.damage}  ·  속도 ${cfg.fireRate.toFixed(1)}/s`,
		slot.x + 80, slot.y + 54,
	);

	ctx.fillStyle = '#8aa';
	ctx.font = '11px sans-serif';
	ctx.fillText(cfg.tagline || '', slot.x + 80, slot.y + 72);

	// 구분선
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(slot.x + 14, slot.y + 92);
	ctx.lineTo(slot.x + slot.w - 14, slot.y + 92);
	ctx.stroke();

	// 상세 설명
	const lines = cfg.description || [];
	ctx.fillStyle = '#dde';
	ctx.font = '12px sans-serif';
	const lineH = 18;
	const baseY = slot.y + 112;
	for (let i = 0; i < lines.length; i++) {
		ctx.fillText('• ' + lines[i], slot.x + 16, baseY + i * lineH);
	}
}

// 현재 선택 타워가 4티어 합체 전직 분기인지
export function isTier4ChoiceContext(t) {
	return t && t.tier === 3 && game.promotionTarget
    && isCompatibleTier4Partner(game.promotionTarget, t);
}

export function drawPromotionPanel(t) {
	drawPanel(promotionPanel.x, promotionPanel.y, promotionPanel.w, promotionPanel.h, {
		radius: 12, fill: '#0f1620', stroke: '#f1c40f', alpha: 0.92,
	});

	ctx.textAlign = 'center';
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = '#f1c40f';
	ctx.font = 'bold 18px sans-serif';
	ctx.fillText('전직 가능!', promotionPanel.x + promotionPanel.w / 2, promotionPanel.y + 28);

	const tier4 = isTier4ChoiceContext(t);
	const cost = promotionCostFor(t);

	ctx.fillStyle = '#bcd';
	ctx.font = '12px sans-serif';
	if (tier4) {
		const recipe = getTier4Recipe(t);
		const fromCfg = TOWER_ROLES[t.role];
		const toCfg = TOWER_ROLES[recipe.result];
		ctx.fillText(
			`${fromCfg.name} 타워가 ${toCfg.name} 타워로 전직됩니다`,
			promotionPanel.x + promotionPanel.w / 2,
			promotionPanel.y + 48,
		);
		drawTier4ResultCard(tier4ResultCardSlot, recipe.result, cost);
	} else {
		ctx.fillText('역할을 선택하세요', promotionPanel.x + promotionPanel.w / 2, promotionPanel.y + 48);
		const promotions = TOWER_ROLES[t.role].promotions;
		for (let i = 0; i < promotions.length && i < promotionCardSlots.length; i++) {
			drawPromotionCard(promotionCardSlots[i], promotions[i], cost);
		}
	}

	drawCloseX(promotionCloseButton);
}
