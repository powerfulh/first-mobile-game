import { ctx } from './canvas.js';
import { ACCENT_RED, PATH_WIDTH } from './config.js';

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

// 지하도 선분 목록 — path의 인접 underpass 마커 쌍(연속 구간)마다 { a, b } 선분을 파생.
// 그리기(ui.drawUnderpass)·배치 판정(tower.canPlaceTower) 공용.
// 숏컷과 달리 이동 분기는 없음 — 정규 경로 그대로 지나가되 그 구간에서 숨고 조준 불가(enemy.isInUnderpass).
export function underpassSegments(map) {
	const path = map.path;
	const segments = [];
	for (let i = 0; i < path.length - 1; i++) {
		if (path[i].underpass && path[i + 1].underpass) segments.push({ a: path[i], b: path[i + 1] });
	}
	return segments;
}

// 지름길 가로지르기 선분 목록 — path의 인접 shortcut 마커 쌍마다 { a, b } 선분을 파생.
// 양끝 인셋 = PATH_WIDTH/2 - 2: 컬럼 안쪽 모서리보다 2px 더 들어가 정규길과 살짝만 걸치게.
// 그리기(ui.drawPath)·배치 판정(tower.canPlaceTower) 공용 — 이동 규칙(모든 인접 마커 쌍이 비행 구간)과 자동 동기화.
export function shortcutCutSegments(map) {
	const markers = map.path.filter(p => p.shortcut);
	const inset = PATH_WIDTH / 2 - 2;
	const segments = [];
	for (let i = 0; i + 1 < markers.length; i++) {
		const m = markers[i];
		const n = markers[i + 1];
		const d = Math.hypot(n.x - m.x, n.y - m.y);
		if (d <= inset * 2) continue; // 인셋 후 선분이 뒤집히는 초근접 쌍 가드
		const ux = (n.x - m.x) / d;
		const uy = (n.y - m.y) / d;
		segments.push({
			a: { x: m.x + ux * inset, y: m.y + uy * inset },
			b: { x: n.x - ux * inset, y: n.y - uy * inset },
		});
	}
	return segments;
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

const BUTTON_FONT = 'bold 22px sans-serif';
// 폰트 문자열의 px 크기 = 행 높이 (파싱 실패 시 기본 22)
function fontPx(font) {
	const m = /(\d+(?:\.\d+)?)px/.exec(font);
	return m ? parseFloat(m[1]) : 22;
}

/**
 * 버튼 (빨간 라운드 배경 + 흰 테두리) + 라벨 스택 — 그룹 전체를 버튼 세로 중앙에 정렬.
 * @param {{ x: number, y: number, w: number, h: number }} btn 버튼 영역 (hit-test와 공유하는 사각형)
 * @param {Array<{ label: string, font?: string, margin?: number }>} labels 위→아래 순서의 라벨 스택
 *   - label: 표시 텍스트 (필수)
 *   - font: canvas font 문자열 (기본 BUTTON_FONT). px 크기가 행 높이가 됨 (파싱 실패 시 22)
 *   - margin: 다음 요소와의 세로 간격 px (기본 0, 마지막 요소에선 무시)
 * @param {{ pulse?: boolean }} [opts] pulse: 추천 액션 강조 — 버튼 전체(배경·테두리·라벨) 알파 맥동
 */
export function drawButton(btn, labels, { pulse = false } = {}) {
	if (pulse) ctx.globalAlpha = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(performance.now() / 333));

	ctx.fillStyle = ACCENT_RED;
	roundRect(btn.x, btn.y, btn.w, btn.h, 14);
	ctx.fill();
	ctx.strokeStyle = '#fff';
	ctx.lineWidth = 2;
	ctx.stroke();

	// 1패스 — 그룹 총 높이 (행 높이 합 + 요소 사이 마진 합)
	let total = 0;
	for (let i = 0; i < labels.length; i++) {
		total += fontPx(labels[i].font || BUTTON_FONT);
		if (i < labels.length - 1) total += labels[i].margin || 0;
	}

	// 2패스 — 위에서부터 행마다 중앙 기준으로 그리며 전진
	ctx.fillStyle = '#fff';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	const cx = btn.x + btn.w / 2;
	let y = btn.y + btn.h / 2 - total / 2;
	for (const item of labels) {
		const h = fontPx(item.font || BUTTON_FONT);
		ctx.font = item.font || BUTTON_FONT;
		ctx.fillText(item.label, cx, y + h / 2);
		y += h + (item.margin || 0);
	}
	ctx.textBaseline = 'alphabetic';
	ctx.globalAlpha = 1;
}

export function hitButton(btn, p) {
	return p.x >= btn.x && p.x <= btn.x + btn.w && p.y >= btn.y && p.y <= btn.y + btn.h;
}

