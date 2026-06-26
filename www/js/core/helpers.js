import { ctx } from './canvas.js';
import { PATH_WIDTH, AIR_COLOR, ACCENT_RED } from './config.js';
import { getActiveMap } from './maps.js';

// ============ Geometry helpers ============
export function pointToSegmentDist(px, py, ax, ay, bx, by) {
	const dx = bx - ax;
	const dy = by - ay;
	const lenSq = dx * dx + dy * dy;
	let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
	t = Math.max(0, Math.min(1, t));
	const cx = ax + t * dx;
	const cy = ay + t * dy;
	return Math.hypot(px - cx, py - cy);
}

export function distanceToPath(x, y) {
	const path = getActiveMap().path;
	let min = Infinity;
	for (let i = 0; i < path.length - 1; i++) {
		const d = pointToSegmentDist(x, y, path[i].x, path[i].y, path[i + 1].x, path[i + 1].y);
		if (d < min) min = d;
	}
	return min;
}

// 지름길(airShortcutCut)까지 최단 거리 — 없으면 Infinity. 배치 판정은 정규 경로보다 완화(tower.js).
export function distanceToShortcut(x, y) {
	const cut = getActiveMap().airShortcutCut;
	if (!cut) return Infinity;
	let min = Infinity;
	for (let i = 0; i < cut.length - 1; i++) {
		const d = pointToSegmentDist(x, y, cut[i].x, cut[i].y, cut[i + 1].x, cut[i + 1].y);
		if (d < min) min = d;
	}
	return min;
}

// ============ Drawing helpers ============
export function roundRect(x, y, w, h, r) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.arcTo(x + w, y, x + w, y + h, r);
	ctx.arcTo(x + w, y + h, x, y + h, r);
	ctx.arcTo(x, y + h, x, y, r);
	ctx.arcTo(x, y, x + w, y, r);
	ctx.closePath();
}

// 공용 패널 배경 — 둥근 사각형 채움 + 테두리 (카드·모달 공통).
export function drawPanel(x, y, w, h, opts = {}) {
	const { radius = 10, fill = '#1a2535', stroke = '#fff', lineWidth = 2, alpha = 1 } = opts;
	ctx.globalAlpha = alpha;
	ctx.fillStyle = fill;
	roundRect(x, y, w, h, radius);
	ctx.fill();
	ctx.globalAlpha = 1;
	ctx.strokeStyle = stroke;
	ctx.lineWidth = lineWidth;
	ctx.stroke();
}

export function drawButton(btn, label) {
	ctx.fillStyle = ACCENT_RED;
	roundRect(btn.x, btn.y, btn.w, btn.h, 14);
	ctx.fill();
	ctx.strokeStyle = '#fff';
	ctx.lineWidth = 2;
	ctx.stroke();
	ctx.fillStyle = '#fff';
	ctx.font = 'bold 22px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2);
	ctx.textBaseline = 'alphabetic';
}

export function hitButton(btn, p) {
	return p.x >= btn.x && p.x <= btn.x + btn.w && p.y >= btn.y && p.y <= btn.y + btn.h;
}

export function drawPath(alpha = 1) {
	const map = getActiveMap();
	const path = map.path;
	ctx.globalAlpha = alpha;
	ctx.strokeStyle = '#8a7a5a';
	ctx.lineWidth = PATH_WIDTH;
	ctx.lineJoin = 'round';
	ctx.beginPath();
	ctx.moveTo(path[0].x, path[0].y);
	for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
	ctx.stroke();

	// 공중 지름길 — 정규 경로와 구분되게 공중색 점선
	const cut = map.airShortcutCut;
	if (cut) {
		ctx.strokeStyle = AIR_COLOR;
		ctx.lineWidth = PATH_WIDTH * 0.55;
		ctx.setLineDash([6, 5]);
		ctx.beginPath();
		ctx.moveTo(cut[0].x, cut[0].y);
		for (let i = 1; i < cut.length; i++) ctx.lineTo(cut[i].x, cut[i].y);
		ctx.stroke();
		ctx.setLineDash([]);
		// 양 끝 접합부를 점선 위상과 무관하게 동일하게 — 정규 경로와 맞닿는 지점에 둥근 조인트
		ctx.fillStyle = AIR_COLOR;
		for (const pt of cut) {
			ctx.beginPath();
			ctx.arc(pt.x, pt.y, PATH_WIDTH * 0.55 / 2, 0, Math.PI * 2);
			ctx.fill();
		}
	}
	ctx.globalAlpha = 1;
}

export function drawCloseX(btn) {
	ctx.fillStyle = ACCENT_RED;
	roundRect(btn.x, btn.y, btn.w, btn.h, 6);
	ctx.fill();
	ctx.strokeStyle = '#fff';
	ctx.lineWidth = 1;
	ctx.stroke();
	ctx.fillStyle = '#fff';
	ctx.font = 'bold 18px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('×', btn.x + btn.w / 2, btn.y + btn.h / 2);
	ctx.textBaseline = 'alphabetic';
}
