'use client';

import React, { useEffect, useRef } from 'react';

type Ripple = {
  x: number;
  y: number;
  startTime: number;
  duration: number;
  startRadius: number;
  maxRadius: number;
  maxAlpha: number;
  lineWidth: number;
  hasGlow: boolean;
};

/**
 * Smooth HiDPI vector water ripple overlay rendered on HTML5 Canvas.
 * Completely idle when there is no pointer interaction, spawns sparse subtle
 * drops on mouse movement, and multi-ring water splashes on click/tap anywhere.
 */
export default function WaterBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const ripples: Ripple[] = [];
    let animId = 0;
    let isRunning = false;

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const render = (now: number) => {
      ctx.clearRect(0, 0, width, height);

      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        const elapsed = now - r.startTime;

        if (elapsed < 0) continue;
        if (elapsed >= r.duration) {
          ripples.splice(i, 1);
          continue;
        }

        const progress = elapsed / r.duration;
        const radius = r.startRadius + (r.maxRadius - r.startRadius) * easeOutCubic(progress);
        const fade = Math.pow(1 - progress, 1.8) * Math.min(1, progress * 10);
        const alpha = r.maxAlpha * fade;

        if (alpha <= 0.004) continue;

        // Soft liquid refraction band around the wave crest
        if (r.hasGlow && radius > 10) {
          const innerR = Math.max(0, radius - 14);
          const outerR = radius + 12;
          const grad = ctx.createRadialGradient(r.x, r.y, innerR, r.x, r.y, outerR);
          grad.addColorStop(0, 'rgba(56, 189, 248, 0)');
          grad.addColorStop(0.55, `rgba(56, 189, 248, ${(alpha * 0.22).toFixed(4)})`);
          grad.addColorStop(1, 'rgba(37, 99, 235, 0)');

          ctx.beginPath();
          ctx.arc(r.x, r.y, outerR, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Primary anti-aliased water wave ring
        ctx.save();
        ctx.beginPath();
        ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
        ctx.lineWidth = r.lineWidth * (1 - progress * 0.35);
        ctx.strokeStyle = `rgba(125, 211, 252, ${alpha.toFixed(4)})`;
        ctx.shadowColor = `rgba(56, 189, 248, ${(alpha * 0.65).toFixed(4)})`;
        ctx.shadowBlur = 10;
        ctx.stroke();

        // Subtle top-left specular light arc on the crest
        ctx.beginPath();
        ctx.arc(r.x, r.y, radius, -Math.PI * 0.85, -Math.PI * 0.15);
        ctx.lineWidth = Math.max(0.8, r.lineWidth * 0.65);
        ctx.strokeStyle = `rgba(224, 242, 254, ${(alpha * 0.75).toFixed(4)})`;
        ctx.shadowBlur = 4;
        ctx.stroke();
        ctx.restore();
      }

      if (ripples.length > 0) {
        animId = window.requestAnimationFrame(render);
      } else {
        isRunning = false;
      }
    };

    const startLoop = () => {
      if (!isRunning) {
        isRunning = true;
        animId = window.requestAnimationFrame(render);
      }
    };

    const spawnClickSplash = (x: number, y: number) => {
      const now = performance.now();
      ripples.push(
        {
          x,
          y,
          startTime: now,
          duration: 1400,
          startRadius: 4,
          maxRadius: 170,
          maxAlpha: 0.44,
          lineWidth: 2.2,
          hasGlow: true,
        },
        {
          x,
          y,
          startTime: now + 120,
          duration: 1200,
          startRadius: 4,
          maxRadius: 125,
          maxAlpha: 0.3,
          lineWidth: 1.6,
          hasGlow: true,
        },
        {
          x,
          y,
          startTime: now + 240,
          duration: 1000,
          startRadius: 3,
          maxRadius: 80,
          maxAlpha: 0.2,
          lineWidth: 1.2,
          hasGlow: false,
        }
      );
      if (ripples.length > 48) ripples.splice(0, ripples.length - 48);
      startLoop();
    };

    const spawnMoveDrop = (x: number, y: number) => {
      const now = performance.now();
      ripples.push({
        x,
        y,
        startTime: now,
        duration: 1050,
        startRadius: 3,
        maxRadius: 72,
        maxAlpha: 0.24,
        lineWidth: 1.3,
        hasGlow: true,
      });
      if (ripples.length > 48) ripples.splice(0, ripples.length - 48);
      startLoop();
    };

    let lastMoveTime = 0;
    let lastMoveX = -1000;
    let lastMoveY = -1000;

    const handlePointerDown = (e: PointerEvent) => {
      spawnClickSplash(e.clientX, e.clientY);
    };

    const handlePointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (lastMoveX < 0) {
        lastMoveX = e.clientX;
        lastMoveY = e.clientY;
        lastMoveTime = now;
        return;
      }
      const dx = e.clientX - lastMoveX;
      const dy = e.clientY - lastMoveY;
      if (now - lastMoveTime < 260 || dx * dx + dy * dy < 10000) return;
      lastMoveTime = now;
      lastMoveX = e.clientX;
      lastMoveY = e.clientY;
      spawnMoveDrop(e.clientX, e.clientY);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    return () => {
      window.cancelAnimationFrame(animId);
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
