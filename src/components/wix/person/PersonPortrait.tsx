import { clsx } from "clsx";
import { CmsImage } from "@/components/ui/CmsImage";
import type { SiteImage } from "@/lib/content/types";
import { initials } from "./parent-note";

interface Props {
  image?: SiteImage | null;
  name: string;
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
}

/** A `.wix-photo` portrait, or a neutral gray initials placeholder of the same size. */
export function PersonPortrait({ image, name, width, height, priority, className }: Props) {
  if (image?.url) {
    return (
      <CmsImage
        src={image}
        alt={image.alt || name}
        width={width}
        height={height}
        priority={priority}
        sizes={`${width}px`}
        className={clsx("wix-photo wix-person-photo", className)}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={name}
      className={clsx("wix-photo wix-person-photo wix-person-placeholder", className)}
      style={{ fontSize: Math.round(width * 0.3) }}
    >
      <span aria-hidden>{initials(name)}</span>
    </span>
  );
}
