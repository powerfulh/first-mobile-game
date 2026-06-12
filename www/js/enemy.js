import { ctx } from './canvas.js';
import {
  LOGICAL_W, path, REGEN_HEAL_RATE, BARRIER_RADIUS,
  AIR_INTRO_KEY, BOSS_INTRO_KEY, SHIELD_INTRO_KEY, REGEN_INTRO_KEY, BARRIER_INTRO_KEY,
} from './config.js';
import { game, hasSeenIntro } from './state.js';
import { roundRect, pointToSegmentDist } from './helpers.js';
import { getEnemySpeedFactor } from './tower.js';
import { getNarrowRange } from './wave.js';

// ============ 웨이브 / 적 통계 헬퍼 ============
export function getAirChance(wave) {
  if (wave < 6) return 0;
  return Math.min(0.5, (wave - 5) * 0.02);
}

export function getAirHpRatio(wave) {
  if (wave < 31) return 0.6;
  return Math.min(1.0, 0.6 + (wave - 30) * 0.02);
}

export function getRegenChance(wave) {
  if (wave < 111) return 0;
  // Wave 111~130: +0.2%/wave (4%) / Wave 191~200: +0.4%/wave 추가 (8%)
  const base = Math.min(0.04, (wave - 110) * 0.002);
  const lateBonus = Math.min(0.04, Math.max(0, wave - 190) * 0.004);
  return base + lateBonus;
}

export function getRegenHealRate(wave) {
  // Wave 110~160: 12% / Wave 161~170: +1%/wave (22%) /
  // Wave 191~200: +1%/wave 추가 (32%) / 그 외 구간 고정
  const bonus1 = Math.min(0.10, Math.max(0, wave - 160) * 0.01);
  const bonus2 = Math.min(0.10, Math.max(0, wave - 190) * 0.01);
  return REGEN_HEAL_RATE + bonus1 + bonus2;
}

export function getBarrierSpawnerChance(wave) {
  if (wave < 151) return 0;
  // Wave 151~160: +0.4%/wave (Wave 160 4%) / Wave 161~170 4% 고정
  // Wave 171~180: +0.4%/wave 추가 (Wave 180 8%) / Wave 181+ 8% 고정
  const base = Math.min(0.04, (wave - 150) * 0.004);
  const lateBonus = Math.min(0.04, Math.max(0, wave - 170) * 0.004);
  return base + lateBonus;
}

export function getShieldChance(wave) {
  if (wave < 70) return 0;
  // 그 웨이브의 narrow RNG 범위 기준 정규화 (sparse → 상한, dense → 1%).
  // 후반에 narrow 상하한이 좁아져도 그 wave의 sparse일 때 정상 상한 도달.
  const baseInterval = getBaseSpawnInterval(wave);
  const { min: minN, max: maxN } = getNarrowRange(wave);
  const span = maxN - minN;
  const currentNarrow = baseInterval > 0 ? game.spawnInterval / baseInterval : 1;
  const ratio = span > 0
    ? Math.max(0, Math.min(1, (currentNarrow - minN) / span))
    : 1;
  // 상한 누적: Wave 81~90 +2%/wave, 101~110 +1%/wave, 181~190 +3%/wave
  const bonus = Math.min(0.2, Math.max(0, (wave - 80) * 0.02));
  const extraBonus = Math.min(0.10, Math.max(0, (wave - 100) * 0.01));
  const lateBonus = Math.min(0.30, Math.max(0, (wave - 180) * 0.03));
  return 0.01 + ratio * (0.19 + bonus + extraBonus + lateBonus);
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
  const barrierSpawner = Math.random() < getBarrierSpawnerChance(game.wave);
  const regen = barrierSpawner ? false : Math.random() < getRegenChance(game.wave);
  const isAirPlain = !barrierSpawner && !regen && Math.random() < getAirChance(game.wave);
  const isAir = barrierSpawner || isAirPlain; // 장벽 적은 공중 타입
  const shieldsAllowed = !game.sandbox || game.sandboxShieldsEnabled;
  const shielded = shieldsAllowed && Math.random() < getShieldChance(game.wave);
  const baseHp = computeBaseHpAt(game.wave);
  // 장벽 적: 일반 적과 동일 HP/속도 (공중 HP 비율 미적용, 슬로우 미적용)
  let hp;
  if (barrierSpawner) hp = baseHp;
  else if (isAir) hp = Math.round(baseHp * getAirHpRatio(game.wave) * 10) / 10;
  else hp = baseHp;
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
    barrierSpawner,
  });
  if (isAirPlain && !game.modal && !hasSeenIntro(AIR_INTRO_KEY)) {
    game.modal = { type: 'airIntro' };
  }
  if (shielded && !game.modal && !hasSeenIntro(SHIELD_INTRO_KEY)) {
    game.modal = { type: 'shieldIntro' };
  }
  if (regen && !game.modal && !hasSeenIntro(REGEN_INTRO_KEY)) {
    game.modal = { type: 'regenIntro' };
  }
  if (barrierSpawner && !game.modal && !hasSeenIntro(BARRIER_INTRO_KEY)) {
    game.modal = { type: 'barrierIntro' };
  }
}

