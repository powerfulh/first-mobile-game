import { ctx } from './core/canvas.js';
import { LOGICAL_W, LOGICAL_H, TOWER_ROLES, TIER4_RECIPES, ACCENT_RED } from './core/config.js';
import { roundRect, hitButton } from './core/helpers.js';
import { changeScene } from './scenes.js';
import { drawTowerSprite } from './tower.js';
import { drawEnemySprite } from './enemy.js';
import { playButton } from './sfx.js';
import { t } from './core/i18n.js';

// ============ 레이아웃 ============
const HEADER_H = 60;
const CONTENT_TOP = HEADER_H;
const CONTENT_BOTTOM = LOGICAL_H;
const CONTENT_H = CONTENT_BOTTOM - CONTENT_TOP;

const backBtn = { x: 8, y: 12, w: 40, h: 36 };
const tabTower = { x: 60, y: 12, w: 140, h: 36 };
const tabEnemy = { x: 210, y: 12, w: 140, h: 36 };

const GROUP_HEADER_H = 26;
const ITEM_H = 50;
const ITEM_GAP = 2;
const DETAIL_TOP_PAD = 22;
const DETAIL_BOTTOM_PAD = 14;

const TAP_THRESHOLD_PX = 8;

// 타워 트리 그룹 (사용자 결정: 전직 트리별)
const TOWER_GROUPS = [
	{ label: '기본', roles: ['novice'] },
	{
		label: '벙커 계열',
		roles: ['bunker', 'tank', 'whale', 'trap', 'base', 'beacon', 'demon'],
	},
	{
		label: '스카웃 계열',
		roles: ['scout', 'eagle', 'skydoom', 'interceptor', 'filder', 'master', 'dealman'],
	},
	{
		label: '4티어 합체',
		roles: ['radar', 'assassin', 'silo', 'gatling'],
	},
];

// 적 명단 (사용자 결정: 일반/공중/재생 3종, 방어막·보스 제외)
const ENEMY_ENTRIES = [
	{
		key: 'ground',
		name: '일반 적',
		tagline: 'Wave 1부터 등장하는 기본 지상 유닛',
		description: [
			'HP는 웨이브가 오를수록 증가',
			'이동 속도는 웨이브가 오를수록 빨라지며 후반 고정',
			'지상 공격이 가능한 모든 타워의 표적',
		],
	},
	{
		key: 'air',
		name: '공중 적',
		tagline: 'Wave 6+ · 공중 공격 가능 타워만 처리',
		description: [
			'출현 확률: (wave - 5) × 2%, Wave 30에 상한 50% 도달',
			'HP는 지상의 0.6배 시작, Wave 31~50에 걸쳐 1.0배까지 상승',
			'지상 전담 타워는 공격 불가, 스카웃 계열로 대비',
		],
	},
	{
		key: 'regen',
		name: '재생 적',
		tagline: 'Wave 111+ · 자가 회복, 느린 지상',
		description: [
			'출현 확률: Wave 111~130 +0.2%/wave (4%), Wave 191~200 +0.4%/wave (8%)',
			'HP는 일반 지상과 동일, 이동 속도는 절반',
			'HP가 가득 차지 않을 때 매초 hpMax × 12% 회복',
			'Wave 161~170 회복률 +1%/wave (22%) → Wave 191~200 추가 +1%/wave (32%)',
		],
	},
	{
		key: 'barrier',
		name: '장벽 적',
		tagline: 'Wave 151+ · 처치 시 장벽 생성',
		description: [
			'출현 확률: Wave 151 0.4%부터 +0.4%/wave, Wave 160에 4% 상한',
			'공중 타입, HP/속도는 일반 적과 동일',
			'처치 시 그 자리에 반경 60 장벽 생성 (HP는 일반 적의 2배)',
			'장벽은 공중 공격을 막아 대신 데미지를 받으며, 웨이브 종료까지 유지',
			'지상 전용 공격은 장벽 영향 없음',
		],
	},
];

// 위키 표시 텍스트 다국어화 — 정의 직후 1회 변환. (타워명/태그라인/설명은 config.js에서 변환됨)
for (const g of TOWER_GROUPS) g.label = t(g.label);
for (const e of ENEMY_ENTRIES) {
	e.name = t(e.name);
	if (e.tagline) e.tagline = t(e.tagline);
	if (e.description) e.description = e.description.map(line => t(line));
}

