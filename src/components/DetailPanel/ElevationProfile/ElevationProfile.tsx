import { useEffect, useMemo, useRef } from 'preact/hooks';

import type { Coordinate } from '../../../types.ts';
import { CONFIG } from '../../../config.ts';
import { cumulativeDistances, niceStep } from '../../../logic/utils.ts';

import styles from './ElevationProfile.module.css';
import type { JSX } from 'preact';

interface Props {
  coords: Coordinate[];
}

const PAD_TOP = 20;
const PAD_BOTTOM = 24;
const PAD_LEFT = 44;
const PAD_RIGHT = 12;

export function ElevationProfile({ coords }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const derived = useMemo(() => {
    const dists = cumulativeDistances(coords);
    const totalDist = dists[dists.length - 1];
    const alts = coords.map((c) => c.alt ?? 0);
    const minAlt = Math.min(...alts);
    const maxAlt = Math.max(...alts);
    const altRange = maxAlt - minAlt || 1;

    const samples = Math.min(coords.length, CONFIG.ELEVATION_SAMPLES);
    const sampleDists: number[] = [];
    const sampleAlts: number[] = [];
    for (let i = 0; i < samples; i++) {
      const targetDist = (i / (samples - 1)) * totalDist;
      let lo = 0;
      let hi = dists.length - 1;
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (dists[mid] <= targetDist) lo = mid;
        else hi = mid;
      }
      const idx = targetDist - dists[lo] <= dists[hi] - targetDist ? lo : hi;
      sampleDists.push(dists[idx]);
      sampleAlts.push(alts[idx]);
    }

    let up = 0;
    let down = 0;
    for (let i = 1; i < alts.length; i++) {
      const d = alts[i] - alts[i - 1];
      if (d > 0) up += d;
      else down -= d;
    }

    return {
      totalDist,
      minAlt,
      maxAlt,
      altRange,
      samples,
      sampleDists,
      sampleAlts,
      up,
      down,
    };
  }, [coords]);

  const {
    totalDist,
    minAlt,
    maxAlt,
    altRange,
    samples,
    sampleDists,
    sampleAlts,
    up,
    down,
  } = derived;

  const H = CONFIG.ELEVATION_CANVAS_HEIGHT;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const W = Math.round(rect.width);
      if (W === 0) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.height = H + 'px';
      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);

      const plotW = W - PAD_LEFT - PAD_RIGHT;
      const plotH = H - PAD_TOP - PAD_BOTTOM;
      const x = (d: number) => PAD_LEFT + (d / totalDist) * plotW;
      const y = (a: number) =>
        PAD_TOP + plotH - ((a - minAlt) / altRange) * plotH;

      // Grid
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 0.5;
      const altStep = niceStep(altRange, 5);
      const startAlt = Math.ceil(minAlt / altStep) * altStep;
      ctx.font = '10px system-ui';
      ctx.fillStyle = '#9ca3af';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let a = startAlt; a <= maxAlt; a += altStep) {
        const py = y(a);
        ctx.beginPath();
        ctx.moveTo(PAD_LEFT, py);
        ctx.lineTo(W - PAD_RIGHT, py);
        ctx.stroke();
        ctx.fillText(Math.round(a) + ' m', PAD_LEFT - 6, py);
      }

      // Distance labels
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const distStep = niceStep(totalDist / 1000, 6);
      for (let d = 0; d <= totalDist / 1000; d += distStep) {
        const px = x(d * 1000);
        ctx.fillText(
          d.toFixed(distStep < 1 ? 1 : 0) + ' km',
          px,
          H - PAD_BOTTOM + 6,
        );
      }

      // Fill gradient
      const grad = ctx.createLinearGradient(0, PAD_TOP, 0, PAD_TOP + plotH);
      grad.addColorStop(0, 'rgba(74,108,247,0.3)');
      grad.addColorStop(1, 'rgba(74,108,247,0.02)');
      ctx.beginPath();
      ctx.moveTo(x(sampleDists[0]), PAD_TOP + plotH);
      for (let i = 0; i < samples; i++)
        ctx.lineTo(x(sampleDists[i]), y(sampleAlts[i]));
      ctx.lineTo(x(sampleDists[samples - 1]), PAD_TOP + plotH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Line
      ctx.beginPath();
      for (let i = 0; i < samples; i++) {
        const px = x(sampleDists[i]);
        const py = y(sampleAlts[i]);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = '#4a6cf7';
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.stroke();
    };

    draw();
    const obs = new ResizeObserver(() => draw());
    obs.observe(wrap);
    return () => obs.disconnect();
  }, [
    H,
    totalDist,
    minAlt,
    maxAlt,
    altRange,
    samples,
    sampleDists,
    sampleAlts,
  ]);

  const handleMove = (e: JSX.TargetedMouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const tooltip = tooltipRef.current;
    if (!canvas || !tooltip) return;

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const plotW = rect.width - PAD_LEFT - PAD_RIGHT;
    const ratio = (mx - PAD_LEFT) / plotW;
    if (ratio < 0 || ratio > 1) {
      tooltip.style.display = 'none';
      return;
    }

    const dist = ratio * totalDist;
    let idx = 0;
    for (let i = 1; i < sampleDists.length; i++) {
      if (Math.abs(sampleDists[i] - dist) < Math.abs(sampleDists[idx] - dist))
        idx = i;
    }
    const alt = sampleAlts[idx];
    const plotH = H - PAD_TOP - PAD_BOTTOM;
    const ty = PAD_TOP + plotH - ((alt - minAlt) / altRange) * plotH;

    tooltip.style.display = 'block';
    tooltip.style.left = mx + 'px';
    tooltip.style.top = ty + 'px';
    tooltip.textContent = `${(dist / 1000).toFixed(1)} km — ${Math.round(alt)} m`;
  };

  const handleLeave = () => {
    if (tooltipRef.current) tooltipRef.current.style.display = 'none';
  };

  return (
    <div class={styles.section}>
      <div class={styles.title}>Elevation Profile</div>
      <div ref={wrapRef} class={styles.wrap}>
        <canvas
          ref={canvasRef}
          height={H}
          style={{ cursor: 'crosshair' }}
          onMouseMove={handleMove}
          onMouseLeave={handleLeave}
        />
        <div ref={tooltipRef} class={styles.tooltip} />
      </div>
      <div class={styles.stats}>
        <div>
          Min: <span>{Math.round(minAlt)} m</span>
        </div>
        <div>
          Max: <span>{Math.round(maxAlt)} m</span>
        </div>
        <div>
          ↑ <span>{Math.round(up)} m</span>
        </div>
        <div>
          ↓ <span>{Math.round(down)} m</span>
        </div>
      </div>
    </div>
  );
}
