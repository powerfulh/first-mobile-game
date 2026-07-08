// 플레잉 신 정보 패널 그리기. 데이터는 도메인 모듈의 뷰모델로 받음 (game 의존 없음).
import { ctx } from '../core/canvas.js';
import { ACCENT_RED, GOLD, INFO_BLUE, SLATE } from '../core/config.js';
import { drawPanel, roundRect, hasItems, round1 } from '../core/helpers.js';
import { drawEnemySprite, drawProhibition, drawGearIcon, drawBookIcon, drawTrashIcon, drawHourglassIcon } from './sprite.js';
import { drawTowerSprite } from './sprite/tower.js';
import { t } from '../core/i18n.js';

// 선택된 타워/적의 정보·설정 카드 공용 패널 영역 (화면 하단). 위치/크기·hit-test 공유.
export const infoPanel = { x: 16, y: 496, w: 328, h: 144 };
const infoTopBtn = {
	y: 504, w: 28, h: 28
}
export const infoQueueButton = { x: 244, ...infoTopBtn };
export const infoWikiButton = { x: 276, ...infoTopBtn };
export const infoSettingsButton = { x: 308, ...infoTopBtn };
// 정보 카드 하단 전직 버튼 (hit-test는 scenes, 액션은 tower.handlePromotionButton).
export const infoPromotionButton = { x: 30, y: 600, w: 300, h: 32 };

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
function drawPanelHeader(text, x = infoPanel.x + 14, y = infoPanel.y + 22) {
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = '#fff';
	ctx.font = 'bold 14px sans-serif';
	ctx.fillText(text, x, y);
	return ctx.measureText(text);
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
	ctx.fillText(`Tier ${tower.tier}`, infoPanel.x + 14 + nameWidth + 8, infoPanel.y + 22);

	if (tower.canPromote) drawTopIconButton(infoQueueButton, drawHourglassIcon);
	drawTopIconButton(infoWikiButton, drawBookIcon);
	drawTopIconButton(infoSettingsButton, drawGearIcon);

	ctx.font = '12px sans-serif';
	ctx.fillStyle = '#cdd';
	const sx = infoPanel.x + 14;
	const sy = infoPanel.y + 50;
	const total = round1(tower.totalDamage);
	const atkLabels = { ground: t('common.ground'), air: t('common.air') };
	const activeTypes = [];
	if (tower.canGround) activeTypes.push('ground');
	if (tower.canAir) activeTypes.push('air');
	const atkText = activeTypes.length ? activeTypes.map(a => atkLabels[a] || a).join('/') : t('common.none');

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
		ctx.fillText(rateStr, sx, sy + 18);
	} else {
		ctx.fillText(t('panel.dmgNone'), sx, sy);
		ctx.fillText(t('panel.fireRateNone'), sx, sy + 18);
	}

	const effRange = tower.range;
	const baseRange = tower.cfg.range;
	const buffPct = effRange > baseRange ? Math.round((effRange / baseRange - 1) * 100) : 0;
	const rangeStr = buffPct > 0
		? t('panel.rangeBuffed', { range: Math.round(effRange), pct: buffPct })
		: t('panel.range', { range: baseRange });
	ctx.fillText(rangeStr, sx + 160, sy);
	ctx.fillText(t('panel.targets', { types: atkText }), sx + 160, sy + 18);
	const wave = round1(tower.waveDamage);
	ctx.fillText(t('panel.waveDamage', { dmg: wave.toLocaleString() }), sx, sy + 36);
	ctx.fillText(t('panel.totalDamage', { dmg: total.toLocaleString() }), sx + 160, sy + 36);

	if (tower.canPromote) {
		const xpMax = tower.xpMax;
		const bx = sx;
		const by = sy + 44;
		const bw = 220;
		const bh = 8;
		const ratio = xpMax > 0 ? tower.xp / xpMax : 0;
		drawBar(bx, by, bw, bh, ratio, tower.xp >= xpMax ? GOLD : INFO_BLUE);
		ctx.fillStyle = '#fff';
		ctx.font = '10px sans-serif';
		ctx.fillText(`XP ${tower.xp} / ${xpMax}`, bx + bw + 8, by + bh - 1);

		drawPromotionButton(tower, promotionState);
	}
}

