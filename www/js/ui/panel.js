// 플레잉 신 정보 패널 그리기. 데이터는 도메인 모듈의 뷰모델로 받음 (game 의존 없음).
import { ctx } from '../core/canvas.js';
import { ACCENT_RED, GOLD, INFO_BLUE, LOGICAL_H, SLATE } from '../core/config.js';
import { drawPanel, roundRect, hasItems, round1 } from '../core/helpers.js';
import { drawEnemySprite, drawProhibition, drawGearIcon, drawBookIcon, drawTrashIcon, drawHourglassIcon } from './sprite.js';
import { drawTowerSprite } from './sprite/tower.js';
import { t } from '../core/i18n.js';

// 부모 컨테이너 가장자리 ↔ 자식 아이템 공용 패딩. 같은 성격 아이템의 나열 간격은 별도(각 자리 리터럴).
const PAD = 8;
// 아이템 사이 마진 공용값
const margin = 6;

// 선택된 타워/적의 정보·설정 카드 공용 패널 영역 (화면 하단). 위치/크기·hit-test 공유.
export const infoPanel = { x: 16, w: 328, h: 152, y: LOGICAL_H - 152 };
const infoTopBtn = {
	y: infoPanel.y + PAD, w: 28, h: 28,
};
// 우상단 아이콘 버튼 — 우측 가장자리에서 PAD, 버튼 사이 간격 4
export const infoSettingsButton = { x: infoPanel.x + infoPanel.w - PAD - infoTopBtn.w, ...infoTopBtn };
export const infoWikiButton = { x: infoSettingsButton.x - infoTopBtn.w - 4, ...infoTopBtn };
export const infoQueueButton = { x: infoWikiButton.x - infoTopBtn.w - 4, ...infoTopBtn };
// 정보 카드 하단 전직 버튼 (hit-test는 scenes, 액션은 tower.handlePromotionButton).
export const infoPromotionButton = { x: infoPanel.x + PAD, y: LOGICAL_H - PAD - 32, w: infoPanel.w - PAD * 2, h: 32 };

// 닫기(×) 버튼 — 빨간 배경 사각 버튼 (hit-test는 호출부).
export function drawCloseX(btn) {
	ctx.fillStyle = ACCENT_RED;
	roundRect(btn.x, btn.y, btn.w, btn.h, 6);
	ctx.fill();
	ctx.strokeStyle = '#fff';
	ctx.lineWidth = 1;
	ctx.stroke();
	ctx.fillStyle = '#fff';
	ctx.font = 'bold 18px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('×', btn.x + btn.w / 2, btn.y + btn.h / 2);
	ctx.textBaseline = 'alphabetic';
}

// 패널 헤더 텍스트 (흰색 bold 14px, 좌측 정렬) — 기본 위치는 정보 패널 좌상단.
// 헤더 폰트 기준 TextMetrics를 반환 — 헤더 옆에 이어 그리는 요소의 배치 계산용.
function drawPanelHeader(text, x = infoPanel.x + PAD, y = infoPanel.y) {
	ctx.textAlign = 'left';
	ctx.textBaseline = 'top';
	ctx.fillStyle = '#fff';
	ctx.font = 'bold 14px sans-serif';
	ctx.fillText(text, x, y + PAD);
	return ctx.measureText(text);
}

// 섹션 — 헤더 텍스트 + margin + 컨테이너 박스. y(섹션 헤더 윗선)만 받고
// x·너비는 패널 공통(PAD 인셋) 고정, 컨테이너 높이는 부모 패널 끝선(LOGICAL_H) − PAD로 도출.
// 컨테이너 rect { x, y, w, h }를 반환 — 내부 아이템 배치용.
function drawSection(title, y) {
	const x = infoPanel.x + PAD;
	const w = infoPanel.w - PAD * 2;

	const fontSize = 11;
	ctx.fillStyle = '#9ab';
	ctx.font = `bold ${fontSize}px sans-serif`;
	ctx.textBaseline = 'top';
	ctx.fillText(title, x, y);
	ctx.textBaseline = 'alphabetic';

	const boxY = y + fontSize + margin;
	const h = LOGICAL_H - PAD - boxY;
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
	ctx.lineWidth = 1;
	roundRect(x, boxY, w, h, 6);
	ctx.stroke();
	return { x, y: boxY, w, h };
}

