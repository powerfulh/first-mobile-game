import { ctx, hudEl } from './core/canvas.js';
import {
	LOGICAL_W, LOGICAL_H, TOWER, EMP_STUN_RANGE, HOLD_DELETE_SECONDS, TIER4_INTRO_KEY, TIER5_INTRO_KEY,
	PARALLEL_INTRO_KEY, TOWER_PANEL, ACCENT_RED, GOLD,
} from './core/config.js';
import {
	game, resetGame, loadGame, loadSaveData,
	hasSeenIntro, setIntroSeen, resetLocalData, getOneTouchPlace,
	getIntermissionEnabled, getUnlockedMaps, clearEffects,
} from './state.js';
import { getActiveMap, MAPS } from './core/maps.js';
import { roundRect, drawButton, hitButton } from './core/helpers.js';
import {
	spawnEnemy, updateEnemy, drawEnemy, drawBossHpBar,
	updateBarrierSpawnFx, updateShieldBreakFx, updateEmpDevice, isBoss, getEffectiveSpeed,
} from './enemy.js';
import {
	placeTower, createGhostTower, moveGhostTower, canPlaceTower,
	promoteTower, updateTower, drawTower,
	getPromotionState, getPromotionChoices, towerDualCapable, handleTowerSettingsTap, canAffordPromotion, getTowerRefund,
	grantWaveEndXp, recomputeStats,
	handlePromotionButton, promoteFusion, hasReadyTier4Candidate, hasReadyTier5Candidate, isFusionTriggerContext,
} from './tower.js';
import { drawTowerRange, drawTowerRangesUnion, drawBarrierSpawnFx, drawShieldBreakFx, drawEmpDevice } from './ui/sprite.js';
import { drawTowerSprite } from './ui/sprite/tower.js';
import {
	updateProjectile, updateBeam, updateLink, updateSplash, updateZap,
	drawProjectile, drawBeam, drawLink, drawSplash, drawZap,
} from './attack.js';
import { startNextWave, setupWave, callExtraWave, canCallExtraWave, extraWaveBossBlocked } from './wave.js';
import { t } from './core/i18n.js';
import { updateHUD } from './hud.js';
import { setToast, updateToast } from './toast.js';
import {
	drawWaveSpawnSummary, pauseButton, drawPauseButton, drawPausedOverlay,
	nextWaveButton, drawNextWaveButton,
	drawToast, drawEnemyHpBar,
	drawSettingsModal, drawPath,
} from './ui.js';
import { INTRO_MODALS } from './ui/intro-modals.js';
import {
	drawEnemyInfoPanel, drawTowerInfoPanel, drawTowerSettingsCard, infoSettingsButton, infoWikiButton, SETTINGS_DELETE_BTN, infoPanel, infoPromotionButton,
	drawPromotionPanel, promotionPanel, promotionCloseButton, promotionCardSlots, tier4ResultCardSlot,
} from './ui/panel.js';
import { settingsModalTap, volumePointerMove, volumePointerUp } from './settings-modal.js';
import { playBgm, syncBattleMusic } from './audio.js';
import { playTowerSelect, playTowerPlace, playButton, playPauseToggle, playPromote } from './sfx.js';

// 설정 모달 버튼 구성 — 씬별 { label, action }. action()이 truthy 반환 시 모달 닫음.
// 위치/패널 높이는 ui.js의 settingsLayout이 개수에 맞춰 계산.
const titleSettingsButtons = [
	{
		label: 'settings.resetSave',
		action() {
			if (typeof confirm === 'function' && !confirm(t('settings.resetConfirm'))) return false;
			resetLocalData();
			changeScene('title');
			return true;
		},
	},
];

