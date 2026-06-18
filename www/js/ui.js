import { ctx, hpEl, goldEl, waveEl } from './canvas.js';
import {
  LOGICAL_W, LOGICAL_H,
  AIR_INTRO_KEY, BUFF_INTRO_KEY, BOSS_INTRO_KEY, SHIELD_INTRO_KEY,
  TIER4_INTRO_KEY, REGEN_INTRO_KEY, BARRIER_INTRO_KEY,
} from './config.js';
import { game } from './state.js';
import { roundRect, drawButton } from './helpers.js';
import { getVolume, setVolume } from './audio.js';
import { drawEnemySprite } from './enemy.js';

// ============ HUD ============
export function updateHUD() {
  hpEl.textContent = `HP: ${game.hp}`;
  goldEl.textContent = `Gold: ${game.gold}${game.bossActive ? ' 🔒' : ''}`;
  waveEl.textContent = `Wave: ${game.wave}`;
}

// ============ 웨이브 적 출현 요약 ============
// HUD 웨이브 아래(우측 상단)에 작게 — 적 스프라이트 + 누적 개수.
// 아직 출현하지 않은 종류는 표시 안 함 (count>0 만, 순서: 일반·공중·재생·장벽).
const SPAWN_SUMMARY_ORDER = ['ground', 'air', 'regen', 'barrier'];

export function drawWaveSpawnSummary() {
  const counts = game.waveSpawnCounts || {};
  const entries = SPAWN_SUMMARY_ORDER.filter(t => counts[t] > 0);
  if (entries.length === 0) return;

  const iconBox = 16; // 스프라이트가 차지할 가로 폭
  const iconR = 7;
  const gap = 3;      // 스프라이트 ↔ 숫자 간격
  const sep = '  |  ';
  const cy = 34;      // HUD 텍스트(상단)·경로와 겹치지 않는 높이

  ctx.font = '11px sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  // 전체 폭 측정 → 우측 정렬 (웨이브 아래)
  let total = 0;
  for (let i = 0; i < entries.length; i++) {
    total += iconBox + gap + ctx.measureText(`: ${counts[entries[i]]}`).width;
    if (i < entries.length - 1) total += ctx.measureText(sep).width;
  }

  let x = LOGICAL_W - 10 - total;
  for (let i = 0; i < entries.length; i++) {
    const t = entries[i];
    drawEnemySprite(t, x + iconBox / 2, cy, iconR);
    x += iconBox + gap;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    const label = `: ${counts[t]}`;
    ctx.fillText(label, x, cy);
    x += ctx.measureText(label).width;
    if (i < entries.length - 1) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fillText(sep, x, cy);
      x += ctx.measureText(sep).width;
    }
  }
  ctx.textBaseline = 'alphabetic';
}

// ============ Pause button ============
export const pauseButton = { x: 8, y: 592, w: 44, h: 44 };

export function drawPauseButton() {
  ctx.fillStyle = 'rgba(26, 37, 53, 0.85)';
  roundRect(pauseButton.x, pauseButton.y, pauseButton.w, pauseButton.h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#fff';
  if (game.paused) {
    // ▶ Play
    ctx.beginPath();
    ctx.moveTo(pauseButton.x + 15, pauseButton.y + 11);
    ctx.lineTo(pauseButton.x + 15, pauseButton.y + 33);
    ctx.lineTo(pauseButton.x + 33, pauseButton.y + 22);
    ctx.closePath();
    ctx.fill();
  } else {
    // || Pause
    ctx.fillRect(pauseButton.x + 13, pauseButton.y + 11, 5, 22);
    ctx.fillRect(pauseButton.x + 26, pauseButton.y + 11, 5, 22);
  }
}

// ============ Toast ============
export function setToast(text, life = 1.5) {
  game.toast = { text, life, maxLife: life };
}

export function updateToast(dt) {
  if (!game.toast) return;
  game.toast.life -= dt;
  if (game.toast.life <= 0) game.toast = null;
}

export function drawToast() {
  if (!game.toast) return;
  const t = game.toast;
  const alpha = Math.min(1, t.life / 0.3);

  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  const textW = ctx.measureText(t.text).width;
  const w = textW + 32;
  const h = 28;
  const x = (LOGICAL_W - w) / 2;
  const y = 100;

  ctx.globalAlpha = alpha * 0.85;
  ctx.fillStyle = '#000';
  roundRect(x, y, w, h, 6);
  ctx.fill();

  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.fillText(t.text, LOGICAL_W / 2, y + h / 2);
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = 1;
}

export function drawPausedOverlay() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 60, LOGICAL_W, 32);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('⏸  일시정지', LOGICAL_W / 2, 76);
  ctx.textBaseline = 'alphabetic';
}

