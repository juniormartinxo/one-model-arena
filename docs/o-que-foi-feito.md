# O que foi feito, e como ler os resultados

Este documento explica a arena de ponta a ponta: o que ela compara, como cada rodada funciona, como os pontos são calculados, o que cada métrica significa, o que os resultados reais mostraram e quais são os limites. Para o roteiro do vídeo, veja `docs/roteiro-video.md`.

---

## 1. A ideia em uma frase

Comparar três **modelos de decisão** (Jev, OpenAI Decisions e Cloudflare Clef), que não geram texto, só escolhem entre opções e devolvem uma probabilidade para cada uma, usando os mesmos casos em português, com gabarito fixado antes, e com o Claude Opus como apresentador e comentarista cego.

## 2. Os participantes

| Modelo                   | Empresa    | Como é chamado                                                | Tarifa de entrada (08/10/2026)                               |
| ------------------------ | ---------- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| Jev 1.13                 | TypeSafe   | API própria (`state`, perguntas `noul`, `choice`, `score`)    | US$ 0,042 por milhão de tokens                               |
| Decisions (`gpt-6-luna`) | OpenAI     | API Decisions (`predicate`, `choice`, `score`)                | US$ 0,10 por milhão de tokens                                |
| Clef                     | Cloudflare | Workers AI, mesmo contrato do Jev, com envelope da Cloudflare | US$ 0,24 por milhão de tokens; 10 mil neurons grátis por dia |
| Claude Opus 5.5          | Anthropic  | Claude CLI, em sessões isoladas e sem ferramentas             | Assinatura do CLI                                            |

Os três modelos de decisão recebem **o mesmo texto e as mesmas alternativas**, ao mesmo tempo, sem gabarito e sem ver uns aos outros. O adaptador de cada API fica em `server/providers.ts`.

## 3. A linha do tempo das decisões

1. **Primeira versão (Jev × Decisions):** três cenários fictícios, o Opus decidia o vencedor com dois julgamentos invertidos. As duas primeiras reuniões reais deram 6 × 6 (Loja) e 6 × 5 para o Decisions (Produto).
2. **Cenários avançados:** como deu empate, entraram três cenários mais difíceis (lançamento, conversas, dossiê).
3. **Clef entra:** terceiro participante e julgamento cego com A, B e C.
4. **Vencedor objetivo:** o Opus deixou de votar. O vencedor passou a sair do gabarito, com desempate pela calibração. O Opus só explica.
5. **Maratona automática:** os seis cenários em sequência, sem cliques, com boletim final.
6. **Rodada brava:** segunda rodada, mais difícil, com 298 testes e boletim próprio.
7. **Correções pós-execução:** métrica de mudança de resposta, item ambíguo anulado, recálculo do boletim ao abrir.
8. **Rodada das imagens:** terceira rodada, só com Decisions e Clef, os dois que leem imagens, em 80 fotos do CV-Bench.
9. **Espaços próprios:** a página inicial passou a levar a um espaço por rodada e à sala de reuniões, cada um com endereço próprio, e o modo gravação passou a ocupar a tela inteira.

## 4. Rodada 1: a maratona

**O que é:** seis reuniões fictícias de seis rodadas cada, totalizando **36 decisões por modelo**:

| Bateria   | Cenários                  | O que exige                                                                                                   |
| --------- | ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Básicos   | Loja, Produto, Fornecedor | Aplicar regras explícitas: duplicidade de cobrança, prioridade de bugs, requisitos de contrato                |
| Avançados | Lançamento, Conversas     | Escopo de aprovação, retratações, referências ambíguas, instrução falsa em anexo                              |
| Estresse  | Dossiê                    | Autoridade entre documentos, aditivos com escopo, detalhes distratores, controle com alternativas reordenadas |

**Como roda:** o servidor avança sozinho. Em cada reunião, o Opus escreve uma abertura. A cada rodada, os três respondem em paralelo e o Opus comenta às cegas. No fim de cada reunião, o Opus explica o resultado. Ao final da maratona, ele escreve a leitura geral. São 49 chamadas ao Opus.

