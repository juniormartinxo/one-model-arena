---
name: Mesa de decisão
description: Estúdio escuro para comparar decisões com identidades equivalentes e evidências legíveis.
colors:
  bg: '#101214'
  surface: '#191c1f'
  surface-high: '#22262a'
  line: '#34393e'
  muted: '#a6adb3'
  ink: '#e9eae9'
  jev: '#83ded3'
  decisions: '#efc38d'
  clef: '#9db0ff'
  jev-mark: '#199e70'
  decisions-mark: '#c98500'
  clef-mark: '#3987e5'
  opus: '#c8b9e9'
  success: '#b1d9b0'
  danger: '#f1aaa3'
  control-border: '#50575e'
  opus-surface: '#1d1b22'
  opus-border: '#3d3749'
  opus-muted: '#b7acc9'
  opus-copy: '#d4ccdf'
  probability-track: '#343a3e'
typography:
  display:
    fontFamily: 'Manrope Variable, sans-serif'
    fontSize: '38px'
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: '-0.035em'
  headline:
    fontFamily: 'Manrope Variable, sans-serif'
    fontSize: '27px'
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: '-0.025em'
  title:
    fontFamily: 'Manrope Variable, sans-serif'
    fontSize: '21px'
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: '-0.025em'
  score:
    fontFamily: 'Manrope Variable, sans-serif'
    fontSize: '46px'
    fontWeight: 600
    lineHeight: 1
    letterSpacing: '-0.035em'
  answer:
    fontFamily: 'Manrope Variable, sans-serif'
    fontSize: '32px'
    letterSpacing: '-0.025em'
  body:
    fontFamily: 'DM Sans Variable, sans-serif'
    fontSize: '15px'
    lineHeight: 1.6
  label:
    fontFamily: 'DM Sans Variable, sans-serif'
    fontSize: '12px'
  button:
    fontFamily: 'DM Sans Variable, sans-serif'
    fontSize: '13px'
    fontWeight: 600
  code:
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace'
    fontSize: '13px'
rounded:
  track: '2px'
  replay: '3px'
  badge: '5px'
  field: '6px'
  control: '7px'
  symbol: '10px'
  panel: '14px'
spacing:
  tight: '6px'
  compact: '10px'
  item: '12px'
  inset: '18px'
  section: '20px'
  column: '22px'
  block: '24px'
  panel-inline: '25px'
components:
  button-primary:
    backgroundColor: '{colors.ink}'
    textColor: '{colors.bg}'
    typography: '{typography.button}'
    rounded: '{rounded.control}'
    padding: '10px 15px'
  button-secondary:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    typography: '{typography.button}'
    rounded: '{rounded.control}'
    padding: '10px 15px'
  button-quiet:
    backgroundColor: 'transparent'
    textColor: '{colors.muted}'
    typography: '{typography.button}'
    rounded: '{rounded.control}'
    padding: '10px 15px'
  button-icon:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    typography: '{typography.button}'
    rounded: '{rounded.control}'
    padding: '10px'
  button-text:
    backgroundColor: 'transparent'
    textColor: '{colors.jev}'
    padding: '0'
  scenario-select:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.field}'
    padding: '10px 34px 10px 12px'
  navigation:
    backgroundColor: 'transparent'
    textColor: '{colors.muted}'
    padding: '0 2px'
  replay-badge:
    backgroundColor: 'transparent'
    textColor: '{colors.opus}'
    rounded: '{rounded.replay}'
    padding: '2px 5px'
  competitor-panel:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.panel}'
  opus-panel:
    backgroundColor: '{colors.opus-surface}'
    textColor: '{colors.opus-copy}'
    rounded: '{rounded.panel}'
    padding: '20px 25px'
---

# Design System: Mesa de decisão

## Overview

**Creative North Star: "Estúdio carvão"**

O estúdio escuro mantém a comparação como conteúdo dominante. Superfícies opacas, linhas precisas e tipografia humanista apresentam Jev e Decisions com a mesma importância visual. A personalidade de competição vem da dupla de identidades e dos números grandes, sem imagem decorativa.

O comentário do Opus ocupa uma superfície própria, abaixo das decisões. A interface distingue a resposta do participante, a pontuação calculada e a avaliação editorial. Rótulos de sessão e mensagens de estado tornam visíveis a origem dos resultados e o andamento da reunião.