// ============ Settings modal (통합) ============
// 게임 중 백 버튼 / 타이틀 설정 버튼 모두 동일 모달 사용.
// 호출자가 buttons 배열을 넘김 — 각 { label, action }. 버튼 위치/패널 높이는
// settingsLayout이 버튼 개수에 맞춰 계산 (씬의 hit-test도 동일 함수 사용).
// 하단 가이드 문구는 모달 소스에 고정.
const SETTINGS_BTN = { x: 80, w: 200, h: 50, gap: 12, top: 350 };
const SETTINGS_PANEL = { x: 30, y: 210, w: 300 };

export function settingsLayout(count) {
  const btns = [];
  for (let i = 0; i < count; i++) {
    btns.push({
      x: SETTINGS_BTN.x,
      y: SETTINGS_BTN.top + i * (SETTINGS_BTN.h + SETTINGS_BTN.gap),
      w: SETTINGS_BTN.w,
      h: SETTINGS_BTN.h,
    });
  }
  const lastBottom = count ? btns[count - 1].y + SETTINGS_BTN.h : SETTINGS_BTN.top;
  const panel = { ...SETTINGS_PANEL, h: lastBottom + 40 - SETTINGS_PANEL.y };
  return { panel, btns, guideY: panel.y + panel.h - 16 };
}

// ---- 볼륨 슬라이더 ----
// track: x ~ x+w (가로), cy 중심. 패널 가로 중앙 대칭 배치.
export const volumeSlider = { x: 78, cy: 322, w: 204, knobR: 11 };
let volumeDragging = false;

function volumeFromPointer(px) {
  const s = volumeSlider;
  return Math.min(1, Math.max(0, (px - s.x) / s.w));
}

export function hitVolumeSlider(p) {
  const s = volumeSlider;
  // 트랙 양끝 여유 + 세로 터치 영역 넉넉히
  return p.x >= s.x - 22 && p.x <= s.x + s.w + 22 && Math.abs(p.y - s.cy) <= 26;
}

// 슬라이더 드래그 — 설정 모달이 열린 씬에서 pointer 콜백이 위임.
// 이벤트를 소비하면 true 반환 (씬은 그 경우 다른 처리 스킵).
export function volumePointerDown(p) {
  if (!hitVolumeSlider(p)) return false;
  volumeDragging = true;
  setVolume(volumeFromPointer(p.x));
  return true;
}
export function volumePointerMove(p) {
  if (!volumeDragging) return false;
  setVolume(volumeFromPointer(p.x));
  return true;
}
export function volumePointerUp() {
  const was = volumeDragging;
  volumeDragging = false;
  return was;
}

