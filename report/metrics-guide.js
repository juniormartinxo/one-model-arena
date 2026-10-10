(() => {
  'use strict';
  const guide = document.getElementById('brier-ece');
  if (!guide) return;
  const get = (id) => guide.querySelector(`#guide-${id}`);
  const confidence = get('brier-confidence');
  confidence.addEventListener('input', () => {
    const p = Number(confidence.value) / 100;
    const fmt = (value) =>
      value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    get('brier-confidence-value').textContent = `${confidence.value}%`;
    get('brier-formula').textContent = `(1 − ${fmt(p)})² + (0 − ${fmt(1 - p)})²`;
    get('brier-result').textContent = (2 * (1 - p) ** 2).toLocaleString('pt-BR', {
      maximumFractionDigits: 4,
    });
    get('brier-explanation').textContent =
      p === 1
        ? 'Certeza correta: erro zero.'
        : p === 0
          ? 'Certeza errada: o pior Brier possível, 2.'
          : p < 0.5
            ? 'Errar com convicção aumenta muito o erro das probabilidades.'
            : p === 0.5
              ? 'Dividir a probabilidade igualmente produz Brier 0,5.'
              : 'Acertar com convicção deixa o Brier perto de zero.';
  });
  guide.querySelectorAll('[data-metric-select]').forEach((select) => {
    select.addEventListener('change', () => {
      guide
        .querySelectorAll(`[data-metric-group="${select.dataset.metricSelect}"]`)
        .forEach((panel) => {
          panel.hidden = panel.dataset.metricValue !== select.value;
        });
    });
  });
  const eceHits = get('ece-hits');
  eceHits.addEventListener('input', () => {
    const accuracy = Number(eceHits.value) / 20;
    const fmt = (value) =>
      (value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%';
    get('ece-hits-value').textContent = `${eceHits.value} / 20`;
    get('ece-formula').textContent = `20% × |${fmt(accuracy)} − 75%|`;
    get('ece-result').textContent = fmt(0.2 * Math.abs(accuracy - 0.75));
    get('ece-explanation').textContent =
      accuracy === 0.75
        ? 'As duas faixas têm confiança igual ao acerto observado: ECE zero neste exemplo.'
        : `${accuracy < 0.75 ? 'Confiança acima do acerto' : 'Confiança abaixo do acerto'} nesse grupo: 75% de confiança para ${fmt(accuracy)} de acertos.`;
  });
})();
