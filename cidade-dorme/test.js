// node test.js → imprime OK ou quebra com stack trace
const assert = require('assert');
const g = require('./game.js');

// newGame: estado inicial
{
  const s = g.newGame();
  assert.equal(s.screen, 'setup');
  assert.equal(s.mode, 'local');
  assert.deepEqual(s.players, []);
  assert.deepEqual(s.roles, []);
  assert.deepEqual(s.alive, []);
  assert.equal(s.guest, null);
}

// addPlayer: trim, ignora vazio/duplicado, sem máximo
{
  const s = g.newGame();
  g.addPlayer(s, '  Ana  ');
  g.addPlayer(s, '');
  g.addPlayer(s, '   ');
  g.addPlayer(s, 'Ana');
  assert.deepEqual(s.players, ['Ana']);
  for (let i = 0; i < 20; i++) g.addPlayer(s, 'P' + i);
  assert.equal(s.players.length, 21, 'sem limite máximo');
}

// removePlayer: splice
{
  const s = g.newGame();
  ['Ana', 'Bia', 'Caio'].forEach(n => g.addPlayer(s, n));
  g.removePlayer(s, 1);
  assert.deepEqual(s.players, ['Ana', 'Caio']);
}

// assignRoles: contagem certa de papéis (n=6 e n=12), determinístico por seed, embaralhado
{
  for (const n of [6, 12]) {
    const roles = g.assignRoles(n, 'seed');
    assert.equal(roles.length, n);
    assert.equal(roles.filter(r => r === 'mafioso').length, 2);
    assert.equal(roles.filter(r => r === 'medico').length, 1);
    assert.equal(roles.filter(r => r === 'investigador').length, 1);
    assert.equal(roles.filter(r => r === 'cidadao').length, n - 4);
  }
  assert.deepEqual(g.assignRoles(12, 'q1w2'), g.assignRoles(12, 'q1w2'), 'mesma seed → mesmos papéis');
  assert.notDeepEqual(g.assignRoles(12, 'q1w2'), g.assignRoles(12, 'q1w3'), 'seed diferente → papéis diferentes');
  // embaralhado: não sempre nas mesmas posições entre seeds diferentes
  const positions = new Set();
  for (const seed of ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8']) {
    const roles = g.assignRoles(6, seed);
    positions.add(roles.indexOf('medico'));
  }
  assert.ok(positions.size > 1, 'medico não fica sempre na mesma posição');
}

// partnerOf: índice do outro mafioso
{
  const roles = ['mafioso', 'cidadao', 'mafioso', 'medico', 'investigador', 'cidadao'];
  assert.equal(g.partnerOf(roles, 0), 2);
  assert.equal(g.partnerOf(roles, 2), 0);
}

// startGame: bloqueia com 5, passa com 6
{
  const s = g.newGame();
  ['Ana', 'Bia', 'Caio', 'Duda', 'Eva'].forEach(n => g.addPlayer(s, n));
  g.startGame(s);
  assert.equal(s.screen, 'setup', 'bloqueia com 5');

  g.addPlayer(s, 'Fabio');
  g.startGame(s);
  assert.equal(s.screen, 'reveal', 'passa com 6');
  assert.equal(s.roles.length, 6);
  assert.deepEqual(s.alive, [true, true, true, true, true, true]);
  assert.equal(s.night, 0);
  assert.equal(s.revealIdx, 0);
  assert.equal(s.revealed, false);
}

// modo qr → share
{
  const s = g.newGame();
  g.setMode(s, 'qr');
  ['Ana', 'Bia', 'Caio', 'Duda', 'Eva', 'Fabio'].forEach(n => g.addPlayer(s, n));
  g.startGame(s);
  assert.equal(s.screen, 'share');
}

