// node test.js → imprime OK ou quebra com stack trace
const assert = require('assert');
const {
  newGame, addPlayer, removePlayer, setCategory, randomCategory, setDuration,
  startGame, timeLeft, explode, eliminate, isOver, winner, nextRound,
  MIN_DURATION, MAX_DURATION, JITTER,
} = require('./game.js');
const noJitter = () => 0.5; // (0.5*2-1)*JITTER = 0 → tempo real = duração exata, pra testes determinísticos

// newGame
{
  const s = newGame();
  assert.equal(s.screen, 'setup');
  assert.deepEqual(s.players, []);
  assert.deepEqual(s.alive, []);
  assert.equal(s.eliminated, null);
}

// addPlayer: trim, ignora vazio e duplicado
{
  const s = newGame();
  addPlayer(s, '  Ana  ');
  addPlayer(s, 'Bia');
  addPlayer(s, '');
  addPlayer(s, '   ');
  addPlayer(s, 'Ana');
  assert.deepEqual(s.players, ['Ana', 'Bia']);
}

// removePlayer: índice válido remove, índice fora do array não quebra
{
  const s = newGame();
  ['Ana', 'Bia', 'Caio'].forEach(n => addPlayer(s, n));
  removePlayer(s, 1);
  assert.deepEqual(s.players, ['Ana', 'Caio']);
  removePlayer(s, 99);
  assert.deepEqual(s.players, ['Ana', 'Caio']);
}

// setCategory / randomCategory
{
  const s = newGame();
  setCategory(s, '  Frutas  ');
  assert.equal(s.category, 'Frutas');
  const cats = ['A', 'B', 'C'];
  assert.equal(randomCategory(cats, () => 0), 'A');
  assert.equal(randomCategory(cats, () => 0.999), 'C');
}

// setDuration: clamp 10..120, ignora NaN/undefined
{
  const s = newGame();
  setDuration(s, 60);
  assert.equal(s.duration, 60);
  setDuration(s, 5);
  assert.equal(s.duration, MIN_DURATION);
  setDuration(s, 999);
  assert.equal(s.duration, MAX_DURATION);
  setDuration(s, NaN);
  assert.equal(s.duration, MAX_DURATION);
  setDuration(s, undefined);
  assert.equal(s.duration, MAX_DURATION);
}

// startGame: exige >=2 jogadores e categoria; senão não muda de tela
{
  const s = newGame();
  addPlayer(s, 'Ana');
  setCategory(s, 'Frutas');
  startGame(s, 1000);
  assert.equal(s.screen, 'setup', 'só 1 jogador');

  addPlayer(s, 'Bia');
  s.category = '';
  startGame(s, 1000);
  assert.equal(s.screen, 'setup', 'sem categoria');

  setCategory(s, 'Frutas');
  setDuration(s, 40);
  startGame(s, 1000, noJitter);
  assert.equal(s.screen, 'playing');
  assert.deepEqual(s.alive, ['Ana', 'Bia']);
  assert.equal(s.endAt, 1000 + 40000, 'sem jitter, tempo real = duração exata');
  assert.equal(s.eliminated, null);
}

// startRound: jitter varia ±JITTER segundos e nunca deixa o tempo real abaixo de MIN_DURATION
{
  const s = newGame();
  addPlayer(s, 'Ana'); addPlayer(s, 'Bia');
  setCategory(s, 'X'); setDuration(s, MIN_DURATION); // no piso; jitter negativo não pode furar o piso

  startGame(s, 0, () => 0); // (0*2-1)*JITTER = -JITTER
  assert.equal(s.endAt, MIN_DURATION * 1000, 'clampa no piso mesmo com jitter máximo negativo');

  setDuration(s, 50);
  startGame(s, 0, () => 1); // (1*2-1)*JITTER = +JITTER
  assert.equal(s.endAt, (50 + JITTER) * 1000);
}

// timeLeft: nunca negativo, arredonda pra cima
{
  assert.equal(timeLeft({ endAt: 5000 }, 3500), 2);
  assert.equal(timeLeft({ endAt: 5000 }, 5000), 0);
  assert.equal(timeLeft({ endAt: 5000 }, 9000), 0);
}

