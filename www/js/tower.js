import { ctx } from './core/canvas.js';
import {
	LOGICAL_W, LOGICAL_H, TOWER, TOWER_ROLES, TIER4_RECIPES,
	PATH_WIDTH, HUD_RESERVED_TOP, WAVE_END_XP_MULTIPLIER, BUFF_INTRO_KEY, ACCENT_RED, GOLD, INFO_BLUE,
	TOWER_PANEL,
} from './core/config.js';
import { game, hasSeenIntro } from './state.js';
import { pointToSegmentDist, hitButton, drawPanel, hasItems, round1 } from './core/helpers.js';
import { getActiveMap } from './core/maps.js';
import {
	applyTowerHit, fireInstantBeam, fireLineBeam, spawnZap,
} from './attack.js';
import { isBlockedByBarrier } from './enemy.js';
import { drawTier4Halo } from './ui/sprite.js';
import { SETTINGS_GA, SETTINGS_PRIORITY_BTN, drawCloseX } from './ui/panel.js';
import { t } from './core/i18n.js';

// ============ Promotion / XP helpers ============
// tier 파생 스탯(목표 XP·전직 비용)을 인스턴스에 구움 — tier가 바뀌는 모든 지점에서 호출.
// tier·role 파생값을 인스턴스에 굽는다 (비공개 — setTowerTier 경유). cfg는 config 객체 참조 캐시.
function applyTierStats(tower) {
	tower.cfg = TOWER_ROLES[tower.role];
	tower.xpMax = TOWER.xpThresholds[tower.tier] || 0;
	tower.promotionCost = TOWER.promotionCosts[tower.tier] || 0;
	tower.canPromote = computeCanPromote(tower);
}

// 전직 가능 여부 (비공개). 전직 트리가 완결(모든 tier<4 역할이 다음 단계 보유)이라 현재는 tier만으로 충분.
// 소비처는 tower.canPromote 필드. 향후 5티어 등 역할별 조건이 다시 필요하면 이 함수에서 확장.
function computeCanPromote(tower) {
	return tower.tier < TOWER.maxTier;
}

// role/tier 변경 단일 진입점 — 파생 스탯(cfg 포함)을 먼저 굽고 우선순위를 초기화(순서 보장).
// prevRole 있으면 전직(능력 동일 시 설정 유지), 없으면 신규/로드/고스트 기본값.
export function setTowerTier(tower, role, tier, prevRole) {
	tower.role = role;
	tower.tier = tier;
	applyTierStats(tower);
	if (prevRole === undefined) applyTowerPriorityDefaults(tower);
	else applyTowerPriorityOnPromote(tower, prevRole);
}

function isPromotionReady(tower) {
	return tower.canPromote && (game.sandbox || tower.xp >= tower.xpMax);
}

function canAffordPromotion(tower) {
	return game.sandbox || game.gold >= tower.promotionCost;
}

// ============ Tier 4 helpers ============
function getTier4Recipe(tower) {
	return TIER4_RECIPES[tower.role] || null;
}

function isCompatibleTier4Partner(target, candidate) {
	// 두 3티어 타워가 서로의 레시피 파트너인지
	if (!target || !candidate || target === candidate) return false;
	if (target.tier !== 3 || candidate.tier !== 3) return false;
	const recipe = TIER4_RECIPES[target.role];
	return !!recipe && recipe.partner === candidate.role;
}

export function hasReadyTier4Candidate() {
	// 게임 내에 XP 가득 찬 4티어 후보 3티어가 존재하는지
	for (const tower of game.entities.towers) {
		if (tower.tier === 3 && TIER4_RECIPES[tower.role] && tower.xp >= tower.xpMax) {
			return true;
		}
	}
	return false;
}

// ============ Buff / range helpers ============
// 버프 적용 사거리 계산 (비공개) — base는 인스턴스가 아니라 config(role)에서. 결과는 recomputeStats가 tower.range에 캐시.
function getEffectiveRange(tower, visited) {
	const base = tower.cfg.range;
	visited = visited || new Set();
	if (visited.has(tower)) return base;
	visited.add(tower);
	try {
		const buffRate = TOWER.buffRates[tower.tier];
		if (buffRate === undefined) return base;
		for (const other of game.entities.towers) {
			if (other === tower) continue;
			const otherCfg = other.cfg;
			if (!otherCfg.buffsRange) continue;
			const d = Math.hypot(tower.x - other.x, tower.y - other.y);
			const otherRange = getEffectiveRange(other, visited);
			if (d <= otherRange) {
				return base * (1 + buffRate);
			}
		}
		return base;
	} finally {
		visited.delete(tower);
	}
}

