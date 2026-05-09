const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hpEl = document.getElementById('hp');
const goldEl = document.getElementById('gold');
const waveEl = document.getElementById('wave');
const hudEl = document.getElementById('hud');

const LOGICAL_W = 360;
const LOGICAL_H = 640;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const scale = Math.min(window.innerWidth / LOGICAL_W, window.innerHeight / LOGICAL_H);
  canvas.style.width = (LOGICAL_W * scale) + 'px';
  canvas.style.height = (LOGICAL_H * scale) + 'px';
  canvas.width = Math.floor(LOGICAL_W * scale * dpr);
  canvas.height = Math.floor(LOGICAL_H * scale * dpr);
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function getLogicalPoint(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / rect.width * LOGICAL_W,
    y: (clientY - rect.top) / rect.height * LOGICAL_H,
  };
}

const path = [
  { x: 60, y: 0 },
  { x: 60, y: 150 },
  { x: 280, y: 150 },
  { x: 280, y: 350 },
  { x: 80, y: 350 },
  { x: 80, y: 540 },
  { x: 300, y: 540 },
  { x: 300, y: 640 },
];

// ============ Drawing helpers ============
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawButton(btn, label, pressed) {
  ctx.fillStyle = pressed ? '#922b1f' : '#c0392b';
  roundRect(btn.x, btn.y, btn.w, btn.h, 14);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, btn.x + btn.w / 2, btn.y + btn.h / 2);
  ctx.textBaseline = 'alphabetic';
}

function hitButton(btn, p) {
  return p.x >= btn.x && p.x <= btn.x + btn.w && p.y >= btn.y && p.y <= btn.y + btn.h;
}

function drawPath(alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#8a7a5a';
  ctx.lineWidth = 28;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(path[0].x, path[0].y);
  for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ============ Scene manager ============
const scenes = {};
let currentSceneName = null;

function changeScene(name) {
  currentSceneName = name;
  scenes[name].enter?.();
  hudEl.style.display = (name === 'playing') ? 'flex' : 'none';
}

// ============ Title scene ============
const titleButton = { x: 80, y: 400, w: 200, h: 64 };
let titleAnim = 0;

scenes.title = {
  enter() {
    titleAnim = 0;
  },
  update(dt) {
    titleAnim += dt;
  },
  draw() {
    ctx.fillStyle = '#1a2e1a';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    drawPath(0.25);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillText('TOWER', LOGICAL_W / 2, 200);
    ctx.fillText('DEFENSE', LOGICAL_W / 2, 256);

    ctx.fillStyle = '#9ab39a';
    ctx.font = '13px sans-serif';
    ctx.fillText('OFFLINE EDITION', LOGICAL_W / 2, 286);

    const pulse = 0.5 + 0.5 * Math.sin(titleAnim * 3);
    ctx.globalAlpha = 0.6 + 0.4 * pulse;
    drawButton(titleButton, '게임 시작');
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#666';
    ctx.font = '11px sans-serif';
    ctx.fillText('v0.1', LOGICAL_W / 2, 620);
  },
  pointerDown(p) {
    if (hitButton(titleButton, p)) {
      changeScene('playing');
    }
  },
};

// ============ Playing scene ============
const game = {
  hp: 20,
  gold: 100,
  wave: 1,
  enemies: [],
  spawnTimer: 0,
  spawnInterval: 1.2,
  spawnedThisWave: 0,
  enemiesPerWave: 8,
};

function resetGame() {
  game.hp = 20;
  game.gold = 100;
  game.wave = 1;
  game.enemies = [];
  game.spawnTimer = 0;
  game.spawnedThisWave = 0;
  game.enemiesPerWave = 8;
}

function spawnEnemy() {
  game.enemies.push({
    x: path[0].x,
    y: path[0].y,
    speed: 50,
    segment: 0,
    radius: 10,
    hpMax: 3,
    hp: 3,
  });
}

function updateEnemy(e, dt) {
  if (e.segment >= path.length - 1) {
    game.hp -= 1;
    e.dead = true;
    return;
  }
  const target = path[e.segment + 1];
  const dx = target.x - e.x;
  const dy = target.y - e.y;
  const dist = Math.hypot(dx, dy);
  const move = e.speed * dt;
  if (move >= dist) {
    e.x = target.x;
    e.y = target.y;
    e.segment++;
  } else {
    e.x += (dx / dist) * move;
    e.y += (dy / dist) * move;
  }
}

function drawEnemy(e) {
  ctx.fillStyle = '#c0392b';
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();

  const barW = 20;
  const barH = 3;
  const ratio = e.hp / e.hpMax;
  ctx.fillStyle = '#000';
  ctx.fillRect(e.x - barW / 2, e.y - e.radius - 8, barW, barH);
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(e.x - barW / 2, e.y - e.radius - 8, barW * ratio, barH);
}

function updateHUD() {
  hpEl.textContent = `HP: ${game.hp}`;
  goldEl.textContent = `Gold: ${game.gold}`;
  waveEl.textContent = `Wave: ${game.wave}`;
}

scenes.playing = {
  enter() {
    resetGame();
  },
  update(dt) {
    game.spawnTimer += dt;
    if (game.spawnTimer >= game.spawnInterval && game.spawnedThisWave < game.enemiesPerWave) {
      game.spawnTimer = 0;
      game.spawnedThisWave++;
      spawnEnemy();
    }
    for (const e of game.enemies) updateEnemy(e, dt);
    game.enemies = game.enemies.filter(e => !e.dead);
    updateHUD();
  },
  draw() {
    ctx.fillStyle = '#2d4a2b';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    drawPath();
    for (const e of game.enemies) drawEnemy(e);
  },
  pointerDown(p) {
    // 타워 배치는 다음 단계에서
  },
};

// ============ Input ============
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const p = getLogicalPoint(e.clientX, e.clientY);
  scenes[currentSceneName]?.pointerDown?.(p);
});

// ============ Game loop ============
let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  scenes[currentSceneName]?.update(dt);
  scenes[currentSceneName]?.draw();
  requestAnimationFrame(loop);
}

changeScene('title');
requestAnimationFrame(loop);
