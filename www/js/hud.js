// HUD — 상단 DOM 오버레이(HP/Gold/Wave) 동기화. 포맷·게임 로직은 여기에서 처리하고
// 실제 DOM 반영은 canvas.js의 setHud setter가 담당.
import { game } from './state.js';
import { setHud } from './core/canvas.js';

export function updateHUD() {
	// 활성 웨이브 범위로 표기 — 먼저 끝난 웨이브는 제거되므로 범위가 좁아짐.
	// {낮은 활성}~{높은 활성}, 하나면 단일 번호. 활성 없음(배치 전환/인터미션)이면 game.wave.
	const waves = game.waves || [];
	let wave;
	if (waves.length === 0) {
		wave = `Wave: ${game.wave}`;
	} else {
		let lo = waves[0].wave, hi = waves[0].wave;
		for (const s of waves) { if (s.wave < lo) lo = s.wave; if (s.wave > hi) hi = s.wave; }
		wave = lo === hi ? `Wave: ${lo}` : `Wave: ${lo}~${hi}`;
	}
	setHud({
		hp: `HP: ${game.hp}`,
		gold: `Gold: ${game.gold}${game.bossActive ? ' 🔒' : ''}`,
		wave,
	});
}
