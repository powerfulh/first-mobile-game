// 적 스프라이트·공용 렌더 프리미티브 (HP바·마크링·재생 오라 등 게임 오버레이는 제외).
// 게임/위키/인트로/정보패널/HUD 요약이 공유. 타워 본체 스프라이트는 ./sprite/tower.js.
import { ctx } from '../core/canvas.js';
import { AIR_COLOR, ACCENT_RED, GOLD, INFO_BLUE, TOWER, BARRIER_RADIUS, EMP_COLOR } from '../core/config.js';
import { roundRect } from '../core/helpers.js';

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

// 사거리 합집합 채움용 오프스크린 레이어 — 메인 캔버스 해상도에 맞춰 (재)생성.
let rangeLayer = null;
function getRangeLayer(main) {
	if (!rangeLayer || rangeLayer.width !== main.width || rangeLayer.height !== main.height) {
		rangeLayer = document.createElement('canvas');
		rangeLayer.width = main.width;
		rangeLayer.height = main.height;
	}
	return rangeLayer;
}

// 여러 타워의 사거리를 한 번에 — 오프스크린에 불투명하게 합쳐 그린 뒤 1회 반투명 합성.
// 사거리가 겹쳐도 채움 농도가 진해지지 않음 (합집합). minRange 구멍도 다른 타워가 덮으면 채워짐.
// 테두리는 기존 per-타워 방식 그대로.
export function drawTowerRangesUnion(towers, fillAlpha, strokeAlpha) {
	if (towers.length === 0) return;

	const layer = getRangeLayer(ctx.canvas);
	const lctx = layer.getContext('2d');
	lctx.setTransform(1, 0, 0, 1, 0, 0);
	lctx.clearRect(0, 0, layer.width, layer.height);
	lctx.setTransform(ctx.getTransform()); // 메인과 동일한 논리 좌표계로 그림
	lctx.fillStyle = '#3498db';
	for (const tower of towers) {
		const minRange = tower.cfg.minRange || 0;
		lctx.beginPath();
		lctx.arc(tower.x, tower.y, tower.range, 0, Math.PI * 2);
		if (minRange > 0) lctx.arc(tower.x, tower.y, minRange, 0, Math.PI * 2, true);
		lctx.fill('evenodd');
	}

	ctx.save();
	ctx.setTransform(1, 0, 0, 1, 0, 0); // 디바이스 픽셀 1:1 합성
	ctx.globalAlpha = fillAlpha;
	ctx.drawImage(layer, 0, 0);
	ctx.restore();

	for (const tower of towers) drawTowerRange(tower, 0, strokeAlpha); // 테두리만
}

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
	} else if (type === 'emp') {
		// 신규 지상 적(emp) — 일반 적(빨강 원)이 4등분으로 쪼개져
		// 살짝 벌어진 채 뭉쳐 있고, 중앙의 에너지가 조각들을 간신히 붙들고 있는 연출.
		const gap = r * 0.16; // 조각이 중심에서 벌어진 거리
		const pieceR = r * 0.88;
		ctx.strokeStyle = stroke;
		ctx.lineWidth = strokeW;
		for (let i = 0; i < 4; i++) {
			const start = i * Math.PI / 2;
			const mid = start + Math.PI / 4; // 조각 중심 방향 — 이 방향으로 벌어짐
			const ox = cx + Math.cos(mid) * gap;
			const oy = cy + Math.sin(mid) * gap;
			ctx.fillStyle = ACCENT_RED;
			ctx.beginPath();
			ctx.moveTo(ox, oy);
			ctx.arc(ox, oy, pieceR, start, start + Math.PI / 2);
			ctx.closePath();
			ctx.fill();
			ctx.stroke();
		}
		// 중앙 결속 에너지 (짙은 파랑) — 맥동하며 조각을 미세하게 붙듦
		const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 300);
		ctx.fillStyle = EMP_COLOR;
		ctx.globalAlpha = 0.55 + 0.35 * pulse;
		ctx.beginPath();
		ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
		ctx.fill();
		ctx.globalAlpha = 1;
		ctx.fillStyle = '#2874a6';
		ctx.beginPath();
		ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
		ctx.fill();
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

