(() => {
  'use strict';
  const original = '<!doctype html>' + document.documentElement.outerHTML;
  const chapters = [...document.querySelectorAll('[data-chapter]')];
  const links = [...document.querySelectorAll('[data-chapter-link]')];
  const previous = document.getElementById('previous-chapter');
  const next = document.getElementById('next-chapter');
  const chapterVideos = [...document.querySelectorAll('[data-chapter-video]')];
  const homeCanvas = document.querySelector('#inicio canvas');
  const motionToggle = document.querySelector('[data-home-motion]');
  let stopHomeAnimation;
  let current = 0;
  function updateHomeAnimation() {
    stopHomeAnimation?.();
    stopHomeAnimation = undefined;
    if (homeCanvas && chapters[current].id === 'inicio') {
      stopHomeAnimation = animateArenaSculpture(
        homeCanvas,
        motionToggle.getAttribute('aria-pressed') === 'true',
      );
    }
  }
  motionToggle?.addEventListener('click', () => {
    const paused = motionToggle.getAttribute('aria-pressed') !== 'true';
    motionToggle.setAttribute('aria-pressed', String(paused));
    motionToggle.setAttribute('aria-label', paused ? 'Retomar animação' : 'Pausar animação');
    motionToggle.querySelector('[data-motion-icon="play"]').hidden = !paused;
    motionToggle.querySelector('[data-motion-icon="pause"]').hidden = paused;
    updateHomeAnimation();
  });
  function showChapter(id, focus = true) {
    const index = chapters.findIndex((c) => c.id === id);
    current = index < 0 ? 0 : index;
    chapters.forEach((c, i) => {
      c.hidden = i !== current;
      c.classList.toggle('active', i === current);
    });
    updateHomeAnimation();
    chapterVideos.forEach((video) => {
      if (!chapters[current].contains(video)) {
        video.pause();
        return;
      }
      if (!video.hasAttribute('src')) {
        video.muted = true;
        video.src = location.protocol === 'file:' ? video.dataset.fileSrc : video.dataset.src;
        video.load();
      }
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        video.play().catch(() => {});
      }
    });
    links.forEach((a) => {
      if (a.hash === '#' + chapters[current].id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    previous.disabled = current === 0;
    next.disabled = current === chapters.length - 1;
    document.getElementById('chapter-position').textContent =
      `${current + 1} de ${chapters.length}`;
    document.title = `${chapters[current].querySelector('h1').textContent} · One Model Arena`;
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (focus) chapters[current].querySelector('h1').focus({ preventScroll: true });
  }
  links.forEach((a) =>
    a.addEventListener('click', (event) => {
      event.preventDefault();
      const id = a.hash.slice(1);
      history.pushState(null, '', '#' + id);
      showChapter(id);
    }),
  );
  function move(delta) {
    const target = chapters[current + delta];
    if (!target) return;
    history.pushState(null, '', '#' + target.id);
    showChapter(target.id);
  }
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  window.addEventListener('hashchange', () => showChapter(location.hash.slice(1)));
  window.addEventListener('popstate', () => showChapter(location.hash.slice(1)));
  document.addEventListener('keydown', (event) => {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.target.closest('input,select,textarea,video,[contenteditable="true"],[role="tablist"]')
    )
      return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      move(event.key === 'ArrowRight' ? 1 : -1);
    }
    if (event.key === 'Escape' && !document.fullscreenElement) presentation(false);
  });
  document.querySelectorAll('[role="tablist"]').forEach((list) => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const select = (tab, focus = false) =>
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.dataset.tabTarget).hidden = !on;
        if (on && focus) t.focus({ preventScroll: true });
      });
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (event) => {
        const target =
          event.key === 'ArrowRight'
            ? (index + 1) % tabs.length
            : event.key === 'ArrowLeft'
              ? (index - 1 + tabs.length) % tabs.length
              : event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? tabs.length - 1
                  : null;
        if (target !== null) {
          event.preventDefault();
          event.stopPropagation();
          select(tabs[target], true);
        }
      });
    });
  });
  document.querySelectorAll('[data-explorer]').forEach((explorer) => {
    const cases = [...explorer.querySelectorAll('[data-case]')];
    const search = explorer.querySelector('[data-search-input]');
    const filter = explorer.querySelector('[data-case-filter]');
    const more = explorer.querySelector('[data-more-cases]');
    let limit = 12;
    const normalize = (s) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('pt-BR');
    function render(reset = false) {
      if (reset) limit = 12;
      const query = normalize(search.value.trim());
      const matches = cases.filter(
        (c) =>
          (filter.value === 'all' || c.dataset.divergent === 'true') &&
          normalize(c.dataset.search).includes(query),
      );
      const visible = new Set(matches.slice(0, limit));
      cases.forEach((c) => {
        c.hidden = !visible.has(c);
      });
      explorer.querySelector('[data-case-count]').textContent =
        `${Math.min(limit, matches.length)} de ${matches.length} casos`;
      explorer.querySelector('[data-no-cases]').hidden = matches.length > 0;
      more.hidden = matches.length <= limit;
    }
    search.addEventListener('input', () => render(true));
    filter.addEventListener('change', () => render(true));
    more.addEventListener('click', () => {
      limit += 12;
      render();
    });
    render();
  });
  document.querySelectorAll('[data-choice-filter]').forEach((button) =>
    button.addEventListener('click', () => {
      const filter = button.dataset.choiceFilter;
      document.querySelectorAll('[data-choice-filter]').forEach((b) => {
        const active = b === button;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      document.querySelectorAll('[data-recommendation]').forEach((r) => {
        r.hidden = filter !== 'all' && r.dataset.recommendation !== filter;
      });
    }),
  );
  const volume = document.getElementById('cost-volume');
  volume.addEventListener('change', () => {
    document.querySelectorAll('[data-unit-cost]').forEach((el) => {
      el.textContent =
        'US$ ' +
        (Number(el.dataset.unitCost) * Number(volume.value)).toLocaleString('pt-BR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
    });
    document.getElementById('cost-caption').textContent =
      `Estimativa para ${Number(volume.value).toLocaleString('pt-BR')} decisões semelhantes · apenas API`;
  });
  const confidence = document.getElementById('brier-confidence');
  confidence.addEventListener('input', () => {
    const p = Number(confidence.value) / 100;
    const fmt = (x) =>
      x.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('brier-confidence-value').textContent = `${confidence.value}%`;
    document.getElementById('brier-formula').textContent =
      `(1 − ${fmt(p)})² + (0 − ${fmt(1 - p)})²`;
    document.getElementById('brier-result').textContent = (2 * (1 - p) ** 2).toLocaleString(
      'pt-BR',
      { maximumFractionDigits: 4 },
    );
    document.getElementById('brier-explanation').textContent =
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
  const present = document.getElementById('present');
  function presentation(on) {
    document.body.classList.toggle('is-presenting', on);
    present.setAttribute('aria-pressed', String(on));
    present.querySelector('span').textContent = on ? 'Sair da apresentação' : 'Apresentar';
  }
  present.addEventListener('click', async () => {
    if (document.body.classList.contains('is-presenting')) {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      presentation(false);
    } else {
      presentation(true);
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        document.getElementById('report-status').textContent =
          'Modo apresentação ativado. O navegador não permitiu tela cheia.';
      }
    }
  });
  document.addEventListener('fullscreenchange', () => presentation(!!document.fullscreenElement));
  function download(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  document
    .getElementById('download-html')
    .addEventListener('click', () =>
      download('one-model-arena-conclusao-2026-10-09.html', original, 'text/html;charset=utf-8'),
    );
  document
    .getElementById('download-data')
    .addEventListener('click', () =>
      download(
        'one-model-arena-conclusao-2026-10-09.json',
        document.getElementById('report-data').textContent,
        'application/json',
      ),
    );
  if (location.protocol === 'file:') document.getElementById('back-arena').hidden = true;
  showChapter(location.hash.slice(1), false);
})();
