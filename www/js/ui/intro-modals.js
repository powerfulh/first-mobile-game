// 인트로 모달 — 신규 요소(공중/보스/방어막/병렬 등) 최초 등장 시 안내 모달.
// 아이콘만 개별 함수, 나머지(backdrop·제목·본문·버튼)는 makeIntro가 공통 처리.
// 새 인트로 추가: 아이콘(필요 시) + INTRO_MODALS 항목 + config 키.
import { ctx } from '../core/canvas.js';
import {
	LOGICAL_W, LOGICAL_H, AIR_COLOR, ACCENT_RED, GOLD, INFO_BLUE,
	AIR_INTRO_KEY, BUFF_INTRO_KEY, BOSS_INTRO_KEY, SHIELD_INTRO_KEY,
	TIER4_INTRO_KEY, REGEN_INTRO_KEY, BARRIER_INTRO_KEY, PARALLEL_INTRO_KEY,
	MAP_UNLOCK_INTRO_KEY, SHORTCUT_INTRO_KEY,
} from '../core/config.js';
import { roundRect, drawButton, drawPanel } from '../core/helpers.js';
import { drawEnemySprite } from './sprite.js';
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
	ctx.fillStyle = '#2d4a2b';
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

// 데이터 → { key, panel, confirmBtn, draw }. 특수 본문은 drawExtra(panel, cx)로.
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
		draw() {
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
			lines.forEach((line, i) => ctx.fillText(t(line), cx, panel.y + lineStart + i * lineGap));
			if (drawExtra) drawExtra(panel, cx);
			drawButton(confirmBtn, t('common.confirm'));
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

	mapUnlock: makeIntro({
		key: MAP_UNLOCK_INTRO_KEY, accent: GOLD,
		drawIcon: drawMapUnlockIcon,
		title: 'intro.mapUnlock.title',
		lines: ['intro.mapUnlock.line1', 'intro.mapUnlock.line2', 'intro.mapUnlock.line3'],
	}),

	shortcutIntro: makeIntro({
		key: SHORTCUT_INTRO_KEY, accent: AIR_COLOR,
		drawIcon: drawShortcutIcon,
		title: 'intro.shortcut.title',
		lines: ['intro.shortcut.line1', 'intro.shortcut.line2'],
		lineSize: 12, lineStart: 150, lineGap: 26,
	}),
};
