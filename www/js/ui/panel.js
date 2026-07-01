// 플레잉 신 정보 패널 그리기. 데이터는 도메인 모듈의 뷰모델로 받음 (game 의존 없음).
import { ctx } from '../core/canvas.js';
import { GOLD, INFO_BLUE, SLATE } from '../core/config.js';
import { drawPanel, roundRect } from '../core/helpers.js';
import { drawEnemySprite } from './sprite.js';
import { t } from '../core/i18n.js';

// 선택된 타워/적의 정보·설정 카드 공용 패널 영역 (화면 하단). 위치/크기·hit-test 공유.
export const infoPanel = { x: 16, y: 496, w: 328, h: 144 };
// 정보 카드 우상단 기어 버튼 — 터치 시 설정 카드 진입 (hit-test는 scenes).
export const infoSettingsButton = { x: 308, y: 504, w: 28, h: 28 };
// 정보 카드 하단 전직 버튼 (hit-test는 scenes, 액션은 tower.handlePromotionButton).
export const infoPromotionButton = { x: 30, y: 600, w: 300, h: 32 };

// 정보 카드 우상단 기어 버튼
export function drawGearButton(btn) {
	const cx = btn.x + btn.w / 2;
	const cy = btn.y + btn.h / 2;
	ctx.fillStyle = SLATE;
	roundRect(btn.x, btn.y, btn.w, btn.h, 6);
	ctx.fill();
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
	ctx.lineWidth = 1;
	ctx.stroke();
	// 기어 아이콘 (이빨 + 링 + 중심)
	ctx.strokeStyle = '#fff';
	ctx.fillStyle = '#fff';
	const r = 5;
	ctx.lineWidth = 2;
	ctx.beginPath();
	for (let i = 0; i < 8; i++) {
		const a = (Math.PI * 2 * i) / 8;
		ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
		ctx.lineTo(cx + Math.cos(a) * (r + 2.5), cy + Math.sin(a) * (r + 2.5));
	}
	ctx.stroke();
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(cx, cy, 1.6, 0, Math.PI * 2);
	ctx.fill();
}