// ============ 씬 상태 ============
export const wiki = {
	category: 'tower', // 'tower' | 'enemy'
	scroll: 0,
	expandedKey: null, // 'tower:novice', 'tower:radar', ...
	drag: null,
	contentMax: 0, // 마지막 draw에서 계산된 컨텐츠 끝 y (스크롤 한계 산정용)
	returnTo: 'title', // 나갈 때 돌아갈 씬 — 호출 측이 changeScene 전에 설정

	enter() {
		wiki.scroll = 0;
		wiki.expandedKey = null;
		wiki.drag = null;
	},

	update() {},

	draw() {
		ctx.fillStyle = '#1a2e1a';
		ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

		drawContent();
		drawHeader();
	},

	pointerDown(p) {
		// 헤더 영역은 드래그 대상 아님 — 버튼/탭은 pointerUp에서 처리 (탭 vs 드래그 구분)
		if (p.y < HEADER_H) {
			wiki.drag = { startY: p.y, startScroll: wiki.scroll, moved: 0, inHeader: true, startPos: { ...p } };
			return;
		}
		wiki.drag = { startY: p.y, startScroll: wiki.scroll, moved: 0, inHeader: false, startPos: { ...p } };
	},

	pointerMove(p) {
		if (!wiki.drag) return;
		const dy = p.y - wiki.drag.startY;
		wiki.drag.moved = Math.max(wiki.drag.moved, Math.abs(dy));
		if (!wiki.drag.inHeader) {
			wiki.scroll = clampScroll(wiki.drag.startScroll - dy);
		}
	},

	pointerUp(p) {
		if (!wiki.drag) return;
		const drag = wiki.drag;
		wiki.drag = null;

		// 드래그 임계 초과 → 탭 무시
		if (drag.moved > TAP_THRESHOLD_PX) return;

		// 헤더 탭
		if (drag.inHeader) {
			if (hitButton(backBtn, drag.startPos)) {
				changeScene(wiki.returnTo);
				return;
			}
			if (hitButton(tabTower, drag.startPos)) {
				playButton();
				if (wiki.category !== 'tower') {
					wiki.category = 'tower';
					wiki.scroll = 0;
					wiki.expandedKey = null;
				}
				return;
			}
			if (hitButton(tabEnemy, drag.startPos)) {
				playButton();
				if (wiki.category !== 'enemy') {
					wiki.category = 'enemy';
					wiki.scroll = 0;
					wiki.expandedKey = null;
				}
				return;
			}
			return;
		}

		// 본문 항목 탭 → accordion 토글
		handleContentTap(drag.startPos);
	},

	pointerCancel() {
		wiki.drag = null;
	},

	backButton() {
		changeScene(wiki.returnTo);
	},

	keyDown(e) {
		// 데스크탑 — 백스페이스도 백 버튼과 동일
		if (e.code === 'Backspace') {
			e.preventDefault();
			this.backButton();
		}
	},
};

function clampScroll(v) {
	const max = Math.max(0, wiki.contentMax - CONTENT_H);
	return Math.max(0, Math.min(max, v));
}

// ============ 헤더 ============
function drawHeader() {
	ctx.fillStyle = '#0f1a0f';
	ctx.fillRect(0, 0, LOGICAL_W, HEADER_H);
	ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
	ctx.fillRect(0, HEADER_H - 1, LOGICAL_W, 1);

	// 뒤로가기
	ctx.fillStyle = '#3a3f48';
	roundRect(backBtn.x, backBtn.y, backBtn.w, backBtn.h, 6);
	ctx.fill();
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
	ctx.lineWidth = 1;
	ctx.stroke();
	ctx.fillStyle = '#fff';
	ctx.font = 'bold 16px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText('◀', backBtn.x + backBtn.w / 2, backBtn.y + backBtn.h / 2);
	ctx.textBaseline = 'alphabetic';

	drawTab(tabTower, t('타워'), wiki.category === 'tower');
	drawTab(tabEnemy, t('적'), wiki.category === 'enemy');
}

function drawTab(btn, label, active) {
	ctx.fillStyle = active ? ACCENT_RED : '#2c3e50';
	roundRect(btn.x, btn.y, btn.w, btn.h, 6);
	ctx.fill();
	ctx.strokeStyle = active ? '#fff' : 'rgba(255, 255, 255, 0.3)';
	ctx.lineWidth = active ? 2 : 1;
	ctx.stroke();
	ctx.fillStyle = active ? '#fff' : '#cdd';
	ctx.font = active ? 'bold 14px sans-serif' : '14px sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2);
	ctx.textBaseline = 'alphabetic';
}

