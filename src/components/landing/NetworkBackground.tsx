"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

type Node = { x: number; y: number; vx: number; vy: number };

/** Distance (CSS px) under which two nodes are connected by a faint line. */
const LINK_DISTANCE = 130;
/** Per-frame drift — deliberately very slow so the motion is calm, not distracting. */
const SPEED = 0.12;

/**
 * A subtle animated "network / constellation" background: drifting nodes joined
 * by faint lines when close. Rendered on a raw <canvas> (no dependency).
 *
 * Design notes:
 * - Palette only: light blue-gray points/lines on a dark navy field (no green).
 * - Not interactive, very slow. Honors `prefers-reduced-motion` (one static
 *   frame, no loop), pauses when the tab is hidden, and caps node count by area
 *   (fewer on phones) for performance.
 */
export function NetworkBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    let rafId = 0;
    let running = false;

    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    function seed() {
      let count = Math.round((width * height) / 16000);
      count = Math.max(18, Math.min(count, 70));
      if (width < 640) count = Math.min(count, 28); // lighter on phones
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: rand(-SPEED, SPEED),
        vy: rand(-SPEED, SPEED),
      }));
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      if (w === 0 || h === 0) return;
      // No real change (e.g. the ResizeObserver's initial fire) — don't reshuffle.
      if (w === width && h === height && nodes.length) return;
      canvas!.width = Math.round(w * dpr);
      canvas!.height = Math.round(h * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (nodes.length && width > 0 && height > 0) {
        // Scale existing nodes to the new size so they glide instead of jumping
        // (e.g. the mobile URL bar changing dvh mid-scroll).
        const sx = w / width;
        const sy = h / height;
        for (const n of nodes) {
          n.x *= sx;
          n.y *= sy;
        }
        width = w;
        height = h;
      } else {
        width = w;
        height = h;
        seed();
      }
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dist = Math.hypot(a.x - b.x, a.y - b.y);
          if (dist < LINK_DISTANCE) {
            ctx!.strokeStyle = `rgba(148, 163, 184, ${(1 - dist / LINK_DISTANCE) * 0.3})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }
      ctx!.fillStyle = "rgba(203, 213, 225, 0.85)";
      for (const n of nodes) {
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, 1.6, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function step() {
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0) n.x += width;
        else if (n.x > width) n.x -= width;
        if (n.y < 0) n.y += height;
        else if (n.y > height) n.y -= height;
      }
      draw();
      rafId = requestAnimationFrame(step);
    }

    function start() {
      if (running || reduceMotion || width === 0) return;
      running = true;
      rafId = requestAnimationFrame(step);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(rafId);
    }

    resize();
    if (reduceMotion) draw();
    else start();

    const ro = new ResizeObserver(() => {
      resize();
      // start() is a no-op if already running; this also kicks off the loop if
      // the canvas had zero size at mount and only got laid out now.
      if (reduceMotion) draw();
      else start();
    });
    ro.observe(canvas);

    function onVisibility() {
      if (document.hidden) stop();
      else start();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    />
  );
}