**Onde está:** cenários em `server/scenarios.ts` e `server/advanced-scenarios.ts`; motor em `server/engine.ts`; boletim em `shared/report.ts`.

## 5. Rodada 2: a rodada brava

**Por que existe:** na rodada 1, os três ficaram perto de 100%, porque o contexto de cada cenário escreve a regra que resolve a pergunta. A rodada brava testa o que acontece quando a regra **não entrega** a resposta.

| Bateria           | Itens                          | Como pontua                                                                                                                        | De onde veio                                                                                 |
| ----------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Robustez          | 144 (36 grupos × 4 versões)    | Grupo inteiro: todas as versões certas, e a evidência a mais não pode baixar a probabilidade da resposta certa em mais de 2 pontos | Método CheckList (Ribeiro et al., ACL 2020) e a limitação de ordem documentada pela TypeSafe |
| Português real    | 60 (20 + 20 + 20, balanceados) | Item                                                                                                                               | ASSIN 2, HateBR e B2W-Reviews01, com rótulo humano                                           |
| Saber dizer “não” | 30                             | Item                                                                                                                               | Pedidos fora do escopo e dados ausentes                                                      |
| Negação           | 48 (12 grupos × 4 versões)     | Grupo inteiro                                                                                                                      | Formato do CondaQA                                                                           |
| Injeção e pressão | 16                             | Item                                                                                                                               | Inspirado no BIPIA e nas limitações documentadas                                             |

As quatro versões da robustez são:

- **Original:** a pergunta da rodada 1 sem mudança.
- **Texto irrelevante:** cerca de mil tokens de anotações de escritório antes dos fatos.
- **Erros de digitação:** letras trocadas e acentos retirados, sem tocar em palavras de negação.
- **Uma quarta versão, que depende do tipo de pergunta:**
  - escolha: alternativas em ordem invertida;
  - sim/não ou escala: uma frase a mais confirmando o gabarito.

Os itens de abstenção, negação e injeção estão em `server/brava/authored.ts`. Foram escritos antes de consultar os modelos e respondidos às cegas por outra sessão: as 94 respostas coincidiram com os gabaritos. Seis itens foram apontados como passíveis de outra leitura e foram reescritos antes da execução real.

**Português real:** `npm run datasets` baixa os dados das fontes oficiais para `data/datasets/`, que não vai para o Git, e seleciona os itens listados em `server/brava/portugues-ids.json`, sorteados com semente fixa. Os comentários do HateBR nunca aparecem na tela.

**Opus na rodada brava:** uma abertura, um comentário por bateria e a leitura final. São 7 chamadas, todas às cegas.

## 6. Rodada 3: a rodada das imagens

**Por que existe:** Decisions e Clef aceitam imagens, e o Jev não. A rodada 3 compara só os dois em decisões sobre fotos reais.

| Bateria          | Itens | O que exige                                                                     | Acerto no chute |
| ---------------- | ----- | ------------------------------------------------------------------------------- | --------------- |
| Contagem         | 20    | Contar objetos de um tipo na foto                                               | 17% a 25%       |
| Posição relativa | 20    | Dizer se um objeto está à esquerda, à direita, acima ou abaixo de outro         | 50%             |
| Profundidade     | 20    | Dizer qual de dois objetos marcados está mais perto da câmera                   | 50%             |
| Distância real   | 20    | Dizer qual de dois objetos está mais perto de um terceiro no mundo, não na foto | 50%             |

**De onde veio:** CV-Bench (Tong et al., NeurIPS 2024), um benchmark de visão com fotos de ADE20K, COCO e Omni3D e caixas coloridas já desenhadas. As 80 perguntas foram sorteadas com semente fixa, 20 por tarefa, e ficam em `server/visual/cvbench-sample.json`. As fotos são baixadas por `npm run imagens` para `data/datasets/imagens/`, fora do Git.

