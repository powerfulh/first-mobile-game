// 적·타워 스프라이트 — 본체 모양만 그림 (HP바·마크링·재생 오라 등 게임 오버레이는 제외).
// 게임/위키/인트로/정보패널/HUD 요약이 공유하는 순수 렌더 프리미티브.
import { ctx } from '../core/canvas.js';
import { AIR_COLOR, ACCENT_RED, GOLD, INFO_BLUE, TOWER, BARRIER_RADIUS } from '../core/config.js';
import { roundRect, hasItems } from '../core/helpers.js';

export function drawEnemySprite(type, cx, cy, r, opts = {}) {
	const stroke = opts.shielded ? INFO_BLUE : '#000';
	const strokeW = opts.shielded ? 2 : 1;

	if (type === 'ground') {
		ctx.fillStyle = ACCENT_RED;
		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = stroke;
		ctx.lineWidth = strokeW;
		ctx.stroke();
	} else if (type === 'air') {
		ctx.fillStyle = AIR_COLOR;
		ctx.beginPath();
		ctx.moveTo(cx, cy - r);
		ctx.lineTo(cx - r * 0.9, cy + r * 0.6);
		ctx.lineTo(cx + r * 0.9, cy + r * 0.6);
		ctx.closePath();
		ctx.fill();
		ctx.strokeStyle = stroke;
		ctx.lineWidth = strokeW;
		ctx.stroke();
	} else if (type === 'regen') {
		const w = r * 1.8;
		const x = cx - w / 2;
		const y = cy - w / 2;
		const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 600);
		ctx.globalAlpha = 0.25 + 0.25 * pulse;
		ctx.fillStyle = '#2ecc71';
		roundRect(x - 3, y - 3, w + 6, w + 6, 5);
		ctx.fill();
		ctx.globalAlpha = 1;
		ctx.fillStyle = '#1e8449';
		roundRect(x, y, w, w, 3);
		ctx.fill();
		ctx.strokeStyle = stroke;
		ctx.lineWidth = strokeW;
		ctx.stroke();
	} else if (type === 'barrierSpawner') {
		ctx.fillStyle = AIR_COLOR;
		ctx.beginPath();
		ctx.moveTo(cx - r * 0.9, cy - r * 0.6);
		ctx.lineTo(cx + r * 0.9, cy - r * 0.6);
		ctx.lineTo(cx, cy + r);
		ctx.closePath();
		ctx.fill();
		ctx.strokeStyle = stroke;
		ctx.lineWidth = strokeW;
		ctx.stroke();

		// 내부 장벽 미니어처 (반투명 디스크 + 십자)
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
		ctx.beginPath();
		ctx.moveTo(cx - inR, inY);
		ctx.lineTo(cx + inR, inY);
		ctx.moveTo(cx, inY - inR);
		ctx.lineTo(cx, inY + inR);
		ctx.stroke();
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

// 공중 전용 대공포(개틀링 제외) 공용 외형 — 작은 몸체 + 얇은 배럴 + 지면 고정 장치 4개.
function drawAirGunBody(tower, selected) {
	const cfg = tower.cfg;
	const r = TOWER.radius - 2; // 약간 작은 몸체

	// 지면 고정 장치 4개 — 대각선 방향, 배럴 회전과 무관하게 고정 (시즈모드식 앵커). 몸체보다 먼저 그려 안쪽 끝이 가려짐.
	ctx.strokeStyle = cfg.color2;
	ctx.lineWidth = 4;
	for (let i = 0; i < 4; i++) {
		const a = Math.PI / 4 + i * Math.PI / 2; // 45°·135°·225°·315°
		ctx.beginPath();
		ctx.moveTo(tower.x + Math.cos(a) * (r - 1), tower.y + Math.sin(a) * (r - 1));
		ctx.lineTo(tower.x + Math.cos(a) * (r + 7), tower.y + Math.sin(a) * (r + 7));
		ctx.stroke();
	}

	// 몸체 원
	ctx.fillStyle = cfg.color;
	ctx.beginPath();
	ctx.arc(tower.x, tower.y, r, 0, Math.PI * 2);
	ctx.fill();
	applyBodyStrokeStyle(selected, cfg.color2);
	ctx.stroke();

	// 배럴 — 기본 외형과 같은 길이, 얇게만 (높이 4)
	ctx.save();
	ctx.translate(tower.x, tower.y);
	ctx.rotate(tower.angle);
	ctx.fillStyle = cfg.color2;
	ctx.fillRect(0, -2, TOWER.radius + 4, 4);
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

// 개틀링 반동 배럴 사이클 — 모든 개틀링이 공유하는 렌더 전용 상태(발사 로직과 무관).
// 시간 기반으로 배럴을 순번 전환하고, 각 배럴은 전환 직후 최대로 킥백했다가 다음 전환까지 복귀.
// 애니메이션 전용 간격 — 실제 발사(50ms/20연사)보다 조금 느리게 두어 순차 반동이 눈에 띄게.
const GATLING_BARREL_INTERVAL_MS = 100;
let gatlingBarrel = 0;      // 현재 킥 중인 배럴 (0,1,2)
let gatlingBarrelAt = 0;    // 마지막 전환 시각(ms)

// { barrel, kick } 반환 — 애니메이션 간격마다 배럴을 전환. kick은 -5→0 감쇠.
function gatlingRecoil() {
	const now = performance.now();
	if (now - gatlingBarrelAt >= GATLING_BARREL_INTERVAL_MS) {
		gatlingBarrel = (gatlingBarrel + 1) % 3;
		gatlingBarrelAt = now;
	}
	const frac = Math.max(0, 1 - (now - gatlingBarrelAt) / GATLING_BARREL_INTERVAL_MS); // 1(직후)→0(전환 직전)
	return { barrel: gatlingBarrel, kick: -5 * frac };
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

	// 발사 반동 — 공유 사이클로 총구 하나씩 순번대로 킥백. 발사 중(cooldown>0)에만 표시해
	// 유휴·프리뷰 타워는 정지 상태로 그려짐.
	const { barrel, kick } = gatlingRecoil();
	const firing = tower.cooldown > 0;
	const barrelOffset = (barrelNum) => (firing && barrelNum === barrel ? kick : 0);

	// i=-1,0,1 → 배럴 번호 0,1,2 (위→중앙→아래)
	ctx.fillStyle = cfg.color2;
	for (let i = -1; i <= 1; i++) {
		const offY = i * 3.5;
		ctx.fillRect(barrelOffset(i + 1), offY - 1.2, r + 4, 2.4);
	}

	// 배럴 끝 강조
	ctx.fillStyle = cfg.color;
	for (let i = -1; i <= 1; i++) {
		const offY = i * 3.5;
		ctx.fillRect(r + barrelOffset(i + 1) + 2, offY - 1.2, 2, 2.4);
	}

	ctx.restore();

	// 중심 캡(회전축 표시)
	ctx.fillStyle = cfg.color2;
	ctx.beginPath();
	ctx.arc(tower.x, tower.y, 2, 0, Math.PI * 2);
	ctx.fill();
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
	const cfg = tower.cfg;
	const sweep = (performance.now() / 600) % (Math.PI * 2);
	ctx.save();
	ctx.translate(tower.x, tower.y);
	ctx.rotate(sweep);

	// 디시 윤곽
	ctx.fillStyle = cfg.color2;
	ctx.beginPath();
	ctx.arc(0, 0, 6, -Math.PI * 0.4, Math.PI * 0.4);
	ctx.lineTo(0, 0);
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = '#fff';
	ctx.lineWidth = 1;
	ctx.stroke();

	// 스윕 라인 (옅게 길게) — 알파는 restore가 복원
	ctx.globalAlpha = 0.45;
	ctx.strokeStyle = cfg.color2;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(TOWER.radius + 10, 0);
	ctx.stroke();
	ctx.restore();
}

// 에너지 볼 — 방사형 글로우 + 컨테인먼트 링 + 역방향 회전 아크 + 응축 중심. (cx,cy) 중심, 반지름 r.
// 리솔버 중앙 코어이자, 리솔버 버프받은 타워 주변을 공전하는 마커로 공용.
export function drawEnergyBall(cx, cy, r) {
	const time = performance.now();
	const charge = 0.5 + 0.5 * Math.sin(time / 500); // 축전 펄스 0~1

	// 방사형 글로우
	const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
	glow.addColorStop(0, `rgba(224, 250, 255, ${0.85 + 0.15 * charge})`);
	glow.addColorStop(0.5, `rgba(110, 200, 255, ${0.55 + 0.3 * charge})`);
	glow.addColorStop(1, 'rgba(60, 130, 220, 0)');
	ctx.fillStyle = glow;
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.fill();

	// 컨테인먼트 링 + 역방향 회전 아크 2개
	const ringR = r * 0.78;
	ctx.strokeStyle = 'rgba(210, 240, 255, 0.35)';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
	ctx.stroke();
	for (let k = 0; k < 2; k++) {
		const dir = k === 0 ? 1 : -1;
		const base = dir * time / 320 + k * Math.PI;
		ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 + 0.4 * charge})`;
		ctx.beginPath();
		ctx.arc(cx, cy, ringR, base, base + Math.PI * 0.55);
		ctx.stroke();
	}

	// 응축 중심
	ctx.fillStyle = `rgba(255, 255, 255, ${0.75 + 0.25 * charge})`;
	ctx.beginPath();
	ctx.arc(cx, cy, r * (0.28 + 0.1 * charge), 0, Math.PI * 2);
	ctx.fill();
}

// 리솔버(레이더+어쌔신+개틀링) — base 계열 8각 셸 + 중앙 초고에너지 발전기(에너지 저장 느낌). 점선 링 없음.
// 5티어 전용 고퀄 외형: 리세스 하우징 + 코너 볼트 + 에너지 볼(drawEnergyBall).
function drawEnergyCoreBody(tower, selected) {
	const cfg = tower.cfg;
	const r = TOWER.radius;
	const cx = tower.x;
	const cy = tower.y;

	const octagonPath = (radius) => {
		ctx.beginPath();
		for (let i = 0; i < 8; i++) {
			const a = i * Math.PI / 4 + Math.PI / 8;
			const px = cx + radius * Math.cos(a);
			const py = cy + radius * Math.sin(a);
			if (i === 0) ctx.moveTo(px, py);
			else ctx.lineTo(px, py);
		}
		ctx.closePath();
	};

	// 외곽 8각 셸
	ctx.fillStyle = cfg.color;
	octagonPath(r);
	ctx.fill();
	applyBodyStrokeStyle(selected, cfg.color2);
	ctx.stroke();

	// 발전기 하우징(리세스) — 어두운 8각 플레이트로 깊이감
	ctx.fillStyle = cfg.color2;
	octagonPath(r * 0.66);
	ctx.fill();

	// 코너 볼트 (기계 디테일)
	ctx.fillStyle = cfg.color2;
	for (let i = 0; i < 8; i++) {
		const a = i * Math.PI / 4 + Math.PI / 8;
		ctx.beginPath();
		ctx.arc(cx + Math.cos(a) * (r - 2.5), cy + Math.sin(a) * (r - 2.5), 1, 0, Math.PI * 2);
		ctx.fill();
	}

	// 중앙 에너지 볼 (저장된 에너지)
	drawEnergyBall(cx, cy, r * 0.44);
}

// 드래곤 응축기 입자 풀 — 랜덤 방향에서 초점으로 연속 유입되는 점들. 렌더 전용 공유 상태.
const condenserParticles = [];
let condenserPrevTime = 0;
function respawnCondenserParticle(p) {
	p.ang = Math.random() * Math.PI * 2;                 // 랜덤 방향
	p.dist = TOWER.radius * (0.6 + Math.random() * 0.6);
	p.t = 1;                                             // 1(바깥)→0(초점)
	p.speed = 0.7 + Math.random() * 0.9;                 // 초당 t 감소량
}
function updateCondenserParticles(time) {
	if (condenserParticles.length === 0) {
		for (let i = 0; i < 16; i++) { const p = {}; respawnCondenserParticle(p); p.t = Math.random(); condenserParticles.push(p); }
	}
	let dt = (time - condenserPrevTime) / 1000;
	condenserPrevTime = time;
	if (dt > 0.1) dt = 0.016; // 첫 프레임·탭 복귀 보호
	if (dt < 0) dt = 0;       // 같은 프레임 재호출(다중 타워) → 이중 전진 방지
	for (const p of condenserParticles) {
		p.t -= p.speed * dt;
		if (p.t <= 0) respawnCondenserParticle(p);
	}
}

// 드래곤(어쌔신+개틀링+사일로) — 필더 계열 육각 몸체 + 오목 응축 패널 + 2 집게(전극) + 랜덤 방향 연속 유입 입자 → 시안 응축 코어.
function drawCondenserBody(tower, selected) {
	const cfg = tower.cfg;
	const r = TOWER.radius;
	const cx = tower.x;
	const cy = tower.y;
	const time = performance.now();

	// 육각 몸체 (필더 계열) — 고정
	ctx.fillStyle = cfg.color;
	ctx.beginPath();
	for (let i = 0; i < 6; i++) {
		const a = i * Math.PI / 3 - Math.PI / 2;
		const px = cx + r * Math.cos(a);
		const py = cy + r * Math.sin(a);
		if (i === 0) ctx.moveTo(px, py);
		else ctx.lineTo(px, py);
	}
	ctx.closePath();
	ctx.fill();
	applyBodyStrokeStyle(selected, cfg.color2);
	ctx.stroke();

	// 응축 이미터 — 조준(tower.angle) 방향으로 회전 (로컬 -y가 전방)
	ctx.save();
	ctx.translate(cx, cy);
	ctx.rotate(tower.angle + Math.PI / 2);

	const fy = -r * 0.3; // 초점 (로컬 전방)

	// 오목 응축 패널 — 후방의 얕은 접시(⌣)
	ctx.strokeStyle = cfg.color2;
	ctx.lineWidth = 3;
	ctx.beginPath();
	ctx.arc(0, r * 0.15, r * 0.62, Math.PI * 0.15, Math.PI * 0.85);
	ctx.stroke();

	// 2 응축 집게(전극) — 패널에서 초점으로 굽어 나감
	ctx.lineWidth = 2.5;
	for (const side of [-1, 1]) {
		ctx.beginPath();
		ctx.moveTo(side * r * 0.5, r * 0.28);
		ctx.lineTo(side * r * 0.62, -r * 0.05);
		ctx.lineTo(side * r * 0.2, fy + r * 0.08);
		ctx.stroke();
	}

	// 연속 응축 입자 — 랜덤 방향에서 초점으로 (초점에 가까울수록 진해짐)
	updateCondenserParticles(time);
	ctx.fillStyle = '#bdf0ff';
	for (const p of condenserParticles) {
		ctx.globalAlpha = 0.85 * (1 - p.t);
		ctx.beginPath();
		ctx.arc(Math.cos(p.ang) * p.dist * p.t, fy + Math.sin(p.ang) * p.dist * p.t, 1.2, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.globalAlpha = 1;

	// 응축 코어 (초점) — 시안 백색 발광, 맥동
	const pulse = 0.5 + 0.5 * Math.sin(time / 300);
	const glow = ctx.createRadialGradient(0, fy, 0, 0, fy, 5 + pulse);
	glow.addColorStop(0, `rgba(235, 252, 255, ${0.8 + 0.2 * pulse})`);
	glow.addColorStop(0.5, `rgba(120, 210, 255, ${0.45 + 0.3 * pulse})`);
	glow.addColorStop(1, 'rgba(60, 150, 240, 0)');
	ctx.fillStyle = glow;
	ctx.beginPath();
	ctx.arc(0, fy, 3.5 + 1.5 * pulse, 0, Math.PI * 2);
	ctx.fill();

	ctx.restore();
}

// 타워 외형(본체 + 레이더 안테나)의 유일한 렌더 진입점 — 게임·위키·카드·고스트 공용.
// 인스턴스 전용 연출(4티어 후광·전직 펄스·XP 바)은 drawTower가 담당.
// angle·cooldown 기본값은 그림용(위쪽 조준·발사 연출 없음), 실제 타워는 live 값을 전달.
export function drawTowerSprite(cfg, x, y, { radius = TOWER.radius, angle = -Math.PI / 2, cooldown = 0, selected = false } = {}) {
	const tower = { x: 0, y: 0, cfg, angle, cooldown }; // 본체 함수 공용 인자 묶음 (내부 구현)
	// 본체는 원점에 TOWER.radius 기준으로 그려짐 → 원하는 반지름이면 비율만큼 확대/축소.
	const scale = radius / TOWER.radius;
	ctx.save();
	ctx.translate(x, y);
	if (scale !== 1) ctx.scale(scale, scale);

	if (cfg.body === 'energyCore') {
		drawEnergyCoreBody(tower, selected);
	} else if (cfg.body === 'condenser') {
		drawCondenserBody(tower, selected);
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
	} else if ((cfg.attackTypes || []).length === 1 && cfg.attackTypes[0] === 'air') {
		drawAirGunBody(tower, selected); // 공중 전용(개틀링 제외 — 위 scatterDeg 분기가 선점)
	} else {
		drawCannonBody(tower, selected);
	}

	if (cfg.marksEnemies) drawRadarAntenna(tower);
	ctx.restore();
}

// 4티어 공통 후광 — 회전하는 6개 점. 타워 참조만 받아 본체 반지름 바깥에 그림.
export function drawTier4Halo(tower) {
	const HALO_MARGIN = 8;                   // 타워 본체 반지름보다 이만큼 바깥에 후광을 그림
	const haloR = TOWER.radius + HALO_MARGIN;
	const cx = tower.x;
	const cy = tower.y;
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

// 5티어 공통 후광 — 옅은 금빛 링 + 그 위를 공전하는 금빛 점 5개(penta). 4티어(검은 점만, 링 없음)와
// 색(금)·형태(링 추가)·개수(5)로 명확히 구분하되, 링/점을 얇고 옅게 유지해 과하지 않게.
export function drawTier5Halo(tower) {
	const cx = tower.x;
	const cy = tower.y;
	const haloR = TOWER.radius + 9;
	const time = performance.now();

	// 옅은 금빛 링
	ctx.strokeStyle = 'rgba(245, 215, 110, 0.28)';
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
	ctx.stroke();

	// 공전하는 금빛 점 8개
	for (let i = 0; i < 8; i++) {
		const angle = (Math.PI * 2 * i / 8) + time / 620;
		const px = cx + Math.cos(angle) * haloR;
		const py = cy + Math.sin(angle) * haloR;
		const alpha = 0.4 + 0.4 * (0.5 + 0.5 * Math.sin(time / 300 + i * 1.25));
		ctx.fillStyle = `rgba(245, 215, 110, ${alpha})`;
		ctx.beginPath();
		ctx.arc(px, py, 1.8, 0, Math.PI * 2);
		ctx.fill();
	}
}

// 타워 사거리 표시 — 채움 원(+ minRange 도넛) + 테두리. range·minRange 모두 tower가 들고 있는 값.
export function drawTowerRange(tower, fillAlpha, strokeAlpha) {
	const range = tower.range;
	const minRange = tower.cfg.minRange || 0;

	ctx.globalAlpha = fillAlpha;
	ctx.fillStyle = '#3498db';
	ctx.beginPath();
	ctx.arc(tower.x, tower.y, range, 0, Math.PI * 2);
	if (minRange > 0) {
		// 도넛 — 내경을 반대 방향으로 추가 후 evenodd로 가운데 비움
		ctx.arc(tower.x, tower.y, minRange, 0, Math.PI * 2, true);
	}
	ctx.fill('evenodd');

	ctx.globalAlpha = strokeAlpha;
	ctx.strokeStyle = INFO_BLUE;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.arc(tower.x, tower.y, range, 0, Math.PI * 2);
	ctx.stroke();
	if (minRange > 0) {
		ctx.beginPath();
		ctx.arc(tower.x, tower.y, minRange, 0, Math.PI * 2);
		ctx.stroke();
	}
	ctx.globalAlpha = 1;
}

// 장벽 생성 연출 — 장벽 적 처치 후 장벽이 나타나기까지의 fx. 상태 관리·수명은 enemy.js.
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

// 방어막 파쇄 연출 — 관통 공격이 방어막을 깬 순간의 fx. 상태 관리·수명은 enemy.js.
export function drawShieldBreakFx(fx) {
	const t = 1 - fx.life / fx.maxLife; // 0 → 1
	const baseR = fx.radius + 3;

	// 흩어지는 방어막 파편 — 호 조각이 바깥으로 퍼지며(살짝 회전) 사라짐
	ctx.strokeStyle = INFO_BLUE;
	ctx.lineWidth = 2;
	ctx.globalAlpha = Math.max(0, 1 - t);
	const shards = 8;
	for (let i = 0; i < shards; i++) {
		const a = (Math.PI * 2 * i / shards) + t * 0.6;
		const rr = baseR + t * 12;
		const half = 0.35 * (1 - t); // 조각 길이 점차 축소
		ctx.beginPath();
		ctx.arc(fx.x, fx.y, rr, a - half, a + half);
		ctx.stroke();
	}

	// 관통 섬광 — 초반에 짧게 번쩍이는 흰 링
	const flash = Math.max(0, 1 - t * 2.5);
	if (flash > 0) {
		ctx.globalAlpha = flash;
		ctx.strokeStyle = '#fff';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(fx.x, fx.y, baseR, 0, Math.PI * 2);
		ctx.stroke();
	}

	ctx.globalAlpha = 1;
}

// 금지 기호 (원 + 대각선) — 비활성 표시 오버레이.
export function drawProhibition(cx, cy, r) {
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

// ============ 버튼 아이콘 ============
// 중심 좌표만 받는 순수 아이콘 — 버튼 배경은 호출부(ui/panel) 담당.

// 기어 아이콘 (이빨 + 링 + 중심)
export function drawGearIcon(cx, cy) {
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

// 휴지통 아이콘 (뚜껑·손잡이 + 몸통 + 세로 줄) — 파괴적 동작이라 붉은색
export function drawTrashIcon(cx, cy) {
	ctx.strokeStyle = ACCENT_RED;
	ctx.lineWidth = 1.5;
	// 뚜껑 + 손잡이
	ctx.beginPath();
	ctx.moveTo(cx - 6, cy - 4);
	ctx.lineTo(cx + 6, cy - 4);
	ctx.moveTo(cx - 2, cy - 4);
	ctx.lineTo(cx - 2, cy - 6);
	ctx.lineTo(cx + 2, cy - 6);
	ctx.lineTo(cx + 2, cy - 4);
	ctx.stroke();
	// 몸통 — 아래로 살짝 좁아지는 사다리꼴
	ctx.beginPath();
	ctx.moveTo(cx - 5, cy - 2);
	ctx.lineTo(cx - 4, cy + 6);
	ctx.lineTo(cx + 4, cy + 6);
	ctx.lineTo(cx + 5, cy - 2);
	ctx.closePath();
	ctx.stroke();
	// 세로 줄 2개
	ctx.beginPath();
	ctx.moveTo(cx - 1.5, cy);
	ctx.lineTo(cx - 1.5, cy + 4);
	ctx.moveTo(cx + 1.5, cy);
	ctx.lineTo(cx + 1.5, cy + 4);
	ctx.stroke();
}

// 펼친 책 아이콘 — 등뼈 기준 좌우 페이지 외곽 + 등뼈
export function drawBookIcon(cx, cy) {
	ctx.strokeStyle = '#fff';
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.moveTo(cx, cy - 4);
	ctx.quadraticCurveTo(cx - 4, cy - 7, cx - 8, cy - 5);
	ctx.lineTo(cx - 8, cy + 4);
	ctx.quadraticCurveTo(cx - 4, cy + 2, cx, cy + 5);
	ctx.quadraticCurveTo(cx + 4, cy + 2, cx + 8, cy + 4);
	ctx.lineTo(cx + 8, cy - 5);
	ctx.quadraticCurveTo(cx + 4, cy - 7, cx, cy - 4);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(cx, cy - 4);
	ctx.lineTo(cx, cy + 5);
	ctx.stroke();
}
