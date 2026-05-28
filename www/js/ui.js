import { ctx, hpEl, goldEl, waveEl } from './canvas.js';
import { LOGICAL_W, LOGICAL_H } from './config.js';
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

// ============ Modals ============
export const airIntroModal = {
  panel: { x: 20, y: 180, w: 320, h: 280 },
  confirmBtn: { x: 110, y: 406, w: 140, h: 40 },
};
export const buffIntroModal = {
  panel: { x: 20, y: 180, w: 320, h: 280 },
  confirmBtn: { x: 110, y: 406, w: 140, h: 40 },
};
export const bossIntroModal = {
  panel: { x: 20, y: 180, w: 320, h: 280 },
  confirmBtn: { x: 110, y: 406, w: 140, h: 40 },
};
export const shieldIntroModal = {
  panel: { x: 20, y: 180, w: 320, h: 280 },
  confirmBtn: { x: 110, y: 406, w: 140, h: 40 },
};

export function drawAirIntroModal() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  const p = airIntroModal.panel;
  ctx.fillStyle = '#1a2535';
  roundRect(p.x, p.y, p.w, p.h, 12);
  ctx.fill();
  ctx.strokeStyle = '#a569bd';
  ctx.lineWidth = 2;
  ctx.stroke();

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

  drawButton(airIntroModal.confirmBtn, '확인');
}

export function drawBuffIntroModal() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  const p = buffIntroModal.panel;
  ctx.fillStyle = '#1a2535';
  roundRect(p.x, p.y, p.w, p.h, 12);
  ctx.fill();
  ctx.strokeStyle = '#d4ac0d';
  ctx.lineWidth = 2;
  ctx.stroke();

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

  drawButton(buffIntroModal.confirmBtn, '확인');
}

export function drawBossIntroModal() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  const p = bossIntroModal.panel;
  ctx.fillStyle = '#1a2535';
  roundRect(p.x, p.y, p.w, p.h, 12);
  ctx.fill();
  ctx.strokeStyle = '#c0392b';
  ctx.lineWidth = 2;
  ctx.stroke();

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

  drawButton(bossIntroModal.confirmBtn, '확인');
}

export function drawShieldIntroModal() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  const p = shieldIntroModal.panel;
  ctx.fillStyle = '#1a2535';
  roundRect(p.x, p.y, p.w, p.h, 12);
  ctx.fill();
  ctx.strokeStyle = '#5dade2';
  ctx.lineWidth = 2;
  ctx.stroke();

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

  drawButton(shieldIntroModal.confirmBtn, '확인');
}
