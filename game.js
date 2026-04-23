// Platanus Hack 26 — Buenos Aires Edition
// Drive-Thru Rush: Burgertronic vs Tacosaurus

const GAME_WIDTH = 800;
const GAME_HEIGHT = 600;
const STORAGE_KEY = 'hot-deploy-highscores';
const MAX_HIGH_SCORES = 10;
const WINNING_NAME_LENGTH = 3;
const MATCH_TIME_LIMIT_MS = 120000; // 2 minutes

const COLORS = {
  frame: 0x3a3a0a,
  white: 0xf7ffd8,
  burgertronic: 0xffcc00,
  tacosaurus: 0xff3b3b,
  itemBurger: 0x8b4513,
  itemFries: 0xffd84d,
  itemDrink: 0x3ba3ff,
  itemIceCream: 0xff9ec7,
  itemTaco: 0xf7c948,
  itemBurrito: 0x7a4a1e,
  itemNachos: 0xffaa00,
  lifeActive: 0xff6ec7,
  scoreText: 0xe1ff00,
  carBody: 0x5a6c8c,
  road: 0x1a1e05,
  overlay: 0x0c0e02,
};

const CABINET_KEYS = {
  P1_U: ['w'], P1_D: ['s'], P1_L: ['a'], P1_R: ['d'],
  P1_1: ['u'], P1_2: ['i'], P1_3: ['o'], P1_4: ['j'], P1_5: ['k'], P1_6: ['l'],
  P2_U: ['ArrowUp'], P2_D: ['ArrowDown'], P2_L: ['ArrowLeft'], P2_R: ['ArrowRight'],
  P2_1: ['r'], P2_2: ['t'], P2_3: ['y'], P2_4: ['f'], P2_5: ['g'], P2_6: ['h'],
  START1: ['Enter'], START2: ['2'],
};

const KEYBOARD_TO_ARCADE = {};
for (const [arcadeCode, keys] of Object.entries(CABINET_KEYS)) {
  for (const key of keys) {
    KEYBOARD_TO_ARCADE[key.toLowerCase()] = arcadeCode;
    if (key.length > 1) {
      KEYBOARD_TO_ARCADE[key] = arcadeCode;
    }
  }
}

const LETTER_GRID = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  ['H', 'I', 'J', 'K', 'L', 'M', 'N'],
  ['O', 'P', 'Q', 'R', 'S', 'T', 'U'],
  ['V', 'W', 'X', 'Y', 'Z', '.', '-'],
  ['DEL', 'END'],
];

const ZONE_CALLE = 160;
const ZONE_VENTANILLA = 80;
const ZONE_COCINA = 320;
const ZONE_MOSTRADOR = 80;
const ZONE_TIENDA = 160;

const X_CALLE = 0;
const X_VENTANILLA = X_CALLE + ZONE_CALLE;
const X_COCINA = X_VENTANILLA + ZONE_VENTANILLA;
const X_MOSTRADOR = X_COCINA + ZONE_COCINA;
const X_TIENDA = X_MOSTRADOR + ZONE_MOSTRADOR;

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-root',
  backgroundColor: '#0b0f03',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  scene: { preload, create, update }
};

new Phaser.Game(config);

function preload() { }

function create() {
  const scene = this;

  scene.state = {
    phase: 'loading',
    highScores: [],
    mode: '1P',
    menu: { cursor: 0 },
    playing: { timeElapsed: 0 },
    p1: { score: 0, comboStreak: 0, comboMult: 1, lives: 3, x: 400, y: 300, dir: 'down', body: null, ind: null },
    p2: { score: 0, comboStreak: 0, comboMult: 1, lives: 3, x: 400, y: 450, dir: 'down', body: null, ind: null },
    nameEntry: { letters: [], row: 0, col: 0, moveCooldownUntil: 0, winner: '' }
  };

  createBackground(scene);
  createHud(scene);
  createGameObjects(scene);
  createStartScreen(scene);
  createEndGameUi(scene);
  createControls(scene);

  showStartScreen(scene);

  loadHighScores().then(scores => {
    scene.state.highScores = scores;
  }).catch(() => {
    scene.state.highScores = [];
  });
}

