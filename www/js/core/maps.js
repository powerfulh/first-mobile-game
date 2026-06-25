// ============ 맵 레지스트리 + 활성 맵 ============
// 맵별 고유 속성(생김새/시작 돈/BGM/특성/웨이브 구성/해금)을 한곳에 모은다.
// 순수 데이터 leaf — 외부 import 없음(순환/계층 무관). 활성 맵은 모듈 내부 상태로 보유하고
// resetGame/loadGame/맵 선택이 setActiveMap으로 바꾼다. 기본값 map1 → 타이틀에서도 path 렌더 유효.

export const MAPS = {
	map1: {
		id: 'map1',
		name: '맵 1',
		// 적 이동 경로 (= 맵 생김새). drawPath/거리판정/적 이동·스폰의 단일 출처.
		path: [
			{ x: 60, y: 0 },
			{ x: 60, y: 150 },
			{ x: 280, y: 150 },
			{ x: 280, y: 350 },
			{ x: 80, y: 350 },
			{ x: 80, y: 540 },
			{ x: 300, y: 540 },
			{ x: 300, y: 640 },
		],
		startGold: 100,             // 시작 돈 (HP는 전역 INITIAL.hp)
		bgm: 'normal',              // audio 트랙 id — 타이틀과 공용(bgm.mp3)이라 진입 시 끊김 없음
		traits: [],                 // 맵 특성 (맵1 없음; 추후 도메인 코드가 해석)
		waveComposition: 'default', // 웨이브 적 구성 전략 id (맵1 = 현재 enemy.js 기본 로직)
		unlock: { type: 'default' },// 해금 조건 (맵1은 기본 제공)
	},
	// 맵2 (작업 중) — 현재는 맵1 복제 + 경로 좌우 반전. 경로/시작 돈/해금 조건 등 세부는 추후 조정.
	map2: {
		id: 'map2',
		name: '맵 2',
		path: [
			{ x: 300, y: 0 },
			{ x: 300, y: 150 },
			{ x: 80, y: 150 },
			{ x: 80, y: 350 },
			{ x: 280, y: 350 },
			{ x: 280, y: 540 },
			{ x: 60, y: 540 },
			{ x: 60, y: 640 },
		],
		startGold: 100,
		bgm: 'bgm2',
		traits: [],
		waveComposition: 'default',
		unlock: { type: 'default' },
	},
};

let activeMapId = 'map1';

export function getActiveMap() {
	return MAPS[activeMapId];
}

export function getActiveMapId() {
	return activeMapId;
}

export function setActiveMap(id) {
	if (MAPS[id]) activeMapId = id;
}
