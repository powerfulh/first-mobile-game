// 적 스프라이트 — 본체 모양만 그림 (HP바·마크링·재생 오라 등 게임 오버레이는 제외).
// 게임/위키/인트로/정보패널/HUD 요약이 공유하는 순수 렌더 프리미티브. type 문자열로 모양 선택.
import { ctx } from '../core/canvas.js';
import { AIR_COLOR, ACCENT_RED, INFO_BLUE } from '../core/config.js';
import { roundRect } from '../core/helpers.js';

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