// 장벽 객체 — 일반 적과 game.enemies에 함께 들어감 (e.isBarrier=true).
// 공중 타입이라 공중 공격 가능 타워의 타깃이 됨.
export function spawnBarrier(x, y) {
  const hp = computeBaseHpAt(game.wave) * 2;
  game.enemies.push({
    x, y,
    type: 'air',
    speed: 0,
    segment: -1,
    radius: BARRIER_RADIUS,
    hpMax: hp,
    hp: hp,
    isBarrier: true,
  });
}

// 장벽 적 처치 시 호출 — 즉시 생성 대신 짧은 애니메이션 후 spawnBarrier.
export function startBarrierSpawn(x, y) {
  game.barrierSpawnFx.push({
    x, y,
    life: 0.55,
    maxLife: 0.55,
  });
}

export function updateBarrierSpawnFx(fx, dt) {
  fx.life -= dt;
  if (fx.life <= 0) {
    fx.dead = true;
    spawnBarrier(fx.x, fx.y);
  }
}

export function drawBarrierSpawnFx(fx) {
  const t = 1 - fx.life / fx.maxLife; // 0 → 1
  const r = 6 + (BARRIER_RADIUS - 6) * t;

  // 채움 — 점차 진해짐
  ctx.globalAlpha = t * 0.35;
  ctx.fillStyle = '#aab7c4';
  ctx.beginPath();
  ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
  ctx.fill();

  // 외곽 펄스 링 (점선, 회전)
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = '#d5dbdb';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.lineDashOffset = -performance.now() / 40;
  ctx.beginPath();
  ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;

  // 중심 빛점 (사라지면서 외곽으로 흩어짐)
  const sparkAlpha = (1 - t) * 0.9;
  ctx.globalAlpha = sparkAlpha;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(fx.x, fx.y, 5 * (1 - t * 0.6), 0, Math.PI * 2);
  ctx.fill();

  // 사방 작은 입자 (수렴 → 펼침 양상)
  const sparkCount = 6;
  ctx.fillStyle = '#d5dbdb';
  for (let i = 0; i < sparkCount; i++) {
    const angle = (Math.PI * 2 * i / sparkCount) + t * 1.5;
    const dist = r * 0.75;
    const px = fx.x + Math.cos(angle) * dist;
    const py = fx.y + Math.sin(angle) * dist;
    ctx.globalAlpha = Math.max(0, (1 - t) * 0.8);
    ctx.beginPath();
    ctx.arc(px, py, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
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
  if (e.isBarrier) {
    // 장벽은 그 자리 고정 — 이동/회복 없음
    return;
  }
  if (e.regen && !e.regenDisabled && e.hp < e.hpMax) {
    e.hp = Math.min(e.hpMax, e.hp + e.hpMax * getRegenHealRate(game.wave) * dt);
  }
  if (e.segment >= path.length - 1) {
    if (!game.sandbox) game.hp -= 1;
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

function drawBarrierSpawnerEnemy(e, cy) {
  const r = e.radius;
  // 역삼각형 본체 — 위쪽이 넓고 아래 꼭짓점
  ctx.fillStyle = '#a569bd';
  ctx.beginPath();
  ctx.moveTo(e.x - r * 0.9, cy - r * 0.6);
  ctx.lineTo(e.x + r * 0.9, cy - r * 0.6);
  ctx.lineTo(e.x, cy + r);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = e.shielded ? '#5dade2' : '#000';
  ctx.lineWidth = e.shielded ? 2 : 1;
  ctx.stroke();

  // 내부 장벽 미니어처 — 반투명 회청 디스크 + 격자 1줄로 장벽 느낌
  const cx = e.x;
  const inY = cy - r * 0.15;
  const inR = 5;
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = '#aab7c4';
  ctx.beginPath();
  ctx.arc(cx, inY, inR, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#d5dbdb';
  ctx.lineWidth = 1;
  ctx.stroke();
  // 격자(십자) — 장벽의 견고함 암시
  ctx.beginPath();
  ctx.moveTo(cx - inR, inY);
  ctx.lineTo(cx + inR, inY);
  ctx.moveTo(cx, inY - inR);
  ctx.lineTo(cx, inY + inR);
  ctx.stroke();
}

function drawBarrier(e) {
  const ratio = Math.max(0, e.hp / e.hpMax);
  // 단계 (HP 비율 기준): >0.66 견고 / >0.33 손상 / 그 외 부서지기 직전
  const stage = ratio > 0.66 ? 0 : ratio > 0.33 ? 1 : 2;
  const r = e.radius;
  const t = performance.now() / 800;

  // 채움 (반투명, 단계 따라 옅어짐)
  const fillAlpha = stage === 0 ? 0.18 : stage === 1 ? 0.12 : 0.06;
  ctx.globalAlpha = fillAlpha;
  ctx.fillStyle = '#aab7c4';
  ctx.beginPath();
  ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // 외곽선 (단계별 두께/점선/색)
  if (stage === 0) {
    ctx.strokeStyle = '#d5dbdb';
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
  } else if (stage === 1) {
    ctx.strokeStyle = '#aeb6bf';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = '#7f8c8d';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
  }
  ctx.beginPath();
  ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // 내부 격자/균열 — 단계 따라 증가
  ctx.strokeStyle = stage === 0 ? 'rgba(213, 219, 219, 0.55)'
                    : stage === 1 ? 'rgba(174, 182, 191, 0.6)'
                    : 'rgba(127, 140, 141, 0.7)';
  ctx.lineWidth = 1;
  const cracks = stage === 0 ? 0 : stage === 1 ? 4 : 8;
  for (let i = 0; i < cracks; i++) {
    const angle = (Math.PI * 2 * i / Math.max(1, cracks)) + t * 0.3;
    const innerR = r * 0.25;
    const outerR = r * (stage === 1 ? 0.9 : 1.0);
    const x1 = e.x + Math.cos(angle) * innerR;
    const y1 = e.y + Math.sin(angle) * innerR;
    const x2 = e.x + Math.cos(angle) * outerR;
    const y2 = e.y + Math.sin(angle) * outerR;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // 중심 코어 (작은 점)
  ctx.fillStyle = stage === 2 ? 'rgba(231, 76, 60, 0.7)' : 'rgba(213, 219, 219, 0.6)';
  ctx.beginPath();
  ctx.arc(e.x, e.y, 3, 0, Math.PI * 2);
  ctx.fill();
}

export function drawEnemy(e) {
  if (e.isBarrier) {
    drawBarrier(e);
    return;
  }
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

    if (e.barrierSpawner) {
      drawBarrierSpawnerEnemy(e, cy);
    } else {
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
    }

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

// ============ 장벽 차단 헬퍼 ============
// 타워(또는 빔 출발점)에서 target까지 직선이 장벽을 통과하는지 검사.
// 시작점이 어떤 장벽 안에 있으면 무조건 차단 (안에서는 공격 불가).
export function isBlockedByBarrier(fromX, fromY, target) {
  for (const b of game.enemies) {
    if (!b.isBarrier || b.dead) continue;
    if (b === target) continue;
    // 시작점이 장벽 안 → 무조건 차단
    if (Math.hypot(fromX - b.x, fromY - b.y) < b.radius) return true;
    // 광선이 장벽 통과
    const d = pointToSegmentDist(b.x, b.y, fromX, fromY, target.x, target.y);
    if (d < b.radius) return true;
  }
  return false;
}

// 광선(from + angle) 방향 가장 가까운 장벽 진입점까지 거리. 없으면 null.
// 시작점이 어떤 장벽 안이면 거리 0 (즉시 차단).
export function findBarrierBlockDist(fromX, fromY, angle, maxDist, excludeTarget) {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  let minDist = null;
  for (const b of game.enemies) {
    if (!b.isBarrier || b.dead) continue;
    if (b === excludeTarget) continue;
    if (Math.hypot(fromX - b.x, fromY - b.y) < b.radius) {
      // 시작점이 장벽 안 → 즉시 차단
      if (minDist === null || 0 < minDist) minDist = 0;
      continue;
    }
    const dx = b.x - fromX;
    const dy = b.y - fromY;
    const proj = dx * ux + dy * uy;
    const perp = Math.abs(dx * uy - dy * ux);
    if (perp >= b.radius) continue;
    const back = Math.sqrt(b.radius * b.radius - perp * perp);
    const entry = proj - back;
    if (entry < 0 || entry > maxDist) continue;
    if (minDist === null || entry < minDist) minDist = entry;
  }
  return minDist;
}

// 투사체 이동 (from → to) 경로상 가장 가까운 장벽 진입점.
// 시작점이 장벽 안이면 그 자리 즉시 차단.
// 반환: { barrier, x, y, dist } 또는 null.
export function projectileHitsBarrier(fromX, fromY, toX, toY) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  const ux = dx / length;
  const uy = dy / length;
  let nearest = null;
  for (const b of game.enemies) {
    if (!b.isBarrier || b.dead) continue;
    if (Math.hypot(fromX - b.x, fromY - b.y) < b.radius) {
      // 시작점이 안 → 거리 0
      if (!nearest || 0 < nearest.dist) {
        nearest = { barrier: b, dist: 0 };
      }
      continue;
    }
    const bx = b.x - fromX;
    const by = b.y - fromY;
    const proj = bx * ux + by * uy;
    const perp = Math.abs(bx * uy - by * ux);
    if (perp >= b.radius) continue;
    const back = Math.sqrt(b.radius * b.radius - perp * perp);
    const entry = proj - back;
    if (entry < 0 || entry > length) continue;
    if (!nearest || entry < nearest.dist) {
      nearest = { barrier: b, dist: entry };
    }
  }
  if (!nearest) return null;
  return {
    barrier: nearest.barrier,
    x: fromX + ux * nearest.dist,
    y: fromY + uy * nearest.dist,
    dist: nearest.dist,
  };
}
