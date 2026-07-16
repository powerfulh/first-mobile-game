import { ctx, hudOverlapLogical } from './core/canvas.js';
import { LOGICAL_W, LOGICAL_H, PATH_WIDTH, AIR_COLOR, INFO_BLUE, SLATE, MAP_BG_COLOR } from './core/config.js';
import { roundRect, drawButton, drawPanel, shortcutCutSegments } from './core/helpers.js';
import { drawEnemySprite, drawNewBadge } from './ui/sprite.js';
import { settingsView, SLIDER_TRACK, CHECKBOX_X, CHECKBOX_H, CHECKBOX_BOX } from './settings-modal.js';
import { t } from './core/i18n.js';

// 맵 경로(적 이동 라인) + 공중 지름길 렌더. map을 인자로 받아 어떤 맵이든 그림.
export function drawPath(map, alpha = 1) {
	const path = map.path;
	ctx.globalAlpha = alpha;
	ctx.strokeStyle = '#8a7a5a';
	ctx.lineWidth = PATH_WIDTH;
	ctx.lineJoin = 'round';
	// 지하도(underpass) 구간은 노면이 없음 — 그 구간만 펜을 떼고 이어 그림 (표현은 drawUnderpass)
	ctx.beginPath();
	let penDown = false;
	for (let i = 0; i < path.length - 1; i++) {
		if (path[i].underpass && path[i + 1].underpass) {
			penDown = false;
			continue;
		}
		if (!penDown) {
			ctx.moveTo(path[i].x, path[i].y);
			penDown = true;
		}
		ctx.lineTo(path[i + 1].x, path[i + 1].y);
	}
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

// 지하도 — 그 구간의 노면은 없고(drawPath가 제외) 길이 지하로 내려감.
// 지상을 덮지 않으므로 교차하는 다른 길을 가리지 않음 (고가처럼 보이는 문제 방지).
// 표현 = 지하 경로 힌트 점선 + 양끝 입구. 지하도 안의 적은 렌더 스킵(scenes)으로 숨김.
// 지상 적 본체 다음에 호출 — 입구에 반쯤 걸친 적을 어두운 굴이 가려 출입 연출이 자연스럽다.
export function drawUnderpass(map) {
	const path = map.path;
	for (let i = 0; i < path.length - 1; i++) {
		if (!(path[i].underpass && path[i + 1].underpass)) continue;
		const a = path[i];
		const b = path[i + 1];
		// 지하 경로 힌트 — 지형·교차로 위로 은은한 점선 (연결 안내 + 배치 완화 구간 표시)
		ctx.globalAlpha = 0.28;
		ctx.strokeStyle = '#17120d';
		ctx.lineWidth = 4;
		ctx.setLineDash([5, 9]);
		ctx.beginPath();
		ctx.moveTo(a.x, a.y);
		ctx.lineTo(b.x, b.y);
		ctx.stroke();
		ctx.setLineDash([]);
		ctx.globalAlpha = 1;
		// 입구 그림자 방향 = 인접 접근로 세그먼트 방향 — 사선 접근로에서도 노면과 정렬.
		// 경로 끝이라 인접 세그먼트가 없으면 지하도 축으로 폴백.
		const prev = path[i - 1];
		const next = path[i + 2];
		const outA = prev ? Math.atan2(prev.y - a.y, prev.x - a.x) : Math.atan2(a.y - b.y, a.x - b.x);
		const outB = next ? Math.atan2(next.y - b.y, next.x - b.x) : Math.atan2(b.y - a.y, b.x - a.x);
		drawUnderpassPortal(a, outA);
		drawUnderpassPortal(b, outB);
	}
}

// 지하도 입구 1개 — out = 바깥 접근로 방향.
// 진입부터 문틀까지의 접근로 노면 위에 어둠을 단계적으로 진하게 겹쳐 '점점 지하로 내려감'을 표현하고,
// 문틀(콘크리트 마감 바)에서 끝. 문틀 너머(지하 구간)는 노면 없음 — 경로 점선 힌트만.
// 지상 적 다음에 그려지므로 문틀 직전의 깊은 어둠·문틀이 드나드는 적의 경계를 가려줌.
function drawUnderpassPortal(p, out) {
	const ux = Math.cos(out);
	const uy = Math.sin(out);
	const nx = -uy;
	const ny = ux;
	const halfW = PATH_WIDTH / 2;
	// (from~to)×(±half) 사각형 — from/to 는 입구점 기준 바깥(+)/지하(-) 방향 거리
	const quad = (from, to, half) => {
		ctx.beginPath();
		ctx.moveTo(p.x + ux * from + nx * half, p.y + uy * from + ny * half);
		ctx.lineTo(p.x + ux * from - nx * half, p.y + uy * from - ny * half);
		ctx.lineTo(p.x + ux * to - nx * half, p.y + uy * to - ny * half);
		ctx.lineTo(p.x + ux * to + nx * half, p.y + uy * to + ny * half);
		ctx.closePath();
		ctx.fill();
	};
	// 진입 → 문틀: 내리막 어둠 — 문틀에 가까울수록 진해지는 밴드 (노면이 깊어짐)
	const STEP = 6;
	const BANDS = 5;
	ctx.fillStyle = '#17120d';
	for (let i = 0; i < BANDS; i++) {
		ctx.globalAlpha = 0.75 * (i + 1) / BANDS;
		quad((BANDS - i) * STEP, (BANDS - i - 1) * STEP, halfW);
	}
	ctx.globalAlpha = 1;
	// 문틀 — 입구를 마감하는 콘크리트 바. 길보다 살짝 넓어 구조물 느낌.
	ctx.fillStyle = '#77828a';
	quad(0, -7, halfW + 5);
}

// 맵 선택 썸네일 카드 — 맵 경로를 축소 렌더 + 하단 맵 이름. b = { x, y, w, h }.
export function drawMapThumb(map, b) {
	ctx.fillStyle = MAP_BG_COLOR; // 플레이 배경과 같은 느낌
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

// ============ HUD 좌하단 접이식 컨트롤 ============
// 기본은 토글(🔼)만 노출 — 누르면 위로 일시정지·추가 웨이브 버튼이 펼쳐짐 (상태는 scenes.playing 보유).
export const hudToggleButton = { x: 8, y: 592, w: 44, h: 44 };
export const pauseButton = { x: 8, y: 540, w: 44, h: 44 };
export const nextWaveButton = { x: 8, y: 488, w: 44, h: 44 };
export const statsButton = { x: 8, y: 436, w: 44, h: 44 };

// 좌하단 사각 컨트롤 버튼 배경 (토글·일시정지·추가 웨이브 공용) — 둥근 사각 + 반투명 흰 테두리.
function drawHudButtonBg(rect) {
	ctx.fillStyle = 'rgba(26, 37, 53, 0.85)';
	roundRect(rect.x, rect.y, rect.w, rect.h, 8);
	ctx.fill();
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
	ctx.lineWidth = 1;
	ctx.stroke();
}

// 접이식 토글 버튼 — 접힘: 위로 펼치기(▲), 펼침: 아래로 접기(▼).
// showBadge: 접힌 상태에서 안쪽 버튼(추가 웨이브)의 미열람 배지를 대신 노출.
export function drawHudToggleButton(open, showBadge) {
	drawHudButtonBg(hudToggleButton);
	const cx = hudToggleButton.x + hudToggleButton.w / 2;
	const cy = hudToggleButton.y + hudToggleButton.h / 2;
	ctx.fillStyle = '#fff';
	ctx.beginPath();
	if (open) {
		ctx.moveTo(cx - 9, cy - 5);
		ctx.lineTo(cx + 9, cy - 5);
		ctx.lineTo(cx, cy + 7);
	} else {
		ctx.moveTo(cx - 9, cy + 5);
		ctx.lineTo(cx + 9, cy + 5);
		ctx.lineTo(cx, cy - 7);
	}
	ctx.closePath();
	ctx.fill();
	if (showBadge) drawNewBadge(hudToggleButton);
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

// ============ Stats button ============
// 통계 버튼 — 막대그래프 아이콘. 기능은 추후 연결 (현재 탭은 소비만).
export function drawStatsButton() {
	drawHudButtonBg(statsButton);
	ctx.fillStyle = '#fff';
	const { x, y } = statsButton;
	ctx.fillRect(x + 11, y + 22, 6, 11);
	ctx.fillRect(x + 19, y + 15, 6, 18);
	ctx.fillRect(x + 27, y + 26, 6, 7);
	// 바닥선
	ctx.fillRect(x + 9, y + 34, 26, 2);
}

// ============ 통계 레이어 (PIP) ============
// 게임을 멈추지 않는 소형 오버레이 — 통계와 현재 맵을 같이 보는 컨셉.
// 드래그로 화면 내 자유 이동 (위치·열림 상태는 scenes.playing 보유), 바깥 탭·이전 버튼으로 닫음.
// 내용은 추후 — 크기(STATS_PANEL_W/H)도 내용과 함께 확정.
export const STATS_PANEL_W = 150;
export const STATS_PANEL_H = 100;

export function drawStatsLayer(rect) {
	drawPanel(rect.x, rect.y, rect.w, rect.h, { radius: 10, alpha: 0.85 });
}

// ============ Next-wave button ============
// 일시정지 버튼 바로 위 (버튼 rect는 접이식 컨트롤 섹션에서 정의).
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
	if (showBadge) drawNewBadge(nextWaveButton);
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
