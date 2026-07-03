// 적·타워 스프라이트 — 본체 모양만 그림 (HP바·마크링·재생 오라 등 게임 오버레이는 제외).
// 게임/위키/인트로/정보패널/HUD 요약이 공유하는 순수 렌더 프리미티브.
import { ctx } from '../core/canvas.js';
import { AIR_COLOR, ACCENT_RED, GOLD, INFO_BLUE, TOWER } from '../core/config.js';
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
