import { ctx } from './canvas.js';
import { LOGICAL_W, LOGICAL_H, TOWER_ROLES, ENEMY_KILL_REWARD } from './config.js';
import { game } from './state.js';
import { pointToSegmentDist } from './helpers.js';
import {
	canPromote, xpMaxFor, getEffectiveRange, allowedTypesOf,
} from './tower.js';
import {
	getBossReward, startBarrierSpawn,
	findBarrierBlockDist, projectileHitsBarrier,
} from './enemy.js';

export function applyTowerHit(shooter, target, damage) {
	if (!target || target.dead) return;
	// Wave 51~70: 1.1 → 3.0으로 매 웨이브 +0.1 (등장 초반 약하게, Wave 70에 3.0 도달 후 고정)
	// Wave 131~150: 추가로 매 웨이브 +0.1 (누적 +2.0, Wave 150에서 -5.0 상한)
	const shieldReduction = Math.min(3, 1 + Math.max(0, game.wave - 50) * 0.1)
    + Math.min(2, Math.max(0, game.wave - 130) * 0.1);
	const effective = target.shielded ? Math.max(0, damage - shieldReduction) : damage;
	const hpBefore = target.hp;
	const dealt = Math.min(effective, hpBefore);
	const xpGain = Math.min(damage, hpBefore); // XP는 방어막 감소 무시
	target.hp -= effective;
	if (shooter) {
		shooter.totalDamage = Math.round(((shooter.totalDamage || 0) + dealt) * 10) / 10;
		shooter.waveDamage = Math.round(((shooter.waveDamage || 0) + dealt) * 10) / 10;
		if (canPromote(shooter)) {
			const next = Math.round((shooter.xp + xpGain) * 10) / 10;
			shooter.xp = Math.min(next, xpMaxFor(shooter));
		}
		const shooterCfg = TOWER_ROLES[shooter.role];
		if (shooterCfg && !target.dead) {
			if (shooterCfg.marksEnemies) {
				target.marked = true;
			}
			if (shooterCfg.disablesModifiers) {
				target.shielded = false;
			}
		}
	}
	if (target.hp <= 0) {
		target.dead = true;
		if (target.isBoss) {
			game.gold += getBossReward(game.wave);
		} else if (target.isBarrier) {
			// 장벽은 보상 없음
		} else if (!game.bossActive) {
			game.gold += ENEMY_KILL_REWARD;
		}
		// 장벽 적 처치 시 그 자리에 장벽 생성 (짧은 애니메이션 후)
		if (target.barrierSpawner) {
			startBarrierSpawn(target.x, target.y);
		}
	}
}

export function applySplashHit(shooter, impactX, impactY, damage, radius, attackTypes) {
	for (const e of game.enemies) {
		if (e.dead) continue;
		if (attackTypes && !attackTypes.includes(e.type)) continue;
		const d = Math.hypot(e.x - impactX, e.y - impactY);
		if (d <= radius) {
			applyTowerHit(shooter, e, damage);
		}
	}
}

export function fireInstantBeam(t, target, damage) {
	const cfg = TOWER_ROLES[t.role];
	const dmg = damage !== undefined ? damage : t.damage;
	const attackTypes = allowedTypesOf(t); // 인스턴스 토글(canGround/canAir) 반영
	// 공중 공격일 때만 장벽 차단. 지상 전용 빔은 통과.
	const canBeBlocked = attackTypes.includes('air');
	let blocker = null;
	if (canBeBlocked) {
		blocker = projectileHitsBarrier(t.x, t.y, target.x, target.y);
	}
	if (blocker) {
		game.beams.push({
			x1: t.x, y1: t.y,
			x2: blocker.x, y2: blocker.y,
			life: 0.15, maxLife: 0.15,
			color: cfg.color,
		});
		applyTowerHit(t, blocker.barrier, dmg);
	} else {
		game.beams.push({
			x1: t.x, y1: t.y,
			x2: target.x, y2: target.y,
			life: 0.15, maxLife: 0.15,
			color: cfg.color,
		});
		applyTowerHit(t, target, dmg);
	}
}

