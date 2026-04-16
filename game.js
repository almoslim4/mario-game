(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const overlayButton = document.getElementById("overlayButton");
  const toast = document.getElementById("toast");
  const hudWorld = document.getElementById("hudWorld");
  const hudCoins = document.getElementById("hudCoins");
  const hudGems = document.getElementById("hudGems");
  const hudHearts = document.getElementById("hudHearts");
  const hudTime = document.getElementById("hudTime");
  const hudFlow = document.getElementById("hudFlow");

  const { levels: levelDefs, sprites } = window.PIPEBOUND_LEVELS;
  const TILE = 48;
  const SPRITE = 32;
  const GRAVITY = 2150;
  const FRICTION = 0.83;
  const AIR_FRICTION = 0.985;
  const MAX_DT = 1 / 30;
  const SOLIDS = new Set(["#", "B", "?", "U"]);
  const HAZARDS = new Set(["^", "~"]);

  const atlas = new Image();
  let atlasReady = false;
  atlas.addEventListener("load", () => {
    atlasReady = true;
  });
  atlas.src = "assets/sprites.svg";

  const state = {
    mode: "menu",
    levelIndex: 0,
    level: null,
    player: null,
    camera: { x: 0, y: 0 },
    keys: new Set(),
    input: { left: false, right: false, jump: false, dash: false, jumpPressed: false, dashPressed: false },
    touch: { left: false, right: false, jump: false, dash: false },
    coins: 0,
    gems: 0,
    totalGems: 0,
    hearts: 3,
    score: 0,
    combo: 0,
    flow: 0,
    flowTimer: 0,
    elapsed: 0,
    best: Number(localStorage.getItem("pipebound-best") || 0),
    lastTime: 0,
    shake: 0,
    shakePower: 0,
    audio: null,
    muted: false,
    supportTipShown: false,
    toastTimer: 0,
    particles: [],
    floaters: [],
    clouds: [],
    weather: []
  };

  class Level {
    constructor(def) {
      this.def = def;
      this.name = def.name;
      this.theme = def.theme;
      this.width = def.map[0].length;
      this.height = def.map.length;
      this.tiles = def.map.map((row) => row.split(""));
      this.entities = [];
      this.platforms = [];
      this.rings = [];
      this.checkpoints = [];
      this.coins = [];
      this.powerups = [];
      this.gems = [];
      this.gate = { x: 0, y: 0, w: 42, h: 60 };
      this.spawn = { x: TILE * 2, y: TILE * 4 };
      this.time = 0;
      this.parse();
    }

    parse() {
      for (let y = 0; y < this.height; y += 1) {
        for (let x = 0; x < this.width; x += 1) {
          const cell = this.tiles[y][x];
          const px = x * TILE;
          const py = y * TILE;
          if (cell === "S") {
            this.spawn = { x: px, y: py - 8 };
            this.tiles[y][x] = ".";
          } else if (cell === "o") {
            this.coins.push(makePickup("coin", px + 12, py + 10));
            this.tiles[y][x] = ".";
          } else if (cell === "C") {
            this.gems.push(makePickup("gem", px + 8, py + 6));
            this.tiles[y][x] = ".";
          } else if (cell === "D") {
            this.powerups.push(makePickup("dash", px + 8, py + 8));
            this.tiles[y][x] = ".";
          } else if (cell === "J" || cell === "F") {
            this.powerups.push(makePickup("feather", px + 8, py + 8));
            this.tiles[y][x] = ".";
          } else if (cell === "H") {
            this.powerups.push(makePickup("heart", px + 8, py + 8));
            this.tiles[y][x] = ".";
          } else if (cell === "N") {
            this.powerups.push(makePickup("magnet", px + 8, py + 8));
            this.tiles[y][x] = ".";
          } else if (cell === "b" || cell === "h" || cell === "f" || cell === "s") {
            const kind = { b: "beetle", h: "hopper", f: "flutter", s: "spark" }[cell];
            this.entities.push(makeEnemy(kind, px + 6, py + 8));
            this.tiles[y][x] = ".";
          } else if (cell === "M" || cell === "V") {
            this.platforms.push(makePlatform(px, py + 18, cell === "M" ? "x" : "y"));
            this.tiles[y][x] = ".";
          } else if (cell === "R") {
            this.rings.push(makeRing(px + 6, py + 6));
            this.tiles[y][x] = ".";
          } else if (cell === "K") {
            this.checkpoints.push(makeCheckpoint(px + 5, py + 2));
            this.tiles[y][x] = ".";
          } else if (cell === "G") {
            this.gate = { x: px + 2, y: py - 12, w: 42, h: 60 };
            this.tiles[y][x] = ".";
          }
        }
      }
    }

    tile(tx, ty) {
      if (ty < 0) return ".";
      if (tx < 0 || tx >= this.width || ty >= this.height) return "#";
      return this.tiles[ty][tx];
    }

    setTile(tx, ty, value) {
      if (tx >= 0 && tx < this.width && ty >= 0 && ty < this.height) this.tiles[ty][tx] = value;
    }

    isSolid(tx, ty) {
      return SOLIDS.has(this.tile(tx, ty));
    }

    isHazard(tx, ty) {
      return HAZARDS.has(this.tile(tx, ty));
    }
  }

  function makePickup(kind, x, y) {
    return {
      kind,
      x,
      y,
      w: kind === "coin" ? 24 : 32,
      h: kind === "coin" ? 30 : 32,
      alive: true,
      t: Math.random() * 7,
      vx: 0,
      vy: 0,
      magneted: false
    };
  }

  function makeEnemy(kind, x, y) {
    const stats = {
      beetle: { w: 36, h: 26, speed: 74 },
      hopper: { w: 36, h: 36, speed: 42 },
      flutter: { w: 34, h: 30, speed: 58 },
      spark: { w: 28, h: 28, speed: 92 }
    }[kind];
    return {
      kind,
      x,
      y,
      w: stats.w,
      h: stats.h,
      vx: Math.random() > 0.5 ? stats.speed : -stats.speed,
      vy: 0,
      baseY: y,
      alive: true,
      onGround: false,
      facing: 1,
      t: Math.random() * 2
    };
  }

  function makePlatform(x, y, axis) {
    return {
      x,
      y,
      baseX: x,
      baseY: y,
      prevX: x,
      prevY: y,
      w: TILE * 2,
      h: 16,
      axis,
      range: axis === "x" ? TILE * 3 : TILE * 2.4,
      speed: axis === "x" ? 1.35 : 1.75,
      t: Math.random() * Math.PI * 2
    };
  }

  function makeRing(x, y) {
    return { x, y, w: 36, h: 36, cooldown: 0, pulse: Math.random() * 4 };
  }

  function makeCheckpoint(x, y) {
    return { x, y, w: 38, h: 46, active: false, pulse: Math.random() * 4 };
  }

  function makePlayer(x, y) {
    return {
      x,
      y,
      prevY: y,
      w: 32,
      h: 44,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: false,
      coyote: 0,
      jumpBuffer: 0,
      canDouble: false,
      doubleReady: false,
      canDash: false,
      dashReady: false,
      dashTimer: 0,
      dashCooldown: 0,
      magnetTimer: 0,
      invuln: 0,
      checkpoint: { x, y },
      runFrame: 0
    };
  }

  function initLevel(index) {
    state.levelIndex = index;
    state.level = new Level(levelDefs[index]);
    state.player = makePlayer(state.level.spawn.x, state.level.spawn.y - 40);
    state.gems = 0;
    state.totalGems = state.level.gems.length;
    state.combo = 0;
    state.flow = 0;
    state.flowTimer = 0;
    state.elapsed = 0;
    state.camera.x = 0;
    state.camera.y = 0;
    state.particles.length = 0;
    state.floaters.length = 0;
    state.weather.length = 0;
    state.shake = 0;
    state.shakePower = 0;
    buildAtmosphere();
    updateHud();
    if (state.mode === "playing") showToast(state.level.def.tip, 4200);
  }

  function startGame() {
    ensureAudio();
    state.mode = "playing";
    state.coins = 0;
    state.score = 0;
    state.hearts = 3;
    initLevel(0);
    overlay.classList.add("hidden");
    state.lastTime = performance.now();
  }

  function nextLevel() {
    if (state.levelIndex >= levelDefs.length - 1) {
      finishGame();
      return;
    }
    state.mode = "playing";
    initLevel(state.levelIndex + 1);
    overlay.classList.add("hidden");
  }

  function finishGame() {
    state.mode = "win";
    const finalScore = state.score + state.coins * 25 + state.hearts * 500;
    state.score = finalScore;
    if (finalScore > state.best) {
      state.best = finalScore;
      localStorage.setItem("pipebound-best", String(finalScore));
    }
    showOverlay("Cloudworks saved", `Final score: ${finalScore.toLocaleString()}. Best: ${state.best.toLocaleString()}. Pip earned a hot cocoa and one deeply unnecessary victory lap.`, "Play again");
    play("win");
  }

  function gameOver() {
    state.mode = "gameOver";
    showOverlay("Run fizzled", `Score: ${state.score.toLocaleString()}. Best: ${state.best.toLocaleString()}. Pip is already tying the shoes again.`, "Retry");
  }

  function showOverlay(title, text, button) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlayButton.textContent = button;
    overlay.classList.remove("hidden");
  }

  function showToast(text, duration = 1800) {
    toast.textContent = text;
    toast.classList.add("show");
    state.toastTimer = duration / 1000;
  }

  function buildAtmosphere() {
    state.clouds = Array.from({ length: 18 }, (_, i) => ({
      x: i * 360 + Math.random() * 220,
      y: 55 + Math.random() * 250,
      s: 0.8 + Math.random() * 1.5,
      v: 5 + Math.random() * 16
    }));
    const count = state.level.theme.weather === "ember" ? 90 : 64;
    state.weather = Array.from({ length: count }, () => makeWeatherParticle());
  }

  function makeWeatherParticle() {
    const weather = state.level?.theme.weather || "pollen";
    return {
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: weather === "ember" ? -20 + Math.random() * 34 : -8 + Math.random() * 16,
      vy: weather === "glow" ? 16 + Math.random() * 22 : 30 + Math.random() * 70,
      r: weather === "ember" ? 1 + Math.random() * 3 : 1 + Math.random() * 2,
      t: Math.random() * 10
    };
  }

  function ensureAudio() {
    if (state.audio || state.muted) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const audioCtx = new AudioContext();
    const gain = audioCtx.createGain();
    gain.gain.value = 0.055;
    gain.connect(audioCtx.destination);
    state.audio = { ctx: audioCtx, gain };
  }

  function play(kind) {
    if (!state.audio) return;
    const audioCtx = state.audio.ctx;
    if (audioCtx.state === "suspended") audioCtx.resume();
    const tones = {
      jump: [330, 520, 0.1, "square"],
      coin: [880, 1320, 0.12, "triangle"],
      gem: [660, 990, 0.22, "sine"],
      stomp: [180, 90, 0.1, "sawtooth"],
      hurt: [180, 110, 0.18, "square"],
      power: [440, 880, 0.2, "triangle"],
      dash: [240, 540, 0.1, "sawtooth"],
      block: [260, 390, 0.1, "square"],
      gate: [440, 660, 0.3, "triangle"],
      win: [520, 1040, 0.5, "sine"],
      bounce: [300, 780, 0.13, "triangle"],
      ring: [520, 920, 0.16, "sine"],
      checkpoint: [392, 660, 0.18, "triangle"],
      magnet: [220, 880, 0.22, "sine"]
    }[kind];
    if (!tones) return;
    const [from, to, duration, type] = tones;
    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    const now = audioCtx.currentTime;
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), now + duration);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(0.8, now + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp);
    amp.connect(state.audio.gain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function update(dt) {
    if (state.mode !== "playing") {
      updateAtmosphere(dt);
      return;
    }
    const level = state.level;
    const player = state.player;
    level.time += dt;
    state.elapsed += dt;
    updateInput();
    updateToast(dt);
    updateFlow(dt);
    updateAtmosphere(dt);
    updatePlatforms(level, dt);
    updateGizmos(level, dt);
    updatePlayer(player, level, dt);
    updateEnemies(level, dt);
    updatePickups(level, dt);
    updateParticles(dt);
    updateFloaters(dt);
    updateCamera(dt);
    updateHud();
    if (state.shake > 0) state.shake -= dt;
    state.input.jumpPressed = false;
    state.input.dashPressed = false;
  }

  function updateToast(dt) {
    if (state.toastTimer > 0) {
      state.toastTimer -= dt;
      if (state.toastTimer <= 0) toast.classList.remove("show");
    }
  }

  function updateInput() {
    const keys = state.keys;
    state.input.left = keys.has("arrowleft") || keys.has("a") || state.touch.left;
    state.input.right = keys.has("arrowright") || keys.has("d") || state.touch.right;
    state.input.jump = keys.has("arrowup") || keys.has("w") || keys.has(" ") || state.touch.jump;
    state.input.dash = keys.has("shift") || keys.has("k") || state.touch.dash;
  }

  function updateFlow(dt) {
    if (state.flowTimer > 0) state.flowTimer -= dt;
    else state.flow = Math.max(0, state.flow - 18 * dt);
  }

  function flowMultiplier() {
    if (state.flow >= 85) return 3;
    if (state.flow >= 55) return 2;
    if (state.flow >= 22) return 1.5;
    return 1;
  }

  function addScore(points) {
    state.score += Math.round(points * flowMultiplier());
  }

  function addFlow(amount, label, x, y, color = "#ffc93c") {
    state.flow = clamp(state.flow + amount, 0, 100);
    state.flowTimer = Math.max(state.flowTimer, 3.6);
    if (label) spawnFloater(x, y, label, color);
    if (state.flow >= 85) spawnBurst(x, y, "#ffc93c", 5, 120);
  }

  function updatePlayer(player, level, dt) {
    if (player.invuln > 0) player.invuln -= dt;
    if (player.dashCooldown > 0) player.dashCooldown -= dt;
    if (player.magnetTimer > 0) player.magnetTimer -= dt;
    if (player.jumpBuffer > 0) player.jumpBuffer -= dt;
    if (player.coyote > 0) player.coyote -= dt;
    if (state.input.jumpPressed) player.jumpBuffer = 0.12;

    const move = Number(state.input.right) - Number(state.input.left);
    if (move !== 0) player.facing = move;
    if (player.dashTimer > 0) {
      player.dashTimer -= dt;
      player.vy *= 0.84;
    } else {
      const accel = player.onGround ? 2650 : 1750;
      const topSpeed = player.canDash ? 390 : 330;
      player.vx += move * accel * dt;
      if (Math.abs(player.vx) > topSpeed) player.vx = topSpeed * Math.sign(player.vx);
      player.vy += GRAVITY * dt;
    }
    if (move === 0) {
      player.vx *= player.onGround ? FRICTION : AIR_FRICTION;
      if (Math.abs(player.vx) < 5) player.vx = 0;
    }
    if (player.canDash && state.input.dashPressed && player.dashCooldown <= 0 && player.dashReady) {
      player.dashReady = false;
      player.dashCooldown = 0.52;
      player.dashTimer = 0.16;
      player.vx = player.facing * 760;
      player.vy = Math.min(player.vy, -80);
      spawnBurst(player.x + player.w / 2, player.y + player.h / 2, "#ff8a47", 16, 260);
      shake(0.11, 6);
      play("dash");
    }

    const canGroundJump = player.onGround || player.coyote > 0;
    if (player.jumpBuffer > 0 && (canGroundJump || player.doubleReady)) {
      if (canGroundJump) {
        player.vy = -710;
        player.onGround = false;
        player.coyote = 0;
        player.doubleReady = player.canDouble;
        spawnBurst(player.x + player.w / 2, player.y + player.h, "#fff8ef", 10, 130);
      } else {
        player.vy = -650;
        player.doubleReady = false;
        spawnBurst(player.x + player.w / 2, player.y + player.h / 2, "#7bdff2", 18, 190);
      }
      player.jumpBuffer = 0;
      play("jump");
    }
    if (!state.input.jump && player.vy < -190) player.vy += GRAVITY * 1.4 * dt;

    const wasGrounded = player.onGround;
    player.prevY = player.y;
    moveActor(player, level, dt, true);
    carryByPlatforms(player, level);
    if (player.onGround) {
      player.coyote = 0.09;
      player.doubleReady = player.canDouble;
      player.dashReady = player.canDash;
      if (!wasGrounded && player.vy >= 0) spawnBurst(player.x + player.w / 2, player.y + player.h, "#d5fff8", 8, 80);
    }
    player.runFrame += Math.abs(player.vx) * dt * 0.025;
    checkGizmos(player, level);
    checkHazards(player, level);
    checkEnemyContact(player, level);
    checkGate(player, level);
    if (player.y > level.height * TILE + 200) hurtPlayer("fall");
  }

  function updatePlatforms(level, dt) {
    for (const platform of level.platforms) {
      platform.prevX = platform.x;
      platform.prevY = platform.y;
      platform.t += dt * platform.speed;
      const sway = Math.sin(platform.t) * platform.range;
      if (platform.axis === "x") platform.x = platform.baseX + sway;
      else platform.y = platform.baseY + sway;
    }
  }

  function updateGizmos(level, dt) {
    for (const ring of level.rings) {
      ring.pulse += dt;
      if (ring.cooldown > 0) ring.cooldown -= dt;
    }
    for (const checkpoint of level.checkpoints) checkpoint.pulse += dt;
  }

  function carryByPlatforms(player, level) {
    for (const platform of level.platforms) {
      const wasAbove = player.y + player.h <= platform.prevY + 8;
      const closeY = player.y + player.h >= platform.y - 6 && player.y + player.h <= platform.y + platform.h + 12;
      const overlapX = player.x + player.w > platform.x && player.x < platform.x + platform.w;
      if (wasAbove && closeY && overlapX && player.vy >= 0) {
        player.y = platform.y - player.h;
        player.vy = 0;
        player.onGround = true;
        player.x += platform.x - platform.prevX;
        player.y += platform.y - platform.prevY;
      }
    }
  }

  function checkGizmos(player, level) {
    checkBouncePads(player, level);
    for (const ring of level.rings) {
      if (ring.cooldown > 0 || !rectsOverlap(player, ring)) continue;
      ring.cooldown = 0.8;
      const dir = player.facing || 1;
      player.vx = dir * Math.max(850, Math.abs(player.vx) + 280);
      player.vy = Math.min(player.vy, -330);
      player.dashTimer = 0.11;
      player.dashCooldown = 0.08;
      player.dashReady = true;
      player.doubleReady = true;
      addFlow(14, "RING BOOST", ring.x + ring.w / 2, ring.y, "#7bdff2");
      spawnBurst(ring.x + ring.w / 2, ring.y + ring.h / 2, "#7bdff2", 28, 290);
      shake(0.12, 6);
      play("ring");
    }

    for (const checkpoint of level.checkpoints) {
      if (checkpoint.active || !rectsOverlap(player, checkpoint)) continue;
      for (const other of level.checkpoints) other.active = false;
      checkpoint.active = true;
      player.checkpoint = { x: checkpoint.x - 2, y: checkpoint.y - player.h + 5 };
      addFlow(8, "CHECKPOINT", checkpoint.x + checkpoint.w / 2, checkpoint.y, "#3bb273");
      spawnBurst(checkpoint.x + checkpoint.w / 2, checkpoint.y + checkpoint.h / 2, "#3bb273", 18, 170);
      showToast("Checkpoint lit. Riskier routes are fair game.", 1400);
      play("checkpoint");
    }
  }

  function checkBouncePads(player, level) {
    if (player.vy < 0) return;
    const tx0 = Math.floor((player.x + 4) / TILE);
    const tx1 = Math.floor((player.x + player.w - 5) / TILE);
    const foot = player.y + player.h;
    const prevFoot = player.prevY + player.h;
    const ty0 = Math.floor((foot - 1) / TILE) - 1;
    const ty1 = Math.floor((foot - 1) / TILE) + 1;
    for (let ty = ty0; ty <= ty1; ty += 1) {
      for (let tx = tx0; tx <= tx1; tx += 1) {
        if (level.tile(tx, ty) !== "T") continue;
        const padY = ty * TILE + 8;
        const crossed = prevFoot <= padY + 12 && foot >= padY;
        if (!crossed) continue;
        player.y = padY - player.h;
        player.vy = -930;
        player.onGround = false;
        player.coyote = 0;
        player.doubleReady = true;
        player.dashReady = player.canDash;
        addFlow(12, "BOING", tx * TILE + TILE / 2, ty * TILE, "#f05d4f");
        spawnBurst(tx * TILE + TILE / 2, padY + 10, "#f05d4f", 24, 260);
        shake(0.12, 7);
        play("bounce");
        return;
      }
    }
  }

  function updateEnemies(level, dt) {
    for (const enemy of level.entities) {
      if (!enemy.alive) continue;
      enemy.t += dt;
      if (enemy.kind === "flutter") {
        enemy.x += enemy.vx * dt;
        enemy.y = enemy.baseY + Math.sin(enemy.t * 2.4) * 28;
        const txAhead = Math.floor((enemy.x + (enemy.vx > 0 ? enemy.w + 6 : -6)) / TILE);
        const ty = Math.floor((enemy.y + enemy.h / 2) / TILE);
        if (level.isSolid(txAhead, ty) || enemy.x < TILE || enemy.x > level.width * TILE - TILE * 2) enemy.vx *= -1;
      } else if (enemy.kind === "spark") {
        enemy.vy += Math.sin(enemy.t * 5) * 12 * dt;
        enemy.vx += Math.cos(enemy.t * 3) * 8 * dt;
        moveActor(enemy, level, dt, false);
        if (Math.random() < 0.12) spawnParticle(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, "#ffc93c", 1, -40, -120, 0.35);
      } else {
        if (enemy.kind === "hopper" && enemy.onGround && enemy.t > 1.15) {
          enemy.vy = -610;
          enemy.vx = Math.sign(enemy.vx || -1) * (70 + Math.random() * 70);
          enemy.t = 0;
        }
        enemy.vy += GRAVITY * dt;
        moveActor(enemy, level, dt, false);
      }
      enemy.facing = enemy.vx >= 0 ? 1 : -1;
      if (enemy.y > level.height * TILE + 200) enemy.alive = false;
    }
  }

  function updatePickups(level, dt) {
    const player = state.player;
    for (const group of [level.coins, level.gems, level.powerups]) {
      for (const item of group) {
        if (!item.alive) continue;
        item.t += dt;
        item.magneted = false;
        const canMagnet = player.magnetTimer > 0 && (item.kind === "coin" || item.kind === "gem");
        if (canMagnet) {
          const px = player.x + player.w / 2;
          const py = player.y + player.h / 2;
          const ix = item.x + item.w / 2;
          const iy = item.y + item.h / 2;
          const dx = px - ix;
          const dy = py - iy;
          const distance = Math.hypot(dx, dy);
          if (distance < 330 && distance > 1) {
            item.magneted = true;
            const pull = item.kind === "gem" ? 2200 : 1600;
            item.vx += (dx / distance) * pull * dt;
            item.vy += (dy / distance) * pull * dt;
            item.vx *= 0.9;
            item.vy *= 0.9;
            item.x += item.vx * dt;
            item.y += item.vy * dt;
          }
        }
        if (!item.magneted && item.vy !== 0) {
          item.vy += GRAVITY * 0.7 * dt;
          item.y += item.vy * dt;
          item.x += item.vx * dt;
        }
        if (rectsOverlap(player, item)) collect(item);
      }
    }
  }

  function collect(item) {
    item.alive = false;
    const cx = item.x + item.w / 2;
    const cy = item.y + item.h / 2;
    if (item.kind === "coin") {
      state.coins += 1;
      addScore(100);
      if (!state.player.onGround || state.flowTimer > 0) addFlow(2, null, cx, cy);
      spawnBurst(cx, cy, "#ffc93c", 9, 150);
      play("coin");
    } else if (item.kind === "gem") {
      state.gems += 1;
      addScore(750);
      addFlow(22, "SKY GEM", cx, cy, "#7bdff2");
      spawnBurst(cx, cy, "#7bdff2", 20, 220);
      showToast(`Sky gem ${state.gems}/${state.totalGems}`, 1300);
      play("gem");
    } else if (item.kind === "dash") {
      state.player.canDash = true;
      state.player.dashReady = true;
      addScore(500);
      addFlow(10, "DASH READY", cx, cy, "#ff8a47");
      spawnBurst(cx, cy, "#ff8a47", 20, 240);
      showToast("Dash pepper unlocked. Shift or K launches Pip forward.", 2300);
      play("power");
    } else if (item.kind === "feather") {
      state.player.canDouble = true;
      state.player.doubleReady = true;
      addScore(500);
      addFlow(10, "DOUBLE JUMP", cx, cy, "#7bdff2");
      spawnBurst(cx, cy, "#7bdff2", 20, 240);
      showToast("Cloud feather unlocked. Jump again in the air.", 2300);
      play("power");
    } else if (item.kind === "heart") {
      state.hearts = Math.min(5, state.hearts + 1);
      addScore(250);
      spawnBurst(cx, cy, "#f05d4f", 16, 180);
      showToast("Heart restored.", 1100);
      play("power");
    } else if (item.kind === "magnet") {
      state.player.magnetTimer = 14;
      addScore(450);
      addFlow(12, "MAGNET CHARM", cx, cy, "#ffc93c");
      spawnBurst(cx, cy, "#ffc93c", 24, 230);
      showToast("Magnet charm humming. Coins and gems lean toward you.", 2300);
      play("magnet");
    }
  }

  function moveActor(actor, level, dt, isPlayer) {
    actor.x += actor.vx * dt;
    resolveTileCollisions(actor, level, "x", isPlayer);
    actor.y += actor.vy * dt;
    actor.onGround = false;
    resolveTileCollisions(actor, level, "y", isPlayer);
  }

  function resolveTileCollisions(actor, level, axis, isPlayer) {
    const left = Math.floor(actor.x / TILE);
    const right = Math.floor((actor.x + actor.w - 1) / TILE);
    const top = Math.floor(actor.y / TILE);
    const bottom = Math.floor((actor.y + actor.h - 1) / TILE);
    for (let ty = top; ty <= bottom; ty += 1) {
      for (let tx = left; tx <= right; tx += 1) {
        if (!level.isSolid(tx, ty)) continue;
        const tileRect = { x: tx * TILE, y: ty * TILE, w: TILE, h: TILE };
        if (!rectsOverlap(actor, tileRect)) continue;
        if (axis === "x") {
          if (actor.vx > 0) actor.x = tileRect.x - actor.w;
          if (actor.vx < 0) actor.x = tileRect.x + tileRect.w;
          if (!isPlayer) actor.vx *= -1;
          else actor.vx = 0;
        } else if (actor.vy > 0) {
          actor.y = tileRect.y - actor.h;
          actor.vy = 0;
          actor.onGround = true;
        } else if (actor.vy < 0) {
          actor.y = tileRect.y + tileRect.h;
          actor.vy = 0;
          if (isPlayer) bumpBlock(tx, ty);
        }
      }
    }
  }

  function bumpBlock(tx, ty) {
    const tile = state.level.tile(tx, ty);
    if (state.level.tile(tx, ty - 1) === "?") {
      openPrizeBlock(tx, ty - 1, "support");
      spawnBurst(tx * TILE + TILE / 2, ty * TILE + 12, "#fff8ef", 8, 90);
      return;
    }
    if (tile !== "?" && tile !== "B") return;
    const px = tx * TILE + TILE / 2;
    const py = ty * TILE;
    play("block");
    shake(0.08, 4);
    spawnBurst(px, py + 8, tile === "?" ? "#ffc93c" : "#ff8a47", 12, 110);
    if (tile === "?") {
      openPrizeBlock(tx, ty);
    } else if (tile === "B" && Math.abs(state.player.vx) > 520) {
      state.level.setTile(tx, ty, ".");
      addScore(50);
      addFlow(4, "BRICK BREAK", px, py, "#ff8a47");
    }
  }

  function openPrizeBlock(tx, ty, source = "direct") {
    if (state.level.tile(tx, ty) !== "?") return;
    const px = tx * TILE + TILE / 2;
    const py = ty * TILE;
    play("block");
    shake(0.08, 4);
    spawnBurst(px, py + 8, "#ffc93c", 14, 125);
    state.level.setTile(tx, ty, "U");
    const roll = (tx * 7 + ty * 11 + state.levelIndex) % 5;
    if (roll === 0) state.level.powerups.push(makePickup("heart", tx * TILE + 8, ty * TILE - 32));
    else if (roll === 1 && !state.player.canDash) state.level.powerups.push(makePickup("dash", tx * TILE + 8, ty * TILE - 32));
    else if (roll === 2 && !state.player.canDouble) state.level.powerups.push(makePickup("feather", tx * TILE + 8, ty * TILE - 32));
    else {
      const coin = makePickup("coin", tx * TILE + 12, ty * TILE - 30);
      coin.vy = -290;
      state.level.coins.push(coin);
    }
    if (source === "support" && !state.supportTipShown) {
      state.supportTipShown = true;
      showToast("Good hit. Support blocks can pop the prize block above.", 1700);
    }
  }

  function checkHazards(player, level) {
    const left = Math.floor((player.x + 6) / TILE);
    const right = Math.floor((player.x + player.w - 7) / TILE);
    const top = Math.floor((player.y + 6) / TILE);
    const bottom = Math.floor((player.y + player.h - 2) / TILE);
    for (let ty = top; ty <= bottom; ty += 1) {
      for (let tx = left; tx <= right; tx += 1) {
        if (level.isHazard(tx, ty)) {
          hurtPlayer("hazard");
          return;
        }
      }
    }
  }

  function checkEnemyContact(player, level) {
    for (const enemy of level.entities) {
      if (!enemy.alive || !rectsOverlap(player, enemy)) continue;
      const stomp = player.vy > 70 && player.y + player.h - enemy.y < 24;
      if (stomp) {
        enemy.alive = false;
        player.vy = -500;
        player.onGround = false;
        state.combo += 1;
        const bonus = 200 * state.combo;
        addScore(bonus);
        addFlow(18, `STOMP x${state.combo}`, enemy.x + enemy.w / 2, enemy.y, "#ffc93c");
        spawnBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, "#ffc93c", 18, 220);
        showToast(`Stomp combo x${state.combo} +${bonus}`, 900);
        play("stomp");
      } else if (player.dashTimer > 0 && enemy.kind !== "spark") {
        enemy.alive = false;
        addScore(300);
        addFlow(16, "DASH HIT", enemy.x + enemy.w / 2, enemy.y, "#ff8a47");
        spawnBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, "#ff8a47", 20, 240);
        play("stomp");
      } else {
        hurtPlayer("enemy");
      }
    }
  }

  function checkGate(player, level) {
    const gate = level.gate;
    if (!gate || !rectsOverlap(player, gate)) return;
    state.mode = "levelClear";
    addScore(state.gems * 1000 + Math.max(0, 600 - Math.floor(state.elapsed)) * 3);
    spawnBurst(gate.x + gate.w / 2, gate.y + gate.h / 2, "#7bdff2", 48, 340);
    play("gate");
    shake(0.25, 8);
    const missing = state.totalGems - state.gems;
    const gemNote = missing > 0 ? `${missing} sky gem${missing === 1 ? "" : "s"} left behind.` : "All sky gems found.";
    showOverlay(`${level.name} cleared`, `${gemNote} Coins: ${state.coins}. Score: ${state.score.toLocaleString()}.`, state.levelIndex >= levelDefs.length - 1 ? "Finish run" : "Next world");
  }

  function hurtPlayer(reason) {
    const player = state.player;
    if (player.invuln > 0 && reason !== "fall") return;
    state.combo = 0;
    state.flow = Math.max(0, state.flow - 30);
    state.flowTimer = 0;
    state.hearts -= 1;
    player.invuln = 1.2;
    player.dashTimer = 0;
    player.vx = -player.facing * 360;
    player.vy = -430;
    shake(0.25, 9);
    spawnBurst(player.x + player.w / 2, player.y + player.h / 2, "#f05d4f", 18, 220);
    play("hurt");
    if (state.hearts <= 0) gameOver();
    else if (reason === "fall") respawn();
    else showToast("Ouch. Find a heart or keep moving.", 1200);
  }

  function respawn() {
    const player = state.player;
    player.x = player.checkpoint.x;
    player.y = player.checkpoint.y;
    player.vx = 0;
    player.vy = 0;
    player.invuln = 1.6;
    player.onGround = false;
    showToast("Back to the checkpoint.", 1200);
  }

  function updateParticles(dt) {
    for (const particle of state.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += particle.gravity * dt;
      particle.spin += particle.spinSpeed * dt;
    }
    state.particles = state.particles.filter((particle) => particle.life > 0);
  }

  function updateFloaters(dt) {
    for (const floater of state.floaters) {
      floater.life -= dt;
      floater.y += floater.vy * dt;
      floater.x += Math.sin(floater.life * 9) * 8 * dt;
    }
    state.floaters = state.floaters.filter((floater) => floater.life > 0);
  }

  function spawnFloater(x, y, text, color) {
    state.floaters.push({
      x,
      y,
      text,
      color,
      vy: -58,
      life: 0.9,
      maxLife: 0.9
    });
  }

  function spawnBurst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const power = speed * (0.25 + Math.random() * 0.75);
      spawnParticle(x, y, color, 2 + Math.random() * 4, Math.cos(angle) * power, Math.sin(angle) * power, 0.45 + Math.random() * 0.45);
    }
  }

  function spawnParticle(x, y, color, size, vx, vy, life) {
    state.particles.push({
      x,
      y,
      color,
      size,
      vx,
      vy,
      life,
      maxLife: life,
      gravity: 360,
      spin: Math.random() * Math.PI,
      spinSpeed: -8 + Math.random() * 16
    });
  }

  function updateAtmosphere(dt) {
    const width = window.innerWidth;
    const height = window.innerHeight;
    for (const cloud of state.clouds) {
      cloud.x -= cloud.v * dt;
      if (cloud.x < -240) {
        cloud.x = width + 160 + Math.random() * 260;
        cloud.y = 40 + Math.random() * 240;
      }
    }
    for (const particle of state.weather) {
      particle.t += dt;
      particle.x += particle.vx * dt + Math.sin(particle.t * 2) * 10 * dt;
      particle.y += particle.vy * dt;
      if (particle.y > height + 12 || particle.x < -20 || particle.x > width + 20) {
        Object.assign(particle, makeWeatherParticle(), { y: -10, x: Math.random() * width });
      }
    }
  }

  function updateCamera(dt) {
    const player = state.player;
    const maxX = Math.max(0, state.level.width * TILE - window.innerWidth);
    const maxY = Math.max(0, state.level.height * TILE - window.innerHeight);
    const targetX = clamp(player.x + player.w / 2 - window.innerWidth * 0.42, 0, maxX);
    const targetY = clamp(player.y + player.h / 2 - window.innerHeight * 0.55, 0, maxY);
    state.camera.x += (targetX - state.camera.x) * Math.min(1, dt * 5.8);
    state.camera.y += (targetY - state.camera.y) * Math.min(1, dt * 5.2);
  }

  function updateHud() {
    hudWorld.textContent = state.level?.name || "Sundrop Fields";
    hudCoins.textContent = String(state.coins);
    hudGems.textContent = `${state.gems}/${state.totalGems || 0}`;
    hudHearts.textContent = String(Math.max(0, state.hearts));
    hudTime.textContent = formatTime(state.elapsed);
    if (hudFlow) hudFlow.textContent = `x${formatMultiplier(flowMultiplier())} ${Math.round(state.flow)}`;
  }

  function formatTime(seconds) {
    const safe = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(safe / 60);
    const secs = safe % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
  }

  function formatMultiplier(multiplier) {
    return Number.isInteger(multiplier) ? String(multiplier) : multiplier.toFixed(1);
  }

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const width = Math.floor(window.innerWidth * dpr);
    const height = Math.floor(window.innerHeight * dpr);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function shake(time, power) {
    state.shake = Math.max(state.shake, time);
    state.shakePower = Math.max(state.shakePower, power);
  }

  function render() {
    resize();
    const width = window.innerWidth;
    const height = window.innerHeight;
    const level = state.level || new Level(levelDefs[0]);
    const theme = level.theme;
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, theme.skyTop);
    grad.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    drawBackground(theme, width, height);

    let shakeX = 0;
    let shakeY = 0;
    if (state.shake > 0) {
      shakeX = (Math.random() - 0.5) * state.shakePower;
      shakeY = (Math.random() - 0.5) * state.shakePower;
    }

    ctx.save();
    ctx.translate(Math.round(-state.camera.x + shakeX), Math.round(-state.camera.y + shakeY));
    drawLevel(level);
    drawPlatforms(level);
    drawPickups(level);
    drawEnemies(level);
    drawPlayer(state.player || makePlayer(level.spawn.x, level.spawn.y));
    drawParticles();
    drawFloaters();
    ctx.restore();
    drawWeather(theme, width, height);
  }

  function drawBackground(theme, width, height) {
    ctx.save();
    for (const cloud of state.clouds) drawCloud(cloud.x, cloud.y, cloud.s);
    const cam = state.camera.x || 0;
    drawHills(theme.hillB, height - 140, 0.12, width, cam);
    drawHills(theme.hillA, height - 82, 0.22, width, cam + 120);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = theme.back;
    for (let i = 0; i < 16; i += 1) {
      const x = ((i * 180 - cam * 0.35) % (width + 220)) - 120;
      ctx.fillRect(x, height - 70 - (i % 3) * 18, 80, 70 + (i % 3) * 18);
      ctx.fillRect(x + 18, height - 92 - (i % 2) * 20, 42, 26);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawCloud(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "rgba(255, 248, 239, 0.82)";
    ctx.strokeStyle = "#181818";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 16, 34, 15, 0, 0, Math.PI * 2);
    ctx.ellipse(26, 12, 26, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(54, 16, 36, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawHills(color, y, parallax, width, cam) {
    ctx.fillStyle = color;
    ctx.strokeStyle = "#181818";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-40, window.innerHeight);
    for (let x = -80; x <= width + 120; x += 120) {
      const sx = x - (cam * parallax) % 120;
      ctx.quadraticCurveTo(sx + 58, y - 70 - (x % 240) / 8, sx + 130, y);
    }
    ctx.lineTo(width + 80, window.innerHeight);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function drawLevel(level) {
    const startX = Math.max(0, Math.floor(state.camera.x / TILE) - 2);
    const endX = Math.min(level.width, Math.ceil((state.camera.x + window.innerWidth) / TILE) + 2);
    const startY = Math.max(0, Math.floor(state.camera.y / TILE) - 2);
    const endY = Math.min(level.height, Math.ceil((state.camera.y + window.innerHeight) / TILE) + 2);
    for (let y = startY; y < endY; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        const tile = level.tile(x, y);
        if (tile !== ".") drawTile(tile, x * TILE, y * TILE, level.theme);
      }
    }
    if (level.gate) {
      drawSprite("gate", level.gate.x - 4, level.gate.y, 54, 68);
      drawSprite("flag", level.gate.x - 30, level.gate.y + 18, 46, 54);
    }
    for (const checkpoint of level.checkpoints) drawCheckpoint(checkpoint);
    for (const ring of level.rings) drawDashRing(ring);
  }

  function drawTile(tile, x, y, theme) {
    if (tile === "#") {
      if (theme.ground === "stone") drawStoneTile(x, y);
      else if (theme.ground === "foundry") drawFoundryTile(x, y);
      else drawSprite("grass", x, y, TILE, TILE);
    } else if (tile === "B") {
      drawSprite("brick", x, y, TILE, TILE);
    } else if (tile === "?") {
      drawSprite("prize", x, y, TILE, TILE);
    } else if (tile === "U") {
      drawSprite("used", x, y, TILE, TILE);
    } else if (tile === "^") {
      drawSprite("spike", x, y + 8, TILE, TILE - 8);
    } else if (tile === "T") {
      drawBouncePad(x, y);
    } else if (tile === "~") {
      ctx.fillStyle = "#f05d4f";
      ctx.fillRect(x, y + 12, TILE, TILE - 12);
      ctx.fillStyle = "#ffc93c";
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(x + 10 + i * 16, y + 16 + Math.sin(state.elapsed * 5 + i) * 3, 8, 0, Math.PI, true);
        ctx.fill();
      }
    }
  }

  function drawStoneTile(x, y) {
    ctx.fillStyle = "#7bdff2";
    ctx.strokeStyle = "#181818";
    ctx.lineWidth = 3;
    ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.strokeStyle = "rgba(24, 24, 24, 0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 14);
    ctx.lineTo(x + 34, y + 8);
    ctx.lineTo(x + 28, y + 34);
    ctx.lineTo(x + 42, y + 42);
    ctx.stroke();
  }

  function drawFoundryTile(x, y) {
    ctx.fillStyle = "#4d6b74";
    ctx.strokeStyle = "#181818";
    ctx.lineWidth = 3;
    ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.fillStyle = "#ffcf6e";
    ctx.fillRect(x + 7, y + 8, 10, 8);
    ctx.fillRect(x + 29, y + 27, 11, 8);
  }

  function drawBouncePad(x, y) {
    const squash = Math.sin(state.elapsed * 10 + x * 0.01) * 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#26313a";
    ctx.strokeStyle = "#181818";
    ctx.lineWidth = 3;
    ctx.fillRect(7, 34, 34, 8);
    ctx.strokeRect(7, 34, 34, 8);
    ctx.strokeStyle = "#26313a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(13, 34);
    ctx.lineTo(20, 22 + squash);
    ctx.lineTo(27, 34);
    ctx.lineTo(34, 22 + squash);
    ctx.stroke();
    ctx.fillStyle = "#f05d4f";
    ctx.strokeStyle = "#181818";
    ctx.lineWidth = 3;
    ctx.fillRect(5, 12 + squash, 38, 12);
    ctx.strokeRect(5, 12 + squash, 38, 12);
    ctx.fillStyle = "#ffc93c";
    ctx.fillRect(12, 15 + squash, 24, 4);
    ctx.restore();
  }

  function drawCheckpoint(checkpoint) {
    ctx.save();
    if (checkpoint.active) {
      ctx.globalAlpha = 0.32 + Math.sin(checkpoint.pulse * 6) * 0.08;
      ctx.fillStyle = "#3bb273";
      ctx.beginPath();
      ctx.arc(checkpoint.x + checkpoint.w / 2, checkpoint.y + checkpoint.h / 2, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    drawSprite("checkpoint", checkpoint.x - 4, checkpoint.y - 3, 48, 54);
    ctx.restore();
  }

  function drawDashRing(ring) {
    const pulse = Math.sin(ring.pulse * 7) * 3;
    const ready = ring.cooldown <= 0;
    ctx.save();
    ctx.translate(ring.x + ring.w / 2, ring.y + ring.h / 2);
    ctx.rotate(Math.sin(ring.pulse * 2) * 0.12);
    ctx.lineWidth = 5;
    ctx.strokeStyle = ready ? "#7bdff2" : "rgba(123, 223, 242, 0.35)";
    ctx.fillStyle = ready ? "rgba(233, 255, 245, 0.45)" : "rgba(233, 255, 245, 0.18)";
    ctx.beginPath();
    ctx.ellipse(0, 0, 22 + pulse, 16 + pulse * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#181818";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, -7);
    ctx.lineTo(9, 0);
    ctx.lineTo(-6, 7);
    ctx.stroke();
    ctx.restore();
  }

  function drawPlatforms(level) {
    for (const platform of level.platforms) drawSprite("platform", platform.x, platform.y - 6, platform.w, 30);
  }

  function drawPickups(level) {
    for (const item of [...level.coins, ...level.gems, ...level.powerups]) {
      if (!item.alive) continue;
      const bob = Math.sin(item.t * 5) * 4;
      const scale = item.kind === "coin" ? 1 + Math.sin(item.t * 8) * 0.15 : 1;
      const spriteName = item.kind === "coin" ? "coin" : item.kind;
      ctx.save();
      ctx.translate(item.x + item.w / 2, item.y + item.h / 2 + (item.magneted ? 0 : bob));
      ctx.scale(scale, 1);
      drawSprite(spriteName, -item.w / 2, -item.h / 2, item.w, item.h);
      ctx.restore();
    }
  }

  function drawEnemies(level) {
    for (const enemy of level.entities) {
      if (!enemy.alive) continue;
      ctx.save();
      ctx.translate(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);
      ctx.scale(enemy.facing, 1);
      if (enemy.kind === "spark") ctx.rotate(Math.sin(enemy.t * 10) * 0.14);
      drawSprite(enemy.kind, -enemy.w / 2, -enemy.h / 2, enemy.w, enemy.h);
      ctx.restore();
    }
  }

  function drawPlayer(player) {
    if (!player) return;
    if (player.invuln > 0 && Math.floor(player.invuln * 16) % 2 === 0) return;
    let sprite = "playerIdle";
    if (player.dashTimer > 0) sprite = "playerDash";
    else if (!player.onGround) sprite = "playerJump";
    else if (Math.abs(player.vx) > 35) sprite = Math.floor(player.runFrame) % 2 === 0 ? "playerRunA" : "playerRunB";
    ctx.save();
    ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
    ctx.scale(player.facing, 1);
    if (state.flow > 22) {
      ctx.save();
      ctx.scale(player.facing, 1);
      ctx.globalAlpha = Math.min(0.55, state.flow / 180);
      ctx.strokeStyle = state.flow >= 85 ? "#ffc93c" : "#7bdff2";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 4, 29 + Math.sin(state.elapsed * 12) * 3, 36, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (player.magnetTimer > 0) {
      ctx.save();
      ctx.scale(player.facing, 1);
      ctx.globalAlpha = 0.24 + Math.sin(state.elapsed * 9) * 0.05;
      ctx.strokeStyle = "#ffc93c";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.arc(0, 2, 62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawSprite(sprite, -23, -27, 46, 54);
    if (player.canDash && player.dashReady) {
      ctx.globalAlpha = 0.5 + Math.sin(state.elapsed * 8) * 0.18;
      ctx.fillStyle = "#ff8a47";
      ctx.beginPath();
      ctx.arc(-player.facing * 18, 11, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (player.canDouble && player.doubleReady && !player.onGround) {
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = "#7bdff2";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 8, 24, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const particle of state.particles) {
      const alpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.spin);
      ctx.fillStyle = particle.color;
      ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
      ctx.restore();
    }
  }

  function drawFloaters() {
    ctx.save();
    ctx.font = "900 16px Trebuchet MS, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const floater of state.floaters) {
      const alpha = clamp(floater.life / floater.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#181818";
      ctx.fillStyle = floater.color;
      ctx.strokeText(floater.text, floater.x, floater.y);
      ctx.fillText(floater.text, floater.x, floater.y);
    }
    ctx.restore();
  }

  function drawWeather(theme, width, height) {
    const weather = theme.weather;
    ctx.save();
    for (const particle of state.weather) {
      if (weather === "ember") {
        ctx.fillStyle = "rgba(255, 201, 60, 0.75)";
        ctx.fillRect(particle.x, particle.y, particle.r * 2, particle.r * 4);
      } else if (weather === "glow") {
        ctx.fillStyle = "rgba(123, 223, 242, 0.46)";
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.r * 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "rgba(255, 201, 60, 0.52)";
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    if (state.flow >= 55 && state.mode === "playing") {
      ctx.save();
      ctx.globalAlpha = state.flow >= 85 ? 0.18 : 0.1;
      ctx.strokeStyle = state.flow >= 85 ? "#ffc93c" : "#7bdff2";
      ctx.lineWidth = 10;
      for (let i = -80; i < width + 120; i += 120) {
        ctx.beginPath();
        ctx.moveTo(i + (state.elapsed * 120) % 120, height);
        ctx.lineTo(i + 90 + (state.elapsed * 120) % 120, height - 120);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (state.mode !== "playing") {
      ctx.fillStyle = "rgba(255, 248, 239, 0.18)";
      ctx.fillRect(0, 0, width, height);
    }
  }

  function drawSprite(name, x, y, w, h) {
    const sprite = sprites[name];
    if (!sprite || !atlasReady) {
      drawFallback(name, x, y, w, h);
      return;
    }
    ctx.drawImage(atlas, sprite[0], sprite[1], SPRITE, SPRITE, x, y, w, h);
  }

  function drawFallback(name, x, y, w, h) {
    const colors = {
      coin: "#ffc93c",
      gem: "#7bdff2",
      dash: "#f05d4f",
      feather: "#7bdff2",
      heart: "#f05d4f",
      magnet: "#ffc93c",
      grass: "#3bb273",
      brick: "#ff8a47",
      prize: "#ffc93c",
      used: "#b58d4a",
      spike: "#fff8ef",
      platform: "#7bdff2"
    };
    ctx.fillStyle = colors[name] || "#fff8ef";
    ctx.strokeStyle = "#181818";
    ctx.lineWidth = 3;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
  }

  function loop(time) {
    const rawDt = state.lastTime ? (time - state.lastTime) / 1000 : 0;
    state.lastTime = time;
    const dt = Math.min(MAX_DT, rawDt);
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function onKeyDown(event) {
    const key = event.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", " ", "shift"].includes(key)) event.preventDefault();
    if (!state.keys.has(key)) {
      if (key === " " || key === "arrowup" || key === "w") state.input.jumpPressed = true;
      if (key === "shift" || key === "k") state.input.dashPressed = true;
    }
    state.keys.add(key);
    if (state.mode === "menu" && (key === "enter" || key === " ")) startGame();
    else if (state.mode === "levelClear" && (key === "enter" || key === " ")) nextLevel();
    else if ((state.mode === "gameOver" || state.mode === "win") && (key === "enter" || key === " ")) startGame();
    else if (key === "p" && state.mode === "playing") {
      state.mode = "paused";
      showOverlay("Paused", "Catch your breath. The Cloudworks can wait for a few seconds.", "Resume");
    } else if (key === "p" && state.mode === "paused") {
      state.mode = "playing";
      overlay.classList.add("hidden");
    } else if (key === "r" && state.mode === "playing") {
      initLevel(state.levelIndex);
      showToast("World restarted.", 1000);
    }
  }

  function onKeyUp(event) {
    state.keys.delete(event.key.toLowerCase());
  }

  function setupTouchControls() {
    for (const button of document.querySelectorAll("[data-touch]")) {
      const action = button.dataset.touch;
      const press = (event) => {
        event.preventDefault();
        button.classList.add("active");
        if (action === "jump" && !state.touch.jump) state.input.jumpPressed = true;
        if (action === "dash" && !state.touch.dash) state.input.dashPressed = true;
        state.touch[action] = true;
        ensureAudio();
      };
      const release = (event) => {
        event.preventDefault();
        button.classList.remove("active");
        state.touch[action] = false;
      };
      button.addEventListener("pointerdown", press);
      button.addEventListener("pointerup", release);
      button.addEventListener("pointercancel", release);
      button.addEventListener("pointerleave", release);
    }
  }

  overlayButton.addEventListener("click", () => {
    ensureAudio();
    if (state.mode === "menu" || state.mode === "gameOver" || state.mode === "win") startGame();
    else if (state.mode === "levelClear") nextLevel();
    else if (state.mode === "paused") {
      state.mode = "playing";
      overlay.classList.add("hidden");
    }
  });

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("pointerdown", ensureAudio, { once: true });

  setupTouchControls();
  resize();
  if (new URLSearchParams(window.location.search).has("playtest")) {
    state.mode = "playing";
    state.coins = 0;
    state.score = 0;
    state.hearts = 3;
    initLevel(0);
    overlay.classList.add("hidden");
  } else {
    initLevel(0);
  }
  requestAnimationFrame(loop);

})();
