import { ctx } from './core/canvas.js';
import { LOGICAL_W, LOGICAL_H, TOWER_ROLES, fusionRecipesWithMaterial, ACCENT_RED, INFO_BLUE, SLATE } from './core/config.js';
import { roundRect, hitButton, clamp } from './core/helpers.js';
import { changeScene } from './scenes.js';
import { drawEnemySprite } from './ui/sprite.js';
import { drawTowerSprite } from './ui/sprite/tower.js';
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

// 타워 트리 그룹 (사용자 결정: 전직 트리별) — TOWER_ROLES에서 파생.
// 루트(기본) / 루트의 전직 후보별 계열(전직 트리 DFS 전위 = 티어 진행 순) / 4·5티어 합체(recipe 길이 2/3).
const TREE_ROOT = 'novice';

function collectTree(role) {
	const roles = [role];
	for (const child of TOWER_ROLES[role].promotions || []) roles.push(...collectTree(child));
	return roles;
}

const TOWER_GROUPS = [
	{ label: TOWER_ROLES[TREE_ROOT].name, roles: [TREE_ROOT] },
	...TOWER_ROLES[TREE_ROOT].promotions.map(root => ({
		label: t('wiki.groupLine', { name: TOWER_ROLES[root].name }),
		roles: collectTree(root),
	})),
	{ label: t('wiki.groupTier4'), roles: Object.keys(TOWER_ROLES).filter(r => TOWER_ROLES[r].recipe?.length === 2) },
	{ label: t('wiki.groupTier5'), roles: Object.keys(TOWER_ROLES).filter(r => TOWER_ROLES[r].recipe?.length === 3) },
];

// 적 명단 (사용자 결정: 일반/공중/재생 3종, 방어막·보스 제외)
// name/tagline/description은 i18n 키 — 아래 변환 루프가 표시 문자열로 바꿈.
const ENEMY_ENTRIES = [
	{
		key: 'ground',
		name: 'enemy.ground.name',
		tagline: 'enemy.ground.tagline',
		description: ['enemy.ground.desc1', 'enemy.ground.desc2', 'enemy.ground.desc3'],
	},
	{
		key: 'air',
		name: 'enemy.air.name',
		tagline: 'enemy.air.tagline',
		description: ['enemy.common.spawnRises', 'enemy.air.desc1', 'enemy.air.desc2'],
	},
	{
		key: 'regen',
		name: 'enemy.regen.name',
		tagline: 'enemy.regen.tagline',
		description: ['enemy.common.spawnRises', 'enemy.regen.desc1', 'enemy.regen.desc2', 'enemy.regen.desc3'],
	},
	{
		key: 'barrierSpawner',
		name: 'enemy.barrierSpawner.name',
		tagline: 'enemy.barrierSpawner.tagline',
		description: [
			'enemy.common.spawnRises',
			'enemy.barrierSpawner.desc1',
			'enemy.barrierSpawner.desc2',
			'enemy.barrierSpawner.desc3',
			'enemy.barrierSpawner.desc4',
		],
	},
	{
		key: 'emp',
		name: 'enemy.emp.name',
		tagline: 'enemy.emp.tagline',
		taglineParams: { map: t('map.map2.name') },
		description: [
			'enemy.common.spawnRises',
			'enemy.emp.desc1',
			'enemy.emp.desc2',
			'enemy.emp.desc3',
		],
	},
	{
		key: 'transport',
		name: 'enemy.transport.name',
		tagline: 'enemy.transport.tagline',
		taglineParams: { map: t('map.map3.name') },
		description: ['enemy.transport.desc1', 'enemy.transport.desc2'],
	},
	{
		key: 'shockDisperser',
		name: 'enemy.shockDisperser.name',
		tagline: 'enemy.shockDisperser.tagline',
		description: ['enemy.shockDisperser.desc1', 'enemy.shockDisperser.desc2', 'enemy.shockDisperser.desc3'],
	},
];

// 위키 표시 텍스트 다국어화 — i18n 키를 정의 직후 1회 표시 문자열로 변환. (타워 텍스트는 config.js에서, 그룹 라벨은 파생 시 변환됨)
for (const e of ENEMY_ENTRIES) {
	e.name = t(e.name);
	if (e.tagline) e.tagline = t(e.tagline, e.taglineParams);
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
	return clamp(v, 0, max);
}

// 특정 타워 항목으로 바로 진입 — 해당 항목을 펼치고 그 위치로 스크롤 (플레잉 정보 카드의 위키 버튼).
// changeScene의 enter()가 상태를 리셋하므로 그 뒤에 목표 상태를 덮어쓴다.
export function openWikiAtTower(role, returnTo) {
	wiki.returnTo = returnTo;
	changeScene('wiki');
	wiki.category = 'tower';
	wiki.expandedKey = 'tower:' + role;
	wiki.scroll = towerScrollOffset(role);
}

