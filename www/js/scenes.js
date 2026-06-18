import { ctx, hudEl } from './canvas.js';
import {
  LOGICAL_W, LOGICAL_H, TOWER, TOWER_ROLES, HOLD_DELETE_SECONDS, TIER4_INTRO_KEY,
} from './config.js';
import {
  game, resetGame, loadGame, loadSaveData,
  hasSeenIntro, setIntroSeen, resetLocalData,
} from './state.js';
import { roundRect, drawButton, hitButton, drawPath } from './helpers.js';
import {
  spawnEnemy, updateEnemy, drawEnemy, drawBossHpBar,
  updateBarrierSpawnFx, drawBarrierSpawnFx,
} from './enemy.js';
import {
  placeTower, canPromote,
  promoteTower, updateTower, drawTower, drawTowerRange,
  drawTowerInfoPanel, drawPromotionPanel,
  towerInfoPanel, infoCloseButton, infoPromotionButton,
  promotionPanel, promotionCloseButton, promotionCardSlots, tier4ResultCardSlot,
  xpMaxFor, getXpGainAtWaveEnd,
  getPromotionButtonState, promoteToTier4, hasReadyTier4Candidate, isTier4ChoiceContext,
} from './tower.js';
import {
  updateProjectile, updateBeam, updateSplash, updateZap,
  drawProjectile, drawBeam, drawSplash, drawZap,
} from './attack.js';
import { startNextWave, setupWave } from './wave.js';
import {
  updateHUD, drawWaveSpawnSummary, pauseButton, drawPauseButton, drawPausedOverlay,
  INTRO_MODALS,
  setToast, updateToast, drawToast,
  drawSettingsModal, settingsLayout,
  volumePointerDown, volumePointerMove, volumePointerUp,
} from './ui.js';
import { playBgm, syncBattleMusic } from './audio.js';
import { playTowerSelect, playButton, playPauseToggle, playPromote } from './sfx.js';

// 설정 모달 버튼 구성 — 씬별 { label, action }. action()이 truthy 반환 시 모달 닫음.
// 위치/패널 높이는 ui.js의 settingsLayout이 개수에 맞춰 계산.
const titleSettingsButtons = [
  {
    label: '저장 정보 초기화',
    action() {
      if (typeof confirm === 'function' && !confirm('저장 정보를 초기화할까요?')) return false;
      resetLocalData();
      changeScene('title');
      return true;
    },
  },
];

const playingSettingsButtons = [
  {
    label: '위키',
    action() {
      wiki.returnTo = 'playing'; // 위키에서 나갈 때 진행 중 게임으로 복귀
      changeScene('wiki');
      return true;
    },
  },
  {
    label: '메인으로 나가기',
    action() {
      changeScene('title');
      return true;
    },
  },
];
import { wiki } from './wiki.js';

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
// 4개 버튼 배치: continueBtn(저장 있을 때만) / start / wiki / settings
// start·wiki·settings 위치는 save 여부와 무관하게 동일 유지 → 사용자 시선 안정
const titleButtonsWithSave = {
  continueBtn: { x: 80, y: 290, w: 200, h: 64 },
  start:       { x: 80, y: 366, w: 200, h: 64 },
  wiki:        { x: 80, y: 442, w: 200, h: 64 },
  settings:    { x: 80, y: 518, w: 200, h: 64 },
};
const titleButtonsNoSave = {
  start:    { x: 80, y: 366, w: 200, h: 64 },
  wiki:     { x: 80, y: 442, w: 200, h: 64 },
  settings: { x: 80, y: 518, w: 200, h: 64 },
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
  settingsOpen: false,
  enter() {
    titleAnim = 0;
    titleSave = loadSaveData();
    this.settingsOpen = false;
    playBgm('normal'); // 타이틀·일반 웨이브 공용 BGM
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
    ctx.fillText('PROMOTION', LOGICAL_W / 2, 122);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('TOWER', LOGICAL_W / 2, 170);
    ctx.fillText('DEFENSE', LOGICAL_W / 2, 226);

    ctx.fillStyle = '#9ab39a';
    ctx.font = '13px sans-serif';
    ctx.fillText('OFFLINE EDITION', LOGICAL_W / 2, 256);

    const pulse = 0.5 + 0.5 * Math.sin(titleAnim * 3);

    if (titleSave) {
      ctx.globalAlpha = 0.6 + 0.4 * pulse;
      drawContinueButton(titleButtonsWithSave.continueBtn, titleSave.wave);
      ctx.globalAlpha = 1;
      drawButton(titleButtonsWithSave.start, '게임 시작');
      drawButton(titleButtonsWithSave.wiki, '위키');
      drawButton(titleButtonsWithSave.settings, '설정');
    } else {
      ctx.globalAlpha = 0.6 + 0.4 * pulse;
      drawButton(titleButtonsNoSave.start, '게임 시작');
      ctx.globalAlpha = 1;
      drawButton(titleButtonsNoSave.wiki, '위키');
      drawButton(titleButtonsNoSave.settings, '설정');
    }

    if (this.settingsOpen) drawSettingsModal(titleSettingsButtons);
  },
  pointerDown(p) {
    if (this.settingsOpen) {
      if (volumePointerDown(p)) return;
      const { btns } = settingsLayout(titleSettingsButtons.length);
      for (let i = 0; i < titleSettingsButtons.length; i++) {
        if (hitButton(btns[i], p)) {
          if (titleSettingsButtons[i].action()) this.settingsOpen = false;
          return;
        }
      }
      return;
    }
    if (titleSave && hitButton(titleButtonsWithSave.continueBtn, p)) {
      loadGame(titleSave);
      changeScene('playing');
      return;
    }
    const buttons = titleSave ? titleButtonsWithSave : titleButtonsNoSave;
    if (hitButton(buttons.start, p)) {
      resetGame();
      changeScene('playing');
      return;
    }
    if (hitButton(buttons.wiki, p)) {
      wiki.returnTo = 'title';
      changeScene('wiki');
      return;
    }
    if (hitButton(buttons.settings, p)) {
      this.settingsOpen = true;
      return;
    }
  },
  pointerMove(p) {
    if (this.settingsOpen) volumePointerMove(p);
  },
  pointerUp() {
    volumePointerUp();
  },
  pointerCancel() {
    volumePointerUp();
  },
  backButton() {
    if (this.settingsOpen) {
      this.settingsOpen = false;
      return;
    }
    // 타이틀에서 백 버튼 = 앱 종료 (Capacitor 환경 한정)
    window.Capacitor?.Plugins?.App?.exitApp();
  },
  keyDown(e) {
    if (e.code === 'Backspace' && this.settingsOpen) {
      e.preventDefault();
      this.settingsOpen = false;
      return;
    }
    // 데스크탑 디버그용 — 스페이스키로 샌드박스 진입 (Wave 1부터)
    if (e.code === 'Space') {
      e.preventDefault();
      enterSandbox();
    }
  },
};

