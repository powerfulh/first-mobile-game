// 게임 BGM — 일반(타이틀·일반 웨이브) / 보스(보스 웨이브) 두 트랙.
// 자동재생 차단(브라우저·Android WebView) 대응:
//   - Android는 MainActivity에서 자동재생을 허용 → 타이틀 진입 즉시 재생
//   - 그래도 막히는 환경(데스크탑 브라우저 등)에서는 play() 실패를 잡아
//     첫 사용자 제스처(pointerdown/keydown)에서 재시도 (폴백)
import { MUTE_KEY } from './config.js';

const tracks = {
  normal: new Audio('assets/audio/bgm.mp3'),
  boss: new Audio('assets/audio/boss.mp3'),
};
for (const a of Object.values(tracks)) {
  a.loop = true;
  a.volume = 0.5;
}

let current = null; // 'normal' | 'boss' | null
let muted = loadMuted();
let gestureArmed = false;

function loadMuted() {
  try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { return false; }
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

// current 트랙을 음소거 상태에 맞춰 재생, 나머지 트랙은 정지
function applyCurrent() {
  // current가 아닌 트랙은 정지하고 처음으로 되감음 (트랙 전환)
  for (const [name, a] of Object.entries(tracks)) {
    if (name !== current && !a.paused) {
      a.pause();
      a.currentTime = 0;
    }
  }
  const a = current ? tracks[current] : null;
  if (!a) return;
  if (muted) {
    if (!a.paused) a.pause(); // 음소거: 재생 위치는 유지한 채 정지
    return;
  }
  const pr = a.play();
  if (pr && pr.catch) pr.catch(() => armGesture());
}

// 'normal' | 'boss' 전환. 같은 트랙이면 사실상 no-op라 매 프레임 호출해도 안전.
export function playBgm(track) {
  if (current === track) {
    if (!muted && tracks[track].paused) applyCurrent(); // 멈춰 있으면 보정
    return;
  }
  current = track;
  applyCurrent();
}

// 보스 활성 여부로 전투 음악 동기화 (playing 씬 update에서 매 프레임 호출)
export function syncBattleMusic(bossActive) {
  playBgm(bossActive ? 'boss' : 'normal');
}

export function isMuted() { return muted; }

export function toggleMuted() {
  muted = !muted;
  try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) {}
  applyCurrent();
  return muted;
}