// 진행 바 (배경 트랙 + ratio만큼 채움 + 테두리). XP·HP 바 공용. 좌표·ratio·색은 호출부가 결정.
function drawBar(x, y, w, h, ratio, fillColor) {
	ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
	ctx.fillRect(x, y, w, h);
	ctx.fillStyle = fillColor;
	ctx.fillRect(x, y, w * ratio, h);
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
	ctx.lineWidth = 1;
	ctx.strokeRect(x, y, w, h);
}

// 정보 카드 우상단 아이콘 버튼 (위키·설정 공용) — 공통 셀 배경 + 아이콘(ui/sprite)만 다름.
function drawTopIconButton(btn, drawIcon) {
	ctx.fillStyle = SLATE;
	roundRect(btn.x, btn.y, btn.w, btn.h, 6);
	ctx.fill();
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
	ctx.lineWidth = 1;
	ctx.stroke();
	drawIcon(btn.x + btn.w / 2, btn.y + btn.h / 2);
}

// 전직 버튼 — state(tower.getPromotionState)로 라벨·활성 도출, 구운 tower 필드 사용.
function drawPromotionButton(tower, state) {
	const active = state !== 'notReady' && state !== 'noGold';
	const cost = tower.promotionCost.toLocaleString();
	let label;
	switch (state) {
		case 'notReady': label = t('panel.promote.notReady', { xp: tower.xp, max: tower.xpMax }); break;
		case 'noGold': label = t('panel.promote.noGold', { cost }); break;
		case 'setTarget': label = t('panel.promote.setTarget', { tier: tower.tier + 1 }); break;
		case 'cancelTarget': label = t('panel.promote.cancelTarget'); break;
		default: label = t('panel.promote.cost', { cost }); break; // openChoice
	}

	ctx.globalAlpha = active ? 1 : 0.55;
	if (active) {
		const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 250);
		ctx.fillStyle = `rgba(241, 196, 15, ${0.85 + 0.15 * pulse})`;
	} else {
		ctx.fillStyle = '#3a3f48';
	}
	roundRect(infoPromotionButton.x, infoPromotionButton.y, infoPromotionButton.w, infoPromotionButton.h, 8);
	ctx.fill();
	ctx.globalAlpha = 1;
	ctx.strokeStyle = active ? '#fff' : '#555';
	ctx.lineWidth = active ? 2 : 1;
	ctx.stroke();

	ctx.fillStyle = active ? '#1a1300' : '#888';
	ctx.font = 'bold 14px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(label, infoPromotionButton.x + infoPromotionButton.w / 2, infoPromotionButton.y + infoPromotionButton.h / 2);
	ctx.textBaseline = 'alphabetic';
}

