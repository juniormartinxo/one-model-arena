# Conclusão para a gravação

Abra o menu **Conclusão** no estúdio ou `http://127.0.0.1:4317/relatorio-conclusao.html` com `npm run dev`. Em produção local, a mesma rota é servida pela porta configurada no backend. Também é possível abrir `reports/relatorio-conclusao.html` diretamente no navegador, sem servidor.

## Conduzir o vídeo

- Os onze capítulos seguem Início, modelos, conclusão, reuniões, Resiliência, imagens, custo e tempo, escolha por situação, Como ler os números, Brier e ECE, e evidências. **Início** abre o relatório com o mesmo octógono animado do site público; o desenho e o movimento usam o mesmo código em `shared/arena-sculpture.ts`.
- Em cada reunião, o objetivo e as seis etapas aparecem antes do placar. A página **Os modelos** reúne logos, empresas, versões, entradas e informações de abertura, com fontes oficiais.
- O vídeo do octógono, acima das fichas dos modelos, só começa a carregar ao abrir **Os modelos**. Reproduz sem som e sem controles visíveis, e pausa ao sair do capítulo. Com redução de movimento ativada, fica pausado. A animação da abertura também respeita essa preferência e dispõe de um botão próprio de pausa.
- Clique no índice ou use ←/→. Dentro das abas, as setas trocam o cenário; nos campos, continuam controlando o campo. Não há avanço automático.
- **Apresentar** pede tela cheia e simplifica os controles. Escape sai. Se o navegador bloquear tela cheia, o modo de apresentação ainda funciona.
- Abra exemplos e comentários do Opus quando forem úteis à explicação. Os casos da Resiliência e das imagens começam filtrados para mostrar perguntas sem acerto unânime; o seletor permite acessar todas.
- O simulador de Brier usa uma pergunta ilustrativa de Sim/Não. A projeção de custo usa o consumo médio real de cada prova, para volumes selecionáveis. Nenhum dos dois altera os resultados medidos.
- **Baixar HTML** preserva uma cópia independente, com fontes, estilos, interações e dados. **Baixar os dados deste relatório**, no último capítulo, exporta os números e exemplos em JSON. As fotografias permanecem no dataset e na arena; o relatório traz suas perguntas, respostas e referências.

O vídeo é um arquivo separado para evitar baixá-lo antes de abrir o capítulo: `/videos/octogono.mp4` no estúdio. Ao abrir o HTML diretamente do disco, ele é procurado em `../public/videos/octogono.mp4`, relativo ao HTML. Para assistir fora do projeto, mantenha essa estrutura junto à cópia baixada; o texto e os resultados continuam disponíveis sem o vídeo.

A aba **Brier e ECE** aprofunda o conteúdo de **Como ler os números**, que permanece intacto: definições, fórmulas, tabelas, dois simuladores, contas reais por alternativa e por faixa, regras de desempate e limites de interpretação. Os cálculos vêm dos dados já incorporados; nenhum teste é reexecutado e o JSON original permanece igual.

## Edição escolhida

| Prova       | Execução                               | Cobertura                          |
| ----------- | -------------------------------------- | ---------------------------------- |
| Reuniões    | `82392021-dec6-41d0-8255-b9277a298445` | 6 reuniões, 36 decisões por modelo |
| Resiliência | `c8a27c72-7e70-4fc9-add4-cacf8a7d2b7a` | 298 itens por modelo, 5 baterias   |
| Imagens     | `99f248e6-456d-4291-aed2-4692c5f25ad2` | 80 fotos para Decisions e Clef     |

São 1.162 respostas nas três execuções reais completas, sem falhas de serviço e com consumo conhecido. A rodada de imagens é a primeira repetição completa sem falhas após os ajustes de envio e cota; as tentativas anteriores ficam identificadas na seção de evidências. Não se combinam as melhores respostas de execuções diferentes.

O placar é recalculado pelas mesmas funções dos boletins. As interpretações e recomendações foram escritas para esses IDs: trocar a edição exige conferir também as narrativas, as condições experimentais e os testes. As recomendações apontam candidatos para pilotos nas tarefas medidas; não são conclusões universais sobre os modelos. Os intervalos da Resiliência e das imagens incluem zero na comparação Clef–Decisions.

## Regenerar

O HTML atual contém ajustes manuais de apresentação, incluindo os ícones com giro de moeda. Para conferir uma nova geração, use primeiro outro destino com `--out reports/relatorio-conclusao-preview.html` e compare antes de substituir o arquivo do vídeo. As alterações desta rodada foram aplicadas em trechos do HTML existente, preservando o restante; também estão nos componentes quando aplicável.

```sh
npm run report:export -- --out reports/relatorio-conclusao-preview.html
# Outra origem ou destino, quando necessário:
npm run report:export -- --db /caminho/meetings.sqlite --out /caminho/conclusao.html
```

Os IDs estão em `report/edition.ts`. O comando abre o SQLite em modo somente leitura, valida a completude e grava o HTML de forma atômica. Não chama provedores nem o Opus; o texto do avaliador vem das gravações. Os fatos e contextos sensíveis do HateBR são omitidos e não entram no JSON exportado. Payloads brutos, chamadas do CLI e credenciais não fazem parte da exportação.

O arquivo gerado independe do banco depois de salvo. A data de preparação, revisão local e hash das regras identificam a geração do relatório; não certificam retroativamente o código exato de cada chamada. As tarifas são as registradas nas execuções, não uma consulta de preços atuais. Os valores excluem a avaliação do Opus, revisão humana, infraestrutura, mensalidade mínima e tentativas anteriores com falhas.

## Verificação

`tests/conclusion.test.ts` confere IDs, cobertura, números que sustentam as recomendações, dados sensíveis, rejeição de registros incompletos e a rota local. `tests/e2e/conclusion.spec.ts` verifica navegação, abas, filtros, simuladores, download offline, apresentação, movimento reduzido e largura dos onze capítulos em 390, 1.075, 1.878 e 1.920 px. Os testes de navegador devem usar o servidor de testes e seu banco separado, nunca apagar ou reconstruir o histórico real.

O relatório fica em `reports/`, fora de `public/` e `site/`. A geração não publica esta edição nem altera o fluxo documentado em [Publicação de resultados](publicacao.md).

As cores dos participantes seguem a referência do vídeo: Jev rosa, Decisions branco/prata, Clef laranja. Nomes, placares, barras e gráficos usam as mesmas identidades no relatório, no estúdio e no catálogo do site público. Avisos e revisão humana conservam o âmbar próprio; na impressão os tons dos modelos ficam mais escuros para manter a leitura em fundo claro.
