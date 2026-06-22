import { ctx, hpEl, goldEl, waveEl } from './canvas.js';
import {
	LOGICAL_W, LOGICAL_H,
	AIR_INTRO_KEY, BUFF_INTRO_KEY, BOSS_INTRO_KEY, SHIELD_INTRO_KEY,
	TIER4_INTRO_KEY, REGEN_INTRO_KEY, BARRIER_INTRO_KEY, PARALLEL_INTRO_KEY,
} from './config.js';
import {
	game, getOneTouchPlace, setOneTouchPlace,
	getIntermissionEnabled, setIntermissionEnabled, hasSeenIntro,
} from './state.js';
import { roundRect, drawButton, drawPanel, hitButton } from './helpers.js';
import { getBgmVolume, setBgmVolume } from './audio.js';
import { getSfxVolume, setSfxVolume } from './sfx.js';
import { drawEnemySprite } from './enemy.js';
import { canCallExtraWave } from './wave.js';
import { t } from './i18n.js';

// ============ HUD ============
export function updateHUD() {
	hpEl.textContent = `HP: ${game.hp}`;
	goldEl.textContent = `Gold: ${game.gold}${game.bossActive ? ' 🔒' : ''}`;
	// 활성 웨이브 범위로 표기 — 먼저 끝난 웨이브는 제거되므로 범위가 좁아짐.
	// {낮은 활성}~{높은 활성}, 하나면 단일 번호. 활성 없음(배치 전환/인터미션)이면 game.wave.
	const waves = game.waves || [];
	if (waves.length === 0) {
		waveEl.textContent = `Wave: ${game.wave}`;
	} else {
		let lo = waves[0].wave, hi = waves[0].wave;
		for (const s of waves) { if (s.wave < lo) lo = s.wave; if (s.wave > hi) hi = s.wave; }
		waveEl.textContent = lo === hi ? `Wave: ${lo}` : `Wave: ${lo}~${hi}`;
	}
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

// ============ Next-wave button ============
// 현재 웨이브 종료를 기다리지 않고 즉시 다음 웨이브를 호출. 일시정지 버튼 바로 위.
export const nextWaveButton = { x: 8, y: 540, w: 44, h: 44 };

export function drawNextWaveButton() {
	// 호출 불가(보스·인터미션·최대 병렬 수)일 때 흐리게
	ctx.globalAlpha = canCallExtraWave() ? 1 : 0.35;
	ctx.fillStyle = 'rgba(26, 37, 53, 0.85)';
	roundRect(nextWaveButton.x, nextWaveButton.y, nextWaveButton.w, nextWaveButton.h, 8);
	ctx.fill();
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
	ctx.lineWidth = 1;
	ctx.stroke();

	// ⏩ 빨리감기 — 다음 웨이브 병렬 호출
	ctx.fillStyle = '#fff';
	const x = nextWaveButton.x, y = nextWaveButton.y;
	ctx.beginPath();
	ctx.moveTo(x + 10, y + 13);
	ctx.lineTo(x + 10, y + 31);
	ctx.lineTo(x + 21, y + 22);
	ctx.closePath();
	ctx.fill();
	ctx.beginPath();
	ctx.moveTo(x + 22, y + 13);
	ctx.lineTo(x + 22, y + 31);
	ctx.lineTo(x + 33, y + 22);
	ctx.closePath();
	ctx.fill();
	ctx.globalAlpha = 1;

	// 아직 안내 모달을 안 본 경우 모서리에 ? 배지 (신규 기능 표시 — 비활성이어도 또렷하게)
	if (!hasSeenIntro(PARALLEL_INTRO_KEY)) {
		const bx = nextWaveButton.x + nextWaveButton.w - 3;
		const by = nextWaveButton.y + 3;
		ctx.fillStyle = '#f1c40f';
		ctx.beginPath();
		ctx.arc(bx, by, 8, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = '#1a2535';
		ctx.font = 'bold 12px sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('?', bx, by + 1);
		ctx.textBaseline = 'alphabetic';
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
	ctx.fillText(t('⏸  일시정지'), LOGICAL_W / 2, 76);
	ctx.textBaseline = 'alphabetic';
}

// ============ Settings modal (통합) ============
// 게임 중 백 버튼 / 타이틀 설정 버튼 모두 동일 모달 사용.
// 호출자가 buttons 배열을 넘김 — 각 { label, action }. 버튼 위치/패널 높이는
// settingsLayout이 버튼 개수에 맞춰 계산 (씬의 hit-test도 동일 함수 사용).
// 하단 가이드 문구는 모달 소스에 고정.
const SETTINGS_PANEL = { x: 30, w: 300 };
const SETTINGS_BTN = { x: 80, w: 200, h: 50, gap: 12 };
// panel.y(상단) 기준 내부 세로 오프셋 — 콘텐츠를 모두 패널 상대 배치해 세로 중앙 정렬 가능.
const SETTINGS_DY = {
	title: 48,
	sliderTop: 90, sliderGap: 30,
	checkboxTop: 140, checkboxGap: 30,
	btnTop: 210, bottomPad: 40,
};

// 마지막으로 그린 레이아웃 — 씬에서 위임하는 hit-test(슬라이더/체크박스)가 공유.
let settingsHitLayout = null;

// 버튼 개수로 패널 높이를 정하고 화면 세로 중앙에 배치. 콘텐츠 좌표는 panel.y 기준 상대.
export function settingsLayout(count) {
	const D = SETTINGS_DY;
	const lastBtnBottomDY = count
		? D.btnTop + (count - 1) * (SETTINGS_BTN.h + SETTINGS_BTN.gap) + SETTINGS_BTN.h
		: D.btnTop;
	const h = lastBtnBottomDY + D.bottomPad;
	const y = Math.round((LOGICAL_H - h) / 2);
	const panel = { x: SETTINGS_PANEL.x, y, w: SETTINGS_PANEL.w, h };
	const btns = [];
	for (let i = 0; i < count; i++) {
		btns.push({
			x: SETTINGS_BTN.x,
			y: y + D.btnTop + i * (SETTINGS_BTN.h + SETTINGS_BTN.gap),
			w: SETTINGS_BTN.w,
			h: SETTINGS_BTN.h,
		});
	}
	return {
		panel, btns,
		titleY: y + D.title,
		sliderCy: SLIDERS.map((_, i) => y + D.sliderTop + i * D.sliderGap),
		checkboxY: SETTINGS_CHECKBOXES.map((_, i) => y + D.checkboxTop + i * D.checkboxGap),
		guideY: y + h - 16,
	};
}

// ---- 볼륨 슬라이더 (배경음 / 효과음 마스터 분리) ----
// 가로 1줄 레이아웃: 라벨(왼쪽) · 트랙 · % (오른쪽). 각 슬라이더는 get/set로 연결.
const SLIDER_TRACK = { x: 108, w: 150, knobR: 9 };
const SLIDERS = [
	{ label: '배경음', get: getBgmVolume, set: setBgmVolume },
	{ label: '효과음', get: getSfxVolume, set: setSfxVolume },
];
let activeSlider = -1; // 드래그 중인 슬라이더 인덱스 (-1 = 없음)

function sliderValueFromX(px) {
	const s = SLIDER_TRACK;
	return Math.min(1, Math.max(0, (px - s.x) / s.w));
}

// 포인터가 어느 슬라이더 트랙 위인지 반환 (없으면 -1)
function hitSlider(p) {
	if (!settingsHitLayout) return -1;
	const s = SLIDER_TRACK;
	if (p.x < s.x - 22 || p.x > s.x + s.w + 22) return -1;
	const ys = settingsHitLayout.sliderCy;
	for (let i = 0; i < SLIDERS.length; i++) {
		if (Math.abs(p.y - ys[i]) <= 14) return i;
	}
	return -1;
}

// 슬라이더 드래그 — 설정 모달이 열린 씬에서 pointer 콜백이 위임.
// 이벤트를 소비하면 true 반환 (씬은 그 경우 다른 처리 스킵).
export function volumePointerDown(p) {
	const i = hitSlider(p);
	if (i < 0) return false;
	activeSlider = i;
	SLIDERS[i].set(sliderValueFromX(p.x));
	return true;
}
export function volumePointerMove(p) {
	if (activeSlider < 0) return false;
	SLIDERS[activeSlider].set(sliderValueFromX(p.x));
	return true;
}
export function volumePointerUp() {
	const was = activeSlider >= 0;
	activeSlider = -1;
	return was;
}

function drawVolumeSliders(sliderCy) {
	const tr = SLIDER_TRACK;
	SLIDERS.forEach((sl, i) => {
		const v = sl.get();
		const cy = sliderCy[i];
		const knobX = tr.x + v * tr.w;

		// 라벨 (왼쪽)
		ctx.font = '12px sans-serif';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = '#cdd';
		ctx.fillText(t(sl.label), 44, cy);

		// 트랙 배경 + 채움
		ctx.lineCap = 'round';
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.moveTo(tr.x, cy);
		ctx.lineTo(tr.x + tr.w, cy);
		ctx.stroke();
		ctx.strokeStyle = '#5dade2';
		ctx.beginPath();
		ctx.moveTo(tr.x, cy);
		ctx.lineTo(knobX, cy);
		ctx.stroke();
		ctx.lineCap = 'butt';

		// 노브
		ctx.fillStyle = '#fff';
		ctx.beginPath();
		ctx.arc(knobX, cy, tr.knobR, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = '#5dade2';
		ctx.lineWidth = 2;
		ctx.stroke();

		// % (오른쪽)
		ctx.fillStyle = '#9ab';
		ctx.font = '11px sans-serif';
		ctx.textAlign = 'right';
		ctx.fillText(`${Math.round(v * 100)}%`, tr.x + tr.w + 40, cy);
	});
	ctx.textBaseline = 'alphabetic';
}

// ---- 설정 체크박스 (볼륨 슬라이더 아래) ----
// 공통 x/폭/높이 + 줄마다 y. get/set로 각 선호값 연결 (체크=on).
const CHECKBOX_X = 80, CHECKBOX_W = 200, CHECKBOX_H = 26, CHECKBOX_BOX = 20;
const SETTINGS_CHECKBOXES = [
	{ label: '원터치 배치', get: getOneTouchPlace, set: setOneTouchPlace },
	{ label: '웨이브 간 인터미션', get: getIntermissionEnabled, set: setIntermissionEnabled },
];

function drawSettingsCheckboxes(checkboxY) {
	const box = CHECKBOX_BOX;
	SETTINGS_CHECKBOXES.forEach((c, i) => {
		const on = c.get();
		const rowY = checkboxY[i];
		const bx = CHECKBOX_X;
		const by = rowY + (CHECKBOX_H - box) / 2;
		ctx.fillStyle = on ? '#5dade2' : '#2c3e50';
		roundRect(bx, by, box, box, 4);
		ctx.fill();
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
		ctx.lineWidth = 1;
		ctx.stroke();
		if (on) {
			ctx.strokeStyle = '#fff';
			ctx.lineWidth = 2.5;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';
			ctx.beginPath();
			ctx.moveTo(bx + 4, by + box / 2);
			ctx.lineTo(bx + box * 0.42, by + box - 5);
			ctx.lineTo(bx + box - 3, by + 4);
			ctx.stroke();
			ctx.lineCap = 'butt';
		}
		ctx.fillStyle = '#fff';
		ctx.font = '14px sans-serif';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillText(t(c.label), bx + box + 10, rowY + CHECKBOX_H / 2);
	});
	ctx.textBaseline = 'alphabetic';
}

// 체크박스 탭 처리 — 소비 시 true (설정 모달 열린 씬이 위임). y는 마지막 그린 레이아웃 기준.
export function settingsCheckboxTap(p) {
	if (!settingsHitLayout) return false;
	const ys = settingsHitLayout.checkboxY;
	for (let i = 0; i < SETTINGS_CHECKBOXES.length; i++) {
		const rect = { x: CHECKBOX_X, y: ys[i], w: CHECKBOX_W, h: CHECKBOX_H };
		if (hitButton(rect, p)) {
			SETTINGS_CHECKBOXES[i].set(!SETTINGS_CHECKBOXES[i].get());
			return true;
		}
	}
	return false;
}

export function drawSettingsModal(buttons) {
	const layout = settingsLayout(buttons.length);
	settingsHitLayout = layout; // 씬 hit-test(슬라이더/체크박스) 공유용
	const { panel: p, btns, guideY, titleY, sliderCy, checkboxY } = layout;

	ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
	ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

	drawPanel(p.x, p.y, p.w, p.h, { radius: 12, stroke: '#5dade2' });

	ctx.textAlign = 'center';
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = '#fff';
	ctx.font = 'bold 22px sans-serif';
	ctx.fillText(t('설정'), LOGICAL_W / 2, titleY);

	drawVolumeSliders(sliderCy);
	drawSettingsCheckboxes(checkboxY);

	for (let i = 0; i < buttons.length; i++) drawButton(btns[i], t(buttons[i].label));

	ctx.fillStyle = '#9ab';
	ctx.font = '12px sans-serif';
	ctx.fillText(t('이전 버튼을 눌러 닫습니다'), LOGICAL_W / 2, guideY);
}

// ============ Intro modals ============
// 표준 모달 레이아웃 (대부분 공유, tier4만 별도)
const STD_PANEL = { x: 20, y: 180, w: 320, h: 280 };
const STD_BTN = { x: 110, y: 406, w: 140, h: 40 };

function drawIntroBackdrop(panel, accent, dimAlpha = 0.65) {
	ctx.fillStyle = `rgba(0, 0, 0, ${dimAlpha})`;
	ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
	drawPanel(panel.x, panel.y, panel.w, panel.h, { radius: 12, stroke: accent });
}

// ---- 인트로 모달: 데이터 + 공용 makeIntro ----
// 아이콘만 개별 함수, 나머지(backdrop·제목·본문·버튼)는 makeIntro가 공통 처리.
// 새 인트로 추가: 아이콘(필요 시) + INTRO_MODALS 항목 + config 키.

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
	ctx.fillStyle = '#f1c40f';
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
	ctx.fillStyle = '#5dade2';
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
		key: AIR_INTRO_KEY, accent: '#a569bd',
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
		key: BOSS_INTRO_KEY, accent: '#c0392b',
		drawIcon: drawBossIcon,
		title: '보스 등장!',
		lines: ['20 웨이브마다 보스가 등장합니다.', '일반 적보다 훨씬 단단하지만 느리게 이동합니다.'],
	}),

	shieldIntro: makeIntro({
		key: SHIELD_INTRO_KEY, accent: '#5dade2',
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
		drawIcon: (cx, cy) => drawEnemySprite('barrier', cx, cy, 14),
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
		key: PARALLEL_INTRO_KEY, accent: '#5dade2', dimAlpha: 0.7,
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
};
