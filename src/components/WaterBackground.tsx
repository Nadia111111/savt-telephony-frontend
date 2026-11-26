'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Interactive 2D shallow-water ripple simulation rendered on a transparent canvas.
 * Reacts to pointer clicks/taps and cursor movement anywhere on the login page.
 */
export default function WaterBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const SCALE = 4;
    const DAMPING = 0.98;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let cols = Math.max(60, Math.floor(width / SCALE));
    let rows = Math.max(40, Math.floor(height / SCALE));

    let buf1 = new Float32Array(cols * rows);
    let buf2 = new Float32Array(cols * rows);

    const offscreen = document.createElement('canvas');
    const offCtx = offscreen.getContext('2d');
    let imgData: ImageData | null = null;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;

      cols = Math.max(60, Math.floor(width / SCALE));
      rows = Math.max(40, Math.floor(height / SCALE));

      buf1 = new Float32Array(cols * rows);
      buf2 = new Float32Array(cols * rows);

      offscreen.width = cols;
      offscreen.height = rows;
      imgData = offCtx ? offCtx.createImageData(cols, rows) : null;
    };

    const disturb = (clientX: number, clientY: number, radius: number, strength: number) => {
      const gx = Math.floor((clientX / Math.max(1, width)) * cols);
      const gy = Math.floor((clientY / Math.max(1, height)) * rows);
      const rSq = radius * radius;

      const minY = Math.max(1, gy - radius);
      const maxY = Math.min(rows - 2, gy + radius);
      const minX = Math.max(1, gx - radius);
      const maxX = Math.min(cols - 2, gx + radius);

      for (let y = minY; y <= maxY; y++) {
        const dy = y - gy;
        const rowOffset = y * cols;
        for (let x = minX; x <= maxX; x++) {
          const dx = x - gx;
          const distSq = dx * dx + dy * dy;
          if (distSq <= rSq) {
            const dist = Math.sqrt(distSq);
            const falloff = 0.5 + 0.5 * Math.cos((Math.PI * dist) / radius);
            buf1[rowOffset + x] -= strength * falloff;
          }
        }
      }
    };

    resize();
    window.addEventListener('resize', resize);

    // Subtle initial drops so water feels alive immediately
    disturb(width * 0.25, height * 0.35, 5, 210);
    disturb(width * 0.78, height * 0.65, 5, 190);

    let lastMoveTime = 0;
    const handlePointerDown = (e: PointerEvent) => {
      disturb(e.clientX, e.clientY, 6, 420);
    };

    const handlePointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastMoveTime < 28) return;
      lastMoveTime = now;
      disturb(e.clientX, e.clientY, 3, 110);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    const ambientInterval = window.setInterval(() => {
      const rx = width * (0.12 + Math.random() * 0.76);
      const ry = height * (0.12 + Math.random() * 0.76);
      disturb(rx, ry, 4, 175);
    }, 2400);

    let animId = 0;
    const step = () => {
      for (let y = 1; y < rows - 1; y++) {
        const row = y * cols;
        for (let x = 1; x < cols - 1; x++) {
          const i = row + x;
          const nextVal =
            ((buf1[i - 1] + buf1[i + 1] + buf1[i - cols] + buf1[i + cols]) * 0.5 - buf2[i]) *
            DAMPING;
          buf2[i] = Math.max(-600, Math.min(600, nextVal));
        }
      }

      if (offCtx && imgData) {
        const pixels = imgData.data;
        for (let y = 1; y < rows - 1; y++) {
          const row = y * cols;
          for (let x = 1; x < cols - 1; x++) {
            const i = row + x;
            const sx = buf2[i - 1] - buf2[i + 1];
            const sy = buf2[i - cols] - buf2[i + cols];
            const mag = Math.abs(sx) + Math.abs(sy);
            const p = i * 4;

            if (mag < 0.7) {
              pixels[p + 3] = 0;
              continue;
            }

            const slope = sx + sy;
            if (slope > 0) {
              const intensity = Math.min(1, slope / 160);
              pixels[p] = 155 + Math.round(100 * intensity);
              pixels[p + 1] = 212 + Math.round(43 * intensity);
              pixels[p + 2] = 255;
              pixels[p + 3] = Math.min(185, Math.round(mag * 1.45));
            } else {
              pixels[p] = 12;
              pixels[p + 1] = 58;
              pixels[p + 2] = 140;
              pixels[p + 3] = Math.min(115, Math.round(mag * 0.95));
            }
          }
        }

        offCtx.putImageData(imgData, 0, 0);
        ctx.clearRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(offscreen, 0, 0, width, height);
      }

      const tmp = buf1;
      buf1 = buf2;
      buf2 = tmp;

      animId = window.requestAnimationFrame(step);
    };

    animId = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(animId);
      window.clearInterval(ambientInterval);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1,
      }}
    />
  );
}