// 버프 적용 사거리·데미지를 모든 타워에 캐시. 타워 집합·tier·role이 바뀔 때만 호출.
// 데미지 계산이 사거리 캐시(other.range)를 읽으므로 반드시 사거리 루프 이후에.
export function recomputeStats() {
	for (const tower of game.entities.towers) tower.range = getEffectiveRange(tower);
	for (const tower of game.entities.towers) tower.damage = getEffectiveDamage(tower);
}

// 버프 적용 데미지 계산 (비공개) — base는 config(role)에서. 결과는 recomputeStats가 tower.damage에 캐시.
function getEffectiveDamage(tower) {
	const base = tower.cfg.damage;
	const buffRate = TOWER.buffRates[tower.tier];
	if (buffRate === undefined) return base;
	for (const other of game.entities.towers) {
		if (other === tower) continue;
		const otherCfg = other.cfg;
		if (!otherCfg.buffsDamage) continue;
		const d = Math.hypot(tower.x - other.x, tower.y - other.y);
		if (d <= other.range) {
			return base * (1 + buffRate);
		}
	}
	return base;
}

function getXpGainAtWaveEnd(tower) {
	for (const other of game.entities.towers) {
		if (other === tower) continue;
		const otherCfg = other.cfg;
		if (!otherCfg.boostsXp) continue;
		const d = Math.hypot(tower.x - other.x, tower.y - other.y);
		if (d <= other.range) {
			return WAVE_END_XP_MULTIPLIER;
		}
	}
	return 1;
}

// 웨이브 종료 보상 — 승급 가능한 모든 타워에 XP 지급 (배이스/비콘 근처면 버프 배수 반영).
// 일반 배치 종료 시점과 병렬 웨이브 추가 호출 시점에서 공통 사용.
export function grantWaveEndXp() {
	for (const tower of game.entities.towers) {
		if (!tower.canPromote) continue;
		const gain = getXpGainAtWaveEnd(tower);
		tower.xp = Math.min(round1(tower.xp + gain), tower.xpMax);
	}
}

