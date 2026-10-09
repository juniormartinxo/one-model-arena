import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

type Point = [number, number, number];
const rotate = ([x, y, z]: Point, ax: number, ay: number, az: number): Point => {
  const y1 = y * Math.cos(ax) - z * Math.sin(ax),
    z1 = y * Math.sin(ax) + z * Math.cos(ax);
  const x2 = x * Math.cos(ay) + z1 * Math.sin(ay),
    z2 = -x * Math.sin(ay) + z1 * Math.cos(ay);
  return [x2 * Math.cos(az) - y1 * Math.sin(az), x2 * Math.sin(az) + y1 * Math.cos(az), z2];
};
const ring = (outer: number, inner: number, depth: number) => {
  const vertices = (radius: number, z: number) =>
    Array.from({ length: 8 }, (_, i): Point => {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      return [Math.cos(a) * radius, Math.sin(a) * radius, z];
    });
  const front = vertices(outer, depth),
    back = vertices(outer, -depth);
  const hole = vertices(inner, depth),
    holeBack = vertices(inner, -depth);
  return front.flatMap((_, i) => {
    const j = (i + 1) % 8;
    return [
      { points: [front[i], front[j], hole[j], hole[i]], front: true },
      { points: [back[j], back[i], holeBack[i], holeBack[j]], front: false },
      { points: [front[j], front[i], back[i], back[j]], front: false },
      { points: [hole[i], hole[j], holeBack[j], holeBack[i]], front: false },
    ];
  });
};
const faces = ring(1, 0.71, 0.1);

export function ArenaSculpture() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const el = canvas.current!;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0,
      visible = true,
      width = 0,
      height = 0,
      last = 0,
      clock = 0;
    let pointerX = 0,
      pointerY = 0,
      smoothX = 0,
      smoothY = 0;
    function draw(now: number) {
      frame = 0;
      if (!ctx) return;
      const moving = !paused && !reduced.matches && visible && !document.hidden;
      if (moving && last) clock += Math.min(now - last, 40) / 1000;
      last = now;
      smoothX += (pointerX - smoothX) * 0.045;
      smoothY += (pointerY - smoothY) * 0.045;
      ctx.clearRect(0, 0, width, height);
      const size = Math.min(width * 0.43, height * 0.41);
      const project = ([x, y, z]: Point) => {
        const perspective = 3.8 / (3.8 - z);
        return [width * 0.5 + x * size * perspective, height * 0.49 + y * size * perspective];
      };
      const ax = -0.24 + Math.sin(clock * 0.22) * 0.09 + smoothY * 0.09;
      const ay = -0.38 + Math.sin(clock * 0.18) * 0.22 + smoothX * 0.12;
      const az = -0.13 + Math.sin(clock * 0.13) * 0.06;
      // Perspective geometry, lit face by face. The graphic represents the arena, not results.
      const transformed = faces.map((face) => ({
        ...face,
        points: face.points.map((p) => rotate(p, ax, ay, az)),
      }));
      transformed.sort(
        (a, b) => a.points.reduce((s, p) => s + p[2], 0) - b.points.reduce((s, p) => s + p[2], 0),
      );
      ctx.save();
      const halo = ctx.createRadialGradient(
        width * 0.52,
        height * 0.53,
        size * 0.15,
        width * 0.52,
        height * 0.53,
        size * 1.45,
      );
      halo.addColorStop(0, 'rgba(72,174,151,0.065)');
      halo.addColorStop(1, 'rgba(72,174,151,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, width, height);
      for (const face of transformed) {
        const points = face.points.map(project);
        ctx.beginPath();
        points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.closePath();
        const depth = face.points.reduce((s, p) => s + p[2], 0) / 4;
        const light = Math.max(0, Math.min(1, (depth + 0.8) / 1.6));
        const gradient = ctx.createLinearGradient(
          points[0][0],
          points[0][1],
          points[2][0] + 1,
          points[2][1] + 1,
        );
        if (face.front) {
          gradient.addColorStop(
            0,
            `rgb(${28 + light * 29}, ${55 + light * 53}, ${49 + light * 46})`,
          );
          gradient.addColorStop(0.46, '#162c28');
          gradient.addColorStop(1, '#1d3b34');
        } else {
          gradient.addColorStop(0, '#0c1715');
          gradient.addColorStop(
            1,
            `rgb(${14 + light * 22}, ${30 + light * 50}, ${27 + light * 44})`,
          );
        }
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = face.front
          ? `rgba(148,238,208,${0.32 + light * 0.42})`
          : 'rgba(94,163,141,0.2)';
        ctx.lineWidth = face.front ? 1.1 : 0.7;
        ctx.stroke();
      }
      // A fine inset loop catches light independently of the solid outer ring.
      const loop = Array.from({ length: 8 }, (_, i): Point => {
        const a = Math.PI / 8 + (i * Math.PI) / 4;
        return rotate([Math.cos(a) * 0.61, Math.sin(a) * 0.61, -0.14], ax, ay, az);
      });
      ctx.beginPath();
      loop.map(project).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.strokeStyle = 'rgba(148,238,208,0.22)';
      ctx.lineWidth = 0.7;
      ctx.stroke();
      for (const i of [0, 3, 5]) {
        const [x, y] = project(loop[i]);
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#a2ead2';
        ctx.fill();
      }
      ctx.restore();
      if (moving) frame = requestAnimationFrame(draw);
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };
    const resize = () => {
      const bounds = el.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      const dpr = Math.min(devicePixelRatio, 2);
      el.width = width * dpr;
      el.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      schedule();
    };
    const pointer = (event: PointerEvent) => {
      if (reduced.matches || paused || event.pointerType === 'touch') return;
      const r = el.getBoundingClientRect();
      pointerX = (event.clientX - r.left) / r.width - 0.5;
      pointerY = (event.clientY - r.top) / r.height - 0.5;
    };
    const reset = () => {
      pointerX = 0;
      pointerY = 0;
    };
    const visibility = () => {
      last = 0;
      schedule();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      last = 0;
      schedule();
    });
    intersection.observe(el);
    reduced.addEventListener('change', schedule);
    document.addEventListener('visibilitychange', visibility);
    el.addEventListener('pointermove', pointer);
    el.addEventListener('pointerleave', reset);
    resize();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      reduced.removeEventListener('change', schedule);
      document.removeEventListener('visibilitychange', visibility);
      el.removeEventListener('pointermove', pointer);
      el.removeEventListener('pointerleave', reset);
    };
  }, [paused]);
  return (
    <div className="arena-art">
      <canvas ref={canvas} aria-hidden="true" />
      <div className="arena-art-center" aria-hidden="true">
        <span>ONE</span>
        <span>MODEL</span>
        <span>ARENA</span>
      </div>
      <div className="arena-art-caption">
        <span>O mesmo desafio. Diferentes decisões.</span>
        <button
          className="motion-toggle"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? 'Retomar animação' : 'Pausar animação'}
          aria-pressed={paused}
        >
          {paused ? <Play size={13} /> : <Pause size={13} />}
        </button>
      </div>
    </div>
  );
}
