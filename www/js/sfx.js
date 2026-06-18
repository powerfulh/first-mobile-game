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