// 선택된 타워 정보 카드. promotionState는 호출부(도메인)가 tower.getPromotionState로 도출해 전달.
export function drawTowerInfoPanel(tower, promotionState) {
	const cfg = tower.cfg;
	drawPanel(infoPanel.x, infoPanel.y, infoPanel.w, infoPanel.h, { stroke: cfg.color, alpha: 0.9 });

	const nameWidth = drawPanelHeader(cfg.name).width;

	ctx.font = 'bold 11px sans-serif';
	ctx.textBaseline = 'top'; // 헤더와 같은 윗선(패널 상단 + PAD)에 나란히 (이름과의 간격 8)
	ctx.fillText(`Tier ${tower.tier}`, infoPanel.x + PAD + nameWidth + 8, infoPanel.y + PAD);

	if (tower.canPromote) drawTopIconButton(infoQueueButton, drawHourglassIcon);
	drawTopIconButton(infoWikiButton, drawBookIcon);
	drawTopIconButton(infoSettingsButton, drawGearIcon);

	const specFontSize = 12
	ctx.font = `${specFontSize}px sans-serif`;
	ctx.fillStyle = '#cdd';
	ctx.textBaseline = 'top'; // 스탯 행 — 윗선 기준으로 쌓임
	const sx = infoPanel.x + PAD;
	const sy = infoTopBtn.y + infoTopBtn.h + margin

	if (hasItems(cfg.attackTypes)) {
		const effDmg = tower.damage; // 캐시 (위치+리솔버 버프 반영)
		const effRate = tower.fireRate; // 캐시 (리솔버 버프 반영)
		const baseDmg = cfg.damage;
		const dmgBuffPct = effDmg > baseDmg ? Math.round((effDmg / baseDmg - 1) * 100) : 0;
		const dpsValue = round1(effDmg * effRate);
		const dmgValue = round1(effDmg);
		const dmgStr = dmgBuffPct > 0
			? t('panel.dmgBuffed', { dmg: dmgValue, pct: dmgBuffPct, dps: dpsValue })
			: t('panel.dmg', { dmg: baseDmg, dps: dpsValue });
		ctx.fillText(dmgStr, sx, sy);
		const rateBuffPct = effRate > cfg.fireRate ? Math.round((effRate / cfg.fireRate - 1) * 100) : 0;
		const rateStr = rateBuffPct > 0
			? t('panel.fireRateBuffed', { rate: effRate.toFixed(1), pct: rateBuffPct })
			: t('panel.fireRate', { rate: cfg.fireRate.toFixed(1) });
		ctx.fillText(rateStr, sx, sy + specFontSize + margin);
	} else {
		ctx.fillText(t('panel.dmgNone'), sx, sy);
		ctx.fillText(t('panel.fireRateNone'), sx, sy + specFontSize + margin);
	}

	const effRange = tower.range;
	const baseRange = tower.cfg.range;
	const buffPct = effRange > baseRange ? Math.round((effRange / baseRange - 1) * 100) : 0;
	const rangeStr = buffPct > 0
		? t('panel.rangeBuffed', { range: Math.round(effRange), pct: buffPct })
		: t('panel.range', { range: baseRange });
	ctx.fillText(rangeStr, sx + 160, sy);
	const atkLabels = { ground: t('common.ground'), air: t('common.air') };
	const activeTypes = [];
	if (tower.canGround) activeTypes.push('ground');
	if (tower.canAir) activeTypes.push('air');
	const atkText = activeTypes.length ? activeTypes.map(a => atkLabels[a] || a).join('/') : t('common.none');
	ctx.fillText(t('panel.targets', { types: atkText }), sx + 160, sy + specFontSize + margin);
	const wave = round1(tower.waveDamage);
	ctx.fillText(t('panel.waveDamage', { dmg: wave.toLocaleString() }), sx, sy + specFontSize*2 + margin*2);
	const total = round1(tower.totalDamage);
	ctx.fillText(t('panel.totalDamage', { dmg: total.toLocaleString() }), sx + 160, sy + specFontSize*2 + margin*2);

	if (tower.canPromote) {
		const xpMax = tower.xpMax;
		const bx = sx;
		const by = sy + specFontSize*3 + margin*3
		const bw = 220;
		const bh = 8;
		const ratio = xpMax > 0 ? tower.xp / xpMax : 0;
		drawBar(bx, by, bw, bh, ratio, tower.xp >= xpMax ? GOLD : INFO_BLUE);
		ctx.fillStyle = '#fff';
		ctx.font = '10px sans-serif';
		ctx.textBaseline = 'middle'; // XP 바 세로 중앙에 정렬
		ctx.fillText(`XP ${tower.xp} / ${xpMax}`, bx + bw + margin, by + bh / 2);

		drawPromotionButton(tower, promotionState);
	}
	ctx.textBaseline = 'alphabetic';
}