// ============ 본문 ============
function drawContent() {
	ctx.save();
	ctx.beginPath();
	ctx.rect(0, CONTENT_TOP, LOGICAL_W, CONTENT_H);
	ctx.clip();

	let y = CONTENT_TOP - wiki.scroll;

	if (wiki.category === 'tower') {
		y = drawTowerCategory(y);
	} else {
		y = drawEnemyCategory(y);
	}

	// 하단 여백
	y += 16;
	wiki.contentMax = y + wiki.scroll - CONTENT_TOP;

	ctx.restore();
}

function drawTowerCategory(y) {
	for (const group of TOWER_GROUPS) {
		y = drawGroupHeader(y, group.label);
		for (const role of group.roles) {
			const cfg = TOWER_ROLES[role];
			if (!cfg) continue;
			const key = 'tower:' + role;
			const expanded = wiki.expandedKey === key;
			y = drawTowerItem(y, role, cfg, expanded);
		}
		y += 6; // 그룹 사이 간격
	}
	return y;
}

function drawEnemyCategory(y) {
	y = drawGroupHeader(y, t('적 명단'));
	for (const entry of ENEMY_ENTRIES) {
		const key = 'enemy:' + entry.key;
		const expanded = wiki.expandedKey === key;
		y = drawEnemyItem(y, entry, expanded);
	}
	return y;
}

function drawEnemyIcon(type, cx, cy) {
	// 게임과 동일한 적 그래픽 (enemy.js 공용 스프라이트)
	drawEnemySprite(type, cx, cy, 12);
}

function drawEnemyItem(y, entry, expanded) {
	const inView = y + ITEM_H >= CONTENT_TOP && y < CONTENT_BOTTOM;
	if (inView) {
		ctx.fillStyle = expanded ? '#22322a' : '#1c2820';
		ctx.fillRect(0, y, LOGICAL_W, ITEM_H);
		if (expanded) {
			ctx.strokeStyle = '#5dade2';
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(LOGICAL_W, y);
			ctx.stroke();
		}

		drawEnemyIcon(entry.key, 28, y + ITEM_H / 2);

		ctx.textAlign = 'left';
		ctx.textBaseline = 'alphabetic';
		ctx.fillStyle = '#fff';
		ctx.font = 'bold 15px sans-serif';
		const nameY = y + ITEM_H / 2 - 3;
		ctx.fillText(entry.name, 54, nameY);
		ctx.fillStyle = '#9ab';
		ctx.font = '11px sans-serif';
		ctx.fillText(entry.tagline || '', 54, nameY + 16);

		ctx.fillStyle = '#6c7';
		ctx.font = '12px sans-serif';
		ctx.textAlign = 'right';
		ctx.textBaseline = 'middle';
		ctx.fillText(expanded ? '▲' : '▼', LOGICAL_W - 14, y + ITEM_H / 2);
		ctx.textBaseline = 'alphabetic';
	}

	let nextY = y + ITEM_H + ITEM_GAP;
	if (expanded) {
		nextY = drawEnemyDetail(y + ITEM_H, entry) + ITEM_GAP;
	}
	return nextY;
}

function drawEnemyDetail(y, entry) {
	let cy = y + DETAIL_TOP_PAD;

	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = '#dde';
	ctx.font = '12px sans-serif';
	for (const line of entry.description || []) {
		cy = drawWrappedLine(line, 18, cy, LOGICAL_W - 36, 17, '• ');
	}

	cy += DETAIL_BOTTOM_PAD;
	return cy;
}

function measureEnemyDetailH(entry) {
	let cy = DETAIL_TOP_PAD;
	const desc = entry.description || [];
	cy += desc.length * 17;
	cy += DETAIL_BOTTOM_PAD;
	return cy;
}

function drawGroupHeader(y, label) {
	if (y + GROUP_HEADER_H >= CONTENT_TOP && y < CONTENT_BOTTOM) {
		ctx.fillStyle = '#243528';
		ctx.fillRect(0, y, LOGICAL_W, GROUP_HEADER_H);
		ctx.fillStyle = '#9ab39a';
		ctx.font = 'bold 12px sans-serif';
		ctx.textAlign = 'left';
		ctx.textBaseline = 'middle';
		ctx.fillText(label, 16, y + GROUP_HEADER_H / 2);
		ctx.textBaseline = 'alphabetic';
	}
	return y + GROUP_HEADER_H + 2;
}