// 모래시계 아이콘 — 위/아래 가로대 + 중앙이 잘록한 몸통 + 아래에 쌓인 모래
// spin=true면 중심 기준으로 천천히 회전 (예약 진행 중 표시).
export function drawHourglassIcon(cx, cy, spin = false) {
	ctx.save();
	ctx.translate(cx, cy);
	if (spin) ctx.rotate((performance.now() / 500) % (Math.PI * 2));
	ctx.strokeStyle = '#fff';
	ctx.lineWidth = 1.5;
	// 위·아래 가로대
	ctx.beginPath();
	ctx.moveTo(-5, -6);
	ctx.lineTo(5, -6);
	ctx.moveTo(-5, 6);
	ctx.lineTo(5, 6);
	ctx.stroke();
	// 몸통 — 좌우 곡선이 중앙에서 잘록하게 만남
	ctx.beginPath();
	ctx.moveTo(-4, -6);
	ctx.quadraticCurveTo(-4, -2, 0, 0);
	ctx.quadraticCurveTo(-4, 2, -4, 6);
	ctx.moveTo(4, -6);
	ctx.quadraticCurveTo(4, -2, 0, 0);
	ctx.quadraticCurveTo(4, 2, 4, 6);
	ctx.stroke();
	// 아래쪽에 쌓인 모래
	ctx.fillStyle = '#fff';
	ctx.beginPath();
	ctx.moveTo(0, 1);
	ctx.lineTo(2.5, 5);
	ctx.lineTo(-2.5, 5);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}

// 신규 기능 ? 배지 — 버튼 우상단 모서리. 미열람 안내가 걸린 버튼(추가 웨이브·예약 등) 공용.
export function drawNewBadge(btn) {
	const bx = btn.x + btn.w - 3;
	const by = btn.y + 3;
	ctx.fillStyle = GOLD;
	ctx.beginPath();
	ctx.arc(bx, by, 8, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#1a2535';
	ctx.font = 'bold 12px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('?', bx, by + 1);
	ctx.textBaseline = 'alphabetic';
	ctx.textAlign = 'left';
}

// EMP 장치 연출 — EMP 적 처치 지점의 장치 코어 + 대상 타워로 뻗는 지그재그 충격파.
// 상태 관리·수명은 enemy.js. 지터는 매 프레임 재생성 → 전기 플리커.
export function drawEmpDevice(d) {
	const alpha = Math.min(1, d.life / 0.25); // 소멸 직전 페이드아웃
	const target = d.target;

	// 지그재그 충격파 — 장치 → 대상 타워
	const dx = target.x - d.x;
	const dy = target.y - d.y;
	const dist = Math.hypot(dx, dy);
	const perpX = dist > 0 ? -dy / dist : 0;
	const perpY = dist > 0 ? dx / dist : 0;
	const segments = 6;
	ctx.beginPath();
	ctx.moveTo(d.x, d.y);
	for (let s = 1; s <= segments; s++) {
		const t = s / segments;
		const offset = s === segments ? 0 : (Math.random() - 0.5) * 14;
		ctx.lineTo(d.x + dx * t + perpX * offset, d.y + dy * t + perpY * offset);
	}
	ctx.lineJoin = 'round';
	ctx.globalAlpha = alpha * 0.5; // 외곽 광채 (짙은 파랑)
	ctx.strokeStyle = '#2874a6';
	ctx.lineWidth = 4;
	ctx.stroke();
	ctx.globalAlpha = alpha; // 내부 코어 (흰색)
	ctx.strokeStyle = '#fff';
	ctx.lineWidth = 1.5;
	ctx.stroke();

	// 장치 코어 — 적 스프라이트의 결속 에너지와 같은 계열 (짙은 파랑 글로우 + 흰 점)
	const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 120);
	ctx.globalAlpha = alpha * (0.5 + 0.4 * pulse);
	ctx.fillStyle = EMP_COLOR;
	ctx.beginPath();
	ctx.arc(d.x, d.y, 6, 0, Math.PI * 2);
	ctx.fill();
	ctx.globalAlpha = alpha;
	ctx.fillStyle = '#fff';
	ctx.beginPath();
	ctx.arc(d.x, d.y, 2, 0, Math.PI * 2);
	ctx.fill();
	ctx.globalAlpha = 1;
}
