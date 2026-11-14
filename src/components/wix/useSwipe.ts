"use client";

import { useRef } from "react";

/**
 * A photo viewer that follows a finger: swipe left for the next photo, right for the previous one. A two-finger touch
 * (pinch zoom) is left alone, and the tap that ends a swipe doesn't also close the viewer.
 */
export function useSwipe(onPrev: () => void, onNext: () => void, enabled: boolean) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      start.current = enabled && e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (e.touches.length > 1) start.current = null;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      const s = start.current;
      start.current = null;
      const t = e.changedTouches[0];
      if (!s || !t) return;
      const dx = t.clientX - s.x, dy = t.clientY - s.y;
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      e.preventDefault(); // (no click after the swipe: it would close the viewer)
      if (dx < 0) onNext();
      else onPrev();
    },
  };
}
