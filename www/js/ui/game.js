// 플레잉 신 정보 패널 그리기. 데이터는 도메인 모듈의 뷰모델로 받음 (game 의존 없음).
import { ctx } from '../core/canvas.js';
import { INFO_BLUE } from '../core/config.js';
import { drawPanel } from '../core/helpers.js';
import { drawEnemySprite } from '../enemy.js';
import { towerInfoPanel } from '../tower.js';
import { t } from '../core/i18n.js';

const fmtHp = (v) => Math.max(0, v).toLocaleString(undefined, { maximumFractionDigits: 1 });

// 적 정보 카드 — 타워 정보 패널과 동일 위치/스타일. enemyInfoView(enemy.js) 뷰모델로 그림.
export function drawEnemyInfoPanel(view) {
	const p = towerInfoPanel;
	drawPanel(p.x, p.y, p.w, p.h, { stroke: '#e74c3c', alpha: 0.9 });

	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';

	// 이름 + 스프라이트 아이콘
	drawEnemySprite(view.spriteType, p.x + 24, p.y + 22, 9, { shielded: view.shielded });
	ctx.fillStyle = '#fff';
	ctx.font = 'bold 14px sans-serif';
	ctx.fillText(view.name, p.x + 42, p.y + 27);

	ctx.font = '12px sans-serif';
	ctx.fillStyle = '#cdd';
	const sx = p.x + 14;

	// 항목을 균일한 행 간격으로 순서대로 배치 — rowY()는 현재 행 y를 반환하고 다음 행으로 진행.
	// 조건부 항목(방어력/회복/장벽)이 있어도 항상 같은 간격으로 규칙적으로 쌓임.
	const ROW = 20;
	let row = 0;
	const rowY = () => p.y + 52 + (row++) * ROW;

	// 타입
	ctx.fillText(t('타입: {type}', { type: view.isAir ? t('공중') : t('지상') }), sx, rowY());

	// 체력 — 텍스트 + 오른쪽 같은 줄 HP 바
	const yHp = rowY();
	const hpLabel = t('체력: {hp} / {max}', { hp: fmtHp(view.hp), max: fmtHp(view.hpMax) });
	ctx.fillText(hpLabel, sx, yHp);
	const bh = 8;
	const bx = sx + ctx.measureText(hpLabel).width + 10;
	const by = yHp - bh;
	const bw = Math.max(0, (p.x + p.w - 14) - bx);
	const ratio = view.hpMax > 0 ? Math.max(0, view.hp / view.hpMax) : 0;
	ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
	ctx.fillRect(bx, by, bw, bh);
	ctx.fillStyle = view.shielded ? INFO_BLUE : '#2ecc71';
	ctx.fillRect(bx, by, bw * ratio, bh);
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
	ctx.lineWidth = 1;
	ctx.strokeRect(bx, by, bw, bh);
	ctx.fillStyle = '#cdd';

	// 이동 속도 (둔화 시 표기)
	ctx.fillText(
		view.slowPct > 0
			? t('이동 속도: {spd} (둔화 {pct}%)', { spd: view.effSpeed, pct: view.slowPct })
			: t('이동 속도: {spd}', { spd: view.effSpeed }),
		sx, rowY(),
	);

	// 종류별 추가 항목 — 방어막(데미지 감소량) / 재생(초당 회복률) / 장벽(생성 장벽 체력)
	if (view.shieldReduction !== undefined) {
		ctx.fillText(t('방어력: {n}', { n: view.shieldReduction.toFixed(1) }), sx, rowY());
	}
	if (view.regenPct !== undefined) {
		ctx.fillText(t('초당 회복: {pct}%', { pct: view.regenPct }), sx, rowY());
	}
	if (view.barrierHp !== undefined) {
		ctx.fillText(t('장벽 체력: {hp}', { hp: fmtHp(view.barrierHp) }), sx, rowY());
	}
}
