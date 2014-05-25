var GameState = function(game){};

GameState.prototype.preload = function() {
  this.game.load.image('beat', 'images/beat.png');
  this.game.load.image('black', 'images/black.png');
  this.game.load.image('good', 'images/good.png');
  this.game.load.image('bad', 'images/bad.png');
  
  // Add all the drum def assets
  for (var key in DrumDefs) {
    if (DrumDefs.hasOwnProperty(key)) {
      var drumdef= DrumDefs[key];
      // Sounds
      for (var i = 0; i < drumdef.length; i++) {
        this.game.load.audio(drumdef.name(i),
                             drumdef.filenameAudio(i));
      }
      // Sprites
      this.game.load.image(drumdef.basename,
                           drumdef.filenameImage());
    }
  }
};

function loadSolution(level) {
  var solution = [];
  for (var i = 0; i < level.solution[0].length; i++) {
    var ch = level.solution[0].charAt(i);
    if (ch !== "0") {
      solution.push([level[ch].drum]);
    } else {
      solution.push([]);
    }
  }
  return solution;
}

GameState.prototype.addSolutionDrums = function() {
  this.correctSolutionDrums.removeAll(true);
  var solutionRows = 1;
  // Display background - big enough for solution plus one row
  var left = (GRID_SIZE - this.correctSolution.length) / 2;
  var bg = this.correctSolutionDrums.add(new Phaser.Sprite(this.game,
                                                    left * PIXEL_SIZE,
                                                    (GRID_SIZE - solutionRows - 1) * PIXEL_SIZE,
                                                    'black'));
  bg.width = this.correctSolution.length * PIXEL_SIZE;
  bg.height = (solutionRows + 1) * PIXEL_SIZE;
  for (var i = 0; i < this.correctSolution.length; i++) {
    var x = left + i;
    var drums = this.correctSolution[i];
    for (var j = 0; j < drums.length; j++) {
      var y = GRID_SIZE - solutionRows + j;
      this.correctSolutionDrums.add(new Drum(this, {x:x, y:y}, drums[j], null));
    }
  }
};

GameState.prototype.loadLevel = function(level) {
  // Load solution
  this.correctSolution = loadSolution(level);
  // Add pseudo-drums to display the solution
  this.addSolutionDrums();
  // Load the level
  for (var y = 0; y < GRID_SIZE; y++) {
    var row = level.cells[y];
    for (var x = 0; x < GRID_SIZE; x++) {
      var ch = row.charAt(x);
      if (ch !== "0") {
        var drumdef = level[ch].drum;
        var beats = null;
        if (level[ch].beat !== undefined) {
          beats = [];
          for (var i = 0; i < level[ch].beat.length; i++) {
            var dir = level[ch].beat[i];
            if (dir === "up") {
              beats.push({x: 0, y: -1});
            } else if (dir === "right") {
              beats.push({x: 1, y: 0});
            } else if (dir === "down") {
              beats.push({x: 0, y: 1});
            } else {
              beats.push({x: -1, y: 0});
            }
          }
        }
        this.drums.add(new Drum(this, {x:x, y:y}, drumdef, beats));
      }
    }
  }
  this.solutionBeat = 0;
};

GameState.prototype.create = function() {
  this.game.stage.backgroundColor = 0x333333;
  
  this.timeLast = this.game.time.now;
  this.correctSolutionDrums = this.game.add.group();
  this.solutionDrums = this.game.add.group();
  this.beats = this.game.add.group();
  this.drums = this.game.add.group();
  this.draggedDrum = null;
  this.solution = [];
  
  // FPS timer
  // Turn off in prod
  this.game.time.advancedTiming = true;
  this.fpsText = this.game.add.text(
    20, 20, '', { font: '16px Arial', fill: '#ffffff' }
  );
  
  this.loadLevel(level1);
};