export const queuePanel = {...infoPanel, h: 160, y: LOGICAL_H - 160}

export function drawTowerQueuePanel(tower) {
	const p = queuePanel;
	const cfg = tower.cfg;
	drawPanel(p.x, p.y, p.w, p.h, { stroke: cfg.color, alpha: 0.9 });

	const headerMetrics = drawPanelHeader(t('panel.queueTitle'), undefined, p.y);
	// 헤더 실측 높이 (baseline 설정과 무관하게 어센트+디센트 합 = 글리프 높이)
	const headerH = headerMetrics.actualBoundingBoxAscent + headerMetrics.actualBoundingBoxDescent;

	// 전직 섹션 — 헤더 끝선 + 마진에서 시작
	drawSection(t('panel.queuePromote'), p.y + PAD + headerH + margin);
}

export const SETTINGS_DELETE_BTN = { ...infoWikiButton };
export const SETTINGS_GA = {
	ground: { x: 96, y: 556, w: 48, h: 32 },
	sign: { x: 156, y: 556, w: 48, h: 32 },
	air: { x: 216, y: 556, w: 48, h: 32 },
};
// 우선순위 영역 박스(패널에서 PAD) 안의 자식 버튼 — 영역에서 다시 PAD, 하단도 PAD
export const SETTINGS_PRIORITY_BTN = { x: infoPanel.x + PAD * 2, y: infoPanel.y + infoPanel.h - PAD * 2 - 24, w: infoPanel.w - PAD * 4, h: 24 };
const PRIORITY_LABELS = { closest: t('panel.priority.closest'), farthest: t('panel.priority.farthest'), strongest: t('panel.priority.strongest'), weakest: t('panel.priority.weakest') };

function drawCellButton(cell) {
	ctx.fillStyle = SLATE;
	roundRect(cell.x, cell.y, cell.w, cell.h, 6);
	ctx.fill();
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
	ctx.lineWidth = 1;
	ctx.stroke();
}

function drawGaCell(cell, type, enabled) {
	drawCellButton(cell);
	const cx = cell.x + cell.w / 2;
	const cy = cell.y + cell.h / 2;
	drawEnemySprite(type, cx, cy, 9);
	if (!enabled) drawProhibition(cx, cy, 12);
}

// dualCapable: 지상/공중 우선 행 표시 여부 (호출부가 towerDualCapable로 도출해 전달).
export function drawTowerSettingsCard(tower, dualCapable) {
	const cfg = tower.cfg;
	const p = infoPanel;
	drawPanel(p.x, p.y, p.w, p.h, { stroke: cfg.color, alpha: 0.9 });

	drawPanelHeader(t('panel.settingsTitle', { name: cfg.name }));

	drawTopIconButton(SETTINGS_DELETE_BTN, drawTrashIcon);

	// 우선순위 섹션 — 삭제 버튼 끝선 + 마진에서 시작
	const area = drawSection(t('panel.priority'), infoTopBtn.y + infoTopBtn.h + margin);

	if (!hasItems(cfg.attackTypes)) {
		ctx.fillStyle = '#7a8a99';
		ctx.font = '12px sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle'; // 섹션 컨테이너 세로 중앙
		ctx.fillText(t('panel.nonAttacking'), area.x + area.w / 2, area.y + area.h / 2);
		ctx.textAlign = 'left';
		ctx.textBaseline = 'alphabetic';
		return;
	}

	// 1순위 — 지상/공중 우선 (둘 다 가능한 타워만). 각 셀이 버튼.
	if (dualCapable) {
		drawGaCell(SETTINGS_GA.ground, 'ground', tower.canGround);
		drawGaCell(SETTINGS_GA.air, 'air', tower.canAir);
		// 부등호(지상/공중 우선). 스윕류는 단일 표적 정렬이 무의미 → '=' 고정·비활성(흐리게) 표시.
		const s = SETTINGS_GA.sign;
		const sweep = cfg.areaSweep;
		const sign = sweep ? '=' : (tower.gaPriority === 'ground' ? '>' : tower.gaPriority === 'air' ? '<' : '=');
		ctx.globalAlpha = sweep ? 0.45 : 1;
		drawCellButton(s);
		ctx.fillStyle = GOLD;
		ctx.font = 'bold 20px sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(sign, s.x + s.w / 2, s.y + s.h / 2);
		ctx.textBaseline = 'alphabetic';
		ctx.textAlign = 'left';
		ctx.globalAlpha = 1;
	}

	// 2순위 — 공통 표적 우선순위 (토글 버튼).
	// 범위(스윕) 공격은 사거리 내 전체를 때려 단일 표적 우선순위가 무의미 → 영역 생략.
	if (!cfg.areaSweep) {
		const b = SETTINGS_PRIORITY_BTN;
		drawCellButton(b);
		ctx.fillStyle = '#fff';
		ctx.font = 'bold 13px sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(t('panel.target', { p: PRIORITY_LABELS[tower.targetPriority] }), b.x + b.w / 2, b.y + b.h / 2);
		ctx.textBaseline = 'alphabetic';
		ctx.textAlign = 'left';
	}
}

