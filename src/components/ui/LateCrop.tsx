"use client";

import { useEffect } from "react";
import { cleanCrop, cropStyle } from "@/lib/content/crop";

/**
 * Crops that the server could not draw. A crop is shown by zooming the <img> (lib/content/crop.ts), which needs the
 * picture's shape - and Snackbox has no size on record for some pictures (it answers width/height null, and drops a
 * size saved on the field). Those pictures are marked `data-crop-late`; once one has loaded, its real size is known
 * here and the crop is applied, fitted to the box it is shown in.
 */
export function LateCrop() {
  useEffect(() => {
    const apply = (img: HTMLImageElement) => {
      const saved = img.getAttribute("data-crop") ?? "";
      if (img.dataset.cropApplied === saved || !img.naturalWidth || !img.clientWidth || !img.clientHeight) return;
      let crop;
      try {
        crop = cleanCrop(JSON.parse(saved || "null"));
      } catch {
        return;
      }
      const style = cropStyle({ crop, width: img.naturalWidth, height: img.naturalHeight }, img.clientWidth / img.clientHeight);
      if (!style) return;
      Object.assign(img.style, style);
      img.dataset.cropApplied = saved;
    };
    const scan = () => {
      for (const img of document.querySelectorAll<HTMLImageElement>("img[data-crop-late]")) {
        if (img.complete) apply(img);
        else img.addEventListener("load", () => apply(img), { once: true });
      }
    };
    scan();
    // pages the site navigates to, pictures that appear later (a lightbox, the Children slots)
    const changes = new MutationObserver(scan);
    changes.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-crop", "src"] });
    return () => changes.disconnect();
  }, []);
  return null;
}
