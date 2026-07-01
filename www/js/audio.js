// 게임 BGM — Web Audio API로 디코드 후 AudioBufferSourceNode 반복재생(샘플 단위 무이음 루프).
// HTMLAudioElement의 loop는 경계에서 미세한 텀이 생겨, 매끄러운 반복을 위해 Web Audio 사용.
// 자동재생 정책: AudioContext는 suspended로 시작할 수 있어 첫 사용자 제스처에서 resume.
// 볼륨은 GainNode.gain (0~1, 0이면 무음이지만 루프는 계속). 설정 모달 슬라이더가 setBgmVolume으로 조절.
// 곡 전환: 보스로/에서·최초 재생은 즉시, 그 외 곡 변경은 기존 곡 정지 → 0.4초 무음 → 새 곡.
import { BGM_VOLUME_KEY } from './core/config.js';
import { clamp } from './core/helpers.js';

const SRC = {
	normal: 'assets/audio/bgm.mp3',
	boss: 'assets/audio/boss.mp3',
	bgm2: 'assets/audio/m2-rock-organ.mp3', // 맵2 BGM
};

let ctx = null;          // AudioContext (첫 playBgm에서 생성)
let gain = null;         // 마스터 볼륨 GainNode
const buffers = {};      // name → 디코드된 AudioBuffer
let source = null;       // 현재 재생 중 AudioBufferSourceNode (one-shot, 재생마다 새로 생성)
let current = null;      // 'normal' | 'boss' | 'bgm2' | null (논리적 현재 곡)
let volume = loadVolume();
let pendingTimer = null; // 비-보스 곡 전환 시 0.4초 무음 후 재생 예약
let gestureArmed = false;
const TRACK_SWAP_GAP_MS = 400;

function loadVolume() {
	try {
		const v = parseFloat(localStorage.getItem(BGM_VOLUME_KEY));
		return isNaN(v) ? 0.5 : clamp(v, 0, 1);
	} catch (e) {
		return 0.5;
	}
}

// AudioContext + GainNode 생성(1회) 후 모든 트랙을 비동기 디코드.
function ensureCtx() {
	if (ctx) return;
	const AC = window.AudioContext || window.webkitAudioContext;
	if (!AC) return;
	ctx = new AC();
	gain = ctx.createGain();
	gain.gain.value = volume;
	gain.connect(ctx.destination);
	for (const [name, url] of Object.entries(SRC)) {
		fetch(url)
			.then(r => r.arrayBuffer())
			.then(b => ctx.decodeAudioData(b))
			.then(buf => {
				buffers[name] = buf;
				// 로드 지연 동안 재생 예정이던 곡이면 지금 시작
				if (current === name && !source && !pendingTimer) startSource(name);
			})
			.catch(() => {});
	}
}

function stopSource() {
	if (source) {
		try { source.stop(); } catch (e) {}
		try { source.disconnect(); } catch (e) {}
		source = null;
	}
}

// 디코드된 버퍼를 루프 재생. 버퍼 미로드면 no-op(로드 완료 콜백이 재시도).
function startSource(name) {
	if (!ctx || !buffers[name]) return;
	stopSource();
	const s = ctx.createBufferSource();
	s.buffer = buffers[name];
	s.loop = true; // 샘플 단위 무이음 반복
	s.connect(gain);
	s.start();
	source = s;
	tryResume();
}

// suspended면 resume 시도, 실패 시 첫 제스처에서 재시도.
function tryResume() {
	if (ctx && ctx.state === 'suspended') {
		ctx.resume().catch(() => {});
		armGesture();
	}
}

function armGesture() {
	if (gestureArmed) return;
	gestureArmed = true;
	const resume = () => {
		window.removeEventListener('pointerdown', resume);
		window.removeEventListener('keydown', resume);
		gestureArmed = false;
		if (ctx) ctx.resume().catch(() => {});
		if (current && !source && !pendingTimer) startSource(current);
	};
	window.addEventListener('pointerdown', resume);
	window.addEventListener('keydown', resume);
}

export function playBgm(track) {
	ensureCtx();
	if (current === track) {
		// 이미 현재 곡 — 끊김 없이 유지. 정지 상태(로딩/차단)면 재생 시도, 아니면 resume 보정.
		if (!pendingTimer && !source) startSource(track);
		else tryResume();
		return;
	}
	const prev = current;
	if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
	if (prev == null || prev === 'boss' || track === 'boss') {
		current = track; // 최초 재생·보스 전환은 즉시
		startSource(track);
		return;
	}
	// 비-보스 곡 변경: 기존 곡 즉시 정지 → 0.4초 무음 → 새 곡 재생
	stopSource();
	current = track;
	pendingTimer = setTimeout(() => { pendingTimer = null; startSource(current); }, TRACK_SWAP_GAP_MS);
}

// 보스 활성 여부로 전투 음악 동기화 (playing 씬 update에서 매 프레임 호출).
// 비-보스 트랙은 현재 맵의 BGM (mapBgm). 같은 트랙이면 끊김 없이 유지.
export function syncBattleMusic(bossActive, mapBgm = 'normal') {
	playBgm(bossActive ? 'boss' : mapBgm);
}

export function getBgmVolume() { return volume; }

export function setBgmVolume(v) {
	volume = clamp(v, 0, 1);
	try { localStorage.setItem(BGM_VOLUME_KEY, String(volume)); } catch (e) {}
	if (gain) gain.gain.value = volume;
}
