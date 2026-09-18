// node test.js → imprime OK ou quebra com stack trace
const assert = require('assert');
const {
  newGame, addPlayer, removePlayer, startGame, nextRound,
  pickCategory, pickQuestion, toggleCorrect, confirmRound, ranking,
} = require('./game.js');

const first = () => 0; // sempre pega o primeiro item do array/pool restante

// newGame
{
  const s = newGame();
  assert.equal(s.screen, 'setup');
  assert.deepEqual(s.players, []);
  assert.equal(s.hotSeat, null);
  assert.equal(s.usedQuestions.size, 0);
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

// startGame: exige >=2 jogadores; senão não muda de tela
{
  const s = newGame();
  addPlayer(s, 'Ana');
  startGame(s, first);
  assert.equal(s.screen, 'setup', 'só 1 jogador');

  addPlayer(s, 'Bia');
  addPlayer(s, 'Caio');
  startGame(s, first);
  assert.equal(s.screen, 'roundStart');
  assert.deepEqual(s.scores, { Ana: 0, Bia: 0, Caio: 0 });
  assert.equal(s.totalRounds, 3);
  assert.equal(s.round, 1);
  assert.equal(s.hotSeat, 'Ana', 'first() sempre pega índice 0 de remaining');
  assert.deepEqual(s.remaining, ['Bia', 'Caio']);
}

// nextRound: sorteia sem repetir dentro da volta; no-op quando remaining vazio
{
  const s = newGame();
  ['Ana', 'Bia'].forEach(n => addPlayer(s, n));
  startGame(s, first); // hotSeat = Ana, remaining = [Bia]
  assert.equal(s.hotSeat, 'Ana');

  nextRound(s, first); // remaining = [Bia] → sorteia Bia
  assert.equal(s.hotSeat, 'Bia');
  assert.deepEqual(s.remaining, []);
  assert.equal(s.round, 2);

  const before = JSON.stringify({ ...s, usedQuestions: [...s.usedQuestions], correctGuessers: [...s.correctGuessers] });
  nextRound(s, first); // remaining vazio → no-op
  const after = JSON.stringify({ ...s, usedQuestions: [...s.usedQuestions], correctGuessers: [...s.correctGuessers] });
  assert.equal(after, before);
}

// pickCategory: só age em 'roundStart'; sorteia 3 perguntas sem repetir usedQuestions; libera categoria esgotada
{
  const pool = { leves: ['Q1', 'Q2', 'Q3', 'Q4'] };
  const s = newGame();
  addPlayer(s, 'Ana'); addPlayer(s, 'Bia');
  startGame(s, first); // screen = roundStart

  pickCategory(s, 'leves', pool, first);
  assert.equal(s.screen, 'questionPick');
  assert.equal(s.category, 'leves');
  assert.deepEqual(s.suggestions, ['Q1', 'Q2', 'Q3']);

  // fora de 'roundStart' não faz nada
  pickCategory(s, 'leves', pool, first);
  assert.deepEqual(s.suggestions, ['Q1', 'Q2', 'Q3'], 'screen já é questionPick, no-op');
}

// pickCategory: quando restam menos de 3 não usadas, libera as usadas da categoria
{
  const pool = { leves: ['Q1', 'Q2', 'Q3', 'Q4'] };
  const s = newGame();
  addPlayer(s, 'Ana'); addPlayer(s, 'Bia'); addPlayer(s, 'Caio');
  startGame(s, first);
  s.usedQuestions.add('Q1'); s.usedQuestions.add('Q2'); s.usedQuestions.add('Q3'); s.usedQuestions.add('Q4');

  pickCategory(s, 'leves', pool, first);
  assert.equal(s.suggestions.length, 3, 'liberou as usadas da categoria e sorteou de novo');
  assert.equal(s.usedQuestions.size, 0);
}

// pickQuestion: exige que a pergunta esteja nas sugestões; marca usedQuestions; vai pra scoring
{
  const pool = { leves: ['Q1', 'Q2', 'Q3'] };
  const s = newGame();
  addPlayer(s, 'Ana'); addPlayer(s, 'Bia');
  startGame(s, first);
  pickCategory(s, 'leves', pool, first);

  pickQuestion(s, 'Fora da lista');
  assert.equal(s.screen, 'questionPick', 'pergunta inválida não avança');

  pickQuestion(s, 'Q2');
  assert.equal(s.screen, 'scoring');
  assert.equal(s.question, 'Q2');
  assert.ok(s.usedQuestions.has('Q2'));
  assert.deepEqual(s.suggestions, []);
}

// toggleCorrect: não deixa marcar a própria Hot Seat; toggla os demais
{
  const pool = { leves: ['Q1', 'Q2', 'Q3'] };
  const s = newGame();
  addPlayer(s, 'Ana'); addPlayer(s, 'Bia'); addPlayer(s, 'Caio');
  startGame(s, first); // hotSeat = Ana
  pickCategory(s, 'leves', pool, first);
  pickQuestion(s, 'Q1');

  toggleCorrect(s, 'Ana'); // é a Hot Seat, ignora
  assert.equal(s.correctGuessers.size, 0);

  toggleCorrect(s, 'Bia');
  assert.ok(s.correctGuessers.has('Bia'));
  toggleCorrect(s, 'Bia'); // toca de novo, desmarca
  assert.ok(!s.correctGuessers.has('Bia'));
}

// confirmRound: soma pontos, decide roundEnd (ainda tem gente pra sentar) vs gameOver
{
  const pool = { leves: ['Q1', 'Q2', 'Q3'] };
  const s = newGame();
  addPlayer(s, 'Ana'); addPlayer(s, 'Bia'); addPlayer(s, 'Caio');
  startGame(s, first); // hotSeat = Ana, remaining = [Bia, Caio]
  pickCategory(s, 'leves', pool, first);
  pickQuestion(s, 'Q1');
  toggleCorrect(s, 'Bia');
  toggleCorrect(s, 'Caio');

  confirmRound(s);
  assert.deepEqual(s.scores, { Ana: 0, Bia: 1, Caio: 1 });
  assert.equal(s.screen, 'roundEnd', 'ainda restam jogadores pra Hot Seat');
  assert.equal(s.correctGuessers.size, 0, 'limpa pra próxima rodada');
  assert.equal(s.question, null);
}

// fluxo completo: 3 jogadores, cada um passa 1x pela Hot Seat, termina em gameOver com ranking certo
{
  const pool = { leves: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'] };
  const s = newGame();
  ['Ana', 'Bia', 'Caio'].forEach(n => addPlayer(s, n));
  startGame(s, first); // hotSeat = Ana
  assert.equal(s.totalRounds, 3);

  pickCategory(s, 'leves', pool, first);
  pickQuestion(s, s.suggestions[0]);
  toggleCorrect(s, 'Bia');
  confirmRound(s);
  assert.equal(s.screen, 'roundEnd');

  nextRound(s, first); // hotSeat = Bia (única restante era Bia, Caio ainda no remaining... first() pega índice 0)
  assert.equal(s.hotSeat, 'Bia');
  pickCategory(s, 'leves', pool, first);
  pickQuestion(s, s.suggestions[0]);
  toggleCorrect(s, 'Ana');
  toggleCorrect(s, 'Caio');
  confirmRound(s);
  assert.equal(s.screen, 'roundEnd');

  nextRound(s, first); // hotSeat = Caio, remaining vazio
  assert.equal(s.hotSeat, 'Caio');
  assert.deepEqual(s.remaining, []);
  pickCategory(s, 'leves', pool, first);
  pickQuestion(s, s.suggestions[0]);
  toggleCorrect(s, 'Ana');
  confirmRound(s);
  assert.equal(s.screen, 'gameOver', 'última rodada da volta');

  assert.deepEqual(s.scores, { Ana: 2, Bia: 1, Caio: 1 });
  assert.deepEqual(ranking(s), [
    { name: 'Ana', score: 2 },
    { name: 'Bia', score: 1 },
    { name: 'Caio', score: 1 },
  ]);
}

console.log('OK');
