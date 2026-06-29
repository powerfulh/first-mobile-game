// Toast — 짧은 안내 메시지 상태 관리. 그리기는 ui.js의 drawToast가 담당.
import { game } from './state.js';

export function setToast(text, life = 1.5) {
	game.toast = { text, life, maxLife: life };
}

export function updateToast(dt) {
	if (!game.toast) return;
	game.toast.life -= dt;
	if (game.toast.life <= 0) game.toast = null;
}
