# Mesa de decisão · Jev × Decisions × Clef

Estúdio local para gravar uma comparação em português entre Jev, OpenAI Decisions e Cloudflare Clef. O Claude Opus 5.5 participa pelo CLI: apresenta o roteiro, comenta cada rodada e julga o resultado sem ver as marcas.

## Rodar

Requer Node.js **24.14 ou superior**, npm e, para execução real, Claude Code recente compatível com `--safe-mode`, `--json-schema`, `--tools` e `--no-session-persistence`. A implementação foi desenvolvida com Claude Code 2.1.295. O SQLite embutido no Node pode emitir um aviso de API experimental.

```sh
npm install
npm run dev
```

Abra **http://127.0.0.1:4317**. O backend usa a porta 4318.

**Iniciar ensaio** percorre o fluxo completo com dados sintéticos locais. Não requer chaves e não chama nenhuma IA. Os resultados são identificados na tela, no histórico e na exportação. Eles não avaliam o desempenho de Jev, Decisions, Clef ou Opus.

Para uma execução real:

```sh
cp .env.example .env
# Edite .env localmente e preencha OPENAI_API_KEY, TYPESAFE_API_KEY,
# CLOUDFLARE_ACCOUNT_ID e CLOUDFLARE_API_TOKEN.
claude auth login
npm run dev
```

As duas chaves são necessárias para consultar as APIs de decisão reais. O Opus usa a autenticação já existente do seu CLI; nenhuma chave da Anthropic é solicitada pelo app. O servidor herda a modalidade de autenticação do CLI, inclusive configurações de ambiente existentes. Não coloque segredos em variáveis `VITE_*` nem no frontend. Reinicie o backend após editar `.env`.

Para usar o perfil `seu-executavel seu-perfil`, configure no `.env`:

```dotenv
CLAUDE_BIN=/caminho/para/seu-executavel
CLAUDE_ARGS='["seu-perfil"]'
```

`CLAUDE_ARGS` é uma lista JSON de argumentos, passada antes das opções do Claude sem executar um shell. A verificação de login e todas as chamadas usam o mesmo perfil. Para conferir sua assinatura nesse perfil, execute `seu-executavel seu-perfil auth status`.

O painel **Conexões** verifica instalação, login do Claude no perfil configurado e presença das chaves, sem chamadas de inferência. Reuniões reais não começam quando o login do CLI está ausente ou não pode ser verificado. Saldo, limites e acesso ao modelo são validados durante a execução real.

Produção local:

```sh
npm run build
npm start
```

Abra http://127.0.0.1:4318. Não há serviço externo de banco, autenticação web ou hospedagem. O servidor escuta somente na interface de loopback e restringe Host/Origin a localhost. Não exponha esta ferramenta com credenciais na internet.

## Como as coisas funcionam

1. Escolha um dos três cenários fictícios: crise na loja, prioridades de produto ou seleção de fornecedor. Cada um tem seis rodadas.
2. O servidor congela o cenário, calcula seu SHA-256 e salva o roteiro e o gabarito em SQLite. O Opus prepara a abertura e as transições, preservando perguntas e critérios.
3. Você avança manualmente. Os provedores recebem os mesmos fatos e perguntas, por suas APIs nativas, em paralelo. Não recebem gabaritos, respostas do concorrente ou comentários anteriores.
4. Cada resultado é persistido quando chega. O placar objetivo dá um ponto por aderência ao gabarito e registra separadamente divergência, incerteza e indisponibilidade.
5. Uma sessão nova do Opus comenta a rodada com nomes A/B/C aleatórios, sem marca, modelo, tempo ou custo. Sua opinião não altera os pontos objetivos. O mapeamento é revelado no painel após o comentário.
6. Após a sexta rodada, três sessões novas julgam a reunião com as posições rotacionadas: cada concorrente ocupa A, B e C uma vez. Qualquer discordância sobre o vencedor torna o resultado inconclusivo. Reuniões gravadas antes do Clef continuam com dois concorrentes e dois julgamentos invertidos. Falta de resposta utilizável também impede declarar vencedor global de qualidade.
7. O histórico permite replay sem inferência e exportação JSON com o cenário, payloads, respostas originais, prompts/saídas do CLI, eventos, métricas e os dois julgamentos.

O Opus não recebe ferramentas, MCPs ou histórico anterior; cada chamada usa uma pasta temporária e `--no-session-persistence`. A execução usa argumentos estruturados e stdin, sem shell. `--safe-mode` preserva a autenticação normal e desativa customizações; **não usamos `--bare`**, porque esse modo não reutiliza login por assinatura/OAuth. O modelo solicitado é explícito, sem fallback automático.

Os comentários são interpretações do Opus, não explicações produzidas pelos concorrentes. As consequências exibidas são regras fictícias da simulação, não resultados financeiros ou comerciais observados. A reunião usa avanço manual para permitir pausa e explicação durante a gravação. “Modo gravação” reduz o chrome da interface; Escape retorna ao modo normal. Ele não grava um arquivo de vídeo: use seu gravador de tela.

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

- Até **6 chamadas Jev + 6 Decisions + 6 Clef + 10 CLI** por reunião real. CLI: 1 abertura + 6 comentários + 3 julgamentos. Sem retentativas automáticas do aplicativo.
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
- [Clef no Workers AI](https://developers.cloudflare.com/workers-ai/models/clef/), [preços do Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/) e [card do modelo](https://huggingface.co/Cloudflare/clef).
- [Claude CLI não interativo](https://code.claude.com/docs/en/headless) e [flags](https://code.claude.com/docs/en/cli-reference).