// ============ 전직 패널 ============
// 좌표 상수는 scenes의 hit-test와 공유.
export const promotionPanel = { ...infoPanel, h: 248, y: LOGICAL_H - 248 };
export const promotionCloseButton = { x: promotionPanel.x + promotionPanel.w - PAD - 28, y: promotionPanel.y + PAD, w: 28, h: 28 };
export const promotionCardSlots = [
	{ x: promotionPanel.x + PAD, y: 448, w: promotionPanel.w - PAD * 2, h: 84 },
	{ x: promotionPanel.x + PAD, y: 542, w: promotionPanel.w - PAD * 2, h: 84 },
];
// 4티어 결과 카드 — 단일 카드라 영역 전체를 채움
export const tier4ResultCardSlot = { x: promotionPanel.x + PAD, y: 432, w: promotionPanel.w - PAD * 2, h: 178 };

function drawPromotionCard(slot, cfg, cost, canAfford) {
	drawPanel(slot.x, slot.y, slot.w, slot.h, {
		fill: canAfford ? '#222d40' : '#1a1f28',
		stroke: canAfford ? cfg.color : '#444',
		alpha: 0.95,
	});

	drawTowerSprite(cfg, slot.x + 36, slot.y + slot.h / 2, { radius: 18 });

	// 카드 콘텐츠 — 전부 윗선 기준으로 쌓임
	ctx.textAlign = 'left';
	ctx.textBaseline = 'top';
	ctx.fillStyle = '#fff';
	ctx.font = 'bold 18px sans-serif';
	ctx.fillText(cfg.name, slot.x + 68, slot.y + PAD);

	ctx.fillStyle = '#bcd';
	ctx.font = '12px sans-serif';
	ctx.fillText(t('panel.cardStats', { range: cfg.range, dmg: cfg.damage, rate: cfg.fireRate.toFixed(1) }), slot.x + 68, slot.y + 46);

	ctx.fillStyle = '#8aa';
	ctx.font = '11px sans-serif';
	ctx.fillText(cfg.tagline || '', slot.x + 68, slot.y + 64);

	ctx.textAlign = 'right';
	ctx.fillStyle = canAfford ? GOLD : '#666';
	ctx.font = 'bold 16px sans-serif';
	ctx.fillText(`${cost.toLocaleString()}G`, slot.x + slot.w - PAD, slot.y + PAD); // 이름과 같은 윗선
	ctx.textBaseline = 'alphabetic';
}

