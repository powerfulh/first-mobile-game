// 인트로 모달 — 신규 요소(공중/보스/방어막/병렬 등) 최초 등장 시 안내 모달.
// 아이콘만 개별 함수, 나머지(backdrop·제목·본문·버튼)는 makeIntro가 공통 처리.
// 새 인트로 추가: 아이콘(필요 시) + INTRO_MODALS 항목 + config 키.
import { ctx } from '../core/canvas.js';
import {
	LOGICAL_W, LOGICAL_H, AIR_COLOR, ACCENT_RED, GOLD, INFO_BLUE,
	AIR_INTRO_KEY, BUFF_INTRO_KEY, BOSS_INTRO_KEY, SHIELD_INTRO_KEY,
	TIER4_INTRO_KEY, TIER5_INTRO_KEY, REGEN_INTRO_KEY, BARRIER_INTRO_KEY, EMP_INTRO_KEY, TRANSPORT_INTRO_KEY,
	QUEUE_INTRO_KEY, PARALLEL_INTRO_KEY, SHORTCUT_INTRO_KEY, UNDERPASS_INTRO_KEY, STATS_INTRO_KEY, MAP_BG_COLOR,
} from '../core/config.js';
import { MAPS } from '../core/maps.js';
import { roundRect, drawButton, drawPanel } from '../core/helpers.js';
import { drawEnemySprite, drawHourglassIcon } from './sprite.js';
import { t } from '../core/i18n.js';

// 표준 모달 레이아웃 (대부분 공유, tier4만 별도)
const STD_PANEL = { x: 20, y: 180, w: 320, h: 280 };
const STD_BTN = { x: 110, y: 406, w: 140, h: 40 };

function drawIntroBackdrop(panel, accent, dimAlpha = 0.65) {
	ctx.fillStyle = `rgba(0, 0, 0, ${dimAlpha})`;
	ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
	drawPanel(panel.x, panel.y, panel.w, panel.h, { radius: 12, stroke: accent });
}

