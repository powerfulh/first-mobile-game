import { ctx } from './core/canvas.js';
import {
	LOGICAL_W, LOGICAL_H, TOWER, TOWER_ROLES, fusionResultFor, fusionCandidatesFor, isFusionMaterialRole,
	PATH_WIDTH, HUD_RESERVED_TOP, WAVE_END_XP_MULTIPLIER, BUFF_INTRO_KEY, GOLD, INFO_BLUE,
	TOWER_PANEL,
} from './core/config.js';
import { game, hasSeenIntro } from './state.js';
import { pointToSegmentDist, hitButton, hasItems, round1, clamp } from './core/helpers.js';
import { getActiveMap } from './core/maps.js';
import {
	applyTowerHit, fireInstantBeam, fireLineBeam, spawnZap, spawnLink,
} from './attack.js';
import { isBlockedByBarrier } from './enemy.js';
import { drawTier4Halo, drawTier5Halo, drawEnergyBall, drawTowerSprite } from './ui/sprite.js';
import { SETTINGS_GA, SETTINGS_PRIORITY_BTN } from './ui/panel.js';

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

export function canAffordPromotion(tower) {
	return game.gold >= tower.promotionCost;
}

// 삭제 환불액 — 이 타워 자체에 투입된 골드(배치비 + 자기 경로의 전직 비용 합)의 10%.
// 합체(4티어 이상)에서 소모된 재료 타워의 투입분은 포함하지 않음.
export function getTowerRefund(tower) {
	let spent = TOWER.cost;
	for (let t = 0; t < tower.tier; t++) spent += TOWER.promotionCosts[t] || 0;
	return Math.floor(spent * 0.1);
}

// ============ Tier 4 helpers ============
// tower를 지금 탭하면 합체가 완성되는 분기인지 — 지정된 재료들 + tower가 정확히 한 레시피를 이룸(같은 티어·역할 중복 없음).
export function isFusionTriggerContext(tower) {
	const mats = game.fusionMaterials;
	if (!tower || mats.length === 0 || mats.includes(tower)) return false;
	if (mats[0].tier !== tower.tier) return false;
	const roles = mats.map(m => m.role);
	if (roles.includes(tower.role)) return false;
	return fusionResultFor([...roles, tower.role]) !== null;
}

// 지정된 재료들에 tower를 재료로 더 추가할 수 있는지 — 같은 티어·역할 중복 없음·확장 가능한 부분집합.
// (완성은 isFusionTriggerContext에서 별도 처리 — 여기 도달 전에 걸러짐.)
function canJoinFusion(tower) {
	const mats = game.fusionMaterials;
	if (mats.length === 0) return true; // 첫 재료
	if (mats[0].tier !== tower.tier) return false; // 다른 합체 레벨끼리 섞지 않음
	const roles = mats.map(m => m.role);
	if (roles.includes(tower.role)) return false; // 역할 중복 불가
	return fusionCandidatesFor([...roles, tower.role]).length > 0;
}

export function hasReadyTier4Candidate() {
	// 게임 내에 XP 가득 찬 4티어 후보 3티어가 존재하는지
	for (const tower of game.entities.towers) {
		if (tower.tier === 3 && isFusionMaterialRole(tower.role) && tower.xp >= tower.xpMax) {
			return true;
		}
	}
	return false;
}