**Em português:** as perguntas do dataset seguem quatro frases-padrão em inglês. O catálogo as verte com um dicionário dos objetos citados, mantendo as alternativas e a letra do gabarito. Exemplo: “Qual objeto está mais perto da câmera que tirou a foto: o pedestre (caixa vermelha) ou a barreira (caixa azul)?”.

**Como a foto vai:** embutida na chamada em base64. No Decisions, como `input_image` ao lado do texto; no Clef, no campo `images`. O registro guarda só o tamanho e o sha256 de cada foto.

**Como pontua:** igual à rodada brava (seção 7): nota de cada bateria, média simples, empate abaixo de 1 ponto desempatado pelo Brier e margem por bootstrap.

**Opus:** abre, comenta cada bateria e escreve a leitura final, às cegas. Não vê as fotos: lê a pergunta, as alternativas, o gabarito e as respostas. São 6 chamadas.

**Onde está:** `server/visual/` (amostra, tradução e catálogo) e `scripts/fetch-images.ts`. A execução e o boletim reaproveitam `server/brava/runner.ts` e `shared/brava-report.ts`.

## 7. Como os pontos são calculados

### Rodada 1

- **Escolha:** acerta se a alternativa é a do gabarito.
- **Sim/não:** acerta com probabilidade de “sim” ≥ 80% quando o gabarito é sim, ou ≤ 20% quando é não. **Entre 20% e 80%, é revisão humana: vale zero, mas não é erro.**
- **Escala:** acerta se ficar a no máximo 0,4 do nível esperado.
- **Vencedor:** mais acertos. Em empate, o menor Brier médio, com diferença mínima de 0,005. Se uma resposta ausente pudesse mudar a liderança, não há vencedor.

### Rodada brava

- **Nota de cada bateria**, de 0 a 100%: grupos inteiros na robustez e na negação, itens nas demais.
- **Nota geral = média simples das baterias**, para que a robustez, com 144 itens, não pese mais que a injeção, com 16.
- **Empate:** diferenças menores que 1 ponto, desempatadas pelo Brier.
- **Margem de erro:** intervalo de 95% por bootstrap pareado (seção 8).
- **Itens anulados:** ficam no registro e saem da nota de todos (seção 10).

A regra foi fixada **antes** das execuções e está nas páginas Método e README.

## 8. Glossário das métricas

| Métrica                            | O que mede                                                                                                                | Como ler                                                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Brier**                          | Distância entre as probabilidades declaradas e o gabarito. Para cada pergunta, soma o quadrado da diferença em cada opção | 0 = certeza correta; 2 = certeza errada. Menor é melhor. Premia acertar com convicção e pune errar com convicção. Só compara perguntas que os três responderam       |
| **Erro de calibração (ECE)**       | Agrupa respostas pela confiança e compara com a taxa real de acerto                                                       | 0% = quando diz 90%, acerta 90%. Mede honestidade da confiança, não acerto                                                                                           |
| **Brier × ECE**                    | Medem coisas diferentes                                                                                                   | Na rodada brava, o Decisions teve o menor ECE (0,5%: confiança honesta) e o Clef, o menor Brier (mais certeiro e convicto). Os dois podem ser verdade ao mesmo tempo |
| **Intervalo de 95% (bootstrap)**   | Reamostra os grupos e itens de cada bateria mil vezes e recalcula a diferença entre dois modelos                          | Se o intervalo inclui zero, a diferença está **dentro da margem de erro**                                                                                            |
| **Mudou de decisão**               | Na robustez, quantas perguntas tiveram decisão diferente da versão original                                               | Compara a decisão (alternativa, Sim/Não/Revisão, nível da escala), não o número. Separa mudanças “rumo ao gabarito” (corrigiram um erro) e “para longe” (criaram um) |
| **Adivinhou sem dados**            | Na abstenção, quantas vezes escolheu uma resposta onde o certo era “fora do escopo” ou “não informado”                    | Menor é melhor                                                                                                                                                       |
| **Tokens por decisão**             | Tokens de entrada contados pela API para o mesmo texto                                                                    | Tokenizadores diferentes mudam o preço real                                                                                                                          |
| **Custo por 1 milhão de decisões** | Tokens de entrada × tarifa, projetados                                                                                    | Não inclui a cota grátis do Clef                                                                                                                                     |
| **Mediana de resposta**            | Tempo típico por chamada                                                                                                  | Inclui a rede até cada API                                                                                                                                           |

