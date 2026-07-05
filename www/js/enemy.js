import { ctx } from './core/canvas.js';
import {
	LOGICAL_W, REGEN_HEAL_RATE, BARRIER_RADIUS, ENEMY_SPEED_CAP_WAVE, AIR_COLOR, ACCENT_RED,
	AIR_INTRO_KEY, BOSS_INTRO_KEY, SHIELD_INTRO_KEY, REGEN_INTRO_KEY, BARRIER_INTRO_KEY,
} from './core/config.js';
import { getActiveMap } from './core/maps.js';
import { game, hasSeenIntro } from './state.js';
import { pointToSegmentDist, round1, clamp } from './core/helpers.js';
import { drawEnemySprite } from './ui/sprite.js';
import { getEnemySpeedFactor, isRegenBlocked } from './tower.js';
import { getNarrowRange } from './wave.js';
import { t } from './core/i18n.js';

// ============ 웨이브 / 적 통계 헬퍼 ============
// 맵별 웨이브 구성 파라미터 (기본 = 맵1). 맵의 waveComposition이 객체면 그 위에 덮어씀.
const DEFAULT_WAVE = {
	airStartWave: 6, airStartChance: 0.02, airChanceStep: 0.02, airChanceCap: 0.5,
	airHpBase: 0.6, airHpRampWave: 31, airHpStep: 0.02, airHpCap: 1.0,
	regenStartWave: 111, regenChanceStep: 0.002, regenChanceCap: 0.04, // 시작 웨이브에 step, 이후 +step/wave (cap까지)
	barrierStartWave: 151, // 장벽 적 첫 등장 — 시작 웨이브에 0.4%, 이후 +0.4%/wave (10웨이브 누적 4% 상한)
	regenHealRampWave: 160, // 이 웨이브 이후 재생 회복률 +1%/wave (10웨이브 누적 +10%)
	shieldStartCap: 0.2, // 방어막 등장(51) 시점 출현 확률 상한 — 0.4 미만이면 Wave 81~90 램프로 0.4까지 확장
	countRampWave: 40, countCapWave: 79, // < rampWave: +2/wave, [rampWave..capWave]: +1/wave, 이후 고정
	densityFloorWave: 100, // 이 웨이브 이후 minNarrow 추가 -0.01/wave (10웨이브 누적 -0.10)
	densityCeilWave: 120, // 이 웨이브 이후 maxNarrow -0.01/wave (10웨이브 누적 -0.10)
};

export function wparams() {
	const wc = getActiveMap().waveComposition;
	return (wc && typeof wc === 'object') ? { ...DEFAULT_WAVE, ...wc } : DEFAULT_WAVE;
}

export function computeBaseHpAt(wave) {
	let hpExtra = 0;
	for (let i = 1; i <= 4; i++) {
		hpExtra += Math.max(0, wave - i * 50) * 0.1;
	}
	// 1~10웨이브는 완만하게(+0.4/wave), 11웨이브부터 기존 +0.6/wave (10웨이브 값에서 연속). 모든 맵 공통.
	const earlyGain = Math.min(wave - 1, 9) * 0.4; // wave 1→10 증가분 (최대 9회)
	const lateGain = Math.max(0, wave - 10) * 0.6; // wave 10 이후 증가분
	return round1(2 + earlyGain + lateGain + hpExtra);
}

export function getAirChance(wave) {
	const p = wparams();
	if (wave < p.airStartWave) return 0;
	return Math.min(p.airChanceCap, p.airStartChance + (wave - p.airStartWave) * p.airChanceStep);
}

export function getAirHpRatio(wave) {
	const p = wparams();
	if (wave < p.airHpRampWave) return p.airHpBase;
	return Math.min(p.airHpCap, p.airHpBase + (wave - (p.airHpRampWave - 1)) * p.airHpStep);
}

export function getRegenChance(wave) {
	const p = wparams();
	if (wave < p.regenStartWave) return 0;
	// 시작 웨이브부터 +step/wave 누적 (cap까지) / Wave 191~200: +0.4%/wave 추가 (전 맵 공통)
	const base = Math.min(p.regenChanceCap, (wave - p.regenStartWave + 1) * p.regenChanceStep);
	const lateBonus = clamp((wave - 190) * 0.004, 0, 0.04);
	return base + lateBonus;
}

