"use client";

import { useEffect, type CSSProperties } from "react";
import { cropStyle } from "@/lib/content/crop";
import { designCss, type Added, type Design } from "@/lib/design/model";
import { designStore, useDesignState } from "./store";

/**
 * A page's saved design, drawn inside its canvas: the CSS for changed pieces, the background picture,
 * and the added things (behind the page's own pieces, or in front). While the Design tool edits the
 * page it draws the unsaved design instead, from the shared store.
 */
export function PageDesign({ path, baseW, design }: { path: string; baseW: number; design?: Design }) {
  const s = useDesignState();
  useEffect(() => designStore.init(path, baseW, design), [path, baseW, design]);
  const d = s.path === path ? s.design : design;
  if (!d) return <span hidden data-pd-empty="" />;

  const css = designCss(d);
  const back = d.added.filter((a) => a.layer === "back");
  const front = d.added.filter((a) => a.layer !== "back");
  const bg = d.page.image;
  const bgStyle: CSSProperties | undefined = bg
    ? {
        backgroundImage: `url("${bg}")`,
        backgroundSize: d.page.imageFit === "contain" ? "contain" : d.page.imageFit === "tile" ? "auto" : "cover",
        backgroundRepeat: d.page.imageFit === "tile" ? "repeat" : "no-repeat",
        backgroundPosition: "center top",
        opacity: (d.page.imageOpacity ?? 100) / 100,
      }
    : undefined;

  return (
    <>
      {css && <style data-pd-style="">{css}</style>}
      {(bg || back.length > 0) && (
        <div className="pd-layer pd-back" aria-hidden={!back.some((a) => a.kind === "text") || undefined}>
          {bgStyle && <div className="pd-page-img" style={bgStyle} />}
          {back.map((a) => <AddedView key={a.id} a={a} baseW={baseW} />)}
        </div>
      )}
      {front.length > 0 && (
        <div className="pd-layer pd-front">
          {front.map((a) => <AddedView key={a.id} a={a} baseW={baseW} />)}
        </div>
      )}
    </>
  );
}

const pct = (n: number, of: number) => `${Math.round((n / of) * 100000) / 1000}%`;

function AddedView({ a, baseW }: { a: Added; baseW: number }) {
  const box: CSSProperties = { left: pct(a.x, baseW), top: a.y, width: pct(a.w, baseW), height: a.h };
  let body: React.ReactNode = null;
  if (a.kind === "text") {
    body = <div className="pd-text-inner">{a.text ?? ""}</div>;
  } else if (a.kind === "image" && a.src) {
    const crop = a.crop && a.iw && a.ih ? cropStyle({ crop: a.crop, width: a.iw, height: a.ih }, a.w / a.h) : undefined;
    body = (
      // eslint-disable-next-line @next/next/no-img-element -- a picture placed with the Design tool
      <img
        src={a.src}
        srcSet={a.srcset || undefined}
        sizes={`${Math.round(a.w)}px`}
        alt={a.alt ?? ""}
        draggable={false}
        style={crop ?? { objectFit: a.fit ?? "cover" }}
        {...(a.crop ? { "data-crop": JSON.stringify(a.crop) } : {})}
      />
    );
  } else if (a.kind === "html" && a.html) {
    body = <div className="pd-html-inner" dangerouslySetInnerHTML={{ __html: a.html }} />;
  }
  const cls = `pd-add pd-add-${a.kind}`;
  return a.href ? (
    <a href={a.href} className={cls} style={box} data-pd-id={a.id} {...(/^https?:/.test(a.href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {body}
    </a>
  ) : (
    <div className={cls} style={box} data-pd-id={a.id}>
      {body}
    </div>
  );
}