function update(time, delta) {
  const scene = this;
  const phase = scene.state.phase;

  if (phase === 'start') {
    handleStartMenu(scene, time);
    return;
  }

  if (phase === 'playing') {
    updatePlaying(scene, time, delta);
  }

  if (phase === 'gameover') {
    handleNameEntry(scene, time);
  }
}

function createControls(scene) {
  scene.controls = { held: Object.create(null), pressed: Object.create(null) };
  const onKeyDown = (event) => {
    let key = event.key;
    if (key.length === 1 && key !== ' ') key = key.toLowerCase();
    const arcadeCode = KEYBOARD_TO_ARCADE[key];
    if (arcadeCode) {
      if (!scene.controls.held[arcadeCode]) scene.controls.pressed[arcadeCode] = true;
      scene.controls.held[arcadeCode] = true;
    }
  };
  const onKeyUp = (event) => {
    let key = event.key;
    if (key.length === 1 && key !== ' ') key = key.toLowerCase();
    const arcadeCode = KEYBOARD_TO_ARCADE[key];
    if (arcadeCode) scene.controls.held[arcadeCode] = false;
  };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
}

function consumePressed(scene, code) {
  if (scene.controls.pressed[code]) {
    scene.controls.pressed[code] = false;
    return true;
  }
  return false;
}

function createBackground(scene) {
  scene.bgElements = scene.add.group();
  scene.bgElements.add(scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 760, 560, 0x000000, 0).setStrokeStyle(4, COLORS.frame, 0.8));

  scene.bgElements.add(scene.add.rectangle(X_CALLE + ZONE_CALLE / 2, GAME_HEIGHT / 2, ZONE_CALLE, GAME_HEIGHT, COLORS.road));
  scene.bgElements.add(scene.add.rectangle(X_VENTANILLA + ZONE_VENTANILLA / 2, GAME_HEIGHT / 2, ZONE_VENTANILLA, GAME_HEIGHT, COLORS.overlay, 0.5));
  scene.bgElements.add(scene.add.rectangle(X_COCINA + ZONE_COCINA / 2, GAME_HEIGHT / 2, ZONE_COCINA, GAME_HEIGHT, 0x222222));
  scene.bgElements.add(scene.add.rectangle(X_MOSTRADOR + ZONE_MOSTRADOR / 2, GAME_HEIGHT / 2, ZONE_MOSTRADOR, GAME_HEIGHT, COLORS.overlay, 0.5));
  scene.bgElements.add(scene.add.rectangle(X_TIENDA + ZONE_TIENDA / 2, GAME_HEIGHT / 2, ZONE_TIENDA, GAME_HEIGHT, 0x111111));

  scene.divider = scene.add.rectangle(GAME_WIDTH / 2, 300, GAME_WIDTH, 8, COLORS.frame).setVisible(false);
}

function updateBackgroundForMode(scene) {
  scene.divider.setVisible(scene.state.mode === '2P');
}

function S(sz, col, bold, extra) {
  const o = { fontFamily: 'monospace', fontSize: sz + 'px', color: col };
  if (bold) o.fontStyle = 'bold';
  return extra ? Object.assign(o, extra) : o;
}

function createHud(scene) {
  scene.hud = {};
  scene.hud.p1ScoreTitle = scene.add.text(40, 20, 'FORK BURGER', S(20, '#ffcc00', 1));
  scene.hud.p1ScoreValue = scene.add.text(40, 50, 'SCORE: 0', S(20, '#e1ff00'));
  scene.hud.p1Lives = scene.add.text(GAME_WIDTH - 150, 40, 'LIVES: 3', S(20, '#ff6ec7', 1));
  scene.hud.timeCombo = scene.add.text(40, GAME_HEIGHT - 40, 'TIME 00:00   COMBO x1', S(18, '#f7ffd8'));
  scene.hud.p2ScoreTitle = scene.add.text(40, GAME_HEIGHT - 60, 'TACO STACK', S(20, '#ff3b3b', 1));
  scene.hud.p2ScoreValue = scene.add.text(40, GAME_HEIGHT - 30, 'SCORE: 0', S(20, '#ff3b3b'));
  scene.hud.p2Lives = scene.add.text(GAME_WIDTH - 150, GAME_HEIGHT - 40, 'LIVES: 3', S(20, '#ff6ec7', 1));
}