export function getEnemySpeedFactor(e) {
	let factor = 1;
	for (const tower of game.entities.towers) {
		const cfg = tower.cfg;
		if (!cfg.slowsEnemies) continue;
		const range = tower.range;
		const d = Math.hypot(e.x - tower.x, e.y - tower.y);
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
function applyTowerPriorityDefaults(tower) {
	const cfg = tower.cfg;
	const types = cfg.attackTypes || [];
	tower.canGround = types.includes('ground');
	tower.canAir = types.includes('air');
	tower.gaPriority = (tower.canGround && tower.canAir) ? 'air' : 'equal';
	tower.targetPriority = cfg.targetMode === 'highestHp' ? 'strongest' : 'closest';
}

export function allowedTypesOf(tower) {
	const types = [];
	if (tower.canGround) types.push('ground');
	if (tower.canAir) types.push('air');
	return types;
}

function gaCapsOf(cfg) {
	const types = cfg.attackTypes || [];
	return (types.includes('ground') ? 'G' : '') + (types.includes('air') ? 'A' : '');
}

// 전직 시: 지상/공중 가능 여부가 그대로이고 새 역할에 지정 기본값(targetMode)이 없으면
// 기존 우선순위 설정 유지, 아니면 새 역할 기준 기본값으로 리셋.
function applyTowerPriorityOnPromote(tower, oldRole) {
	const newCfg = tower.cfg;
	const sameCaps = gaCapsOf(TOWER_ROLES[oldRole]) === gaCapsOf(newCfg);
	if (sameCaps && !newCfg.targetMode) return;
	applyTowerPriorityDefaults(tower);
}

// ============ Placement ============
// 점→폴리라인 최단거리 (poly 없으면 Infinity). 배치 겹침 판정용.
function distanceToPolyline(x, y, poly) {
	if (!poly) return Infinity;
	let min = Infinity;
	for (let i = 0; i < poly.length - 1; i++) {
		const d = pointToSegmentDist(x, y, poly[i].x, poly[i].y, poly[i + 1].x, poly[i + 1].y);
		if (d < min) min = d;
	}
	return min;
}
const distanceToPath = (x, y) => distanceToPolyline(x, y, getActiveMap().path);
// 지름길(airShortcutCut)까지 최단 거리 — 없으면 Infinity. 배치 판정은 정규 경로보다 완화.
const distanceToShortcut = (x, y) => distanceToPolyline(x, y, getActiveMap().airShortcutCut);

export function canPlaceTower(x, y) {
	if (!game.sandbox && game.gold < TOWER.cost) return false;
	if (y < HUD_RESERVED_TOP + TOWER.radius) return false;
	if (x < TOWER.radius || x > LOGICAL_W - TOWER.radius) return false;
	if (y > LOGICAL_H - TOWER.radius) return false;
	if (distanceToPath(x, y) < PATH_WIDTH / 2 + TOWER.radius + 2) return false;
	// 지름길은 얇고 공중 전용이라 완화 — 살짝 겹침까지 허용 (정규 경로보다 느슨)
	if (distanceToShortcut(x, y) < TOWER.radius + 3) return false;
	for (const tower of game.entities.towers) {
		if (Math.hypot(x - tower.x, y - tower.y) < TOWER.radius * 2 + 4) return false;
	}
	return true;
}

export function placeTower(x, y) {
	if (!canPlaceTower(x, y)) return false;
	const tw = {
		x, y,
		cooldown: 0,
		angle: 0,
		xp: 0,
		totalDamage: 0,
		waveDamage: 0,
	};
	setTowerTier(tw, 'novice', 0);
	game.entities.towers.push(tw);
	recomputeStats();
	if (!game.sandbox) game.gold -= TOWER.cost;
	return true;
}

// 2단계 배치 고스트 — novice 미리보기. 사거리는 현재 위치 기준 버프 반영(getEffectiveRange)으로 즉시 갱신.
export function createGhostTower(x, y) {
	const ghost = { x, y, dragging: true };
	setTowerTier(ghost, 'novice', 0); // cfg·파생값 세팅 → getEffectiveRange가 ghost.cfg 사용
	ghost.range = getEffectiveRange(ghost);
	game.ghostTower = ghost;
}

export function moveGhostTower(x, y) {
	const ghost = game.ghostTower;
	if (!ghost || !ghost.dragging) return;
	ghost.x = Math.max(TOWER.radius, Math.min(LOGICAL_W - TOWER.radius, x));
	ghost.y = Math.max(HUD_RESERVED_TOP + TOWER.radius, Math.min(LOGICAL_H - TOWER.radius, y));
	ghost.range = getEffectiveRange(ghost); // 위치가 바뀌면 버프 커버 여부도 바뀌므로 재계산
}

export function promoteTower(tower, role) {
	if (!isPromotionReady(tower)) return false;
	if (!canAffordPromotion(tower)) return false;
	if (!tower.cfg.promotions.includes(role)) return false;
	const cfg = TOWER_ROLES[role];
	if (!cfg) return false;

	if (!game.sandbox) game.gold -= tower.promotionCost;
	const prevRole = tower.role;
	tower.cooldown = 0;
	tower.xp = 0;
	setTowerTier(tower, role, tower.tier + 1, prevRole);
	recomputeStats();

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
	const cost = secondTower.promotionCost;
	if (!game.sandbox && game.gold < cost) return false;

	const recipe = TIER4_RECIPES[secondTower.role];
	const resultRole = recipe.result;
	const cfg = TOWER_ROLES[resultRole];
	if (!cfg) return false;

	if (!game.sandbox) game.gold -= cost;

	// 대상 타워 제거
	game.entities.towers = game.entities.towers.filter(x => x !== target);
	game.promotionTarget = null;

	// 두 번째 타워 자리에 4티어로 변환
	const prevRole = secondTower.role;
	secondTower.cooldown = 0;
	secondTower.xp = 0;
	setTowerTier(secondTower, resultRole, 4, prevRole);
	recomputeStats();
	return true;
}

// ============ Update / Fire ============
export function updateTower(tower, dt) {
	tower.cooldown = Math.max(0, tower.cooldown - dt);

	const cfg = tower.cfg;
	const allowed = allowedTypesOf(tower);
	const range = tower.range;

	// 영향권 진입 시 XP 부여 (데몬류 비공격 타워의 수급 수단)
	if (cfg.gainsXpOnEnemyEnter) {
		if (!tower.inRangeEnemies) tower.inRangeEnemies = new Set();
		const next = new Set();
		for (const e of game.entities.enemies) {
			if (e.dead) continue;
			const d = Math.hypot(e.x - tower.x, e.y - tower.y);
			if (d > range) continue;
			next.add(e);
			if (!tower.inRangeEnemies.has(e) && tower.canPromote) {
				tower.xp = Math.min(tower.xpMax, round1(tower.xp + 1));
			}
		}
		tower.inRangeEnemies = next;
	}

	// areaSweep은 자기 사거리 내만 처리 (마킹 풀 무시). 그 외 모든 단일 타겟 타워는 마킹 적 포함.
	const includeMarked = !cfg.areaSweep;
	const minRange = cfg.minRange || 0;

	// 단일 타워의 타게팅에서는 장벽 차단 검사 안 함 — 조준은 정상,
	// 발사된 빔/투사체가 장벽에 막혀 장벽이 대신 데미지 받음.
	// 표적 선정: 지상/공중 우선(1순위) → 공통 우선순위(2순위)
	let target = null;
	{
		const useHp = (tower.targetPriority === 'strongest' || tower.targetPriority === 'weakest');
		const preferHigher = (tower.targetPriority === 'farthest' || tower.targetPriority === 'strongest');
		let bestTier = Infinity;
		let bestVal = 0;
		for (const e of game.entities.enemies) {
			if (e.dead) continue;
			if (e.kind === 'barrier') continue;
			if (e.ga === 'ground' ? !tower.canGround : !tower.canAir) continue;
			const d = Math.hypot(e.x - tower.x, e.y - tower.y);
			if (d < minRange) continue;
			if (d > range && !(includeMarked && e.marked)) continue;
			// 지상/공중 티어 (낮을수록 우선). 동등이면 모두 0.
			let tier = 0;
			if (tower.gaPriority === 'air') tier = (e.ga === 'air') ? 0 : 1;
			else if (tower.gaPriority === 'ground') tier = (e.ga === 'ground') ? 0 : 1;
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
		tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
		if (tower.cooldown <= 0) {
			const damage = tower.damage;
			if (cfg.areaSweep) {
				// 트랩: 사거리 내 모든 유효 적에 즉시 데미지 (+10 buffer)
				// areaSweep은 광선 형태라 장벽이 적을 가려주는 효과 유지 (장벽 자체는 데미지 받음)
				const hitRange = range + 10;
				const sweepBlocked = allowed.includes('air');
				for (const e of game.entities.enemies) {
					if (e.dead) continue;
					if (!allowed.includes(e.ga)) continue;
					const d = Math.hypot(e.x - tower.x, e.y - tower.y);
					if (d > hitRange) continue;
					if (e.kind !== 'barrier' && sweepBlocked && isBlockedByBarrier(tower.x, tower.y, e)) continue;
					applyTowerHit(tower, e, damage);
				}
				spawnZap(tower.x, tower.y, range, cfg.color);
			} else if (cfg.instantHit) {
				if (cfg.pierces) {
					fireLineBeam(tower, target, damage);
				} else {
					fireInstantBeam(tower, target, damage);
				}
			} else if (cfg.fanShot) {
				const count = cfg.projectileCount || 5;
				const spreadRad = (cfg.spreadDeg || 32) * Math.PI / 180;
				const half = spreadRad / 2;
				const step = count > 1 ? spreadRad / (count - 1) : 0;
				for (let i = 0; i < count; i++) {
					const angle = tower.angle - half + step * i;
					game.entities.projectiles.push({
						x: tower.x,
						y: tower.y,
						vx: Math.cos(angle) * TOWER.projectileSpeed,
						vy: Math.sin(angle) * TOWER.projectileSpeed,
						damage,
						shooter: tower,
						splash: cfg.splash || 0,
						splashColor: cfg.color,
						attackTypes: allowed,
						straightMode: true,
					});
				}
			} else if (cfg.scatterDeg) {
				// 매 발사마다 projectileCount발, 각 발은 tower.angle에 ±scatterDeg/2 난수
				const count = cfg.projectileCount || 1;
				const scatterRad = cfg.scatterDeg * Math.PI / 180;
				for (let i = 0; i < count; i++) {
					const angle = tower.angle + (Math.random() - 0.5) * scatterRad;
					game.entities.projectiles.push({
						x: tower.x,
						y: tower.y,
						vx: Math.cos(angle) * TOWER.projectileSpeed,
						vy: Math.sin(angle) * TOWER.projectileSpeed,
						damage,
						shooter: tower,
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
				const dx = tx - tower.x;
				const dy = ty - tower.y;
				const dist = Math.hypot(dx, dy) || 1;
				const speed = cfg.projectileSpeed || TOWER.projectileSpeed;
				game.entities.projectiles.push({
					x: tower.x,
					y: tower.y,
					vx: (dx / dist) * speed,
					vy: (dy / dist) * speed,
					tx, ty,
					damage,
					shooter: tower,
					splash: cfg.splash || 0,
					splashColor: cfg.color,
					attackTypes: allowed,
					ballisticMode: true,
				});
			} else {
				game.entities.projectiles.push({
					x: tower.x,
					y: tower.y,
					target: target,
					damage,
					speed: cfg.projectileSpeed || TOWER.projectileSpeed,
					shooter: tower,
					splash: cfg.splash || 0,
					splashColor: cfg.color,
					attackTypes: allowed,
				});
			}
			tower.cooldown = 1 / cfg.fireRate;
		}
	}
}

// ============ Draw — 본체 ============
// 본체 선택 테두리 스타일 — 선택 시 흰색 굵게, 평소 cfg.color2. stroke()/strokeRect()는 호출부에서.
function applyBodyStrokeStyle(selected, color) {
	ctx.strokeStyle = selected ? '#fff' : color;
	ctx.lineWidth = selected ? 3 : 2;
}

function drawCannonBody(tower, selected) {
	const cfg = tower.cfg;
	ctx.fillStyle = cfg.color;
	ctx.beginPath();
	ctx.arc(tower.x, tower.y, TOWER.radius, 0, Math.PI * 2);
	ctx.fill();
	applyBodyStrokeStyle(selected, cfg.color2);
	ctx.stroke();

	ctx.save();
	ctx.translate(tower.x, tower.y);
	ctx.rotate(tower.angle);
	ctx.fillStyle = cfg.color2;
	ctx.fillRect(0, -3, TOWER.radius + 4, 6);
	ctx.restore();
}

function drawBeamEmitterBody(tower, selected) {
	const cfg = tower.cfg;
	const r = TOWER.radius;
	ctx.fillStyle = cfg.color;
	ctx.beginPath();
	for (let i = 0; i < 6; i++) {
		const a = i * Math.PI / 3 - Math.PI / 2;
		const px = tower.x + r * Math.cos(a);
		const py = tower.y + r * Math.sin(a);
		if (i === 0) ctx.moveTo(px, py);
		else ctx.lineTo(px, py);
	}
	ctx.closePath();
	ctx.fill();
	applyBodyStrokeStyle(selected, cfg.color2);
	ctx.stroke();

	const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 350);
	ctx.fillStyle = '#fff';
	ctx.globalAlpha = 0.4 + 0.25 * pulse;
	ctx.beginPath();
	ctx.arc(tower.x, tower.y, r * 0.42, 0, Math.PI * 2);
	ctx.fill();
	ctx.globalAlpha = 1;
}

function drawAreaSweepBody(tower, selected) {
	const cfg = tower.cfg;
	const r = TOWER.radius;
	ctx.fillStyle = cfg.color;
	ctx.beginPath();
	ctx.moveTo(tower.x, tower.y - r);
	ctx.lineTo(tower.x + r, tower.y);
	ctx.lineTo(tower.x, tower.y + r);
	ctx.lineTo(tower.x - r, tower.y);
	ctx.closePath();
	ctx.fill();
	applyBodyStrokeStyle(selected, cfg.color2);
	ctx.stroke();

	ctx.fillStyle = '#fff';
	ctx.globalAlpha = 0.55;
	ctx.beginPath();
	ctx.arc(tower.x, tower.y, 3, 0, Math.PI * 2);
	ctx.fill();
	ctx.globalAlpha = 1;
}

function drawSupportBody(tower, selected) {
	const cfg = tower.cfg;
	const r = TOWER.radius;
	ctx.fillStyle = cfg.color;
	ctx.beginPath();
	for (let i = 0; i < 8; i++) {
		const a = i * Math.PI / 4 + Math.PI / 8;
		const px = tower.x + r * Math.cos(a);
		const py = tower.y + r * Math.sin(a);
		if (i === 0) ctx.moveTo(px, py);
		else ctx.lineTo(px, py);
	}
	ctx.closePath();
	ctx.fill();
	applyBodyStrokeStyle(selected, cfg.color2);
	ctx.stroke();

	// 배럴 (공격 가능 시)
	if (hasItems(cfg.attackTypes)) {
		ctx.save();
		ctx.translate(tower.x, tower.y);
		ctx.rotate(tower.angle);
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
	ctx.arc(tower.x, tower.y, r + 7, 0, Math.PI * 2);
	ctx.stroke();

	// 두 번째 링 — 비콘 전용
	if (cfg.buffsDamage) {
		const pulse2 = 0.5 + 0.5 * Math.sin(performance.now() / 700 + Math.PI);
		ctx.globalAlpha = 0.35 + 0.3 * pulse2;
		ctx.beginPath();
		ctx.arc(tower.x, tower.y, r + 12, 0, Math.PI * 2);
		ctx.stroke();
	}

	ctx.setLineDash([]);
	ctx.globalAlpha = 1;
}

function drawGatlingBody(tower, selected) {
	const cfg = tower.cfg;
	const r = TOWER.radius;

	// 본체 원
	ctx.fillStyle = cfg.color;
	ctx.beginPath();
	ctx.arc(tower.x, tower.y, r, 0, Math.PI * 2);
	ctx.fill();
	applyBodyStrokeStyle(selected, cfg.color2);
	ctx.stroke();

	// 다발 배럴 (3개 평행, tower.angle 방향)
	ctx.save();
	ctx.translate(tower.x, tower.y);
	ctx.rotate(tower.angle);

	// 발사 직후 짧은 반동 (cooldown 마지막 30%)
	const interval = 1 / cfg.fireRate;
	const recoiling = tower.cooldown > interval * 0.7;
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
	ctx.arc(tower.x, tower.y, 2, 0, Math.PI * 2);
	ctx.fill();
}

function drawAssassinBody(tower, selected) {
	const cfg = tower.cfg;
	const r = TOWER.radius;
	const time = performance.now();

	// 본체 — 칼날 다이아몬드 (다른 타워와 비슷한 크기)
	ctx.save();
	ctx.translate(tower.x, tower.y);
	ctx.rotate(tower.angle);

	ctx.fillStyle = cfg.color;
	ctx.beginPath();
	ctx.moveTo(r + 2, 0);          // 앞 (날카롭게 뻗음)
	ctx.lineTo(0, -r * 0.9);
	ctx.lineTo(-r * 0.9, 0);
	ctx.lineTo(0, r * 0.9);
	ctx.closePath();
	ctx.fill();
	applyBodyStrokeStyle(selected, cfg.color2);
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

function drawSiloBody(tower, selected) {
	const cfg = tower.cfg;
	const r = TOWER.radius;
	const x = tower.x - r;
	const y = tower.y - r;
	const w = r * 2;

	// 본체 - 사각형 격납고
	ctx.fillStyle = cfg.color;
	ctx.fillRect(x, y, w, w);
	applyBodyStrokeStyle(selected, cfg.color2);
	ctx.strokeRect(x, y, w, w);

	// 격납고 도어 분할 라인 (십자)
	ctx.strokeStyle = cfg.color2;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(x, tower.y);
	ctx.lineTo(x + w, tower.y);
	ctx.moveTo(tower.x, y);
	ctx.lineTo(tower.x, y + w);
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
	const ready = tower.cooldown < (1 / cfg.fireRate) * 0.7;
	if (ready) {
		ctx.save();
		ctx.translate(tower.x, tower.y);
		ctx.rotate(tower.angle);

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
		ctx.fillStyle = ACCENT_RED;
		ctx.beginPath();
		ctx.arc(5, 0, 1.2, 0, Math.PI * 2);
		ctx.fill();

		ctx.restore();
	}

	// 좌상단 작동 LED (깜빡임)
	const blink = (performance.now() % 900) < 450;
	ctx.fillStyle = blink ? GOLD : 'rgba(241, 196, 15, 0.25)';
	ctx.beginPath();
	ctx.arc(x + 3, y + 3, 1.6, 0, Math.PI * 2);
	ctx.fill();
}

function drawRadarAntenna(tower) {
	// 회전 안테나(디시) — 본체 위에 별도 디시 + sweeping 빔
	const sweep = (performance.now() / 600) % (Math.PI * 2);
	ctx.save();
	ctx.translate(tower.x, tower.y);
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
function drawTowerBody(tower, selected) {
	const cfg = tower.cfg;
	if (tower.tier === 4) drawTier4Halo(tower);

	if (cfg.disablesModifiers) {
		drawAssassinBody(tower, selected);
	} else if (cfg.scatterDeg) {
		drawGatlingBody(tower, selected);
	} else if (cfg.instantHit) {
		drawBeamEmitterBody(tower, selected);
	} else if (cfg.buffsRange) {
		drawSupportBody(tower, selected);
	} else if (cfg.areaSweep) {
		drawAreaSweepBody(tower, selected);
	} else if (cfg.ballistic) {
		drawSiloBody(tower, selected);
	} else {
		drawCannonBody(tower, selected);
	}

	if (cfg.marksEnemies) drawRadarAntenna(tower);
}

// 게임 밖(위키 등)에서 타워 외형을 그릴 때 사용. (cx, cy) 중심·게임과 동일 크기.
// 합성 타워 객체를 만들어 drawTowerBody를 재사용 — 외형 정의는 한 곳뿐.
export function drawTowerSprite(role, cx, cy, opts = {}) {
	const cfg = TOWER_ROLES[role];
	if (!cfg) return;
	const isTier4 = !!cfg.recipe;
	const tower = {
		x: 0, y: 0, role, cfg, // 원점에 그린 뒤 translate/scale로 배치
		tier: isTier4 ? 4 : 1,
		angle: opts.angle ?? -Math.PI / 2, // 기본: 위쪽을 향함
		cooldown: 0,
	};
	// 본체는 TOWER.radius 기준으로 그려짐 → 원하는 반지름이면 비율만큼 확대/축소.
	const scale = (opts.radius || TOWER.radius) / TOWER.radius;
	ctx.save();
	ctx.translate(cx, cy);
	if (scale !== 1) ctx.scale(scale, scale);
	drawTowerBody(tower, false);
	ctx.restore();
}

export function drawTower(tower) {
	const selected = (tower === game.selectedTower);
	const isTarget = (tower === game.promotionTarget);

	if (isPromotionReady(tower)) {
		const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
		ctx.globalAlpha = 0.35 + 0.45 * pulse;
		ctx.strokeStyle = isTarget ? '#1abc9c' : GOLD;
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.arc(tower.x, tower.y, TOWER.radius + 5, 0, Math.PI * 2);
		ctx.stroke();
		ctx.globalAlpha = 1;
	}

	drawTowerBody(tower, selected);

	if (tower.canPromote) {
		const xpMax = tower.xpMax;
		const ratio = xpMax > 0 ? tower.xp / xpMax : 0;
		const bw = 24, bh = 3;
		const bx = tower.x - bw / 2;
		const by = tower.y + TOWER.radius + 5;
		ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
		ctx.fillRect(bx, by, bw, bh);
		ctx.fillStyle = ratio >= 1 ? GOLD : INFO_BLUE;
		ctx.fillRect(bx, by, bw * ratio, bh);
	}
}

// ============ Tower info panel / Promotion panel ============
export const promotionPanel = { x: 16, y: 376, w: 328, h: 248 };
export const promotionCloseButton = { x: 308, y: 384, w: 28, h: 28 };
export const promotionCardSlots = [
	{ x: 24, y: 432, w: 312, h: 84 },
	{ x: 24, y: 526, w: 312, h: 84 },
];
// 4티어 결과 카드 — 단일 카드라 영역 전체를 채움
export const tier4ResultCardSlot = { x: 24, y: 432, w: 312, h: 178 };

// 타워의 전직 관련 상태 — 단일 값(약속된 문자열). 드로잉(라벨·활성)·핸들링(액션)이 이것 하나로 도출.
// 'notReady'(XP부족) | 'noGold'(골드부족) | 'openChoice'(전직 선택 패널) | 'setTarget'(4티어 대상 지정) | 'cancelTarget'(대상 취소)
export function getPromotionState(tower) {
	if (isPromotionReady(tower) == false) return 'notReady';
	if (tower.tier === 3) {
		if (tower === game.promotionTarget) return 'cancelTarget';
		if (game.promotionTarget && isCompatibleTier4Partner(game.promotionTarget, tower)) {
			const afford = game.sandbox || game.gold >= tower.promotionCost;
			return afford ? 'openChoice' : 'noGold';
		}
		return 'setTarget';
	}
	return canAffordPromotion(tower) ? 'openChoice' : 'noGold';
}

// 전직 버튼 탭 처리 — 전직 상태에 따른 액션 실행 (패널 전환 / 4티어 대상 지정·취소).
// 소비 시 true (호출부에서 사운드). 버튼 존재·hit 판정은 호출부(scenes)가 담당.
export function handlePromotionButton(tower) {
	switch (getPromotionState(tower)) {
		case 'openChoice':
			game.towerPanel = TOWER_PANEL.PROMOTION;
			return true;
		case 'setTarget':
			game.promotionTarget = tower;
			game.selectedTower = null;
			return true;
		case 'cancelTarget':
			game.promotionTarget = null;
			return true;
		default:
			return false; // notReady, noGold
	}
}

// ---- 설정 카드 우선순위 컨트롤 ----
const PRIORITY_CYCLE = ['closest', 'farthest', 'strongest', 'weakest'];

export function towerDualCapable(cfg) {
	const types = cfg.attackTypes || [];
	return types.includes('ground') && types.includes('air');
}

// 설정 카드 탭 처리 — 소비 시 true. 공통 우선순위 순회 / 지상·공중 토글·우선 순회.
export function handleTowerSettingsTap(tower, p) {
	const cfg = tower.cfg;
	if (!hasItems(cfg.attackTypes)) return false;
	if (!cfg.areaSweep && hitButton(SETTINGS_PRIORITY_BTN, p)) {
		const i = PRIORITY_CYCLE.indexOf(tower.targetPriority);
		tower.targetPriority = PRIORITY_CYCLE[(i + 1) % PRIORITY_CYCLE.length];
		return true;
	}
	if (towerDualCapable(cfg)) {
		if (hitButton(SETTINGS_GA.ground, p)) {
			// 최소 한 타입은 유지 (마지막 하나는 끌 수 없음)
			if (tower.canGround) { if (tower.canAir) tower.canGround = false; } else tower.canGround = true;
			return true;
		}
		if (hitButton(SETTINGS_GA.air, p)) {
			if (tower.canAir) { if (tower.canGround) tower.canAir = false; } else tower.canAir = true;
			return true;
		}
		if (!cfg.areaSweep && hitButton(SETTINGS_GA.sign, p)) {
			// 지상 > 공중 > 동등 > 지상
			tower.gaPriority = tower.gaPriority === 'ground' ? 'air' : tower.gaPriority === 'air' ? 'equal' : 'ground';
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
	ctx.fillText(t('사거리 {range}  ·  데미지 {dmg}  ·  속도 {rate}/s', { range: cfg.range, dmg: cfg.damage, rate: cfg.fireRate.toFixed(1) }), slot.x + 68, slot.y + 56);

	ctx.fillStyle = '#8aa';
	ctx.font = '11px sans-serif';
	ctx.fillText(cfg.tagline || '', slot.x + 68, slot.y + 74);

	ctx.textAlign = 'right';
	ctx.fillStyle = canAfford ? GOLD : '#666';
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
	ctx.fillStyle = canAfford ? GOLD : '#666';
	ctx.font = 'bold 16px sans-serif';
	ctx.fillText(`${cost.toLocaleString()}G`, slot.x + slot.w - 14, slot.y + 32);

	// 스탯
	ctx.textAlign = 'left';
	ctx.fillStyle = '#bcd';
	ctx.font = '12px sans-serif';
	ctx.fillText(
		t('사거리 {range}  ·  데미지 {dmg}  ·  속도 {rate}/s', { range: cfg.range, dmg: cfg.damage, rate: cfg.fireRate.toFixed(1) }),
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
export function isTier4ChoiceContext(tower) {
	return tower && tower.tier === 3 && game.promotionTarget
    && isCompatibleTier4Partner(game.promotionTarget, tower);
}

export function drawPromotionPanel(tower) {
	drawPanel(promotionPanel.x, promotionPanel.y, promotionPanel.w, promotionPanel.h, {
		radius: 12, fill: '#0f1620', stroke: GOLD, alpha: 0.92,
	});

	ctx.textAlign = 'center';
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = GOLD;
	ctx.font = 'bold 18px sans-serif';
	ctx.fillText(t('전직 가능!'), promotionPanel.x + promotionPanel.w / 2, promotionPanel.y + 28);

	const tier4 = isTier4ChoiceContext(tower);
	const cost = tower.promotionCost;

	ctx.fillStyle = '#bcd';
	ctx.font = '12px sans-serif';
	if (tier4) {
		const recipe = getTier4Recipe(tower);
		const fromCfg = tower.cfg;
		const toCfg = TOWER_ROLES[recipe.result];
		ctx.fillText(
			t('{from} 타워가 {to} 타워로 전직됩니다', { from: fromCfg.name, to: toCfg.name }),
			promotionPanel.x + promotionPanel.w / 2,
			promotionPanel.y + 48,
		);
		drawTier4ResultCard(tier4ResultCardSlot, recipe.result, cost);
	} else {
		ctx.fillText(t('역할을 선택하세요'), promotionPanel.x + promotionPanel.w / 2, promotionPanel.y + 48);
		const promotions = tower.cfg.promotions;
		for (let i = 0; i < promotions.length && i < promotionCardSlots.length; i++) {
			drawPromotionCard(promotionCardSlots[i], promotions[i], cost);
		}
	}

	drawCloseX(promotionCloseButton);
}
