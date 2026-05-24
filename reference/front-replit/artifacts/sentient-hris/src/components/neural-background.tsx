import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  pulsePhase: number;
  color: number; // 0-1 hue shift
}

interface Pulse {
  fromIdx: number;
  toIdx: number;
  progress: number; // 0-1
  speed: number;
}

export function NeuralBackground({ dark }: { dark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const darkRef = useRef(dark);
  const stateRef = useRef<{
    particles: Particle[];
    pulses: Pulse[];
    t: number;
  }>({ particles: [], pulses: [], t: 0 });

  useEffect(() => {
    darkRef.current = dark;
  }, [dark]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const PARTICLE_COUNT = 55;
    const MAX_DIST = 175;
    const MAX_PULSES = 12;

    function resize() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    function spawnParticles() {
      if (!canvas) return;
      const p: Particle[] = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        p.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          radius: Math.random() * 2.5 + 1.2,
          pulsePhase: Math.random() * Math.PI * 2,
          color: Math.random(),
        });
      }
      stateRef.current.particles = p;
    }

    resize();
    spawnParticles();

    const resizeObserver = new ResizeObserver(() => {
      resize();
    });
    resizeObserver.observe(canvas);

    function getNodeColor(p: Particle, alpha: number, isDark: boolean): string {
      // Alternate between electric blue, cyan, violet
      const hue = 210 + p.color * 60; // 210–270 (blue to violet)
      const sat = 90;
      const light = isDark ? 75 : 50;
      return `hsla(${hue},${sat}%,${light}%,${alpha})`;
    }

    function spawnPulse(particles: Particle[]) {
      const state = stateRef.current;
      if (state.pulses.length >= MAX_PULSES) return;
      const fromIdx = Math.floor(Math.random() * particles.length);
      let toIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < particles.length; i++) {
        if (i === fromIdx) continue;
        const dx = particles[fromIdx].x - particles[i].x;
        const dy = particles[fromIdx].y - particles[i].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < MAX_DIST && d < bestDist && Math.random() > 0.3) {
          bestDist = d;
          toIdx = i;
        }
      }
      if (toIdx >= 0) {
        state.pulses.push({ fromIdx, toIdx, progress: 0, speed: 0.008 + Math.random() * 0.012 });
      }
    }

    function draw() {
      if (!canvas || !ctx) return;
      const isDark = darkRef.current;
      const state = stateRef.current;
      state.t += 0.01;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Move particles
      for (const p of state.particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;
        if (p.y < -10) p.y = canvas.height + 10;
        if (p.y > canvas.height + 10) p.y = -10;
      }

      // Spawn pulses occasionally
      if (Math.random() < 0.04) spawnPulse(state.particles);

      // Draw connections
      for (let i = 0; i < state.particles.length; i++) {
        for (let j = i + 1; j < state.particles.length; j++) {
          const pi = state.particles[i];
          const pj = state.particles[j];
          const dx = pi.x - pj.x;
          const dy = pi.y - pj.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DIST) {
            const fade = 1 - dist / MAX_DIST;
            const alpha = isDark ? fade * 0.28 : fade * 0.15;
            const hue = 220 + ((pi.color + pj.color) / 2) * 50;
            ctx.beginPath();
            ctx.moveTo(pi.x, pi.y);
            ctx.lineTo(pj.x, pj.y);
            ctx.strokeStyle = `hsla(${hue},85%,${isDark ? 70 : 50}%,${alpha})`;
            ctx.lineWidth = 0.9;
            ctx.stroke();
          }
        }
      }

      // Draw data pulses
      state.pulses = state.pulses.filter((pulse) => {
        pulse.progress += pulse.speed;
        if (pulse.progress > 1) return false;

        const from = state.particles[pulse.fromIdx];
        const to = state.particles[pulse.toIdx];
        if (!from || !to) return false;

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > MAX_DIST) return false;

        const x = from.x + dx * pulse.progress;
        const y = from.y + dy * pulse.progress;

        // Pulse glow
        const grd = ctx.createRadialGradient(x, y, 0, x, y, 6);
        const alpha = Math.sin(pulse.progress * Math.PI) * (isDark ? 0.95 : 0.7);
        grd.addColorStop(0, `rgba(${isDark ? "147,210,255" : "59,130,246"},${alpha})`);
        grd.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Pulse core dot
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fillStyle = isDark
          ? `rgba(200,235,255,${alpha})`
          : `rgba(59,130,246,${alpha})`;
        ctx.fill();

        return true;
      });

      // Draw nodes
      for (const p of state.particles) {
        const pulse = 0.75 + 0.25 * Math.sin(state.t * 1.5 + p.pulsePhase);
        const r = p.radius * pulse;
        const baseAlpha = (isDark ? 0.75 : 0.55) * pulse;

        // Outer glow
        const glowR = r * 4.5;
        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
        grd.addColorStop(0, getNodeColor(p, baseAlpha * 0.55, isDark));
        grd.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Inner core
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = getNodeColor(p, baseAlpha, isDark);
        ctx.fill();

        // Bright center highlight
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? `rgba(255,255,255,${baseAlpha * 0.6})` : `rgba(255,255,255,${baseAlpha * 0.8})`;
        ctx.fill();
      }

      frameRef.current = requestAnimationFrame(draw);
    }

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameRef.current);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none"
    />
  );
}
