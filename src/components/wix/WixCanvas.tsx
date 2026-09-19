import { clsx } from "clsx";

interface Props {
  children: React.ReactNode;
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
export function WixCanvas({ children, art, background, width, minHeight, className }: Props) {
  return (
    <div className={clsx("wix-canvas", className)} style={{ background, maxWidth: width, minHeight }}>
      {art && (
        // eslint-disable-next-line @next/next/no-img-element -- static decorative artwork
        <img src={art} alt="" aria-hidden className="wix-canvas-art" />
      )}
      {children}
    </div>
  );
}