export function drawTowerQueuePanel(tower) {
	const p = infoPanel;
	const cfg = tower.cfg;
	drawPanel(p.x, p.y, p.w, p.h, { stroke: cfg.color, alpha: 0.9 });

	drawPanelHeader(t('panel.queueTitle'));
}

export const SETTINGS_DELETE_BTN = { ...infoWikiButton };
export const SETTINGS_GA = {
	ground: { x: 96, y: 556, w: 48, h: 32 },
	sign: { x: 156, y: 556, w: 48, h: 32 },
	air: { x: 216, y: 556, w: 48, h: 32 },
};
export const SETTINGS_PRIORITY_BTN = { x: 38, y: 596, w: 284, h: 24 };
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

	// 우선순위 영역
	ctx.fillStyle = '#9ab';
	ctx.font = 'bold 11px sans-serif';
	ctx.fillText(t('panel.priority'), p.x + 14, p.y + 46);

	const ax = p.x + 14;
	const ay = p.y + 54;
	const aw = p.w - 28;
	const ah = p.y + p.h - 14 - ay;
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
	ctx.lineWidth = 1;
	roundRect(ax, ay, aw, ah, 6);
	ctx.stroke();

	if (!hasItems(cfg.attackTypes)) {
		ctx.fillStyle = '#7a8a99';
		ctx.font = '12px sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText(t('panel.nonAttacking'), p.x + p.w / 2, ay + ah / 2 + 4);
		ctx.textAlign = 'left';
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
export const promotionPanel = { x: 16, y: 376, w: 328, h: 248 };
export const promotionCloseButton = { x: 308, y: 384, w: 28, h: 28 };
export const promotionCardSlots = [
	{ x: 24, y: 432, w: 312, h: 84 },
	{ x: 24, y: 526, w: 312, h: 84 },
];
// 4티어 결과 카드 — 단일 카드라 영역 전체를 채움
export const tier4ResultCardSlot = { x: 24, y: 432, w: 312, h: 178 };

function drawPromotionCard(slot, cfg, cost, canAfford) {
	drawPanel(slot.x, slot.y, slot.w, slot.h, {
		fill: canAfford ? '#222d40' : '#1a1f28',
		stroke: canAfford ? cfg.color : '#444',
		alpha: 0.95,
	});

	drawTowerSprite(cfg, slot.x + 36, slot.y + slot.h / 2, { radius: 18 });

	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = '#fff';
	ctx.font = 'bold 18px sans-serif';
	ctx.fillText(cfg.name, slot.x + 68, slot.y + 32);

	ctx.fillStyle = '#bcd';
	ctx.font = '12px sans-serif';
	ctx.fillText(t('panel.cardStats', { range: cfg.range, dmg: cfg.damage, rate: cfg.fireRate.toFixed(1) }), slot.x + 68, slot.y + 56);

	ctx.fillStyle = '#8aa';
	ctx.font = '11px sans-serif';
	ctx.fillText(cfg.tagline || '', slot.x + 68, slot.y + 74);

	ctx.textAlign = 'right';
	ctx.fillStyle = canAfford ? GOLD : '#666';
	ctx.font = 'bold 16px sans-serif';
	ctx.fillText(`${cost.toLocaleString()}G`, slot.x + slot.w - 14, slot.y + 32);
}

function drawTier4ResultCard(slot, cfg, cost, canAfford) {
	drawPanel(slot.x, slot.y, slot.w, slot.h, {
		fill: canAfford ? '#222d40' : '#1a1f28',
		stroke: canAfford ? cfg.color : '#444',
		alpha: 0.95,
	});

	// 외관 미리보기 — 게임과 동일한 4티어 타워 그래픽 (후광 포함)
	drawTowerSprite(cfg, slot.x + 42, slot.y + 42, { radius: 22 });

	// 이름 + 비용
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = '#fff';
	ctx.font = 'bold 20px sans-serif';
	ctx.fillText(cfg.name, slot.x + 80, slot.y + 32);

	ctx.textAlign = 'right';
	ctx.fillStyle = canAfford ? GOLD : '#666';
	ctx.font = 'bold 16px sans-serif';
	ctx.fillText(`${cost.toLocaleString()}G`, slot.x + slot.w - 14, slot.y + 32);

	// 스탯
	ctx.textAlign = 'left';
	ctx.fillStyle = '#bcd';
	ctx.font = '12px sans-serif';
	ctx.fillText(
		t('panel.cardStats', { range: cfg.range, dmg: cfg.damage, rate: cfg.fireRate.toFixed(1) }),
		slot.x + 80, slot.y + 54,
	);

	ctx.fillStyle = '#8aa';
	ctx.font = '11px sans-serif';
	ctx.fillText(cfg.tagline || '', slot.x + 80, slot.y + 72);

	// 구분선
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(slot.x + 14, slot.y + 92);
	ctx.lineTo(slot.x + slot.w - 14, slot.y + 92);
	ctx.stroke();

	// 상세 설명
	const lines = cfg.description || [];
	ctx.fillStyle = '#dde';
	ctx.font = '12px sans-serif';
	const lineH = 18;
	const baseY = slot.y + 112;
	for (let i = 0; i < lines.length; i++) {
		ctx.fillText('• ' + lines[i], slot.x + 16, baseY + i * lineH);
	}
}

// canAfford: 카드 활성 여부 — 탭 시 실제 판정과 같은 canAffordPromotion으로 호출부가 도출해 전달.
// choices: 표시할 선택지 뷰모델 (tower.getPromotionChoices) — tier4Cfg(합체 결과) 또는 cfgs(역할별 cfg 목록).
export function drawPromotionPanel(tower, canAfford, { cfgs, tier4Cfg }) {
	drawPanel(promotionPanel.x, promotionPanel.y, promotionPanel.w, promotionPanel.h, {
		radius: 12, fill: '#0f1620', stroke: GOLD, alpha: 0.92,
	});

	ctx.textAlign = 'center';
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = GOLD;
	ctx.font = 'bold 18px sans-serif';
	ctx.fillText(t('panel.promote.title'), promotionPanel.x + promotionPanel.w / 2, promotionPanel.y + 28);

	const cost = tower.promotionCost;

	ctx.fillStyle = '#bcd';
	ctx.font = '12px sans-serif';
	if (tier4Cfg) {
		ctx.fillText(
			t('panel.promote.tier4Info', { from: tower.cfg.name, to: tier4Cfg.name }),
			promotionPanel.x + promotionPanel.w / 2,
			promotionPanel.y + 48,
		);
		drawTier4ResultCard(tier4ResultCardSlot, tier4Cfg, cost, canAfford);
	} else {
		ctx.fillText(t('panel.promote.choose'), promotionPanel.x + promotionPanel.w / 2, promotionPanel.y + 48);
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
	
	drawPanelHeader(e.name, p.x + 42, p.y + 27); // 좌측 스프라이트 옆

	ctx.font = '12px sans-serif';
	ctx.fillStyle = '#cdd';
	const sx = p.x + 14;

	// 항목을 균일한 행 간격으로 순서대로 배치 — rowY()는 현재 행 y를 반환하고 다음 행으로 진행.
	// 조건부 항목(방어력/회복/장벽)이 있어도 항상 같은 간격으로 규칙적으로 쌓임.
	const ROW = 20;
	let row = 0;
	const rowY = () => p.y + 52 + (row++) * ROW;

	// 타입
	ctx.fillText(t('panel.type', { type: e.ga === 'air' ? t('common.air') : t('common.ground') }), sx, rowY());

	// 체력 — 텍스트 + 오른쪽 같은 줄 HP 바
	const yHp = rowY();
	const hpLabel = t('panel.hp', { hp: fmtHp(e.hp), max: fmtHp(e.hpMax) });
	ctx.fillText(hpLabel, sx, yHp);
	const bh = 8;
	const bx = sx + ctx.measureText(hpLabel).width + 10;
	const by = yHp - bh;
	const bw = Math.max(0, (p.x + p.w - 14) - bx);
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
}