GameState.prototype.dragDrumAround = function() {
  var getDrumAt = function(drums, grid) {
    for (var i = 0; i < drums.length; i++) {
      var drum = drums.getAt(i);
      var drumGrid = p2g(drum);
      if (drumGrid.x == grid.x &&
          drumGrid.y == grid.y) {
        return drum;
      }
    }
    return null;
  };
  if (this.game.input.activePointer.isDown) {
    var mouseGrid = p2g(this.game.input);
    // Find the drum under the mouse
    if (this.draggedDrum === null) {
      var drum = getDrumAt(this.drums, mouseGrid);
      // Can't drag drums that make beats
      if (drum !== null && drum.beatDirs === null) {
        this.draggedDrum = drum;
      }
    }
    if (this.draggedDrum) {
      // Move drum around
      if (getDrumAt(this.drums, mouseGrid) === null) {
        var pixel = g2p(mouseGrid);
        this.draggedDrum.x = pixel.x;
        this.draggedDrum.y = pixel.y;
      }
    }
  } else {
    this.draggedDrum = null;
  }
};

GameState.prototype.moveTheBeat = function() {
  if (this.game.time.elapsedSince(this.timeLast) > MS_PER_MINIBEAT) {
    while (this.timeLast + MS_PER_MINIBEAT < this.game.time.now) {
      this.timeLast += MS_PER_MINIBEAT;
    }
    if (this.solutionBeat === 0) {
      this.solutionDrums.removeAll(true);
    }
    var i;
    for (i = 0; i < this.drums.length; i++) {
      var drum = this.drums.getAt(i);
      drum.updateBeat();
    }
    for (i = 0; i < this.beats.length; i++) {
      this.beats.getAt(i).updateBeat();
    }

    return true;
  }
  return false;
};

GameState.prototype.update = function() {
  // Update FPS
  if (this.game.time.fps !== 0) {
    this.fpsText.setText(this.game.time.fps + ' FPS');
  }
  
  this.dragDrumAround();
  
  if (this.moveTheBeat()) {
    var i;
    var j;
    var drum;
    // Check collisions between beats and drums
    // Activate drums that collide with beats
    for (i = 0; i < this.drums.length; i++) {
      drum = this.drums.getAt(i);
      var drumGrid = p2g(drum);
      for (j = 0; j < this.beats.length; j++) {
        var beat = this.beats.getAt(j);
        var beatGrid = p2g(beat);
        if (drumGrid.x == beatGrid.x && drumGrid.y == beatGrid.y) {
          drum.hit = true;
          break;
        }
      }
    }
    
    // Hit drums that have been hit with beats, or beat themselves
    // Check solution too
    var beats = [];
    for (i = 0; i < this.drums.length; i++) {
      drum = this.drums.getAt(i);
      if (drum.hit) {
        drum.play(this.timeLast);
        beats.push(drum.name);
      }
    }
    
    // Add the drums beaten this beat
    this.solution.push(beats);
    // Check our solution so far
    var ourBeats = this.solution[this.solutionBeat].sort();
    var correctBeats = [];
    var isCorrect = true;
    for (j = 0; j < this.correctSolution[this.solutionBeat].length; j++) {
      correctBeats.push(this.correctSolution[this.solutionBeat][j].name);
    }
    correctBeats = correctBeats.sort();
    if (ourBeats.length != correctBeats.length) {
      isCorrect = false;
    }
    for (j = 0; j < correctBeats; j++) {
      if (ourBeats[j] != correctBeats[j]) {
        isCorrect = false;
      }
    }
    // Add a sprite showing whether these beats are correct
    var x = (GRID_SIZE - this.correctSolution.length) / 2 + this.solutionBeat;
    var solutionRows = 1;
    var y = GRID_SIZE - solutionRows - 1;
    this.solutionDrums.add(new Phaser.Sprite(this.game,
                                             x * PIXEL_SIZE, y * PIXEL_SIZE,
                                             isCorrect ? 'good' : 'bad'));
    if (!isCorrect) {
      this.isCorrect = false;
    }
    this.solutionBeat++;
    if (this.solutionBeat == this.correctSolution.length) {
      this.solutionBeat = 0;
      if (this.isCorrect) {
        console.log("Correct!");
      }
      this.solution = [];
      this.isCorrect = true;
    }
  }
};

var game = new Phaser.Game(GRID_SIZE*PIXEL_SIZE, GRID_SIZE*PIXEL_SIZE, Phaser.AUTO, 'game');
game.state.add('game', GameState, true);
