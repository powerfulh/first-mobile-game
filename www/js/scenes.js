import { ctx, hudEl } from './canvas.js';
import {
  LOGICAL_W, LOGICAL_H, TOWER, TOWER_ROLES, HOLD_DELETE_SECONDS,
} from './config.js';
import {
  game, resetGame, loadGame, loadSaveData,
  hasSeenAirIntro, hasSeenBuffIntro, hasSeenBossIntro, hasSeenShieldIntro,
  setAirIntroSeen, setBuffIntroSeen, setBossIntroSeen, setShieldIntroSeen,
} from './state.js';
import { roundRect, drawButton, hitButton, drawPath } from './helpers.js';
import {
  spawnEnemy, updateEnemy, drawEnemy, drawBossHpBar,
} from './enemy.js';
import {
  canPlaceTower, placeTower, canPromote, isPromotionReady, canAffordPromotion,
  promoteTower, updateTower, drawTower, drawTowerRange,
  drawTowerInfoPanel, drawPromotionPanel,
  towerInfoPanel, infoCloseButton, infoPromotionButton,
  promotionPanel, promotionCloseButton, promotionCardSlots,
  xpMaxFor, getXpGainAtWaveEnd,
} from './tower.js';
import {
  updateProjectile, updateBeam, updateSplash,
  drawProjectile, drawBeam, drawSplash,
} from './attack.js';
import { startNextWave } from './wave.js';
import {
  updateHUD, pauseButton, drawPauseButton, drawPausedOverlay,
  airIntroModal, buffIntroModal, bossIntroModal, shieldIntroModal,
  drawAirIntroModal, drawBuffIntroModal, drawBossIntroModal, drawShieldIntroModal,
} from './ui.js';

export const scenes = {};
let currentSceneName = null;

export function changeScene(name) {
  currentSceneName = name;
  scenes[name].enter?.();
  hudEl.style.display = (name === 'playing') ? 'flex' : 'none';
}

export function getCurrentScene() {
  return scenes[currentSceneName];
}

// ============ Title scene ============
const titleButtonsWithSave = {
  continueBtn: { x: 80, y: 372, w: 200, h: 64 },
  start:       { x: 80, y: 460, w: 200, h: 64 },
};
const titleButtonsNoSave = {
  start: { x: 80, y: 400, w: 200, h: 64 },
};
let titleAnim = 0;
let titleSave = null;

function drawContinueButton(btn, wave) {
  ctx.fillStyle = '#c0392b';
  roundRect(btn.x, btn.y, btn.w, btn.h, 14);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '13px sans-serif';
  ctx.fillText('이어서 하기', btn.x + btn.w / 2, btn.y + btn.h / 2 - 13);
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`Wave ${wave}`, btn.x + btn.w / 2, btn.y + btn.h / 2 + 11);
  ctx.textBaseline = 'alphabetic';
}

scenes.title = {
  enter() {
    titleAnim = 0;
    titleSave = loadSaveData();
  },
  update(dt) {
    titleAnim += dt;
  },
  draw() {
    ctx.fillStyle = '#1a2e1a';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    drawPath(0.25);

    ctx.textAlign = 'center';

    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('PROMOTION', LOGICAL_W / 2, 162);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('TOWER', LOGICAL_W / 2, 210);
    ctx.fillText('DEFENSE', LOGICAL_W / 2, 266);

    ctx.fillStyle = '#9ab39a';
    ctx.font = '13px sans-serif';
    ctx.fillText('OFFLINE EDITION', LOGICAL_W / 2, 296);

    const pulse = 0.5 + 0.5 * Math.sin(titleAnim * 3);

    if (titleSave) {
      ctx.globalAlpha = 0.6 + 0.4 * pulse;
      drawContinueButton(titleButtonsWithSave.continueBtn, titleSave.wave);
      ctx.globalAlpha = 1;
      drawButton(titleButtonsWithSave.start, '게임 시작');
    } else {
      ctx.globalAlpha = 0.6 + 0.4 * pulse;
      drawButton(titleButtonsNoSave.start, '게임 시작');
      ctx.globalAlpha = 1;
    }
  },
  pointerDown(p) {
    if (titleSave && hitButton(titleButtonsWithSave.continueBtn, p)) {
      loadGame(titleSave);
      changeScene('playing');
      return;
    }
    const startBtn = titleSave ? titleButtonsWithSave.start : titleButtonsNoSave.start;
    if (hitButton(startBtn, p)) {
      resetGame();
      changeScene('playing');
      return;
    }
  },
};

