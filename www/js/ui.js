import { ctx, hpEl, goldEl, waveEl } from './canvas.js';
import {
  LOGICAL_W, LOGICAL_H,
  AIR_INTRO_KEY, BUFF_INTRO_KEY, BOSS_INTRO_KEY, SHIELD_INTRO_KEY,
  TIER4_INTRO_KEY, REGEN_INTRO_KEY, BARRIER_INTRO_KEY,
} from './config.js';
import { game } from './state.js';
import { roundRect, drawButton } from './helpers.js';

// ============ HUD ============
export function updateHUD() {
  hpEl.textContent = `HP: ${game.hp}`;
  goldEl.textContent = `Gold: ${game.gold}${game.bossActive ? ' 🔒' : ''}`;
  waveEl.textContent = `Wave: ${game.wave}`;
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
// 호출자가 buttons 배열을 넘김 — 각 { btn: {x,y,w,h}, label: string }.
// 하단 가이드 문구는 모달 소스에 고정.
export const settingsModalPanel = { x: 30, y: 220, w: 300, h: 200 };

export function drawSettingsModal(buttons) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  const p = settingsModalPanel;
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

  for (const b of buttons) drawButton(b.btn, b.label);

  ctx.fillStyle = '#9ab';
  ctx.font = '12px sans-serif';
  ctx.fillText('이전 버튼을 눌러 닫습니다', LOGICAL_W / 2, p.y + p.h - 16);
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
      const r = 14;
      ctx.fillStyle = '#a569bd';
      ctx.beginPath();
      ctx.moveTo(iconCx, iconCy - r);
      ctx.lineTo(iconCx - r * 0.9, iconCy + r * 0.6);
      ctx.lineTo(iconCx + r * 0.9, iconCy + r * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();

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
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.arc(iconCx, iconCy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5dade2';
      ctx.lineWidth = 3;
      ctx.stroke();

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

      // 아이콘: 역삼각형 + 내부 디스크 (장벽 적 미니어처)
      const iconCx = LOGICAL_W / 2;
      const iconCy = p.y + 56;
      const r = 14;
      ctx.fillStyle = '#a569bd';
      ctx.beginPath();
      ctx.moveTo(iconCx - r * 0.9, iconCy - r * 0.6);
      ctx.lineTo(iconCx + r * 0.9, iconCy - r * 0.6);
      ctx.lineTo(iconCx, iconCy + r);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();

      // 내부 디스크
      const inY = iconCy - r * 0.15;
      const inR = 5;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = '#aab7c4';
      ctx.beginPath();
      ctx.arc(iconCx, inY, inR, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#d5dbdb';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(iconCx - inR, inY);
      ctx.lineTo(iconCx + inR, inY);
      ctx.moveTo(iconCx, inY - inR);
      ctx.lineTo(iconCx, inY + inR);
      ctx.stroke();

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

      // 재생 적 아이콘: 사각형 + 위쪽 + 마크
      const iconCx = LOGICAL_W / 2;
      const iconCy = p.y + 56;
      const w = 22;
      ctx.fillStyle = '#1e8449';
      roundRect(iconCx - w / 2, iconCy - w / 2, w, w, 3);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();

      // + 마크
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      const ms = 5;
      const mcy = iconCy - w / 2 - 10;
      ctx.beginPath();
      ctx.moveTo(iconCx - ms, mcy);
      ctx.lineTo(iconCx + ms, mcy);
      ctx.moveTo(iconCx, mcy - ms);
      ctx.lineTo(iconCx, mcy + ms);
      ctx.stroke();
      ctx.lineCap = 'butt';

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
