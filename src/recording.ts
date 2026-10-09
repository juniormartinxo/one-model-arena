import { useLayoutEffect, useState, type RefObject } from 'react';

// Recording mode takes the whole screen; leaving full screen (Esc) leaves recording too.
export function enterFullscreen() {
  if (!document.fullscreenElement)
    document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {});
}
export function exitFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

// Fit the live stage, never a finished report: long documents must retain their readable
// scale and scroll naturally instead of shrinking the entire recording.
export function useFitToScreen(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!enabled || !el) {
      setZoom(1);
      return;
    }
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (el.querySelector('.report-inline') || innerWidth <= 1020) {
        setZoom(1);
        return;
      }
      const bottom = el.getBoundingClientRect().bottom;
      setZoom((z) => {
        const fit = Math.min(1, Math.max(0.55, Math.floor((z * innerHeight * 100) / bottom) / 100));
        // Shrink at once; grow only with clear room, so the stage does not oscillate.
        return fit < z || (fit > z && bottom < innerHeight * 0.96) ? fit : z;
      });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(el);
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [ref, enabled]);
  return zoom;
}
