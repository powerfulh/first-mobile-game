import { ctx } from './core/canvas.js';
import { LOGICAL_W, LOGICAL_H, GOLD, INFO_BLUE, SLATE } from './core/config.js';
import { roundRect, drawButton, drawPanel } from './core/helpers.js';
import { drawEnemySprite } from './enemy.js';
import { settingsView, SLIDER_TRACK, CHECKBOX_X, CHECKBOX_H, CHECKBOX_BOX } from './settings-modal.js';
import { t } from './core/i18n.js';

// ============ 웨이브 적 출현 요약 ============
// HUD 웨이브 아래(우측 상단)에 작게 — 적 스프라이트 + 누적 개수.
// 아직 출현하지 않은 종류는 표시 안 함 (count>0 만, 순서: 일반·공중·재생·장벽).
const SPAWN_SUMMARY_ORDER = ['ground', 'air', 'regen', 'barrierSpawner'];

export function drawWaveSpawnSummary(counts = {}) {
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

// 좌하단 사각 컨트롤 버튼 배경 (일시정지·추가 웨이브 공용) — 둥근 사각 + 반투명 흰 테두리.
function drawHudButtonBg(rect) {
	ctx.fillStyle = 'rgba(26, 37, 53, 0.85)';
	roundRect(rect.x, rect.y, rect.w, rect.h, 8);
	ctx.fill();
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
	ctx.lineWidth = 1;
	ctx.stroke();
}

export function drawPauseButton(paused) {
	drawHudButtonBg(pauseButton);

	ctx.fillStyle = '#fff';
	if (paused) {
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
// 일시정지 버튼 바로 위.
export const nextWaveButton = { x: 8, y: 540, w: 44, h: 44 };

// enabled: 활성/흐림 여부, showBadge: ? 배지 표시 여부 — 둘 다 호출부(scenes)에서 계산해 전달.
export function drawNextWaveButton({ enabled, showBadge }) {
	// 호출 불가(보스·인터미션·최대 병렬 수)일 때 흐리게
	ctx.globalAlpha = enabled ? 1 : 0.35;
	drawHudButtonBg(nextWaveButton);

	// ⏩ 빨리감기 (260629 헬퍼 후보, 모양이 달라서 별개의 함수로 있을 필요가 있는지?)
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

	// 모서리에 ? 배지 (신규 기능 표시 — 비활성이어도 또렷하게)
	if (showBadge) {
		const bx = nextWaveButton.x + nextWaveButton.w - 3;
		const by = nextWaveButton.y + 3;
		ctx.fillStyle = GOLD;
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

// ============ Toast (그리기) — 상태 관리는 toast.js ============
export function drawToast(toast) {
	const alpha = Math.min(1, toast.life / 0.3);

	ctx.font = 'bold 14px sans-serif';
	ctx.textAlign = 'center';
	const textW = ctx.measureText(toast.text).width;
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
	ctx.fillText(toast.text, LOGICAL_W / 2, y + h / 2);
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

// ============ Settings modal (그리기) — 모델·레이아웃·입력은 settings-modal.js ============
export function drawSettingsModal(buttons) {
	const { panel: p, btns, guideY, titleY, sliderCy, checkboxY, sliders, checkboxes } = settingsView(buttons);

	ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
	ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

	drawPanel(p.x, p.y, p.w, p.h, { radius: 12, stroke: INFO_BLUE });

	ctx.textAlign = 'center';
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = '#fff';
	ctx.font = 'bold 22px sans-serif';
	ctx.fillText(t('설정'), LOGICAL_W / 2, titleY);

	drawVolumeSliders(sliders, sliderCy);
	drawSettingsCheckboxes(checkboxes, checkboxY);

	for (let i = 0; i < buttons.length; i++) drawButton(btns[i], t(buttons[i].label));

	ctx.fillStyle = '#9ab';
	ctx.font = '12px sans-serif';
	ctx.fillText(t('이전 버튼을 눌러 닫습니다'), LOGICAL_W / 2, guideY);
}

// 가로 1줄 레이아웃: 라벨(왼쪽) · 트랙 · % (오른쪽). value/label은 settingsView가 주입.
function drawVolumeSliders(sliders, sliderCy) {
	const tr = SLIDER_TRACK;
	sliders.forEach((sl, i) => {
		const v = sl.value;
		const cy = sliderCy[i];
		const knobX = tr.x + v * tr.w;

		// 라벨 (왼쪽)
		ctx.font = '12px sans-serif';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = '#cdd';
		ctx.fillText(t(sl.label), 44, cy);

		// 트랙 배경 + 채움
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.moveTo(tr.x, cy);
		ctx.lineTo(tr.x + tr.w, cy);
		ctx.stroke();
		ctx.strokeStyle = INFO_BLUE;
		ctx.beginPath();
		ctx.moveTo(tr.x, cy);
		ctx.lineTo(knobX, cy);
		ctx.stroke();

		// 노브
		ctx.fillStyle = '#fff';
		ctx.beginPath();
		ctx.arc(knobX, cy, tr.knobR, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = INFO_BLUE;
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

// 체크박스 (볼륨 슬라이더 아래). on/label은 settingsView가 주입.
function drawSettingsCheckboxes(checkboxes, checkboxY) {
	const box = CHECKBOX_BOX;
	checkboxes.forEach((c, i) => {
		const on = c.on;
		const rowY = checkboxY[i];
		const bx = CHECKBOX_X;
		const by = rowY + (CHECKBOX_H - box) / 2;
		ctx.fillStyle = on ? INFO_BLUE : SLATE;
		roundRect(bx, by, box, box, 4);
		ctx.fill();
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
		ctx.lineWidth = 1;
		ctx.stroke();
		if (on) {
			ctx.strokeStyle = '#fff';
			ctx.lineWidth = 2.5;
			ctx.lineJoin = 'round';
			ctx.beginPath();
			ctx.moveTo(bx + 4, by + box / 2);
			ctx.lineTo(bx + box * 0.42, by + box - 5);
			ctx.lineTo(bx + box - 3, by + 4);
			ctx.stroke();
		}
		ctx.fillStyle = '#fff';
		ctx.font = '14px sans-serif';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillText(t(c.label), bx + box + 10, rowY + CHECKBOX_H / 2);
	});
	ctx.textBaseline = 'alphabetic';
}
