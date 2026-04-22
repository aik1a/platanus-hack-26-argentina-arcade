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

const LANES_1P = [200, 380];
const LANES_2P = [130, 220, 380, 470]; // 0,1 for P1. 2,3 for P2.

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

function preload() {}

function create() {
  const scene = this;

  scene.state = {
    phase: 'loading',
    highScores: [],
    mode: '1P',
    menu: { cursor: 0 },
    playing: {
      cars: [],
      nextSpawnTime: 0,
      timeElapsed: 0,
    },
    p1: { score: 0, comboStreak: 0, comboMult: 1, lives: 3, laneIndex: 0, lockoutUntil: 0, obj: null },
    p2: { score: 0, comboStreak: 0, comboMult: 1, lives: 3, laneIndex: 0, lockoutUntil: 0, obj: null },
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
  
  // We will dynamic draw the lines later based on mode, for now draw 4 lanes placeholders
  scene.laneRects = [];
  scene.divider = scene.add.rectangle(GAME_WIDTH / 2, 300, 760, 8, COLORS.frame).setVisible(false);
  
  for (let i=0; i<4; i++) {
      let r = scene.add.rectangle(GAME_WIDTH / 2, 0, 760, 60, COLORS.road);
      let dash = scene.add.rectangle(GAME_WIDTH / 2, 0, 760, 2, COLORS.white, 0.3);
      scene.laneRects.push({ r, dash });
      scene.bgElements.add(r); scene.bgElements.add(dash);
  }
}

function updateBackgroundForMode(scene) {
    const lanes = scene.state.mode === '1P' ? LANES_1P : LANES_2P;
    scene.laneRects.forEach((rectData, i) => {
        rectData.r.setY(lanes[i]);
        rectData.dash.setY(lanes[i]);
    });
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
  scene.state.p1.obj = scene.add.rectangle(60, 0, 30, 45, COLORS.burgertronic);
  scene.state.p2.obj = scene.add.rectangle(60, 0, 30, 45, COLORS.tacosaurus);
  scene.state.p2.obj.setVisible(false);
}

function updateChefPos(scene) {
  const lanes = scene.state.mode === '1P' ? LANES_1P : LANES_2P;
  if(scene.state.mode === '1P') {
      scene.state.p1.obj.setY(lanes[scene.state.p1.laneIndex]);
      scene.state.p2.obj.setVisible(false);
  } else {
      scene.state.p2.obj.setVisible(true);
      scene.state.p1.obj.setY(lanes[scene.state.p1.laneIndex]); // 0 or 1
      scene.state.p2.obj.setY(lanes[scene.state.p2.laneIndex + 2]); // 2 or 3
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
            txt.setText(`> ${i===0?'1 PLAYER':'2 PLAYERS'} <`).setColor('#e1ff00');
        } else {
            txt.setText(i===0?'1 PLAYER':'2 PLAYERS').setColor('#f7ffd8');
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

  if (consumePressed(scene, 'START1') || consumePressed(scene, 'START2')) {
    scene.startScreen.container.setVisible(false);
    startMatch(scene, scene.state.menu.cursor === 0 ? '1P' : '2P');
  }
}

function startMatch(scene, mode) {
  scene.state.phase = 'playing';
  scene.state.mode = mode;
  scene.state.p1 = { score: 0, comboStreak: 0, comboMult: 1, lives: 3, laneIndex: 0, lockoutUntil: 0, obj: scene.state.p1.obj };
  scene.state.p2 = { score: 0, comboStreak: 0, comboMult: 1, lives: 3, laneIndex: 0, lockoutUntil: 0, obj: scene.state.p2.obj };
  
  scene.state.playing.cars.forEach(c => { c.rect.destroy(); c.bubble.destroy(); c.icon.destroy(); });
  scene.state.playing = { cars: [], nextSpawnTime: 0, timeElapsed: 0 };
  
  updateBackgroundForMode(scene);
  updateChefPos(scene);
  refreshHud(scene);
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

function getDifficulty(timeElapsedMs) {
    const progress = Math.min(timeElapsedMs / 120000, 1.0);
    return {
        speed: 80 + progress * (180 - 80),
        spawnDelay: 2500 - progress * (2500 - 900)
    };
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
  
  const diff = getDifficulty(pState.timeElapsed);

  if (pState.timeElapsed > pState.nextSpawnTime) {
    let numToSpawn = 1;
    let roll = Phaser.Math.Between(1, 100);
    // 30% chance for dual spawn after some time
    if (scene.state.mode === '2P' && pState.timeElapsed > 30000 && roll <= 30) {
        numToSpawn = 2;
    }
    
    // Pick different lanes
    let pickedLanes = [];
    while (pickedLanes.length < numToSpawn) {
        let maxLanes = scene.state.mode === '1P' ? 2 : 4;
        let l = Phaser.Math.Between(0, maxLanes - 1);
        if (!pickedLanes.includes(l)) pickedLanes.push(l);
    }
    
    pickedLanes.forEach(l => spawnCar(scene, l));
    pState.nextSpawnTime = pState.timeElapsed + diff.spawnDelay;
  }

  // Move matching cars
  for (let i = pState.cars.length - 1; i >= 0; i--) {
    const car = pState.cars[i];
    car.x -= (diff.speed * delta) / 1000;
    car.rect.setX(car.x);
    car.bubble.setX(car.x);
    car.icon.setX(car.x);

    if (car.x < 90) {
       let laneOwner = 'p1';
       if (scene.state.mode === '2P' && car.laneIdx >= 2) laneOwner = 'p2';
       
       car.rect.destroy(); car.bubble.destroy(); car.icon.destroy();
       pState.cars.splice(i, 1);
       loseLife(scene, laneOwner);
       if (scene.state.phase !== 'playing') return; // Game over triggered
    }
  }

  handleChefMovement(scene);
  handleServeInput(scene, time);

  if (!pState.lastHudUpdate || pState.timeElapsed - pState.lastHudUpdate >= 500) {
      pState.lastHudUpdate = pState.timeElapsed;
      refreshHud(scene);
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

function handleChefMovement(scene) {
  if (consumePressed(scene, 'P1_U')) {
      if (scene.state.p1.laneIndex > 0) { scene.state.p1.laneIndex--; updateChefPos(scene); }
  }
  if (consumePressed(scene, 'P1_D')) {
      if (scene.state.p1.laneIndex < 1) { scene.state.p1.laneIndex++; updateChefPos(scene); }
  }
  
  if (scene.state.mode === '2P') {
      if (consumePressed(scene, 'P2_U')) {
          if (scene.state.p2.laneIndex > 0) { scene.state.p2.laneIndex--; updateChefPos(scene); }
      }
      if (consumePressed(scene, 'P2_D')) {
          if (scene.state.p2.laneIndex < 1) { scene.state.p2.laneIndex++; updateChefPos(scene); }
      }
  }
}

function spawnCar(scene, laneIdx) {
  const itemType = Phaser.Math.Between(0, 3);
  const lanes = scene.state.mode === '1P' ? LANES_1P : LANES_2P;
  const laneY = lanes[laneIdx]; 
  const rect = scene.add.rectangle(770, laneY, 50, 40, COLORS.carBody);
  const bubble = scene.add.rectangle(770, laneY - 40, 22, 22, COLORS.white);
  
  let itemColor;
  let isP1 = scene.state.mode === '1P' || laneIdx < 2;
  
  if (isP1) {
      if (itemType === 0) itemColor = COLORS.itemBurger;
      else if (itemType === 1) itemColor = COLORS.itemFries;
      else if (itemType === 2) itemColor = COLORS.itemDrink;
      else itemColor = COLORS.itemIceCream;
  } else {
      if (itemType === 0) itemColor = COLORS.itemTaco;
      else if (itemType === 1) itemColor = COLORS.itemBurrito;
      else if (itemType === 2) itemColor = COLORS.itemDrink;
      else itemColor = COLORS.tacosaurus;
  }
  
  const icon = scene.add.rectangle(770, laneY - 40, 14, 14, itemColor);

  scene.state.playing.cars.push({ x: 770, y: laneY, item: itemType, rect, bubble, icon, laneIdx });
}

function handleServeInput(scene, time) {
  handlePlayerServe(scene, time, 'p1');
  if (scene.state.mode === '2P') {
      handlePlayerServe(scene, time, 'p2');
  }
}

function handlePlayerServe(scene, time, playerKey) {
  if (scene.state[playerKey].lockoutUntil > time) return;

  let servedItem = -1;
  const px = playerKey === 'p1' ? 'P1' : 'P2';
  for (let b = 1; b <= 4; b++) {
    if (consumePressed(scene, px + '_' + b)) { servedItem = b - 1; break; }
  }

  if (servedItem !== -1) {
    const activeLane = playerKey === 'p1' ? scene.state.p1.laneIndex : scene.state.p2.laneIndex + 2;
    let closestCar = null, closestIdx = -1;

    scene.state.playing.cars.forEach((c, idx) => {
      if (c.laneIdx === activeLane && c.x >= 100 && c.x <= 180) {
        if (!closestCar || c.x < closestCar.x) { closestCar = c; closestIdx = idx; }
      }
    });

    if (closestCar) {
      if (closestCar.item === servedItem) {
        scene.state[playerKey].score += Math.floor(100 * scene.state[playerKey].comboMult);
        scene.state[playerKey].comboStreak++;
        let streak = scene.state[playerKey].comboStreak;
        if (streak >= 10) scene.state[playerKey].comboMult = 3;
        else if (streak >= 5) scene.state[playerKey].comboMult = 2;
        else if (streak >= 3) scene.state[playerKey].comboMult = 1.5;
        
        scene.state[playerKey].obj.setScale(1.1, 1);
        scene.time.delayedCall(100, () => { if(scene.state[playerKey].obj) scene.state[playerKey].obj.setScale(1, 1); });

        closestCar.rect.destroy(); closestCar.bubble.destroy(); closestCar.icon.destroy();
        scene.state.playing.cars.splice(closestIdx, 1);
        refreshHud(scene);
      } else {
        scene.state[playerKey].comboStreak = 0;
        scene.state[playerKey].comboMult = 1;
        scene.state[playerKey].lockoutUntil = time + 500;
        refreshHud(scene);
      }
    }
  }
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
    try { await window.platanusArcadeStorage.set(STORAGE_KEY, toSave); } catch(e) { }
  }
  
  scene.endGame.container.setVisible(false);
  scene.endGame.title.setText('GAME OVER'); // reset for next time
  showStartScreen(scene);
}