export function fireLineBeam(t, target, damage) {
	const cfg = TOWER_ROLES[t.role];
	const range = getEffectiveRange(t);
	const angle = Math.atan2(target.y - t.y, target.x - t.x);
	// 사거리 외 마킹 적도 타깃이 될 수 있으니 빔은 target 위치까지 확장
	const targetDist = Math.hypot(target.x - t.x, target.y - t.y);
	let beamLen = Math.max(range, targetDist);

	const attackTypes = allowedTypesOf(t); // 인스턴스 토글(canGround/canAir) 반영
	// 공중 공격은 target에 상관없이 장벽에서 빔이 짤림 (지상 전용은 통과)
	if (attackTypes.includes('air')) {
		const blockDist = findBarrierBlockDist(t.x, t.y, angle, beamLen, null);
		if (blockDist !== null) beamLen = blockDist;
	}

	const endX = t.x + Math.cos(angle) * beamLen;
	const endY = t.y + Math.sin(angle) * beamLen;

	game.beams.push({
		x1: t.x, y1: t.y,
		x2: endX, y2: endY,
		life: 0.2,
		maxLife: 0.2,
		color: cfg.color,
	});

	const dmg = damage !== undefined ? damage : t.damage;
	for (const e of game.enemies) {
		if (e.dead) continue;
		if (!attackTypes.includes(e.type)) continue;
		const d = pointToSegmentDist(e.x, e.y, t.x, t.y, endX, endY);
		if (d <= e.radius) {
			applyTowerHit(t, e, dmg);
		}
	}
}

// 투사체가 (oldX,oldY) → (newX,newY) 이동 중 장벽 진입점을 만나면 거기서 폭발/타격.
// 공중 공격(attackTypes 'air' 포함)일 때만 막힘. 지상 전용 투사체는 장벽 통과.
function handleBarrierBlock(p, oldX, oldY, newX, newY) {
	if (!p.attackTypes || !p.attackTypes.includes('air')) return false;
	const hit = projectileHitsBarrier(oldX, oldY, newX, newY);
	if (!hit) return false;
	if (p.splash > 0) {
		applySplashHit(p.shooter, hit.x, hit.y, p.damage, p.splash, p.attackTypes);
		game.splashes.push({
			x: hit.x, y: hit.y,
			radius: p.splash,
			life: 0.3, maxLife: 0.3,
			color: p.splashColor || '#fff',
		});
		// splash 반경 안에 장벽 중심이 안 들어오는 경우만 단발 데미지 보장 (중복 방지)
		const dToBarrier = Math.hypot(hit.barrier.x - hit.x, hit.barrier.y - hit.y);
		if (dToBarrier > p.splash) {
			applyTowerHit(p.shooter, hit.barrier, p.damage);
		}
	} else {
		applyTowerHit(p.shooter, hit.barrier, p.damage);
	}
	p.dead = true;
	return true;
}

