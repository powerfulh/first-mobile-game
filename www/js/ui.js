import { ctx, hudOverlapLogical } from './core/canvas.js';
import { LOGICAL_W, LOGICAL_H, PATH_WIDTH, AIR_COLOR, GOLD, INFO_BLUE, SLATE } from './core/config.js';
import { roundRect, drawButton, drawPanel, shortcutCutSegments } from './core/helpers.js';
import { drawEnemySprite } from './ui/sprite.js';
import { settingsView, SLIDER_TRACK, CHECKBOX_X, CHECKBOX_H, CHECKBOX_BOX } from './settings-modal.js';
import { t } from './core/i18n.js';

// 맵 경로(적 이동 라인) + 공중 지름길 렌더. map을 인자로 받아 어떤 맵이든 그림.
export function drawPath(map, alpha = 1) {
	const path = map.path;
	ctx.globalAlpha = alpha;
	ctx.strokeStyle = '#8a7a5a';
	ctx.lineWidth = PATH_WIDTH;
	ctx.lineJoin = 'round';
	ctx.beginPath();
	ctx.moveTo(path[0].x, path[0].y);
	for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
	ctx.stroke();

	// 공중 지름길 — 정규 경로와 구분되게 공중색 점선. 구간은 path의 shortcut 마커에서 파생.
	for (const cut of shortcutCutSegments(map)) {
		ctx.strokeStyle = AIR_COLOR;
		ctx.lineWidth = PATH_WIDTH * 0.55;
		ctx.setLineDash([6, 5]);
		ctx.beginPath();
		ctx.moveTo(cut.a.x, cut.a.y);
		ctx.lineTo(cut.b.x, cut.b.y);
		ctx.stroke();
		ctx.setLineDash([]);
		// 양 끝 접합부를 점선 위상과 무관하게 동일하게 — 정규 경로와 맞닿는 지점에 둥근 조인트
		ctx.fillStyle = AIR_COLOR;
		for (const pt of [cut.a, cut.b]) {
			ctx.beginPath();
			ctx.arc(pt.x, pt.y, PATH_WIDTH * 0.55 / 2, 0, Math.PI * 2);
			ctx.fill();
		}
	}
	ctx.globalAlpha = 1;
}

// ============ 웨이브 적 출현 요약 ============
// HUD 웨이브 아래(우측 상단)에 작게 — 적 스프라이트 + 누적 개수.
// 아직 출현하지 않은 종류는 표시 안 함 — counts에 쌓인 키 그대로 사용 (순서 = 그 웨이브 첫 출현 순).
// 종 목록을 따로 두지 않아 새 종 추가 시 동기화 필요 없음.
export function drawWaveSpawnSummary(counts = {}) {
	const entries = Object.keys(counts).filter(t => counts[t] > 0);
	if (entries.length === 0) return;

	const iconBox = 16; // 스프라이트가 차지할 가로 폭
	const iconR = 7;
	const gap = 3;      // 스프라이트 ↔ 숫자 간격
	const sep = '  |  ';
	const cy = Math.max(8, hudOverlapLogical) + iconR; // HUD 겹침 바로 아래, 상단 여백 하한 8

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

// enabled: 활성/흐림 여부, showBadge: ? 배지 표시 여부, triple: 삼각형 3개 표시(병렬 2개 이상 진행 중)
// — 모두 호출부(scenes)에서 계산해 전달.
export function drawNextWaveButton({ enabled, showBadge, triple }) {
	// 호출 불가(보스·인터미션·최대 병렬 수)일 때 흐리게
	ctx.globalAlpha = enabled ? 1 : 0.35;
	drawHudButtonBg(nextWaveButton);

	// ⏩ 빨리감기 (260629 헬퍼 후보, 모양이 달라서 별개의 함수로 있을 필요가 있는지?)
	// 삼각형 2개(기본) / 3개(triple) — 버튼 중앙 기준 대칭 배치.
	ctx.fillStyle = '#fff';
	const x = nextWaveButton.x, y = nextWaveButton.y;
	const n = triple ? 3 : 2;
	const tw = triple ? 8 : 11; // 삼각형 폭
	const step = triple ? 9 : 12; // 삼각형 간 시작점 간격
	const startX = x + (triple ? 9 : 10);
	for (let i = 0; i < n; i++) {
		const tx = startX + i * step;
		ctx.beginPath();
		ctx.moveTo(tx, y + 13);
		ctx.lineTo(tx, y + 31);
		ctx.lineTo(tx + tw, y + 22);
		ctx.closePath();
		ctx.fill();
	}
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

// 적 HP바 — 본체 위 별도 패스로 그림(호출부가 대상 판별). 보빙 미반영: 항상 e.y 기준.
export function drawEnemyHpBar(e) {
	const barW = 20;
	const barH = 3;
	const ratio = e.hp / e.hpMax;
	const top = e.y - e.radius - 8;
	ctx.fillStyle = '#000';
	ctx.fillRect(e.x - barW / 2, top, barW, barH);
	ctx.fillStyle = e.shielded ? INFO_BLUE : '#2ecc71';
	ctx.fillRect(e.x - barW / 2, top, barW * ratio, barH);
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
	ctx.fillText(t('hud.paused'), LOGICAL_W / 2, 76);
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
	ctx.fillText(t('settings.title'), LOGICAL_W / 2, titleY);

	drawVolumeSliders(sliders, sliderCy);
	drawSettingsCheckboxes(checkboxes, checkboxY);

	for (let i = 0; i < buttons.length; i++) drawButton(btns[i], [{ label: t(buttons[i].label) }]);

	ctx.fillStyle = '#9ab';
	ctx.font = '12px sans-serif';
	ctx.fillText(t('settings.closeGuide'), LOGICAL_W / 2, guideY);
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
