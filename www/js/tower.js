import { ctx } from './canvas.js';
import {
  LOGICAL_W, LOGICAL_H, TOWER, TOWER_ROLES, TARGET_PRIORITY,
  PATH_WIDTH, HUD_RESERVED_TOP, WAVE_END_XP_MULTIPLIER,
} from './config.js';
import { game, hasSeenBuffIntro } from './state.js';
import { distanceToPath, roundRect, drawCloseX } from './helpers.js';
import {
  applyTowerHit, fireInstantBeam, fireLineBeam,
} from './attack.js';

// ============ Promotion / XP helpers ============
export function xpMaxFor(t) {
  return TOWER.xpThresholds[t.tier] || 0;
}

export function promotionCostFor(t) {
  return TOWER.promotionCosts[t.tier] || 0;
}

export function canPromote(t) {
  return t.tier < TOWER.maxTier && TOWER_ROLES[t.role].promotions.length > 0;
}

export function isPromotionReady(t) {
  return canPromote(t) && t.xp >= xpMaxFor(t);
}

export function canAffordPromotion(t) {
  return game.gold >= promotionCostFor(t);
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

// ============ Placement ============
export function canPlaceTower(x, y) {
  if (game.gold < TOWER.cost) return false;
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
  game.towers.push({
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
  });
  game.gold -= TOWER.cost;
  return true;
}

export function promoteTower(t, role) {
  if (!isPromotionReady(t)) return false;
  if (!canAffordPromotion(t)) return false;
  if (!TOWER_ROLES[t.role].promotions.includes(role)) return false;
  const cfg = TOWER_ROLES[role];
  if (!cfg) return false;

  game.gold -= promotionCostFor(t);
  t.role = role;
  t.tier += 1;
  t.range = cfg.range;
  t.fireRate = cfg.fireRate;
  t.damage = cfg.damage;
  t.cooldown = 0;
  t.xp = 0;

  if (cfg.buffsRange && !game.modal && !hasSeenBuffIntro()) {
    game.modal = { type: 'buffIntro' };
  }
  return true;
}

// ============ Update / Fire ============
export function updateTower(t, dt) {
  t.cooldown = Math.max(0, t.cooldown - dt);

  const cfg = TOWER_ROLES[t.role];
  const attackTypes = cfg.attackTypes || ['ground'];
  const range = getEffectiveRange(t);

  let target = null;
  if (cfg.targetMode === 'highestHp') {
    let bestHp = -Infinity;
    for (const e of game.enemies) {
      if (e.dead) continue;
      if (!attackTypes.includes(e.type)) continue;
      const d = Math.hypot(e.x - t.x, e.y - t.y);
      if (d > range) continue;
      if (e.hp > bestHp) {
        bestHp = e.hp;
        target = e;
      }
    }
  } else {
    for (const wantType of TARGET_PRIORITY) {
      if (!attackTypes.includes(wantType)) continue;
      let bestDist = range + 1;
      let best = null;
      for (const e of game.enemies) {
        if (e.dead) continue;
        if (e.type !== wantType) continue;
        const d = Math.hypot(e.x - t.x, e.y - t.y);
        if (d < bestDist) {
          bestDist = d;
          best = e;
        }
      }
      if (best) {
        target = best;
        break;
      }
    }
  }

  if (target) {
    t.angle = Math.atan2(target.y - t.y, target.x - t.x);
    if (t.cooldown <= 0) {
      const damage = getEffectiveDamage(t);
      if (cfg.areaSweep) {
        // 트랩: 사거리 내 모든 유효 적에 즉시 데미지 (+10 buffer)
        const hitRange = range + 10;
        for (const e of game.enemies) {
          if (e.dead) continue;
          if (!attackTypes.includes(e.type)) continue;
          const d = Math.hypot(e.x - t.x, e.y - t.y);
          if (d <= hitRange) {
            applyTowerHit(t, e, damage);
          }
        }
        game.splashes.push({
          x: t.x, y: t.y,
          radius: range,
          life: 0.5, maxLife: 0.5,
          color: cfg.color,
        });
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
            attackTypes: cfg.attackTypes || ['ground'],
            straightMode: true,
          });
        }
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
          attackTypes: cfg.attackTypes || ['ground'],
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

export function drawTower(t) {
  const cfg = TOWER_ROLES[t.role];
  const selected = (t === game.selectedTower);

  if (isPromotionReady(t)) {
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
    ctx.globalAlpha = 0.35 + 0.45 * pulse;
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(t.x, t.y, TOWER.radius + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (cfg.instantHit) {
    drawBeamEmitterBody(t, cfg, selected);
  } else if (cfg.buffsRange) {
    drawSupportBody(t, cfg, selected);
  } else if (cfg.areaSweep) {
    drawAreaSweepBody(t, cfg, selected);
  } else {
    drawCannonBody(t, cfg, selected);
  }

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
  const range = getEffectiveRange(t);
  ctx.globalAlpha = fillAlpha;
  ctx.fillStyle = '#3498db';
  ctx.beginPath();
  ctx.arc(t.x, t.y, range, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = strokeAlpha;
  ctx.strokeStyle = '#5dade2';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ============ Tower info panel / Promotion panel ============
export const towerInfoPanel = { x: 16, y: 496, w: 328, h: 144 };
export const infoCloseButton = { x: 308, y: 504, w: 28, h: 28 };
export const infoPromotionButton = { x: 30, y: 600, w: 300, h: 32 };
export const promotionPanel = { x: 16, y: 376, w: 328, h: 248 };
export const promotionCloseButton = { x: 308, y: 384, w: 28, h: 28 };
export const promotionCardSlots = [
  { x: 24, y: 432, w: 312, h: 84 },
  { x: 24, y: 526, w: 312, h: 84 },
];

function drawPromotionButton(t) {
  const ready = isPromotionReady(t);
  const afford = canAffordPromotion(t);
  const active = ready && afford;
  const cost = promotionCostFor(t);
  const xpMax = xpMaxFor(t);

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
  let label;
  if (!ready) label = `전직 (XP ${t.xp} / ${xpMax})`;
  else if (!afford) label = `전직 (${cost}G · 골드 부족)`;
  else label = `전직 (${cost}G)`;
  ctx.fillText(label, infoPromotionButton.x + infoPromotionButton.w / 2, infoPromotionButton.y + infoPromotionButton.h / 2);
  ctx.textBaseline = 'alphabetic';
}

export function drawTowerInfoPanel(t) {
  const cfg = TOWER_ROLES[t.role];
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#1a2535';
  roundRect(towerInfoPanel.x, towerInfoPanel.y, towerInfoPanel.w, towerInfoPanel.h, 10);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = cfg.color;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  const nameWidth = ctx.measureText(cfg.name).width;
  ctx.fillText(cfg.name, towerInfoPanel.x + 14, towerInfoPanel.y + 22);

  ctx.fillStyle = cfg.color;
  ctx.font = '11px sans-serif';
  ctx.fillText(`Tier ${t.tier}`, towerInfoPanel.x + 14 + nameWidth + 8, towerInfoPanel.y + 22);

  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#cdd';
  const sx = towerInfoPanel.x + 14;
  const sy = towerInfoPanel.y + 50;
  const total = Math.round((t.totalDamage || 0) * 10) / 10;
  const atkLabels = { ground: '지상', air: '공중' };
  const hasAttack = (cfg.attackTypes || []).length > 0;
  const atkText = hasAttack ? cfg.attackTypes.map(a => atkLabels[a] || a).join('/') : '없음';

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
  ctx.fillText(`누적 데미지: ${total}`, sx, sy + 36);

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

  drawCloseX(infoCloseButton);
}

function drawPromotionCard(slot, role, cost) {
  const cfg = TOWER_ROLES[role];
  const canAfford = game.gold >= cost;

  ctx.globalAlpha = 0.95;
  ctx.fillStyle = canAfford ? '#222d40' : '#1a1f28';
  roundRect(slot.x, slot.y, slot.w, slot.h, 10);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = canAfford ? cfg.color : '#444';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = cfg.color;
  ctx.beginPath();
  ctx.arc(slot.x + 36, slot.y + slot.h / 2, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = cfg.color2;
  ctx.lineWidth = 2;
  ctx.stroke();

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
  ctx.fillText(`${cost}G`, slot.x + slot.w - 14, slot.y + 32);
}

export function drawPromotionPanel(t) {
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = '#0f1620';
  roundRect(promotionPanel.x, promotionPanel.y, promotionPanel.w, promotionPanel.h, 12);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('전직 가능!', promotionPanel.x + promotionPanel.w / 2, promotionPanel.y + 28);

  ctx.fillStyle = '#bcd';
  ctx.font = '12px sans-serif';
  ctx.fillText('역할을 선택하세요', promotionPanel.x + promotionPanel.w / 2, promotionPanel.y + 48);

  const promotions = TOWER_ROLES[t.role].promotions;
  const cost = promotionCostFor(t);
  for (let i = 0; i < promotions.length && i < promotionCardSlots.length; i++) {
    drawPromotionCard(promotionCardSlots[i], promotions[i], cost);
  }

  drawCloseX(promotionCloseButton);
}
