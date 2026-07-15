// ============ 맵 레지스트리 + 활성 맵 ============
// 맵별 고유 속성(생김새/시작 돈/BGM/특성/웨이브 구성/해금)을 한곳에 모은다.
// 순수 데이터 leaf — 외부 import 없음(순환/계층 무관). 활성 맵은 모듈 내부 상태로 보유하고
// resetGame/loadGame/맵 선택이 setActiveMap으로 바꾼다. 기본값 map1 → 타이틀에서도 path 렌더 유효.
const pathUnit = 8
const bottom = 80
const rightSide = 42 // 길은 다 보이게
const allow1top = 9
const allow1horiz = 7

export const MAPS = {
	map1: {
		id: 'map1',
		name: 'map.map1.name', // i18n 키 — 표시 시 사용처가 t()로 변환
		// 적 이동 경로 (= 맵 생김새). drawPath/거리판정/적 이동·스폰의 단일 출처.
		path: [
			{ x: 8 * pathUnit, y: 0 },
			{ x: 8 * pathUnit, y: 150 },
			{ x: 280, y: 150 },
			{ x: 280, y: 350 },
			{ x: 80, y: 350 },
			{ x: 80, y: 540 },
			{ x: 300, y: 540 },
			{ x: 300, y: 640 },
		],
		startGold: 100,             // 시작 돈 (HP는 전역 INITIAL.hp)
		bgm: 'normal',              // audio 트랙 id — 타이틀과 공용(bgm.mp3)이라 진입 시 끊김 없음
		waveComposition: 'default', // 웨이브 적 구성 전략 id (맵1 = 현재 enemy.js 기본 로직)
		unlock: { type: 'default' },// 해금 조건 (맵1은 기본 제공)
	},
	// 맵2 — 지정 경로: 우상단 진입 → 우측 하강 → 바닥 좌회전 → 중앙 상승 → 상단 좌회전 → 좌측 하강 → 좌중단 탈출.
	map2: {
		id: 'map2',
		name: 'map.map2.name', // i18n 키 — 표시 시 사용처가 t()로 변환
		// 공중 지름길 — 경로의 shortcut 마커에서 다음 마커로 직선 가로지르기 (이동 분기는 updateEnemy).
		// 공중 적만 '처음 만나는 숏컷 탑승 여부'를 스폰 시 교대 등록해 절반씩 이용 (보스 제외).
		// 마커 꼭짓점은 기존 세그먼트 위 공선점이라 정규 이동·그리기에 영향 없음.
		// 규칙상 연속된 어떤 마커 쌍도 비행 구간이 될 수 있으니, 마커 추가 시 모든 인접 쌍의 직선 컷이 자연스러운지 확인.
		path: [
			{ x: 300, y: 0 },
			{ x: 300, y: 400, shortcut: true },
			{ x: 300, y: 580 },
			{ x: 175, y: 580 },
			{ x: 175, y: 400, shortcut: true },
			{ x: 175, y: 65 },
			{ x: 55, y: 65 },
			{ x: 55, y: 385 },
			{ x: 0, y: 385 },
		],
		startGold: 150,
		bgm: 'bgm2',
		// 맵1 기본값에서 아래만 오버라이드 (나머지 미지정은 맵1과 동일).
		waveComposition: {
			airStartWave: 4, airStartChance: 0.04, airChanceStep: 0.016, // 공중 적: wave 4부터, 시작 4% (+1.6%/wave, 상한 50% → wave 33)
			airHpBase: 0.4,    // 공중 HP 비율 시작 0.4 (wave 31부터 +0.02/wave → wave 60에 1.0)
			regenStartWave: 71, regenChanceStep: 0.004, // 재생 적: wave 71부터 0.4% (+0.4%/wave → wave 80에 상한 4%)
			shieldStartCap: 0.4, // 방어막 상한: 81~90 확장 없이 등장(51)부터 1~40% (101~110 → 50%는 공통)
			barrierStartWave: 111, // 장벽 적: wave 111부터 0.4% (+0.4%/wave → wave 120에 상한 4%)
			empStartWave: 161, // 신규 적(emp): wave 161부터 0.4% (+0.4%/wave → wave 170에 상한 4%)

			regenHealRampWave: 120, // 재생 회복률 강화를 wave 121~130으로 (12% → 22%)
			countRampWave: 31, countCapWave: 90, // 적 수 +2→+1 전환 wave 31, 상한 wave 90 → 126마리
			densityFloorWave: 40, // 조밀도 하한 추가 강화를 wave 41~50으로 (minNarrow 0.30 @ wave 50)
			densityCeilWave: 80, // 조밀도 상한 추가 강화를 wave 81~90으로 (maxNarrow 0.90 @ wave 90)
		},
		unlock: { type: 'clearWave', map: 'map1', wave: 201 }, // 1번 맵 200웨이브 돌파(=201 진입) 시 해금
	},
	// 맵3
	map3: {
		id: 'map3',
		name: 'map.map3.name', // i18n 키 — 표시 시 사용처가 t()로 변환
		path: [
			{ x: 38 * pathUnit, y: bottom * pathUnit },
			{ x: 38 * pathUnit, y: allow1top * pathUnit },
			{ x: allow1horiz * pathUnit, y: 12 * pathUnit },
			{ x: allow1horiz * pathUnit, y: 45 * pathUnit },
			{ x: 29 * pathUnit, y: 48 * pathUnit },
			{ x: 29 * pathUnit, y: 70 * pathUnit },
			{ x: 10 * pathUnit, y: 70 * pathUnit },
			{ x: 10 * pathUnit, y: 55 * pathUnit },
			{ x: 0 * pathUnit, y: 55 * pathUnit },
		],
		startGold: 200,
		bgm: 'bgm3',
		waveComposition: {
			spawnIntervalStart: 0.95, spawnIntervalStep: 0.05, // 스폰 간격: wave 1에 0.95초, -0.05/wave → wave 10에 하한 0.5초 도달
			regenStartWave: 21, // 재생 적: wave 21부터 0.2% (+0.2%/wave → wave 40에 상한 4%)
			barrierStartWave: Infinity, // 장벽 적 미출현 (맵3 구성에서 제외)
			empStartWave: 111, // EMP 적: wave 111부터 0.4% (+0.4%/wave → wave 120에 상한 4%)
			transportStartWave: 151, // 수송 적: wave 151부터 0.4% (+0.4%/wave → wave 160에 상한 4%)
			regenBoostWave: 60, // 재생 강화를 wave 61~70으로 — 70에 회복률 22%·출현 8% 도달 (2차 회복 강화는 기본 161~170 → 32%)
			regenChanceBoost2Wave: 90, // 재생 출현 확률 2차 강화: wave 91~100 에 +0.4%/wave → 100에 12% 도달
			densityFloorWave: 70, // 조밀도 하한 추가 강화를 wave 71~80으로 (minNarrow 0.30 @ wave 80)
			countRampWave: 60, countCapWave: 70, // 적 수 +2→+1 전환 wave 60, 고정 wave 70 → 135마리
			densityCeilWave: 100, // 조밀도 상한 추가 강화를 wave 101~110으로 (maxNarrow 0.90 @ wave 110)
		},
		unlock: { type: 'clearWave', map: 'map2', wave: 201 }, // 2번 맵 200웨이브 돌파(=201 진입) 시 해금
	},
	// 맵4 — placeholder: 현재 맵3 복제(경로/시작 돈/BGM/웨이브 구성 동일). 고유 속성은 추후 차별화 예정.
	map4: {
		id: 'map4',
		name: 'map.map4.name', // i18n 키 — 표시 시 사용처가 t()로 변환
		path: [
			{ x: 0 * pathUnit, y: 60 * pathUnit },
			{ x: rightSide * pathUnit, y: 60 * pathUnit },
			{ x: rightSide * pathUnit, y: allow1top * pathUnit },
			{ x: allow1horiz * pathUnit, y: allow1top * pathUnit },
			{ x: allow1horiz * pathUnit, y: 50 * pathUnit },
			{ x: 15 * pathUnit, y: 50 * pathUnit },
			{ x: 20 * pathUnit, y: 45 * pathUnit },
			{ x: 20 * pathUnit, y: (10 + allow1top) * pathUnit },
			{ x: 33 * pathUnit, y: (10 + allow1top) * pathUnit },
			{ x: 33 * pathUnit, y: 50 * pathUnit, underpass: true },
			{ x: 33 * pathUnit, y: 65 * pathUnit, underpass: true },
			{ x: 33 * pathUnit, y: bottom * pathUnit },
		],
		startGold: 200,
		bgm: 'bgm3',
		waveComposition: {
			spawnIntervalStart: 0.95, spawnIntervalStep: 0.05,
			regenStartWave: Infinity, // 재생 적 미출현 (맵4 구성에서 제외)
			barrierStartWave: Infinity,
			empStartWave: 111,
			transportStartWave: 151,
			densityFloorWave: 70,
			countRampWave: 60, countCapWave: 70,
			densityCeilWave: 100,
		},
		unlock: { type: 'clearWave', map: 'map3', wave: 201 }, // 3번 맵 200웨이브 돌파(=201 진입) 시 해금
	},
};

let activeMapId = 'map1';

export function getActiveMap() {
	return MAPS[activeMapId];
}

export function setActiveMap(id) {
	if (MAPS[id]) activeMapId = id;
}