function drawTowerItem(y, role, cfg, expanded) {
	// 항목 본 줄
	const inView = y + ITEM_H >= CONTENT_TOP && y < CONTENT_BOTTOM;
	if (inView) {
		ctx.fillStyle = expanded ? '#22322a' : '#1c2820';
		ctx.fillRect(0, y, LOGICAL_W, ITEM_H);
		if (expanded) {
			ctx.strokeStyle = cfg.color;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(LOGICAL_W, y);
			ctx.stroke();
		}

		// 외관 미리보기 — 게임과 동일한 타워 그래픽 (tower.js 공용 스프라이트)
		drawTowerSprite(role, 28, y + ITEM_H / 2);

		// 이름 + tagline
		ctx.textAlign = 'left';
		ctx.textBaseline = 'alphabetic';
		ctx.fillStyle = '#fff';
		ctx.font = 'bold 15px sans-serif';
		const nameY = y + ITEM_H / 2 - 3;
		ctx.fillText(cfg.name, 54, nameY);
		ctx.fillStyle = '#9ab';
		ctx.font = '11px sans-serif';
		ctx.fillText(cfg.tagline || '', 54, nameY + 16);

		// 펼침 화살표
		ctx.fillStyle = '#6c7';
		ctx.font = '12px sans-serif';
		ctx.textAlign = 'right';
		ctx.textBaseline = 'middle';
		ctx.fillText(expanded ? '▲' : '▼', LOGICAL_W - 14, y + ITEM_H / 2);
		ctx.textBaseline = 'alphabetic';
	}

	let nextY = y + ITEM_H + ITEM_GAP;

	if (expanded) {
		nextY = drawTowerDetail(y + ITEM_H, role, cfg) + ITEM_GAP;
	}

	return nextY;
}

function drawTowerDetail(y, role, cfg) {
	let cy = y + DETAIL_TOP_PAD;

	// 스탯
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = '#cdd';
	ctx.font = '12px sans-serif';

	const atkLabels = { ground: t('지상'), air: t('공중') };
	const attackTypes = cfg.attackTypes || [];
	const atkText = attackTypes.length > 0
		? attackTypes.map(a => atkLabels[a] || a).join('/')
		: t('없음');

	const statLines = [];
	statLines.push(t('사거리 {range}', { range: cfg.range }) + (cfg.minRange ? t('  (최소 {min})', { min: cfg.minRange }) : ''));
	if (attackTypes.length > 0) {
		statLines.push(t('데미지 {dmg}  ·  공속 {rate}/s', { dmg: cfg.damage, rate: cfg.fireRate }));
	} else {
		statLines.push(t('데미지 — · 공속 —'));
	}
	statLines.push(t('공격 대상: {types}', { types: atkText }) + (cfg.splash ? t('  (광역 {n})', { n: cfg.splash }) : ''));

	for (const line of statLines) {
		ctx.fillText(line, 18, cy);
		cy += 17;
	}
	cy += 4;

	// 전직 관계 — 각 항목(전직 전/후보 등)을 한 줄씩
	const lineageLines = describeLineage(role);
	if (lineageLines.length > 0) {
		ctx.fillStyle = '#9ab39a';
		for (const ln of lineageLines) {
			ctx.fillText(ln, 18, cy);
			cy += 17;
		}
	}

	// 상세 설명 (description)
	const desc = cfg.description || [];
	if (desc.length > 0) {
		cy += 4;
		ctx.fillStyle = '#dde';
		ctx.font = '12px sans-serif';
		for (const line of desc) {
			cy = drawWrappedLine(line, 18, cy, LOGICAL_W - 36, 17, '• ');
		}
	} else if (cfg.tagline) {
		cy += 4;
		ctx.fillStyle = '#9ab';
		ctx.font = '11px sans-serif';
		cy = drawWrappedLine(cfg.tagline, 18, cy, LOGICAL_W - 36, 16, '');
	}

	cy += DETAIL_BOTTOM_PAD;
	return cy;
}

