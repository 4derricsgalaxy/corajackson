import Link from "next/link";
import { clsx } from "clsx";
import { CmsImage } from "../ui/CmsImage";
import type { TreeNode } from "@/lib/content/types";
import { descendantCount } from "@/lib/content/queries";

export function PersonCard({ person, color, size = "md", index = 0 }: { person: TreeNode; color?: string; size?: "sm" | "md" | "lg"; index?: number }) {
  const count = descendantCount(person);
  const years = person.birthDate || person.deathDate ? `${person.birthDate?.slice(0, 4) ?? ""}${person.deathDate ? ` – ${person.deathDate.slice(0, 4)}` : ""}` : null;
  return (
    <Link
      href={`/family/${person.slug}`}
      className={clsx("group block rise", size === "lg" && "md:col-span-2")}
      style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
    >
      <div className="frame overflow-hidden" style={{ aspectRatio: size === "sm" ? "4/5" : "3/4" }}>
        <CmsImage
          src={person.portrait}
          alt={person.title}
          width={size === "sm" ? 240 : 480}
          height={size === "sm" ? 300 : 640}
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
          className="h-full w-full object-cover transition duration-[900ms] ease-[cubic-bezier(.2,.7,.2,1)] group-hover:scale-[1.05] group-hover:saturate-[1.1]"
        />
        {color && <span className="absolute left-0 top-0 h-full w-1" style={{ background: color }} />}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className={clsx("font-display leading-tight", size === "sm" ? "text-lg" : "text-2xl")}>
            {person.nickname && person.nickname !== person.title ? person.nickname : person.title}
          </p>
          {person.nickname && person.nickname !== person.title && <p className="truncate text-sm text-ink-3">{person.title}</p>}
        </div>
        <div className="shrink-0 text-right font-mono text-[0.62rem] uppercase tracking-[0.18em] text-ink-3">
          {years && <div>{years}</div>}
          {count > 0 && <div>{count} desc.</div>}
        </div>
      </div>
      {person.shortBio && size !== "sm" && <p className="mt-2 line-clamp-2 text-sm text-ink-2">{person.shortBio}</p>}
    </Link>
  );
}
