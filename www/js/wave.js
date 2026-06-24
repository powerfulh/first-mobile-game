import { game, saveGame } from './state.js';
import {
	getBaseSpawnInterval, spawnBoss, getEnemiesPerWaveAt,
} from './enemy.js';

// 보스 웨이브 판정 (20웨이브마다). 순수 웨이브 번호 로직 — wave.js에 거주.
export function isBossWave(wave) {
	return wave > 0 && wave % 20 === 0;
}

// 매 웨이브 RNG narrow factor 범위 [min, max]. interval = baseInterval × narrow.
// setupWave / getShieldChance가 공통 사용.
export function getNarrowRange(wave) {
	if (wave < 11) return { min: 1, max: 1 };
	const ramp = Math.min(1, (wave - 10) / 20);
	const extraReduction = Math.min(0.10, Math.max(0, wave - 100) * 0.01);
	const lateMinReduction = Math.min(0.10, Math.max(0, wave - 170) * 0.01);
	const minNarrow = Math.max(0, 1.0 - ramp * 0.6 - extraReduction - lateMinReduction);
	const maxReduction = Math.min(0.10, Math.max(0, wave - 120) * 0.01);
	const lateMaxReduction = Math.min(0.10, Math.max(0, wave - 170) * 0.01);
	const maxNarrow = Math.max(minNarrow, 1.0 - maxReduction - lateMaxReduction);
	return { min: minNarrow, max: maxNarrow };
}

// 동시에 진행 가능한 최대 웨이브 수 (기존 + 추가 웨이브).
export const MAX_CONCURRENT_WAVES = 2;

// 단일 웨이브 스포너 구성 — 스폰 간격/총 적 수/보스 여부 계산.
// 보스 적 자체는 호출자(setupWave)가 spawnBoss로 추가.
export function createSpawner(targetWave) {
	const enemiesPerWave = getEnemiesPerWaveAt(targetWave);
	const boss = isBossWave(targetWave);
	let spawnInterval;
	if (boss) {
		spawnInterval = getBaseSpawnInterval(targetWave) * 2;
	} else {
		spawnInterval = getBaseSpawnInterval(targetWave);
		if (targetWave >= 11) {
			const { min, max } = getNarrowRange(targetWave);
			spawnInterval *= min + Math.random() * (max - min);
		}
	}
	return {
		wave: targetWave,
		spawnInterval,
		spawnTimer: 0,
		spawnedThisWave: 0,
		enemiesPerWave,
		isBoss: boss,
	};
}

// 저장값으로 베이스 스포너 복원 — 간격은 RNG가 섞여 재계산 불가하므로 저장본 그대로 사용.
// loadGame 전용 (새 진행 웨이브는 createSpawner로 계산).
export function restoreBaseSpawner(wave, spawnInterval, enemiesPerWave) {
	return {
		wave,
		spawnInterval,
		spawnTimer: 0,
		spawnedThisWave: 0,
		enemiesPerWave,
		isBoss: isBossWave(wave),
	};
}

// 임의의 wave로 진입 — 일반 진행 + 샌드박스 점프 공용. 병렬 웨이브 초기화.
// saveGame 호출 안 함 (호출자가 결정).
export function setupWave(targetWave) {
	game.wave = targetWave;
	game.waveFrontier = targetWave;
	const sp = createSpawner(targetWave);
	game.waves = [sp];
	game.bossActive = sp.isBoss;
	game.waveState = 'spawning';
	game.waveSpawnCounts = {}; // 새 웨이브 — 출현 요약 초기화

	if (sp.isBoss) spawnBoss();

	// 웨이브별 누적 카운터 리셋
	for (const tower of game.entities.towers) tower.waveDamage = 0;

	// 최고 도달 웨이브 추적 — 다음 판 인터미션 결정에 사용
	if (game.wave > game.bestWaveReached) game.bestWaveReached = game.wave;
}

export function startNextWave() {
	setupWave(game.wave + 1);
	saveGame();
}

// 보스 여부를 뺀 추가 웨이브 호출 전제 — 스폰 중이고 병렬 슬롯이 남았는지
// (진행 중 웨이브가 1개여서 하나 더 부를 여지가 있는지). 완료된 웨이브가 빠지면 다시 열림.
function extraWaveSlotOpen() {
	return game.waveState === 'spawning'
		&& game.waves.length >= 1
		&& game.waves.length < MAX_CONCURRENT_WAVES;
}

// 추가 호출이 보스에 걸리는지 — 현재 보스 웨이브거나 다음 호출 웨이브(frontier+1)가 보스.
function extraWaveHitsBoss() {
	return game.bossActive || isBossWave(game.waveFrontier + 1);
}

// 추가 웨이브 호출 가능 여부 — 슬롯이 열려 있고 보스에 안 걸릴 때. (버튼 활성/비활성 판정)
export function canCallExtraWave() {
	return extraWaveSlotOpen() && !extraWaveHitsBoss();
}

// 비활성 사유가 '보스 웨이브' 인지 — 슬롯은 열렸는데 보스에 걸려서 막힌 경우만.
// (최대 병렬 초과·인터미션 등 다른 사유면 false) 비활성 버튼 탭 시 토스트 안내용.
export function extraWaveBossBlocked() {
	return extraWaveSlotOpen() && extraWaveHitsBoss();
}

// 추가 웨이브 — 진행 중 웨이브를 유지한 채 frontier+1 웨이브를 병렬로 추가.
export function callExtraWave() {
	const next = game.waveFrontier + 1;
	game.waves.push(createSpawner(next));
	game.waveFrontier = next;
	// 새 웨이브 호출 시 타워별 웨이브 누적 데미지 초기화
	for (const tower of game.entities.towers) tower.waveDamage = 0;
}
