import { ctx } from './canvas.js';
import {
  LOGICAL_W, path, REGEN_HEAL_RATE,
  AIR_INTRO_KEY, BOSS_INTRO_KEY, SHIELD_INTRO_KEY, REGEN_INTRO_KEY,
} from './config.js';
import { game, hasSeenIntro } from './state.js';
import { roundRect } from './helpers.js';
import { getEnemySpeedFactor } from './tower.js';

// ============ 웨이브 / 적 통계 헬퍼 ============
export function getAirChance(wave) {
  if (wave < 5) return 0;
  return Math.min(0.5, (wave - 4) * 0.02);
}

export function getAirHpRatio(wave) {
  if (wave < 31) return 0.6;
  return Math.min(1.0, 0.6 + (wave - 30) * 0.02);
}

export function getRegenChance(wave) {
  if (wave < 111) return 0;
  // Wave 111: 0.2%, Wave 112: 0.4%, ..., Wave 130+: 4.0% (고정)
  return Math.min(0.04, (wave - 110) * 0.002);
}

export function getShieldChance(wave) {
  if (wave < 70) return 0;
  // Wave 70~80: 1% ~ 20% (spawnInterval 기반 반비례)
  // Wave 81~90: 상한이 점진적으로 20% → 40% 확장
  // Wave 90~100: 상한 40% 고정
  // Wave 101~110: 상한이 매 웨이브 +1%씩 추가 확장 → 최종 50%
  const interval = game.spawnInterval;
  const ratio = Math.max(0, Math.min(1, (interval - 0.2) / (0.5 - 0.2)));
  const bonus = Math.min(0.2, Math.max(0, (wave - 80) * 0.02));
  const extraBonus = Math.min(0.10, Math.max(0, (wave - 100) * 0.01));
  return 0.01 + ratio * (0.19 + bonus + extraBonus);
}

// ============ Boss wave helpers ============
export function isBossWave(wave) {
  return wave > 0 && wave % 20 === 0;
}

export function getBossType(wave) {
  // 20=ground, 40=air, 60=ground, 80=air, ...
  const idx = wave / 20;
  return idx % 2 === 1 ? 'ground' : 'air';
}

export function getEnemiesPerWaveAt(wave) {
  if (wave <= 1) return 8;
  if (wave <= 39) return 8 + 2 * (wave - 1);
  if (wave <= 79) return wave + 45;
  return 124;
}

export function computeBaseHpAt(wave) {
  let hpExtra = 0;
  for (let i = 1; i <= 4; i++) {
    hpExtra += Math.max(0, wave - i * 50) * 0.1;
  }
  return 2 + Math.floor((wave - 1) * 0.6 + hpExtra);
}

export function computeBossHp(wave) {
  const n = getEnemiesPerWaveAt(wave);
  const baseHp = computeBaseHpAt(wave);
  const airChance = getAirChance(wave);
  const airHpRatio = getAirHpRatio(wave);
  const avgHp = baseHp * ((1 - airChance) + airChance * airHpRatio);
  return Math.round(n * avgHp);
}

export function getBossReward(wave) {
  return wave;
}

export function getBaseSpawnInterval(wave) {
  return Math.max(0.5, 1.2 - (wave - 1) * 0.08);
}

// ============ Spawn ============
export function spawnEnemy() {
  // 적 타입 결정: 나중에 정의된 종부터 배타적으로 확률 굴림.
  const regen = Math.random() < getRegenChance(game.wave);
  const isAir = regen ? false : Math.random() < getAirChance(game.wave);
  const shielded = Math.random() < getShieldChance(game.wave);
  const baseHp = computeBaseHpAt(game.wave);
  const hp = isAir ? Math.round(baseHp * getAirHpRatio(game.wave) * 10) / 10 : baseHp;
  const baseSpeed = 50 + (Math.min(100, game.wave) - 1) * 2;
  const speed = regen ? baseSpeed * 0.5 : baseSpeed;
  game.enemies.push({
    x: path[0].x,
    y: path[0].y,
    type: isAir ? 'air' : 'ground',
    speed,
    segment: 0,
    radius: 10,
    hpMax: hp,
    hp: hp,
    bobPhase: Math.random() * Math.PI * 2,
    shielded,
    regen,
  });
  if (isAir && !game.modal && !hasSeenIntro(AIR_INTRO_KEY)) {
    game.modal = { type: 'airIntro' };
  }
  if (shielded && !game.modal && !hasSeenIntro(SHIELD_INTRO_KEY)) {
    game.modal = { type: 'shieldIntro' };
  }
  if (regen && !game.modal && !hasSeenIntro(REGEN_INTRO_KEY)) {
    game.modal = { type: 'regenIntro' };
  }
}