function describeLineage(role) {
	// 부모 / 자식 관계 표시
	const parents = [];
	for (const [parentRole, cfg] of Object.entries(TOWER_ROLES)) {
		if ((cfg.promotions || []).includes(role)) parents.push(parentRole);
	}
	const tier4Recipe = TIER4_RECIPES[role];
	const tier4ResultFor = Object.entries(TIER4_RECIPES).find(([r, info]) => info.result === role);

	if (tier4ResultFor) {
		// role이 4티어 결과인 경우 (= role이 합체 결과)
		const [parentA, info] = tier4ResultFor;
		const parentB = info.partner;
		const nameA = TOWER_ROLES[parentA]?.name || parentA;
		const nameB = TOWER_ROLES[parentB]?.name || parentB;
		return [t('합체 레시피: {a} + {b}', { a: nameA, b: nameB })];
	}

	const parts = [];
	if (parents.length > 0) {
		const names = parents.map(r => TOWER_ROLES[r]?.name || r).join(', ');
		parts.push(t('전직 전: {names}', { names }));
	}
	const promotions = TOWER_ROLES[role]?.promotions || [];
	if (promotions.length > 0) {
		const names = promotions.map(r => TOWER_ROLES[r]?.name || r).join(', ');
		parts.push(t('전직 후보: {names}', { names }));
	}
	if (tier4Recipe) {
		const partnerName = TOWER_ROLES[tier4Recipe.partner]?.name || tier4Recipe.partner;
		const resultName = TOWER_ROLES[tier4Recipe.result]?.name || tier4Recipe.result;
		parts.push(t('4티어 합체: + {p} → {r}', { p: partnerName, r: resultName }));
	}
	return parts;
}

// 단순 단어 wrap (한글에선 글자 단위 분할이 자연스러우니 글자 너비 측정 기반)
function drawWrappedLine(text, x, y, maxW, lineH, prefix) {
	const indent = prefix ? ctx.measureText(prefix).width : 0;
	let line = prefix || '';
	let firstLine = true;
	for (const ch of text) {
		const test = line + ch;
		if (ctx.measureText(test).width > maxW && line.length > (prefix ? prefix.length : 0)) {
			ctx.fillText(line, x, y);
			y += lineH;
			line = (firstLine ? ' '.repeat(Math.round(indent / 3)) : '') + ch;
			firstLine = false;
		} else {
			line = test;
		}
	}
	if (line.length > 0) {
		ctx.fillText(line, x, y);
		y += lineH;
	}
	return y;
}

// ============ 본문 항목 탭 검사 ============
function handleContentTap(p) {
	if (p.y < CONTENT_TOP) return;
	let y = CONTENT_TOP - wiki.scroll;

	if (wiki.category === 'tower') {
		for (const group of TOWER_GROUPS) {
			y += GROUP_HEADER_H + 2;
			for (const role of group.roles) {
				const cfg = TOWER_ROLES[role];
				if (!cfg) continue;
				const key = 'tower:' + role;
				const expanded = wiki.expandedKey === key;

				const itemTop = y;
				const itemBottom = y + ITEM_H;
				if (p.y >= itemTop && p.y < itemBottom) {
					playButton();
					wiki.expandedKey = expanded ? null : key;
					return;
				}

				y = itemBottom + ITEM_GAP;
				if (expanded) {
					// 펼친 상세 영역은 탭 무반응 (다음 항목까지 계산 위해 높이 재계산)
					const detailH = measureTowerDetailH(role, cfg);
					y += detailH + ITEM_GAP;
				}
			}
			y += 6;
		}
	} else {
		// enemy 카테고리
		y += GROUP_HEADER_H + 2;
		for (const entry of ENEMY_ENTRIES) {
			const key = 'enemy:' + entry.key;
			const expanded = wiki.expandedKey === key;

			const itemTop = y;
			const itemBottom = y + ITEM_H;
			if (p.y >= itemTop && p.y < itemBottom) {
				playButton();
				wiki.expandedKey = expanded ? null : key;
				return;
			}

			y = itemBottom + ITEM_GAP;
			if (expanded) {
				const detailH = measureEnemyDetailH(entry);
				y += detailH + ITEM_GAP;
			}
		}
	}
}

function measureTowerDetailH(role, cfg) {
	// drawTowerDetail의 cy 계산 흐름과 일치해야 함
	let cy = DETAIL_TOP_PAD;
	cy += 17 * 3 + 4; // stat 3줄
	cy += describeLineage(role).length * 17; // 전직 관계 — 항목당 1줄
	const desc = cfg.description || [];
	if (desc.length > 0) {
		cy += 4;
		cy += desc.length * 17;
	} else if (cfg.tagline) {
		cy += 4 + 16;
	}
	cy += DETAIL_BOTTOM_PAD;
	return cy;
}