function drawTier4ResultCard(slot, cfg, cost, canAfford) {
	drawPanel(slot.x, slot.y, slot.w, slot.h, {
		fill: canAfford ? '#222d40' : '#1a1f28',
		stroke: canAfford ? cfg.color : '#444',
		alpha: 0.95,
	});

	// 외관 미리보기 — 게임과 동일한 4티어 타워 그래픽 (후광 포함)
	drawTowerSprite(cfg, slot.x + 42, slot.y + 42, { radius: 22 });

	// 이름 + 비용 — 카드 콘텐츠는 전부 윗선 기준으로 쌓임
	ctx.textAlign = 'left';
	ctx.textBaseline = 'top';
	ctx.fillStyle = '#fff';
	ctx.font = 'bold 20px sans-serif';
	ctx.fillText(cfg.name, slot.x + 80, slot.y + PAD);

	ctx.textAlign = 'right';
	ctx.fillStyle = canAfford ? GOLD : '#666';
	ctx.font = 'bold 16px sans-serif';
	ctx.fillText(`${cost.toLocaleString()}G`, slot.x + slot.w - PAD, slot.y + PAD); // 이름과 같은 윗선

	// 스탯
	ctx.textAlign = 'left';
	ctx.fillStyle = '#bcd';
	ctx.font = '12px sans-serif';
	ctx.fillText(
		t('panel.cardStats', { range: cfg.range, dmg: cfg.damage, rate: cfg.fireRate.toFixed(1) }),
		slot.x + 80, slot.y + 44,
	);

	ctx.fillStyle = '#8aa';
	ctx.font = '11px sans-serif';
	ctx.fillText(cfg.tagline || '', slot.x + 80, slot.y + 62);

	// 구분선
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(slot.x + PAD, slot.y + 92);
	ctx.lineTo(slot.x + slot.w - PAD, slot.y + 92);
	ctx.stroke();

	// 상세 설명 — 구분선(+92) 아래에서 윗선 기준으로 쌓임
	const lines = cfg.description || [];
	ctx.fillStyle = '#dde';
	ctx.font = '12px sans-serif';
	const lineH = 18;
	const topY = slot.y + 102;
	for (let i = 0; i < lines.length; i++) {
		ctx.fillText('• ' + lines[i], slot.x + PAD, topY + i * lineH);
	}
	ctx.textBaseline = 'alphabetic';
}

// canAfford: 카드 활성 여부 — 탭 시 실제 판정과 같은 canAffordPromotion으로 호출부가 도출해 전달.
// choices: 표시할 선택지 뷰모델 (tower.getPromotionChoices) — tier4Cfg(합체 결과) 또는 cfgs(역할별 cfg 목록).
export function drawPromotionPanel(tower, canAfford, { cfgs, tier4Cfg }) {
	drawPanel(promotionPanel.x, promotionPanel.y, promotionPanel.w, promotionPanel.h, {
		radius: 12, fill: '#0f1620', stroke: GOLD, alpha: 0.92,
	});

	// 타이틀·안내문 — 패널 상단에서 윗선 기준으로 쌓임
	ctx.textAlign = 'center';
	ctx.textBaseline = 'top';
	ctx.fillStyle = GOLD;
	ctx.font = 'bold 18px sans-serif';
	ctx.fillText(t('panel.promote.title'), promotionPanel.x + promotionPanel.w / 2, promotionPanel.y + PAD);

	const cost = tower.promotionCost;

	ctx.fillStyle = '#bcd';
	ctx.font = '12px sans-serif';
	if (tier4Cfg) {
		ctx.fillText(
			t('panel.promote.tier4Info', { from: tower.cfg.name, to: tier4Cfg.name }),
			promotionPanel.x + promotionPanel.w / 2,
			promotionPanel.y + 40,
		);
		ctx.textBaseline = 'alphabetic';
		drawTier4ResultCard(tier4ResultCardSlot, tier4Cfg, cost, canAfford);
	} else {
		ctx.fillText(t('panel.promote.choose'), promotionPanel.x + promotionPanel.w / 2, promotionPanel.y + 40);
		ctx.textBaseline = 'alphabetic';
		for (let i = 0; i < cfgs.length && i < promotionCardSlots.length; i++) {
			drawPromotionCard(promotionCardSlots[i], cfgs[i], cost, canAfford);
		}
	}

	drawCloseX(promotionCloseButton);
}