// 전직 버튼 — state(tower.getPromotionState)로 라벨·활성 도출, 구운 tower 필드 사용.
export function drawPromotionButton(tower, state) {
	const active = state !== 'notReady' && state !== 'noGold';
	const cost = tower.promotionCost.toLocaleString();
	let label;
	switch (state) {
		case 'notReady': label = t('전직 (XP {xp} / {max})', { xp: tower.xp, max: tower.xpMax }); break;
		case 'noGold': label = t('전직 ({cost}G · 골드 부족)', { cost }); break;
		case 'setTarget': label = t('4티어 대상 지정'); break;
		case 'cancelTarget': label = t('대상 취소'); break;
		default: label = t('전직 ({cost}G)', { cost }); break; // openChoice
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

	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = '#fff';
	ctx.font = 'bold 14px sans-serif';
	const nameWidth = ctx.measureText(cfg.name).width;
	ctx.fillText(cfg.name, infoPanel.x + 14, infoPanel.y + 22);

	ctx.font = 'bold 11px sans-serif';
	const tierX = infoPanel.x + 14 + nameWidth + 8;
	const tierY = infoPanel.y + 22;
	const tierStr = `Tier ${tower.tier}`;
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
	ctx.lineWidth = 2.5;
	ctx.lineJoin = 'round';
	ctx.strokeText(tierStr, tierX, tierY);
	ctx.fillStyle = cfg.color;
	ctx.fillText(tierStr, tierX, tierY);
	ctx.lineWidth = 1;

	ctx.font = '12px sans-serif';
	ctx.fillStyle = '#cdd';
	const sx = infoPanel.x + 14;
	const sy = infoPanel.y + 50;
	const total = Math.round((tower.totalDamage || 0) * 10) / 10;
	const atkLabels = { ground: t('지상'), air: t('공중') };
	const hasAttack = (cfg.attackTypes || []).length > 0;
	const activeTypes = [];
	if (tower.canGround) activeTypes.push('ground');
	if (tower.canAir) activeTypes.push('air');
	const atkText = activeTypes.length ? activeTypes.map(a => atkLabels[a] || a).join('/') : t('없음');

	if (hasAttack) {
		const effDmg = tower.damage;
		const baseDmg = cfg.damage;
		const dmgBuffPct = effDmg > baseDmg ? Math.round((effDmg / baseDmg - 1) * 100) : 0;
		const dpsValue = Math.round(effDmg * cfg.fireRate * 10) / 10;
		const dmgValue = Math.round(effDmg * 10) / 10;
		const dmgStr = dmgBuffPct > 0
			? t('데미지: {dmg} (+{pct}%, {dps}/초)', { dmg: dmgValue, pct: dmgBuffPct, dps: dpsValue })
			: t('데미지: {dmg} ({dps}/초)', { dmg: baseDmg, dps: dpsValue });
		ctx.fillText(dmgStr, sx, sy);
		ctx.fillText(t('발사속도: {rate}/초', { rate: cfg.fireRate.toFixed(1) }), sx, sy + 18);
	} else {
		ctx.fillText(t('데미지: —'), sx, sy);
		ctx.fillText(t('발사속도: —'), sx, sy + 18);
	}

	const effRange = tower.range;
	const baseRange = tower.cfg.range;
	const buffPct = effRange > baseRange ? Math.round((effRange / baseRange - 1) * 100) : 0;
	const rangeStr = buffPct > 0
		? t('사거리: {range} (+{pct}%)', { range: Math.round(effRange), pct: buffPct })
		: t('사거리: {range}', { range: baseRange });
	ctx.fillText(rangeStr, sx + 160, sy);
	ctx.fillText(t('공격 대상: {types}', { types: atkText }), sx + 160, sy + 18);
	const wave = Math.round((tower.waveDamage || 0) * 10) / 10;
	ctx.fillText(t('웨이브 누적 데미지: {dmg}', { dmg: wave.toLocaleString() }), sx, sy + 36);
	ctx.fillText(t('누적 데미지: {dmg}', { dmg: total.toLocaleString() }), sx + 160, sy + 36);

	if (tower.canPromote) {
		const xpMax = tower.xpMax;
		const bx = sx;
		const by = sy + 44;
		const bw = 240;
		const bh = 8;
		const ratio = xpMax > 0 ? tower.xp / xpMax : 0;
		ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
		ctx.fillRect(bx, by, bw, bh);
		ctx.fillStyle = tower.xp >= xpMax ? GOLD : INFO_BLUE;
		ctx.fillRect(bx, by, bw * ratio, bh);
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
		ctx.lineWidth = 1;
		ctx.strokeRect(bx, by, bw, bh);
		ctx.fillStyle = '#fff';
		ctx.font = '10px sans-serif';
		ctx.fillText(`XP ${tower.xp} / ${xpMax}`, bx + bw + 8, by + bh - 1);

		drawPromotionButton(tower, promotionState);
	}

	drawGearButton(infoSettingsButton);
}

const fmtHp = (v) => Math.max(0, v).toLocaleString(undefined, { maximumFractionDigits: 1 });
// e: enemy inst, factor: slow factor
export function drawEnemyInfoPanel(e, factor) {
	const p = infoPanel;
	drawPanel(p.x, p.y, p.w, p.h, { stroke: '#e74c3c', alpha: 0.9 });

	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';

	// 이름 + 스프라이트 아이콘 (스프라이트 종류는 스폰 시 박은 e.spriteType)
	drawEnemySprite(e.spriteType, p.x + 24, p.y + 22, 9, { shielded: e.shielded });
	ctx.fillStyle = '#fff';
	ctx.font = 'bold 14px sans-serif';
	ctx.fillText(e.name, p.x + 42, p.y + 27);

	ctx.font = '12px sans-serif';
	ctx.fillStyle = '#cdd';
	const sx = p.x + 14;

	// 항목을 균일한 행 간격으로 순서대로 배치 — rowY()는 현재 행 y를 반환하고 다음 행으로 진행.
	// 조건부 항목(방어력/회복/장벽)이 있어도 항상 같은 간격으로 규칙적으로 쌓임.
	const ROW = 20;
	let row = 0;
	const rowY = () => p.y + 52 + (row++) * ROW;

	// 타입
	ctx.fillText(t('타입: {type}', { type: e.ga === 'air' ? t('공중') : t('지상') }), sx, rowY());

	// 체력 — 텍스트 + 오른쪽 같은 줄 HP 바
	const yHp = rowY();
	const hpLabel = t('체력: {hp} / {max}', { hp: fmtHp(e.hp), max: fmtHp(e.hpMax) });
	ctx.fillText(hpLabel, sx, yHp);
	const bh = 8;
	const bx = sx + ctx.measureText(hpLabel).width + 10;
	const by = yHp - bh;
	const bw = Math.max(0, (p.x + p.w - 14) - bx);
	const ratio = e.hpMax > 0 ? Math.max(0, e.hp / e.hpMax) : 0;
	ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
	ctx.fillRect(bx, by, bw, bh);
	ctx.fillStyle = e.shielded ? INFO_BLUE : '#2ecc71';
	ctx.fillRect(bx, by, bw * ratio, bh);
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
	ctx.lineWidth = 1;
	ctx.strokeRect(bx, by, bw, bh);
	ctx.fillStyle = '#cdd';

	// 이동 속도 (둔화 시 표기)
	const eff = Math.round(e.speed * factor);
	const slowPct = factor < 1 ? Math.round((1 - factor) * 100) : 0;
	ctx.fillText(
		slowPct > 0
			? t('이동 속도: {spd} (둔화 {pct}%)', { spd: eff, pct: slowPct })
			: t('이동 속도: {spd}', { spd: eff }),
		sx, rowY(),
	);

	// 종류별 추가 항목 — 방어막(데미지 감소량) / 재생(초당 회복률) / 장벽(생성 장벽 체력)
	if (e.shielded) {
		ctx.fillText(t('방어력: {n}', { n: e.shieldReduction.toFixed(1) }), sx, rowY());
	}
	if (e.kind === 'regen') {
		ctx.fillText(t('초당 회복: {pct}%', { pct: Math.round(e.regenRate * 100) }), sx, rowY());
	}
	if (e.kind === 'barrierSpawner') {
		ctx.fillText(t('장벽 체력: {hp}', { hp: fmtHp(e.barrierHp) }), sx, rowY());
	}
}