export function getRegenHealRate(wave) {
	// 기본 12% / regenHealRampWave 이후 +1%/wave (10웨이브 누적 22%) /
	// Wave 191~200: +1%/wave 추가 (32%, 전 맵 공통) / 그 외 구간 고정
	const bonus1 = clamp((wave - wparams().regenHealRampWave) * 0.01, 0, 0.10);
	const bonus2 = clamp((wave - 190) * 0.01, 0, 0.10);
	return REGEN_HEAL_RATE + bonus1 + bonus2;
}

export function getBarrierSpawnerChance(wave) {
	const p = wparams();
	if (wave < p.barrierStartWave) return 0;
	// 시작 웨이브부터 +0.4%/wave (10웨이브 누적 4% 상한) / Wave 171~180: +0.4%/wave 추가 (전 맵 공통, 최종 8%)
	const base = Math.min(0.04, (wave - p.barrierStartWave + 1) * 0.004);
	const lateBonus = clamp((wave - 170) * 0.004, 0, 0.04);
	return base + lateBonus;
}

export function getShieldChance(wave, spawnInterval) {
	if (wave < 51) return 0;
	// 그 웨이브의 narrow RNG 범위 기준 정규화 (sparse → 상한, dense → 1%).
	// 후반에 narrow 상하한이 좁아져도 그 wave의 sparse일 때 정상 상한 도달.
	const baseInterval = getBaseSpawnInterval(wave);
	const { min: minN, max: maxN } = getNarrowRange(wave);
	const span = maxN - minN;
	const currentNarrow = baseInterval > 0 ? spawnInterval / baseInterval : 1;
	const ratio = span > 0
		? clamp((currentNarrow - minN) / span, 0, 1)
		: 1;
	// 상한 누적: Wave 81~90 +2%/wave (시작 상한 → 40%; 이미 40%면 없음), 101~110 +1%/wave, 181~190 +3%/wave
	const p = wparams();
	const bonus = clamp((wave - 80) * 0.02, 0, Math.max(0, 0.4 - p.shieldStartCap));
	const extraBonus = clamp((wave - 100) * 0.01, 0, 0.10);
	const lateBonus = clamp((wave - 180) * 0.03, 0, 0.30);
	return 0.01 + ratio * ((p.shieldStartCap - 0.01) + bonus + extraBonus + lateBonus);
}

// 방어막 적이 피격당 받는 피해 감소량 (flat). applyTowerHit·적 정보 패널 공용.
// Wave 51~70: 1.1 → 3.0으로 매 웨이브 +0.1 (3.0 상한) / Wave 131~150: 추가 +0.1/wave (+2.0).
export function getShieldReduction(wave) {
	return clamp(1 + (wave - 50) * 0.1, 1, 3)
		+ clamp((wave - 130) * 0.1, 0, 2);
}

// ============ Boss wave helpers ============
// 보스 웨이브 판정(isBossWave)은 웨이브 스케줄 로직이라 wave.js로 이동
export function getBossType(wave) {
	// 20=ground, 40=air, 60=ground, 80=air, ...
	const idx = wave / 20;
	return idx % 2 === 1 ? 'ground' : 'air';
}

export function getEnemiesPerWaveAt(wave) {
	if (wave <= 1) return 8;
	const p = wparams();
	const ramp = p.countRampWave;    // 이 웨이브부터 증가량 +1
	const cap = p.countCapWave;       // 이 웨이브 값에서 고정 (이후 불변)
	if (wave <= ramp - 1) return 8 + 2 * (wave - 1); // 그 전까지 +2/wave
	const base = 8 + 2 * (ramp - 2);  // (ramp-1)까지 +2 누적값
	return base + (Math.min(wave, cap) - (ramp - 1));
}