**Key Characteristics:**

- Carvão opaco, contornos discretos e contraste de texto claro.
- Duas identidades com a mesma estrutura, hierarquia e espaço.
- Verde-água para Jev, âmbar para Decisions e lilás para Opus.
- Números tabulares e tipografia auto-hospedada.
- Evidência sintética, execução real e replay identificados por texto.

Extração do código em `src/style.css`, `src/App.tsx`, `src/Competitor.tsx` e `src/main.tsx`, conferida nas capturas `.impeccable/review/desktop.png`, `mobile.png` e `recording.png`. Os tokens do frontmatter descrevem o sistema implementado; medidas responsivas e estados complementares aparecem abaixo. A composição específica da arena continua registrada em `.impeccable/surface-notes.md`.

## Colors

A paleta combina neutros frios com três acentos dessaturados, cada um associado a uma voz reconhecível.

### Primary

- **Verde-água Jev** (`jev`): identidade, escore, resposta e barras do Jev; também marca, navegação ativa e foco do teclado.

### Secondary

- **Âmbar Decisions** (`decisions`): identidade, escore, resposta e barras de Decisions. Também identifica ensaio sintético, revisão humana e conexão pendente, sempre acompanhado de texto.
- **Verde de aderência** (`success`): resposta aderente ao gabarito, rodada concluída, execução real e conexão detectada.
- **Coral de divergência** (`danger`): divergência, erro e indisponibilidade; o texto distingue esses estados.

### Tertiary

- **Lilás Opus** (`opus`): transições do moderador, ícone do avaliador e selo de replay.
- **Carvão violeta** (`opus-surface`, `opus-border`): superfície e contorno do comentário, separados dos dois participantes.
- **Lilás de leitura** (`opus-copy`, `opus-muted`): comentário e informações auxiliares do avaliador.

### Neutral

- **Carvão de fundo** (`bg`): plano contínuo da aplicação.
- **Carvão de painel** (`surface`): concorrentes, seletor de cenário, cabeçalhos de tabela e blocos de código.
- **Carvão elevado** (`surface-high`): controles selecionados e hover de botões secundários.
- **Linha grafite** (`line`, `control-border`, `probability-track`): divisórias, campos e trilhos das probabilidades.
- **Branco suave** (`ink`): títulos, conteúdo principal e preenchimento da ação primária.
- **Cinza de apoio** (`muted`): metadados, explicações secundárias e controles discretos.

**The Identity Rule.** A cor do participante identifica sua resposta; o acerto é informado separadamente por ícone e texto. Nenhuma das duas marcas recebe tratamento de vencedora antes do resultado.

**The Visible Origin Rule.** Ensaio sintético, execução real e replay preservam rótulos explícitos; a cor complementa a informação e não substitui a origem escrita.

As rampas tonais no sidecar servem à prévia do painel de design. São derivações dos tokens existentes, não novas cores aplicadas pela interface.

## Typography

**Display Font:** Manrope Variable, com fallback sans-serif. **Body Font:** DM Sans Variable, com fallback sans-serif. Ambas são importadas de `@fontsource-variable` em `src/main.tsx` e servidas no próprio build; não há solicitação de fonte a CDN externa. O código técnico usa a pilha monoespaçada do frontmatter.

A Manrope concentra títulos, nomes, respostas e escores. A DM Sans mantém perguntas auxiliares, probabilidades, comentários e controles legíveis. Títulos usam composição balanceada; as medidas do frontmatter não constituem uma escala matemática inventada.

- **Display:** título da arena e títulos de página; no celular passa a 29px.
- **Headline:** pergunta comum; passa a 30px em telas de pelo menos 1600px e no modo gravação, ou 23px até 680px.
- **Title:** nome do concorrente; passa a 17px até 680px.
- **Score:** escore acumulado; passa a 39px até 1020px e 38px até 680px.
- **Answer:** decisão exibida em destaque; passa a 24px até 680px.
- **Body:** fatos e texto de método, com entrelinha de 1,6; a prosa limita parágrafos a 75ch e os fatos a 100ch. Comentários do Opus usam 14px normalmente, 16px em telas largas, 17px na gravação e 13px no celular.
- **Label / Button:** metadados e ações compactas. Probabilidades, rodadas, escores e valores de métricas usam números tabulares.