function drawVolumeSlider() {
  const s = volumeSlider;
  const v = getVolume();
  const knobX = s.x + v * s.w;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#cdd';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`볼륨  ${Math.round(v * 100)}%`, LOGICAL_W / 2, s.cy - 18);

  ctx.lineCap = 'round';
  // 트랙 배경
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(s.x, s.cy);
  ctx.lineTo(s.x + s.w, s.cy);
  ctx.stroke();
  // 채워진 구간
  ctx.strokeStyle = '#5dade2';
  ctx.beginPath();
  ctx.moveTo(s.x, s.cy);
  ctx.lineTo(knobX, s.cy);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // 노브
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(knobX, s.cy, s.knobR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5dade2';
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function drawSettingsModal(buttons) {
  const { panel: p, btns, guideY } = settingsLayout(buttons.length);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  ctx.fillStyle = '#1a2535';
  roundRect(p.x, p.y, p.w, p.h, 12);
  ctx.fill();
  ctx.strokeStyle = '#5dade2';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('설정', LOGICAL_W / 2, p.y + 48);

  drawVolumeSlider();

  for (let i = 0; i < buttons.length; i++) drawButton(btns[i], buttons[i].label);

  ctx.fillStyle = '#9ab';
  ctx.font = '12px sans-serif';
  ctx.fillText('이전 버튼을 눌러 닫습니다', LOGICAL_W / 2, guideY);
}

// ============ Intro modals ============
// 표준 모달 레이아웃 (대부분 공유, tier4만 별도)
const STD_PANEL = { x: 20, y: 180, w: 320, h: 280 };
const STD_BTN = { x: 110, y: 406, w: 140, h: 40 };

function drawIntroBackdrop(panel, accent, dimAlpha = 0.65) {
  ctx.fillStyle = `rgba(0, 0, 0, ${dimAlpha})`;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.fillStyle = '#1a2535';
  roundRect(panel.x, panel.y, panel.w, panel.h, 12);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.stroke();
}

// 각 인트로: { key, panel, confirmBtn, draw }
// 새 인트로 추가 시 이 dict에 항목 하나만 추가하면 됨.
export const INTRO_MODALS = {
  airIntro: {
    key: AIR_INTRO_KEY,
    panel: STD_PANEL,
    confirmBtn: STD_BTN,
    draw() {
      const p = this.panel;
      drawIntroBackdrop(p, '#a569bd');

      const iconCx = LOGICAL_W / 2;
      const iconCy = p.y + 50;
      drawEnemySprite('air', iconCx, iconCy, 14);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('공중 적 등장!', iconCx, p.y + 102);

      ctx.fillStyle = '#cdd';
      ctx.font = '14px sans-serif';
      ctx.fillText('보라색 삼각형은 공중 적입니다.', iconCx, p.y + 142);
      ctx.fillText('지상 전담 타워는 공격할 수 없으니', iconCx, p.y + 168);
      ctx.fillText('스카웃을 활용해 대비하세요.', iconCx, p.y + 194);

      drawButton(this.confirmBtn, '확인');
    },
  },

  buffIntro: {
    key: BUFF_INTRO_KEY,
    panel: STD_PANEL,
    confirmBtn: STD_BTN,
    draw() {
      const p = this.panel;
      drawIntroBackdrop(p, '#d4ac0d');

      const iconCx = LOGICAL_W / 2;
      const iconCy = p.y + 56;
      const ir = 14;

      const auraPulse = 0.5 + 0.5 * Math.sin(performance.now() / 700);
      ctx.globalAlpha = 0.4 + 0.3 * auraPulse;
      ctx.strokeStyle = '#d4ac0d';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(iconCx, iconCy, ir + 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#d4ac0d';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + Math.PI / 8;
        const px = iconCx + ir * Math.cos(a);
        const py = iconCy + ir * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#9a7d0a';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('티어별 버프율', iconCx, p.y + 112);

      ctx.fillStyle = '#cdd';
      ctx.font = '14px sans-serif';
      ctx.fillText('버프를 받는 타워의 티어에 따라', iconCx, p.y + 152);
      ctx.fillText('효과가 달라집니다.', iconCx, p.y + 178);

      ctx.fillStyle = '#d4ac0d';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('T0 +10%   T1 +10%   T2 +20%   T3 +30%', iconCx, p.y + 218);

      drawButton(this.confirmBtn, '확인');
    },
  },

  bossIntro: {
    key: BOSS_INTRO_KEY,
    panel: STD_PANEL,
    confirmBtn: STD_BTN,
    draw() {
      const p = this.panel;
      drawIntroBackdrop(p, '#c0392b');

      const iconCx = LOGICAL_W / 2;
      const iconCy = p.y + 56;
      ctx.fillStyle = '#922b21';
      ctx.beginPath();
      ctx.ellipse(iconCx, iconCy, 22, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('보스 등장!', iconCx, p.y + 108);

      ctx.fillStyle = '#cdd';
      ctx.font = '14px sans-serif';
      ctx.fillText('20 웨이브마다 보스가 등장합니다.', iconCx, p.y + 152);
      ctx.fillText('일반 적보다 훨씬 단단하지만 느리게 이동합니다.', iconCx, p.y + 178);

      drawButton(this.confirmBtn, '확인');
    },
  },

  shieldIntro: {
    key: SHIELD_INTRO_KEY,
    panel: STD_PANEL,
    confirmBtn: STD_BTN,
    draw() {
      const p = this.panel;
      drawIntroBackdrop(p, '#5dade2');

      const iconCx = LOGICAL_W / 2;
      const iconCy = p.y + 56;
      drawEnemySprite('ground', iconCx, iconCy, 14, { shielded: true });

      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('방어막 적 등장!', iconCx, p.y + 108);

      ctx.fillStyle = '#cdd';
      ctx.font = '14px sans-serif';
      ctx.fillText('일부 적이 방어막을 두르고 등장합니다.', iconCx, p.y + 152);
      ctx.fillText('받는 데미지가 감소합니다.', iconCx, p.y + 178);

      drawButton(this.confirmBtn, '확인');
    },
  },

  tier4Intro: {
    key: TIER4_INTRO_KEY,
    panel: { x: 20, y: 160, w: 320, h: 320 },
    confirmBtn: { x: 110, y: 432, w: 140, h: 40 },
    draw() {
      const p = this.panel;
      drawIntroBackdrop(p, '#f5d76e', 0.7);

      // 4티어 아이콘: 두 디스크가 합쳐지는 모양
      const iconCx = LOGICAL_W / 2;
      const iconCy = p.y + 56;
      ctx.fillStyle = '#1abc9c';
      ctx.beginPath();
      ctx.arc(iconCx - 12, iconCy, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(iconCx + 12, iconCy, 12, 0, Math.PI * 2);
      ctx.fill();

      // 합쳐짐 표시
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', iconCx, iconCy);

      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#f5d76e';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('합체 전직 가능!', iconCx, p.y + 100);

      ctx.fillStyle = '#cdd';
      ctx.font = '13px sans-serif';
      ctx.fillText('XP를 모두 채운 3티어 타워 두 개로', iconCx, p.y + 128);
      ctx.fillText('레시피 조합 4티어 전직이 가능합니다.', iconCx, p.y + 148);

      ctx.fillStyle = '#f5d76e';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('① 한 타워의 "4티어 대상 지정"', iconCx, p.y + 180);
      ctx.fillText('② 레시피 짝 타워에서 "전직"', iconCx, p.y + 200);
      ctx.fillText('③ 대상 타워는 소모, 짝 타워가 4티어로 전직', iconCx, p.y + 220);

      drawButton(this.confirmBtn, '확인');
    },
  },

  barrierIntro: {
    key: BARRIER_INTRO_KEY,
    panel: STD_PANEL,
    confirmBtn: STD_BTN,
    draw() {
      const p = this.panel;
      drawIntroBackdrop(p, '#aab7c4');

      // 아이콘: 장벽 적 (역삼각형 + 내부 디스크)
      const iconCx = LOGICAL_W / 2;
      const iconCy = p.y + 56;
      drawEnemySprite('barrier', iconCx, iconCy, 14);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('장벽 적 등장!', iconCx, p.y + 108);

      ctx.fillStyle = '#cdd';
      ctx.font = '14px sans-serif';
      ctx.fillText('장벽 적이 등장합니다.', iconCx, p.y + 148);
      ctx.fillText('처치한 자리에 장벽이 생성되어', iconCx, p.y + 174);
      ctx.fillText('공중 공격을 차단합니다.', iconCx, p.y + 200);

      drawButton(this.confirmBtn, '확인');
    },
  },

  regenIntro: {
    key: REGEN_INTRO_KEY,
    panel: STD_PANEL,
    confirmBtn: STD_BTN,
    draw() {
      const p = this.panel;
      drawIntroBackdrop(p, '#2ecc71');

      // 재생 적 아이콘 (사각형 + 초록 글로우)
      const iconCx = LOGICAL_W / 2;
      const iconCy = p.y + 56;
      drawEnemySprite('regen', iconCx, iconCy, 13);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('재생 적 등장!', iconCx, p.y + 108);

      ctx.fillStyle = '#cdd';
      ctx.font = '14px sans-serif';
      ctx.fillText('초록색 사각형은 재생 적입니다.', iconCx, p.y + 148);
      ctx.fillText('이동 속도가 절반이지만', iconCx, p.y + 172);
      ctx.fillText('피해를 입어도 매초 체력을 회복합니다.', iconCx, p.y + 196);

      drawButton(this.confirmBtn, '확인');
    },
  },
};
