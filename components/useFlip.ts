"use client";
import { useLayoutEffect, useRef } from "react";

/** Animates cards to their new position after the tree changes, instead of letting them
 *  teleport. Standard FLIP: remember where every node was, and once React has laid the
 *  new tree out, play each one back from its old offset to zero.
 *
 *  Only the outermost element that actually moved is animated. A card and a subtask inside
 *  it both shift when the card moves, and animating both compounds the transforms, which
 *  reads as a slide inside a slide. */
export function useFlip(dep: number, selector: string, opts?: { duration?: number }) {
  const prev = useRef<Map<string, { x: number; y: number }>>(new Map());
  const first = useRef(true);

  useLayoutEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
    const next = new Map<string, { x: number; y: number }>();
    const moved: { el: HTMLElement; dx: number; dy: number }[] = [];

    for (const el of els) {
      const id = el.dataset.nodeId;
      if (!id) continue;
      const r = el.getBoundingClientRect();
      next.set(id, { x: r.left, y: r.top });
      const p = prev.current.get(id);
      if (!p) continue;
      const dx = p.x - r.left;
      const dy = p.y - r.top;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) moved.push({ el, dx, dy });
    }

    if (!first.current && moved.length && typeof Element !== "undefined") {
      const movedSet = new Set(moved.map((m) => m.el));
      for (const m of moved) {
        // Skip anything whose ancestor is also animating: the parent carries it.
        let p: HTMLElement | null = m.el.parentElement;
        let nested = false;
        while (p) {
          if (movedSet.has(p)) { nested = true; break; }
          p = p.parentElement;
        }
        if (nested) continue;
        if (typeof m.el.animate !== "function") continue;
        m.el.animate(
          [{ transform: `translate(${m.dx}px, ${m.dy}px)` }, { transform: "translate(0, 0)" }],
          { duration: opts?.duration ?? 240, easing: "cubic-bezier(.2,.7,.3,1)" },
        );
      }
    }

    prev.current = next;
    first.current = false;
  }, [dep, selector, opts?.duration]);
}