// encodeRound/decodeRound: ida e volta com nome acentuado
{
  const s = g.newGame();
  g.setMode(s, 'qr');
  ['Zé | Zezinho', 'Ção', 'Caio', 'Duda', 'Eva', 'Fábio'].forEach(n => g.addPlayer(s, n));
  g.startGame(s);
  const hash = g.encodeRound(s);
  const dec = g.decodeRound(hash);
  assert.equal(dec.seed, s.seed);
  assert.deepEqual(dec.players, s.players);
  assert.equal(g.decodeRound('abc'), null);
  assert.equal(g.decodeRound('a|b|c|d|e|f'), null, 'menos de 7 campos (seed + 5 nomes)');
  assert.equal(g.decodeRound(''), null);

  // loadGuest produz os mesmos roles do host pra mesma seed
  const guest = g.newGame();
  g.loadGuest(guest, hash);
  assert.equal(guest.screen, 'guest');
  assert.deepEqual(guest.players, s.players);
  assert.deepEqual(guest.roles, s.roles);
  assert.deepEqual(guest.alive, [true, true, true, true, true, true]);
  assert.deepEqual(guest.guest, { who: null, shown: false });
  g.pickGuest(guest, 2);
  assert.deepEqual(guest.guest, { who: 2, shown: false });

  const bad = g.newGame();
  g.loadGuest(bad, 'abc');
  assert.equal(bad.screen, 'setup');
  assert.equal(bad.guest, null);
}

// fluxo show/hide: n vezes → night direto (sem tela intermediária)
{
  const s = g.newGame();
  ['Ana', 'Bia', 'Caio', 'Duda', 'Eva', 'Fabio'].forEach(n => g.addPlayer(s, n));
  g.startGame(s);
  assert.equal(s.screen, 'reveal');
  for (let i = 0; i < 6; i++) {
    g.show(s);
    assert.equal(s.revealed, true);
    g.hide(s);
    assert.equal(s.revealed, false);
  }
  assert.equal(s.screen, 'night', 'depois do último hide, vai direto pra night');
  assert.equal(s.night, 1);
  assert.equal(s.phase, 'medico');
}

// toNight (modo qr): equivalente ao toDiscuss do ito
{
  const s = g.newGame();
  g.setMode(s, 'qr');
  ['Ana', 'Bia', 'Caio', 'Duda', 'Eva', 'Fabio'].forEach(n => g.addPlayer(s, n));
  g.startGame(s);
  assert.equal(s.screen, 'share');
  g.toNight(s);
  assert.equal(s.screen, 'night');
  assert.equal(s.night, 1);
  assert.equal(s.phase, 'medico');
}

// startNight: incrementa night, reseta os targets
{
  const s = g.newGame();
  s.roles = ['mafioso', 'mafioso', 'medico', 'investigador', 'cidadao', 'cidadao'];
  s.alive = [true, true, true, true, true, true];
  s.night = 3;
  s.mafiaTarget = 5; s.medicoTarget = 4; s.investigadorTarget = 3; s.investigadorResult = true; s.lastDeath = 2;
  g.startNight(s);
  assert.equal(s.night, 4);
  assert.equal(s.phase, 'medico');
  assert.equal(s.mafiaTarget, null);
  assert.equal(s.medicoTarget, null);
  assert.equal(s.investigadorTarget, null);
  assert.equal(s.investigadorResult, null);
  assert.equal(s.lastDeath, null);
  assert.equal(s.screen, 'night');
}

// sequência medico→investigador→finishNight→mafia, com investigadorResult certo por papel
function nightState() {
  const s = g.newGame();
  s.players = ['Mafi1', 'Mafi2', 'Medico', 'Investigador', 'Cidadao1', 'Cidadao2'];
  s.roles = ['mafioso', 'mafioso', 'medico', 'investigador', 'cidadao', 'cidadao'];
  s.alive = [true, true, true, true, true, true];
  g.startNight(s);
  return s;
}