function refreshHud(scene) {
  scene.hud.p1ScoreValue.setText('SCORE: ' + scene.state.p1.score);
  scene.hud.p1Lives.setText('LIVES: ' + scene.state.p1.lives);

  if (scene.state.mode === '2P') {
    scene.hud.timeCombo.setVisible(false);
    scene.hud.p2ScoreTitle.setVisible(true);
    scene.hud.p2ScoreValue.setVisible(true).setText('SCORE: ' + scene.state.p2.score);
    scene.hud.p2Lives.setVisible(true).setText('LIVES: ' + scene.state.p2.lives);
  } else {
    scene.hud.p2ScoreTitle.setVisible(false);
    scene.hud.p2ScoreValue.setVisible(false);
    scene.hud.p2Lives.setVisible(false);
    scene.hud.timeCombo.setVisible(true);
    const totalSeconds = Math.floor(scene.state.playing.timeElapsed / 1000);
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');
    scene.hud.timeCombo.setText('TIME ' + m + ':' + s + '   COMBO x' + scene.state.p1.comboMult);
  }
}

function createGameObjects(scene) {
  scene.state.p1.obj = createChefGraphics(scene, 0, 0, COLORS.burgertronic);

  scene.state.p2.obj = createChefGraphics(scene, 0, 0, COLORS.tacosaurus);
  scene.state.p2.obj.setVisible(false);
}

function createChefGraphics(scene, x, y, mainColor) {
  const g = scene.add.graphics({ x, y });
  g.mainColor = mainColor;
  drawChef(g, 'down');
  return g;
}

function drawChef(g, dir) {
  g.clear();
  g.fillStyle(g.mainColor, 1);
  g.fillRect(-15, -15, 30, 30);
  g.fillStyle(COLORS.white, 1);
  g.fillRect(-12, -25, 24, 10);
  g.fillRect(-18, -30, 36, 12);
  g.fillStyle(0x04110b, 1);
  let ix = -5, iy = -5;
  if (dir === 'up') iy -= 10;
  else if (dir === 'down') iy += 10;
  else if (dir === 'left') ix -= 10;
  else if (dir === 'right') ix += 10;
  g.fillRect(ix, iy, 10, 10);
}

function updateChefPos(scene) {
  const p1 = scene.state.p1;
  p1.obj.setPosition(p1.x, p1.y);
  drawChef(p1.obj, p1.dir);

  const p2 = scene.state.p2;
  if (scene.state.mode === '2P') {
    p2.obj.setVisible(true);
    p2.obj.setPosition(p2.x, p2.y);
    drawChef(p2.obj, p2.dir);
  } else {
    p2.obj.setVisible(false);
  }
}

function createStartScreen(scene) {
  scene.startScreen = {};
  const c = scene.add.container(0, 0);
  scene.startScreen.container = c;
  c.setDepth(10);
  c.add(scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.overlay, 0.97));
  c.add(scene.add.text(GAME_WIDTH / 2, 150, 'HOT DEPLOY', S(42, '#ffcc00', 1)).setOrigin(0.5));
  c.add(scene.add.text(GAME_WIDTH / 2, 200, 'FORK BURGER vs TACO STACK', S(20, '#ff3b3b', 1)).setOrigin(0.5));

  scene.startScreen.modes = [];
  scene.startScreen.modes.push(scene.add.text(GAME_WIDTH / 2, 300, '1 PLAYER', S(24, '#f7ffd8')).setOrigin(0.5));
  scene.startScreen.modes.push(scene.add.text(GAME_WIDTH / 2, 350, '2 PLAYERS', S(24, '#f7ffd8')).setOrigin(0.5));
  c.add(scene.startScreen.modes[0]);
  c.add(scene.startScreen.modes[1]);
  c.setVisible(false);
}

