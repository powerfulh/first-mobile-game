import { LOGICAL_W, LOGICAL_H } from './config.js';

export const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
export const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
const hpEl = document.getElementById('hp');
const goldEl = document.getElementById('gold');
const waveEl = document.getElementById('wave');
export const hudEl = document.getElementById('hud');

// HUD 텍스트 setter — 표시 문자열만 받아 DOM에 반영. 포맷/게임 로직은 호출부(ui.js)에.
export function setHud({ hp, gold, wave }) {
	hpEl.textContent = hp;
	goldEl.textContent = gold;
	waveEl.textContent = wave;
}

// DOM HUD가 캔버스 상단을 침범한 높이(논리좌표). 세로 레터박스가 HUD보다 깊으면 0.
// getBoundingClientRect가 비싸서 매 프레임 재지 않고 resize 때만 갱신.
export let hudOverlapLogical = 0;

function resize() {
	const dpr = window.devicePixelRatio || 1;
	const scale = Math.min(window.innerWidth / LOGICAL_W, window.innerHeight / LOGICAL_H);
	canvas.style.width = (LOGICAL_W * scale) + 'px';
	canvas.style.height = (LOGICAL_H * scale) + 'px';
	canvas.width = Math.floor(LOGICAL_W * scale * dpr);
	canvas.height = Math.floor(LOGICAL_H * scale * dpr);
	ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
	hudOverlapLogical = Math.max(0, (hudEl.getBoundingClientRect().bottom - canvas.getBoundingClientRect().top) / scale);
}
window.addEventListener('resize', resize);
resize();

export function getLogicalPoint(clientX, clientY) {
	const rect = canvas.getBoundingClientRect();
	return {
		x: (clientX - rect.left) / rect.width * LOGICAL_W,
		y: (clientY - rect.top) / rect.height * LOGICAL_H,
	};
}
