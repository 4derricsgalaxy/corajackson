import { clsx } from "clsx";
import { PageDesign } from "@/components/design/PageDesign";
import { getDesign } from "@/lib/design/server";

interface Props {
  children: React.ReactNode;
  /** this page's address: its saved design (Design tool) is drawn on the canvas */
  path?: string;
  /** Decorative artwork stretched behind the page content, e.g. "/wix/leaves.png" */
  art?: string;
  /** Canvas background color; the original pages were white except the family tree */
  background?: string;
  /** Narrower canvas, as on the original family tree page (744px) */
  width?: number;
  minHeight?: number;
  className?: string;
}

/** The fixed-width white page the original Wix site was drawn on, centered on the gray surround. */
export async function WixCanvas({ children, path, art, background, width, minHeight, className }: Props) {
  const design = path ? await getDesign(path) : undefined;
  return (
    <div className={clsx("wix-canvas", className)} style={{ background, maxWidth: width, minHeight }} {...(path ? { "data-pd-path": path, "data-pd-base": width ?? 980 } : {})}>
      {art && (
        // eslint-disable-next-line @next/next/no-img-element -- static decorative artwork
        <img src={art} alt="" aria-hidden className="wix-canvas-art" data-pd="art" data-pd-label="Page artwork" />
      )}
      {path && <PageDesign path={path} baseW={width ?? 980} design={design} />}
      {children}
    </div>
  );
}
