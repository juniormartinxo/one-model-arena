# One Model Arena · Jev × Decisions × Clef

Estúdio local para comparar, em português, três modelos de decisão estruturada: Jev (TypeSafe), OpenAI Decisions e Cloudflare Clef. São três rodadas, cada uma com boletim próprio:

1. **Maratona de reuniões:** seis reuniões fictícias em sequência, 36 decisões por modelo, com regras escritas no contexto.
2. **Resiliência:** 298 testes por modelo em que a regra não entrega a resposta, incluindo textos reais de três datasets públicos em português.
3. **Rodada das imagens:** 80 fotos reais do CV-Bench, só com Decisions e Clef, os dois modelos cujas APIs leem imagens.

O vencedor sai do gabarito; o Claude Opus 5.5, pelo CLI, apresenta, comenta e explica o resultado sem ver as marcas. Os datasets usados estão em [Datasets usados nos testes](#datasets-usados-nos-testes).

## Site público

`npm run dev:public` abre a versão pública em **http://127.0.0.1:4319**. O build independente `npm run build:public` gera `dist-public/`, configurado para a Vercel em `vercel.json`. A página apresenta os testes, a metodologia, os datasets e uma edição de resultados selecionada; não oferece execução de rodadas ou acesso ao backend.

A primeira edição começa **em preparação**, sem reutilizar resultados antigos. Após as novas execuções, siga [Publicação de resultados](docs/publicacao.md) para preparar o JSON público, conferir e publicar. Nenhuma credencial dos modelos é necessária no site público.

## Nova edição de testes

O [roteiro](docs/roteiro-video.md) está preparado com resultados pendentes. Siga o [protocolo da nova bateria](docs/protocolo-nova-bateria.md) para preservar o histórico, registrar a versão das regras e executar as três provas. Os números em `docs/o-que-foi-feito.md` são históricos, de 08–09/10/2026; não são resultados desta nova edição.

## Reproduzir o teste

1. Instale Node.js 24.14+, clone o repositório e rode `npm install`.
2. `cp .env.example .env` e preencha as credenciais dos três provedores (seções abaixo). Faça login no Claude Code (`claude auth login`).
3. `npm run dev` e abra http://127.0.0.1:4317. Em **Conexões**, os quatro itens devem aparecer como detectados.
4. No início, entre em **Rodada 1 · Maratona de reuniões** e clique em **Ensaio da Maratona de reuniões** para conferir o fluxo sem custo. Depois, **Iniciar Maratona de reuniões real**. As rodadas 2 e 3 e a **Sala de reuniões** (reunião avulsa, rodada a rodada) têm cada uma o seu espaço.
5. A tela entra em modo gravação e avança sozinha. Ao final, exporte a Maratona de reuniões em JSON: ela inclui cenários congelados com hash, payloads, respostas originais, prompts e saídas do Opus.
6. Para a **Resiliência**, rode antes `npm run datasets` (baixa a amostra de português real das fontes oficiais) e use **Ensaio da Resiliência** e **Iniciar Resiliência**. Ela tem boletim próprio, separado da Maratona de reuniões.
7. Para a **rodada das imagens** (rodada 3, só Decisions e Clef), rode antes `npm run imagens` (baixa as 80 fotos do CV-Bench) e use **Ensaio da rodada das imagens** e **Iniciar rodada das imagens**. Ela não precisa da chave da TypeSafe.

Os cenários e gabaritos estão em `server/scenarios.ts` e `server/advanced-scenarios.ts`. Para testar seus próprios casos, edite esses arquivos: o hash muda e identifica o roteiro usado.

## Rodar

Requer Node.js **24.14 ou superior**, npm e, para execução real, Claude Code recente compatível com `--safe-mode`, `--json-schema`, `--tools` e `--no-session-persistence`. A implementação foi desenvolvida com Claude Code 2.1.295. O SQLite embutido no Node pode emitir um aviso de API experimental.

```sh
npm install
npm run dev
```

Abra **http://127.0.0.1:4317**. O backend usa a porta 4318.

**Ensaio da Maratona de reuniões** e **Iniciar ensaio** percorrem o fluxo completo com dados sintéticos locais. Não requer chaves e não chama nenhuma IA. Os resultados são identificados na tela, no histórico e na exportação. Eles não avaliam o desempenho de Jev, Decisions, Clef ou Opus.

Para uma execução real:

```sh
cp .env.example .env
# Edite .env localmente e preencha OPENAI_API_KEY, TYPESAFE_API_KEY,
# CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN.
claude auth login
npm run dev
```

As credenciais dos três provedores são necessárias para a execução real. O Opus usa a autenticação já existente do seu CLI; nenhuma chave da Anthropic é solicitada pelo app. O servidor herda a modalidade de autenticação do CLI, inclusive configurações de ambiente existentes. Não coloque segredos em variáveis `VITE_*` nem no frontend. Reinicie o backend após editar `.env`.

Se você chama o Claude Code por um executável próprio ou com um perfil, configure no `.env`:

```dotenv
CLAUDE_BIN=/caminho/para/seu-executavel
CLAUDE_ARGS='["seu-perfil"]'
```

`CLAUDE_ARGS` é uma lista JSON de argumentos, passada antes das opções do Claude sem executar um shell. A verificação de login e todas as chamadas usam o mesmo executável e perfil.

O painel **Conexões** verifica instalação, login do Claude no perfil configurado e presença das chaves, sem chamadas de inferência. Reuniões reais não começam quando o login do CLI está ausente ou não pode ser verificado. Saldo, limites e acesso ao modelo são validados durante a execução real.

Produção local:

```sh
npm run build
npm start
```

Abra http://127.0.0.1:4318. Não há serviço externo de banco, autenticação web ou hospedagem. O servidor escuta somente na interface de loopback e restringe Host/Origin a localhost. Não exponha esta ferramenta com credenciais na internet.

## Como as coisas funcionam

1. Na Maratona de reuniões, os seis cenários rodam em sequência. Na reunião avulsa, escolha um deles. Cada cenário tem seis rodadas.
2. O servidor congela o cenário, calcula seu SHA-256 e salva o roteiro e o gabarito em SQLite. O Opus prepara a abertura e as transições, preservando perguntas e critérios.
3. Na Maratona de reuniões, o piloto automático avança sozinho, com pausas de leitura (`AUTOPLAY_DELAY_MS`, padrão 8 s, entre rodadas; `SERIES_PAUSE_MS`, padrão 14 s, entre reuniões). Na reunião avulsa, você avança manualmente. Os provedores recebem os mesmos fatos e perguntas, por suas APIs nativas, em paralelo. Não recebem gabaritos, respostas do concorrente ou comentários anteriores.
4. Cada resultado é persistido quando chega. O placar objetivo dá um ponto por aderência ao gabarito e registra separadamente divergência, incerteza e indisponibilidade.
5. A rodada vai para quem acertou sozinho; se mais de um acertou, é empate. Uma sessão nova do Opus comenta a rodada com nomes A/B/C aleatórios, sem marca, modelo, tempo ou custo, e não altera esse resultado. O mapeamento é revelado no painel após o comentário.
6. Após a sexta rodada, o vencedor da reunião sai de uma regra fixa: mais pontos pelo gabarito; em empate, o menor Brier médio, com diferença mínima de 0,005. Se uma resposta ausente pudesse mudar a liderança, não há vencedor. Uma sessão cega do Opus explica o resultado. Reuniões gravadas antes desta regra mantêm os julgamentos do Opus que as decidiram.
7. Ao fim da Maratona de reuniões, o boletim soma as 36 decisões: acertos por bateria (básicos, avançados, estresse), calibração, custo, projeção para um milhão de decisões, mediana de resposta e as perguntas sem acerto unânime. As recomendações ("quando errar custa caro", "quando o volume é alto", "quando a resposta precisa ser imediata") são frases geradas por regras sobre esses números. O Opus escreve uma leitura final cega.
8. O histórico permite replay sem inferência e exportação JSON com cenários, payloads, respostas originais, prompts/saídas do CLI, eventos e métricas.

O **Brier** mede a distância entre as probabilidades que o modelo declarou e o gabarito: 0 é certeza correta; 2, certeza errada. Ele premia quem acerta com convicção e pune quem erra com convicção, e só compara rodadas respondidas por todos. Não mede apenas calibração: o ECE compara confiança e frequência de acerto por faixa, e pode ter outro líder. Nas perguntas de sim/não, a arena marca probabilidades entre 20% e 80% para revisão; isso não é um pedido de ajuda do modelo nem prova segurança em produção.

Veja [o que são Brier e ECE, com contas e exemplos](docs/o-que-foi-feito.md#8-glossário-das-métricas), incluindo as regras de desempate e os cuidados para interpretar amostras pequenas.

O Opus não recebe ferramentas, MCPs ou histórico anterior; cada chamada usa uma pasta temporária e `--no-session-persistence`. A execução usa argumentos estruturados e stdin, sem shell. `--safe-mode` preserva a autenticação normal e desativa customizações; **não usamos `--bare`**, porque esse modo não reutiliza login por assinatura/OAuth. O modelo solicitado é explícito, sem fallback automático.

Os comentários são interpretações do Opus, não explicações produzidas pelos concorrentes. As consequências exibidas são regras fictícias da simulação, não resultados financeiros ou comerciais observados. A Maratona de reuniões liga o “Modo gravação”, que reduz o chrome da interface e mantém o progresso fixo no topo; Escape retorna ao modo normal. Ele não grava um arquivo de vídeo: use seu gravador de tela.

## Resiliência

A rodada 1 mede se o modelo aplica regras escritas. A Resiliência testa alterações de apresentação, evidência adicional e tarefas com textos reais. São 298 testes por modelo em cinco baterias, rodando em piloto automático, com o Opus abrindo, comentando cada bateria e escrevendo a leitura final, sempre às cegas (7 chamadas do CLI).

| Bateria           | Itens                                                                                                                                                                                        | Como pontua                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Robustez          | 144: as 36 perguntas da rodada 1 em quatro versões (original, texto irrelevante, erros de digitação e, conforme o tipo, alternativas invertidas ou uma evidência a mais a favor do gabarito) | Grupo inteiro: todas as versões certas, e a evidência a mais não pode baixar a probabilidade da resposta certa em mais de 2 pontos |
| Português real    | 60: 20 do ASSIN 2 (implicação), 20 do HateBR (ofensivo ou não) e 20 do B2W-Reviews01 (recomendaria ou não), balanceados                                                                      | Item                                                                                                                               |
| Saber dizer “não” | 30: pedidos fora do escopo e perguntas sobre dados ausentes                                                                                                                                  | Item; o boletim conta também quantas vezes o modelo adivinhou                                                                      |
| Negação           | 48: 12 grupos com original, paráfrase, escopo alterado e negação desfeita                                                                                                                    | Grupo inteiro                                                                                                                      |
| Injeção e pressão | 16: instruções escondidas, aprovações falsas e exceções legítimas                                                                                                                            | Item                                                                                                                               |

A nota geral é a média simples das notas das baterias. Diferenças abaixo de 1 ponto são empate, desempatado pelo Brier médio. Se uma resposta ausente puder mudar a liderança, não há vencedor. O boletim traz o intervalo de 95% da diferença entre o primeiro e cada rival, por bootstrap pareado: quando ele inclui zero, a diferença está dentro da margem de erro. Também mostra o diagrama de calibração, a taxa de mudança de resposta por tipo de alteração e a comparação com a última Maratona de reuniões concluída.

A taxa de mudança de resposta compara a **decisão** (alternativa, Sim/Não/Revisão humana ou nível da escala), não o número: 1,97 e 1,99 na mesma escala são a mesma resposta. Cada mudança é classificada como rumo ao gabarito ou para longe dele. Das 108 comparações, 88 alteram a forma (16 de ordem, 36 de ruído e 36 de digitação) e 20 acrescentam evidência favorável. Não há controle de repetição idêntica para medir variação normal. A nota média das baterias e a proporção de acertos da maratona são medidas diferentes; sua diferença não mede evolução do modelo.

Itens considerados ambíguos depois de uma rodada são **anulados** em `annulledItems` (`shared/brava-report.ts`): continuam no registro e na exportação, mas saem da nota de todos os modelos, e o boletim mostra o motivo. O boletim de uma rodada concluída é recalculado a partir das respostas salvas sempre que é aberto. Até agora, um item foi anulado: `inj-10`, em que “exceções” podia ser lido como exceção só ao limite de valor. Ele foi reescrito como `inj-10b`.

Os itens de abstenção, negação e injeção estão em `server/brava/authored.ts`. Foram escritos antes de consultar os modelos e respondidos às cegas por outra sessão: as 94 respostas coincidiram com os gabaritos, e os 6 itens apontados como passíveis de outra leitura foram reescritos.

### Datasets de português real

`npm run datasets` baixa os dados das fontes oficiais para `data/datasets/`, que não vai para o Git, e seleciona os itens listados em `server/brava/portugues-ids.json` (sorteio com semente fixa; `npm run datasets -- --resample` sorteia de novo e muda o hash do catálogo). O repositório não redistribui nenhum texto desses conjuntos. Fontes, licenças e citações estão em [Datasets usados nos testes](#datasets-usados-nos-testes).

HateBR e B2W não permitem uso comercial: confira se o seu uso se enquadra. Os comentários do HateBR podem conter ofensas e discurso de ódio; a interface nunca os exibe, mas eles vão para os modelos, para o Opus e para o JSON exportado. Por serem públicos e antigos, esses textos podem estar nos dados de treino dos modelos.

## Rodada das imagens

A rodada 3 testa decisões sobre fotos. Só participam Decisions e Clef, os dois modelos cujas APIs aceitam imagens; o Jev fica de fora. São 80 fotos reais do [CV-Bench](https://huggingface.co/datasets/nyu-visionx/CV-Bench) em quatro baterias de 20, com o mesmo piloto automático, a mesma pontuação e o mesmo boletim da Resiliência, e o Opus abrindo, comentando cada bateria e escrevendo a leitura final (6 chamadas do CLI).

| Bateria          | O que pergunta                                                                 | Alternativas | Acerto no chute |
| ---------------- | ------------------------------------------------------------------------------ | ------------ | --------------- |
| Contagem         | Quantos objetos de um tipo aparecem na foto                                    | 4 a 6        | 17% a 25%       |
| Posição relativa | Se um objeto está à esquerda, à direita, acima ou abaixo de outro              | 2            | 50%             |
| Profundidade     | Qual de dois objetos marcados por caixas coloridas está mais perto da câmera   | 2            | 50%             |
| Distância real   | Qual de dois objetos está mais perto de um terceiro no mundo real, não na foto | 2            | 50%             |

Os gabaritos são os do dataset. As perguntas do CV-Bench seguem quatro frases-padrão em inglês; `server/visual/catalog.ts` as verte para o português com um dicionário dos objetos citados, mantendo as alternativas e a letra da resposta certa. As caixas vermelha, azul e verde já vêm desenhadas nas fotos.

A foto vai embutida em cada chamada como data URL em base64, porque nenhuma das duas APIs aceita links: no Decisions, como uma parte `input_image` ao lado do texto; no Clef, no campo `images`, a extensão do contrato do Jev. O registro e a exportação guardam só o tamanho e o sha256 de cada foto, não os bytes. O Opus não vê as fotos: comenta a partir da pergunta, das alternativas, do gabarito e das respostas.

`npm run imagens` baixa as fotos do servidor de datasets do Hugging Face para `data/datasets/imagens/`, que não vai para o Git. A amostra (20 por tarefa, semente fixa) fica em `server/visual/cvbench-sample.json`, com as perguntas e os gabaritos; `npm run imagens -- --resample` sorteia de novo e muda o hash do catálogo. O script também reduz toda foto para no máximo 1600 px no lado maior, inclusive as baixadas antes: o Workers AI recusou uma foto de 2200×1650 estimando 132 mil tokens, acima da janela de 65.536 do Clef, embora a documentação aceite até 16 megapixels. Os dois modelos recebem o mesmo arquivo reduzido. As fotos não são redistribuídas. O CV-Bench é público desde 2024 e pode estar nos dados de treino dos modelos. Fontes, licenças e citações estão em [Datasets usados nos testes](#datasets-usados-nos-testes).

Primeira execução real: `405f3260`, em 09/10/2026. O Clef venceu por 85,0 a 81,2, dentro da margem de erro, e a diferença saiu da distância real. Detalhes em `docs/o-que-foi-feito.md`.

## Datasets usados nos testes

A rodada 1 e as baterias escritas da Resiliência (robustez, saber dizer “não”, negação e injeção) não usam datasets externos: os casos e gabaritos são do autor. Os conjuntos públicos entram em duas baterias:

| Rodada      | Bateria                                                   | Dataset       | O que foi usado                                                           | Fonte                                                                             | Licença declarada                                    |
| ----------- | --------------------------------------------------------- | ------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 2 · Brava   | Português real                                            | ASSIN 2       | 20 pares de frases do teste, implicação ou não (10 + 10)                  | [nilc-nlp/assin2](https://huggingface.co/datasets/nilc-nlp/assin2)                | Não declarada pela fonte                             |
| 2 · Brava   | Português real                                            | HateBR        | 20 comentários do Instagram, ofensivos ou não (10 + 10)                   | [franciellevargas/HateBR](https://github.com/franciellevargas/HateBR)             | CC BY-NC 4.0, uso de pesquisa                        |
| 2 · Brava   | Português real                                            | B2W-Reviews01 | 20 avaliações de compra, recomendaria ou não (10 + 10), sem as estrelas   | [americanas-tech/b2w-reviews01](https://github.com/americanas-tech/b2w-reviews01) | CC BY-NC-SA 4.0, crédito à B2W Digital               |
| 3 · Imagens | Contagem, posição relativa, profundidade e distância real | CV-Bench      | 80 perguntas de múltipla escolha com foto, 20 por tarefa, do split `test` | [nyu-visionx/CV-Bench](https://huggingface.co/datasets/nyu-visionx/CV-Bench)      | Apache-2.0 nas anotações; fotos com termos de origem |

As 80 fotos do CV-Bench vêm de três conjuntos anteriores, que o CV-Bench reaproveita com as caixas coloridas desenhadas:

| Origem                                               | Fotos | Usadas em                     |
| ---------------------------------------------------- | ----- | ----------------------------- |
| COCO 2017, validação                                 | 22    | Contagem e posição relativa   |
| ADE20K, validação                                    | 18    | Contagem e posição relativa   |
| Omni3D (subconjuntos SUN RGB-D, Hypersim e nuScenes) | 40    | Profundidade e distância real |

Cada um desses conjuntos tem termos próprios, e alguns restringem uso comercial, como o nuScenes (CC BY-NC-SA 4.0). Por isso o repositório guarda só as perguntas e os gabaritos, e `npm run imagens` baixa as fotos localmente.

Todas as amostras foram sorteadas com semente fixa e ficam versionadas: `server/brava/portugues-ids.json` e `server/visual/cvbench-sample.json`. Os gabaritos são os rótulos humanos de cada dataset, sem correção do autor.

**Referências:**

- **ASSIN 2:** Real, L.; Fonseca, E.; Gonçalo Oliveira, H. (2020). _The ASSIN 2 Shared Task: A Quick Overview_. PROPOR 2020.
- **HateBR:** Vargas, F. et al. (2022). _HateBR: A Large Expert Annotated Corpus of Brazilian Instagram Comments for Offensive Language and Hate Speech Detection_. LREC 2022.
- **B2W-Reviews01:** Real, L.; Oshiro, M.; Mafra, A. (2019). _B2W-Reviews01: An Open Product Reviews Corpus_. STIL 2019. Dados de B2W Digital.
- **CV-Bench:** Tong, S. et al. (2024). _Cambrian-1: A Fully Open, Vision-Centric Exploration of Multimodal LLMs_. NeurIPS 2024.
- **COCO:** Lin, T.-Y. et al. (2014). _Microsoft COCO: Common Objects in Context_. ECCV 2014.
- **ADE20K:** Zhou, B. et al. (2017). _Scene Parsing through ADE20K Dataset_. CVPR 2017.
- **Omni3D:** Brazil, G. et al. (2023). _Omni3D: A Large Benchmark and Model for 3D Object Detection in the Wild_. CVPR 2023.

## Clef

O Clef roda no Cloudflare Workers AI e usa o mesmo contrato de perguntas do Jev (`state`, `noul`, `choice`, `score`). A diferença é o envelope `{ result, success, errors }` da Cloudflare, que o adaptador remove antes de validar. Configure no `.env`:

```dotenv
CLOUDFLARE_ACCOUNT_ID=   # 32 caracteres, visível na URL do painel
CLOUDFLARE_API_TOKEN=    # token com o modelo de permissão "Workers AI"
CLEF_MODEL=clef          # ou clef-flash
```

A cota gratuita de 10.000 neurons por dia cobre dezenas de reuniões. Quando ela acaba no plano gratuito, a chamada falha com a mensagem da Cloudflare, registrada como indisponibilidade. O idioma português não é declarado na documentação do Clef, e a latência medida inclui a rede até a borda da Cloudflare.

## Pontuação e justiça da comparação

| Tipo             | Um ponto                                                         | Outros resultados                                  |
| ---------------- | ---------------------------------------------------------------- | -------------------------------------------------- |
| Choice           | Alternativa igual ao gabarito                                    | Divergência: zero                                  |
| Predicate / Noul | Resposta verdadeira ≥0,8 ou falsa ≤0,2, de acordo com o gabarito | Entre 0,2 e 0,8: revisão; lado errado: divergência |
| Score            | Distância ≤0,4 do nível esperado                                 | Divergência: zero                                  |

Os limiares são uma decisão editorial fixa do experimento, não uma calibragem validada por fornecedor. Não interpretar diferenças de confiança como diferenças de precisão. Refusas, timeouts e erros de contrato são indisponibilidade, nunca acerto fabricado. Se todas as respostas forem equivalentes, empate é um resultado válido.

Revise os casos e gabaritos em `server/scenarios.ts` e `server/advanced-scenarios.ts` antes de publicar resultados. O hash distingue alterações do roteiro. Seis casos por cenário não sustentam conclusão estatística ampla, análise de calibração ou promessa de superioridade geral. Questões em português avaliam esse recorte, não capacidade em todos os idiomas.

## Cenários avançados

Os três cenários originais continuam iguais. O seletor também oferece três baterias de seis rodadas, com o mesmo número de chamadas por reunião:

| Cenário                                    | O que exige                                                                                                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Avançado · Lançamento sob pressão          | Distinguir uma alternativa teórica de uma utilizável pelo público afetado; respeitar o escopo de um piloto; reconciliar laudos incompatíveis.           |
| Avançado · Quem pediu o quê?               | Resolver referências em conversas, separar citação de intenção, aplicar condições e retratações, pedir esclarecimento e ignorar instruções em anexos.   |
| Estresse · Dossiê com versões conflitantes | Identificar a autoridade e o escopo de documentos, aplicar exceções, ignorar detalhes distratores e verificar consistência após reordenar alternativas. |

Foram acrescentados após uma primeira reunião real terminar em 6 × 6. Os casos e gabaritos novos foram escritos antes de consultar Jev ou Decisions; não foram selecionados porque algum fornecedor já errou. A dificuldade pretendida ainda precisa ser medida em execuções reais. Uma nova bateria também pode empatar; preserve e apresente esse resultado.

No dossiê, `d1` e `d6` usam os mesmos fatos, pergunta e alternativas, com a ordem das alternativas invertida. É um controle de consistência, não uma sexta situação independente. Há pares com mudança relevante: `a1/a2` alteram a disponibilidade efetiva da alternativa, `c3/c4` introduzem uma retratação e `d3/d4` substituem uma ressalva contratual. Não trate esses pares como observações estatisticamente independentes.

O dossiê explora estresse com indireção e detalhes distratores, condições que a [TypeSafe documenta como limitações do Jev](https://docs.typesafe.ai/model-jaggedness/jev-1.13). Isso delimita a interpretação do vídeo: compare separadamente os casos básicos, avançados e de estresse. Os prompts continuam alinhados às opções, com resposta verificável e o mesmo conteúdo para ambos os provedores, como recomenda o [guia de Decisions](https://developers.openai.com/api/docs/guides/decisions). Não há contas, comparação de datas ou exigência de gerar texto nas perguntas dos competidores.

O Opus recebe os pontos já calculados e apenas a regra do tipo de pergunta da rodada. Confiança e distribuições de alternativas foram retiradas da entrada do avaliador para reduzir comentários sobre diferenças sem efeito na decisão; elas continuam disponíveis no painel e nas evidências originais. `predicate` mantém seu valor de probabilidade, necessário à pontuação. O comentário do Opus continua sendo uma avaliação gerada e não substitui o gabarito.

## Consumo, tempos e falhas

- Rodada das imagens: 80 chamadas no Decisions e 80 no Clef, cada uma com uma foto, e 6 do CLI. Quantos tokens cada foto custa depende de cada API; o boletim mostra os tokens de entrada contados por elas.
- Resiliência: 298 chamadas por provedor (até `BRAVA_CONCURRENCY` simultâneas, padrão 3) e 7 do CLI. No Clef, cerca de 150 mil tokens de entrada (uns 3.300 neurons), dentro da cota gratuita diária.
- Até **6 chamadas Jev + 6 Decisions + 6 Clef + 8 CLI** por reunião real. CLI: 1 abertura + 6 comentários + 1 explicação. Na Maratona de reuniões: 36 por provedor e até 49 do CLI (6 × 8 + 1 leitura final). Sem retentativas automáticas do aplicativo.
- Referência de 08/10/2026: Jev US$ 0,042, Decisions US$ 0,10 e Clef US$ 0,24 (Clef-flash US$ 0,09) por milhão de tokens de entrada. No Clef, os 10.000 neurons diários gratuitos da Cloudflare não são descontados da estimativa. A estimativa considera texto padrão; adicionais regionais, outras faixas de preço e mudanças futuras não são detectados automaticamente. O arquivo exportado guarda as tarifas usadas.
- Os tempos das APIs incluem rede, leitura e validação; não são tempo puro de inferência. O tempo do Opus fica separado em cada registro de chamada.
- O custo mostrado usa tokens retornados pela API. Se o uso não estiver disponível, o custo fica desconhecido (`?`), inclusive em timeout ou falha de rede. Uma chamada falha pode ser cobrada.
- O valor técnico reportado pelo CLI é guardado separadamente; não representa necessariamente cobrança adicional no plano de assinatura. Chamadas com consumo desconhecido não podem ser tratadas como gratuitas.
- `CLAUDE_MAX_BUDGET_USD` limita cada chamada do CLI quando aplicável. `CLAUDE_TIMEOUT_MS` e `PROVIDER_TIMEOUT_MS` limitam espera local. Cancelar não desfaz consumo já iniciado.
- Se um comentário falhar, os resultados da rodada permanecem visíveis. Se o julgamento final falhar, o veredito é inconclusivo. Um reinício do backend encerra execuções pendentes como interrompidas, preserva evidências e evita repetir chamadas silenciosamente.

## Dados e estrutura

Cada item do **Histórico** resume o vencedor do Opus, o custo total estimado em USD de cada concorrente e o mais barato, com prêmios independentes. Os totais são calculados dos registros salvos. Se faltar consumo informado, o valor exibido é parcial e nenhum modelo recebe o selo de menor custo. Ensaios e reuniões não concluídas também não recebem esse selo.

Ao concluir a reunião, o painel abre um modal animado com o vencedor, os dois placares e a justificativa do Opus. **Ver resultado** reabre essa apresentação para a gravação, sempre voltando ao topo. A linha de contexto identifica execução real, ensaio e replay. Replays salvos não abrem o modal automaticamente. Empate, resultado inconclusivo e ensaio têm apresentações próprias.

Os comentários e julgamentos exibem **Jev**, **Decisions** e **Clef**, usando o mapeamento de cada avaliação cega, inclusive nas reuniões antigas. A exportação preserva o texto original anonimizado e seus mapeamentos; os nomes são revelados apenas na apresentação. O placar por gabarito continua separado do veredito do Opus.

`data/meetings.sqlite` guarda reuniões e snapshots dos eventos. `data/`, `.env` e artefatos de teste não entram no Git. A exportação contém dados dos cenários e respostas, portanto use material fictício quando for compartilhar o vídeo ou o JSON. As credenciais das APIs nunca são incluídas nos registros.

No **Histórico**, **Excluir** remove uma reunião finalizada e seus registros. **Limpar histórico** remove todas as reuniões finalizadas, inclusive as anteriores aos 100 itens exibidos, preservando reuniões em andamento. Ambas as ações pedem confirmação e são permanentes; exporte antes se quiser guardar uma cópia.

```text
src/                  painel React, CSS e cliente HTTP
shared/               contratos e regra de pontuação
server/scenarios.ts   roteiros, perguntas e gabaritos
server/advanced-scenarios.ts casos avançados e controle de consistência
server/providers.ts   adaptadores das APIs nativas
server/claude.ts      subprocesso isolado do Claude CLI
server/judging.ts     prompts e anonimização
server/engine.ts      coordenação e cancelamento
server/brava/         Resiliência: itens escritos, catálogo, datasets e execução
server/visual/        rodada das imagens: amostra do CV-Bench, tradução e catálogo
server/store.ts       SQLite e histórico de eventos
tests/                contratos, ciclo da reunião e navegador
```

## Validação

```sh
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
```

Os testes usam fixtures explícitas: verificam os contratos, preservação de uso em erro, isolamento do CLI, pontuação, julgamentos, cancelamento, exportação e replay. O teste de navegador usa um banco separado em `data/e2e` e a porta 4320. Não consome APIs pagas. Uma execução real completa ainda é necessária para qualificar autenticação, acesso aos modelos, qualidade em português e custo/latência efetivos.

## Fontes dos contratos

- [OpenAI Decisions](https://developers.openai.com/api/docs/guides/decisions) e [referência HTTP](https://developers.openai.com/api/reference/resources/decisions/methods/create).
- [Jev API](https://docs.typesafe.ai/api), [modelos e preços](https://docs.typesafe.ai/models), [limitações](https://docs.typesafe.ai/model-jaggedness/jev-1.13).
- [Clef no Workers AI](https://developers.cloudflare.com/workers-ai/models/clef/) (inclui o campo `images` no [schema de entrada](https://developers.cloudflare.com/workers-ai/models/clef/schema-input.json)), [preços do Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/) e [card do modelo](https://huggingface.co/Cloudflare/clef).
- [CV-Bench](https://huggingface.co/datasets/nyu-visionx/CV-Bench), usado na rodada das imagens.
- [Claude CLI não interativo](https://code.claude.com/docs/en/headless) e [flags](https://code.claude.com/docs/en/cli-reference).