// 특정 적 항목으로 바로 진입 — 타워 버전과 동일한 방식 (플레잉 적 정보 카드의 위키 버튼).
export function openWikiAtEnemy(key, returnTo) {
	wiki.returnTo = returnTo;
	changeScene('wiki');
	wiki.category = 'enemy';
	wiki.expandedKey = 'enemy:' + key;
	wiki.scroll = enemyScrollOffset(key);
}

function enemyScrollOffset(targetKey) {
	let y = GROUP_HEADER_H + 2, offset = 0;
	for (const entry of ENEMY_ENTRIES) {
		if (entry.key === targetKey) offset = y;
		y += ITEM_H + ITEM_GAP;
		if (entry.key === targetKey) y += measureEnemyDetailH(entry);
	}
	return clamp(offset, 0, Math.max(0, y + 16 - CONTENT_H));
}

// 대상 항목이 컨텐츠 최상단에 오는 스크롤 값 — handleContentTap과 동일한 레이아웃 순회로 산출.
// 대상만 펼쳐진 상태 기준. 컨텐츠 끝을 넘지 않게 전체 높이(하단 여백 포함)로 클램프.
function towerScrollOffset(targetRole) {
	let y = 0, offset = 0;
	for (const group of TOWER_GROUPS) {
		y += GROUP_HEADER_H + 2;
		for (const role of group.roles) {
			const cfg = TOWER_ROLES[role];
			if (!cfg) continue;
			if (role === targetRole) offset = y;
			y += ITEM_H + ITEM_GAP;
			if (role === targetRole) y += measureTowerDetailH(role, cfg);
		}
		y += 6;
	}
	return clamp(offset, 0, Math.max(0, y + 16 - CONTENT_H));
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

	drawTab(tabTower, t('wiki.tab.tower'), wiki.category === 'tower');
	drawTab(tabEnemy, t('wiki.tab.enemy'), wiki.category === 'enemy');
}