export function updateProjectile(p, dt) {
	if (p.ballisticMode) {
		const oldX = p.x, oldY = p.y;
		p.x += p.vx * dt;
		p.y += p.vy * dt;
		if (handleBarrierBlock(p, oldX, oldY, p.x, p.y)) return;
		// 발사 방향 기준으로 target을 지나쳤는지 — dot product <= 0이면 도달/지나침
		const dx = p.tx - p.x;
		const dy = p.ty - p.y;
		if (dx * p.vx + dy * p.vy <= 0) {
			applySplashHit(p.shooter, p.tx, p.ty, p.damage, p.splash, p.attackTypes);
			game.splashes.push({
				x: p.tx, y: p.ty,
				radius: p.splash,
				life: 0.3, maxLife: 0.3,
				color: p.splashColor || '#fff',
			});
			p.dead = true;
		}
		return;
	}
	if (p.straightMode) {
		const oldX = p.x, oldY = p.y;
		p.x += p.vx * dt;
		p.y += p.vy * dt;
		if (p.x < -20 || p.x > LOGICAL_W + 20 || p.y < -20 || p.y > LOGICAL_H + 20) {
			p.dead = true;
			return;
		}
		if (handleBarrierBlock(p, oldX, oldY, p.x, p.y)) return;
		for (const e of game.enemies) {
			if (e.dead) continue;
			if (e.isBarrier) continue; // 장벽은 handleBarrierBlock에서 처리됨
			if (p.attackTypes && !p.attackTypes.includes(e.type)) continue;
			const d = Math.hypot(e.x - p.x, e.y - p.y);
			if (d <= e.radius) {
				if (p.splash > 0) {
					applySplashHit(p.shooter, p.x, p.y, p.damage, p.splash, p.attackTypes);
					game.splashes.push({
						x: p.x, y: p.y,
						radius: p.splash,
						life: 0.3, maxLife: 0.3,
						color: p.splashColor || '#fff',
					});
				} else {
					applyTowerHit(p.shooter, e, p.damage);
				}
				p.dead = true;
				return;
			}
		}
		return;
	}

	if (!p.target || p.target.dead) {
		p.dead = true;
		return;
	}
	const dx = p.target.x - p.x;
	const dy = p.target.y - p.y;
	const dist = Math.hypot(dx, dy);
	const move = p.speed * dt;
	if (move >= dist) {
		// 마지막 점프 — target 직전에 장벽 만남 검사
		if (handleBarrierBlock(p, p.x, p.y, p.target.x, p.target.y)) return;
		if (p.splash > 0) {
			const ix = p.target.x;
			const iy = p.target.y;
			applySplashHit(p.shooter, ix, iy, p.damage, p.splash, p.attackTypes);
			game.splashes.push({
				x: ix, y: iy,
				radius: p.splash,
				life: 0.3, maxLife: 0.3,
				color: p.splashColor || '#fff',
			});
		} else {
			applyTowerHit(p.shooter, p.target, p.damage);
		}
		p.dead = true;
	} else {
		const oldX = p.x, oldY = p.y;
		p.x += (dx / dist) * move;
		p.y += (dy / dist) * move;
		if (handleBarrierBlock(p, oldX, oldY, p.x, p.y)) return;
	}
}

export function updateBeam(b, dt) {
	b.life -= dt;
	if (b.life <= 0) b.dead = true;
}

export function updateSplash(s, dt) {
	s.life -= dt;
	if (s.life <= 0) s.dead = true;
}

export function spawnZap(x, y, radius, color) {
	const boltCount = 7;
	const bolts = [];
	for (let i = 0; i < boltCount; i++) {
		const angle = (Math.PI * 2 * i / boltCount) + (Math.random() - 0.5) * 0.45;
		let reach = radius * (0.85 + Math.random() * 0.15);
		// 광선 방향에 장벽이 있으면 그 진입점까지만 뻗음
		const blockDist = findBarrierBlockDist(x, y, angle, reach, null);
		if (blockDist !== null) reach = Math.max(0, blockDist - 2);
		const perpX = -Math.sin(angle);
		const perpY = Math.cos(angle);
		const segments = 5;
		const points = [];
		for (let s = 1; s <= segments; s++) {
			const t = s / segments;
			const baseX = x + Math.cos(angle) * reach * t;
			const baseY = y + Math.sin(angle) * reach * t;
			const offset = (s === segments ? 0 : (Math.random() - 0.5) * reach * 0.16);
			points.push({ x: baseX + perpX * offset, y: baseY + perpY * offset });
		}
		bolts.push(points);
	}
	game.zaps.push({
		x, y, color, bolts,
		life: 0.25, maxLife: 0.25,
	});
}

