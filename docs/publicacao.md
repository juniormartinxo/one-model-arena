# Publicar o One Model Arena

O repositório tem duas entradas independentes. O estúdio local (`src/`, `server/`) executa os testes. O site público (`site/`) apresenta metodologia, datasets e resultados agregados selecionados. O build público não importa o estúdio e não possui API, banco de dados, salas ou execução de modelos.

## Conferir o site

```sh
npm install
npm run dev:public
```

Abra http://127.0.0.1:4319. Para conferir o artefato de produção:

```sh
npm run build:public
npm run preview:public
```

Abra http://127.0.0.1:4321. O conteúdo inicial de `site/content/edition.json` indica que a edição está em preparação. Não há resultados fictícios nem aproveitamento automático do histórico.

## Antes das novas rodadas

Siga o [protocolo da nova bateria](protocolo-nova-bateria.md): preserve os registros anteriores, fixe a versão do código e das amostras e registre como as execuções serão selecionadas. O roteiro mantém resultados pendentes até a leitura dos novos boletins.

## Preparar uma edição depois das novas rodadas

1. Execute e conclua as provas reais no estúdio. Os nomes exibidos são **Maratona de reuniões**, **Resiliência** e **Imagens**; identificadores internos permanecem estáveis por compatibilidade com o histórico.
2. Abra os boletins e confira os resultados, as indisponibilidades e as anulações. Copie os IDs das execuções nos JSONs exportados pelo estúdio. Esses arquivos completos são locais: não os copie para `public/` ou `site/`.
3. Com as regras e o código revisados e commitados, selecione explicitamente as execuções:

```sh
npm run public:export -- \
  --edition primeira-edicao \
  --title "Primeira edição" \
  --series ID_DA_MARATONA \
  --brava ID_DA_RESILIENCIA \
  --visual ID_DAS_IMAGENS
```

É possível omitir provas ainda não concluídas. Cada edição aceita uma execução de cada tipo. `--db` permite escolher outro banco; o padrão é `data/meetings.sqlite`. `--out` permite preparar uma edição em outro arquivo para revisão. `--replace` é obrigatório para substituir uma edição já preparada no mesmo destino. `--help` mostra as opções.

O exportador abre o SQLite somente para leitura, aceita execuções reais concluídas e recalcula os boletins com as regras atuais. Não chama provedores nem o Opus. Não seleciona automaticamente a rodada mais recente. O build e o navegador validam o formato do JSON e rejeitam campos desconhecidos.

O arquivo público inclui apenas campos selecionados: métricas agregadas, baterias, modelos registrados, intervalos, anulações, IDs de amostras, IDs das execuções e hashes dos catálogos. Não inclui prompts, fatos dos cenários, respostas individuais, payloads, logs, comentários do Opus, textos dos datasets ou fotos.

`codeRevision` registra o commit do código usado na preparação; o sufixo `-dirty` identifica uma árvore com alterações locais. Para uma edição reproduzível, prepare-a com as regras já commitadas. `rulesHash` identifica o conteúdo de `shared/scoring.ts`, `shared/report.ts` e `shared/brava-report.ts`, nessa ordem, com nome e bytes de cada arquivo no SHA-256. Uma mudança de regra exige nova preparação e revisão dos números; comentários de rodadas antigas não são reutilizados como explicação pública.

4. Confira as três abas, detalhes, modelos, anulações, margens e download do JSON em `npm run dev:public`.
5. Rode as verificações e gere o build:

```sh
npm test
npm run build:public
npm run test:public
```

Se já estiver servindo o build em 4321, use `PUBLIC_PREVIEW_RUNNING=1 npm run test:public`. Essa opção testa o preview existente em vez de iniciar outro servidor.

6. Revise o diff de `site/content/edition.json` e inclua o arquivo no commit de publicação. O exportador não faz commit, push ou deploy.

## Vercel

Importe o repositório como projeto, com a raiz do repositório como **Root Directory**. O `vercel.json` define:

| Campo            | Valor                          |
| ---------------- | ------------------------------ |
| Framework        | Other (`framework: null`)      |
| Install command  | `npm ci`                       |
| Build command    | `npm run build:public`         |
| Output directory | `dist-public`                  |
| Node.js          | 24.x, compatível com `engines` |

Não configure chaves dos modelos, Claude CLI ou banco na Vercel. O site é estático; não precisa dessas dependências em execução. O build gera apenas HTML, CSS, JavaScript, fontes, marca e `data/edition.json`. Os cabeçalhos de segurança estão em `vercel.json`; não há rewrites para o backend local.

O `.vercelignore` exclui o material local no envio pelo CLI. Na integração Git, o repositório pode estar disponível durante o build, mas só `dist-public/` é servido. Por isso, a proteção principal é o build separado e a seleção explícita de conteúdo, não o arquivo de exclusões.

Confira primeiro um Preview Deployment: navegação, carregamento do JSON, responsividade, download e links das fontes. Depois publique a edição revisada em produção pelo fluxo do projeto. A integração Git pode gerar novos deploys a cada push; mantenha resultados em preparação até a edição estar pronta.

## Escopo das evidências

O site oferece rastreabilidade dos resultados agregados e das regras. Ele não publica um replay nem os registros completos das rodadas. O código e os manifests de amostras continuam referenciados no GitHub; datasets e suas condições de uso são vinculados às fontes. Sem edição publicada, o site explica os testes e apresenta um estado de preparação em vez de declarar vencedores.
