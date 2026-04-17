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
  const hudScore = document.getElementById("hudScore");
  const btnMute = document.getElementById("btnMute");
  const btnFullscreen = document.getElementById("btnFullscreen");
  const btnAssist = document.getElementById("btnAssist");
  const btnZen = document.getElementById("btnZen");

  const { levels: levelDefs, sprites } = window.PIPEBOUND_LEVELS;
  const TILE = 48;
  const SPRITE = 32;
  const GRAVITY = 2150;
  const FRICTION = 0.83;
  const AIR_FRICTION = 0.985;
  const MAX_DT = 1 / 30;
  const SOLIDS = new Set(["#", "B", "?", "U"]);
  const HAZARDS = new Set(["^", "~"]);

  const SAVE_KEY = "pipebound-save-v2";
  const loadSave = () => {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; }
  };
  const writeSave = (data) => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) {}
  };
  const save = Object.assign({
    levels: {},
    unlocked: 1,
    achievements: {},
    totalCoins: 0,
    totalRuns: 0
  }, loadSave());
  const persist = () => writeSave(save);

  const ACHIEVEMENTS = [
    { id: "first_coin", name: "First Shiny", desc: "Collect your first coin." },
    { id: "hundred_coins", name: "Pocket Jangle", desc: "Collect 100 lifetime coins." },
    { id: "five_hundred_coins", name: "Treasure Hoarder", desc: "Collect 500 lifetime coins." },
    { id: "first_gem", name: "Sky Touched", desc: "Snag a sky gem." },
    { id: "all_gems", name: "Gemkeeper", desc: "Collect every sky gem in a single world." },
    { id: "flow_max", name: "In the Zone", desc: "Hit 3x Flow." },
    { id: "combo5", name: "Chainbreaker", desc: "Stomp 5 enemies without touching the ground." },
    { id: "fireball_kill", name: "Pyro", desc: "Scorch an enemy with a fireball." },
    { id: "shield_save", name: "Bubble Wrapped", desc: "Block a hit with the shield." },
    { id: "boss_slain", name: "Core Breaker", desc: "Defeat the Core Dragon." },
    { id: "finish_run", name: "Cloud Savior", desc: "Finish every world in one run." },
    { id: "no_hit_level", name: "Untouchable", desc: "Clear any world without taking damage." },
    { id: "speedrun", name: "Blazing Boots", desc: "Clear a world in under 45 seconds." },
    { id: "wall_master", name: "Wall Wizard", desc: "Perform 10 wall-jumps." }
  ];
  const achievementIndex = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

  const NOTE_FREQS = {
    C2:65.41,D2:73.42,E2:82.41,F2:87.31,G2:98.00,A2:110.00,B2:123.47,
    C3:130.81,D3:146.83,E3:164.81,F3:174.61,G3:196.00,A3:220.00,B3:246.94,
    C4:261.63,D4:293.66,E4:329.63,F4:349.23,G4:392.00,A4:440.00,B4:493.88,
    C5:523.25,D5:587.33,E5:659.25,F5:698.46,G5:783.99,A5:880.00,
    r: 0
  };

  const MUSIC_THEMES = {
    boss: {
      bpm: 178,
      melody: ["E5","D5","C5","B4","A4","B4","C5","D5","E5","G5","A5","G5","E5","D5","C5","B4"],
      bass:   ["E2","E2","A2","A2","D2","D2","G2","G2","E2","E2","A2","A2","B2","B2","E3","E3"],
      drums:  [1,0,1,0,1,0,1,1,1,0,1,0,1,1,0,1]
    },
    pollen: {
      bpm: 138,
      melody: ["E5","r","G5","E5","C5","r","D5","B4","C5","r","E5","C5","G4","r","A4","B4"],
      bass:   ["C3","r","G3","r","C3","r","G3","r","A3","r","E3","r","F3","r","G3","r"],
      drums:  [1,0,0,0,1,0,1,0,1,0,0,0,1,0,1,0]
    },
    glow: {
      bpm: 106,
      melody: ["A4","r","C5","A4","E4","r","G4","F4","E4","r","C5","A4","D4","r","E4","F4"],
      bass:   ["A2","r","E3","r","A2","r","D3","r","F2","r","C3","r","E3","r","A2","r"],
      drums:  [1,0,0,1,0,0,1,0,1,0,0,0,1,0,1,0]
    },
    ember: {
      bpm: 160,
      melody: ["E5","G5","A5","r","B5","A5","G5","r","E5","F5","G5","r","A5","G5","F5","r"],
      bass:   ["E2","r","B2","r","E2","r","B2","r","D3","r","A2","r","D3","r","A2","r"],
      drums:  [1,1,0,1,1,0,1,0,1,1,0,1,1,0,1,0]
    },
    snow: {
      bpm: 116,
      melody: ["C5","E5","G5","r","E5","C5","B4","r","A4","C5","E5","r","G5","F5","E5","r"],
      bass:   ["C3","r","G3","r","C3","r","G3","r","F3","r","C3","r","G3","r","C3","r"],
      drums:  [1,0,0,1,0,0,1,0,1,0,0,0,1,0,1,0]
    },
    lava: {
      bpm: 172,
      melody: ["A4","C5","E5","A5","r","G5","F5","E5","D5","r","F5","A5","r","G5","E5","r"],
      bass:   ["A2","r","E3","A2","r","G2","D3","r","A2","r","E3","A2","r","G2","D3","r"],
      drums:  [1,1,1,0,1,1,0,1,1,1,1,0,1,1,0,1]
    }
  };

  let _musicNextTime = 0;
  let _musicNoteIdx = 0;
  let _musicIntervalId = null;

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
    assistMode: false,
    zenMode: false,
    supportTipShown: false,
    toastTimer: 0,
    particles: [],
    floaters: [],
    clouds: [],
    weather: [],
    fireballs: [],
    enemyProjectiles: [],
    hitThisLevel: false,
    comboChain: 0,
    comboTimer: 0,
    coinChain: 0,
    coinChainTimer: 0,
    lives: 3,
    wallJumpTotal: 0,
    achievementToasts: [],
    slowMo: 0,
    transition: 0,
    pendingTransition: null,
    flash: 0,
    totalCoinsLifetime: save.totalCoins || 0
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
      this.turrets = [];
      this.boss = null;
      this.isBossArena = !!def.isBossArena;
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
          } else if (cell === "b" || cell === "h" || cell === "f" || cell === "s" || cell === "c") {
            const kind = { b: "beetle", h: "hopper", f: "flutter", s: "spark", c: "chaser" }[cell];
            this.entities.push(makeEnemy(kind, px + 6, py + 8));
            this.tiles[y][x] = ".";
          } else if (cell === "Y") {
            this.powerups.push(makePickup("star", px + 8, py + 8));
            this.tiles[y][x] = ".";
          } else if (cell === "W") {
            this.powerups.push(makePickup("fireflower", px + 8, py + 8));
            this.tiles[y][x] = ".";
          } else if (cell === "X") {
            this.powerups.push(makePickup("shield", px + 8, py + 8));
            this.tiles[y][x] = ".";
          } else if (cell === "q") {
            this.turrets.push(makeTurret(px + TILE / 2 - 18, py + TILE / 2 - 14));
            this.tiles[y][x] = ".";
          } else if (cell === "Z") {
            this.boss = makeBoss(px, py - TILE);
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
      spark: { w: 28, h: 28, speed: 92 },
      chaser: { w: 34, h: 38, speed: 88 }
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

  function makeTurret(x, y) {
    return { x, y, w: 36, h: 30, cooldown: 1 + Math.random() * 2, pulse: 0, alive: true, hp: 2 };
  }

  function makeBoss(x, y) {
    return {
      x, y, w: 96, h: 84,
      baseY: y,
      vx: 0, vy: 0,
      hp: 6, maxHp: 6,
      phase: "intro",
      phaseTime: 0,
      attackTimer: 2.6,
      facing: -1,
      hurtFlash: 0,
      alive: true,
      onGround: false,
      shakeOffset: 0
    };
  }

  function makeFireball(x, y, dir) {
    return {
      x, y, w: 18, h: 18,
      vx: dir * 620,
      vy: -80,
      life: 2.4,
      bounces: 2,
      alive: true,
      t: 0
    };
  }

  function makeEnemyBullet(x, y, vx, vy, kind) {
    return {
      x, y, w: 16, h: 16,
      vx, vy,
      life: 3.5,
      alive: true,
      kind: kind || "bolt",
      t: 0
    };
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
      runFrame: 0,
      wallContact: 0,
      wallJumpCooldown: 0,
      starTimer: 0,
      hasFire: false,
      fireCooldown: 0,
      hasShield: false,
      shieldPulse: 0
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
    state.fireballs.length = 0;
    state.enemyProjectiles.length = 0;
    state.hitThisLevel = false;
    state.comboChain = 0;
    state.comboTimer = 0;
    state.coinChain = 0;
    state.coinChainTimer = 0;
    state.shake = 0;
    state.shakePower = 0;
    state.slowMo = 0;
    buildAtmosphere();
    updateHud();
    if (state.mode === "playing") showToast(state.level.def.tip, 4200);
  }

  function startGame(fromIndex) {
    ensureAudio();
    state.mode = "playing";
    state.coins = 0;
    state.score = 0;
    state.lives = 3;
    state.wallJumpTotal = 0;
    state.hearts = state.assistMode ? 5 : 3;
    save.totalRuns = (save.totalRuns || 0) + 1;
    persist();
    initLevel(typeof fromIndex === "number" ? fromIndex : 0);
    overlay.classList.add("hidden");
    state.transition = 0.6;
    state.lastTime = performance.now();
    stopMusic();
    startMusic();
  }

  function nextLevel() {
    if (state.levelIndex >= levelDefs.length - 1) {
      finishGame();
      return;
    }
    state.mode = "playing";
    state.transition = 0.7;
    initLevel(state.levelIndex + 1);
    overlay.classList.add("hidden");
    stopMusic();
    startMusic();
  }

  function finishGame() {
    state.mode = "win";
    stopMusic();
    const finalScore = state.score + state.coins * 25 + state.hearts * 500 + state.lives * 1000;
    state.score = finalScore;
    if (finalScore > state.best) {
      state.best = finalScore;
      localStorage.setItem("pipebound-best", String(finalScore));
    }
    unlockAchievement("finish_run");
    save.unlocked = Math.max(save.unlocked, levelDefs.length);
    persist();
    showOverlay(
      "Cloudworks saved!",
      `Final score: ${finalScore.toLocaleString()}  |  Best: ${state.best.toLocaleString()}\nCoins: ${state.coins}  |  Hearts left: ${state.hearts}  |  Lives: ${state.lives}\nPip earned a hot cocoa and one deeply unnecessary victory lap.`,
      "Play again"
    );
    play("win");
  }

  function gameOver() {
    state.mode = "gameOver";
    stopMusic();
    showOverlay(
      "Run fizzled",
      `Score: ${state.score.toLocaleString()}  |  Best: ${state.best.toLocaleString()}\nCoins: ${state.coins}  |  Hearts: 0\nPip is already tying the shoes again.`,
      "Retry"
    );
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
    const baseCount = state.level.theme.weather === "ember" || state.level.theme.weather === "lava" ? 90 : 64;
    const count = state.zenMode ? Math.ceil(baseCount * 0.38) : baseCount;
    state.weather = Array.from({ length: count }, () => makeWeatherParticle());
  }

  function makeWeatherParticle() {
    const weather = state.level?.theme.weather || "pollen";
    return {
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: weather === "ember" ? -20 + Math.random() * 34 : weather === "snow" ? -12 + Math.random() * 24 : -8 + Math.random() * 16,
      vy: weather === "glow" ? 16 + Math.random() * 22 : weather === "snow" ? 20 + Math.random() * 40 : 30 + Math.random() * 70,
      r: weather === "ember" ? 1 + Math.random() * 3 : weather === "snow" ? 1.5 + Math.random() * 3 : 1 + Math.random() * 2,
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

  function startMusic() {
    stopMusic();
    if (!state.audio || state.muted) return;
    const audioCtx = state.audio.ctx;
    if (audioCtx.state === "suspended") audioCtx.resume();
    _musicNextTime = audioCtx.currentTime + 0.12;
    _musicNoteIdx = 0;
    _musicIntervalId = setInterval(_musicSchedule, 25);
  }

  function stopMusic() {
    if (_musicIntervalId) {
      clearInterval(_musicIntervalId);
      _musicIntervalId = null;
    }
  }

  function _musicSchedule() {
    if (!state.audio) return;
    const audioCtx = state.audio.ctx;
    const useBoss = state.level && state.level.isBossArena;
    const weather = state.level?.theme.weather || "pollen";
    const theme = useBoss ? MUSIC_THEMES.boss : (MUSIC_THEMES[weather] || MUSIC_THEMES.pollen);
    const beatDur = 60 / theme.bpm / 2;
    while (_musicNextTime < audioCtx.currentTime + 0.16) {
      const idx = _musicNoteIdx % theme.melody.length;
      _playMusicNote(NOTE_FREQS[theme.melody[idx]], beatDur * 0.8, _musicNextTime, "square", useBoss ? 0.18 : 0.14);
      _playMusicNote(NOTE_FREQS[theme.bass[idx]], beatDur * 1.5, _musicNextTime, "triangle", useBoss ? 0.14 : 0.1);
      if (theme.drums && theme.drums[idx]) _playDrum(_musicNextTime, useBoss ? 0.18 : 0.12);
      _musicNextTime += beatDur;
      _musicNoteIdx++;
    }
  }

  function _playDrum(time, vol) {
    if (!state.audio) return;
    const audioCtx = state.audio.ctx;
    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(160, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.13);
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.linearRampToValueAtTime(vol, time + 0.005);
    amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
    osc.connect(amp);
    amp.connect(state.audio.gain);
    osc.start(time);
    osc.stop(time + 0.16);
  }

  function _playMusicNote(freq, duration, time, type, vol) {
    if (!state.audio || !freq) return;
    const audioCtx = state.audio.ctx;
    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.linearRampToValueAtTime(vol, time + 0.018);
    amp.gain.linearRampToValueAtTime(0.0001, time + duration);
    osc.connect(amp);
    amp.connect(state.audio.gain);
    osc.start(time);
    osc.stop(time + duration + 0.01);
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
    updateTurrets(level, dt);
    updateBoss(level, dt);
    updateFireballs(level, dt);
    updateEnemyProjectiles(level, dt);
    updatePickups(level, dt);
    updateParticles(dt);
    updateFloaters(dt);
    updateCombo(dt);
    updateAchievementToasts(dt);
    updateCamera(dt);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 2.4);
    if (state.transition > 0) state.transition = Math.max(0, state.transition - dt);
    updateHud();
    if (state.shake > 0) state.shake -= dt;
    state.input.jumpPressed = false;
    state.input.dashPressed = false;
    state.input.firePressed = false;
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
    state.input.fire = keys.has("f") || keys.has("j") || state.touch.fire;
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
    if (state.flow >= 85) { spawnBurst(x, y, "#ffc93c", 5, 120); unlockAchievement("flow_max"); }
  }

  function updatePlayer(player, level, dt) {
    if (player.invuln > 0) player.invuln -= dt;
    if (player.dashCooldown > 0) player.dashCooldown -= dt;
    if (player.magnetTimer > 0) player.magnetTimer -= dt;
    if (player.jumpBuffer > 0) player.jumpBuffer -= dt;
    if (player.coyote > 0) player.coyote -= dt;
    if (player.wallJumpCooldown > 0) player.wallJumpCooldown -= dt;
    if (player.starTimer > 0) player.starTimer -= dt;
    if (state.input.jumpPressed) player.jumpBuffer = state.assistMode ? 0.18 : 0.12;

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
    if (player.fireCooldown > 0) player.fireCooldown -= dt;
    if (player.shieldPulse > 0) player.shieldPulse -= dt;
    if (player.hasFire && state.input.firePressed && player.fireCooldown <= 0) {
      player.fireCooldown = 0.28;
      const fx = player.x + player.w / 2 + player.facing * 16;
      const fy = player.y + player.h / 2 - 2;
      state.fireballs.push(makeFireball(fx, fy, player.facing));
      spawnBurst(fx, fy, "#ff8a47", 8, 160);
      play("dash");
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
    player.wallContact = 0;
    moveActor(player, level, dt, true);

    // Wall jump: if pressing into a wall while airborne, slow fall and allow jump off wall
    if (!player.onGround && player.wallContact !== 0 && player.wallJumpCooldown <= 0) {
      if (player.vy > 0) player.vy = Math.min(player.vy, state.assistMode ? 125 : 160);
      if (player.jumpBuffer > 0) {
        player.vy = -700;
        player.vx = -player.wallContact * 600;
        player.facing = -player.wallContact;
        player.jumpBuffer = 0;
        player.wallJumpCooldown = state.assistMode ? 0.24 : 0.32;
        player.doubleReady = player.canDouble;
        player.dashReady = player.canDash;
        spawnBurst(player.x + player.w / 2, player.y + player.h / 2, "#b8e0ff", 14, 200);
        state.wallJumpTotal += 1;
        if (state.wallJumpTotal >= 10) unlockAchievement("wall_master");
        play("jump");
      }
    }

    // Dash trail particles
    if (player.dashTimer > 0 && Math.random() < 0.5) {
      spawnParticle(
        player.x + player.w / 2 - player.facing * 14,
        player.y + player.h / 2 + (Math.random() - 0.5) * 20,
        "#ff8a47", 3 + Math.random() * 3, -player.facing * 60, 0, 0.22
      );
    }

    carryByPlatforms(player, level);
    if (player.onGround) {
      player.coyote = state.assistMode ? 0.16 : 0.09;
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
      } else if (enemy.kind === "chaser") {
        const px = state.player.x + state.player.w / 2;
        const ex = enemy.x + enemy.w / 2;
        const dir = Math.sign(px - ex);
        enemy.vx += dir * 500 * dt;
        enemy.vx = clamp(enemy.vx, -170, 170);
        enemy.vy += GRAVITY * dt;
        moveActor(enemy, level, dt, false);
        if (enemy.onGround && Math.abs(px - ex) < 320 && enemy.t > 0.7) {
          enemy.vy = -580;
          enemy.t = 0;
        }
        if (Math.random() < 0.06) spawnParticle(enemy.x + enemy.w / 2, enemy.y, "#f05d4f", 2, 0, -60, 0.3);
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

  function updateFireballs(level, dt) {
    for (const fb of state.fireballs) {
      if (!fb.alive) continue;
      fb.t += dt;
      fb.vy += GRAVITY * 0.55 * dt;
      fb.life -= dt;
      const prevX = fb.x;
      const prevY = fb.y;
      fb.x += fb.vx * dt;
      fb.y += fb.vy * dt;
      if (fb.life <= 0) { fb.alive = false; spawnBurst(fb.x, fb.y, "#ff8a47", 6, 120); continue; }
      if (Math.random() < 0.7) spawnParticle(fb.x, fb.y, Math.random() < 0.5 ? "#ffc93c" : "#ff8a47", 2 + Math.random() * 3, -fb.vx * 0.25, -60 - Math.random() * 60, 0.32);
      const tx = Math.floor(fb.x / TILE);
      const ty = Math.floor(fb.y / TILE);
      if (level.isSolid(tx, ty)) {
        if (fb.vy > 0 && prevY + fb.h <= ty * TILE) {
          fb.vy = -340;
          fb.bounces -= 1;
          if (fb.bounces < 0) fb.alive = false;
        } else {
          fb.alive = false;
        }
        spawnBurst(fb.x, fb.y, "#ff8a47", 8, 140);
        continue;
      }
      if (level.isHazard(tx, ty)) { fb.alive = false; continue; }
      for (const enemy of level.entities) {
        if (!enemy.alive || !rectsOverlap(fb, enemy)) continue;
        enemy.alive = false;
        fb.alive = false;
        addScore(250);
        addFlow(10, "SCORCH", enemy.x + enemy.w / 2, enemy.y, "#ff8a47");
        spawnBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, "#ff8a47", 20, 240);
        unlockAchievement("fireball_kill");
        play("stomp");
        break;
      }
      if (fb.alive) {
        for (const turret of level.turrets) {
          if (!turret.alive || !rectsOverlap(fb, turret)) continue;
          turret.hp -= 1;
          fb.alive = false;
          spawnBurst(turret.x + turret.w / 2, turret.y + turret.h / 2, "#ff8a47", 16, 200);
          if (turret.hp <= 0) {
            turret.alive = false;
            addScore(300);
            spawnBurst(turret.x + turret.w / 2, turret.y + turret.h / 2, "#ffc93c", 28, 280);
            unlockAchievement("fireball_kill");
            play("stomp");
          } else {
            play("block");
          }
          break;
        }
      }
      if (fb.alive && level.boss && level.boss.alive && rectsOverlap(fb, level.boss)) {
        hitBoss(level.boss, 1, fb.x, fb.y, "fire");
        fb.alive = false;
      }
    }
    state.fireballs = state.fireballs.filter((f) => f.alive);
  }

  function updateTurrets(level, dt) {
    const player = state.player;
    for (const turret of level.turrets) {
      if (!turret.alive) continue;
      turret.pulse += dt;
      turret.cooldown -= dt;
      if (turret.cooldown <= 0) {
        const px = player.x + player.w / 2;
        const py = player.y + player.h / 2;
        const dx = px - (turret.x + turret.w / 2);
        const dy = py - (turret.y + turret.h / 2);
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 620) {
          const speed = 260;
          state.enemyProjectiles.push(makeEnemyBullet(
            turret.x + turret.w / 2,
            turret.y + turret.h / 2,
            (dx / dist) * speed,
            (dy / dist) * speed,
            "bolt"
          ));
          spawnBurst(turret.x + turret.w / 2, turret.y, "#f05d4f", 6, 120);
          play("block");
          turret.cooldown = 2 + Math.random() * 1.2;
        } else {
          turret.cooldown = 0.6;
        }
      }
      if (rectsOverlap(player, turret) && player.vy > 60 && player.y + player.h - turret.y < 24) {
        turret.hp -= 2;
        player.vy = -440;
        spawnBurst(turret.x + turret.w / 2, turret.y, "#ffc93c", 16, 200);
        if (turret.hp <= 0) {
          turret.alive = false;
          addScore(300);
          addFlow(10, "STOMP", turret.x + turret.w / 2, turret.y, "#ffc93c");
          play("stomp");
        }
      } else if (rectsOverlap(player, turret) && player.dashTimer > 0) {
        turret.alive = false;
        addScore(350);
        addFlow(14, "DASH HIT", turret.x + turret.w / 2, turret.y, "#ff8a47");
        spawnBurst(turret.x + turret.w / 2, turret.y, "#ff8a47", 20, 220);
        play("stomp");
      }
    }
  }

  function updateEnemyProjectiles(level, dt) {
    const player = state.player;
    for (const bullet of state.enemyProjectiles) {
      if (!bullet.alive) continue;
      bullet.t += dt;
      bullet.life -= dt;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.life <= 0) { bullet.alive = false; continue; }
      const tx = Math.floor(bullet.x / TILE);
      const ty = Math.floor(bullet.y / TILE);
      if (level.isSolid(tx, ty)) { bullet.alive = false; spawnBurst(bullet.x, bullet.y, "#f05d4f", 5, 100); continue; }
      if (Math.random() < 0.4) spawnParticle(bullet.x, bullet.y, "#f05d4f", 2, -bullet.vx * 0.1, -bullet.vy * 0.1, 0.24);
      if (rectsOverlap(bullet, player) && player.starTimer <= 0) {
        bullet.alive = false;
        hurtPlayer("bullet");
      }
      for (const fb of state.fireballs) {
        if (fb.alive && rectsOverlap(fb, bullet)) {
          bullet.alive = false;
          fb.alive = false;
          spawnBurst(bullet.x, bullet.y, "#ffc93c", 10, 180);
        }
      }
    }
    state.enemyProjectiles = state.enemyProjectiles.filter((b) => b.alive);
  }

  function updateBoss(level, dt) {
    const boss = level.boss;
    if (!boss || !boss.alive) return;
    const player = state.player;
    boss.phaseTime += dt;
    boss.attackTimer -= dt;
    if (boss.hurtFlash > 0) boss.hurtFlash -= dt;
    boss.shakeOffset = boss.hurtFlash > 0 ? (Math.random() - 0.5) * 8 : 0;

    if (boss.phase === "intro") {
      if (boss.phaseTime > 1.6) { boss.phase = "patrol"; boss.phaseTime = 0; boss.attackTimer = 2; }
    } else if (boss.phase === "patrol") {
      boss.facing = Math.sign((player.x + player.w / 2) - (boss.x + boss.w / 2)) || -1;
      boss.vx += boss.facing * 220 * dt;
      boss.vx = clamp(boss.vx, -120, 120);
      boss.vy += GRAVITY * dt;
      moveActor(boss, level, dt, false);
      if (boss.attackTimer <= 0) {
        const choice = Math.floor(Math.random() * 3);
        boss.phase = choice === 0 ? "leap" : choice === 1 ? "breathe" : "shockwave";
        boss.phaseTime = 0;
        boss.attackTimer = 3 + Math.random() * 1.5;
      }
    } else if (boss.phase === "leap") {
      if (boss.phaseTime < 0.45) {
        boss.vx *= 0.86;
      } else if (boss.phaseTime < 0.55) {
        if (boss.onGround) {
          boss.vy = -840;
          boss.vx = boss.facing * 420;
          boss.onGround = false;
        }
      }
      boss.vy += GRAVITY * dt;
      moveActor(boss, level, dt, false);
      if (boss.onGround && boss.phaseTime > 0.6) {
        shake(0.2, 10);
        spawnBurst(boss.x + boss.w / 2, boss.y + boss.h, "#ff8a47", 28, 320);
        for (let i = -2; i <= 2; i += 1) {
          if (i === 0) continue;
          state.enemyProjectiles.push(makeEnemyBullet(
            boss.x + boss.w / 2, boss.y + boss.h - 6,
            i * 140, -220 - Math.abs(i) * 30, "spark"
          ));
        }
        play("bounce");
        boss.phase = "patrol";
        boss.phaseTime = 0;
      }
    } else if (boss.phase === "breathe") {
      boss.vx *= 0.88;
      boss.vy += GRAVITY * dt;
      moveActor(boss, level, dt, false);
      if (boss.phaseTime > 0.3 && boss.phaseTime < 1.2) {
        if (Math.random() < 0.5) {
          const aim = Math.atan2(
            (player.y + player.h / 2) - (boss.y + boss.h / 2),
            (player.x + player.w / 2) - (boss.x + boss.w / 2)
          );
          state.enemyProjectiles.push(makeEnemyBullet(
            boss.x + boss.w / 2 + boss.facing * 40,
            boss.y + 28,
            Math.cos(aim) * 260,
            Math.sin(aim) * 260,
            "fire"
          ));
        }
      }
      if (boss.phaseTime > 1.4) { boss.phase = "patrol"; boss.phaseTime = 0; }
    } else if (boss.phase === "shockwave") {
      boss.vx *= 0.9;
      boss.vy += GRAVITY * dt;
      moveActor(boss, level, dt, false);
      if (boss.phaseTime > 0.5 && boss.phaseTime < 0.6) {
        shake(0.18, 8);
        for (let i = 0; i < 8; i += 1) {
          const angle = (Math.PI * 2 * i) / 8;
          state.enemyProjectiles.push(makeEnemyBullet(
            boss.x + boss.w / 2,
            boss.y + boss.h / 2,
            Math.cos(angle) * 240,
            Math.sin(angle) * 240 - 60,
            "spark"
          ));
        }
        play("hurt");
      }
      if (boss.phaseTime > 1.1) { boss.phase = "patrol"; boss.phaseTime = 0; }
    } else if (boss.phase === "dying") {
      boss.vy += GRAVITY * 0.4 * dt;
      boss.x += boss.vx * dt;
      boss.y += boss.vy * dt;
      if (Math.random() < 0.7) {
        spawnParticle(
          boss.x + Math.random() * boss.w,
          boss.y + Math.random() * boss.h,
          Math.random() < 0.5 ? "#ffc93c" : "#ff8a47",
          4 + Math.random() * 4,
          (Math.random() - 0.5) * 160,
          -120 - Math.random() * 160,
          0.8
        );
      }
      if (boss.phaseTime > 2.2) {
        boss.alive = false;
        state.flash = 1.1;
        shake(0.6, 16);
        spawnBurst(boss.x + boss.w / 2, boss.y + boss.h / 2, "#ffc93c", 80, 600);
        unlockAchievement("boss_slain");
        showToast("The Core Dragon falls. Legend.", 2600);
        addScore(5000);
        setTimeout(() => { if (state.mode === "playing") finishGame(); }, 2200);
      }
    }

    // Boss vs player contact
    if (rectsOverlap(player, boss) && boss.phase !== "dying") {
      const stomping = player.vy > 40 && player.y + player.h - boss.y < 36;
      if (stomping) {
        hitBoss(boss, 1, player.x + player.w / 2, player.y + player.h, "stomp");
        player.vy = -620;
      } else if (player.dashTimer > 0) {
        hitBoss(boss, 1, player.x + player.w / 2, player.y + player.h / 2, "dash");
        player.vx = -player.facing * 260;
      } else if (player.starTimer > 0) {
        hitBoss(boss, 2, player.x + player.w / 2, player.y + player.h / 2, "star");
      } else {
        hurtPlayer("boss");
      }
    }
  }

  function hitBoss(boss, dmg, hx, hy, kind) {
    if (boss.phase === "dying" || boss.hurtFlash > 0.1) return;
    boss.hp -= dmg;
    boss.hurtFlash = 0.4;
    state.slowMo = 0.22;
    state.flash = 0.4;
    shake(0.18, 8);
    spawnBurst(hx, hy, "#ffc93c", 26, 280);
    addScore(500 * dmg);
    addFlow(10, kind === "star" ? "STAR SMASH" : "HIT!", hx, hy, "#ffc93c");
    play("stomp");
    if (boss.hp <= 0) {
      boss.phase = "dying";
      boss.phaseTime = 0;
      boss.vx = 0;
      boss.vy = -420;
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
      state.totalCoinsLifetime += 1;
      save.totalCoins = state.totalCoinsLifetime;
      state.coinChain += 1;
      state.coinChainTimer = 1.8;
      const chainBonus = Math.min(state.coinChain * 20, 400);
      addScore(100 + chainBonus);
      if (state.coinChain >= 3) {
        spawnFloater(cx, cy - 12, `x${state.coinChain}`, "#ffc93c");
      }
      if (state.coins > 0 && state.coins % 100 === 0) {
        state.lives = Math.min(9, state.lives + 1);
        showToast("1-UP! Extra life.", 1400);
        spawnBurst(cx, cy, "#3bb273", 32, 320);
        play("power");
      }
      if (!state.player.onGround || state.flowTimer > 0) addFlow(2, null, cx, cy);
      spawnBurst(cx, cy, "#ffc93c", 9, 150);
      unlockAchievement("first_coin");
      if (state.totalCoinsLifetime >= 100) unlockAchievement("hundred_coins");
      if (state.totalCoinsLifetime >= 500) unlockAchievement("five_hundred_coins");
      persist();
      play("coin");
    } else if (item.kind === "gem") {
      state.gems += 1;
      addScore(750);
      addFlow(22, "SKY GEM", cx, cy, "#7bdff2");
      spawnBurst(cx, cy, "#7bdff2", 20, 220);
      showToast(`Sky gem ${state.gems}/${state.totalGems}`, 1300);
      unlockAchievement("first_gem");
      if (state.gems === state.totalGems && state.totalGems > 0) unlockAchievement("all_gems");
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
    } else if (item.kind === "star") {
      state.player.starTimer = 9;
      addScore(500);
      addFlow(24, "STAR POWER!", cx, cy, "#ffc93c");
      spawnBurst(cx, cy, "#ffc93c", 36, 340);
      shake(0.14, 7);
      showToast("Star power! Invincible - crash through anything!", 2200);
      play("power");
    } else if (item.kind === "fireflower") {
      state.player.hasFire = true;
      state.player.fireCooldown = 0;
      addScore(500);
      addFlow(14, "FIRE FLOWER", cx, cy, "#ff8a47");
      spawnBurst(cx, cy, "#ff8a47", 28, 280);
      showToast("Fire flower! Press F or J to throw fireballs.", 2400);
      play("power");
    } else if (item.kind === "shield") {
      state.player.hasShield = true;
      addScore(400);
      addFlow(10, "SHIELD", cx, cy, "#7bdff2");
      spawnBurst(cx, cy, "#7bdff2", 28, 260);
      showToast("Bubble shield. Absorbs one hit.", 2000);
      play("power");
    }
  }

  function updateCombo(dt) {
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) { state.comboChain = 0; state.combo = 0; }
    }
    if (state.coinChainTimer > 0) {
      state.coinChainTimer -= dt;
      if (state.coinChainTimer <= 0) state.coinChain = 0;
    }
    if (state.slowMo > 0) state.slowMo -= dt;
  }

  function unlockAchievement(id) {
    if (save.achievements[id]) return;
    save.achievements[id] = Date.now();
    persist();
    const def = achievementIndex.get(id);
    if (def) {
      state.achievementToasts.push({ name: def.name, desc: def.desc, life: 4 });
      play("gem");
    }
  }

  function updateAchievementToasts(dt) {
    for (const toast of state.achievementToasts) toast.life -= dt;
    state.achievementToasts = state.achievementToasts.filter((t) => t.life > 0);
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
          else {
            if (actor.vx > 0) actor.wallContact = 1;
            else if (actor.vx < 0) actor.wallContact = -1;
            actor.vx = 0;
          }
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
    if (tile === "?") {
      openPrizeBlock(tx, ty);
      return;
    }
    if (tile !== "B") return;
    const px = tx * TILE + TILE / 2;
    const py = ty * TILE;
    play("block");
    shake(0.08, 4);
    spawnBurst(px, py + 8, "#ff8a47", 12, 110);
    if (Math.abs(state.player.vx) > 520) {
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
    if (player.starTimer > 0) return;
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
        state.comboChain = Math.max(state.comboChain, state.combo);
        state.comboTimer = 2.4;
        if (state.combo >= 5) unlockAchievement("combo5");
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
      } else if (player.starTimer > 0) {
        enemy.alive = false;
        state.combo += 1;
        addScore(300 * state.combo);
        addFlow(15, "STAR CRUSH", enemy.x + enemy.w / 2, enemy.y, "#ffc93c");
        spawnBurst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, "#ffc93c", 22, 260);
        play("stomp");
      } else {
        hurtPlayer("enemy");
      }
    }
  }

  function checkGate(player, level) {
    const gate = level.gate;
    if (level.isBossArena || !gate || !rectsOverlap(player, gate)) return;
    state.mode = "levelClear";
    const timeBonus = Math.max(0, 600 - Math.floor(state.elapsed)) * 3;
    addScore(state.gems * 1000 + timeBonus);
    spawnBurst(gate.x + gate.w / 2, gate.y + gate.h / 2, "#7bdff2", 48, 340);
    play("gate");
    shake(0.25, 8);
    recordLevelStat(state.levelIndex, {
      cleared: true,
      bestTime: state.elapsed,
      bestScore: state.score,
      bestGems: state.gems,
      noHit: !state.hitThisLevel
    });
    if (!state.hitThisLevel) unlockAchievement("no_hit_level");
    if (state.elapsed < 45) unlockAchievement("speedrun");
    save.unlocked = Math.max(save.unlocked, state.levelIndex + 2);
    persist();
    const missing = state.totalGems - state.gems;
    const gemNote = missing > 0 ? `${missing} sky gem${missing === 1 ? "" : "s"} left behind.` : "All sky gems found.";
    const isFinal = state.levelIndex >= levelDefs.length - 1;
    showOverlay(`${level.name} cleared`, `${gemNote} Coins: ${state.coins}. Score: ${state.score.toLocaleString()}.`, isFinal ? "Finish run" : "Next world");
  }

  function recordLevelStat(idx, patch) {
    const prev = save.levels[idx] || {};
    const merged = { ...prev };
    if (patch.cleared) merged.cleared = true;
    if (patch.noHit) merged.noHit = true;
    if (patch.bestTime !== undefined && (!merged.bestTime || patch.bestTime < merged.bestTime)) merged.bestTime = patch.bestTime;
    if (patch.bestScore !== undefined && (!merged.bestScore || patch.bestScore > merged.bestScore)) merged.bestScore = patch.bestScore;
    if (patch.bestGems !== undefined && (!merged.bestGems || patch.bestGems > merged.bestGems)) merged.bestGems = patch.bestGems;
    save.levels[idx] = merged;
    persist();
  }

  function hurtPlayer(reason) {
    const player = state.player;
    if (player.invuln > 0 && reason !== "fall") return;
    if (player.hasShield && reason !== "fall") {
      player.hasShield = false;
      player.invuln = 1.2;
      player.shieldPulse = 0.5;
      player.vx = -player.facing * 260;
      player.vy = -320;
      spawnBurst(player.x + player.w / 2, player.y + player.h / 2, "#7bdff2", 32, 300);
      shake(0.18, 7);
      play("ring");
      showToast("Shield absorbed the hit!", 1100);
      unlockAchievement("shield_save");
      return;
    }
    state.hitThisLevel = true;
    state.combo = 0;
    state.comboChain = 0;
    state.coinChain = 0;
    state.flow = Math.max(0, state.flow - (state.assistMode ? 16 : 30));
    state.flowTimer = 0;
    const heartLoss = state.assistMode && reason === "fall" ? 0 : 1;
    state.hearts -= heartLoss;
    player.invuln = state.assistMode ? 1.8 : 1.2;
    player.dashTimer = 0;
    player.vx = -player.facing * (state.assistMode ? 260 : 360);
    player.vy = state.assistMode ? -360 : -430;
    shake(0.25, 9);
    spawnBurst(player.x + player.w / 2, player.y + player.h / 2, "#f05d4f", 18, 220);
    play("hurt");
    if (state.hearts <= 0) {
      if (state.lives > 1) {
        state.lives -= 1;
        state.hearts = state.assistMode ? 5 : 3;
        showToast(`Life lost. ${state.lives} left.`, 1400);
        respawn();
      } else {
        gameOver();
      }
    }
    else if (reason === "fall") respawn();
    else showToast(state.assistMode ? "Assist softened that hit. Keep moving." : "Ouch. Find a heart or keep moving.", 1200);
  }

  function respawn() {
    const player = state.player;
    player.x = player.checkpoint.x;
    player.y = player.checkpoint.y;
    player.vx = 0;
    player.vy = 0;
    player.invuln = 1.6;
    player.onGround = false;
    showToast(state.assistMode ? "Assist saved the fall. Back to the checkpoint." : "Back to the checkpoint.", 1200);
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
    if (state.zenMode) {
      count = Math.max(1, Math.ceil(count * 0.45));
      speed *= 0.72;
    }
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
    if (hudScore) hudScore.textContent = state.score.toLocaleString();
    hudCoins.textContent = String(state.coins);
    hudGems.textContent = `${state.gems}/${state.totalGems || 0}`;
    const h = Math.max(0, state.hearts);
    hudHearts.textContent = "\u2665".repeat(h) + "\u2661".repeat(Math.max(0, 5 - h));
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
    if (state.zenMode) {
      time *= 0.25;
      power *= 0.25;
    }
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
    drawTurrets(level);
    drawPickups(level);
    drawEnemies(level);
    drawEnemyProjectiles();
    drawFireballs();
    drawBoss(level);
    drawPlayer(state.player || makePlayer(level.spawn.x, level.spawn.y));
    drawParticles();
    drawFloaters();
    ctx.restore();
    drawWeather(theme, width, height);
    drawVignette(width, height);
    if (state.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, state.flash);
      ctx.fillStyle = "#fff8ef";
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
    if (state.transition > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, state.transition / 0.7);
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
    drawHudOverlay(width, height);
    drawMinimap(level, width, height);
    drawAchievementToasts(width, height);
    drawBossHp(level, width, height);
    drawCoinChain(width, height);
  }

  function drawVignette(width, height) {
    const grad = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.75);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.42)");
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  function drawHudOverlay(width, height) {
    if (state.mode !== "playing") return;
    ctx.save();
    ctx.fillStyle = "rgba(24,24,24,0.55)";
    ctx.fillRect(14, height - 50, 132, 36);
    ctx.strokeStyle = "#181818";
    ctx.lineWidth = 2;
    ctx.strokeRect(14, height - 50, 132, 36);
    ctx.fillStyle = "#ff8a47";
    ctx.font = "900 16px Trebuchet MS, Segoe UI, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(`LIVES x${state.lives}`, 22, height - 32);
    if (state.player && state.player.hasFire) {
      ctx.fillStyle = "#ffc93c";
      ctx.fillText("FIRE", 92, height - 32);
    }
    if (state.player && state.player.hasShield) {
      ctx.fillStyle = "#7bdff2";
      ctx.fillText("•", 128, height - 32);
    }
    ctx.restore();
  }

  function drawMinimap(level, width, height) {
    if (!level || state.mode !== "playing") return;
    const mapW = 180;
    const mapH = 60;
    const mx = width - mapW - 14;
    const my = height - mapH - 14;
    ctx.save();
    ctx.fillStyle = "rgba(24,24,24,0.6)";
    ctx.fillRect(mx, my, mapW, mapH);
    ctx.strokeStyle = "#181818";
    ctx.lineWidth = 2;
    ctx.strokeRect(mx, my, mapW, mapH);
    const sx = mapW / level.width;
    const sy = mapH / level.height;
    ctx.fillStyle = "rgba(255,248,239,0.3)";
    for (let y = 0; y < level.height; y += 1) {
      for (let x = 0; x < level.width; x += 1) {
        const t = level.tiles[y][x];
        if (t === "#" || t === "B" || t === "?" || t === "U") ctx.fillRect(mx + x * sx, my + y * sy, Math.max(1, sx), Math.max(1, sy));
      }
    }
    if (level.gate) {
      ctx.fillStyle = "#7bdff2";
      ctx.fillRect(mx + (level.gate.x / TILE) * sx - 1, my + (level.gate.y / TILE) * sy - 1, 4, 4);
    }
    if (level.boss && level.boss.alive) {
      ctx.fillStyle = "#f05d4f";
      ctx.fillRect(mx + (level.boss.x / TILE) * sx - 2, my + (level.boss.y / TILE) * sy - 2, 5, 5);
    }
    if (state.player) {
      ctx.fillStyle = "#ffc93c";
      ctx.fillRect(mx + (state.player.x / TILE) * sx - 2, my + (state.player.y / TILE) * sy - 2, 4, 4);
    }
    ctx.restore();
  }

  function drawAchievementToasts(width, height) {
    if (!state.achievementToasts.length) return;
    ctx.save();
    let yy = height - 110;
    ctx.font = "900 15px Trebuchet MS, Segoe UI, sans-serif";
    ctx.textBaseline = "top";
    for (const t of state.achievementToasts) {
      const alpha = Math.min(1, t.life / 4) * Math.min(1, (4 - t.life) / 0.3);
      ctx.globalAlpha = Math.max(0.1, alpha);
      ctx.fillStyle = "rgba(24,24,24,0.85)";
      ctx.fillRect(width / 2 - 170, yy, 340, 48);
      ctx.strokeStyle = "#ffc93c";
      ctx.lineWidth = 3;
      ctx.strokeRect(width / 2 - 170, yy, 340, 48);
      ctx.fillStyle = "#ffc93c";
      ctx.fillText("★ " + t.name, width / 2 - 160, yy + 6);
      ctx.fillStyle = "#fff8ef";
      ctx.font = "700 12px Trebuchet MS, Segoe UI, sans-serif";
      ctx.fillText(t.desc, width / 2 - 160, yy + 26);
      ctx.font = "900 15px Trebuchet MS, Segoe UI, sans-serif";
      yy -= 54;
    }
    ctx.restore();
  }

  function drawBossHp(level, width, height) {
    const boss = level && level.boss;
    if (!boss || !boss.alive || boss.phase === "intro") return;
    const w = Math.min(520, width - 60);
    const x = width / 2 - w / 2;
    const y = 90;
    ctx.save();
    ctx.fillStyle = "rgba(24,24,24,0.75)";
    ctx.fillRect(x - 4, y - 4, w + 8, 28);
    ctx.strokeStyle = "#181818";
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 4, y - 4, w + 8, 28);
    ctx.fillStyle = "#3a0800";
    ctx.fillRect(x, y, w, 20);
    const ratio = Math.max(0, boss.hp / boss.maxHp);
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, "#ffc93c");
    grad.addColorStop(0.5, "#ff8a47");
    grad.addColorStop(1, "#f05d4f");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w * ratio, 20);
    ctx.fillStyle = "#fff8ef";
    ctx.font = "900 14px Trebuchet MS, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("THE CORE DRAGON", width / 2, y + 10);
    ctx.restore();
  }

  function drawCoinChain(width, height) {
    if (state.coinChain < 3) return;
    ctx.save();
    ctx.font = "900 18px Trebuchet MS, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffc93c";
    ctx.strokeStyle = "#181818";
    ctx.lineWidth = 4;
    ctx.strokeText(`COIN CHAIN x${state.coinChain}`, width / 2, 60);
    ctx.fillText(`COIN CHAIN x${state.coinChain}`, width / 2, 60);
    ctx.restore();
  }

  function drawFireballs() {
    for (const fb of state.fireballs) {
      ctx.save();
      ctx.translate(fb.x, fb.y);
      ctx.rotate(fb.t * 12);
      const r = 9 + Math.sin(fb.t * 18) * 1.5;
      const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, r + 4);
      grad.addColorStop(0, "#ffc93c");
      grad.addColorStop(0.6, "#ff8a47");
      grad.addColorStop(1, "rgba(240,93,79,0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffc93c";
      ctx.strokeStyle = "#181818";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawEnemyProjectiles() {
    for (const b of state.enemyProjectiles) {
      ctx.save();
      ctx.translate(b.x, b.y);
      if (b.kind === "fire") {
        const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, 14);
        grad.addColorStop(0, "#ffc93c");
        grad.addColorStop(1, "rgba(240,93,79,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#f05d4f";
        ctx.strokeStyle = "#181818";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.rotate(b.t * 10);
        ctx.fillStyle = "#f05d4f";
        ctx.strokeStyle = "#181818";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 6; i += 1) {
          const a = (Math.PI * 2 * i) / 6;
          const rr = i % 2 === 0 ? 8 : 4;
          ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawTurrets(level) {
    for (const turret of level.turrets) {
      if (!turret.alive) continue;
      const x = turret.x;
      const y = turret.y;
      ctx.save();
      ctx.fillStyle = "#26313a";
      ctx.strokeStyle = "#181818";
      ctx.lineWidth = 3;
      ctx.fillRect(x + 4, y + 12, turret.w - 8, turret.h - 12);
      ctx.strokeRect(x + 4, y + 12, turret.w - 8, turret.h - 12);
      ctx.fillStyle = "#f05d4f";
      ctx.fillRect(x + 10, y + 4, turret.w - 20, 12);
      ctx.strokeRect(x + 10, y + 4, turret.w - 20, 12);
      ctx.fillStyle = turret.cooldown < 0.3 ? "#ffc93c" : "#fff8ef";
      ctx.beginPath();
      ctx.arc(x + turret.w / 2, y + 10, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawBoss(level) {
    const boss = level.boss;
    if (!boss || !boss.alive) return;
    const bx = boss.x + boss.shakeOffset;
    const by = boss.y;
    ctx.save();
    ctx.translate(bx + boss.w / 2, by + boss.h / 2);
    ctx.scale(boss.facing, 1);
    const flashT = boss.hurtFlash > 0 ? 1 : 0;
    const bodyColor = flashT ? "#fff8ef" : "#8b1a00";
    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = "#181818";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(0, 8, boss.w / 2, boss.h / 2 - 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = flashT ? "#fff8ef" : "#e84c00";
    ctx.beginPath();
    ctx.ellipse(-boss.w / 2 + 10, -boss.h / 2 + 16, 24, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffc93c";
    ctx.beginPath();
    ctx.arc(-boss.w / 2 + 18, -boss.h / 2 + 12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#181818";
    ctx.beginPath();
    ctx.arc(-boss.w / 2 + 20, -boss.h / 2 + 12, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffc93c";
    ctx.beginPath();
    for (let i = -2; i <= 2; i += 1) {
      ctx.moveTo(i * 14 + 6, -boss.h / 2 + 8);
      ctx.lineTo(i * 14 - 2, -boss.h / 2 - 8);
      ctx.lineTo(i * 14 + 14, -boss.h / 2 - 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
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
      else if (theme.ground === "crystal") drawCrystalTile(x, y);
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

  function drawCrystalTile(x, y) {
    ctx.fillStyle = "#c8eeff";
    ctx.strokeStyle = "#181818";
    ctx.lineWidth = 3;
    ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 6);
    ctx.lineTo(x + 18, y + 22);
    ctx.moveTo(x + 28, y + 8);
    ctx.lineTo(x + 38, y + 28);
    ctx.moveTo(x + 14, y + 32);
    ctx.lineTo(x + 24, y + 42);
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
    if (player.starTimer > 0) {
      const pulse = Math.sin(state.elapsed * 22) * 0.4 + 0.6;
      ctx.save();
      ctx.globalAlpha = pulse * 0.7;
      ctx.strokeStyle = "#ffc93c";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.ellipse(0, 4, 32 + Math.sin(state.elapsed * 18) * 5, 40, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = pulse * 0.25;
      ctx.fillStyle = "#ffc93c";
      ctx.fill();
      ctx.restore();
      if (Math.random() < 0.5) {
        spawnParticle(
          (Math.random() - 0.5) * 48,
          (Math.random() - 0.5) * 54,
          "#ffc93c", 2 + Math.random() * 3, 0, -80, 0.35
        );
      }
    }
    drawSprite(sprite, -23, -27, 46, 54);
    if (player.hasShield) {
      ctx.save();
      const pulse = 0.35 + Math.sin(state.elapsed * 8) * 0.1;
      ctx.globalAlpha = pulse;
      const grad = ctx.createRadialGradient(0, 0, 6, 0, 0, 38);
      grad.addColorStop(0, "rgba(123,223,242,0)");
      grad.addColorStop(0.6, "rgba(123,223,242,0.35)");
      grad.addColorStop(1, "rgba(123,223,242,0.8)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 2, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#7bdff2";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    if (player.shieldPulse > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, player.shieldPulse * 2);
      ctx.strokeStyle = "#7bdff2";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 2, 40 + (1 - player.shieldPulse * 2) * 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
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
      if (weather === "ember" || weather === "lava") {
        ctx.fillStyle = weather === "lava" ? "rgba(255, 120, 20, 0.8)" : "rgba(255, 201, 60, 0.75)";
        ctx.fillRect(particle.x, particle.y, particle.r * 2, particle.r * 4);
      } else if (weather === "glow") {
        ctx.fillStyle = "rgba(123, 223, 242, 0.46)";
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.r * 2.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (weather === "snow") {
        ctx.fillStyle = "rgba(220, 240, 255, 0.78)";
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = "rgba(255, 201, 60, 0.52)";
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    if (state.flow >= 55 && state.mode === "playing" && !state.zenMode) {
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
      star: "#ffc93c",
      grass: "#3bb273",
      brick: "#ff8a47",
      prize: "#ffc93c",
      used: "#b58d4a",
      spike: "#fff8ef",
      platform: "#7bdff2",
      chaser: "#f05d4f"
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
    const slow = state.slowMo > 0 ? 0.35 : 1;
    const dt = Math.min(MAX_DT, rawDt) * slow;
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
      if (key === "f" || key === "j") state.input.firePressed = true;
    }
    state.keys.add(key);
    if (state.mode === "menu" && (key === "enter" || key === " ")) startGame();
    else if (state.mode === "levelClear" && (key === "enter" || key === " ")) nextLevel();
    else if ((state.mode === "gameOver" || state.mode === "win") && (key === "enter" || key === " ")) startGame();
    else if (key === "p" && state.mode === "playing") {
      state.mode = "paused";
      stopMusic();
      showOverlay("Paused", "Catch your breath. The Cloudworks can wait for a few seconds.", "Resume");
    } else if (key === "p" && state.mode === "paused") {
      state.mode = "playing";
      overlay.classList.add("hidden");
      startMusic();
    } else if (key === "r" && state.mode === "playing") {
      initLevel(state.levelIndex);
      stopMusic();
      startMusic();
      showToast("World restarted.", 1000);
    } else if (key === "m") {
      toggleMute();
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

  function toggleMute() {
    state.muted = !state.muted;
    localStorage.setItem("pipebound-muted", state.muted ? "1" : "0");
    updateModeButtons();
    if (state.muted) stopMusic();
    else if (state.mode === "playing") startMusic();
  }

  function toggleAssist() {
    state.assistMode = !state.assistMode;
    localStorage.setItem("pipebound-assist", state.assistMode ? "1" : "0");
    updateModeButtons();
    if (state.mode === "playing") {
      if (state.assistMode) state.hearts = Math.max(state.hearts, 5);
      updateHud();
      showToast(state.assistMode ? "Assist on: extra hearts, easier jumps, softer hits." : "Assist off. Classic challenge restored.", 1800);
    }
  }

  function toggleZen() {
    state.zenMode = !state.zenMode;
    localStorage.setItem("pipebound-zen", state.zenMode ? "1" : "0");
    if (state.level) buildAtmosphere();
    updateModeButtons();
    if (state.mode === "playing") {
      showToast(state.zenMode ? "Zen on: fewer particles and calmer camera shake." : "Zen off: full sparkle and impact.", 1600);
    }
  }

  function updateModeButtons() {
    if (btnMute) btnMute.classList.toggle("muted", state.muted);
    if (btnAssist) {
      btnAssist.classList.toggle("active", state.assistMode);
      btnAssist.setAttribute("aria-pressed", String(state.assistMode));
    }
    if (btnZen) {
      btnZen.classList.toggle("active", state.zenMode);
      btnZen.setAttribute("aria-pressed", String(state.zenMode));
    }
  }

  overlayButton.addEventListener("click", () => {
    ensureAudio();
    if (state.mode === "menu" || state.mode === "gameOver" || state.mode === "win") showMainMenu();
    else if (state.mode === "levelClear") nextLevel();
    else if (state.mode === "paused") {
      state.mode = "playing";
      overlay.classList.add("hidden");
      startMusic();
    }
    else if (state.mode === "levelSelect" || state.mode === "credits") showMainMenu();
  });

  function showMainMenu() {
    state.mode = "menu";
    overlayTitle.textContent = "Pip and the Cloudworks";
    overlayText.innerHTML = "Sprint across five handcrafted worlds. Chain stomps, fireballs, dashes and wall-jumps. Save the Cloudworks. Slay the Core Dragon.";
    overlayButton.textContent = "Start run";
    overlay.classList.remove("hidden");
    renderMenuExtras();
  }

  function showLevelSelect() {
    state.mode = "levelSelect";
    overlayTitle.textContent = "Level Select";
    overlayText.innerHTML = "Pick any unlocked world. Best times and gems are saved.";
    overlayButton.textContent = "Back to menu";
    overlay.classList.remove("hidden");
    renderLevelCards();
  }

  function showCredits() {
    state.mode = "credits";
    overlayTitle.textContent = "Credits";
    overlayText.innerHTML = "Engineered with love by Claude + you.<br>Worlds, systems, art, and mayhem crafted live.<br>Music: web-audio synth with drum layer.<br>Fonts: system stack.<br>Thanks for playing.";
    overlayButton.textContent = "Back to menu";
    overlay.classList.remove("hidden");
    const panel = overlay.querySelector(".panel");
    const extras = panel.querySelector(".menu-extras");
    if (extras) extras.remove();
    const stats = document.createElement("div");
    stats.className = "menu-extras";
    const unlocked = Object.values(save.achievements || {}).length;
    stats.innerHTML = `
      <div class="stat-grid">
        <div><span>Achievements</span><strong>${unlocked}/${ACHIEVEMENTS.length}</strong></div>
        <div><span>Lifetime coins</span><strong>${save.totalCoins || 0}</strong></div>
        <div><span>Runs</span><strong>${save.totalRuns || 0}</strong></div>
      </div>
      <div class="achievements-list">${ACHIEVEMENTS.map((a) => {
        const got = save.achievements && save.achievements[a.id];
        return `<div class="ach${got ? " got" : ""}"><strong>${got ? "★" : "☆"} ${a.name}</strong><span>${a.desc}</span></div>`;
      }).join("")}</div>
    `;
    panel.insertBefore(stats, overlayButton);
  }

  function renderMenuExtras() {
    const panel = overlay.querySelector(".panel");
    const prev = panel.querySelector(".menu-extras");
    if (prev) prev.remove();
    const extras = document.createElement("div");
    extras.className = "menu-extras";
    extras.innerHTML = `
      <div class="menu-buttons">
        <button type="button" data-menu="level">Level select</button>
        <button type="button" data-menu="credits">Credits & achievements</button>
      </div>
    `;
    panel.insertBefore(extras, overlayButton);
    extras.querySelector('[data-menu="level"]').addEventListener("click", showLevelSelect);
    extras.querySelector('[data-menu="credits"]').addEventListener("click", showCredits);
  }

  function renderLevelCards() {
    const panel = overlay.querySelector(".panel");
    const prev = panel.querySelector(".menu-extras");
    if (prev) prev.remove();
    const extras = document.createElement("div");
    extras.className = "menu-extras";
    const cards = levelDefs.map((lvl, idx) => {
      const stat = save.levels[idx] || {};
      const unlocked = idx < (save.unlocked || 1);
      const bestTime = stat.bestTime ? formatTime(stat.bestTime) : "--:--";
      const bestScore = stat.bestScore ? stat.bestScore.toLocaleString() : "--";
      const gems = stat.bestGems ? `${stat.bestGems}` : "0";
      const stars = (stat.cleared ? 1 : 0) + (stat.noHit ? 1 : 0) + (stat.bestTime && stat.bestTime < 60 ? 1 : 0);
      return `
        <button class="lvl-card${unlocked ? "" : " locked"}" data-lvl="${idx}" ${unlocked ? "" : "disabled"}>
          <strong>${idx + 1}. ${lvl.name}</strong>
          <div class="lvl-stats">
            <span>Best: ${bestTime}</span>
            <span>Score: ${bestScore}</span>
            <span>Gems: ${gems}</span>
            <span>${unlocked ? "★".repeat(stars) + "☆".repeat(Math.max(0, 3 - stars)) : "LOCKED"}</span>
          </div>
        </button>
      `;
    }).join("");
    extras.innerHTML = `<div class="level-grid">${cards}</div>`;
    panel.insertBefore(extras, overlayButton);
    extras.querySelectorAll(".lvl-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.lvl);
        overlay.classList.add("hidden");
        startGame(idx);
      });
    });
  }

  window.addEventListener("resize", resize);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("pointerdown", ensureAudio, { once: true });

  // Restore mute state
  state.muted = localStorage.getItem("pipebound-muted") === "1";
  state.assistMode = localStorage.getItem("pipebound-assist") === "1";
  state.zenMode = localStorage.getItem("pipebound-zen") === "1";
  updateModeButtons();
  if (btnMute) btnMute.addEventListener("click", toggleMute);
  if (btnAssist) btnAssist.addEventListener("click", toggleAssist);
  if (btnZen) btnZen.addEventListener("click", toggleZen);

  if (btnFullscreen) {
    btnFullscreen.addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.();
      }
    });
  }

  setupTouchControls();
  resize();
  if (new URLSearchParams(window.location.search).has("playtest")) {
    state.mode = "playing";
    state.coins = 0;
    state.score = 0;
    state.hearts = state.assistMode ? 5 : 3;
    initLevel(0);
    overlay.classList.add("hidden");
  } else {
    initLevel(0);
    showMainMenu();
  }
  requestAnimationFrame(loop);

})();