**The Numeric Stability Rule.** Escores, percentuais, contagem de rodadas e métricas mantêm números tabulares para reduzir deslocamentos durante a comparação.

## Layout

O contêiner principal é centralizado, com largura máxima de 1320px e padding de 38px 42px 56px. A partir de 1600px, sua largura máxima é 1440px. O cabeçalho tem 86px de altura; bordas horizontais organizam navegação, sessão e listas.

Na arena, a pergunta precede a grade de participantes. A grade usa uma coluna `minmax(0, 1fr)` por participante (três nas reuniões novas, duas nos replays antigos), com intervalo de 22px, para conservar a equivalência entre os lados. O selo “VS” só aparece com dois participantes. O Clef usa `#9db0ff`. Barras de gráfico usam a trinca validada para daltonismo `#199e70` (Jev), `#c98500` (Decisions) e `#3987e5` (Clef); nomes e números continuam nos tons pastel. O comentário do Opus usa a largura conjunta e aparece após as respostas. Rodadas e ações ficam abaixo do comentário.

Até 1020px, as margens internas da página caem para 24px; os painéis usam 18px nas laterais, as ações iniciais passam a uma coluna e as métricas dos concorrentes a duas. Até 860px, a grade empilha os participantes numa coluna. Até 680px, a página usa laterais de 18px e o intervalo da grade cai para 12px; replays antigos continuam com duas colunas lado a lado. Até 600px, o placar final também empilha. Nome e placar se reorganizam dentro de cada painel; métricas passam a uma coluna. A sessão, navegação, veredito e controles quebram linha. A linha do tempo e os controles de replay ocupam linhas próprias, centralizadas.

O modo gravação amplia o contêiner a 1500px, usa 24px no topo e remove cabeçalho, rodapé, notas de medição e detalhes expansíveis de contexto e gabarito. Mantém a origem da sessão, o aviso do ensaio, os concorrentes, o comentário e os controles. A pergunta ganha padding vertical de 18px; respostas usam mínimo de 230px e padding vertical de 18px; painel do Opus e controles usam separação de 16px. Esses valores compactam espaços vazios enquanto fatos e comentário ganham tamanho. Conteúdo variável continua no fluxo da página; a interface não estabelece uma altura fixa de slide.

As páginas de método e conexões usam uma coluna de leitura de até 900px. Histórico e conexões usam listas com divisórias, sem repetir a composição de competição fora da arena.

## Elevation & Depth

A profundidade é tonal. Não há sombras, gradientes, transparência de vidro ou filtros de fundo no CSS atual. Os painéis se distinguem por superfície opaca e contorno de 1px; o painel do Opus acrescenta uma variação violeta. O pequeno marcador circular VS sobrepõe o intervalo entre os concorrentes sem mudar a largura de nenhum lado.

**The Tonal Depth Rule.** Separe planos com superfície e contorno; preserve o caráter opaco do estúdio ao estender os componentes existentes.

## Shapes

Painéis principais usam cantos de 14px. Controles usam 7px, o seletor 6px, selos e botões de rodada 5px e o selo de replay 3px. Trilhos de probabilidade têm 4px de altura e cantos de 2px. Os monogramas J e D ocupam quadrados contornados de 40px com cantos de 10px; no celular, 28px com cantos de 7px. Os pontos de estado e o marcador VS são circulares.

Os ícones de interface são SVGs de `lucide-react`, com traço contínuo e tamanhos ajustados ao contexto. Ações usam em geral 15–16px; a marca usa 24px e o comentário 21px. J e D são monogramas de identidade, não substitutos de ícones de ação. Não há rasters de produção.

## Components

### Buttons

Ações compactas e retangulares, com altura mínima de 42px, intervalo de 9px entre ícone e texto e peso 600.

- **Primário:** preenchimento `ink`, texto `bg`, borda do mesmo tom do preenchimento; hover branco.
- **Secundário:** fundo transparente e borda `control-border`; hover com `surface-high` e borda `#81898f`.
- **Discreto:** texto `muted` e borda transparente; hover com `surface` e texto `ink`.
- **Ícone:** padding de 10px e borda `line`; hover com `surface-high`. Controles de replay têm nome acessível.
- **Texto:** sem preenchimento ou padding, cor `jev` e sublinhado; usado para ligação contextual dentro de uma frase.

