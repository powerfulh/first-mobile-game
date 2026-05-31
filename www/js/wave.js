import { game, saveGame } from './state.js';
import {
  isBossWave, getBaseSpawnInterval, spawnBoss, getEnemiesPerWaveAt,
} from './enemy.js';

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
      const ramp = Math.min(1, (targetWave - 10) / 20);
      const extraReduction = Math.min(0.10, Math.max(0, targetWave - 100) * 0.01);
      const minNarrow = Math.max(0, 1.0 - ramp * 0.6 - extraReduction);
      const maxReduction = Math.min(0.10, Math.max(0, targetWave - 120) * 0.01);
      const maxNarrow = Math.max(minNarrow, 1.0 - maxReduction);
      const narrow = minNarrow + Math.random() * (maxNarrow - minNarrow);
      interval *= narrow;
    }
    game.spawnInterval = interval;
    game.bossActive = false;
  }

  game.spawnedThisWave = 0;
  game.spawnTimer = 0;
  game.waveState = 'spawning';
}

export function startNextWave() {
  setupWave(game.wave + 1);
  saveGame();
}