export function hasReadyTier5Candidate() {
	// 게임 내에 XP 가득 찬 5티어 후보 4티어가 존재하는지 (5티어 안내 모달 트리거)
	for (const tower of game.entities.towers) {
		if (tower.tier === 4 && isFusionMaterialRole(tower.role) && tower.xp >= tower.xpMax) {
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

// 버프 적용 사거리·데미지·공속을 모든 타워에 캐시. 타워 집합·tier·role 변경 및 리솔버 버프 시작/만료 시 호출.
// 데미지 계산이 사거리 캐시(other.range)를 읽으므로 반드시 사거리 루프 이후에.
export function recomputeStats() {
	for (const tower of game.entities.towers) tower.range = getEffectiveRange(tower);
	for (const tower of game.entities.towers) {
		tower.damage = getEffectiveDamage(tower);
		tower.fireRate = getEffectiveFireRate(tower);
	}
}

// 버프 적용 데미지 계산 (비공개) — 위치 버프(base/비콘) × 리솔버 액티브 버프. recomputeStats가 tower.damage에 캐시.
function getEffectiveDamage(tower) {
	let dmg = tower.cfg.damage;
	const buffRate = TOWER.buffRates[tower.tier];
	if (buffRate !== undefined) {
		for (const other of game.entities.towers) {
			if (other === tower) continue;
			const otherCfg = other.cfg;
			if (!otherCfg.buffsDamage) continue;
			const d = Math.hypot(tower.x - other.x, tower.y - other.y);
			if (d <= other.range) {
				dmg *= (1 + buffRate);
				break;
			}
		}
	}
	return dmg * resolverBuffMult(tower);
}

// 버프 적용 공속 계산 (비공개) — 위치 버프는 없고 리솔버 액티브 버프만 반영. recomputeStats가 tower.fireRate에 캐시.
function getEffectiveFireRate(tower) {
	return tower.cfg.fireRate * resolverBuffMult(tower);
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

// 재생 적이 회복 차단 타워(blocksRegen, 예: 염라) 사거리 내에 있는지.
export function isRegenBlocked(e) {
	for (const tower of game.entities.towers) {
		if (!tower.cfg.blocksRegen) continue;
		if (Math.hypot(e.x - tower.x, e.y - tower.y) <= tower.range) return true;
	}
	return false;
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
	if (game.gold < TOWER.cost) return false;
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
	game.gold -= TOWER.cost;
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
	ghost.x = clamp(x, TOWER.radius, LOGICAL_W - TOWER.radius);
	ghost.y = clamp(y, HUD_RESERVED_TOP + TOWER.radius, LOGICAL_H - TOWER.radius);
	ghost.range = getEffectiveRange(ghost); // 위치가 바뀌면 버프 커버 여부도 바뀌므로 재계산
}

export function promoteTower(tower, role) {
	if (!isPromotionReady(tower)) return false;
	if (!canAffordPromotion(tower)) return false;
	if (!tower.cfg.promotions.includes(role)) return false;
	const cfg = TOWER_ROLES[role];

	game.gold -= tower.promotionCost;
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

// 합체 전직 — 지정된 재료 타워들이 소모되고 triggerTower 자리에 결과 타워(다음 티어)가 생성.
export function promoteFusion(triggerTower) {
	if (!isFusionTriggerContext(triggerTower)) return false;
	const materials = game.fusionMaterials;
	if (!isPromotionReady(triggerTower)) return false;
	for (const m of materials) if (!isPromotionReady(m)) return false;
	if (!canAffordPromotion(triggerTower)) return false;

	const roles = materials.map(m => m.role);
	const resultRole = fusionResultFor([...roles, triggerTower.role]);

	game.gold -= triggerTower.promotionCost;

	// 재료 타워들 제거 (트리거는 남아서 결과로 변환)
	const consumed = new Set(materials);
	game.entities.towers = game.entities.towers.filter(x => !consumed.has(x));
	game.fusionMaterials = [];

	const prevRole = triggerTower.role;
	triggerTower.cooldown = 0;
	triggerTower.xp = 0;
	setTowerTier(triggerTower, resultRole, triggerTower.tier + 1, prevRole);
	recomputeStats();
	return true;
}

// ============ Update / Fire ============
// 리솔버 버프(공격력·공속 2배, 10초) 배수 — 미버프면 1. getEffective*가 캐시 계산 시 반영.
function resolverBuffMult(tower) {
	return tower.resolverBuff > 0 ? 2 : 1;
}

// 리솔버(5티어) — 적이 아닌 아군 타워를 겨냥한다. 사거리 내 타워 중 웨이브 누적 데미지 최고(자신·이미 버프중 제외)를
// 골라 그 타워 위치에 그 타워의 사거리만큼 스윕 데미지를 주고, 10초간 공격력·공속 2배 버프를 건다.
function updateResolver(tower) {
	const range = tower.range;
	let target = null;
	let bestWaveDamage = -1;
	for (const other of game.entities.towers) {
		if (other === tower || other.resolverBuff > 0) continue;
		if (Math.hypot(other.x - tower.x, other.y - tower.y) > range) continue;
		if (other.waveDamage > bestWaveDamage) {
			bestWaveDamage = other.waveDamage;
			target = other;
		}
	}
	if (!target) return; // 겨냥할 아군 없음 → 공격 안 함
	tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
	if (tower.cooldown > 0) return;

	// 피격 아군 기준 스윕 (그 타워의 사거리 = 스윕 범위), 리솔버 데미지
	const allowed = allowedTypesOf(tower);
	const sweepBlocked = allowed.includes('air');
	const hitRange = target.range + 10;
	const dmg = tower.damage;
	for (const e of game.entities.enemies) {
		if (e.dead) continue;
		if (!allowed.includes(e.ga)) continue;
		if (Math.hypot(e.x - target.x, e.y - target.y) > hitRange) continue;
		if (e.kind !== 'barrier' && sweepBlocked && isBlockedByBarrier(target.x, target.y, e)) continue;
		applyTowerHit(tower, e, dmg);
	}
	spawnZap(target.x, target.y, target.range, tower.cfg.color);
	spawnLink(tower.x, tower.y, target.x, target.y, '#8fd8ff'); // 리솔버→타워 에너지 연결선

	target.resolverBuff = 10; // 초
	recomputeStats(); // 대상 버프 반영 → 스탯 캐시 갱신
	tower.cooldown = 1 / tower.fireRate;
}

export function updateTower(tower, dt) {
	tower.cooldown = Math.max(0, tower.cooldown - dt);
	if (tower.resolverBuff > 0) {
		tower.resolverBuff = Math.max(0, tower.resolverBuff - dt);
		if (tower.resolverBuff === 0) recomputeStats(); // 버프 만료 → 스탯 캐시 갱신
	}

	const cfg = tower.cfg;
	if (cfg.buffsAllies) { updateResolver(tower); return; } // 리솔버는 아군을 겨냥 — 별도 경로

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
					x0: tower.x, y0: tower.y, // 발사점 (arcMissile 고도 계산용)
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
			tower.cooldown = 1 / tower.fireRate;
		}
	}
}

export function drawTower(tower) {
	const selected = (tower === game.selectedTower);
	const isTarget = game.fusionMaterials.includes(tower);

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

	if (tower.resolverBuff > 0) {
		// 리솔버 버프 표시 — 에너지 볼 하나가 타워 주변을 공전
		const a = performance.now() / 400;
		const orbitR = TOWER.radius + 6;
		drawEnergyBall(tower.x + Math.cos(a) * orbitR, tower.y + Math.sin(a) * orbitR, 4);
	}

	if (tower.tier === 4) drawTier4Halo(tower);
	else if (tower.tier === 5) drawTier5Halo(tower);
	drawTowerSprite(tower.cfg, tower.x, tower.y, { angle: tower.angle, cooldown: tower.cooldown, selected });

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
// 타워의 전직 관련 상태 — 단일 값(약속된 문자열). 드로잉(라벨·활성)·핸들링(액션)이 이것 하나로 도출.
// 'notReady'(XP부족) | 'noGold'(골드부족) | 'openChoice'(전직 선택 패널) | 'setTarget'(합체 재료 지정/추가) | 'cancelTarget'(재료 취소)
export function getPromotionState(tower) {
	if (isPromotionReady(tower) == false) return 'notReady';
	if (isFusionMaterialRole(tower.role)) {
		if (game.fusionMaterials.includes(tower)) return 'cancelTarget';
		if (!isFusionTriggerContext(tower)) return 'setTarget';
	}
	return canAffordPromotion(tower) ? 'openChoice' : 'noGold';
}

// 전직 패널에 표시할 선택지 뷰모델 — 합체 완성이면 결과 cfg 하나(tier4Cfg), 아니면 역할별 cfg 목록(cfgs).
// 역할 키 → cfg 해석을 도메인에 묶어 ui가 TOWER_ROLES를 모르게 함.
export function getPromotionChoices(tower) {
	if (isFusionTriggerContext(tower)) {
		const roles = game.fusionMaterials.map(m => m.role);
		return { tier4Cfg: TOWER_ROLES[fusionResultFor([...roles, tower.role])] };
	}
	return { cfgs: tower.cfg.promotions.map(r => TOWER_ROLES[r]) };
}

// 전직 버튼 탭 처리 — 전직 상태에 따른 액션 실행 (패널 전환 / 합체 재료 지정·추가·취소).
// 소비 시 true (호출부에서 사운드). 버튼 존재·hit 판정은 호출부(scenes)가 담당.
export function handlePromotionButton(tower) {
	switch (getPromotionState(tower)) {
		case 'openChoice':
			game.towerPanel = TOWER_PANEL.PROMOTION;
			return true;
		case 'setTarget':
			// 확장 가능하면 재료 추가, 아니면 새 합체 시작(리셋). arity 2는 재료 최대 1개라 두 분기 결과가 [tower]로 동일.
			game.fusionMaterials = canJoinFusion(tower) ? [...game.fusionMaterials, tower] : [tower];
			game.selectedTower = null;
			return true;
		case 'cancelTarget':
			game.fusionMaterials = game.fusionMaterials.filter(m => m !== tower);
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