function updateStartMenuHighlight(scene) {
  scene.startScreen.modes.forEach((txt, i) => {
    if (scene.state.menu.cursor === i) {
      txt.setText(`> ${i === 0 ? '1 PLAYER' : '2 PLAYERS'} <`).setColor('#e1ff00');
    } else {
      txt.setText(i === 0 ? '1 PLAYER' : '2 PLAYERS').setColor('#f7ffd8');
    }
  });
}

function handleStartMenu(scene, time) {
  if (consumePressed(scene, 'P1_D') || consumePressed(scene, 'P2_D')) {
    scene.state.menu.cursor = (scene.state.menu.cursor + 1) % 2;
    updateStartMenuHighlight(scene);
  }
  if (consumePressed(scene, 'P1_U') || consumePressed(scene, 'P2_U')) {
    scene.state.menu.cursor = (scene.state.menu.cursor - 1 + 2) % 2;
    updateStartMenuHighlight(scene);
  }

  if (consumePressed(scene, 'START1') || consumePressed(scene, 'START2') || consumePressed(scene, 'P1_1') || consumePressed(scene, 'P2_1')) {
    scene.startScreen.container.setVisible(false);
    startMatch(scene, scene.state.menu.cursor === 0 ? '1P' : '2P');
  }
}

function startMatch(scene, mode) {
  scene.state.phase = 'playing';
  scene.state.mode = mode;
  let p1Y = mode === '1P' ? 300 : 150;

  if (scene.state.playing && scene.state.playing.spawns) {
    scene.state.playing.spawns.forEach(s => s.g.destroy());
  }
  if (scene.state.p1.heldItemGraphics) scene.state.p1.heldItemGraphics.destroy();
  if (scene.state.p2.heldItemGraphics) scene.state.p2.heldItemGraphics.destroy();

  scene.state.p1 = { ...scene.state.p1, score: 0, comboStreak: 0, comboMult: 1, lives: 3, x: 400, y: p1Y, dir: 'down', heldItem: null, trashCount: 0, heldItemGraphics: null };
  scene.state.p2 = { ...scene.state.p2, score: 0, comboStreak: 0, comboMult: 1, lives: 3, x: 400, y: 450, dir: 'down', heldItem: null, trashCount: 0, heldItemGraphics: null };

  scene.state.playing = { timeElapsed: 0, spawns: [] };
  createSpawns(scene);

  updateBackgroundForMode(scene);
  updateChefPos(scene);
  refreshHud(scene);
}

const P1_ITEMS = [
  { id: 'burger', color: COLORS.itemBurger },
  { id: 'fries', color: COLORS.itemFries },
  { id: 'drink', color: COLORS.itemDrink },
  { id: 'icecream', color: COLORS.itemIceCream },
];
const P2_ITEMS = [
  { id: 'taco', color: COLORS.itemTaco },
  { id: 'burrito', color: COLORS.itemBurrito },
  { id: 'drink', color: COLORS.itemDrink },
  { id: 'nachos', color: COLORS.itemNachos },
];

function createSpawns(scene) {
  const s = scene.state.playing.spawns;
  P1_ITEMS.forEach((item, i) => {
    let x = X_COCINA + 40 + i * 80;
    let y = 60;
    let g = scene.add.circle(x, y, 15, item.color, 0.6);
    s.push({ x, y, id: item.id, color: item.color, g, p: 'p1' });
  });
  if (scene.state.mode === '2P') {
    P2_ITEMS.forEach((item, i) => {
      let x = X_COCINA + 40 + i * 80;
      let y = 540;
      let g = scene.add.circle(x, y, 15, item.color, 0.6);
      s.push({ x, y, id: item.id, color: item.color, g, p: 'p2' });
    });
  }
}