function drawBossIcon(cx, cy) {
	ctx.fillStyle = '#922b21';
	ctx.beginPath();
	ctx.ellipse(cx, cy, 22, 14, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#000';
	ctx.lineWidth = 2;
	ctx.stroke();
}

function drawBuffIcon(cx, cy) {
	const ir = 14;
	const auraPulse = 0.5 + 0.5 * Math.sin(performance.now() / 700);
	ctx.globalAlpha = 0.4 + 0.3 * auraPulse;
	ctx.strokeStyle = '#d4ac0d';
	ctx.lineWidth = 2;
	ctx.setLineDash([4, 3]);
	ctx.beginPath();
	ctx.arc(cx, cy, ir + 7, 0, Math.PI * 2);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.globalAlpha = 1;

	ctx.fillStyle = '#d4ac0d';
	ctx.beginPath();
	for (let i = 0; i < 8; i++) {
		const a = i * Math.PI / 4 + Math.PI / 8;
		const px = cx + ir * Math.cos(a);
		const py = cy + ir * Math.sin(a);
		if (i === 0) ctx.moveTo(px, py);
		else ctx.lineTo(px, py);
	}
	ctx.closePath();
	ctx.fill();
	ctx.strokeStyle = '#9a7d0a';
	ctx.lineWidth = 2;
	ctx.stroke();
}

function drawTier4Icon(cx, cy) {
	ctx.fillStyle = '#1abc9c';
	ctx.beginPath();
	ctx.arc(cx - 12, cy, 12, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = GOLD;
	ctx.beginPath();
	ctx.arc(cx + 12, cy, 12, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#fff';
	ctx.font = 'bold 18px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('+', cx, cy);
	ctx.textBaseline = 'alphabetic';
}

function drawTier5Icon(cx, cy) {
	// 서로 다른 3종(작은 원, 삼각 배치) → 중앙 5티어 결과 코어(금빛, 숫자 5)
	const colors = ['#3f80d4', '#b04fc9', '#29ac66'];
	for (let i = 0; i < 3; i++) {
		const a = -Math.PI / 2 + i * (Math.PI * 2 / 3);
		ctx.fillStyle = colors[i];
		ctx.beginPath();
		ctx.arc(cx + Math.cos(a) * 15, cy + Math.sin(a) * 15, 8, 0, Math.PI * 2);
		ctx.fill();
	}
	const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 400);
	ctx.fillStyle = GOLD;
	ctx.beginPath();
	ctx.arc(cx, cy, 8 + pulse * 1.5, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = '#fff';
	ctx.font = 'bold 13px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('5', cx, cy);
	ctx.textBaseline = 'alphabetic';
}

function drawParallelIcon(cx, cy) {
	// ⏩ 빨리감기 두 삼각형 — 추가 웨이브 버튼과 동일 모티프
	ctx.fillStyle = INFO_BLUE;
	const w = 11, h = 20;
	for (const dx of [-w, 1]) {
		ctx.beginPath();
		ctx.moveTo(cx + dx, cy - h / 2);
		ctx.lineTo(cx + dx, cy + h / 2);
		ctx.lineTo(cx + dx + w, cy);
		ctx.closePath();
		ctx.fill();
	}
}

function drawShortcutIcon(cx, cy) {
	// 두 세로 길(회색) + 공중색 점선 가로지름
	ctx.strokeStyle = '#8a7a5a';
	ctx.lineWidth = 7;
	for (const dx of [-16, 16]) {
		ctx.beginPath();
		ctx.moveTo(cx + dx, cy - 14);
		ctx.lineTo(cx + dx, cy + 14);
		ctx.stroke();
	}
	ctx.strokeStyle = AIR_COLOR;
	ctx.lineWidth = 5;
	ctx.setLineDash([5, 4]);
	ctx.beginPath();
	ctx.moveTo(cx - 16, cy);
	ctx.lineTo(cx + 16, cy);
	ctx.stroke();
	ctx.setLineDash([]);
}

function drawMapUnlockIcon(cx, cy) {
	// 미니 맵 카드 + 경로 squiggle
	const w = 34, h = 26;
	ctx.fillStyle = MAP_BG_COLOR;
	roundRect(cx - w / 2, cy - h / 2, w, h, 4);
	ctx.fill();
	ctx.strokeStyle = GOLD;
	ctx.lineWidth = 2;
	ctx.stroke();
	ctx.strokeStyle = '#8a7a5a';
	ctx.lineWidth = 3;
	ctx.lineJoin = 'round';
	ctx.beginPath();
	ctx.moveTo(cx - 10, cy - 8);
	ctx.lineTo(cx - 10, cy);
	ctx.lineTo(cx + 6, cy);
	ctx.lineTo(cx + 6, cy + 8);
	ctx.stroke();
}

function drawUnderpassIcon(cx, cy) {
	// 미니 지하도 단면 — 노면이 어두워지며 문틀 아래로 들어가고, 지하 구간은 점선
	const h = 12;
	const frameX = cx - 2;
	ctx.fillStyle = '#8a7a5a';
	ctx.fillRect(cx - 32, cy - h / 2, 30, h);
	ctx.fillStyle = '#17120d';
	for (let i = 0; i < 4; i++) {
		ctx.globalAlpha = 0.75 * (i + 1) / 4;
		ctx.fillRect(frameX - 24 + i * 6, cy - h / 2, 6, h);
	}
	ctx.globalAlpha = 1;
	ctx.fillStyle = '#77828a';
	ctx.fillRect(frameX, cy - h / 2 - 3, 6, h + 6);
	ctx.strokeStyle = '#17120d';
	ctx.globalAlpha = 0.45;
	ctx.lineWidth = 3;
	ctx.setLineDash([4, 6]);
	ctx.beginPath();
	ctx.moveTo(frameX + 10, cy);
	ctx.lineTo(cx + 32, cy);
	ctx.stroke();
	ctx.setLineDash([]);
	ctx.globalAlpha = 1;
}

function drawStatsIntroIcon(cx, cy) {
	// 막대그래프 — 통계 버튼 아이콘의 확대판
	ctx.fillStyle = '#fff';
	ctx.fillRect(cx - 22, cy - 2, 12, 18);
	ctx.fillRect(cx - 6, cy - 14, 12, 30);
	ctx.fillRect(cx + 10, cy + 6, 12, 10);
	ctx.fillRect(cx - 26, cy + 18, 52, 3);
}

// 데이터 → { key, panel, confirmBtn, draw }. 특수 본문은 drawExtra(panel, cx)로.
// key 없는 항목은 1회성이 아니라 조건 충족마다 표시. lines 항목이 함수면 (modal) => 완성 문자열.
function makeIntro(opts) {
	const {
		key, accent, dimAlpha = 0.65,
		panel = STD_PANEL, confirmBtn = STD_BTN,
		drawIcon, iconY = 54,
		title, titleColor = '#fff', titleSize = 22, titleY = 108,
		lines = [], lineColor = '#cdd', lineSize = 14, lineStart = 150, lineGap = 26,
		drawExtra,
	} = opts;
	return {
		key, panel, confirmBtn,
		draw(modal) {
			drawIntroBackdrop(panel, accent, dimAlpha);
			const cx = LOGICAL_W / 2;
			if (drawIcon) drawIcon(cx, panel.y + iconY);
			ctx.textAlign = 'center';
			ctx.textBaseline = 'alphabetic';
			ctx.fillStyle = titleColor;
			ctx.font = `bold ${titleSize}px sans-serif`;
			ctx.fillText(t(title), cx, panel.y + titleY);
			ctx.fillStyle = lineColor;
			ctx.font = `${lineSize}px sans-serif`;
			lines.forEach((line, i) => ctx.fillText(typeof line === 'function' ? line(modal) : t(line), cx, panel.y + lineStart + i * lineGap));
			if (drawExtra) drawExtra(panel, cx);
			drawButton(confirmBtn, [{ label: t('common.confirm') }]);
		},
	};
}

// 새 인트로 추가 시 이 dict에 항목 하나만 추가하면 됨.
export const INTRO_MODALS = {
	airIntro: makeIntro({
		key: AIR_INTRO_KEY, accent: AIR_COLOR,
		drawIcon: (cx, cy) => drawEnemySprite('air', cx, cy, 14),
		title: 'intro.air.title',
		lines: ['intro.air.line1', 'intro.air.line2', 'intro.air.line3'],
	}),

	buffIntro: makeIntro({
		key: BUFF_INTRO_KEY, accent: '#d4ac0d',
		drawIcon: drawBuffIcon,
		title: 'intro.buff.title',
		lines: ['intro.buff.line1', 'intro.buff.line2'],
		drawExtra: (p, cx) => {
			ctx.fillStyle = '#d4ac0d';
			ctx.font = 'bold 16px sans-serif';
			ctx.fillText('T0 +10%   T1 +10%   T2 +20%   T3 +30%', cx, p.y + 218);
		},
	}),

	bossIntro: makeIntro({
		key: BOSS_INTRO_KEY, accent: ACCENT_RED,
		drawIcon: drawBossIcon,
		title: 'intro.boss.title',
		lines: ['intro.boss.line1', 'intro.boss.line2'],
	}),

	shieldIntro: makeIntro({
		key: SHIELD_INTRO_KEY, accent: INFO_BLUE,
		drawIcon: (cx, cy) => drawEnemySprite('ground', cx, cy, 14, { shielded: true }),
		title: 'intro.shield.title',
		lines: ['intro.shield.line1', 'intro.shield.line2'],
	}),

	tier4Intro: makeIntro({
		key: TIER4_INTRO_KEY, accent: '#f5d76e', dimAlpha: 0.7,
		panel: { x: 20, y: 160, w: 320, h: 320 },
		confirmBtn: { x: 110, y: 432, w: 140, h: 40 },
		drawIcon: drawTier4Icon, iconY: 56,
		title: 'intro.tier4.title', titleColor: '#f5d76e', titleSize: 20, titleY: 100,
		lines: ['intro.tier4.line1', 'intro.tier4.line2'],
		lineSize: 13, lineStart: 128, lineGap: 20,
		drawExtra: (p, cx) => {
			ctx.fillStyle = '#f5d76e';
			ctx.font = 'bold 13px sans-serif';
			ctx.fillText(t('intro.tier4.step1'), cx, p.y + 180);
			ctx.fillText(t('intro.tier4.step2'), cx, p.y + 200);
			ctx.fillText(t('intro.tier4.step3'), cx, p.y + 220);
		},
	}),

	tier5Intro: makeIntro({
		key: TIER5_INTRO_KEY, accent: '#f5d76e', dimAlpha: 0.7,
		panel: { x: 20, y: 160, w: 320, h: 320 },
		confirmBtn: { x: 110, y: 432, w: 140, h: 40 },
		drawIcon: drawTier5Icon, iconY: 58,
		title: 'intro.tier5.title', titleColor: '#f5d76e', titleSize: 20, titleY: 104,
		lines: ['intro.tier5.line1', 'intro.tier5.line2'],
		lineSize: 13, lineStart: 132, lineGap: 20,
		drawExtra: (p, cx) => {
			ctx.fillStyle = '#f5d76e';
			ctx.font = 'bold 13px sans-serif';
			ctx.fillText(t('intro.tier5.step1'), cx, p.y + 184);
			ctx.fillText(t('intro.tier5.step2'), cx, p.y + 204);
			ctx.fillText(t('intro.tier5.step3'), cx, p.y + 224);
		},
	}),

	barrierIntro: makeIntro({
		key: BARRIER_INTRO_KEY, accent: '#aab7c4',
		drawIcon: (cx, cy) => drawEnemySprite('barrierSpawner', cx, cy, 14),
		title: 'intro.barrier.title',
		lines: ['intro.barrier.line1', 'intro.barrier.line2', 'intro.barrier.line3'],
	}),

	regenIntro: makeIntro({
		key: REGEN_INTRO_KEY, accent: '#2ecc71',
		drawIcon: (cx, cy) => drawEnemySprite('regen', cx, cy, 13),
		title: 'intro.regen.title',
		lines: ['intro.regen.line1', 'intro.regen.line2', 'intro.regen.line3'],
	}),

	queueIntro: makeIntro({
		key: QUEUE_INTRO_KEY, accent: GOLD,
		drawIcon: (cx, cy) => {
			ctx.save();
			ctx.translate(cx, cy);
			ctx.scale(2.4, 2.4); // 작은 버튼 아이콘을 모달용으로 확대
			drawHourglassIcon(0, 0, true); // 회전 — 기능(예약 진행)과 동일 연출
			ctx.restore();
		},
		title: 'intro.queue.title',
		lines: ['intro.queue.line1', 'intro.queue.line2', 'intro.queue.line3'],
	}),

	empIntro: makeIntro({
		key: EMP_INTRO_KEY, accent: '#2874a6',
		drawIcon: (cx, cy) => drawEnemySprite('emp', cx, cy, 14),
		title: 'intro.emp.title',
		lines: ['intro.emp.line1', 'intro.emp.line2', 'intro.emp.line3'],
	}),

	transportIntro: makeIntro({
		key: TRANSPORT_INTRO_KEY, accent: AIR_COLOR,
		drawIcon: (cx, cy) => drawEnemySprite('transport', cx, cy, 14),
		title: 'intro.transport.title',
		lines: ['intro.transport.line1', 'intro.transport.line2', 'intro.transport.line3'],
	}),

	parallelIntro: makeIntro({
		key: PARALLEL_INTRO_KEY, accent: INFO_BLUE, dimAlpha: 0.7,
		panel: { x: 20, y: 160, w: 320, h: 320 },
		confirmBtn: { x: 110, y: 432, w: 140, h: 40 },
		drawIcon: drawParallelIcon, iconY: 54,
		title: 'intro.parallel.title', titleSize: 20, titleY: 100,
		lines: ['intro.parallel.line1', 'intro.parallel.line2'],
		lineSize: 13, lineStart: 138, lineGap: 22,
		drawExtra: (p, cx) => {
			ctx.fillStyle = '#f39c12';
			ctx.font = 'bold 13px sans-serif';
			ctx.fillText(t('intro.parallel.warn1'), cx, p.y + 202);
			ctx.fillText(t('intro.parallel.warn2'), cx, p.y + 226);
		},
	}),

	// key 없음 — 맵이 새로 해금될 때마다 표시. checkMapUnlocks가 modal.mapId로 해금 맵을 전달.
	mapUnlock: makeIntro({
		accent: GOLD,
		drawIcon: drawMapUnlockIcon,
		title: 'intro.mapUnlock.title',
		lines: [
			modal => t('intro.mapUnlock.line2', { name: t(MAPS[modal?.mapId]?.name) }),
			'intro.mapUnlock.line3',
		],
	}),

	shortcutIntro: makeIntro({
		key: SHORTCUT_INTRO_KEY, accent: AIR_COLOR,
		drawIcon: drawShortcutIcon,
		title: 'intro.shortcut.title',
		lines: ['intro.shortcut.line1', 'intro.shortcut.line2'],
		lineSize: 12, lineStart: 150, lineGap: 26,
	}),

	underpassIntro: makeIntro({
		key: UNDERPASS_INTRO_KEY, accent: '#77828a',
		drawIcon: drawUnderpassIcon,
		title: 'intro.underpass.title',
		lines: ['intro.underpass.line1', 'intro.underpass.line2'],
		lineSize: 12, lineStart: 150, lineGap: 26,
	}),

	statsIntro: makeIntro({
		key: STATS_INTRO_KEY, accent: GOLD,
		drawIcon: drawStatsIntroIcon,
		title: 'intro.stats.title',
		lines: ['intro.stats.line1', 'intro.stats.line2', 'intro.stats.line3'],
		lineSize: 12, lineStart: 150, lineGap: 26,
	}),
};
