import { ctx, hudEl } from './core/canvas.js';
import {
	LOGICAL_W, LOGICAL_H, TOWER, EMP_STUN_RANGE, HOLD_DELETE_SECONDS, TIER4_INTRO_KEY, TIER5_INTRO_KEY,
	QUEUE_INTRO_KEY, PARALLEL_INTRO_KEY, STATS_INTRO_KEY, GOLD, MAP_BG_COLOR,
} from './core/config.js';
import {
	game, resetGame, loadGame, loadSaveData,
	hasSeenIntro, setIntroSeen, resetLocalData, getOneTouchPlace,
	getIntermissionEnabled, getUnlockedMaps, clearEffects,
} from './state.js';
import { getActiveMap, MAPS } from './core/maps.js';
import { drawButton, hitButton, clamp } from './core/helpers.js';
import {
	spawnEnemy, updateEnemy, drawEnemy, drawBossHpBar,
	updateBarrierSpawnFx, updateShieldBreakFx, updateParachuteFx, updateEmpDevice, isBoss, getEffectiveSpeed, isInUnderpass,
} from './enemy.js';
import {
	placeTower, createGhostTower, moveGhostTower, canPlaceTower,
	promoteTower, updateTower, drawTower,
	getPromotionState, getPromotionChoices, towerDualCapable, handleTowerSettingsTap, canAffordPromotion, getTowerRefund,
	grantWaveEndXp, recomputeStats,
	handlePromotionButton, promoteFusion, hasReadyTier4Candidate, hasReadyTier5Candidate, isFusionTriggerContext,
	getReservationChoices, reserveTowerPromotion, moveReservation, cancelReservation, processReservations,
} from './tower.js';
import { drawTowerRange, drawTowerRangesUnion, drawBarrierSpawnFx, drawShieldBreakFx, drawParachuteFx, drawEmpDevice, drawConfirmButton } from './ui/sprite.js';
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
	nextWaveButton, drawNextWaveButton, hudToggleButton, drawHudToggleButton, statsButton, drawStatsButton,
	STATS_PANEL_W, STATS_PANEL_H, drawStatsLayer, drawTowerRankBadge,
	drawToast, drawEnemyHpBar,
	drawSettingsModal, drawPath, drawMapThumb, drawUnderpass,
} from './ui.js';
import { INTRO_MODALS } from './ui/intro-modals.js';
import {
	drawEnemyInfoPanel, drawTowerInfoPanel, drawTowerSettingsCard, infoSettingsButton, infoWikiButton, SETTINGS_DELETE_BTN, infoPanel, infoPromotionButton,
	drawPromotionPanel, promotionPanel, promotionCloseButton, promotionCardSlots, tier4ResultCardSlot,
	infoQueueButton,
	drawTowerQueuePanel, queuePanel, getQueueLayout,
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
let titleSave = null;

scenes.title = {
	settingsOpen: false,
	enter() {
		titleSave = loadSaveData();
		this.settingsOpen = false;
		playBgm('normal'); // 타이틀·일반 웨이브 공용 BGM
	},
	update() {},
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

		// 추천 액션(저장 있으면 이어하기, 없으면 시작)만 pulse 강조
		if (titleSave) {
			drawButton(titleButtonsWithSave.continueBtn, [
				{ label: t('title.continue'), font: '13px sans-serif', margin: 6 },
				{ label: `Wave ${titleSave.wave}` },
			], { pulse: true });
			drawButton(titleButtonsWithSave.start, [{ label: t('title.start') }]);
			drawButton(titleButtonsWithSave.wiki, [{ label: t('common.wiki') }]);
			drawButton(titleButtonsWithSave.settings, [{ label: t('settings.title') }]);
		} else {
			drawButton(titleButtonsNoSave.start, [{ label: t('title.start') }], { pulse: true });
			drawButton(titleButtonsNoSave.wiki, [{ label: t('common.wiki') }]);
			drawButton(titleButtonsNoSave.settings, [{ label: t('settings.title') }]);
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
// 버튼은 단순 라벨 대신 맵 경로를 축소 렌더한 썸네일 카드. 화면 폭에 맞게 줄바꿈, 행·전체 블록 중앙 정렬.
// 해금 맵이 페이지 크기(4)를 넘으면 하단 ◀ ▶로 페이징 — 초과 행이 세로 공간(640)을 넘치기 때문.
const MAPS_PER_PAGE = 4;
const MAP_NAV_H = 72; // 페이징 시 그리드 아래에 확보하는 내비 영역 높이
const mapPagePrevBtn = { x: 40, y: LOGICAL_H - 52, w: 56, h: 36 };
const mapPageNextBtn = { x: LOGICAL_W - 96, y: LOGICAL_H - 52, w: 56, h: 36 };

function mapPageCount() {
	return Math.ceil(getUnlockedMaps().length / MAPS_PER_PAGE);
}

function mapSelectButtons(page) {
	const paged = mapPageCount() > 1;
	const ids = getUnlockedMaps().slice(page * MAPS_PER_PAGE, (page + 1) * MAPS_PER_PAGE);
	const TW = 150, TH = 250, GAP = 24;
	const perRow = Math.max(1, Math.floor((LOGICAL_W + GAP) / (TW + GAP)));
	const rows = Math.ceil(ids.length / perRow);
	const availH = paged ? LOGICAL_H - MAP_NAV_H : LOGICAL_H;
	const startY = (availH - (rows * TH + (rows - 1) * GAP)) / 2;
	return ids.map((id, i) => {
		const row = Math.floor(i / perRow);
		const cols = Math.min(perRow, ids.length - row * perRow); // 마지막 행은 남은 개수만큼 중앙 정렬
		const startX = (LOGICAL_W - (cols * TW + (cols - 1) * GAP)) / 2;
		return { id, x: startX + (i % perRow) * (TW + GAP), y: startY + row * (TH + GAP), w: TW, h: TH };
	});
}
scenes.mapSelect = {
	page: 0,
	enter() {
		this.page = 0;
	},
	update() {},
	draw() {
		ctx.fillStyle = '#1a2e1a';
		ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
		for (const b of mapSelectButtons(this.page)) drawMapThumb(MAPS[b.id], b);
		const pages = mapPageCount();
		if (pages > 1) {
			if (this.page > 0) drawButton(mapPagePrevBtn, [{ label: '◀' }]);
			if (this.page < pages - 1) drawButton(mapPageNextBtn, [{ label: '▶' }]);
			ctx.fillStyle = '#cdd';
			ctx.font = '14px sans-serif';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(`${this.page + 1} / ${pages}`, LOGICAL_W / 2, mapPagePrevBtn.y + mapPagePrevBtn.h / 2);
			ctx.textBaseline = 'alphabetic';
		}
	},
	pointerDown(p) {
		const pages = mapPageCount();
		if (pages > 1) {
			if (this.page > 0 && hitButton(mapPagePrevBtn, p)) {
				this.page--;
				return;
			}
			if (this.page < pages - 1 && hitButton(mapPageNextBtn, p)) {
				this.page++;
				return;
			}
		}
		for (const b of mapSelectButtons(this.page)) {
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
	resetGame(Object.keys(MAPS).at(-1)); // 항상 최신(마지막 정의) 맵에서 테스트
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
}

// 타워 삭제 공통 — 홀드 삭제 완료와 설정 패널 삭제 버튼이 공유. 선택·전직 대상 참조도 정리.
// 투입 골드 10% 환불(재료 타워 투입분 제외) + 토스트 안내.
function deleteTower(dead) {
	cancelReservation(dead); // 예약 큐에서 제거 + 뒤 순번 압축 (엔티티 제거 전에)
	game.entities.towers = game.entities.towers.filter(x => x !== dead);
	recomputeStats();
	const refund = getTowerRefund(dead);
	game.gold += refund;
	setToast(t('toast.towerRefund', { g: refund }));
	if (game.selectedTower === dead) {
		game.selectedTower = null;
	}
	game.fusionMaterials = game.fusionMaterials.filter(t => t !== dead);
}

// 좌표에 타워가 있으면 그 타워로 선택 전환(카드 닫음) 후 true, 없으면 false.
function selectTowerAt(p) {
	for (const tower of game.entities.towers) {
		if (Math.hypot(p.x - tower.x, p.y - tower.y) <= TOWER.radius + 4) {
			game.selectedTower = tower;
			game.selectedEnemy = null;
			tower.panel = null; // 주석 처리하면 타워마다 패널 기억하는데 전직 패널은 다른 시점에 골드가 부족할 수 있어서 검토 중
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
	drawConfirmButton(ghostConfirmRect(), ok);
}

// ============ Playing scene ============
scenes.playing = {
	controlsOpen: false, // 좌하단 접이식 컨트롤(일시정지·추가 웨이브) 펼침 여부
	settingsOpen: false, // 설정 모달 — 가장 권력있는 모달, game.modal 인트로 중에도 이전 버튼으로 띄울 수 있음 (타이틀 씬과 동형)
	statsOpen: false, // 통계 레이어(PIP) — 게임은 계속 진행, 바깥 탭/이전 버튼으로 닫음
	// 기본 위치 = 화면 정중앙. 이후 드래그로 이동 (세션 동안 유지)
	statsRect: { x: (LOGICAL_W - STATS_PANEL_W) / 2, y: (LOGICAL_H - STATS_PANEL_H) / 2, w: STATS_PANEL_W, h: STATS_PANEL_H },
	statsDrag: null, // 진행 중 이동 드래그 { dx, dy } — 터치점과 패널 좌상단의 오프셋
	enter() {
		// 호출자가 resetGame() 또는 loadGame() 호출
		this.controlsOpen = false;
		this.settingsOpen = false;
		this.statsOpen = false;
		this.statsDrag = null;
	},
	update(dt) {
		updateToast(dt);
		syncBattleMusic(game.bossActive, getActiveMap().bgm); // 보스 ↔ 맵 BGM 전환
		if (game.modal) return;
		if (this.settingsOpen) return;
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
		if (processReservations()) playPromote(); // 1순위 예약의 전직 조건 달성 시 즉시 전직 (+효과음)
		for (const p of game.entities.projectiles) updateProjectile(p, dt);
		for (const b of game.effects.beams) updateBeam(b, dt);
		for (const l of game.effects.links) updateLink(l, dt);
		for (const s of game.effects.splashes) updateSplash(s, dt);
		for (const z of game.effects.zaps) updateZap(z, dt);
		for (const fx of game.effects.barrierSpawnFx) updateBarrierSpawnFx(fx, dt);
		for (const fx of game.effects.shieldBreakFx) updateShieldBreakFx(fx, dt);
		for (const fx of game.effects.parachuteFx) updateParachuteFx(fx, dt);
		for (const d of game.effects.empDevices) updateEmpDevice(d, dt);

		game.entities.enemies = game.entities.enemies.filter(e => !e.dead);
		game.entities.projectiles = game.entities.projectiles.filter(p => !p.dead);
		game.effects.beams = game.effects.beams.filter(b => !b.dead);
		game.effects.links = game.effects.links.filter(l => !l.dead);
		game.effects.splashes = game.effects.splashes.filter(s => !s.dead);
		game.effects.zaps = game.effects.zaps.filter(z => !z.dead);
		game.effects.barrierSpawnFx = game.effects.barrierSpawnFx.filter(fx => !fx.dead);
		game.effects.shieldBreakFx = game.effects.shieldBreakFx.filter(fx => !fx.dead);
		game.effects.parachuteFx = game.effects.parachuteFx.filter(fx => !fx.dead);
		game.effects.empDevices = game.effects.empDevices.filter(d => !d.dead);

		// 게임오버 판정을 웨이브 완료·저장보다 먼저 — 마지막 적이 골인하며 hp가 0이 된 프레임에
		// 다음 웨이브가 setup·저장되면 hp 0 상태가 저장돼 불러올 때 즉시 게임오버가 됨.
		if (game.hp <= 0) {
			game.hp = 0;
			game.selectedTower = null;
			game.selectedEnemy = null;
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
		ctx.fillStyle = MAP_BG_COLOR;
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
		// 지상 적 → 지하도 입구 → 공중 적 순서 — 지하도 진행 중인 지상 적은 그리지 않고(지하에 있음),
		// 입구를 지상 적 뒤에 그려 입구에 걸친 적이 어둠에 겹치며 드나드는 연출. 공중 적(장벽 포함)은 그 위로.
		for (const e of game.entities.enemies) {
			if (e.ga !== 'air' && !isInUnderpass(e)) drawEnemy(e);
		}
		drawUnderpass(getActiveMap());
		for (const e of game.entities.enemies) {
			if (e.ga === 'air') drawEnemy(e);
		}
		// HP바는 본체를 모두 그린 뒤 별도 패스로 — 뭉친 적끼리 가림 방지.
		// 보스(고정 UI)·장벽(자체 표현)은 HP바 없음. 지하도 안 적도 HP바는 표시 — 본체만 숨고 위치·체력은 읽힘.
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
		for (const fx of game.effects.parachuteFx) drawParachuteFx(fx);
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
			const sel = game.selectedTower;
			if (sel.panel === 'promotion') {
				drawPromotionPanel(sel, canAffordPromotion(sel), getPromotionChoices(sel));
			} else if (sel.panel === 'queue') {
				drawTowerQueuePanel(sel, getReservationChoices(sel));
			} else if (sel.panel === 'settings') {
				drawTowerSettingsCard(sel, towerDualCapable(sel.cfg));
			} else {
				drawTowerInfoPanel(sel, getPromotionState(sel), !hasSeenIntro(QUEUE_INTRO_KEY));
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

		if (!game.selectedTower && !game.selectedEnemy && !game.modal && !this.settingsOpen && !this.statsOpen && !game.ghostTower) {
			const parallelBadge = !hasSeenIntro(PARALLEL_INTRO_KEY);
			const statsBadge = !hasSeenIntro(STATS_INTRO_KEY);
			// 접힌 상태에선 토글만 — 안쪽 버튼들의 미열람 배지는 토글이 대신 표시
			drawHudToggleButton(this.controlsOpen, !this.controlsOpen && (parallelBadge || statsBadge));
			if (this.controlsOpen) {
				drawStatsButton(statsBadge);
				drawNextWaveButton({
					enabled: canCallExtraWave(),
					showBadge: parallelBadge,
					triple: game.waves.length >= 2,
				});
				drawPauseButton(game.paused);
			}
		}
		if (game.paused) drawPausedOverlay();

		if (game.modal) {
			const intro = INTRO_MODALS[game.modal.type];
			if (intro) intro.draw(game.modal);
		}

		if (this.statsOpen) {
			// 웨이브 누적 데미지 상위 10 — 데미지 없는 타워는 집계 제외
			const ranked = game.entities.towers
				.filter(tw => tw.waveDamage > 0)
				.sort((a, b) => b.waveDamage - a.waveDamage)
				.slice(0, 10);
			// 맵상 배지 (예약 표시와 같은 자리) → 그 위에 레이어
			for (let i = 0; i < ranked.length; i++) drawTowerRankBadge(ranked[i], i + 1);
			drawStatsLayer(this.statsRect, ranked);
		}

		if (this.settingsOpen) drawSettingsModal(playingSettingsButtons);

		if (game.toast) drawToast(game.toast);
	},
	pointerDown(p) {
		if (this.settingsOpen) {
			if (settingsModalTap(p, playingSettingsButtons)) this.settingsOpen = false;
			return;
		}
		// 통계 레이어(PIP) — 바깥 탭은 닫기, 안쪽 탭은 이동 드래그 시작
		if (this.statsOpen) {
			if (!hitButton(this.statsRect, p)) {
				this.statsOpen = false;
				playButton();
				return;
			}
			this.statsDrag = { dx: p.x - this.statsRect.x, dy: p.y - this.statsRect.y };
			return;
		}
		if (game.modal) {
			const intro = INTRO_MODALS[game.modal.type];
			if (intro && hitButton(intro.confirmBtn, p)) {
				playButton();
				if (intro.key) setIntroSeen(intro.key); // key 없는 모달(맵 해금)은 매번 표시라 기록 없음
				game.modal = null;
			}
			return;
		}

		if (!game.selectedTower && hitButton(hudToggleButton, p)) {
			this.controlsOpen = !this.controlsOpen;
			playButton();
			return;
		}
		// 통계 버튼 — 첫 탭(미열람)은 레이어 대신 안내 모달 (병렬 웨이브 버튼과 동일 패턴)
		if (this.controlsOpen && !game.selectedTower && hitButton(statsButton, p)) {
			playButton();
			if (!hasSeenIntro(STATS_INTRO_KEY)) {
				game.modal = { type: 'statsIntro' };
				return;
			}
			this.controlsOpen = false;
			this.statsOpen = true;
			return;
		}
		if (this.controlsOpen && !game.selectedTower && hitButton(pauseButton, p)) {
			game.paused = !game.paused;
			playPauseToggle(game.paused);
			return;
		}
		// 추가 웨이브 — 현재 웨이브를 유지한 채 다음 웨이브를 병렬로 호출.
		// 첫 탭(미열람)은 호출 대신 안내 모달. 이후엔 비활성 시 무동작(보스 사유면 토스트).
		if (this.controlsOpen && !game.selectedTower && hitButton(nextWaveButton, p)) {
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
		if (game.selectedTower?.panel === 'settings') {
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
		if (game.selectedTower?.panel === 'queue') {
			const layout = getQueueLayout();
			if (layout) {
				for (const cell of layout.cells) {
					if (hitButton(cell, p)) {
						playButton();
						reserveTowerPromotion(game.selectedTower, cell.role); // 재터치=해제, 다른 셀=변경
						return;
					}
				}
				if (layout.prev && hitButton(layout.prev, p)) {
					playButton();
					moveReservation(game.selectedTower, -1);
					return;
				}
				if (layout.next && hitButton(layout.next, p)) {
					playButton();
					moveReservation(game.selectedTower, 1);
					return;
				}
			}
			if (hitButton(queuePanel, p)) return; // 패널 내부 빈 영역 탭 소비
			if (!selectTowerAt(p)) deselectTower(); // 다른 타워면 선택 전환, 빈 곳이면 닫기
			return;
		}
		if (game.selectedTower?.panel === 'promotion') {
			if (hitButton(promotionCloseButton, p)) {
				playButton();
				game.selectedTower.panel = null;
				return;
			}

			if (isFusionTriggerContext(game.selectedTower)) {
				if (hitButton(tier4ResultCardSlot, p)) {
					const second = game.selectedTower;
					if (promoteFusion(second)) {
						playPromote();
						second.panel = null;
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
						game.selectedTower.panel = null;
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
			if(game.selectedTower.canPromote) {
				// info 버튼 3개에서 하나 더 늘어나면 나열 중복 리팩트 고려하자
				if (hitButton(infoQueueButton, p)) {
					playButton();
					// 첫 탭(미열람)은 예약 패널 대신 안내 모달 (병렬 웨이브 버튼과 동일 패턴)
					if (!hasSeenIntro(QUEUE_INTRO_KEY)) game.modal = { type: 'queueIntro' };
					else game.selectedTower.panel = 'queue';
					return;
				}
				if (hitButton(infoPromotionButton, p)) {
					if (handlePromotionButton(game.selectedTower)) playButton();
					return;
				}
			}
			if (hitButton(infoWikiButton, p)) {
				playButton();
				openWikiAtTower(game.selectedTower.role, 'playing');
				return;
			}
			if (hitButton(infoSettingsButton, p)) {
				playButton();
				game.selectedTower.panel = 'settings';
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
		if (this.settingsOpen) { volumePointerMove(p); return; }
		if (this.statsOpen) {
			if (this.statsDrag) {
				this.statsRect.x = clamp(p.x - this.statsDrag.dx, 0, LOGICAL_W - this.statsRect.w);
				this.statsRect.y = clamp(p.y - this.statsDrag.dy, 0, LOGICAL_H - this.statsRect.h);
			}
			return;
		}
		moveGhostTower(p.x, p.y);
	},
	pointerUp() {
		volumePointerUp();
		this.statsDrag = null;
		if (game.ghostTower) game.ghostTower.dragging = false;
	},
	pointerCancel() {
		volumePointerUp();
		this.statsDrag = null;
		if (game.ghostTower) game.ghostTower.dragging = false;
	},
	backButton() {
		// 설정 열린 상태 → 닫기
		if (this.settingsOpen) {
			this.settingsOpen = false;
			return;
		}
		// 통계 레이어 열린 상태 → 닫기
		if (this.statsOpen) {
			this.statsOpen = false;
			return;
		}
		// 고스트(2단계 배치) 진행 중 → 취소
		if (game.ghostTower) {
			game.ghostTower = null;
			return;
		}
		// 설정/전직 카드 열린 상태 → 정보 카드로
		if (game.selectedTower?.panel) {
			game.selectedTower.panel = null;
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
		this.settingsOpen = true;
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

		// 마지막 골인으로 게임 오버를 유발한 적 — 오버레이 위에 다시 그려 하이라이트 (맥동 링)
		if (game.gameOverKiller) {
			const k = game.gameOverKiller;
			drawEnemy(k);
			const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 250);
			ctx.strokeStyle = `rgba(231, 76, 60, ${0.5 + 0.5 * pulse})`;
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(k.x, k.y, k.radius + 6, 0, Math.PI * 2);
			ctx.stroke();
		}

		ctx.textAlign = 'center';
		ctx.fillStyle = '#e74c3c';
		ctx.font = 'bold 42px sans-serif';
		ctx.fillText('GAME OVER', LOGICAL_W / 2, 200);

		ctx.fillStyle = '#fff';
		ctx.font = '16px sans-serif';
		ctx.fillText(t('gameover.defeat', { n: game.wave }), LOGICAL_W / 2, 252);

		drawButton(gameOverButtons.restart, [{ label: t('gameover.restart') }]);
		drawButton(gameOverButtons.toTitle, [{ label: t('gameover.toTitle') }]);
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