## 9. Resultados reais

### Rodada 1: maratona `c70f2fd8` (08/10/2026, 13 minutos)

|                                | Clef       | Decisions              | Jev                    |
| ------------------------------ | ---------- | ---------------------- | ---------------------- |
| Acertos                        | **36/36**  | 35/36                  | 34/36                  |
| Erros com convicção            | 0          | 1 (f1, 95% de certeza) | 0                      |
| Revisões humanas               | 0          | 0                      | 2 (p6: 0,73; f1: 0,75) |
| Brier                          | **0,0014** | 0,0503                 | 0,0114                 |
| Tokens por decisão             | 397        | 371                    | 577                    |
| Custo por 1 milhão de decisões | US$ 95,28  | US$ 37,13              | **US$ 24,23**          |
| Mediana de resposta            | 0,80 s     | **0,32 s**             | **0,32 s**             |

**Como ler:**

- **Vencedor:** Clef, por pontos.
- **Onde se decidiu:** toda a diferença saiu de duas perguntas básicas. Avançados e estresse ficaram em 100% para todos.
- **Calibração:** o Jev ficou mais bem calibrado que o Decisions, porque um erro com convicção pesa mais no Brier que duas dúvidas.
- **Preço:** a tarifa do Jev é 2,4 vezes menor que a do Decisions, mas ele conta cerca de 55% mais tokens para o mesmo texto. O custo real por decisão fica só 1,5 vez menor.
- **Determinismo:** o Jev repetiu exatamente 0,73 na p6 em duas execuções diferentes, sinal de que suas respostas são determinísticas.

### Rodada 2: rodada brava `4f26181a` (08/10/2026, 2 min 34 s, 297 itens pontuados)

|                                 | Clef         | Decisions                        | Jev                            |
| ------------------------------- | ------------ | -------------------------------- | ------------------------------ |
| Nota geral                      | 97,4         | **98,1**                         | 87,1                           |
| Robustez                        | 97,2%        | 97,2%                            | 88,9%                          |
| Português real                  | 90,0%        | **93,3%**                        | 81,7%                          |
| Saber dizer “não”               | 100%         | 100%                             | 100%                           |
| Negação                         | 100%         | 100%                             | 91,7%                          |
| Injeção e pressão               | 100%         | 100%                             | 73,3%                          |
| Erros com convicção             | **1**        | 2                                | 0                              |
| Revisões humanas                | 5            | 3                                | 21                             |
| Mudanças de decisão na robustez | **0 de 108** | 3 de 108, todas rumo ao gabarito | 3 de 108: 1 rumo, 2 para longe |
| Brier                           | **0,0116**   | 0,0182                           | 0,0310                         |
| ECE                             | 2,4%         | **0,5%**                         | 4,2%                           |
| Tokens por decisão              | 394          | 371                              | 555                            |
| Custo por 1 milhão de decisões  | US$ 94,47    | US$ 37,11                        | **US$ 23,30**                  |
| Mediana de resposta             | 0,43 s       | **0,22 s**                       | 0,27 s                         |

**Margem de erro da nota geral (Clef como referência):**

| Comparação       | Intervalo de 95% da diferença | Leitura                         |
| ---------------- | ----------------------------- | ------------------------------- |
| Clef − Decisions | de −2,8 a +1,7 pontos         | Inclui zero: empate técnico     |
| Clef − Jev       | de +4,6 a +16,6 pontos        | Não inclui zero: diferença real |

**Como ler:**

