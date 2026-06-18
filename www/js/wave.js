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

// 임의의 wave로 진입 — 일반 진행 + 샌드박스 점프 공용.
// saveGame 호출 안 함 (호출자가 결정).
export function setupWave(targetWave) {
  game.wave = targetWave;
  game.enemiesPerWave = getEnemiesPerWaveAt(targetWave);

  if (isBossWave(targetWave)) {
    game.spawnInterval = getBaseSpawnInterval(targetWave) * 2;
    game.bossActive = true;
    spawnBoss();
  } else {
    let interval = getBaseSpawnInterval(targetWave);
    if (targetWave >= 11) {
      const { min: minNarrow, max: maxNarrow } = getNarrowRange(targetWave);
      const narrow = minNarrow + Math.random() * (maxNarrow - minNarrow);
      interval *= narrow;
    }
    game.spawnInterval = interval;
    game.bossActive = false;
  }

  game.spawnedThisWave = 0;
  game.spawnTimer = 0;
  game.waveState = 'spawning';
  game.waveSpawnCounts = {}; // 새 웨이브 — 출현 요약 초기화

  // 웨이브별 누적 카운터 리셋
  for (const tower of game.towers) tower.waveDamage = 0;

  // 최고 도달 웨이브 추적 — 다음 판 인터미션 결정에 사용
  if (game.wave > game.bestWaveReached) game.bestWaveReached = game.wave;
}

export function startNextWave() {
  setupWave(game.wave + 1);
  saveGame();
}