Botões desativados têm opacidade de 0,45 e cursor de indisponibilidade. Botões, links e seletores recebem outline de foco verde-água de 2px, afastado 5px. A transição de fundo e borda dura 0,16s, com easing `ease`.

### Inputs / Fields

O campo implementado é um seletor nativo de cenário, com rótulo visível, fundo `surface`, borda `control-border`, peso 500 e texto de 14px. Usa largura mínima de 300px em desktop e largura total, sem mínimo, no celular. O foco segue o tratamento dos controles. Não há campo de texto editável para credenciais na interface atual.

### Navigation

Arena, Histórico, Método e Conexões combinam ícone Lucide e nome. Itens inativos usam `muted`; hover e item ativo usam `ink`. Uma linha inferior de 2px em `jev` indica a seção ativa. No celular, a navegação ocupa uma linha própria com 44px de altura e distribui os quatro itens por toda a largura.

### Session labels and replay

**ENSAIO SINTÉTICO** usa âmbar e exibe o aviso de que respostas e comentários são simulados. Nesse estado, o avaliador se chama “Comentário de exemplo”, com a identificação “Roteiro local · sem IA”; a métrica de resposta mostra “Sintética” e o custo mostra “US$ 0”.

**EXECUÇÃO REAL** usa `success`. **REPLAY** é um selo lilás adicional: conserva a origem da reunião, podendo coexistir com ensaio ou execução real. Rótulos e cores informam o modo; reprodução não altera a origem do material gravado. O estado inicial usa `muted` e informa que a arena está pronta.

### Competitor panels

Os dois painéis derivam do mesmo componente. Jev fica à esquerda e Decisions à direita; ambos usam a mesma estrutura, dimensões, bordas e tipografia. Só a identidade e os dados mudam. Cabeçalho com padding de 22px 25px, resposta com 24px 25px e métricas com 15px 25px organizam três faixas separadas.

Cada resposta apresenta estado do gabarito, decisão, probabilidades e consequência. Barras usam a cor do participante sobre o mesmo trilho neutro, acompanhadas de valores escritos. Acerto, divergência, revisão humana e ausência de decisão têm textos e ícones próprios. Espera e falha ocupam a mesma área da resposta, preservando a composição comparável. Uma resposta indisponível não recebe apresentação de erro semântico.

### Opus panel

O comentário usa superfície violeta e o mesmo raio dos concorrentes, sem receber um terceiro placar. Cabeçalho, selo da rodada, comentário e nota sobre o gabarito formam uma sequência. O selo pode assumir a cor de Jev ou Decisions; empate e resultado inconclusivo continuam explícitos. Quando existe mapeamento A/B, ele aparece após o comentário.

O texto do comentário possui anúncio `aria-live="polite"`. Sua entrada usa revelação por recorte durante 0,4s, com `cubic-bezier(0.16, 1, 0.3, 1)`. Indicadores de trabalho giram em 1,2s com ritmo linear. `prefers-reduced-motion: reduce` desativa animações e transições.

### Round controls

A linha do tempo usa botões de 32px, com intervalo de 7px. O selecionado combina superfície elevada e contorno claro; rodadas concluídas usam verde de aderência. Ações de avanço e replay ficam ao lado no desktop e abaixo no celular. O conjunto mantém a leitura da rodada separada das ações de exportar ou iniciar uma nova reunião.

## Do's and Don'ts

### Do:

- **Do** manter os dois participantes com estrutura, escala e espaço equivalentes.
- **Do** combinar cor com nome, texto de estado e ícone quando houver resultado.
- **Do** conservar os rótulos de origem e o aviso de conteúdo sintético também na gravação e no replay.
- **Do** separar visualmente resposta, gabarito e comentário do Opus.
- **Do** usar as fontes auto-hospedadas, números tabulares e SVGs Lucide existentes.
- **Do** preservar foco visível e respeitar a preferência por movimento reduzido.

### Don't:

- **Don't** interpretar a cor do participante como confirmação de acerto.
- **Don't** apresentar ensaio como evidência de qualidade dos modelos ou replay como nova execução.
- **Don't** substituir a leitura equivalente dos concorrentes por um destaque unilateral de marca.
- **Don't** ocultar rótulos de origem para ganhar espaço na gravação.