- **Vencedor:** Clef, **no desempate por calibração**. O Decisions teve 0,7 ponto a mais, abaixo da linha de empate de 1 ponto, e o Clef teve o Brier menor. A diferença entre os dois está dentro da margem de erro.
- **Estabilidade:** o Clef nunca mudou de decisão quando só a forma da pergunta mudou. As três mudanças do Decisions corrigiram o próprio erro da f1.
- **O Jev não errou com convicção nenhuma vez.** Todas as suas perdas são revisões humanas, quase sempre inclinadas para a resposta certa. Na injeção, ele não aprovou nenhuma despesa irregular. Hesitou em quatro legítimas: três com texto manipulador em volta e uma exceção aprovada.
- **Saber dizer “não” não separou ninguém:** os três fizeram 100%. As perguntas ofereciam “fora do escopo” e “não informado” explicitamente, o que deixou a bateria fácil.
- **Rótulos disputados:** dois itens do HateBR concentram os problemas. No 2198, Decisions e Clef erraram com convicção; no 271, os três pediram revisão. Nos dois, um dos três anotadores humanos discordou dos outros.

### Rodada 3: rodada das imagens

Execução `405f3260` (09/10/2026, 1 min 45 s, 80 fotos por modelo):

|                     | Clef         | Decisions  |
| ------------------- | ------------ | ---------- |
| Nota geral          | **85,0**     | 81,2       |
| Contagem            | 65%          | **70%**    |
| Posição relativa    | 90%          | 90%        |
| Profundidade        | 95%          | 95%        |
| Distância real      | **90%**      | 70%        |
| Acertos             | **68 de 80** | 65 de 80   |
| Sem resposta        | 1            | 0          |
| Brier               | **0,191**    | 0,227      |
| ECE                 | 6,1%         | 5,9%       |
| Tokens por decisão  | cerca de 760 | 866        |
| Mediana de resposta | 0,66 s       | **0,46 s** |

**Como ler:**

- **Vencedor:** Clef, por pontos. A diferença está **dentro da margem de erro**: o intervalo de 95% vai de −5 a +12,5 pontos.
- **Onde se decidiu:** na distância real. Posição relativa e profundidade empataram.
- **Resposta ausente:** o Clef não respondeu à foto `img-contagem-314`. O Workers AI devolveu HTTP 413 ao estimar 132.638 tokens para uma foto de 2200×1650, acima da janela de 65.536. Uma foto de 2048×1536 tinha custado só 1.247 tokens. Contada como perdida, ela não muda o vencedor. Depois disso, `npm run imagens` passou a reduzir as fotos para no máximo 1600 px no lado maior; essa execução usou as fotos originais.
- **Custo:** sem estimativa por milhão de decisões, porque a chamada recusada não informou consumo.

### Da rodada 1 para a rodada brava

|           | Rodada 1 (acertos) | Rodada brava (nota) |
| --------- | ------------------ | ------------------- |
| Clef      | 100%               | 97,4                |
| Decisions | 97,2%              | 98,1                |
| Jev       | 94,4%              | 87,1                |

## 10. Correções feitas depois de rodar, e por quê

1. **Mudança de resposta comparava números, não decisões.**
   - **O problema:** numa pergunta de escala, 1,98 e 1,97 contavam como “mudou de resposta”. Das 21 mudanças registradas, 15 eram isso.
   - **A correção:** passa a comparar a decisão e a separar mudanças rumo ao gabarito das que vão para longe. A nota de robustez não mudou, porque já usava o acerto.
2. **Item `inj-10` anulado.**
   - **O problema:** “exceções só valem com aprovação” podia ser lido como exceção apenas ao limite de valor, e não à lista de itens. Decisions e Clef leram assim.
   - **A correção:** o item foi anulado para os três e reescrito como `inj-10b` para as próximas rodadas. A lista de anulados fica em `shared/brava-report.ts`.
