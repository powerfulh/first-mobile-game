import { ctx } from './canvas.js';
import { LOGICAL_W, LOGICAL_H, TOWER_ROLES, ENEMY_KILL_REWARD } from './config.js';
import { game } from './state.js';
import { pointToSegmentDist } from './helpers.js';
import {
  canPromote, xpMaxFor, getEffectiveRange,
} from './tower.js';
import { getBossReward } from './enemy.js';

export function applyTowerHit(shooter, target, damage) {
  if (!target || target.dead) return;
  const shieldReduction = game.wave >= 151 ? 4 : 3;
  const effective = target.shielded ? Math.max(0, damage - shieldReduction) : damage;
  const hpBefore = target.hp;
  const dealt = Math.min(effective, hpBefore);
  const xpGain = Math.min(damage, hpBefore); // XP는 방어막 감소 무시
  target.hp -= effective;
  if (shooter) {
    shooter.totalDamage = Math.round(((shooter.totalDamage || 0) + dealt) * 10) / 10;
    if (canPromote(shooter)) {
      const next = Math.round((shooter.xp + xpGain) * 10) / 10;
      shooter.xp = Math.min(next, xpMaxFor(shooter));
    }
  }
  if (target.hp <= 0) {
    target.dead = true;
    if (target.isBoss) {
      game.gold += getBossReward(game.wave);
    } else if (!game.bossActive) {
      game.gold += ENEMY_KILL_REWARD;
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
  game.beams.push({
    x1: t.x, y1: t.y,
    x2: target.x, y2: target.y,
    life: 0.15,
    maxLife: 0.15,
    color: cfg.color,
  });
  applyTowerHit(t, target, damage !== undefined ? damage : t.damage);
}

export function fireLineBeam(t, target, damage) {
  const cfg = TOWER_ROLES[t.role];
  const range = getEffectiveRange(t);
  const angle = Math.atan2(target.y - t.y, target.x - t.x);
  const endX = t.x + Math.cos(angle) * range;
  const endY = t.y + Math.sin(angle) * range;

  game.beams.push({
    x1: t.x, y1: t.y,
    x2: endX, y2: endY,
    life: 0.2,
    maxLife: 0.2,
    color: cfg.color,
  });

  const attackTypes = cfg.attackTypes || ['ground'];
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

export function updateProjectile(p, dt) {
  if (p.straightMode) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < -20 || p.x > LOGICAL_W + 20 || p.y < -20 || p.y > LOGICAL_H + 20) {
      p.dead = true;
      return;
    }
    for (const e of game.enemies) {
      if (e.dead) continue;
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
    p.x += (dx / dist) * move;
    p.y += (dy / dist) * move;
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
    const reach = radius * (0.85 + Math.random() * 0.15);
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

export function drawProjectile(p) {
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
