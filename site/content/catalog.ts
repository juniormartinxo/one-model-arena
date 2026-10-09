export const repository = 'https://github.com/juniormartinxo/one-model-arena';
export const models = {
  jev: { name: 'Jev', vendor: 'TypeSafe', color: '#83ded3', mark: 'J' },
  decisions: { name: 'Decisions', vendor: 'OpenAI', color: '#efc38d', mark: 'D' },
  clef: { name: 'Clef', vendor: 'Cloudflare', color: '#9db0ff', mark: 'C' },
} as const;
export const tests = [
  {
    id: 'maratona',
    name: 'Maratona de reuniões',
    title: 'A regra está dada. A decisão está certa?',
    description:
      'Reuniões fictícias com contexto, critérios e consequências definidos antes das respostas. O teste começa pelo essencial: aplicar a regra que foi recebida.',
    detail:
      'Seis cenários, de decisões cotidianas a dossiês com informações conflitantes. As consequências são simulações, não resultados observados no mundo real.',
    batteries: ['Básicos', 'Avançados', 'Estresse'],
    providers: ['jev', 'decisions', 'clef'],
    scoring:
      'Acertos pelo gabarito. Empates são desempatados pela calibração (Brier), com diferença mínima de 0,005.',
  },
  {
    id: 'brava',
    name: 'Resiliência',
    title: 'E quando o texto tenta mudar a decisão?',
    description:
      'Ruído, negação, dados ausentes e instruções escondidas. Aqui, a comparação testa consistência e os limites do que cada modelo sabe decidir.',
    detail:
      'Perguntas autorais e textos reais em português. Robustez e negação são avaliadas em grupos: acertar uma versão e errar a outra não basta.',
    batteries: ['Robustez', 'Português real', 'Abstenção', 'Negação', 'Injeção'],
    providers: ['jev', 'decisions', 'clef'],
    scoring:
      'Média das notas das baterias. Diferenças abaixo de 1 ponto são desempatadas pelo Brier. O intervalo por bootstrap acompanha a comparação.',
  },
  {
    id: 'imagens',
    name: 'Imagens',
    title: 'Olhar a mesma cena. Entender o mesmo mundo?',
    description:
      'Contar objetos, localizar posições e comparar profundidade e distância. Perguntas com fotografias do CV-Bench colocam a percepção visual à prova.',
    detail:
      'Participam Decisions e Clef, cujas APIs aceitam imagens nesta integração. Perguntas em português preservam as alternativas e os gabaritos do dataset.',
    batteries: ['Contagem', 'Posição relativa', 'Profundidade', 'Distância real'],
    providers: ['decisions', 'clef'],
    scoring:
      'Acertos por bateria, com a mesma importância para cada tarefa. A margem de erro ajuda a distinguir uma liderança de uma diferença inconclusiva.',
  },
] as const;
export type TestKind = (typeof tests)[number]['id'];
export const datasets = [
  {
    name: 'ASSIN 2',
    category: 'Implicação textual',
    year: '2019',
    description:
      'Uma frase realmente implica a outra? Pares de frases em português com rótulos humanos ajudam a testar essa distinção.',
    sampling:
      'Amostra balanceada do conjunto de teste, com identificadores selecionados por sorteio de semente fixa.',
    license: 'Licença não declarada na fonte consultada.',
    citation:
      'Real, Fonseca e Gonçalo Oliveira (2020). The ASSIN 2 Shared Task: A Quick Overview. PROPOR.',
    url: 'https://huggingface.co/datasets/nilc-nlp/assin2',
    sample: 'server/brava/portugues-ids.json',
  },
  {
    name: 'HateBR',
    category: 'Linguagem ofensiva',
    year: '2022',
    description:
      'Comentários brasileiros do Instagram anotados por especialistas. O teste observa a identificação de conteúdo ofensivo.',
    sampling:
      'Seleção balanceada entre comentários ofensivos e não ofensivos. Discordâncias entre anotadores são uma limitação relevante.',
    license: 'CC BY-NC 4.0; a fonte declara uso de pesquisa.',
    citation:
      'Vargas et al. (2022). HateBR: A Large Expert Annotated Corpus of Brazilian Instagram Comments for Offensive Language and Hate Speech Detection. LREC.',
    url: 'https://github.com/franciellevargas/HateBR',
    sample: 'server/brava/portugues-ids.json',
  },
  {
    name: 'B2W-Reviews01',
    category: 'Recomendação de produtos',
    year: '2018',
    description:
      'Avaliações reais de clientes. Com as estrelas omitidas, o modelo precisa identificar se a pessoa recomendaria o produto.',
    sampling:
      'Amostra balanceada por recomendação, escolhida por semente fixa. O rótulo vem do dataset.',
    license: 'CC BY-NC-SA 4.0; atribuição à B2W Digital.',
    citation:
      'Real, Oshiro e Mafra (2019). B2W-Reviews01: An Open Product Reviews Corpus. STIL. Dados de B2W Digital.',
    url: 'https://github.com/americanas-tech/b2w-reviews01',
    sample: 'server/brava/portugues-ids.json',
  },
  {
    name: 'CV-Bench',
    category: 'Percepção visual',
    year: '2024',
    description:
      'Quatro tarefas de visão com perguntas e gabaritos. As imagens vêm de COCO, ADE20K e subconjuntos do Omni3D.',
    sampling:
      'Sorteio com semente fixa, dividido entre contagem, posição relativa, profundidade e distância. Tradução por frases-padrão.',
    license: 'Apache-2.0 nas anotações. As fotografias seguem os termos dos datasets de origem.',
    citation:
      'Tong et al. (2024). Cambrian-1: A Fully Open, Vision-Centric Exploration of Multimodal LLMs. NeurIPS.',
    url: 'https://huggingface.co/datasets/nyu-visionx/CV-Bench',
    sample: 'server/visual/cvbench-sample.json',
  },
];
