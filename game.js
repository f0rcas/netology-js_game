'use strict';

class Vector {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  plus(vector) {
    if (!(vector instanceof Vector)) {
      throw new Error('Можно прибавлять к вектору только вектор типа Vector');
    }
    return new Vector(this.x + vector.x, this.y + vector.y);
  }
  times(multiplier) {
    return new Vector(this.x * multiplier, this.y * multiplier);
  }
}

class Actor {
  constructor(pos = new Vector(), size = new Vector(1, 1), speed = new Vector()) {
    this.pos = pos;
    this.size = size;
    this.speed = speed;
    if (!([this.pos, this.size, this.speed].every(arg => arg instanceof Vector))) {
      throw new Error('Неверный тип аргумента');
    }
  }
  get type() {
    return 'actor';
  }
  act() {}
  get left() {
    return this.pos.x;
  }
  get right() {
    return this.pos.x + this.size.x;
  }
  get top() {
    return this.pos.y;
  }
  get bottom() {
    return this.pos.y + this.size.y;
  }
  isIntersect(gameObject) {
    if (!(gameObject instanceof Actor)) {
      throw new Error('Аргумент должен быть экземпляром класса Actor');
    }
    return (!(gameObject == this || 
      (gameObject.left >= this.right || 
        gameObject.top >= this.bottom || 
        gameObject.right <= this.left || 
        gameObject.bottom <= this.top)) ||
        gameObject.size.x < 0 || (gameObject.size.y < 0)); 
  }
}

class Level {
  constructor(grid = [], actors = []) {
    this.actors = actors;
    this.grid = grid;
    this.height = this.grid.length;
    this.width = this.height > 0 ? Math.max.apply(Math, this.grid.map(function(el) {
      return el.length;
    })) : 0;
    this.status = null;
    this.finishDelay = 1;
    this.player = this.actors.find(actor => actor.type == 'player');
  }

  isFinished() {
    return this.status != null && this.finishDelay < 1;
  }
  actorAt(gameObject) {
    if (!(gameObject instanceof Actor)) {
      throw new Error('Аргумент должен быть экземпляром класса Actor');
    }
    return this.actors.find(actor => actor.isIntersect(gameObject));
  }

  obstacleAt(position, size) {
    if (Math.floor(position.x) < 0 || Math.ceil(position.x + size.x) > this.width || Math.floor(position.y) < 0) {
      return 'wall';
    } else if (Math.ceil(position.y + size.y) > this.height) {
      return 'lava';
    }
    for (let y = Math.floor(position.y); y < Math.ceil(position.y + size.y); y++) {
      for (let x = Math.floor(position.x); x < Math.ceil(position.x + size.x); x++) {
        if (this.grid[y][x]) {
          return this.grid[y][x];
        }
      }
    }
  }
  removeActor(object) {
    let index = this.actors.indexOf(object);
    if (index != -1)
      this.actors.splice(index, 1);
  }
  noMoreActors(actorType) {
    return !(this.actors.some(actor => actor.type == actorType));
  }
  playerTouched(obstacle, object = undefined) {
    if (!this.isFinished() && (obstacle == 'lava' || obstacle == 'fireball')) {
      this.status = 'lost';
    }
    if (obstacle == 'coin') {
      this.removeActor(object);
      if (this.noMoreActors('coin')) {
        this.status = 'won';
      }
    }
  }
}

class LevelParser {
  constructor(parser) {
    this.parser = parser;
  }
  actorFromSymbol(objectSymbol) {
    return objectSymbol == undefined ? undefined : this.parser[objectSymbol];
    } 
  obstacleFromSymbol(objectSymbol) {
    if (objectSymbol == 'x') {
      return 'wall';
    } else if (objectSymbol == '!') {
      return 'lava';
    } else {
      return undefined;
    }
  }
  createGrid(plan) {
    let levelGrid = [];
    if (plan.length == 0) {
      return levelGrid;
    } else {
      levelGrid = plan.map(string => string.split(''));
    }
    for (let i = 0; i < levelGrid.length; i++) {
      levelGrid[i] = levelGrid[i].map(el => this.obstacleFromSymbol(el));
    }
    return levelGrid;
  }
  createActors(plan) {
    const actors = [];
      if (this.parser) {
          plan.forEach((line, y) => {
              line.split('').forEach((symbol, x) => {
                  if (symbol in this.parser) {
                      const actor = new this.parser[symbol](new Vector(x, y));
                      actors.push(actor);
                  }
              });
          });
      }
    return actors;
  }

  parse(plan) {
    return new Level(this.createGrid(plan), this.createActors(plan));
  }
}

class Fireball extends Actor {
  constructor(pos = new Vector(), speed = new Vector()) {
    super(pos, new Vector(1, 1), speed);
  }
  get type() {
    return 'fireball';
  }
  getNextPosition(time = 1) {
    return new Vector(this.pos.x + this.speed.x * time, this.pos.y + this.speed.y * time);
  }
  handleObstacle() {
    this.speed = this.speed.times(-1);
  }
  act(time, level) {
    let newPosition = this.getNextPosition(time);
    if (level.obstacleAt(newPosition, this.size)) {
      this.handleObstacle();
    } else {
      this.pos = newPosition;
    }
  }
}

class HorizontalFireball extends Fireball {
  constructor(pos) {
    super(pos, new Vector(2, 0));
  }
}

class VerticalFireball extends Fireball {
  constructor(pos) {
    super(pos, new Vector(0, 2));
  }
}

class FireRain extends Fireball {
  constructor(pos) {
    super(pos, new Vector(0, 3));
  }
  handleObstacle() {
    this.pos.x = this.speed.x;
    this.pos.y = this.speed.x;
  }
}

class Coin extends Actor {
  constructor(pos = new Vector()) {
    super(pos, new Vector(0.6, 0.6));
    this.startLocation = pos;
    this.pos.x += 0.2;
    this.pos.y += 0.1;
    this.spring = Math.random() * 2 * Math.PI;
    this.springSpeed = 8;
    this.springDist = 0.07;
  }
  get type() {
    return 'coin';
  }
  updateSpring(time = 1) {
    this.spring += this.springSpeed * time;
  }
  getSpringVector() {
    return new Vector(0, Math.sin(this.spring) * this.springDist);
  }
  getNextPosition(time = 1) {
    this.updateSpring(time);
    return new Vector(this.startLocation.x + this.getSpringVector().x, this.startLocation.y + this.getSpringVector().y);
  }
  act(time) {
    this.pos = this.getNextPosition(time);
  }
}

class Player extends Actor {
  constructor(pos = new Vector()) {
    super(pos, new Vector(0.8, 1.5), new Vector(0, 0));
    this.pos.y -= 0.5;
  }
  get type() {
    return 'player';
  }
}

const actorDict = {
  '@': Player,
  'v': FireRain,
  '=': HorizontalFireball,
  '|': VerticalFireball,
  'o': Coin
}

const parser = new LevelParser(actorDict);

loadLevels()
  .then(schemas => runGame(JSON.parse(schemas), parser, DOMDisplay))
  .then(() => alert('Вы выиграли приз!'))
  .catch(err => alert(err));