function createEndGameUi(scene) {
  scene.endGame = {};
  const c = scene.add.container(0, 0); c.setDepth(20);
  scene.endGame.container = c;
  c.add(scene.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.overlay, 0.98));
  scene.endGame.title = scene.add.text(GAME_WIDTH / 2, 100, 'GAME OVER', S(30, '#f7ffd8', 1)).setOrigin(0.5);
  c.add(scene.endGame.title);

  scene.endGame.scoreDisplay = scene.add.text(GAME_WIDTH / 2, 150, '', S(24, '#ffcc00', 0, { align: 'center' })).setOrigin(0.5);
  c.add(scene.endGame.scoreDisplay);

  scene.endGame.nameValue = scene.add.text(GAME_WIDTH / 2, 220, '___', S(36, '#ff6ec7', 1, { align: 'center', letterSpacing: 10 })).setOrigin(0.5);
  c.add(scene.endGame.nameValue);

  scene.endGame.gridLabels = [];
  for (let row = 0; row < LETTER_GRID.length; row++) {
    const rowValues = LETTER_GRID[row];
    const rowWidth = rowValues.length * 56;
    for (let col = 0; col < rowValues.length; col++) {
      const value = rowValues[col];
      const cellX = GAME_WIDTH / 2 - rowWidth / 2 + 28 + col * 56;
      const cellY = 320 + row * 28;
      const cell = scene.add.rectangle(cellX, cellY, value.length > 1 ? 64 : 42, 24, COLORS.road, 0.95);
      cell.setStrokeStyle(2, COLORS.frame, 0.8);
      const label = scene.add.text(cellX, cellY, value, S(value.length > 1 ? 14 : 18, '#f7fbff', 1, { align: 'center' })).setOrigin(0.5);
      scene.endGame.gridLabels.push({ cell, label, row, col, value });
      c.add(cell); c.add(label);
    }
  }
  c.setVisible(false);
}

function showStartScreen(scene) {
  scene.state.phase = 'start';
  updateStartMenuHighlight(scene);
  scene.startScreen.container.setVisible(true);
}

function updatePlaying(scene, time, delta) {
  const pState = scene.state.playing;
  pState.timeElapsed += delta;

  if (scene.state.mode === '2P' && pState.timeElapsed >= MATCH_TIME_LIMIT_MS) {
    if (scene.state.p1.score !== scene.state.p2.score) {
      endMatch2P(scene, scene.state.p1.score > scene.state.p2.score ? 'P1 WINS ON TIME' : 'P2 WINS ON TIME');
      return;
    }
    // Sudden death let it continue
  }

  handleChefMovement(scene, delta);
  handleInteractions(scene);

  if (!pState.lastHudUpdate || pState.timeElapsed - pState.lastHudUpdate >= 500) {
    pState.lastHudUpdate = pState.timeElapsed;
    refreshHud(scene);
  }
}

function handleInteractions(scene) {
  checkPlayerInteraction(scene, scene.state.p1, 'P1', 'p1');
  if (scene.state.mode === '2P') {
    checkPlayerInteraction(scene, scene.state.p2, 'P2', 'p2');
  }
}

function checkPlayerInteraction(scene, p, prefix, pKey) {
  if (consumePressed(scene, prefix + '_1')) {
    if (p.heldItem === null) {
      const spawns = scene.state.playing.spawns.filter(s => s.p === pKey);
      for (let s of spawns) {
        if (Phaser.Math.Distance.Between(p.x, p.y, s.x, s.y) < 40) {
          p.heldItem = s.id;
          p.heldItemGraphics = scene.add.circle(p.x, p.y - 30, 10, s.color, 1);
          break;
        }
      }
    }
  }

  if (consumePressed(scene, prefix + '_2')) {
    if (p.heldItem !== null) {
      p.heldItemGraphics.destroy();
      p.heldItemGraphics = null;
      p.heldItem = null;
      p.trashCount++;
      p.comboStreak = 0;
      p.comboMult = 1;
      if (p.trashCount >= 3) {
        p.trashCount = 0;
        loseLife(scene, pKey);
      }
      refreshHud(scene);
    }
  }

  if (consumePressed(scene, prefix + '_3')) {
    if (p.heldItem !== null) {
      p.heldItemGraphics.destroy();
      p.heldItemGraphics = null;
      p.heldItem = null;
      p.score += 100 * p.comboMult;
      p.comboStreak++;
      if (p.comboStreak % 5 === 0) p.comboMult = Math.min(p.comboMult + 1, 8);
      p.trashCount = 0;
      refreshHud(scene);
    }
  }

  if (p.heldItemGraphics) {
    p.heldItemGraphics.setPosition(p.x, p.y - 30);
  }
}

