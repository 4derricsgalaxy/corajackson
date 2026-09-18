import type { ReactNode } from "react";

export function SectionHeading({ eyebrow, title, intro, action }: { eyebrow?: string; title: ReactNode; intro?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h2 className="font-display text-4xl leading-[1.05] md:text-5xl">{title}</h2>
        {intro && <p className="mt-4 text-lg text-ink-2">{intro}</p>}
      </div>
      {action}
    </div>
  );
}