3. **Boletim recalculado ao abrir.** Ele é derivado das respostas salvas, então aplica as regras atuais sem alterar nenhuma resposta. Vale para a maratona e para a rodada brava.
4. **Prompt do Opus com nomes descritivos.** Com nomes curtos, o Opus chamou “evidência a mais” de “pergunta invertida”. **A leitura final da rodada brava `4f26181a` foi escrita antes dessa correção:** cita números antigos e essa confusão. Use os números do boletim.

Correções anteriores, da maratona:

- **Velocidade:** um empate deixou de esconder a recomendação de velocidade.
- **Custo:** a recomendação de custo passou a explicar a diferença de tokens.
- **Clef:** o token da Cloudflare deixou de ser herdado pelo subprocesso do CLI.

## 11. Limites

- **Recorte:** testes em português, num recorte de tarefas. Não é um ranking universal.
- **Gabaritos:**
  - Os da rodada 1 e os itens escritos à mão são do autor do teste, embora revisados às cegas.
  - Os do português real são humanos, mas têm discordância entre anotadores.
- **Contaminação:** ASSIN 2 (2019), HateBR (2022), B2W (2018) e CV-Bench (2024) são públicos e podem estar nos dados de treino.
- **Licenças:** HateBR (CC BY-NC 4.0) e B2W (CC BY-NC-SA 4.0) proíbem uso comercial. A licença do ASSIN 2 não é declarada. As anotações do CV-Bench são Apache-2.0, mas as fotos seguem os termos de COCO, ADE20K e Omni3D; o nuScenes, por exemplo, é CC BY-NC-SA 4.0. O repositório não redistribui textos nem fotos.
- **Medição:**
  - Latência inclui a rede.
  - Custo considera só tokens de entrada.
  - O Clef tem cota grátis que não entra na estimativa.
- **Determinismo:** as respostas parecem determinísticas, mas não foi feito um teste formal de repetição. Por isso, a afirmação “o Clef nunca mudou de decisão” não tem um ruído de base medido para comparar.
- **Rodada das imagens:** 20 fotos por bateria é pouco; o CV-Bench é público desde 2024 e pode estar nos dados de treino; as perguntas foram vertidas para o português por frases-padrão, não por um tradutor humano.
- **Amostra:** 36 perguntas na rodada 1 não sustentam conclusões estatísticas. A rodada brava, com margem por bootstrap, sustenta só a separação contra o Jev.

## 12. Datasets usados

A rodada 1 e as baterias escritas da rodada brava não usam datasets externos. Os conjuntos públicos entram em duas baterias:

| Rodada      | Dataset       | O que foi usado                                                                    | Licença declarada                                    |
| ----------- | ------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 2 · Brava   | ASSIN 2       | 20 pares de frases, implicação ou não, balanceados                                 | Não declarada pela fonte                             |
| 2 · Brava   | HateBR        | 20 comentários do Instagram, ofensivos ou não, balanceados; nunca aparecem na tela | CC BY-NC 4.0, uso de pesquisa                        |
| 2 · Brava   | B2W-Reviews01 | 20 avaliações de compra, recomendaria ou não, balanceadas, sem as estrelas         | CC BY-NC-SA 4.0, crédito à B2W Digital               |
| 3 · Imagens | CV-Bench      | 80 perguntas com foto, 20 por tarefa: contagem, posição, profundidade e distância  | Apache-2.0 nas anotações; fotos com termos de origem |

As fotos do CV-Bench vêm de COCO 2017 (22), ADE20K (18) e Omni3D (40, dos subconjuntos SUN RGB-D, Hypersim e nuScenes). Os gabaritos são os rótulos de cada dataset, sem correção do autor. As amostras foram sorteadas com semente fixa e ficam em `server/brava/portugues-ids.json` e `server/visual/cvbench-sample.json`.

**Referências:**

