import { canvas, getLogicalPoint } from './core/canvas.js';
import { TOWER, TOWER_ROLES, TIER4_RECIPES } from './core/config.js';
import { game } from './state.js';
import { changeScene, getCurrentScene } from './scenes.js';

// 디버그용 — 브라우저 콘솔에서 game / config 접근 / 수정.
// (모듈 스코프 안에 갇혀 있어서 명시적으로 window에 노출.)
if (typeof window !== 'undefined') {
	window.td = { game, TOWER, TOWER_ROLES, TIER4_RECIPES };
}

// ============ Input ============
canvas.addEventListener('pointerdown', (e) => {
	e.preventDefault();
	const p = getLogicalPoint(e.clientX, e.clientY);
	getCurrentScene()?.pointerDown?.(p);
});

canvas.addEventListener('pointerup', (e) => {
	if (game.holdDelete) game.holdDelete = null;
	const p = getLogicalPoint(e.clientX, e.clientY);
	getCurrentScene()?.pointerUp?.(p);
});

canvas.addEventListener('pointermove', (e) => {
	const p = getLogicalPoint(e.clientX, e.clientY);
	if (game.holdDelete) {
		const dt = game.holdDelete.tower;
		if (Math.hypot(p.x - dt.x, p.y - dt.y) > TOWER.radius + 8) {
			game.holdDelete = null;
		}
	}
	getCurrentScene()?.pointerMove?.(p);
});

canvas.addEventListener('pointercancel', () => {
	if (game.holdDelete) game.holdDelete = null;
	getCurrentScene()?.pointerCancel?.();
});

// Android 하드웨어 백 버튼 / 제스처 (@capacitor/app). 브라우저에서는 무시됨.
const capApp = (typeof window !== 'undefined') && window.Capacitor?.Plugins?.App;
if (capApp) {
	capApp.addListener('backButton', () => {
		getCurrentScene()?.backButton?.();
	});
}

// 키보드 입력 (데스크탑 한정 — 모바일은 키보드 없음). 씬 콜백 dispatch.
window.addEventListener('keydown', (e) => {
	getCurrentScene()?.keyDown?.(e);
});

canvas.addEventListener('contextmenu', (e) => {
	e.preventDefault();
});

// ============ Game loop ============
let lastTime = performance.now();
function loop(now) {
	const dt = Math.min((now - lastTime) / 1000, 0.1);
	lastTime = now;
	const scene = getCurrentScene();
	scene?.update(dt);
	scene?.draw();
	requestAnimationFrame(loop);
}

changeScene('title');
requestAnimationFrame(loop);
