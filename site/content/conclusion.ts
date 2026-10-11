// Summary of reports/relatorio-conclusao.html. The figures belong to the runs in report/edition.ts;
// tests/public-conclusion.test.ts keeps them aligned with the published edition.
export const reportPath = '/relatorio/';
export const conclusion = {
  totals: '1.162 respostas · três execuções completas · sem falhas de API',
  profiles: [
    {
      provider: 'jev',
      role: 'Economia em texto',
      text: 'Bom ponto de partida quando existe revisão humana no fluxo. Não participa da prova de imagens.',
      figure: 'US$ 23–24',
      figureLabel: 'por 1 milhão de decisões em texto, cerca de 35% abaixo do Decisions',
    },
    {
      provider: 'decisions',
      role: 'Equilíbrio prático',
      text: 'Maior nota na Resiliência, perto do Clef nas outras provas e menos da metade do custo dele.',
      figure: '246–328 ms',
      figureLabel: 'menor mediana de resposta nas três provas',
    },
    {
      provider: 'clef',
      role: 'Qualidade observada',
      text: 'Venceu as três provas pelas regras da arena e não mudou a decisão em nenhuma das 88 comparações de forma.',
      figure: '3 de 3',
      figureLabel: 'provas vencidas, com o menor Brier em todas',
    },
  ],
  situations: [
    {
      area: 'Texto',
      situation: 'Triagem e regras claras, com orçamento apertado',
      picks: ['jev'],
      evidence:
        'Mais barato nas duas provas de texto e 35/36 nas reuniões. Encaminhou 22/298 respostas para revisão: a conta precisa incluir esse trabalho.',
    },
    {
      area: 'Texto',
      situation: 'Classificar português real e reduzir revisão',
      picks: ['decisions'],
      evidence:
        'Liderou português real com 56/60, contra 54/60 do Clef e 48/60 do Jev. Teve só 3 revisões na Resiliência inteira.',
    },
    {
      area: 'Texto',
      situation: 'Preservar decisões diante de ruído e reformulações',
      picks: ['clef'],
      evidence:
        'Não mudou a decisão nas 88 comparações de forma; Jev e Decisions mudaram duas vezes cada. Ainda assim, passou em 35/36 grupos de robustez.',
    },
    {
      area: 'Texto',
      situation: 'Regras com negação, instruções citadas e pressão',
      picks: ['decisions', 'clef'],
      evidence:
        'Os dois passaram em 12/12 grupos de negação e 16/16 casos de injeção. Decisions pelo custo; Clef como alternativa a validar.',
    },
    {
      area: 'Texto',
      situation: 'Dizer “fora do escopo” ou “não informado”',
      picks: ['jev', 'decisions', 'clef'],
      evidence:
        'Empate em 30/30. As opções já ofereciam a saída correta; não provamos que reconhecem sozinhos quando não sabem.',
    },
    {
      area: 'Imagens',
      situation: 'Analisar imagens priorizando custo e rapidez',
      picks: ['decisions'],
      evidence:
        'Empatou com o Clef em contagem, posição e profundidade. Fez 65/80, contra 69/80 do Clef, com menor custo e mediana.',
    },
    {
      area: 'Imagens',
      situation: 'Comparar distâncias entre objetos em uma cena',
      picks: ['clef'],
      evidence:
        'Fez 18/20 em distância real, contra 14/20 do Decisions. São só 20 fotos: a vantagem é uma hipótese para piloto.',
    },
    {
      area: 'Texto',
      situation: 'Priorizar acerto observado acima do custo da API',
      picks: ['clef'],
      evidence:
        '36/36 nas reuniões, vitória na Resiliência pelo Brier e 69/80 nas imagens. Custa mais, e a vantagem sobre o Decisions não teve significância estatística.',
    },
  ],
  untested:
    'Código, escrita criativa, OCR de documentos, áudio, agentes que executam ações e decisões médicas ou jurídicas não foram avaliados.',
} as const;