- **ASSIN 2:** Real, L.; Fonseca, E.; Gonçalo Oliveira, H. (2020). _The ASSIN 2 Shared Task: A Quick Overview_. PROPOR 2020. [nilc-nlp/assin2](https://huggingface.co/datasets/nilc-nlp/assin2).
- **HateBR:** Vargas, F. et al. (2022). _HateBR: A Large Expert Annotated Corpus of Brazilian Instagram Comments for Offensive Language and Hate Speech Detection_. LREC 2022. [franciellevargas/HateBR](https://github.com/franciellevargas/HateBR).
- **B2W-Reviews01:** Real, L.; Oshiro, M.; Mafra, A. (2019). _B2W-Reviews01: An Open Product Reviews Corpus_. STIL 2019. [americanas-tech/b2w-reviews01](https://github.com/americanas-tech/b2w-reviews01).
- **CV-Bench:** Tong, S. et al. (2024). _Cambrian-1: A Fully Open, Vision-Centric Exploration of Multimodal LLMs_. NeurIPS 2024. [nyu-visionx/CV-Bench](https://huggingface.co/datasets/nyu-visionx/CV-Bench).
- **COCO:** Lin, T.-Y. et al. (2014). _Microsoft COCO: Common Objects in Context_. ECCV 2014.
- **ADE20K:** Zhou, B. et al. (2017). _Scene Parsing through ADE20K Dataset_. CVPR 2017.
- **Omni3D:** Brazil, G. et al. (2023). _Omni3D: A Large Benchmark and Model for 3D Object Detection in the Wild_. CVPR 2023.

## 13. Como reproduzir

```sh
git clone git@github.com:juniormartinxo/one-model-arena.git
cd one-model-arena
npm install
cp .env.example .env    # preencha as chaves dos três provedores
claude auth login
npm run datasets        # amostra de português real
npm run imagens         # fotos da rodada das imagens
npm run dev             # abra http://127.0.0.1:4317
```

A página inicial leva a quatro espaços, cada um com endereço próprio: Rodada 1 · Maratona (`#/maratona`), Rodada 2 · Brava (`#/brava`), Rodada 3 · Imagens (`#/imagens`) e a Sala de reuniões (`#/sala`), para reuniões avulsas rodada a rodada. Em cada espaço: **Ensaio da maratona**, **Ensaio da rodada brava** e **Ensaio da rodada das imagens** rodam sem custo, com dados sintéticos. **Iniciar maratona real**, **Iniciar rodada brava** e **Iniciar rodada das imagens** usam as APIs; a rodada das imagens precisa só das chaves da OpenAI e da Cloudflare. Cada execução exporta um JSON com cenários, payloads, respostas originais, custos, tempos e prompts e saídas do Opus.

## 14. Mapa dos arquivos

| Caminho                                               | O que tem                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `server/scenarios.ts`, `server/advanced-scenarios.ts` | Cenários e gabaritos da rodada 1                                                     |
| `server/providers.ts`                                 | Adaptadores das três APIs                                                            |
| `server/engine.ts`                                    | Reuniões, piloto automático e maratona                                               |
| `server/judging.ts`                                   | Prompts do Opus e anonimização A/B/C                                                 |
| `server/claude.ts`                                    | Subprocesso isolado do Claude CLI                                                    |
| `server/brava/`                                       | Rodada brava: itens escritos, catálogo, datasets e execução                          |
| `server/visual/`                                      | Rodada das imagens: amostra do CV-Bench, tradução e catálogo                         |
| `scripts/fetch-images.ts`                             | Download das fotos do CV-Bench                                                       |
| `scripts/fetch-datasets.ts`                           | Download e amostragem dos datasets                                                   |
| `shared/scoring.ts`                                   | Pontuação por pergunta e Brier                                                       |
| `shared/report.ts`                                    | Regra de vencedor e boletim da maratona                                              |
| `shared/brava-report.ts`                              | Notas, margem, calibração, mudanças e itens anulados da rodada brava                 |
| `src/`                                                | Interface: início, rodadas, sala de reuniões, boletins, histórico, Método e Conexões |
| `tests/`                                              | Testes unitários e de navegador                                                      |