// explode: só age em 'playing'
{
  const s = newGame();
  explode(s);
  assert.equal(s.screen, 'setup');

  addPlayer(s, 'Ana'); addPlayer(s, 'Bia');
  setCategory(s, 'X'); startGame(s, 0);
  explode(s);
  assert.equal(s.screen, 'exploded');
}

// eliminate: remove o nome certo, ignora nome inválido e segundo toque
{
  const s = newGame();
  ['Ana', 'Bia', 'Caio'].forEach(n => addPlayer(s, n));
  setCategory(s, 'X'); startGame(s, 0); explode(s);

  eliminate(s, 'Ninguem');
  assert.equal(s.eliminated, null, 'nome inválido não elimina');
  assert.deepEqual(s.alive, ['Ana', 'Bia', 'Caio']);

  eliminate(s, 'Bia');
  assert.equal(s.eliminated, 'Bia');
  assert.deepEqual(s.alive, ['Ana', 'Caio']);
  assert.equal(s.screen, 'exploded', 'ainda restam 2, não acabou');

  eliminate(s, 'Ana'); // segundo toque na mesma explosão não deve eliminar outro
  assert.equal(s.eliminated, 'Bia');
  assert.deepEqual(s.alive, ['Ana', 'Caio']);
}

// edge case: exatamente 2 jogadores → elimina um e vai direto a gameOver
{
  const s = newGame();
  addPlayer(s, 'Ana'); addPlayer(s, 'Bia');
  setCategory(s, 'X'); startGame(s, 0); explode(s);
  eliminate(s, 'Ana');
  assert.equal(s.alive.length, 1);
  assert.equal(isOver(s), true);
  assert.equal(s.screen, 'gameOver');
  assert.equal(winner(s), 'Bia');
}

// nextRound: só age em 'exploded' não terminado; reinicia o timer
{
  const s = newGame();
  ['Ana', 'Bia', 'Caio'].forEach(n => addPlayer(s, n));
  setCategory(s, 'X'); setDuration(s, 40); startGame(s, 1000, noJitter);
  explode(s); eliminate(s, 'Caio');

  nextRound(s, 5000, noJitter);
  assert.equal(s.screen, 'playing');
  assert.equal(s.endAt, 5000 + 40000);
  assert.equal(s.eliminated, null);

  const before = JSON.stringify(s);
  nextRound(s, 9999, noJitter); // não está em 'exploded' → no-op
  assert.equal(JSON.stringify(s), before);
}

// nextRound depois do jogo já ter acabado não faz nada
{
  const s = newGame();
  addPlayer(s, 'Ana'); addPlayer(s, 'Bia');
  setCategory(s, 'X'); startGame(s, 0); explode(s); eliminate(s, 'Ana');
  assert.equal(s.screen, 'gameOver');
  nextRound(s, 1000);
  assert.equal(s.screen, 'gameOver');
}

// fluxo completo simulado até sobrar 1 vencedor, trocando categoria entre rodadas
{
  const s = newGame();
  ['Ana', 'Bia', 'Caio', 'Duda'].forEach(n => addPlayer(s, n));
  setCategory(s, 'Frutas');
  setDuration(s, 40);
  let now = 0;
  startGame(s, now, noJitter);
  assert.equal(s.screen, 'playing');

  now += 40000;
  explode(s);
  eliminate(s, 'Duda');
  setCategory(s, 'Animais'); // trocou o tema antes da próxima rodada
  now += 100;
  nextRound(s, now, noJitter);
  assert.equal(s.screen, 'playing');
  assert.equal(s.category, 'Animais');

  now += 40000;
  explode(s);
  eliminate(s, 'Caio');
  now += 100;
  nextRound(s, now, noJitter); // categoria mantida (não mexeu)
  assert.equal(s.category, 'Animais');

  now += 40000;
  explode(s);
  eliminate(s, 'Ana');
  assert.equal(s.screen, 'gameOver');
  assert.equal(winner(s), 'Bia');
}

console.log('OK');
