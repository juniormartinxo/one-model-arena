import type { Option, Question, Round } from '../shared/types';
export const option = (value: string, label: string, description = label): Option => ({
  value,
  label,
  description,
});
export const choices = (
  id: string,
  text: string,
  options: Option[],
  expected: string,
  rationale: string,
  success: string,
  failure: string,
): Question => ({ id, type: 'choice', text, options, expected, rationale, success, failure });
export const predicate = (
  id: string,
  text: string,
  expected: boolean,
  rationale: string,
  success: string,
  failure: string,
): Question => ({ id, type: 'predicate', text, expected, rationale, success, failure });
export const severity = (
  id: string,
  text: string,
  expected: number,
  rationale: string,
): Question => ({
  id,
  type: 'score',
  text,
  expected,
  rationale,
  levels: [
    { label: 'Baixa', description: 'Incômodo cosmético, sem impedir tarefas.' },
    { label: 'Média', description: 'Tarefa prejudicada, mas existe alternativa funcional.' },
    { label: 'Alta', description: 'Tarefa essencial bloqueada, sem alternativa funcional.' },
  ],
  success: 'Prioridade compatível com o impacto; equipe alocada corretamente.',
  failure: 'Prioridade incompatível com o impacto; equipe alocada incorretamente.',
});
export const round = (id: string, title: string, facts: string, question: Question): Round => ({
  id,
  title,
  facts,
  question,
});
