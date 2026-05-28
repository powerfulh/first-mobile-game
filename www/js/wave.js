import { game, saveGame } from './state.js';
import { isBossWave, getBaseSpawnInterval, spawnBoss } from './enemy.js';

export function startNextWave() {
  game.wave++;
  game.enemiesPerWave += game.wave >= 80 ? 0 : game.wave >= 40 ? 1 : 2;

  if (isBossWave(game.wave)) {
    // 보스 웨이브: base interval의 두 배, RNG 미적용
    game.spawnInterval = getBaseSpawnInterval(game.wave) * 2;
    game.bossActive = true;
    spawnBoss();
  } else {
    let interval = getBaseSpawnInterval(game.wave);
    if (game.wave >= 10) {
      const ramp = Math.min(1, (game.wave - 9) / 21);
      const minNarrow = 1.0 - ramp * 0.6;
      const narrow = minNarrow + Math.random() * (1.0 - minNarrow);
      interval *= narrow;
    }
    game.spawnInterval = interval;
    game.bossActive = false;
  }

  game.spawnedThisWave = 0;
  game.spawnTimer = 0;
  game.waveState = 'spawning';
  saveGame();
}
