import { ctx } from './canvas.js';
import { ACCENT_RED } from './config.js';

// ============ 일반 유틸 ============
// 배열이 비어있지 않은지 (null/undefined 안전).
export const hasItems = (arr) => !!arr && arr.length > 0;
// 소수 1자리 반올림 (게임 수치 표시·누적 공통).
export const round1 = (x) => Math.round(x * 10) / 10;
// v를 [lo, hi] 범위로 클램프.
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ============ Geometry helpers ============
export function pointToSegmentDist(px, py, ax, ay, bx, by) {
	const dx = bx - ax;
	const dy = by - ay;
	const lenSq = dx * dx + dy * dy;
	let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
	t = clamp(t, 0, 1);
	const cx = ax + t * dx;
	const cy = ay + t * dy;
	return Math.hypot(px - cx, py - cy);
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