export function spawnBoss() {
  const type = getBossType(game.wave);
  const bossHp = computeBossHp(game.wave);
  const baseSpeed = 50 + (Math.min(100, game.wave) - 1) * 2;
  game.enemies.push({
    x: path[0].x,
    y: path[0].y,
    type,
    speed: baseSpeed * 0.1,
    segment: 0,
    radius: 18,
    hpMax: bossHp,
    hp: bossHp,
    bobPhase: Math.random() * Math.PI * 2,
    isBoss: true,
    angle: Math.PI / 2,
  });
  if (!game.modal && !hasSeenIntro(BOSS_INTRO_KEY)) {
    game.modal = { type: 'bossIntro' };
  }
}

// ============ Update ============
export function updateEnemy(e, dt) {
  if (e.regen && !e.regenDisabled && e.hp < e.hpMax) {
    e.hp = Math.min(e.hpMax, e.hp + e.hpMax * REGEN_HEAL_RATE * dt);
  }
  if (e.segment >= path.length - 1) {
    game.hp -= 1;
    e.dead = true;
    return;
  }
  const target = path[e.segment + 1];
  const dx = target.x - e.x;
  const dy = target.y - e.y;
  const dist = Math.hypot(dx, dy);
  if (e.isBoss && dist > 0) {
    e.angle = Math.atan2(dy, dx);
  }
  const move = e.speed * getEnemySpeedFactor(e) * dt;
  if (move >= dist) {
    e.x = target.x;
    e.y = target.y;
    e.segment++;
  } else {
    e.x += (dx / dist) * move;
    e.y += (dy / dist) * move;
  }
}

// ============ Draw ============
function drawEnemyHpBar(e, cy) {
  const barW = 20;
  const barH = 3;
  const ratio = e.hp / e.hpMax;
  ctx.fillStyle = '#000';
  ctx.fillRect(e.x - barW / 2, cy - e.radius - 8, barW, barH);
  ctx.fillStyle = e.shielded ? '#5dade2' : '#2ecc71';
  ctx.fillRect(e.x - barW / 2, cy - e.radius - 8, barW * ratio, barH);
}

function drawMarkRing(e, cy) {
  // 래이다르 마킹: 적 주변 회전하는 점선 링 + 중심 십자
  const r = e.radius + 6;
  const t = performance.now() / 700;
  ctx.save();
  ctx.translate(e.x, cy);
  ctx.rotate(t);
  ctx.strokeStyle = '#1abc9c';
  ctx.lineWidth = 1.4;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // 십자 마커
  const m = 3;
  ctx.beginPath();
  ctx.moveTo(r - m, 0); ctx.lineTo(r + m, 0);
  ctx.moveTo(-r - m, 0); ctx.lineTo(-r + m, 0);
  ctx.moveTo(0, r - m); ctx.lineTo(0, r + m);
  ctx.moveTo(0, -r - m); ctx.lineTo(0, -r + m);
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
}

export function drawBossHpBar() {
  if (!game.bossActive) return;
  let boss = null;
  for (const e of game.enemies) {
    if (e.isBoss && !e.dead) { boss = e; break; }
  }
  if (!boss) return;

  const bx = 20;
  const by = 38;
  const bw = LOGICAL_W - 40;
  const bh = 14;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(bx, by, bw, bh);

  const ratio = Math.max(0, boss.hp / boss.hpMax);
  ctx.fillStyle = boss.type === 'air' ? '#a569bd' : '#c0392b';
  ctx.fillRect(bx, by, bw * ratio, bh);

  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`BOSS  ${Math.ceil(Math.max(0, boss.hp))} / ${boss.hpMax}`, LOGICAL_W / 2, by + bh / 2);
  ctx.textBaseline = 'alphabetic';
}