function enterSandbox() {
  resetGame();
  game.sandbox = true;
  game.gold = 999999;
  game.hp = 999999;
  changeScene('playing');
}

// 샌드박스 — 임의 웨이브로 점프 (현재 진행 클리어)
function jumpToWave(targetWave) {
  game.enemies = [];
  game.projectiles = [];
  game.beams = [];
  game.splashes = [];
  game.zaps = [];
  game.barrierSpawnFx = [];
  game.spawnedThisWave = 0;
  game.spawnTimer = 0;
  game.bossActive = false;
  game.intermissionTimer = 0;
  game.selectedTower = null;
  game.promotionChoiceOpen = false;
  game.promotionTarget = null;
  game.holdDelete = null;
  game.modal = null;
  setupWave(targetWave);
}

scenes.wiki = wiki;

// ============ Playing scene ============
scenes.playing = {
  enter() {
    // 호출자가 resetGame() 또는 loadGame() 호출
  },
  update(dt) {
    updateToast(dt);
    syncBattleMusic(game.bossActive); // 보스 웨이브 ↔ 일반 BGM 전환
    if (game.modal) return;
    if (game.settingsOpen) return;
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
        if (game.promotionTarget === dead) {
          game.promotionTarget = null;
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
    for (const z of game.zaps) updateZap(z, dt);
    for (const fx of game.barrierSpawnFx) updateBarrierSpawnFx(fx, dt);

    game.enemies = game.enemies.filter(e => !e.dead);
    game.projectiles = game.projectiles.filter(p => !p.dead);
    game.beams = game.beams.filter(b => !b.dead);
    game.splashes = game.splashes.filter(s => !s.dead);
    game.zaps = game.zaps.filter(z => !z.dead);
    game.barrierSpawnFx = game.barrierSpawnFx.filter(fx => !fx.dead);

    let waveEnded = false;
    if (game.waveState === 'spawning') {
      if (game.bossActive) {
        if (!game.enemies.some(e => e.isBoss)) {
          game.bossActive = false;
          game.enemies = [];
          waveEnded = true;
        }
      } else {
        // 장벽은 일반 적 카운트에서 제외 / 장벽 생성 fx 진행 중에도 wave 안 끝남
        const remainingNonBarrier = game.enemies.some(e => !e.isBarrier);
        const fxPending = game.barrierSpawnFx.length > 0;
        if (game.spawnedThisWave >= game.enemiesPerWave && !remainingNonBarrier && !fxPending) {
          waveEnded = true;
        }
      }
    }
    if (waveEnded) {
      for (const t of game.towers) {
        if (canPromote(t)) {
          const gain = getXpGainAtWaveEnd(t);
          t.xp = Math.min(Math.round((t.xp + gain) * 10) / 10, xpMaxFor(t));
        }
      }
      // 잔여 장벽 정리 (웨이브 종료 시 사라짐)
      game.enemies = game.enemies.filter(e => !e.isBarrier);
      game.waveState = 'intermission';
      // 이전 판 최고 도달 / 현재 wave 중 큰 값 기준 — 1회 도달 후 다음 판부터 짧은 인터미션
      const benchmark = Math.max(game.wave, game.bestWaveReached);
      game.intermissionTimer = benchmark >= 40 ? 1 : benchmark >= 20 ? 2 : 3;
    }

    if (!game.modal && !hasSeenIntro(TIER4_INTRO_KEY) && hasReadyTier4Candidate()) {
      game.modal = { type: 'tier4Intro' };
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
    for (const z of game.zaps) drawZap(z);
    for (const fx of game.barrierSpawnFx) drawBarrierSpawnFx(fx);

    drawBossHpBar();
    drawWaveSpawnSummary();

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

    if (!game.selectedTower && !game.modal && !game.settingsOpen) drawPauseButton();
    if (game.paused) drawPausedOverlay();

    if (game.modal) {
      const intro = INTRO_MODALS[game.modal.type];
      if (intro) intro.draw();
    }

    if (game.settingsOpen) drawSettingsModal(playingSettingsButtons);

    drawToast();
  },
  pointerDown(p) {
    if (game.settingsOpen) {
      if (volumePointerDown(p)) return;
      const { btns } = settingsLayout(playingSettingsButtons.length);
      for (let i = 0; i < playingSettingsButtons.length; i++) {
        if (hitButton(btns[i], p)) {
          if (playingSettingsButtons[i].action()) game.settingsOpen = false;
          return;
        }
      }
      return;
    }
    if (game.modal) {
      const intro = INTRO_MODALS[game.modal.type];
      if (intro && hitButton(intro.confirmBtn, p)) {
        playButton();
        setIntroSeen(intro.key);
        game.modal = null;
      }
      return;
    }

    if (!game.selectedTower && hitButton(pauseButton, p)) {
      game.paused = !game.paused;
      playPauseToggle(game.paused);
      return;
    }
    if (game.selectedTower && game.promotionChoiceOpen) {
      if (hitButton(promotionCloseButton, p)) {
        game.promotionChoiceOpen = false;
        return;
      }

      if (isTier4ChoiceContext(game.selectedTower)) {
        if (hitButton(tier4ResultCardSlot, p)) {
          const second = game.selectedTower;
          if (promoteToTier4(second)) {
            playPromote();
            game.promotionChoiceOpen = false;
            game.selectedTower = second; // 변환된 4티어 그대로 선택 유지
          }
          return;
        }
        if (hitButton(promotionPanel, p)) return;
        game.promotionChoiceOpen = false;
        return;
      }

      const promotions = TOWER_ROLES[game.selectedTower.role].promotions;
      for (let i = 0; i < promotions.length && i < promotionCardSlots.length; i++) {
        if (hitButton(promotionCardSlots[i], p)) {
          if (promoteTower(game.selectedTower, promotions[i])) {
            playPromote();
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
        const state = getPromotionButtonState(game.selectedTower);
        if (!state.active || !state.action) return;
        playButton();
        if (state.action === 'openTier3Choice') {
          game.promotionChoiceOpen = true;
        } else if (state.action === 'setTarget') {
          game.promotionTarget = game.selectedTower;
          game.selectedTower = null;
        } else if (state.action === 'cancelTarget') {
          game.promotionTarget = null;
        } else if (state.action === 'openTier4Choice') {
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
        playTowerSelect();
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
  pointerMove(p) {
    if (game.settingsOpen) volumePointerMove(p);
  },
  pointerUp() {
    volumePointerUp();
  },
  pointerCancel() {
    volumePointerUp();
  },
  backButton() {
    // 설정 열린 상태 → 닫기
    if (game.settingsOpen) {
      game.settingsOpen = false;
      return;
    }
    // 전직 카드 열린 상태 → 타워 선택 화면으로
    if (game.selectedTower && game.promotionChoiceOpen) {
      game.promotionChoiceOpen = false;
      return;
    }
    // 타워 선택 상태 → 선택 해제
    if (game.selectedTower) {
      game.selectedTower = null;
      return;
    }
    // 기본 → 설정 열기
    game.settingsOpen = true;
  },
  keyDown(e) {
    // 데스크탑에서 백 버튼 대체 — backButton과 동일 로직
    if (e.code === 'Backspace') {
      e.preventDefault();
      this.backButton();
      return;
    }
    // 샌드박스 한정 키
    if (!game.sandbox) return;
    if (e.code === 'Space') {
      e.preventDefault();
      const input = prompt('이동할 웨이브?', String(game.wave));
      if (input === null) return;
      const wave = parseInt(input, 10);
      if (isNaN(wave) || wave < 1) return;
      jumpToWave(wave);
    } else if (e.code === 'Delete') {
      e.preventDefault();
      for (const t of game.towers) t.totalDamage = 0;
    } else if (e.code === 'KeyS') {
      e.preventDefault();
      game.sandboxShieldsEnabled = !game.sandboxShieldsEnabled;
      setToast(`방어막 적 ${game.sandboxShieldsEnabled ? 'ON' : 'OFF'}`);
    }
  },
};

// ============ Game Over scene ============
const gameOverButtons = {
  restart: { x: 80, y: 360, w: 200, h: 56 },
  toTitle: { x: 80, y: 432, w: 200, h: 56 },
};

scenes.gameOver = {
  enter() {
    playBgm('normal'); // 보스전 중 사망해도 일반 BGM으로 복귀
  },
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