function loseLife(scene, playerKey) {
  scene.state[playerKey].lives--;
  scene.state[playerKey].comboStreak = 0;
  scene.state[playerKey].comboMult = 1;
  refreshHud(scene);

  if (scene.state[playerKey].lives <= 0) {
    if (scene.state.mode === '1P') {
      showGameOver(scene, 'p1');
    } else {
      let winner = playerKey === 'p1' ? 'P2 WINS (SURVIVAL)' : 'P1 WINS (SURVIVAL)';
      endMatch2P(scene, winner);
    }
  }
}

function showGameOver(scene, playerKey) {
  scene.state.phase = 'gameover';

  if (scene.state.playing && scene.state.playing.spawns) {
    scene.state.playing.spawns.forEach(s => s.g.destroy());
    scene.state.playing.spawns = [];
  }
  if (scene.state.p1.heldItemGraphics) { scene.state.p1.heldItemGraphics.destroy(); scene.state.p1.heldItemGraphics = null; }
  if (scene.state.p2.heldItemGraphics) { scene.state.p2.heldItemGraphics.destroy(); scene.state.p2.heldItemGraphics = null; }

  scene.state.nameEntry.winner = playerKey;
  scene.endGame.scoreDisplay.setText(`FINAL SCORE: ${scene.state[playerKey].score}`);
  scene.state.nameEntry.letters = [];
  scene.state.nameEntry.row = 0;
  scene.state.nameEntry.col = 0;
  updateNameEntryHighlights(scene);
  updateNameText(scene);
  scene.endGame.container.setVisible(true);
}

function endMatch2P(scene, message) {
  scene.state.phase = 'gameover';

  if (scene.state.playing && scene.state.playing.spawns) {
    scene.state.playing.spawns.forEach(s => s.g.destroy());
    scene.state.playing.spawns = [];
  }
  if (scene.state.p1.heldItemGraphics) { scene.state.p1.heldItemGraphics.destroy(); scene.state.p1.heldItemGraphics = null; }
  if (scene.state.p2.heldItemGraphics) { scene.state.p2.heldItemGraphics.destroy(); scene.state.p2.heldItemGraphics = null; }

  scene.endGame.title.setText(message);
  let topScorer = scene.state.p1.score >= scene.state.p2.score ? 'p1' : 'p2';
  scene.state.nameEntry.winner = topScorer;
  scene.endGame.scoreDisplay.setText(`HIGHEST SCORE: ${scene.state[topScorer].score}`);
  scene.state.nameEntry.letters = [];
  scene.state.nameEntry.row = 0; scene.state.nameEntry.col = 0;
  updateNameEntryHighlights(scene);
  updateNameText(scene);
  scene.endGame.container.setVisible(true);
}

function handleChefMovement(scene, delta) {
  const moveSpeed = 4 * (delta / 16.66);

  movePlayer(scene, scene.state.p1, 'P1', moveSpeed, scene.state.mode === '1P' ? [0, 600] : [0, 300]);

  if (scene.state.mode === '2P') {
    movePlayer(scene, scene.state.p2, 'P2', moveSpeed, [300, 600]);
  }

  updateChefPos(scene);
}

function movePlayer(scene, p, prefix, speed, yBounds) {
  let dx = 0; let dy = 0;
  if (scene.controls.held[prefix + '_U']) { dy -= speed; p.dir = 'up'; }
  if (scene.controls.held[prefix + '_D']) { dy += speed; p.dir = 'down'; }
  if (scene.controls.held[prefix + '_L']) { dx -= speed; p.dir = 'left'; }
  if (scene.controls.held[prefix + '_R']) { dx += speed; p.dir = 'right'; }

  p.x += dx;
  p.y += dy;

  p.x = Phaser.Math.Clamp(p.x, X_COCINA + 15, X_COCINA + ZONE_COCINA - 15);
  p.y = Phaser.Math.Clamp(p.y, yBounds[0] + 15, yBounds[1] - 15);
}

