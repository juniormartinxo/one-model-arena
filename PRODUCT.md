# Mesa de decisão

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Proposta comunicada: React, Vite e TypeScript; Fastify; SSE; SQLite; CSS próprio e Lucide; Vitest e Playwright. Node 24 local. A implementação foi autorizada pelo usuário.

## Users

Criador brasileiro gravando um vídeo de YouTube; espectadores que precisam entender as decisões sem ler código.

## Product Purpose

Comparar Jev e OpenAI Decisions em reuniões em português, com Claude Opus 5.5 via CLI como moderador e avaliador.

## Operating Context

Aplicação local, duas colunas simétricas, execução real com custo baixo, histórico e replay para gravação. CLI usa a autenticação existente. APIs de decisão usam chaves apenas no backend.

## Capabilities and Constraints

Mesmos fatos, perguntas e critérios para ambos. Julgamento cego em sessões novas, com ordem invertida. Regras objetivas congeladas antes das respostas. Empates e falhas explícitos. Ensaio sintético nunca é evidência de qualidade. Sem alegação de vencedor universal.

## Evidence on Hand

Contratos oficiais de API consultados em 2026-10-08. Nenhum resultado de inferência real coletado no início da implementação.

## Product Principles

1. Tornar cada comparação auditável.
2. Separar decisão, comentário do Opus e consequência calculada.
3. Distinguir execução real, ensaio e replay.
4. Preservar respostas e erros sem retentativa invisível.

## Open Decisions

Hipótese de implementação: três cenários fictícios, seis rodadas cada, com avanço manual. Tema visual opcional consultado; foco em gravação desktop e leitura móvel.
