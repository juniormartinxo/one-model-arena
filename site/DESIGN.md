---
name: One Model Arena — site público
description: Evidências em carvão e menta, com leitura editorial e geometria octagonal iluminada.
colors:
  bg: '#0b0f10'
  surface: '#111819'
  ink: '#e9eee9'
  muted: '#a3afac'
  accent: '#a4e8cd'
  line: '#2a3733'
  action-ink: '#102119'
  accent-hover: '#c4f3de'
  outline-border: '#475f55'
  outline-hover: '#192b23'
  method-surface: '#101716'
  example-surface: '#0d1412'
  example-border: '#395046'
  jev: '#f08fc0'
  decisions: '#e4e7ec'
  clef: '#ffa657'
typography:
  display:
    fontFamily: 'Manrope Variable, sans-serif'
    fontSize: 'clamp(70px, 6.5vw, 96px)'
    fontWeight: 550
    lineHeight: 1.02
    letterSpacing: '-0.04em'
  headline:
    fontFamily: 'Manrope Variable, sans-serif'
    fontSize: 'clamp(34px, 3.5vw, 49px)'
    fontWeight: 550
    lineHeight: 1.18
    letterSpacing: '-0.035em'
  title:
    fontFamily: 'Manrope Variable, sans-serif'
    fontSize: '28px'
    fontWeight: 550
    lineHeight: 1.35
    letterSpacing: '-0.025em'
  statement:
    fontFamily: 'Manrope Variable, sans-serif'
    fontSize: '25px'
    fontWeight: 450
    lineHeight: 1.45
    letterSpacing: '-0.025em'
  score:
    fontFamily: 'Manrope Variable, sans-serif'
    fontSize: '26px'
    fontWeight: 550
  body:
    fontFamily: 'DM Sans Variable, sans-serif'
    fontSize: '15px'
    lineHeight: 1.7
  navigation:
    fontFamily: 'DM Sans Variable, sans-serif'
    fontSize: '13px'
  button:
    fontFamily: 'DM Sans Variable, sans-serif'
    fontSize: '13px'
    fontWeight: 600
  label:
    fontFamily: 'DM Sans Variable, sans-serif'
    fontSize: '12px'
rounded:
  track: '2px'
  tag: '4px'
  control: '7px'
  panel: '14px'
  circle: '50%'
spacing:
  tight: '8px'
  compact: '12px'
  item: '16px'
  inset: '20px'
  block: '24px'
  group: '32px'
  heading: '48px'
  column: '72px'
components:
  button-primary:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.action-ink}'
    typography: '{typography.button}'
    rounded: '{rounded.control}'
    padding: '13px 22px'
  button-outline:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    typography: '{typography.button}'
    rounded: '{rounded.control}'
    padding: '13px 22px'
  button-motion:
    backgroundColor: '{colors.bg}'
    textColor: '{colors.muted}'
    rounded: '{rounded.circle}'
    width: '32px'
    height: '32px'
  navigation:
    textColor: '{colors.muted}'
    typography: '{typography.navigation}'
  battery-tag:
    backgroundColor: 'transparent'
    textColor: '#bdcec5'
    rounded: '{rounded.tag}'
    padding: '6px 10px'
  result-panel:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.panel}'
    padding: '28px 30px'
  method-example:
    backgroundColor: '{colors.example-surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.panel}'
    padding: '25px 30px'
  confidence-range:
    textColor: '{colors.accent}'
    height: '32px'
    width: '100%'
---

# Design System: One Model Arena — site público

## Overview

**Creative North Star: "Modelos sob escrutínio"**

Carvão esverdeado, luz de menta e títulos humanistas apresentam a Arena como uma publicação de evidências. A geometria octagonal da marca ganha volume na abertura; o restante da leitura usa divisórias finas, superfícies opacas e hierarquia tipográfica para organizar testes, método e fontes.

A expressão combina uma introdução ambiciosa com leitura calma. Menta orienta ações e estados selecionados, enquanto as identidades dos participantes preservam cores próprias e estruturas equivalentes. Exemplos didáticos, resultados pendentes e resultados publicados têm identificação escrita.

**Key Characteristics:**

- Carvão profundo e menta clara, com neutros esverdeados.
- Manrope nos títulos e DM Sans na leitura, ambas auto-hospedadas.
- Octógono projetado e iluminado em canvas como assinatura decorativa.
- Grandes intervalos entre seções e listas separadas por linhas finas.
- Interações locais com foco visível e alternativa de movimento reduzido.