const playingSettingsButtons = [
	{
		label: 'common.wiki',
		action() {
			wiki.returnTo = 'playing'; // 위키에서 나갈 때 진행 중 게임으로 복귀
			changeScene('wiki');
			return true;
		},
	},
	{
		label: 'settings.exitToTitle',
		action() {
			changeScene('title');
			return true;
		},
	},
];
import { wiki, openWikiAtTower, openWikiAtEnemy } from './wiki.js';

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
	ctx.fillStyle = ACCENT_RED;
	roundRect(btn.x, btn.y, btn.w, btn.h, 14);
	ctx.fill();
	ctx.strokeStyle = '#fff';
	ctx.lineWidth = 2;
	ctx.stroke();

	ctx.fillStyle = '#fff';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = '13px sans-serif';
	ctx.fillText(t('title.continue'), btn.x + btn.w / 2, btn.y + btn.h / 2 - 13);
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
		drawPath(getActiveMap(), 0.25);

		ctx.textAlign = 'center';

		ctx.fillStyle = GOLD;
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
			drawButton(titleButtonsWithSave.start, t('title.start'));
			drawButton(titleButtonsWithSave.wiki, t('common.wiki'));
			drawButton(titleButtonsWithSave.settings, t('settings.title'));
		} else {
			ctx.globalAlpha = 0.6 + 0.4 * pulse;
			drawButton(titleButtonsNoSave.start, t('title.start'));
			ctx.globalAlpha = 1;
			drawButton(titleButtonsNoSave.wiki, t('common.wiki'));
			drawButton(titleButtonsNoSave.settings, t('settings.title'));
		}

		if (this.settingsOpen) drawSettingsModal(titleSettingsButtons);
	},
	pointerDown(p) {
		if (this.settingsOpen) {
			if (settingsModalTap(p, titleSettingsButtons)) this.settingsOpen = false;
			return;
		}
		if (titleSave && hitButton(titleButtonsWithSave.continueBtn, p)) {
			loadGame(titleSave);
			changeScene('playing');
			return;
		}
		const buttons = titleSave ? titleButtonsWithSave : titleButtonsNoSave;
		if (hitButton(buttons.start, p)) {
			// 해금 맵이 2개 이상이면 맵 선택 단계, 1개면 기존처럼 바로 진입
			if (getUnlockedMaps().length >= 2) {
				changeScene('mapSelect');
			} else {
				resetGame('map1');
				changeScene('playing');
			}
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

// ============ Map select scene ============
// 해금 맵이 2개 이상일 때만 '게임 시작'에서 진입(1개면 바로 playing). 맵 탭 → resetGame(맵) → playing.
// 버튼은 단순 라벨 대신 맵 경로를 축소 렌더한 썸네일 카드. 가로 한 줄 중앙 정렬(맵 늘면 줄바꿈은 추후).
function mapSelectButtons() {
	const ids = getUnlockedMaps();
	const TW = 150, TH = 250, GAP = 24;
	const startX = (LOGICAL_W - (ids.length * TW + (ids.length - 1) * GAP)) / 2;
	const y = (LOGICAL_H - TH) / 2;
	return ids.map((id, i) => ({ id, x: startX + i * (TW + GAP), y, w: TW, h: TH }));
}
function drawMapThumb(map, b) {
	ctx.fillStyle = '#2d4a2b'; // 플레이 배경과 같은 느낌
	roundRect(b.x, b.y, b.w, b.h, 10);
	ctx.fill();
	ctx.strokeStyle = '#fff';
	ctx.lineWidth = 2;
	ctx.stroke();

	// 경로 미니 렌더 — 카드 안(이름 영역 제외)에 종횡비 유지하며 맞춤.
	const pad = 10, nameH = 26;
	const aw = b.w - pad * 2, ah = b.h - pad * 2 - nameH;
	const s = Math.min(aw / LOGICAL_W, ah / LOGICAL_H);
	const ox = b.x + pad + (aw - LOGICAL_W * s) / 2;
	const oy = b.y + pad + (ah - LOGICAL_H * s) / 2;
	ctx.strokeStyle = '#8a7a5a';
	ctx.lineWidth = 4;
	ctx.lineJoin = 'round';
	ctx.beginPath();
	ctx.moveTo(ox + map.path[0].x * s, oy + map.path[0].y * s);
	for (let i = 1; i < map.path.length; i++) ctx.lineTo(ox + map.path[i].x * s, oy + map.path[i].y * s);
	ctx.stroke();

	ctx.fillStyle = '#fff';
	ctx.font = 'bold 14px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(t(map.name), b.x + b.w / 2, b.y + b.h - nameH / 2);
	ctx.textBaseline = 'alphabetic';
}
scenes.mapSelect = {
	enter() {},
	update() {},
	draw() {
		ctx.fillStyle = '#1a2e1a';
		ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
		for (const b of mapSelectButtons()) drawMapThumb(MAPS[b.id], b);
	},
	pointerDown(p) {
		for (const b of mapSelectButtons()) {
			if (hitButton(b, p)) {
				resetGame(b.id);
				changeScene('playing');
				return;
			}
		}
	},
	pointerMove() {},
	pointerUp() {},
	pointerCancel() {},
	backButton() {
		changeScene('title');
	},
	keyDown(e) {
		if (e.code === 'Backspace') {
			e.preventDefault();
			this.backButton();
		}
	},
};

function enterSandbox() {
	resetGame('map2'); // 샌드박스는 2번 맵 고정
	game.sandbox = true;
	game.gold = 999999;
	game.hp = 999999;
	changeScene('playing');
}

// 샌드박스 — 임의 웨이브로 점프 (현재 진행 클리어)
function jumpToWave(targetWave) {
	game.entities.enemies = [];
	game.entities.projectiles = [];
	clearEffects();
	game.bossActive = false;
	game.intermissionTimer = 0;
	game.selectedTower = null;
	game.selectedEnemy = null;
	game.towerPanel = TOWER_PANEL.INFO;
	game.fusionMaterials = [];
	game.holdDelete = null;
	game.modal = null;
	setupWave(targetWave);
}

scenes.wiki = wiki;

// 모든 타워/적 카드 닫고 선택 해제 (카드 밖 빈 곳 터치 시 — 기본 상태로).
function deselectTower() {
	game.selectedTower = null;
	game.selectedEnemy = null;
	game.towerPanel = TOWER_PANEL.INFO;
}

// 타워 삭제 공통 — 홀드 삭제 완료와 설정 패널 삭제 버튼이 공유. 선택·전직 대상 참조도 정리.
// 투입 골드 10% 환불(재료 타워 투입분 제외) + 토스트 안내.
function deleteTower(dead) {
	game.entities.towers = game.entities.towers.filter(x => x !== dead);
	recomputeStats();
	const refund = getTowerRefund(dead);
	game.gold += refund;
	setToast(t('toast.towerRefund', { g: refund }));
	if (game.selectedTower === dead) {
		game.selectedTower = null;
		game.towerPanel = TOWER_PANEL.INFO;
	}
	game.fusionMaterials = game.fusionMaterials.filter(t => t !== dead);
}

// 좌표에 타워가 있으면 그 타워로 선택 전환(카드 닫음) 후 true, 없으면 false.
function selectTowerAt(p) {
	for (const tower of game.entities.towers) {
		if (Math.hypot(p.x - tower.x, p.y - tower.y) <= TOWER.radius + 4) {
			game.selectedTower = tower;
			game.selectedEnemy = null;
			game.towerPanel = TOWER_PANEL.INFO;
			game.holdDelete = { tower: tower, accumulated: 0 };
			playTowerSelect();
			return true;
		}
	}
	return false;
}

// 좌표에 적이 있으면 그 적을 선택(타워 선택 해제) 후 true. 위에 그려진 적 우선(뒤에서부터).
function selectEnemyAt(p) {
	for (let i = game.entities.enemies.length - 1; i >= 0; i--) {
		const e = game.entities.enemies[i];
		if (e.kind === 'barrier') continue; // 장벽은 선택 대상에서 제외
		if (Math.hypot(p.x - e.x, p.y - e.y) <= e.radius + 6) {
			game.selectedEnemy = e;
			game.selectedTower = null;
			game.towerPanel = TOWER_PANEL.INFO;
			game.holdDelete = null;
			playButton(); // 적 선택은 타워 선택음이 아니라 범용 효과음
			return true;
		}
	}
	return false;
}

// 2단계 배치 확정(✅) 버튼 — 고스트가 위쪽 절반이면 아래, 아래쪽이면 위에 배치.
function ghostConfirmRect() {
	const g = game.ghostTower;
	const bw = 46;
	const bh = 46;
	const off = TOWER.radius + 30;
	const cy = g.y < LOGICAL_H / 2 ? g.y + off : g.y - off;
	return { x: g.x - bw / 2, y: cy - bh / 2, w: bw, h: bh };
}

function drawGhostTower() {
	const g = game.ghostTower;
	const ok = canPlaceTower(g.x, g.y);
	// 사거리 미리보기 — drawTowerRange 재사용 (채움만, 테두리 0). g.range = 현재 위치 버프 반영 사거리.
	drawTowerRange(g, 0.12, 0);
	// 고스트 본체 (반투명) + 유효성 링
	ctx.globalAlpha = 0.55;
	drawTowerSprite(g.cfg, g.x, g.y);
	ctx.globalAlpha = 1;
	ctx.strokeStyle = ok ? '#2ecc71' : '#e74c3c';
	ctx.lineWidth = 2;
	ctx.setLineDash([4, 3]);
	ctx.beginPath();
	ctx.arc(g.x, g.y, TOWER.radius + 5, 0, Math.PI * 2);
	ctx.stroke();
	ctx.setLineDash([]);
	// 확정 버튼 (✅) — 배치 불가 시 흐리게(비활성)
	const r = ghostConfirmRect();
	ctx.globalAlpha = ok ? 1 : 0.4;
	ctx.fillStyle = ok ? '#27ae60' : '#7f8c8d';
	roundRect(r.x, r.y, r.w, r.h, 10);
	ctx.fill();
	ctx.strokeStyle = '#fff';
	ctx.lineWidth = 2;
	ctx.stroke();
	ctx.lineWidth = 4;
	ctx.lineJoin = 'round';
	ctx.beginPath();
	ctx.moveTo(r.x + 13, r.y + r.h / 2);
	ctx.lineTo(r.x + r.w * 0.42, r.y + r.h - 14);
	ctx.lineTo(r.x + r.w - 11, r.y + 14);
	ctx.stroke();
	ctx.globalAlpha = 1;
}

// ============ Playing scene ============
scenes.playing = {
	enter() {
		// 호출자가 resetGame() 또는 loadGame() 호출
	},
	update(dt) {
		updateToast(dt);
		syncBattleMusic(game.bossActive, getActiveMap().bgm); // 보스 ↔ 맵 BGM 전환
		if (game.modal) return;
		if (game.settingsOpen) return;
		if (game.paused) return;
		if (game.holdDelete) {
			game.holdDelete.accumulated += dt;
			if (game.holdDelete.accumulated >= HOLD_DELETE_SECONDS) {
				deleteTower(game.holdDelete.tower);
				game.holdDelete = null;
			}
		}
		if (game.waveState === 'spawning') {
			for (const sp of game.waves) {
				sp.spawnTimer += dt;
				const canSpawn = sp.isBoss || sp.spawnedThisWave < sp.enemiesPerWave;
				if (sp.spawnTimer >= sp.spawnInterval && canSpawn) {
					sp.spawnTimer = 0;
					sp.spawnedThisWave++;
					spawnEnemy(sp);
				}
			}
		} else if (game.waveState === 'intermission') {
			game.intermissionTimer -= dt;
			if (game.intermissionTimer <= 0) {
				startNextWave();
			}
		}

		for (const e of game.entities.enemies) updateEnemy(e, dt);
		// 패시브 오라(감속·회복차단) 리셋 — 아래 updateTower들이 다시 push, 적은 다음 프레임 소비
		for (const e of game.entities.enemies) { e.slowFactor = 1; e.regenDisabled = false; }
		for (const tower of game.entities.towers) updateTower(tower, dt);
		for (const p of game.entities.projectiles) updateProjectile(p, dt);
		for (const b of game.effects.beams) updateBeam(b, dt);
		for (const l of game.effects.links) updateLink(l, dt);
		for (const s of game.effects.splashes) updateSplash(s, dt);
		for (const z of game.effects.zaps) updateZap(z, dt);
		for (const fx of game.effects.barrierSpawnFx) updateBarrierSpawnFx(fx, dt);
		for (const fx of game.effects.shieldBreakFx) updateShieldBreakFx(fx, dt);
		for (const d of game.effects.empDevices) updateEmpDevice(d, dt);

		game.entities.enemies = game.entities.enemies.filter(e => !e.dead);
		game.entities.projectiles = game.entities.projectiles.filter(p => !p.dead);
		game.effects.beams = game.effects.beams.filter(b => !b.dead);
		game.effects.links = game.effects.links.filter(l => !l.dead);
		game.effects.splashes = game.effects.splashes.filter(s => !s.dead);
		game.effects.zaps = game.effects.zaps.filter(z => !z.dead);
		game.effects.barrierSpawnFx = game.effects.barrierSpawnFx.filter(fx => !fx.dead);
		game.effects.shieldBreakFx = game.effects.shieldBreakFx.filter(fx => !fx.dead);
		game.effects.empDevices = game.effects.empDevices.filter(d => !d.dead);

		// 게임오버 판정을 웨이브 완료·저장보다 먼저 — 마지막 적이 골인하며 hp가 0이 된 프레임에
		// 다음 웨이브가 setup·저장되면 hp 0 상태가 저장돼 불러올 때 즉시 게임오버가 됨.
		if (game.hp <= 0) {
			game.hp = 0;
			game.selectedTower = null;
			game.selectedEnemy = null;
			game.towerPanel = TOWER_PANEL.INFO;
			game.ghostTower = null;
			changeScene('gameOver');
			return;
		}

		let batchEnded = false;
		if (game.waveState === 'spawning') {
			if (game.bossActive) {
				if (!game.entities.enemies.some(e => isBoss(e))) {
					game.bossActive = false;
					game.entities.enemies = [];
					game.waves = [];
				}
			} else {
				// 웨이브 완료 추적 — 스폰 완료 + 그 웨이브의 비-장벽 적 소멸.
				// 단 n 웨이브는 n 이하 웨이브가 모두 끝나야 종료 → 가장 낮은 활성 웨이브부터
				// 순서대로만 제거 (높은 번호가 먼저 비어도 아래가 남아 있으면 대기).
				// game.waves는 항상 오름차순: 초기 1개 + 추가는 더 큰 번호를 뒤에 push, 앞에서만 제거.
				while (game.waves.length > 0) {
					const sp = game.waves[0];
					const done = sp.spawnedThisWave >= sp.enemiesPerWave
						&& !game.entities.enemies.some(e => e.kind !== 'barrier' && e.waveNum === sp.wave);
					if (!done) break;
					game.waves.shift();
				}
			}
			// 모든 웨이브 완료 → 배치 종료 (다음 웨이브로 진행). 장벽 생성 fx는 순수 연출이라 대기 안 함.
			if (game.waves.length === 0) {
				batchEnded = true;
			}
		}
		if (batchEnded) {
			grantWaveEndXp();
			// 잔여 장벽 정리 (배치 종료 시 사라짐) + 대기 중이던 생성 fx도 폐기(다음 웨이브에 장벽 새어나옴 방지)
			game.entities.enemies = game.entities.enemies.filter(e => e.kind !== 'barrier');
			game.effects.barrierSpawnFx = [];
			game.effects.empDevices = []; // EMP 장치도 웨이브 종료 시 소멸
			// 진행 기준을 이번 배치 최고 호출 웨이브로 (다음은 +1)
			game.wave = game.waveFrontier;
			if (game.wave > game.bestWaveReached) game.bestWaveReached = game.wave;
			if (getIntermissionEnabled()) {
				game.waveState = 'intermission';
				// 이전 판 최고 도달 / 현재 wave 중 큰 값 기준 — 1회 도달 후 다음 판부터 짧은 인터미션
				const benchmark = Math.max(game.wave, game.bestWaveReached);
				game.intermissionTimer = benchmark >= 40 ? 1 : benchmark >= 20 ? 2 : 3;
			} else {
				// 인터미션 off — 대기 없이 즉시 다음 웨이브 (setupWave가 game.waves 재구성, saveGame 포함)
				startNextWave();
			}
		}

		// 선택된 적이 사라졌으면(처치/완주/배치 종료) 선택 해제
		if (game.selectedEnemy && !game.entities.enemies.includes(game.selectedEnemy)) {
			game.selectedEnemy = null;
		}

		if (!game.modal && !hasSeenIntro(TIER4_INTRO_KEY) && hasReadyTier4Candidate()) {
			game.modal = { type: 'tier4Intro' };
		}
		if (!game.modal && !hasSeenIntro(TIER5_INTRO_KEY) && hasReadyTier5Candidate()) {
			game.modal = { type: 'tier5Intro' };
		}
	},
	draw() {
		updateHUD(); // dom 이라 제일 먼저
		// 배경 잔디
		ctx.fillStyle = '#2d4a2b';
		ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
		drawPath(getActiveMap());

		// 비선택 타워 사거리는 합집합으로 한 번에 — 겹쳐도 채움이 진해지지 않음
		drawTowerRangesUnion(game.entities.towers.filter(t => t !== game.selectedTower), 0.05, 0.12);
		if (game.selectedTower) {
			drawTowerRange(game.selectedTower, 0.18, 0.5);
		}
		// EMP 적 선택 시 처치 지점 기준 장치 대상 탐색 반경 표시 — 타워 사거리와 동일한 원반
		if (game.selectedEnemy?.kind === 'emp') {
			const se = game.selectedEnemy;
			drawTowerRange({ x: se.x, y: se.y, range: EMP_STUN_RANGE, cfg: {} }, 0.18, 0.5);
		}

		for (const tower of game.entities.towers) drawTower(tower);
		for (const e of game.entities.enemies) drawEnemy(e);
		// HP바는 본체를 모두 그린 뒤 별도 패스로 — 뭉친 적끼리 가림 방지.
		// 보스(고정 UI)·장벽(자체 표현)은 HP바 없음.
		for (const e of game.entities.enemies) {
			if (e.kind === 'barrier' || isBoss(e)) continue;
			drawEnemyHpBar(e);
		}
		if (game.selectedEnemy) {
			const se = game.selectedEnemy;
			ctx.strokeStyle = '#fff';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(se.x, se.y, se.radius + 4, 0, Math.PI * 2);
			ctx.stroke();
		}
		for (const pr of game.entities.projectiles) drawProjectile(pr);
		for (const b of game.effects.beams) drawBeam(b);
		for (const l of game.effects.links) drawLink(l);
		for (const s of game.effects.splashes) drawSplash(s);
		for (const z of game.effects.zaps) drawZap(z);
		for (const fx of game.effects.barrierSpawnFx) drawBarrierSpawnFx(fx);
		for (const fx of game.effects.shieldBreakFx) drawShieldBreakFx(fx);
		for (const d of game.effects.empDevices) drawEmpDevice(d);

		drawBossHpBar();
		drawWaveSpawnSummary(game.waveSpawnCounts);

		if (game.holdDelete) {
			const progress = Math.min(1, game.holdDelete.accumulated / HOLD_DELETE_SECONDS);
			const tower = game.holdDelete.tower;
			ctx.strokeStyle = '#e74c3c';
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.arc(tower.x, tower.y, TOWER.radius + 7, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
			ctx.stroke();
		}

		if (game.ghostTower) drawGhostTower();

		if (game.waveState === 'intermission') {
			ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
			ctx.fillRect(0, LOGICAL_H / 2 - 28, LOGICAL_W, 56);
			ctx.textAlign = 'center';
			ctx.fillStyle = '#fff';
			ctx.font = 'bold 18px sans-serif';
			ctx.fillText(t('hint.nextWave', { n: Math.ceil(game.intermissionTimer) }), LOGICAL_W / 2, LOGICAL_H / 2 + 6);
		}

		if (game.selectedTower) {
			if (game.towerPanel === TOWER_PANEL.PROMOTION) {
				const sel = game.selectedTower;
				drawPromotionPanel(sel, canAffordPromotion(sel), getPromotionChoices(sel));
			} else if (game.towerPanel === TOWER_PANEL.SETTINGS) {
				drawTowerSettingsCard(game.selectedTower, towerDualCapable(game.selectedTower.cfg));
			} else {
				drawTowerInfoPanel(game.selectedTower, getPromotionState(game.selectedTower));
			}
		} else if (game.selectedEnemy) {
			// 둔화 표시 배율 — 속도 하한이 반영된 유효 속도 기준 (enemy.getEffectiveSpeed와 단일 기준)
			drawEnemyInfoPanel(game.selectedEnemy, getEffectiveSpeed(game.selectedEnemy) / game.selectedEnemy.speed, !isBoss(game.selectedEnemy));
		} else if (game.ghostTower) {
			ctx.textAlign = 'center';
			ctx.font = '12px sans-serif';
			ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
			ctx.fillText(t('hint.cancelPlace'), LOGICAL_W / 2, LOGICAL_H - 20);
		} else {
			ctx.textAlign = 'center';
			ctx.font = '12px sans-serif';
			ctx.fillStyle = game.gold >= TOWER.cost ? 'rgba(255,255,255,0.7)' : 'rgba(255,150,150,0.7)';
			ctx.fillText(t('hint.placeTower', { cost: TOWER.cost }), LOGICAL_W / 2, LOGICAL_H - 28);
			ctx.fillStyle = 'rgba(255,255,255,0.7)';
			ctx.fillText(t('hint.holdDelete'), LOGICAL_W / 2, LOGICAL_H - 12);
		}

		if (!game.selectedTower && !game.selectedEnemy && !game.modal && !game.settingsOpen && !game.ghostTower) {
			drawNextWaveButton({
				enabled: canCallExtraWave(),
				showBadge: !hasSeenIntro(PARALLEL_INTRO_KEY),
				triple: game.waves.length >= 2,
			});
			drawPauseButton(game.paused);
		}
		if (game.paused) drawPausedOverlay();

		if (game.modal) {
			const intro = INTRO_MODALS[game.modal.type];
			if (intro) intro.draw();
		}

		if (game.settingsOpen) drawSettingsModal(playingSettingsButtons);

		if (game.toast) drawToast(game.toast);
	},
	pointerDown(p) {
		if (game.settingsOpen) {
			if (settingsModalTap(p, playingSettingsButtons)) game.settingsOpen = false;
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
		// 추가 웨이브 — 현재 웨이브를 유지한 채 다음 웨이브를 병렬로 호출.
		// 첫 탭(미열람)은 호출 대신 안내 모달. 이후엔 비활성 시 무동작(보스 사유면 토스트).
		if (!game.selectedTower && hitButton(nextWaveButton, p)) {
			if (!hasSeenIntro(PARALLEL_INTRO_KEY)) {
				playButton();
				game.modal = { type: 'parallelIntro' };
			} else if (canCallExtraWave()) {
				callExtraWave();
				playButton();
			} else if (extraWaveBossBlocked()) {
				setToast(t('toast.bossParallel'));
			}
			return;
		}
		// 2단계 배치: 고스트 활성 중 — 확정 / 재드래그 / 취소
		if (game.ghostTower) {
			const g = game.ghostTower;
			if (hitButton(ghostConfirmRect(), p)) {
				// 유효 위치일 때만 배치 (배치 불가 시 버튼 비활성 — 무동작)
				if (canPlaceTower(g.x, g.y)) {
					placeTower(g.x, g.y);
					playTowerPlace();
					game.ghostTower = null;
				}
				return;
			}
			if (Math.hypot(p.x - g.x, p.y - g.y) <= TOWER.radius + 8) {
				g.dragging = true; // 고스트 재드래그
				return;
			}
			game.ghostTower = null; // 다른 영역 → 취소
			return;
		}
		if (game.selectedTower && game.towerPanel === TOWER_PANEL.SETTINGS) {
			if (hitButton(SETTINGS_DELETE_BTN, p)) {
				playButton();
				deleteTower(game.selectedTower); // 홀드와 달리 즉시 삭제
				return;
			}
			if (handleTowerSettingsTap(game.selectedTower, p)) {
				playButton();
				return;
			}
			if (hitButton(infoPanel, p)) return; // 카드 내부 빈 영역 탭 소비
			if (!selectTowerAt(p)) deselectTower(); // 다른 타워면 선택 전환, 빈 곳이면 전체 닫기
			return;
		}
		if (game.selectedTower && game.towerPanel === TOWER_PANEL.PROMOTION) {
			if (hitButton(promotionCloseButton, p)) {
				game.towerPanel = TOWER_PANEL.INFO;
				return;
			}

			if (isFusionTriggerContext(game.selectedTower)) {
				if (hitButton(tier4ResultCardSlot, p)) {
					const second = game.selectedTower;
					if (promoteFusion(second)) {
						playPromote();
						game.towerPanel = TOWER_PANEL.INFO;
						game.selectedTower = second; // 변환된 4티어 그대로 선택 유지
					}
					return;
				}
				if (hitButton(promotionPanel, p)) return;
				if (!selectTowerAt(p)) deselectTower(); // 다른 타워면 선택 전환, 빈 곳이면 닫기
				return;
			}

			const promotions = game.selectedTower.cfg.promotions;
			for (let i = 0; i < promotions.length && i < promotionCardSlots.length; i++) {
				if (hitButton(promotionCardSlots[i], p)) {
					if (promoteTower(game.selectedTower, promotions[i])) {
						playPromote();
						game.towerPanel = TOWER_PANEL.INFO;
					}
					return;
				}
			}
			if (hitButton(promotionPanel, p)) {
				return;
			}
			if (!selectTowerAt(p)) deselectTower(); // 다른 타워면 선택 전환, 빈 곳이면 닫기
			return;
		}

		if (game.selectedTower) {
			if (hitButton(infoWikiButton, p)) {
				playButton();
				openWikiAtTower(game.selectedTower.role, 'playing');
				return;
			}
			if (hitButton(infoSettingsButton, p)) {
				playButton();
				game.towerPanel = TOWER_PANEL.SETTINGS;
				return;
			}
			if (game.selectedTower.canPromote && hitButton(infoPromotionButton, p)) {
				if (handlePromotionButton(game.selectedTower)) playButton();
				return;
			}
		}

		// 적 정보 카드 위키 버튼 — 위키 항목이 있는 적만 (보스 제외, 버튼도 안 그려짐)
		if (game.selectedEnemy && !isBoss(game.selectedEnemy) && hitButton(infoWikiButton, p)) {
			playButton();
			openWikiAtEnemy(game.selectedEnemy.spriteType, 'playing');
			return;
		}

		// 타워 hit는 정보 패널 안 빈 영역보다 먼저 검사
		if (selectTowerAt(p)) return;

		// 정보 카드(타워/적 공용 위치) 내부 탭 → 소비 (그 아래 지나가는 적이 선택되지 않도록 적 검사보다 먼저)
		if ((game.selectedTower || game.selectedEnemy) && hitButton(infoPanel, p)) {
			return;
		}

		// 적 hit → 적 정보 선택
		if (selectEnemyAt(p)) return;

		if (game.selectedTower || game.selectedEnemy) {
			deselectTower();
			return;
		}
		if (getOneTouchPlace()) {
			if (placeTower(p.x, p.y)) playTowerPlace();
		} else {
			createGhostTower(p.x, p.y); // 2단계 배치 고스트
			playButton();
		}
	},
	pointerMove(p) {
		if (game.settingsOpen) { volumePointerMove(p); return; }
		moveGhostTower(p.x, p.y);
	},
	pointerUp() {
		volumePointerUp();
		if (game.ghostTower) game.ghostTower.dragging = false;
	},
	pointerCancel() {
		volumePointerUp();
		if (game.ghostTower) game.ghostTower.dragging = false;
	},
	backButton() {
		// 설정 열린 상태 → 닫기
		if (game.settingsOpen) {
			game.settingsOpen = false;
			return;
		}
		// 고스트(2단계 배치) 진행 중 → 취소
		if (game.ghostTower) {
			game.ghostTower = null;
			return;
		}
		// 설정 카드 열린 상태 → 정보 카드로
		if (game.selectedTower && game.towerPanel === TOWER_PANEL.SETTINGS) {
			game.towerPanel = TOWER_PANEL.INFO;
			return;
		}
		// 전직 카드 열린 상태 → 타워 선택 화면으로
		if (game.selectedTower && game.towerPanel === TOWER_PANEL.PROMOTION) {
			game.towerPanel = TOWER_PANEL.INFO;
			return;
		}
		// 타워 선택 상태 → 선택 해제
		if (game.selectedTower) {
			game.selectedTower = null;
			return;
		}
		// 적 선택 상태 → 선택 해제
		if (game.selectedEnemy) {
			game.selectedEnemy = null;
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
			const input = prompt(t('sandbox.jumpPrompt'), String(game.wave));
			if (input === null) return;
			const wave = parseInt(input, 10);
			if (isNaN(wave) || wave < 1) return;
			jumpToWave(wave);
		} else if (e.code === 'Delete') {
			e.preventDefault();
			for (const tower of game.entities.towers) tower.totalDamage = 0;
		} else if (e.code === 'KeyS') {
			e.preventDefault();
			game.sandboxShieldsEnabled = !game.sandboxShieldsEnabled;
			setToast(t('toast.sandboxShields', { s: game.sandboxShieldsEnabled ? 'ON' : 'OFF' }));
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
		ctx.fillText(t('gameover.defeat', { n: game.wave }), LOGICAL_W / 2, 252);

		drawButton(gameOverButtons.restart, t('gameover.restart'));
		drawButton(gameOverButtons.toTitle, t('gameover.toTitle'));
	},
	pointerDown(p) {
		if (hitButton(gameOverButtons.restart, p)) {
			resetGame(game.mapId); // 죽은 맵 그대로 재시작
			changeScene('playing');
		} else if (hitButton(gameOverButtons.toTitle, p)) {
			changeScene('title');
		}
	},
};