function updateNameEntryHighlights(scene) {
  const activeRow = scene.state.nameEntry.row;
  const activeCol = scene.state.nameEntry.col;
  scene.endGame.gridLabels.forEach(({ cell, label, row, col }) => {
    const isActive = row === activeRow && col === activeCol;
    cell.setFillStyle(isActive ? COLORS.scoreText : COLORS.road, isActive ? 1 : 0.95);
    label.setColor(isActive ? '#04110b' : '#f7fbff');
  });
}

function updateNameText(scene) {
  const letters = scene.state.nameEntry.letters;
  let text = '';
  for (let i = 0; i < WINNING_NAME_LENGTH; i += 1) {
    if (i < letters.length) text += letters[i];
    else if (i === letters.length) text += '_';
    else text += ' ';
  }
  scene.endGame.nameValue.setText(text);
}

function handleNameEntry(scene, time) {
  if (time < scene.state.nameEntry.moveCooldownUntil) return;

  let moved = false;
  if (consumePressed(scene, 'P1_U') && scene.state.nameEntry.row > 0) { scene.state.nameEntry.row -= 1; moved = true; }
  if (consumePressed(scene, 'P1_D') && scene.state.nameEntry.row < LETTER_GRID.length - 1) { scene.state.nameEntry.row += 1; moved = true; }
  if (consumePressed(scene, 'P1_L') && scene.state.nameEntry.col > 0) { scene.state.nameEntry.col -= 1; moved = true; }
  if (consumePressed(scene, 'P1_R') && scene.state.nameEntry.col < LETTER_GRID[scene.state.nameEntry.row].length - 1) { scene.state.nameEntry.col += 1; moved = true; }

  if (moved) {
    scene.state.nameEntry.col = Math.min(scene.state.nameEntry.col, LETTER_GRID[scene.state.nameEntry.row].length - 1);
    scene.state.nameEntry.moveCooldownUntil = time + 150;
    updateNameEntryHighlights(scene);
  }

  if (consumePressed(scene, 'P1_1') || consumePressed(scene, 'START1')) {
    const val = LETTER_GRID[scene.state.nameEntry.row][scene.state.nameEntry.col];
    if (val === 'DEL') {
      if (scene.state.nameEntry.letters.length > 0) { scene.state.nameEntry.letters.pop(); updateNameText(scene); }
    } else if (val === 'END' || scene.state.nameEntry.letters.length === WINNING_NAME_LENGTH) {
      saveScoreAndReturn(scene);
    } else if (scene.state.nameEntry.letters.length < WINNING_NAME_LENGTH) {
      scene.state.nameEntry.letters.push(val);
      updateNameText(scene);
      if (scene.state.nameEntry.letters.length === WINNING_NAME_LENGTH) saveScoreAndReturn(scene);
    }
  }
}

async function loadHighScores() {
  if (!window.platanusArcadeStorage) return [];
  const res = await window.platanusArcadeStorage.get(STORAGE_KEY);
  if (res.found && Array.isArray(res.value)) return res.value.slice(0, MAX_HIGH_SCORES);
  return [];
}

async function saveScoreAndReturn(scene) {
  let nameStr = scene.state.nameEntry.letters.join('').trim();
  if (!nameStr) nameStr = '???';

  const sc = scene.state[scene.state.nameEntry.winner].score;
  const entry = { name: nameStr, score: sc, mode: scene.state.mode, date: new Date().toISOString() };

  const newHighScores = [...scene.state.highScores, entry];
  newHighScores.sort((a, b) => b.score - a.score);
  const toSave = newHighScores.slice(0, MAX_HIGH_SCORES);
  scene.state.highScores = toSave;

  if (window.platanusArcadeStorage) {
    try { await window.platanusArcadeStorage.set(STORAGE_KEY, toSave); } catch (e) { }
  }

  scene.endGame.container.setVisible(false);
  scene.endGame.title.setText('GAME OVER'); // reset for next time
  showStartScreen(scene);
}
