// 플레잉 신 정보 패널 그리기. 데이터는 도메인 모듈의 뷰모델로 받음 (game 의존 없음).
import { ctx } from '../core/canvas.js';
import { INFO_BLUE } from '../core/config.js';
import { drawPanel } from '../core/helpers.js';
import { enemyGA } from '../enemy.js';
import { towerInfoPanel } from '../tower.js';
import { drawEnemySprite } from './sprite.js';
import { t } from '../core/i18n.js';

const fmtHp = (v) => Math.max(0, v).toLocaleString(undefined, { maximumFractionDigits: 1 });

// 적 정보 카드 — 타워 정보 패널과 동일 위치/스타일. 선택된 적(e)을 참조로 직접 읽어 라이브 표시.
// factor(둔화 계수)만 라이브 계산값이라 호출처(scenes)가 getEnemySpeedFactor로 구해 전달.
export function drawEnemyInfoPanel(e, factor) {
	const p = towerInfoPanel;
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
	ctx.fillText(t('타입: {type}', { type: enemyGA(e) === 'air' ? t('공중') : t('지상') }), sx, rowY());

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