export function updateZap(z, dt) {
	z.life -= dt;
	if (z.life <= 0) z.dead = true;
}

export function drawZap(z) {
	const alpha = Math.max(0, z.life / z.maxLife);

	// 중앙 발광
	ctx.globalAlpha = alpha * 0.7;
	ctx.fillStyle = '#fff';
	ctx.beginPath();
	ctx.arc(z.x, z.y, 8, 0, Math.PI * 2);
	ctx.fill();

	// 전기 볼트
	for (const points of z.bolts) {
		ctx.beginPath();
		ctx.moveTo(z.x, z.y);
		for (const pt of points) ctx.lineTo(pt.x, pt.y);

		// 외곽 광채 (타워 색)
		ctx.globalAlpha = alpha * 0.55;
		ctx.strokeStyle = z.color;
		ctx.lineWidth = 5;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.stroke();

		// 내부 코어 (흰색)
		ctx.globalAlpha = alpha;
		ctx.strokeStyle = '#fff';
		ctx.lineWidth = 1.8;
		ctx.stroke();
	}

	ctx.globalAlpha = 1;
}

function drawMissile(p) {
	const angle = Math.atan2(p.vy, p.vx);
	ctx.save();
	ctx.translate(p.x, p.y);
	ctx.rotate(angle);

	// 꼬리 화염 (살짝 깜빡임)
	const flicker = 0.6 + 0.4 * Math.sin(performance.now() / 50);
	ctx.globalAlpha = flicker;
	ctx.fillStyle = '#f39c12';
	ctx.beginPath();
	ctx.moveTo(-7, -2);
	ctx.lineTo(-11, 0);
	ctx.lineTo(-7, 2);
	ctx.closePath();
	ctx.fill();
	ctx.globalAlpha = 1;

	// 본체 (캡슐)
	ctx.fillStyle = '#2c3e50';
	ctx.beginPath();
	ctx.moveTo(-6, -2.5);
	ctx.lineTo(4, -2.5);
	ctx.lineTo(7, 0);
	ctx.lineTo(4, 2.5);
	ctx.lineTo(-6, 2.5);
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = '#1a252f';
	ctx.lineWidth = 1;
	ctx.stroke();

	// 헤드 (붉은 점)
	ctx.fillStyle = '#c0392b';
	ctx.beginPath();
	ctx.arc(5, 0, 1.3, 0, Math.PI * 2);
	ctx.fill();

	ctx.restore();
}

export function drawProjectile(p) {
	if (p.ballisticMode) {
		drawMissile(p);
		return;
	}
	ctx.fillStyle = '#f1c40f';
	ctx.beginPath();
	ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
	ctx.fill();
}

export function drawBeam(b) {
	const alpha = Math.max(0, b.life / b.maxLife);
	// 외곽 광채
	ctx.globalAlpha = alpha * 0.5;
	ctx.strokeStyle = b.color;
	ctx.lineWidth = 6;
	ctx.lineCap = 'round';
	ctx.beginPath();
	ctx.moveTo(b.x1, b.y1);
	ctx.lineTo(b.x2, b.y2);
	ctx.stroke();
	// 내부 코어
	ctx.globalAlpha = alpha;
	ctx.strokeStyle = '#fff';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(b.x1, b.y1);
	ctx.lineTo(b.x2, b.y2);
	ctx.stroke();
	ctx.globalAlpha = 1;
}

export function drawSplash(s) {
	const t = 1 - s.life / s.maxLife;
	const r = s.radius * (0.3 + 0.7 * t);
	const alpha = 1 - t;
	ctx.globalAlpha = alpha * 0.35;
	ctx.fillStyle = s.color;
	ctx.beginPath();
	ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
	ctx.fill();
	ctx.globalAlpha = alpha * 0.85;
	ctx.strokeStyle = s.color;
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
	ctx.stroke();
	ctx.globalAlpha = 1;
}