{
  const s = nightState();
  assert.equal(s.phase, 'medico');

  // fora de ordem: escolher investigador/máfia antes da hora não faz nada
  g.chooseInvestigadorTarget(s, 3);
  assert.equal(s.investigadorTarget, null, 'fora de ordem, ignora');
  g.chooseMafiaTarget(s, 4);
  assert.equal(s.mafiaTarget, null, 'fora de ordem, ignora');

  g.chooseMedicoTarget(s, 4); // medico protege Cidadao1
  assert.equal(s.medicoTarget, 4);
  assert.equal(s.phase, 'investigador');

  g.chooseMedicoTarget(s, 5); // fora de fase, ignora
  assert.equal(s.medicoTarget, 4);

  // investigador investiga cada papel, checando investigadorResult
  const s2 = nightState();
  g.chooseMedicoTarget(s2, 5);
  assert.equal(s2.phase, 'investigador');
  g.chooseInvestigadorTarget(s2, 0); // mafioso
  assert.equal(s2.investigadorResult, true);
  assert.equal(s2.screen, 'night', 'não muda de tela');
  assert.equal(s2.investigadorTarget, 0);

  // segunda tentativa no mesmo turno é ignorada
  g.chooseInvestigadorTarget(s2, 1);
  assert.equal(s2.investigadorTarget, 0, 'não sobrescreve');

  for (const [role, target, expected] of [
    ['mafioso', 0, true],
    ['mafioso', 1, true],
    ['medico', 2, true],
    ['investigador', 3, false],
    ['cidadao', 4, false],
    ['cidadao', 5, false],
  ]) {
    const s3 = nightState();
    g.chooseMedicoTarget(s3, 2); // médico se protege, não afeta o resultado da investigação
    g.chooseInvestigadorTarget(s3, target);
    assert.equal(s3.investigadorResult, expected, `investigar ${role} → ${expected}`);
  }

  // finishNight só age depois de chooseInvestigadorTarget, e avança pra fase da máfia
  const s4 = nightState();
  g.chooseMedicoTarget(s4, 5);
  g.finishNight(s4);
  assert.equal(s4.phase, 'investigador', 'sem investigadorTarget, finishNight não age');
  g.chooseInvestigadorTarget(s4, 3);
  g.finishNight(s4);
  assert.equal(s4.phase, 'mafia');
  assert.equal(s4.screen, 'night', 'ainda não resolveu — falta a máfia agir');

  // máfia é a última fase: escolher a vítima já resolve a noite na hora
  g.chooseMafiaTarget(s4, 4);
  assert.equal(s4.mafiaTarget, 4);
  assert.equal(s4.screen, 'nightResult');
}

// resolveNight: salvo (mesmo alvo) vs morto (alvos diferentes)
{
  const saved = nightState();
  g.chooseMedicoTarget(saved, 4);
  g.chooseInvestigadorTarget(saved, 3);
  g.finishNight(saved);
  g.chooseMafiaTarget(saved, 4); // máfia mira quem o médico protegeu
  assert.equal(saved.lastDeath, null, 'médico salvou a vítima');
  assert.equal(saved.alive[4], true);

  const killed = nightState();
  g.chooseMedicoTarget(killed, 5); // protege outra pessoa
  g.chooseInvestigadorTarget(killed, 3);
  g.finishNight(killed);
  g.chooseMafiaTarget(killed, 4);
  assert.equal(killed.lastDeath, 4);
  assert.equal(killed.alive[4], false);
}

// papel especial morto: a fase dele é pulada, não trava esperando uma escolha impossível
{
  // médico morto → a noite já começa direto na fase do investigador
  const semMedico = nightState();
  semMedico.alive[2] = false; // Medico morto
  g.startNight(semMedico);
  assert.equal(semMedico.medicoTarget, null, 'médico morto não protege ninguém');
  assert.equal(semMedico.phase, 'investigador', 'começa direto no investigador');
  g.chooseInvestigadorTarget(semMedico, 0);
  g.finishNight(semMedico);
  assert.equal(semMedico.phase, 'mafia');
  g.chooseMafiaTarget(semMedico, 4);
  assert.equal(semMedico.screen, 'nightResult');
  assert.equal(semMedico.lastDeath, 4, 'sem médico vivo, ninguém protege a vítima');

  // investigador morto (médico vivo) → depois do médico, pula direto pra fase da máfia
  const semInvestigador = nightState();
  semInvestigador.alive[3] = false; // Investigador morto
  g.startNight(semInvestigador);
  assert.equal(semInvestigador.phase, 'medico');
  g.chooseMedicoTarget(semInvestigador, 4); // protege a vítima que a máfia vai escolher
  assert.equal(semInvestigador.investigadorTarget, null, 'investigador morto não investiga');
  assert.equal(semInvestigador.phase, 'mafia', 'pula direto pra fase da máfia');
  g.chooseMafiaTarget(semInvestigador, 4);
  assert.equal(semInvestigador.screen, 'nightResult');
  assert.equal(semInvestigador.lastDeath, null, 'médico salvou');

  // médico e investigador mortos → a noite já começa direto na fase da máfia
  const soMafiaEcidadaos = nightState();
  soMafiaEcidadaos.alive[2] = false;
  soMafiaEcidadaos.alive[3] = false;
  g.startNight(soMafiaEcidadaos);
  assert.equal(soMafiaEcidadaos.phase, 'mafia', 'sem médico nem investigador vivos, começa na máfia');
  g.chooseMafiaTarget(soMafiaEcidadaos, 4);
  assert.equal(soMafiaEcidadaos.screen, 'nightResult');
  assert.equal(soMafiaEcidadaos.lastDeath, 4, 'ninguém pra proteger a vítima');
}