export function computeBossHp(wave) {
	const n = Math.min(70, getEnemiesPerWaveAt(wave)); // 보스 HP 계산용 일반 적 수 상한 260623 땡트랩으로 200이 뚫리길래 너무 약하다 싶어서 70
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

// 적 기본 이동 속도 — Wave에 비례 증가, ENEMY_SPEED_CAP_WAVE에서 상한 고정. spawnEnemy/spawnBoss 공용.
function getEnemyBaseSpeed(wave) {
	return 50 + (Math.min(ENEMY_SPEED_CAP_WAVE, wave) - 1) * 2;
}

// ============ Spawn ============
export function spawnEnemy(spawner) {
	// 스폰 스탯은 그 스포너의 웨이브 기준 (병렬 웨이브는 각자 다른 웨이브일 수 있음).
	const wave = spawner.wave;
	const map = getActiveMap();
	const baseHp = computeBaseHpAt(wave);
	// 정체성(kind) 결정: 나중에 정의된 종부터 배타적으로 확률 굴림. kind가 GA까지 식별.
	//  barrierSpawner/air=공중, regen/basic=지상.
	let kind, spriteType, ga;
	if (Math.random() < getBarrierSpawnerChance(wave)) { kind = 'barrierSpawner'; spriteType = 'barrierSpawner'; ga = 'air'; }
	else if (Math.random() < getRegenChance(wave)) { kind = 'regen'; spriteType = 'regen'; ga = 'ground'; }
	else if (Math.random() < getAirChance(wave)) { kind = 'air'; spriteType = 'air'; ga = 'air'; }
	else { kind = 'basic'; spriteType = 'ground'; ga = 'ground'; }
	const isAir = ga === 'air';
	const shieldsAllowed = !game.sandbox || game.sandboxShieldsEnabled;
	const shielded = shieldsAllowed && Math.random() < getShieldChance(wave, spawner.spawnInterval);
	const hp = isAir ? round1(baseHp * getAirHpRatio(wave)) : baseHp;
	const baseSpeed = getEnemyBaseSpeed(wave);
	const speed = kind === 'regen' ? baseSpeed * 0.5 : baseSpeed;
	// 공중 적 지름길 — airShortcut 맵에서 정규↔지름길 교대 (보스는 spawnBoss라 항상 정규)
	let enemyPath = map.path;
	if (isAir && map.airShortcutPath) {
		if (game.airShortcutNext) enemyPath = map.airShortcutPath;
		game.airShortcutNext = !game.airShortcutNext;
	}
	game.entities.enemies.push({
		x: enemyPath[0].x,
		y: enemyPath[0].y,
		kind,
		spriteType,
		ga,
		name: enemyName(kind),
		path: enemyPath,
		speed,
		segment: 0,
		radius: 10,
		hpMax: hp,
		hp: hp,
		bobPhase: Math.random() * Math.PI * 2,
		shielded,
		shieldReduction: shielded ? getShieldReduction(wave) : 0,
		regenRate: kind === 'regen' ? getRegenHealRate(wave) : 0,
		barrierHp: kind === 'barrierSpawner' ? hp * 2 : 0,
		waveNum: wave, // 소속 웨이브 — 병렬 웨이브 완료 추적 + 스폰 시 스펙 고정 기준
	});
	// 출현 요약 카운트 — 분류 키 = 스프라이트 종류 (요약이 스프라이트로 표시)
	game.waveSpawnCounts[spriteType] = (game.waveSpawnCounts[spriteType] || 0) + 1;
	if (kind === 'air' && !game.modal && !hasSeenIntro(AIR_INTRO_KEY)) {
		game.modal = { type: 'airIntro' };
	}
	if (shielded && !game.modal && !hasSeenIntro(SHIELD_INTRO_KEY)) {
		game.modal = { type: 'shieldIntro' };
	}
	if (kind === 'regen' && !game.modal && !hasSeenIntro(REGEN_INTRO_KEY)) {
		game.modal = { type: 'regenIntro' };
	}
	if (kind === 'barrierSpawner' && !game.modal && !hasSeenIntro(BARRIER_INTRO_KEY)) {
		game.modal = { type: 'barrierIntro' };
	}
}

// 장벽 객체 — 일반 적과 game.entities.enemies에 함께 들어감 (e.kind='barrier').
// 공중 타입이라 공중 공격 가능 타워의 타깃이 됨.
export function spawnBarrier(x, y, wave) {
	const hp = computeBaseHpAt(wave) * 2;
	game.entities.enemies.push({
		x, y,
		speed: 0,
		segment: -1,
		radius: BARRIER_RADIUS,
		hpMax: hp,
		hp: hp,
		kind: 'barrier',
		ga: 'air',
		name: enemyName('barrier'),
	});
}

// 장벽 적 처치 시 호출 — 즉시 생성 대신 짧은 애니메이션 후 spawnBarrier.
// wave: 죽은 장벽 적의 웨이브 — 생성될 장벽 HP 기준.
export function startBarrierSpawn(x, y, wave) {
	game.effects.barrierSpawnFx.push({
		x, y, wave,
		life: 0.55,
		maxLife: 0.55,
	});
}

export function updateBarrierSpawnFx(fx, dt) {
	fx.life -= dt;
	if (fx.life <= 0) {
		fx.dead = true;
		spawnBarrier(fx.x, fx.y, fx.wave);
	}
}

// 방어막 무력화 순간의 파쇄 연출 — 관통 공격(disablesModifiers)이 방어막을 깰 때 그 자리에 1회.
export function startShieldBreak(x, y, radius) {
	game.effects.shieldBreakFx.push({ x, y, radius, life: 0.35, maxLife: 0.35 });
}

export function updateShieldBreakFx(fx, dt) {
	fx.life -= dt;
	if (fx.life <= 0) fx.dead = true;
}

export function spawnBoss() {
	const bossType = getBossType(game.wave); // 'ground' | 'air' (= 스프라이트 종류)
	const kind = bossType === 'ground' ? 'groundBoss' : 'airBoss';
	const bossHp = computeBossHp(game.wave);
	const baseSpeed = getEnemyBaseSpeed(game.wave);
	const path = getActiveMap().path;
	game.entities.enemies.push({
		x: path[0].x,
		y: path[0].y,
		path, // 공중 보스도 무조건 정규 경로
		speed: baseSpeed * 0.1,
		segment: 0,
		radius: 18,
		hpMax: bossHp,
		hp: bossHp,
		bobPhase: Math.random() * Math.PI * 2,
		kind,
		spriteType: bossType,
		ga: bossType,
		name: enemyName(kind),
		angle: Math.PI / 2,
	});
	if (!game.modal && !hasSeenIntro(BOSS_INTRO_KEY)) {
		game.modal = { type: 'bossIntro' };
	}
}

// ============ Update ============
export function updateEnemy(e, dt) {
	if (e.kind === 'barrier') {
		// 장벽은 그 자리 고정 — 이동/회복 없음
		return;
	}
	if (e.kind === 'regen') {
		e.regenDisabled = isRegenBlocked(e); // 염라 등 사거리 내면 회복·오라 차단
		if (!e.regenDisabled && e.hp < e.hpMax) {
			e.hp = Math.min(e.hpMax, e.hp + e.hpMax * e.regenRate * dt);
		}
	}
	const path = e.path || getActiveMap().path;
	if (e.segment >= path.length - 1) {
		game.hp -= 1;
		e.dead = true;
		return;
	}
	const target = path[e.segment + 1];
	const dx = target.x - e.x;
	const dy = target.y - e.y;
	const dist = Math.hypot(dx, dy);
	if (isBoss(e) && dist > 0) {
		e.angle = Math.atan2(dy, dx);
	}
	if (e.stunTimer > 0) e.stunTimer = Math.max(0, e.stunTimer - dt); // 제우스 스턴 감소
	const move = e.stunTimer > 0 ? 0 : e.speed * getEnemySpeedFactor(e) * dt; // 스턴 중 이동 정지
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
function drawMarkRing(e) {
	// 래이다르 마킹: 적 주변 회전하는 점선 링 + 중심 십자 (보빙 미반영, e.y 기준)
	const r = e.radius + 6;
	const t = performance.now() / 700;
	ctx.save();
	ctx.translate(e.x, e.y);
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
	for (const e of game.entities.enemies) {
		if (isBoss(e) && !e.dead) { boss = e; break; }
	}
	if (!boss) return;

	const bx = 20;
	const by = 48; // 웨이브 적 출현 요약(상단)과 겹치지 않게 살짝 내림
	const bw = LOGICAL_W - 40;
	const bh = 14;

	ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
	ctx.fillRect(bx, by, bw, bh);

	const ratio = Math.max(0, boss.hp / boss.hpMax);
	ctx.fillStyle = boss.kind === 'airBoss' ? AIR_COLOR : ACCENT_RED;
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
}

// ============ kind 헬퍼 — 적 식별은 kind 단일 기준 ============
export function isBoss(e) {
	return e.kind === 'groundBoss' || e.kind === 'airBoss';
}
// 적 종류 이름 — kind로 결정. 스폰 시 e.name으로 박아 둠.
function enemyName(kind) {
	switch (kind) {
		case 'groundBoss':
		case 'airBoss': return t('enemy.boss');
		case 'barrier': return t('enemy.barrier');
		case 'barrierSpawner': return t('enemy.barrierSpawner.name');
		case 'regen': return t('enemy.regen.name');
		case 'air': return t('enemy.air.name');
		default: return t('enemy.ground.name'); // basic
	}
}

function drawRegenEnemy(e) {
	drawEnemySprite('regen', e.x, e.y, e.radius, { shielded: e.shielded });
	if (!e.regenDisabled) drawRegenAura(e.x, e.y, e.radius + 4);
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

// 본체만 그림. HP바는 호출부(scenes)가 별도 패스로 본체 위에 올림
// (뭉친 적끼리 나중 적 본체가 먼저 적 HP바를 가리는 문제 방지).
// 스턴 표시 — 머리 위를 도는 노란 별 3개 (제우스 등 스턴 공격 피격 시).
function drawStunIndicator(e) {
	const t = performance.now();
	const cx = e.x;
	const cy = e.y - e.radius - 1;
	ctx.fillStyle = '#ffe066';
	for (let i = 0; i < 3; i++) {
		const a = t / 200 + i * (Math.PI * 2 / 3);
		ctx.beginPath();
		ctx.arc(cx + Math.cos(a) * 5, cy + Math.sin(a) * 2.2, 1.5, 0, Math.PI * 2);
		ctx.fill();
	}
}

function drawEnemyBody(e) {
	if (e.kind === 'groundBoss') {
		drawGroundBoss(e);
		if (e.marked) drawMarkRing(e);
		return; // 보스 HP는 고정 UI에 표시
	}
	if (e.kind === 'airBoss') {
		drawAirBoss(e);
		if (e.marked) drawMarkRing(e);
		return;
	}
	if (e.kind === 'regen') {
		drawRegenEnemy(e);
		if (e.marked) drawMarkRing(e);
		return;
	}
	// 공중 적만 본체가 위아래로 보빙 (마크링·HP바는 e.y 고정).
	const bobY = e.ga === 'air' ? e.y + Math.sin(performance.now() / 250 + (e.bobPhase || 0)) * 2 - 3 : e.y;
	drawEnemySprite(e.spriteType, e.x, bobY, e.radius, { shielded: e.shielded });
	if (e.marked) drawMarkRing(e);
}

export function drawEnemy(e) {
	if (e.kind === 'barrier') {
		drawBarrier(e);
		return;
	}
	drawEnemyBody(e);
	if (e.stunTimer > 0) drawStunIndicator(e); // 몸체 위에
}

// ============ 장벽 차단 헬퍼 ============
// 타워(또는 빔 출발점)에서 target까지 직선이 장벽을 통과하는지 검사.
// 시작점이 어떤 장벽 안에 있으면 무조건 차단 (안에서는 공격 불가).
export function isBlockedByBarrier(fromX, fromY, target) {
	for (const b of game.entities.enemies) {
		if (b.kind !== 'barrier' || b.dead) continue;
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
	for (const b of game.entities.enemies) {
		if (b.kind !== 'barrier' || b.dead) continue;
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
	for (const b of game.entities.enemies) {
		if (b.kind !== 'barrier' || b.dead) continue;
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