Escopo: apenas a superfície pública em `site/`. Extraído de `style.css`, `App.tsx`, `components/`, `content/catalog.ts` e `main.tsx`. O `../DESIGN.md` continua descrevendo o estúdio local; este documento não o substitui.

## Colors

A paleta pública aprofunda o carvão do estúdio e concentra a orientação em menta.

### Primary

- **Menta iluminada** (`accent`): ênfase do título, ação primária, links, seleção, foco e controles de método.
- **Menta de aproximação** (`accent-hover`): hover da ação primária.
- **Verde de tinta** (`action-ink`): texto sobre a ação preenchida.

### Secondary

- **Água Jev** (`jev`), **âmbar Decisions** (`decisions`) e **lavanda Clef** (`clef`): identificam os participantes em monogramas, tabelas e gráficos. Não substituem a linguagem de resultados.

### Neutral

- **Carvão profundo** (`bg`): fundo contínuo e cabeçalho opaco.
- **Carvão de leitura** (`surface`): painel de resultados.
- **Branco vegetal** (`ink`) e **cinza sálvia** (`muted`): conteúdo principal e apoio.
- **Grafite verde** (`line`): separadores de listas, tabelas, abas e contornos.
- **Verdes de método** (`method-surface`, `example-surface`, `example-border`): faixa do método e documento didático.
- **Verdes de controle** (`outline-border`, `outline-hover`): ação contornada em repouso e hover.

**The Identity Rule.** A cor identifica o participante; texto e métricas identificam o resultado.

As rampas do sidecar são derivações para prévia dos tokens, não novas cores aplicadas ao site.

## Typography

**Display Font:** Manrope Variable, com fallback sans-serif. **Body Font:** DM Sans Variable, com fallback sans-serif. As fontes são importadas de `@fontsource-variable` em `main.tsx`. Código usa `ui-monospace, monospace`.

Manrope dá presença aos títulos com peso moderado, entreletra negativa e composição balanceada. DM Sans sustenta os parágrafos, metadados e controles. O frontmatter registra papéis observados, sem pressupor uma escala matemática.

- **Display:** título principal em duas linhas; a segunda recebe menta. Até 1150px usa 78px; até 800px usa `clamp(64px, 12vw, 84px)`.
- **Headline:** títulos de seção; até 800px usam 36px, e até 390px usam 33px.
- **Title:** descrição principal de cada teste, limitada a 23ch no desktop; no celular passa a 26px e 30ch.
- **Statement:** frase de abertura; usa 23px no celular e 28px em telas a partir de 1700px.
- **Body:** leitura principal dos testes; documentos auxiliares usam 13–14px e a abertura usa 16px. A descrição do hero limita-se a 43ch; descrições de testes a 55ch.
- **Score:** números publicados; tabela, confiança e Brier usam números tabulares.
- **Label / Navigation / Button:** apoio e ações de leitura. São textos funcionais, sem transformar metadados em títulos.

**The Readable Entrance Rule.** O título permanece legível desde o primeiro quadro; sua entrada desloca a posição sem ocultar o texto.

## Layout

O contêiner público usa `min(100% - 112px, 1440px)`; o cabeçalho pode alcançar 1600px. O cabeçalho fixo durante a rolagem tem 88px, com compensação de âncora de 110px. A abertura usa duas colunas iguais. Resultados dividem descrição e evidência em proporção 0,86:1,14; método, calibração e fontes abertas usam duas colunas.

A leitura alterna seções abertas, listas com linhas e poucos painéis contornados. Os intervalos verticais variam conforme a densidade: resultados usam 96px/108px, método 100px, datasets 112px. A distância recorrente entre colunas é a do token `column`.

Até 1150px, as margens laterais passam a 36px e as principais colunas reduzem o intervalo para 42px. Até 800px, as margens passam a 20px, o cabeçalho a 72px e as seções empilham. O menu se abre abaixo do cabeçalho; a arte usa 390px de altura. A lista de datasets reorganiza nome, categoria e expansão em duas colunas, retirando o ano da apresentação móvel. Tabelas preservam rolagem horizontal dentro de seu contêiner. Até 390px, abas e identidades ficam mais compactas. A partir de 1700px, a abertura cresce a 790px de altura mínima.

