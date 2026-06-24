// 게임 BGM — 일반(타이틀·일반 웨이브) / 보스(보스 웨이브) 두 트랙.
// 자동재생 차단(브라우저·Android WebView) 대응:
//   - Android는 MainActivity에서 자동재생을 허용 → 타이틀 진입 즉시 재생
//   - 그래도 막히는 환경(데스크탑 브라우저 등)에서는 play() 실패를 잡아
//     첫 사용자 제스처(pointerdown/keydown)에서 재시도 (폴백)
// 볼륨은 0~1 (0이면 무음). 설정 모달의 배경음 슬라이더가 setBgmVolume으로 조절.
import { BGM_VOLUME_KEY } from './core/config.js';

const tracks = {
	normal: new Audio('assets/audio/bgm.mp3'),
	boss: new Audio('assets/audio/boss.mp3'),
};
for (const a of Object.values(tracks)) {
	a.loop = true;
}

let current = null; // 'normal' | 'boss' | null
let volume = loadVolume();
let gestureArmed = false;

function loadVolume() {
	try {
		const v = parseFloat(localStorage.getItem(BGM_VOLUME_KEY));
		return isNaN(v) ? 0.5 : Math.min(1, Math.max(0, v));
	} catch (e) {
		return 0.5;
	}
}

// 자동재생이 막혔을 때 — 다음 사용자 제스처 한 번에 현재 트랙 재생 재시도
function armGesture() {
	if (gestureArmed) return;
	gestureArmed = true;
	const resume = () => {
		window.removeEventListener('pointerdown', resume);
		window.removeEventListener('keydown', resume);
		gestureArmed = false;
		applyCurrent();
	};
	window.addEventListener('pointerdown', resume);
	window.addEventListener('keydown', resume);
}

// current 트랙을 볼륨에 맞춰 재생, 나머지 트랙은 정지.
// 볼륨 0이어도 정지하지 않고 무음 재생 유지 → 드래그 중 play/pause 깜빡임 방지.
function applyCurrent() {
	for (const [name, a] of Object.entries(tracks)) {
		if (name !== current && !a.paused) {
			a.pause();
			a.currentTime = 0;
		}
	}
	const a = current ? tracks[current] : null;
	if (!a) return;
	a.volume = volume;
	if (a.paused) {
		const pr = a.play();
		if (pr && pr.catch) pr.catch(() => armGesture());
	}
}

// 'normal' | 'boss' 전환. 같은 트랙이면 볼륨/재생 상태만 보정.
export function playBgm(track) {
	if (current !== track) current = track;
	applyCurrent();
}

// 보스 활성 여부로 전투 음악 동기화 (playing 씬 update에서 매 프레임 호출)
export function syncBattleMusic(bossActive) {
	playBgm(bossActive ? 'boss' : 'normal');
}

export function getBgmVolume() { return volume; }

export function setBgmVolume(v) {
	volume = Math.min(1, Math.max(0, v));
	try { localStorage.setItem(BGM_VOLUME_KEY, String(volume)); } catch (e) {}
	for (const a of Object.values(tracks)) a.volume = volume;
	applyCurrent(); // 정지 상태였으면 재생 보장
}
