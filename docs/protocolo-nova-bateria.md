# Protocolo para a nova bateria

Esta edição começa com resultados pendentes. O roteiro, a interface e as instruções do Opus foram revisados antes das novas respostas. As correções de linguagem não mudam os limiares, gabaritos, fórmulas ou amostras existentes.

## Antes de executar

1. Preserve fora de `data/` uma cópia consistente do SQLite e os JSONs completos das execuções anteriores. Confira a integridade do banco e guarde os IDs e hashes dos arquivos. O histórico de resultados em `o-que-foi-feito.md` se refere às execuções antigas; não o reutilize como resultado desta edição.
2. Registre o commit usado (`git rev-parse HEAD`) e confira `git status --short`. Registre qualquer alteração local relevante à execução. Não inclua chaves ou `.env` no registro público.
3. Confira os modelos e tarifas configurados em **Conexões** e nos registros da execução. Guarde versões efetivamente retornadas pelas APIs, sem atribuir resultados apenas a nomes comerciais.
4. Mantenha as amostras versionadas de `server/brava/portugues-ids.json` e `server/visual/cvbench-sample.json`. `npm run datasets` e `npm run imagens` preparam os arquivos locais; não use `--resample` nesta edição. Prepare as imagens com o script atual para aplicar o limite de 1600 px antes das chamadas.
5. Se decidir limpar o histórico, faça isso somente depois de conferir o arquivo preservado. A preparação do roteiro não limpa o banco nem inicia inferência real.

## Regras registradas antes das respostas

| Critério          | Regra atual                                                                                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Escolha           | Um ponto quando a alternativa coincide com o gabarito.                                                                                                                      |
| Sim/não           | Probabilidade de sim ≥0,8 para sim; ≤0,2 para não. Entre os limites, a arena marca revisão humana e atribui zero ponto.                                                     |
| Escala            | Um ponto quando a distância do nível esperado é ≤0,4.                                                                                                                       |
| Maratona          | Mais acertos; empate desempatado pelo menor Brier, com diferença mínima de 0,005.                                                                                           |
| Resiliência       | Média simples das cinco baterias; robustez e negação por grupo inteiro, demais por item.                                                                                    |
| Robustez          | Todas as versões devem acertar; evidência favorável não pode diminuir a probabilidade do gabarito em mais de 0,02. São 88 comparações de forma e 20 de evidência adicional. |
| Imagens           | Média simples das quatro baterias de 20 fotos, apenas Decisions e Clef.                                                                                                     |
| Empate nas notas  | Diferença menor que um ponto percentual, com desempate por Brier se a diferença for ≥0,005.                                                                                 |
| Indisponibilidade | Sem ponto; resultado inconclusivo se as respostas ausentes puderem mudar a liderança. Brier usa apenas itens respondidos por todos.                                         |
| Intervalos        | Bootstrap pareado, 1.000 reamostragens de grupos/itens dentro das baterias. Intervalo que inclui zero não sustenta superioridade entre aquele par.                          |
| Latência          | Inclui rede; medianas até 50 ms da menor são tratadas como equivalentes.                                                                                                    |
| Custo             | Estimativa por tokens de entrada e tarifas registradas; exclui Opus, infraestrutura, revisão humana e cotas gratuitas.                                                      |

As fontes executáveis são `shared/scoring.ts`, `shared/report.ts` e `shared/brava-report.ts`. O item antigo `inj-10` permanece anulado em seu registro; novas rodadas usam `inj-10b`. Não assumir que a nova Resiliência também terá 297 itens pontuados: conferir o boletim.

## Execução e seleção

Execute primeiro a **Maratona de reuniões**, depois **Resiliência** e **Rodada das imagens**, todas em modo real. Isso permite à Resiliência referenciar a maratona desta edição. Registre o ID de cada execução concluída e grave as telas enquanto as grades avançam.

Use a primeira execução real concluída de cada prova após a preparação. Não descarte uma execução por nota baixa, falha isolada de provedor ou vencedor indesejado. Cancelamentos e falhas que impeçam a conclusão devem ser registrados, com motivo para eventual substituição. Não misture execuções para montar um placar.

Não há controle de repetição idêntica neste protocolo; as variantes de robustez não medem, sozinhas, determinismo. Acrescentar repetições, mudar amostras, modelos ou regras exige registrar um novo protocolo antes dessas chamadas.

## Depois das execuções

1. Abra os três boletins e exporte os JSONs completos. Registre os IDs, datas, modelos e hashes na ficha da edição.
2. Confira itens executados, pontuados, anulados e indisponíveis. Revise exemplos contra perguntas e respostas salvas; preserve os resultados originais mesmo se corrigir uma explicação.
3. Não interprete a diferença entre acerto da maratona e nota média da Resiliência como evolução direta. Não atribua pedidos de ajuda ao modelo quando a revisão foi determinada pelo limiar da arena.
4. Compare o texto do Opus com os boletins recalculados. Uma correção posterior deve ser documentada; o comentário salvo não é regenerado automaticamente.
5. Prepare a edição pública selecionando explicitamente os três IDs, conforme [Publicação de resultados](publicacao.md). O site continua em preparação até essa seleção. Não publique o banco nem os JSONs completos.

Se houver correção de regra após uma execução, registre o motivo, a versão anterior, a nova versão e o impacto para todos os participantes. Não apresente um recálculo como se tivesse sido a regra aplicada originalmente.