## Elevation & Depth

A interface de leitura não usa `box-shadow`: superfície, contorno e espaço separam os planos. O cabeçalho é opaco, sem blur. A escultura usa profundidade real de geometria projetada, gradientes de luz por face e halo radial discreto no canvas. O preenchimento do controle de confiança também usa gradiente; portanto, gradientes fazem parte deste sistema quando cumprem essas funções.

**The Sculptural Depth Rule.** A luz dá volume à assinatura octagonal; os componentes de leitura mantêm profundidade tonal e contornos simples.

## Shapes

Painéis usam o raio `panel`, ações usam `control` e etiquetas de baterias usam `tag`. Controles circulares aparecem em pausa, avanço e expansão. O octógono é a assinatura de marca, construído como aro com faces iluminadas e laço interno. Ícones de ação são SVGs de `lucide-react`; J, D e C são monogramas de identidade.

## Components

### Buttons

A ação primária combina menta e texto verde escuro; a alternativa usa contorno verde e fundo transparente. Ambas têm altura mínima de 48px e intervalo de 18px entre texto e ícone. Hover altera fundo/contorno em 0,2s; o ícone se desloca 2px na diagonal. Até 800px, a altura mínima é 46px, com padding de 12px 17px e texto de 12px.

O controle de movimento é circular, com borda fina, nome acessível e estado pressionado. Foco de botões, links, campos, resumos e elementos com tabindex usa contorno de 2px em menta, afastado 6px.

### Chips

Etiquetas de baterias são informativas, contornadas e compactas. Não têm estado de seleção nem simulam filtros.

### Cards / Containers

O painel de resultados reúne estado, participantes ou tabela com o mesmo tratamento contornado. Pendência e falha são mensagens explícitas; uma edição publicada introduz valores, métricas e detalhes. O documento didático usa superfície verde mais profunda e contorno próprio. O aviso de exemplo fica abaixo de cada título ilustrativo.

### Inputs / Fields

O controle de confiança é um range nativo, acompanhado de rótulo, percentual, extremos e saída de Brier. O trilho tem 4px, com preenchimento menta; o polegar é circular. A região do input tem 32px de altura, aceita teclado e recebe foco visível. A saída numérica de Brier usa anúncio educado. Não há formulário público de credenciais.

### Navigation

O cabeçalho combina marca, âncoras de seção e repositório. Links usam apoio neutro e passam a menta no hover. O menu móvel é controlado por botão com `aria-expanded`. Um link de salto aparece ao receber foco.

Abas dos testes usam três colunas, com linha inferior de 2px em menta para a selecionada. Maratona de reuniões, Resiliência e o teste de imagens mantêm o mesmo tratamento. As etapas do método usam seleção vertical, título menta e seta deslocada. Ambas as interfaces possuem semântica de abas e navegação por teclado.

Datasets, glossário e detalhes de evidência usam elementos nativos de expansão, com separadores. O resumo aberto ganha menta; a seta circular do dataset gira 180 graus.

### Octagonal sculpture and motion

A arte é um canvas decorativo com faces projetadas, aro interno e três pontos de luz. Não codifica resultados. Movimento lento e resposta suave ao ponteiro acrescentam volume; toque preserva a rolagem vertical. Pausa manual, preferência de movimento reduzido, saída da tela e aba oculta suspendem a animação contínua.

A entrada do hero dura 900ms com `cubic-bezier(0.16, 1, 0.3, 1)`, de `translateY(12px)` a zero, sem fade. Trocas de painéis usam 300ms, de opacidade 0,65 e deslocamento de 6px ao estado final. Movimento reduzido desativa animações, transições e rolagem suave, mantendo a composição estática.

## Do's and Don'ts

### Do:

- **Do** conservar a hierarquia de títulos humanistas, texto de apoio e números tabulares.
- **Do** manter foco menta, controles de teclado e alternativa estática da escultura.
- **Do** apresentar origem, pendência e exemplos didáticos por texto explícito.
- **Do** preservar equivalência de estrutura entre os participantes.

### Don't:

- **Don't** tratar a escultura ou a cor de uma marca como prova de desempenho.
- **Don't** ocultar o título durante a animação de entrada.
- **Don't** transferir tokens públicos para o estúdio local sem uma mudança de escopo autorizada.