// mafiaTargetChoices: exclui os mafiosos vivos
{
  const s = nightState();
  assert.deepEqual(g.mafiaTargetChoices(s), [2, 3, 4, 5]);
  s.alive[0] = false; // mafioso morto continua excluído (role, não vida)
  assert.deepEqual(g.mafiaTargetChoices(s), [2, 3, 4, 5]);
  s.alive[2] = false; // medico morto some da lista de vivos
  assert.deepEqual(g.mafiaTargetChoices(s), [3, 4, 5]);
}

// eliminateDay: com índice e com null
{
  const s = nightState();
  g.eliminateDay(s, 4);
  assert.equal(s.alive[4], false);
  assert.equal(s.lastEliminated, 4);
  assert.equal(s.screen, 'dayResult');

  const s2 = nightState();
  g.eliminateDay(s2, null);
  assert.deepEqual(s2.alive, [true, true, true, true, true, true], 'null não mexe em alive');
  assert.equal(s2.lastEliminated, null);
  assert.equal(s2.screen, 'dayResult');
}

// isOver/winner: cenários da spec (empate e maioria vencem pra mafia; mafia zerada vence pra cidade;
// medico+investigador eliminados vence pra mafia mesmo em minoria)
{
  // empate: 2 mafiosos vivos, 2 não-mafiosos vivos → verdadeiro, mafia vence (empate já basta)
  const tie = { roles: ['mafioso', 'mafioso', 'medico', 'investigador', 'cidadao', 'cidadao'],
    alive: [true, true, true, true, false, false] };
  assert.equal(g.isOver(tie), true, 'empate já basta');
  assert.equal(g.winner(tie), 'mafia');

  // maioria: 2 mafiosos vivos, 1 não-mafioso vivo → verdadeiro, mafia vence
  const majority = { roles: ['mafioso', 'mafioso', 'medico', 'investigador', 'cidadao', 'cidadao'],
    alive: [true, true, false, false, true, false] };
  assert.equal(g.isOver(majority), true);
  assert.equal(g.winner(majority), 'mafia');

  // mafia zerada, mesmo restando só 1 cidadão → verdadeiro, cidade vence
  const zeroed = { roles: ['mafioso', 'mafioso', 'medico', 'investigador', 'cidadao', 'cidadao'],
    alive: [false, false, false, false, true, false] };
  assert.equal(g.isOver(zeroed), true);
  assert.equal(g.winner(zeroed), 'cidade');

  // medico e investigador mortos, mafia ainda em minoria (1 vivo vs 3 cidadãos vivos) → mafia vence
  const noProtectors = { roles: ['mafioso', 'mafioso', 'medico', 'investigador', 'cidadao', 'cidadao'],
    alive: [true, false, false, false, true, true] };
  assert.equal(g.isOver(noProtectors), true, 'medico e investigador eliminados encerra o jogo');
  assert.equal(g.winner(noProtectors), 'mafia');

  // só o médico morto (investigador vivo) → jogo continua normalmente
  const onlyMedicoDead = { roles: ['mafioso', 'mafioso', 'medico', 'investigador', 'cidadao', 'cidadao'],
    alive: [true, false, false, true, true, true] };
  assert.equal(g.isOver(onlyMedicoDead), false, 'investigador ainda vivo, jogo continua');
}

// toDay / toNextNight: decidem entre gameOver e a próxima fase
{
  // toDay: jogo não terminou → day
  const s = nightState();
  g.chooseMedicoTarget(s, 5);
  g.chooseInvestigadorTarget(s, 3);
  g.finishNight(s);
  g.chooseMafiaTarget(s, 4);
  g.toDay(s);
  assert.equal(s.screen, 'day');

  // toDay: máfia já é maioria → gameOver direto
  const over = nightState();
  over.alive = [true, true, false, false, false, false]; // só os 2 mafiosos vivos
  g.toDay(over);
  assert.equal(over.screen, 'gameOver');

  // toNextNight: jogo não terminou → startNight
  const s2 = nightState();
  g.eliminateDay(s2, 4);
  g.toNextNight(s2);
  assert.equal(s2.screen, 'night');
  assert.equal(s2.night, 2);

  // toNextNight: mafia zerada → gameOver
  const s3 = nightState();
  s3.alive = [false, false, true, true, true, true];
  g.toNextNight(s3);
  assert.equal(s3.screen, 'gameOver');
}

console.log('OK');
