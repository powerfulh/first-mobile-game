// 효과음 시스템 — Web Audio API로 합성 (오디오 파일 없음).
// BGM(audio.js)과 별개이며, 효과음 볼륨도 배경음과 독립된 자체 마스터(SFX_VOLUME_KEY).
// 새 효과음은 export function 하나씩 추가 (getCtx로 AudioContext 확보 후 합성).
import { SFX_VOLUME_KEY } from './config.js';

let ctx = null;
let sfxVolume = loadSfxVolume();

function loadSfxVolume() {
  try {
    const v = parseFloat(localStorage.getItem(SFX_VOLUME_KEY));
    return isNaN(v) ? 0.5 : Math.min(1, Math.max(0, v));
  } catch (e) {
    return 0.5;
  }
}

export function getSfxVolume() { return sfxVolume; }

export function setSfxVolume(v) {
  sfxVolume = Math.min(1, Math.max(0, v));
  try { localStorage.setItem(SFX_VOLUME_KEY, String(sfxVolume)); } catch (e) {}
}

// AudioContext는 사용자 제스처 후에야 동작 → 첫 호출(탭) 시점에 생성/resume.
function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// 단순 톤 1개 (osc + 게인 엔벨로프) — 여러 효과음의 빌딩 블록.
// f1 지정 시 f0→f1로 피치 스윕. dest 미지정 시 destination 직결.
function tone({ type = 'square', f0, f1, start, dur, peak, attack = 0.008, dest = null }) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, start);
  if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, start + dur * 0.9);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g);
  g.connect(dest || ctx.destination);
  o.start(start);
  o.stop(start + dur + 0.02);
}

// 타워 선택 — 디지털 콘솔 전원이 켜지는 느낌.
// 필터가 빠르게 열리는 상승 스윕(전원 인입) + 끝에 짧은 디지털 확인음(블립).
export function playTowerSelect() {
  const ac = getCtx();
  if (!ac) return;
  const vol = getSfxVolume();
  if (vol <= 0) return;
  const t0 = ac.currentTime;
  const dur = 0.26;

  // 메인 스윕 게인 엔벨로프 (빠른 어택 → 디케이)
  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(vol * 0.5, t0 + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  env.connect(ac.destination);

  // 로우패스가 닫힌 상태 → 빠르게 열림 = "켜지는" 브라이트닝
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(350, t0);
  filter.frequency.exponentialRampToValueAtTime(3000, t0 + 0.13);
  filter.Q.value = 4;
  filter.connect(env);

  // 루트 + 5도, 톱니파로 상승 스윕 (디지털 톤)
  for (const f of [180, 270]) {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f, t0);
    o.frequency.exponentialRampToValueAtTime(f * 2.4, t0 + 0.12);
    o.connect(filter);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  // 끝맺음 디지털 확인음 — 짧은 고음 블립
  const blip = ac.createOscillator();
  const blipEnv = ac.createGain();
  blip.type = 'square';
  blip.frequency.setValueAtTime(880, t0 + 0.1);
  blip.frequency.exponentialRampToValueAtTime(1320, t0 + 0.16);
  blipEnv.gain.setValueAtTime(0.0001, t0 + 0.1);
  blipEnv.gain.exponentialRampToValueAtTime(vol * 0.18, t0 + 0.12);
  blipEnv.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
  blip.connect(blipEnv);
  blipEnv.connect(ac.destination);
  blip.start(t0 + 0.1);
  blip.stop(t0 + 0.24);
}

// 범용 버튼 — 짧고 깔끔한 디지털 클릭 (자주 울리므로 가볍게)
export function playButton() {
  const ac = getCtx();
  if (!ac) return;
  const vol = getSfxVolume();
  if (vol <= 0) return;
  const t = ac.currentTime;
  tone({ type: 'square', f0: 520, f1: 660, start: t, dur: 0.085, peak: vol * 0.26 });
}

// 일시정지 토글 — 두 음. 일시정지는 하강(전원 내림), 재개는 상승.
export function playPauseToggle(paused) {
  const ac = getCtx();
  if (!ac) return;
  const vol = getSfxVolume();
  if (vol <= 0) return;
  const t = ac.currentTime;
  const notes = paused ? [523, 392] : [392, 523];
  notes.forEach((f, i) => {
    tone({ type: 'triangle', f0: f, start: t + i * 0.075, dur: 0.11, peak: vol * 0.3 });
  });
}

// 전직 확정 — 밝은 상승 아르페지오(C·E·G·C) + 옥타브 반짝임. 업그레이드 보상감.
export function playPromote() {
  const ac = getCtx();
  if (!ac) return;
  const vol = getSfxVolume();
  if (vol <= 0) return;
  const t = ac.currentTime;

  // 점점 밝아지는 로우패스 (상승감 강조)
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(900, t);
  filter.frequency.exponentialRampToValueAtTime(6000, t + 0.3);
  filter.connect(ac.destination);

  const arp = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  arp.forEach((f, i) => {
    tone({ type: 'sawtooth', f0: f, start: t + i * 0.06, dur: 0.2, peak: vol * 0.32, dest: filter });
  });
  // 끝에 옥타브 위 반짝임
  tone({ type: 'sine', f0: 2093, start: t + 0.26, dur: 0.16, peak: vol * 0.16 });
}