const fmtHp = (v) => Math.max(0, v).toLocaleString(undefined, { maximumFractionDigits: 1 });
// e: enemy inst, factor: slow factor, wikiAvailable: 위키 항목 존재 여부 (호출부가 보스 여부로 도출)
export function drawEnemyInfoPanel(e, factor, wikiAvailable) {
	const p = infoPanel;
	drawPanel(p.x, p.y, p.w, p.h, { stroke: '#e74c3c', alpha: 0.9 });

	if (wikiAvailable) drawTopIconButton(infoWikiButton, drawBookIcon);

	drawEnemySprite(e.spriteType, p.x + 24, p.y + 22, 9, { shielded: e.shielded });
	
	drawPanelHeader(e.name, p.x + 42, p.y + 5); // 좌측 스프라이트 옆

	ctx.font = '12px sans-serif';
	ctx.fillStyle = '#cdd';
	ctx.textBaseline = 'top'; // 행들은 윗선 기준으로 쌓임
	const sx = p.x + PAD;

	// 항목을 균일한 행 간격으로 순서대로 배치 — rowY()는 현재 행 윗선 y를 반환하고 다음 행으로 진행.
	// 조건부 항목(방어력/회복/장벽)이 있어도 항상 같은 간격으로 규칙적으로 쌓임.
	const ROW = 20;
	let row = 0;
	const rowY = () => p.y + 44 + (row++) * ROW;

	// 타입
	ctx.fillText(t('panel.type', { type: e.ga === 'air' ? t('common.air') : t('common.ground') }), sx, rowY());

	// 체력 — 텍스트 + 오른쪽 같은 줄 HP 바
	const yHp = rowY();
	const hpLabel = t('panel.hp', { hp: fmtHp(e.hp), max: fmtHp(e.hpMax) });
	ctx.fillText(hpLabel, sx, yHp);
	const bh = 8;
	const bx = sx + ctx.measureText(hpLabel).width + 10;
	const by = yHp + 2; // 행 텍스트(12px, 윗선 yHp) 세로 중앙에 바 중앙을 맞춤
	const bw = Math.max(0, (p.x + p.w - PAD) - bx);
	const ratio = e.hpMax > 0 ? Math.max(0, e.hp / e.hpMax) : 0;
	drawBar(bx, by, bw, bh, ratio, e.shielded ? INFO_BLUE : '#2ecc71');
	ctx.fillStyle = '#cdd';

	// 이동 속도 (둔화 시 표기)
	const eff = Math.round(e.speed * factor);
	const slowPct = factor < 1 ? Math.round((1 - factor) * 100) : 0;
	ctx.fillText(
		slowPct > 0
			? t('panel.speedSlowed', { spd: eff, pct: slowPct })
			: t('panel.speed', { spd: eff }),
		sx, rowY(),
	);

	// 종류별 추가 항목 — 방어막(데미지 감소량) / 재생(초당 회복률) / 장벽(생성 장벽 체력)
	if (e.shielded) {
		ctx.fillText(t('panel.armor', { n: e.shieldReduction.toFixed(1) }), sx, rowY());
	}
	if (e.kind === 'regen') {
		ctx.fillText(t('panel.heal', { pct: Math.round(e.regenRate * 100) }), sx, rowY());
	}
	if (e.kind === 'barrierSpawner') {
		ctx.fillText(t('panel.barrierHp', { hp: fmtHp(e.barrierHp) }), sx, rowY());
	}
	ctx.textBaseline = 'alphabetic';
}