function drawGroundBoss(e) {
  ctx.fillStyle = '#922b21';
  ctx.beginPath();
  ctx.ellipse(e.x, e.y, e.radius * 1.2, e.radius * 0.85, e.angle, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawAirBoss(e) {
  const bobY = Math.sin(performance.now() / 250 + (e.bobPhase || 0)) * 3;
  const r = e.radius;

  ctx.save();
  ctx.translate(e.x, e.y + bobY - 4);
  ctx.rotate(e.angle - Math.PI / 2);

  // 날개
  ctx.fillStyle = '#5b2c6f';
  ctx.beginPath();
  ctx.moveTo(-r * 1.3, -r * 0.05);
  ctx.lineTo(r * 1.3, -r * 0.05);
  ctx.lineTo(r * 1.0, r * 0.25);
  ctx.lineTo(-r * 1.0, r * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 본체
  ctx.fillStyle = '#7d3c98';
  ctx.beginPath();
  ctx.moveTo(0, r * 1.1);
  ctx.lineTo(-r * 0.55, -r * 0.5);
  ctx.lineTo(r * 0.55, -r * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

function drawRegenAura(cx, cy, baseR) {
  // 사방으로 + 파티클이 흩어지며 페이드아웃 (각 파티클이 서로 다른 페이즈)
  const count = 6;
  const reach = 14;
  const period = 1100;
  const now = performance.now();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const phase = i / count;
    const t = ((now / period) + phase) % 1;
    const angle = (Math.PI * 2 * i / count) + Math.sin(now / 700 + i * 1.3) * 0.25;
    const r = baseR + reach * t;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    const alpha = Math.min(1, t * 4) * (1 - t * 0.9);
    const sz = 2.4;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(px - sz, py);
    ctx.lineTo(px + sz, py);
    ctx.moveTo(px, py - sz);
    ctx.lineTo(px, py + sz);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.lineCap = 'butt';
}

function drawRegenEnemy(e) {
  const r = e.radius;
  const w = r * 1.8;
  const x = e.x - w / 2;
  const y = e.y - w / 2;

  // 외곽 옅은 초록 글로우 (회복 분위기)
  const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 600);
  ctx.globalAlpha = 0.25 + 0.25 * pulse;
  ctx.fillStyle = '#2ecc71';
  roundRect(x - 3, y - 3, w + 6, w + 6, 5);
  ctx.fill();
  ctx.globalAlpha = 1;

  // 본체
  ctx.fillStyle = '#1e8449';
  roundRect(x, y, w, w, 3);
  ctx.fill();
  ctx.strokeStyle = e.shielded ? '#5dade2' : '#000';
  ctx.lineWidth = e.shielded ? 2 : 1;
  ctx.stroke();

  drawEnemyHpBar(e, e.y);
  if (!e.regenDisabled) drawRegenAura(e.x, e.y, r + 4);
}

export function drawEnemy(e) {
  if (e.isBoss) {
    if (e.type === 'ground') drawGroundBoss(e);
    else if (e.type === 'air') drawAirBoss(e);
    if (e.marked) drawMarkRing(e, e.y);
    return; // 보스 HP는 고정 UI에 표시
  }
  if (e.regen) {
    drawRegenEnemy(e);
    if (e.marked) drawMarkRing(e, e.y);
    return;
  }
  if (e.type === 'air') {
    const bobY = Math.sin(performance.now() / 250 + (e.bobPhase || 0)) * 2;
    const cy = e.y + bobY - 3;
    const r = e.radius;

    ctx.fillStyle = '#a569bd';
    ctx.beginPath();
    ctx.moveTo(e.x, cy - r);
    ctx.lineTo(e.x - r * 0.9, cy + r * 0.6);
    ctx.lineTo(e.x + r * 0.9, cy + r * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = e.shielded ? '#5dade2' : '#000';
    ctx.lineWidth = e.shielded ? 2 : 1;
    ctx.stroke();

    drawEnemyHpBar(e, cy);
    if (e.marked) drawMarkRing(e, cy);
  } else {
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = e.shielded ? '#5dade2' : '#000';
    ctx.lineWidth = e.shielded ? 2 : 1;
    ctx.stroke();

    drawEnemyHpBar(e, e.y);
    if (e.marked) drawMarkRing(e, e.y);
  }
}
