"use client";

import { useEffect, useRef } from "react";

/**
 * The Children column scrolls only when its list really is longer than the column (a big family). Otherwise it
 * clips nothing, so a photo or name moved out of it with the Design tool shows in full - a scrolling box would
 * cut off everything outside it. Measured from the list's own height (Design moves don't count), and never while
 * Design is open, so dragging is never cut off.
 */
export function ChildrenScroll() {
  const mark = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const col = mark.current?.closest<HTMLElement>(".wix-person-right");
    if (!col) return;
    const check = () => {
      const list = col.querySelector<HTMLElement>(".wix-person-children");
      const designing = document.documentElement.classList.contains("pd-editing");
      const tooLong = Boolean(list) && list!.offsetTop - col.offsetTop + list!.offsetHeight > col.clientHeight + 2;
      col.classList.toggle("wix-person-right-scroll", tooLong && !designing && window.innerWidth >= 980);
    };
    check();
    const sizes = new ResizeObserver(check);
    sizes.observe(col);
    const list = col.querySelector(".wix-person-children");
    if (list) sizes.observe(list);
    const design = new MutationObserver(check);
    design.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => {
      sizes.disconnect();
      design.disconnect();
    };
  }, []);
  return <span ref={mark} hidden />;
}
