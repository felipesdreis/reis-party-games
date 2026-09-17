// Categorias do Batata Quente. Array plano de strings — usado direto na grid de sugestões e no sorteio 🎲.
// ponytail: pode repetir entre rodadas, sem controle de "usadas" (poucas dezenas de categorias, tudo bem repetir)
const CATEGORIES = [
  // fáceis
  'Frutas',
  'Animais',
  'Cores',
  'Países',
  'Objetos da cozinha',
  'Times de futebol',
  'Nomes próprios',
  'Partes do corpo',
  'Bebidas',
  'Meios de transporte',
  // médias
  'Filmes dos anos 90',
  'Desenhos animados',
  'Marcas de carro',
  'Profissões',
  'Capitais do mundo',
  'Instrumentos musicais',
  'Marcas de refrigerante',
  'Personagens de novela',
  'Redes sociais',
  'Programas de TV',
  // difíceis
  'Elementos da tabela periódica',
  'Personagens da mitologia grega',
  'Termos de programação',
  'Ossos do corpo humano',
  'Capitais de estados brasileiros',
  'Signos do zodíaco',
];

if (typeof module !== 'undefined') module.exports = { CATEGORIES };