// ============ Playing scene ============
scenes.playing = {
  enter() {
    // 호출자가 resetGame() 또는 loadGame() 호출
  },
  update(dt) {
    if (game.modal) return;
    if (game.paused) return;
    if (game.holdDelete) {
      game.holdDelete.accumulated += dt;
      if (game.holdDelete.accumulated >= HOLD_DELETE_SECONDS) {
        const dead = game.holdDelete.tower;
        game.towers = game.towers.filter(x => x !== dead);
        if (game.selectedTower === dead) {
          game.selectedTower = null;
          game.promotionChoiceOpen = false;
        }
        game.holdDelete = null;
      }
    }
    if (game.waveState === 'spawning') {
      game.spawnTimer += dt;
      const canSpawn = game.bossActive || game.spawnedThisWave < game.enemiesPerWave;
      if (game.spawnTimer >= game.spawnInterval && canSpawn) {
        game.spawnTimer = 0;
        game.spawnedThisWave++;
        spawnEnemy();
      }
    } else if (game.waveState === 'intermission') {
      game.intermissionTimer -= dt;
      if (game.intermissionTimer <= 0) {
        startNextWave();
      }
    }

    for (const e of game.enemies) updateEnemy(e, dt);
    for (const t of game.towers) updateTower(t, dt);
    for (const p of game.projectiles) updateProjectile(p, dt);
    for (const b of game.beams) updateBeam(b, dt);
    for (const s of game.splashes) updateSplash(s, dt);

    game.enemies = game.enemies.filter(e => !e.dead);
    game.projectiles = game.projectiles.filter(p => !p.dead);
    game.beams = game.beams.filter(b => !b.dead);
    game.splashes = game.splashes.filter(s => !s.dead);

    let waveEnded = false;
    if (game.waveState === 'spawning') {
      if (game.bossActive) {
        if (!game.enemies.some(e => e.isBoss)) {
          game.bossActive = false;
          game.enemies = [];
          waveEnded = true;
        }
      } else if (game.spawnedThisWave >= game.enemiesPerWave && game.enemies.length === 0) {
        waveEnded = true;
      }
    }
    if (waveEnded) {
      for (const t of game.towers) {
        if (canPromote(t)) {
          const gain = getXpGainAtWaveEnd(t);
          t.xp = Math.min(Math.round((t.xp + gain) * 10) / 10, xpMaxFor(t));
        }
      }
      game.waveState = 'intermission';
      game.intermissionTimer = game.wave >= 40 ? 1 : game.wave >= 20 ? 2 : 3;
    }

    if (game.hp <= 0) {
      game.hp = 0;
      game.selectedTower = null;
      game.promotionChoiceOpen = false;
      changeScene('gameOver');
    }
  },
  draw() {
    updateHUD();
    ctx.fillStyle = '#2d4a2b';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    drawPath();

    for (const t of game.towers) {
      if (t === game.selectedTower) continue;
      drawTowerRange(t, 0.05, 0.12);
    }
    if (game.selectedTower) {
      drawTowerRange(game.selectedTower, 0.18, 0.5);
    }

    for (const t of game.towers) drawTower(t);
    for (const e of game.enemies) drawEnemy(e);
    for (const pr of game.projectiles) drawProjectile(pr);
    for (const b of game.beams) drawBeam(b);
    for (const s of game.splashes) drawSplash(s);

    drawBossHpBar();

    if (game.holdDelete) {
      const progress = Math.min(1, game.holdDelete.accumulated / HOLD_DELETE_SECONDS);
      const t = game.holdDelete.tower;
      ctx.strokeStyle = '#e74c3c';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(t.x, t.y, TOWER.radius + 7, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.stroke();
    }

    if (game.waveState === 'intermission') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, LOGICAL_H / 2 - 28, LOGICAL_W, 56);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`다음 웨이브까지 ${Math.ceil(game.intermissionTimer)}초`, LOGICAL_W / 2, LOGICAL_H / 2 + 6);
    }

    if (game.selectedTower) {
      if (game.promotionChoiceOpen) {
        drawPromotionPanel(game.selectedTower);
      } else {
        drawTowerInfoPanel(game.selectedTower);
      }
    } else {
      ctx.textAlign = 'center';
      ctx.font = '12px sans-serif';
      ctx.fillStyle = game.gold >= TOWER.cost ? 'rgba(255,255,255,0.7)' : 'rgba(255,150,150,0.7)';
      ctx.fillText(`빈 곳을 탭하여 타워 배치 (${TOWER.cost}G)`, LOGICAL_W / 2, LOGICAL_H - 28);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText('타워를 꾹 눌러 삭제', LOGICAL_W / 2, LOGICAL_H - 12);
    }

    if (!game.selectedTower && !game.modal) drawPauseButton();
    if (game.paused) drawPausedOverlay();

    if (game.modal) {
      if (game.modal.type === 'airIntro') drawAirIntroModal();
      else if (game.modal.type === 'buffIntro') drawBuffIntroModal();
      else if (game.modal.type === 'bossIntro') drawBossIntroModal();
      else if (game.modal.type === 'shieldIntro') drawShieldIntroModal();
    }
  },
  pointerDown(p) {
    if (game.modal) {
      if (game.modal.type === 'airIntro' && hitButton(airIntroModal.confirmBtn, p)) {
        setAirIntroSeen();
        game.modal = null;
      } else if (game.modal.type === 'buffIntro' && hitButton(buffIntroModal.confirmBtn, p)) {
        setBuffIntroSeen();
        game.modal = null;
      } else if (game.modal.type === 'bossIntro' && hitButton(bossIntroModal.confirmBtn, p)) {
        setBossIntroSeen();
        game.modal = null;
      } else if (game.modal.type === 'shieldIntro' && hitButton(shieldIntroModal.confirmBtn, p)) {
        setShieldIntroSeen();
        game.modal = null;
      }
      return;
    }

    if (!game.selectedTower && hitButton(pauseButton, p)) {
      game.paused = !game.paused;
      return;
    }
    if (game.selectedTower && game.promotionChoiceOpen) {
      if (hitButton(promotionCloseButton, p)) {
        game.promotionChoiceOpen = false;
        return;
      }
      const promotions = TOWER_ROLES[game.selectedTower.role].promotions;
      for (let i = 0; i < promotions.length && i < promotionCardSlots.length; i++) {
        if (hitButton(promotionCardSlots[i], p)) {
          if (promoteTower(game.selectedTower, promotions[i])) {
            game.promotionChoiceOpen = false;
          }
          return;
        }
      }
      if (hitButton(promotionPanel, p)) {
        return;
      }
      game.promotionChoiceOpen = false;
      return;
    }

    if (game.selectedTower) {
      if (hitButton(infoCloseButton, p)) {
        game.selectedTower = null;
        return;
      }
      if (canPromote(game.selectedTower) && hitButton(infoPromotionButton, p)) {
        if (isPromotionReady(game.selectedTower) && canAffordPromotion(game.selectedTower)) {
          game.promotionChoiceOpen = true;
        }
        return;
      }
    }

    // 타워 hit는 정보 패널 안 빈 영역보다 먼저 검사
    for (const t of game.towers) {
      if (Math.hypot(p.x - t.x, p.y - t.y) <= TOWER.radius + 4) {
        game.selectedTower = t;
        game.promotionChoiceOpen = false;
        game.holdDelete = { tower: t, accumulated: 0 };
        return;
      }
    }

    if (game.selectedTower && hitButton(towerInfoPanel, p)) {
      return;
    }

    if (game.selectedTower) {
      game.selectedTower = null;
      game.promotionChoiceOpen = false;
      return;
    }
    placeTower(p.x, p.y);
  },
};

// ============ Game Over scene ============
const gameOverButtons = {
  restart: { x: 80, y: 360, w: 200, h: 56 },
  toTitle: { x: 80, y: 432, w: 200, h: 56 },
};

scenes.gameOver = {
  enter() {},
  update() {},
  draw() {
    scenes.playing.draw();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#e74c3c';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText('GAME OVER', LOGICAL_W / 2, 200);

    ctx.fillStyle = '#fff';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Wave ${game.wave}에서 패배`, LOGICAL_W / 2, 252);

    drawButton(gameOverButtons.restart, '다시 시작');
    drawButton(gameOverButtons.toTitle, '타이틀로');
  },
  pointerDown(p) {
    if (hitButton(gameOverButtons.restart, p)) {
      resetGame();
      changeScene('playing');
    } else if (hitButton(gameOverButtons.toTitle, p)) {
      changeScene('title');
    }
  },
};
