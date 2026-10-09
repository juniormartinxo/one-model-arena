// Ghost scrollbars: each bar stays transparent until the pointer reaches it.
// CSS hover covers the whole scroll area, so the pointer is located against the bar's own edge.
const reach = 16;
const scrolls = (overflow: string) => overflow === 'auto' || overflow === 'scroll';
function barAt(x: number, y: number, target: Element | null): Element | null {
  for (let el = target; el && el !== document.documentElement; el = el.parentElement) {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    const vertical = scrolls(style.overflowY) && el.scrollHeight > el.clientHeight;
    const horizontal = scrolls(style.overflowX) && el.scrollWidth > el.clientWidth;
    if (
      (vertical && x >= box.right - reach && x <= box.right) ||
      (horizontal && y >= box.bottom - reach && y <= box.bottom)
    )
      return el;
  }
  const root = document.documentElement;
  return root.scrollHeight > root.clientHeight && x >= root.clientWidth - reach ? root : null;
}
export function installGhostScrollbars() {
  let hot: Element | null = null,
    frame = 0;
  const show = (el: Element | null) => {
    if (el === hot) return;
    hot?.classList.remove('scrollbar-hot');
    el?.classList.add('scrollbar-hot');
    hot = el;
  };
  document.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse' || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        show(barAt(event.clientX, event.clientY, event.target as Element));
      });
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => show(null));
}
