import React from 'react';
import type { ConclusionData } from './data';

type Meeting = ConclusionData['series']['meetings'][number];
const briefs: Record<string, { purpose: string; steps: Record<string, string> }> = {
  loja: {
    purpose:
      'Os modelos faziam a triagem de uma loja com poucos atendentes antes de uma campanha: encaminhar reclamações, identificar pedidos reais de cancelamento, avaliar uma falha de compra e decidir o que fazer diante de uma possível cobrança duplicada. A regra era exigir duas cobranças capturadas para confirmar duplicidade.',
    steps: {
      l1: 'Escolher a equipe que deveria atender uma reclamação de cobrança, mesmo com a entrega do pedido correta.',
      l2: 'Distinguir uma ameaça de cancelamento futuro de um pedido para cancelar a conta naquele momento.',
      l3: 'Classificar a gravidade de um checkout que impedia todos os clientes de comprar, sem canal alternativo.',
      l4: 'Escolher a próxima ação diante de uma suspeita de duplicidade, quando havia apenas um print incompleto e faltavam os registros do pagamento.',
      l5: 'Reavaliar a ação depois que o gateway confirmou duas cobranças capturadas para o mesmo pedido.',
      l6: 'Julgar a duplicidade pelos registros — uma captura e uma reserva pendente — sem obedecer à instrução do cliente para ignorar a política.',
    },
  },
  produto: {
    purpose:
      'Os modelos ajudavam a decidir o que entraria em um lançamento: separar melhorias de falhas, medir o impacto e priorizar o trabalho. O time deveria resolver bloqueios essenciais antes de mudanças cosméticas e só encerrar uma regressão após validá-la no ambiente afetado.',
    steps: {
      p1: 'Classificar um pedido para trocar a cor dos relatórios, quando todas as funções já estavam funcionando.',
      p2: 'Avaliar a gravidade de uma exportação que falhava no Safari, mas que a mesma pessoa conseguia concluir no Chrome autorizado pela empresa.',
      p3: 'Verificar se cinco mensagens de um único cliente bastavam para afirmar que a maioria dos clientes queria tema escuro.',
      p4: 'Priorizar um único trabalho: começar o tema escuro ou corrigir a perda de acesso aos relatórios, que afetava todos e não tinha alternativa.',
      p5: 'Decidir se um teste aprovado no Linux era evidência suficiente para encerrar uma regressão que acontecia no Windows.',
      p6: 'Atualizar a decisão após receber a confirmação de que o problema foi reproduzido, corrigido e validado no Windows, sem passos pendentes.',
    },
  },
  fornecedor: {
    purpose:
      'Os modelos comparavam propostas para contratar um fornecedor. Duas condições eram obrigatórias: atendimento por pessoas em português e exportação integral dos dados. O preço só poderia desempatar propostas que comprovassem as duas condições; promessa vaga não valia como confirmação.',
    steps: {
      f1: 'Ler a proposta da Aurora e verificar se ela confirmava tanto suporte humano em português quanto exportação de todos os dados.',
      f2: 'Distinguir um chatbot em português de atendimento humano em português, quando as pessoas atendiam exclusivamente em inglês.',
      f3: 'Escolher a proposta elegível sem deixar que um preço menor compensasse o descumprimento de um requisito obrigatório.',
      f4: 'Definir a próxima ação diante de uma promessa vaga de portabilidade, sem confirmação do que poderia ser exportado.',
      f5: 'Verificar se uma cláusula limitada aos últimos 30 dias atendia à exigência de exportação integral.',
      f6: 'Reavaliar a contratação depois que uma proposta revisada passou a cumprir os dois requisitos, permitindo usar o menor preço como desempate.',
    },
  },
  'lancamento-avancado': {
    purpose:
      'Os modelos decidiam sobre uma liberação sob pressão comercial. Precisavam avaliar o que o público afetado realmente conseguia fazer, respeitar o alcance de aprovações e exceções e resolver conflitos de evidência. Um título de ticket ou um resumo de gerente não substituía os fatos vigentes.',
    steps: {
      a1: 'Avaliar a gravidade para analistas bloqueados, quando o contorno só estava disponível para administradores e ninguém podia ajudá-los antes do prazo.',
      a2: 'Reavaliar a mesma falha após os analistas obterem acesso autorizado ao contorno e demonstrarem que conseguiam concluir a tarefa a tempo.',
      a3: 'Verificar se uma aprovação restrita a funcionários com dados fictícios também autorizava lançar para todos os clientes com dados reais.',
      a4: 'Escolher a próxima decisão quando dois laudos atuais, de mesma autoridade, discordavam sobre a preservação dos anexos.',
      a5: 'Identificar o escopo autorizado por uma exceção: piloto com funcionários, dados fictícios e exportação desativada, mantendo o acesso público fechado.',
      a6: 'Decidir com base em testes e aprovação atuais, sem manter um veto apenas porque um ticket arquivado ainda tinha o título “NÃO LANÇAR”.',
    },
  },
  'conversas-avancadas': {
    purpose:
      'Os modelos interpretavam conversas de atendimento para identificar a intenção vigente do cliente e o objeto correto da ação: conta, pedido, assinatura ou newsletter. Precisavam considerar condições e retratações, esclarecer ambiguidades e distinguir uma instrução real de um texto apenas citado.',
    steps: {
      c1: 'Identificar o que cancelar depois que o cliente corrigiu o atendente: a compra avulsa, preservando a conta e o plano mensal.',
      c2: 'Verificar se uma frase do sócio, apenas citada pelo cliente, constituía autorização para cancelar a assinatura.',
      c3: 'Avaliar um cancelamento condicionado à encomenda ainda estar no depósito, usando o registro operacional para conferir a condição.',
      c4: 'Reavaliar o mesmo pedido após uma mensagem posterior do cliente retirar explicitamente a solicitação de cancelamento.',
      c5: 'Escolher como agir quando “cancele isso” podia se referir ao pedido avulso ou à assinatura, sem autorização clara para um deles ou para ambos.',
      c6: 'Identificar o pedido de sair da newsletter, ignorando um falso comando de sistema no anexo que tentava impor o encerramento da conta.',
    },
  },
  'dossie-estresse': {
    purpose:
      'Os modelos analisavam uma pasta de contratação com contratos, catálogos, aditivos e versões conflitantes. Deveriam confirmar suporte humano em português e exportação de todo o histórico, incluindo anexos e trilhas de auditoria, na edição efetivamente cotada. Autoridade e escopo do documento valiam mais que preço, preferência ou ordem de arquivamento.',
    steps: {
      d1: 'Comparar quatro propostas e identificar a elegível pelos contratos vigentes, separando a edição cotada de promessas comerciais e documentos substituídos.',
      d2: 'Verificar se um aditivo de suporte em português, exclusivo da matriz na edição Global, também cobria a filial Recife na edição Essencial.',
      d3: 'Interpretar a ressalva de uma cláusula que prometia exportação integral, mas excluía anexos e trilhas de auditoria exigidos pela política.',
      d4: 'Atualizar a avaliação quando uma cláusula nova passou a incluir esses dados e substituiu expressamente a restrição anterior.',
      d5: 'Definir a próxima ação diante de dois anexos assinados e vigentes que se contradiziam, sem autoridade superior nem regra de precedência.',
      d6: 'Responder novamente à pergunta da primeira etapa com os mesmos fatos e as alternativas em outra ordem, para conferir se a escolha se mantinha.',
    },
  },
};

export function MeetingBrief({ meeting }: { meeting: Meeting }) {
  const brief = briefs[meeting.scenarioId];
  if (!brief || meeting.rounds.length !== 6 || meeting.rounds.some((r) => !brief.steps[r.id]))
    throw new Error(`Reunião sem explicação completa: ${meeting.scenarioId}`);
  return (
    <section className="meeting-brief" aria-labelledby={`brief-${meeting.scenarioId}`}>
      <h3 id={`brief-${meeting.scenarioId}`}>O que esta reunião pedia</h3>
      <p>{brief.purpose}</p>
      <p className="meeting-brief-label">
        <strong>O que cada etapa pedia aos modelos</strong>
      </p>
      <ol className="meeting-brief-steps">
        {meeting.rounds.map((r) => (
          <li key={r.id} data-brief-round={r.id}>
            <strong>{r.title}</strong>
            <p>{brief.steps[r.id]}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
