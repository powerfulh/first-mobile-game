import { canvas, getLogicalPoint } from './canvas.js';
import { TOWER } from './config.js';
import { game } from './state.js';
import { changeScene, getCurrentScene } from './scenes.js';

// ============ Input ============
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const p = getLogicalPoint(e.clientX, e.clientY);
  getCurrentScene()?.pointerDown?.(p);
});

canvas.addEventListener('pointerup', () => {
  if (game.holdDelete) game.holdDelete = null;
});

canvas.addEventListener('pointermove', (e) => {
  if (game.holdDelete) {
    const p = getLogicalPoint(e.clientX, e.clientY);
    const dt = game.holdDelete.tower;
    if (Math.hypot(p.x - dt.x, p.y - dt.y) > TOWER.radius + 8) {
      game.holdDelete = null;
    }
  }
});

canvas.addEventListener('pointercancel', () => {
  if (game.holdDelete) game.holdDelete = null;
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

// ============ Game loop ============
let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  const scene = getCurrentScene();
  scene?.update(dt);
  scene?.draw();
  requestAnimationFrame(loop);
}

changeScene('title');
requestAnimationFrame(loop);
