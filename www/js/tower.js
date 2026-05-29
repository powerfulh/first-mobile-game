import { ctx } from './canvas.js';
import {
  LOGICAL_W, LOGICAL_H, TOWER, TOWER_ROLES, TARGET_PRIORITY, TIER4_RECIPES,
  PATH_WIDTH, HUD_RESERVED_TOP, WAVE_END_XP_MULTIPLIER,
} from './config.js';
import { game, hasSeenBuffIntro } from './state.js';
import { distanceToPath, roundRect, drawCloseX } from './helpers.js';
import {
  applyTowerHit, fireInstantBeam, fireLineBeam, spawnZap,
} from './attack.js';

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
  return canPromote(t) && t.xp >= xpMaxFor(t);
}

export function canAffordPromotion(t) {
  return game.gold >= promotionCostFor(t);
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

export function promoteToTier4(secondTower) {
  // 대상(첫 타워)이 사라지고 secondTower 자리에 4티어 타워 생성
  const target = game.promotionTarget;
  if (!target) return false;
  if (!isCompatibleTier4Partner(target, secondTower)) return false;
  if (!isPromotionReady(target) || !isPromotionReady(secondTower)) return false;
  const cost = promotionCostFor(secondTower);
  if (game.gold < cost) return false;

  const recipe = TIER4_RECIPES[secondTower.role];
  const resultRole = recipe.result;
  const cfg = TOWER_ROLES[resultRole];
  if (!cfg) return false;

  game.gold -= cost;

  // 대상 타워 제거
  game.towers = game.towers.filter(x => x !== target);
  game.promotionTarget = null;

  // 두 번째 타워 자리에 4티어로 변환
  secondTower.role = resultRole;
  secondTower.tier = 4;
  secondTower.range = cfg.range;
  secondTower.fireRate = cfg.fireRate;
  secondTower.damage = cfg.damage;
  secondTower.cooldown = 0;
  secondTower.xp = 0;
  return true;
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

  let target = null;
  if (cfg.targetMode === 'highestHp') {
    let bestHp = -Infinity;
    for (const e of game.enemies) {
      if (e.dead) continue;
      if (!attackTypes.includes(e.type)) continue;
      const d = Math.hypot(e.x - t.x, e.y - t.y);
      if (d > range && !(includeMarked && e.marked)) continue;
      if (e.hp > bestHp) {
        bestHp = e.hp;
        target = e;
      }
    }
  } else {
    for (const wantType of TARGET_PRIORITY) {
      if (!attackTypes.includes(wantType)) continue;
      let bestDist = Infinity;
      let best = null;
      for (const e of game.enemies) {
        if (e.dead) continue;
        if (e.type !== wantType) continue;
        const d = Math.hypot(e.x - t.x, e.y - t.y);
        if (d > range && !(includeMarked && e.marked)) continue;
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

function drawTier4Aura(t) {
  // 4티어 외곽 골든 띠
  const r = TOWER.radius + 4;
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 400);
  ctx.globalAlpha = 0.55 + 0.35 * pulse;
  ctx.strokeStyle = '#f5d76e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
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

  if (t.tier === 4) drawTier4Aura(t);

  if (cfg.instantHit) {
    drawBeamEmitterBody(t, cfg, selected);
  } else if (cfg.buffsRange) {
    drawSupportBody(t, cfg, selected);
  } else if (cfg.areaSweep) {
    drawAreaSweepBody(t, cfg, selected);
  } else {
    drawCannonBody(t, cfg, selected);
  }

  if (cfg.marksEnemies) drawRadarAntenna(t);

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
      const afford = game.gold >= cost;
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
  else if (!afford) label = `전직 (${cost}G · 골드 부족)`;
  else label = `전직 (${cost}G)`;
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
  ctx.fillText(`누적 데미지: ${total.toLocaleString()}`, sx, sy + 36);

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
  ctx.fillText(`${cost.toLocaleString()}G`, slot.x + slot.w - 14, slot.y + 32);
}

function drawTier4ResultCard(slot, role, cost) {
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

  // 외관 미리보기 — 큰 원 + 4티어 골든 펄스 띠
  const orbCx = slot.x + 42;
  const orbCy = slot.y + 42;
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 400);
  ctx.globalAlpha = 0.55 + 0.35 * pulse;
  ctx.strokeStyle = '#f5d76e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(orbCx, orbCy, 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = cfg.color;
  ctx.beginPath();
  ctx.arc(orbCx, orbCy, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = cfg.color2;
  ctx.lineWidth = 2;
  ctx.stroke();

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