function drawTab(btn, label, active) {
	ctx.fillStyle = active ? ACCENT_RED : SLATE;
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
	y = drawGroupHeader(y, t('wiki.enemyList'));
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

// 위키 아코디언 항목 1줄 (타워·적 공용) — 배경 / 펼침 시 상단 강조선 / 아이콘 / 이름·tagline / ▲▼.
// 펼침 시 detailFn(y)로 상세를 그리고 그 바닥 + 간격을 다음 y로 반환.
function drawAccordionItem(y, { expanded, iconFn, name, tagline, detailFn }) {
	const inView = y + ITEM_H >= CONTENT_TOP && y < CONTENT_BOTTOM;
	if (inView) {
		ctx.fillStyle = expanded ? '#22322a' : '#1c2820';
		ctx.fillRect(0, y, LOGICAL_W, ITEM_H);
		if (expanded) {
			ctx.strokeStyle = INFO_BLUE;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(0, y);
			ctx.lineTo(LOGICAL_W, y);
			ctx.stroke();
		}

		iconFn(28, y + ITEM_H / 2);

		ctx.textAlign = 'left';
		ctx.textBaseline = 'alphabetic';
		ctx.fillStyle = '#fff';
		ctx.font = 'bold 15px sans-serif';
		const nameY = y + ITEM_H / 2 - 3;
		ctx.fillText(name, 54, nameY);
		ctx.fillStyle = '#9ab';
		ctx.font = '11px sans-serif';
		ctx.fillText(tagline || '', 54, nameY + 16);

		ctx.fillStyle = '#6c7';
		ctx.font = '12px sans-serif';
		ctx.textAlign = 'right';
		ctx.textBaseline = 'middle';
		ctx.fillText(expanded ? '▲' : '▼', LOGICAL_W - 14, y + ITEM_H / 2);
		ctx.textBaseline = 'alphabetic';
	}

	let nextY = y + ITEM_H + ITEM_GAP;
	if (expanded) {
		nextY = detailFn(y + ITEM_H) + ITEM_GAP;
	}
	return nextY;
}

function drawEnemyItem(y, entry, expanded) {
	return drawAccordionItem(y, {
		expanded,
		iconFn: (cx, cy) => drawEnemyIcon(entry.key, cx, cy),
		name: entry.name,
		tagline: entry.tagline,
		detailFn: (dy) => drawEnemyDetail(dy, entry),
	});
}

function drawEnemyDetail(y, entry, measure = false) {
	let cy = y + DETAIL_TOP_PAD;

	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = '#dde';
	ctx.font = '12px sans-serif';
	for (const line of entry.description || []) {
		cy = drawWrappedLine(line, 18, cy, LOGICAL_W - 36, 17, '• ', measure);
	}

	cy += DETAIL_BOTTOM_PAD;
	return cy;
}

// 탭 높이는 그리기와 동일 경로(measure 모드)로 산출 → wrap된 줄까지 반영, 손 동기화 제거.
function measureEnemyDetailH(entry) {
	return drawEnemyDetail(0, entry, true);
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
	return drawAccordionItem(y, {
		expanded,
		iconFn: (cx, cy) => drawTowerSprite(cfg, cx, cy),
		name: cfg.name,
		tagline: cfg.tagline,
		detailFn: (dy) => drawTowerDetail(dy, role, cfg),
	});
}

function drawTowerDetail(y, role, cfg, measure = false) {
	let cy = y + DETAIL_TOP_PAD;

	// 스탯
	ctx.textAlign = 'left';
	ctx.textBaseline = 'alphabetic';
	ctx.fillStyle = '#cdd';
	ctx.font = '12px sans-serif';

	const atkLabels = { ground: t('common.ground'), air: t('common.air') };
	const attackTypes = cfg.attackTypes || [];
	const atkText = attackTypes.length > 0
		? attackTypes.map(a => atkLabels[a] || a).join('/')
		: t('common.none');

	const statLines = [];
	statLines.push(t('wiki.range', { range: cfg.range }) + (cfg.minRange ? t('wiki.rangeMin', { min: cfg.minRange }) : ''));
	if (attackTypes.length > 0) {
		statLines.push(t('wiki.dmgRate', { dmg: cfg.damage, rate: cfg.fireRate }));
	} else {
		statLines.push(t('wiki.dmgRateNone'));
	}
	statLines.push(t('panel.targets', { types: atkText })); // 광역 반경은 태그라인에 표기 — 중복 회피

	for (const line of statLines) {
		if (!measure) ctx.fillText(line, 18, cy);
		cy += 17;
	}
	cy += 4;

	// 전직 관계 — 각 항목(전직 전/후보 등)을 한 줄씩
	const lineageLines = describeLineage(role);
	if (lineageLines.length > 0) {
		ctx.fillStyle = '#9ab39a';
		for (const ln of lineageLines) {
			if (!measure) ctx.fillText(ln, 18, cy);
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
			cy = drawWrappedLine(line, 18, cy, LOGICAL_W - 36, 17, '• ', measure);
		}
	} else if (cfg.tagline) {
		cy += 4;
		ctx.fillStyle = '#9ab';
		ctx.font = '11px sans-serif';
		cy = drawWrappedLine(cfg.tagline, 18, cy, LOGICAL_W - 36, 16, '', measure);
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
	const fusionUses = fusionRecipesWithMaterial(role);
	const recipe = TOWER_ROLES[role]?.recipe;

	if (recipe) {
		// role이 합체 결과인 경우 — 재료 전체(2종/3종) 표시
		const names = recipe.map(r => TOWER_ROLES[r]?.name || r).join(' + ');
		return [t('wiki.recipe', { names })];
	}

	const parts = [];
	if (parents.length > 0) {
		const names = parents.map(r => TOWER_ROLES[r]?.name || r).join(', ');
		parts.push(t('wiki.promoFrom', { names }));
	}
	const promotions = TOWER_ROLES[role]?.promotions || [];
	if (promotions.length > 0) {
		const names = promotions.map(r => TOWER_ROLES[r]?.name || r).join(', ');
		parts.push(t('wiki.promoTo', { names }));
	}
	for (const use of fusionUses) {
		const partnerName = TOWER_ROLES[use.others[0]]?.name || use.others[0];
		const resultName = TOWER_ROLES[use.result]?.name || use.result;
		parts.push(t('wiki.tier4Fusion', { p: partnerName, r: resultName }));
	}
	return parts;
}

// 단순 단어 wrap (한글에선 글자 단위 분할이 자연스러우니 글자 너비 측정 기반)
// measure=true면 칠하지 않고 줄바꿈 높이만 누적 → 탭 히트 영역 계산이 실제 그림과 일치.
function drawWrappedLine(text, x, y, maxW, lineH, prefix, measure = false) {
	const indent = prefix ? ctx.measureText(prefix).width : 0;
	let line = prefix || '';
	let firstLine = true;
	for (const ch of text) {
		const test = line + ch;
		if (ctx.measureText(test).width > maxW && line.length > (prefix ? prefix.length : 0)) {
			if (!measure) ctx.fillText(line, x, y);
			y += lineH;
			line = (firstLine ? ' '.repeat(Math.round(indent / 3)) : '') + ch;
			firstLine = false;
		} else {
			line = test;
		}
	}
	if (line.length > 0) {
		if (!measure) ctx.fillText(line, x, y);
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
					// drawAccordionItem과 동일: 헤더 바닥 + 상세 높이 + 간격(1회)
					y = itemBottom + measureTowerDetailH(role, cfg) + ITEM_GAP;
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
				// drawAccordionItem과 동일: 헤더 바닥 + 상세 높이 + 간격(1회)
				y = itemBottom + measureEnemyDetailH(entry) + ITEM_GAP;
			}
		}
	}
}

// 탭 높이는 그리기와 동일 경로(measure 모드)로 산출 → wrap된 줄까지 반영, 손 동기화 제거.
function measureTowerDetailH(role, cfg) {
	return drawTowerDetail(0, role, cfg, true);
}
