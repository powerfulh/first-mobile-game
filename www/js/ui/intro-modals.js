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
import { drawEnemySprite } from '../enemy.js';
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
			drawButton(confirmBtn, t('확인'));
		},
	};
}

// 새 인트로 추가 시 이 dict에 항목 하나만 추가하면 됨.
export const INTRO_MODALS = {
	airIntro: makeIntro({
		key: AIR_INTRO_KEY, accent: AIR_COLOR,
		drawIcon: (cx, cy) => drawEnemySprite('air', cx, cy, 14),
		title: '공중 적 등장!',
		lines: ['보라색 삼각형은 공중 적입니다.', '지상 전담 타워는 공격할 수 없으니', '스카웃을 활용해 대비하세요.'],
	}),

	buffIntro: makeIntro({
		key: BUFF_INTRO_KEY, accent: '#d4ac0d',
		drawIcon: drawBuffIcon,
		title: '티어별 버프율',
		lines: ['버프를 받는 타워의 티어에 따라', '효과가 달라집니다.'],
		drawExtra: (p, cx) => {
			ctx.fillStyle = '#d4ac0d';
			ctx.font = 'bold 16px sans-serif';
			ctx.fillText('T0 +10%   T1 +10%   T2 +20%   T3 +30%', cx, p.y + 218);
		},
	}),

	bossIntro: makeIntro({
		key: BOSS_INTRO_KEY, accent: ACCENT_RED,
		drawIcon: drawBossIcon,
		title: '보스 등장!',
		lines: ['20 웨이브마다 보스가 등장합니다.', '일반 적보다 훨씬 단단하지만 느리게 이동합니다.'],
	}),

	shieldIntro: makeIntro({
		key: SHIELD_INTRO_KEY, accent: INFO_BLUE,
		drawIcon: (cx, cy) => drawEnemySprite('ground', cx, cy, 14, { shielded: true }),
		title: '방어막 적 등장!',
		lines: ['일부 적이 방어막을 두르고 등장합니다.', '받는 데미지가 감소합니다.'],
	}),

	tier4Intro: makeIntro({
		key: TIER4_INTRO_KEY, accent: '#f5d76e', dimAlpha: 0.7,
		panel: { x: 20, y: 160, w: 320, h: 320 },
		confirmBtn: { x: 110, y: 432, w: 140, h: 40 },
		drawIcon: drawTier4Icon, iconY: 56,
		title: '합체 전직 가능!', titleColor: '#f5d76e', titleSize: 20, titleY: 100,
		lines: ['XP를 모두 채운 3티어 타워 두 개로', '레시피 조합 4티어 전직이 가능합니다.'],
		lineSize: 13, lineStart: 128, lineGap: 20,
		drawExtra: (p, cx) => {
			ctx.fillStyle = '#f5d76e';
			ctx.font = 'bold 13px sans-serif';
			ctx.fillText(t('① 한 타워의 "4티어 대상 지정"'), cx, p.y + 180);
			ctx.fillText(t('② 레시피 짝 타워에서 "전직"'), cx, p.y + 200);
			ctx.fillText(t('③ 대상 타워는 소모, 짝 타워가 4티어로 전직'), cx, p.y + 220);
		},
	}),

	barrierIntro: makeIntro({
		key: BARRIER_INTRO_KEY, accent: '#aab7c4',
		drawIcon: (cx, cy) => drawEnemySprite('barrierSpawner', cx, cy, 14),
		title: '장벽 적 등장!',
		lines: ['장벽 적이 등장합니다.', '처치한 자리에 장벽이 생성되어', '공중 공격을 차단합니다.'],
	}),

	regenIntro: makeIntro({
		key: REGEN_INTRO_KEY, accent: '#2ecc71',
		drawIcon: (cx, cy) => drawEnemySprite('regen', cx, cy, 13),
		title: '재생 적 등장!',
		lines: ['초록색 사각형은 재생 적입니다.', '이동 속도가 절반이지만', '피해를 입어도 매초 체력을 회복합니다.'],
	}),

	parallelIntro: makeIntro({
		key: PARALLEL_INTRO_KEY, accent: INFO_BLUE, dimAlpha: 0.7,
		panel: { x: 20, y: 160, w: 320, h: 320 },
		confirmBtn: { x: 110, y: 432, w: 140, h: 40 },
		drawIcon: drawParallelIcon, iconY: 54,
		title: '추가 웨이브 (병렬 호출)', titleSize: 20, titleY: 100,
		lines: ['현재 웨이브가 끝나기 전에', '다음 웨이브를 즉시 병렬로 진행합니다.'],
		lineSize: 13, lineStart: 138, lineGap: 22,
		drawExtra: (p, cx) => {
			ctx.fillStyle = '#f39c12';
			ctx.font = 'bold 13px sans-serif';
			ctx.fillText(t('• 병렬로 부른 웨이브는 저장되지 않습니다.'), cx, p.y + 202);
			ctx.fillText(t('• 적이 겹쳐 방어 부담이 큽니다. 신중히!'), cx, p.y + 226);
		},
	}),

	mapUnlock: makeIntro({
		key: MAP_UNLOCK_INTRO_KEY, accent: GOLD,
		drawIcon: drawMapUnlockIcon,
		title: '새로운 맵 해금!',
		lines: ['1번 맵을 깊이 진행했습니다!', '새로운 맵이 해금되었습니다.', '게임 시작에서 선택하세요.'],
	}),

	shortcutIntro: makeIntro({
		key: SHORTCUT_INTRO_KEY, accent: AIR_COLOR,
		drawIcon: drawShortcutIcon,
		title: '공중 지름길',
		lines: ['이 맵에는 공중 타입이 이용할 수 있는 지름길이 있습니다', '정규 경로와 번갈아 이용합니다'],
		lineSize: 12, lineStart: 150, lineGap: 26,
	}),
};
