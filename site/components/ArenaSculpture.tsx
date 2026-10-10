import { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { animateArenaSculpture } from '../../shared/arena-sculpture';

export function ArenaSculpture() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => animateArenaSculpture(canvas.current!, paused), [paused]);
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
