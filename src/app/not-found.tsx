import Link from "next/link";
export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-32 text-center">
      <p className="eyebrow">Not found</p>
      <h1 className="mt-4 font-display text-5xl">This branch hasn&apos;t grown yet.</h1>
      <p className="mt-4 text-ink-2">The page you&apos;re looking for isn&apos;t on the tree. Try the family lines or search for a name.</p>
      <div className="mt-8 flex justify-center gap-4"><Link href="/family" className="rounded-full bg-ink px-5 py-2.5 text-paper">Family lines</Link><Link href="/" className="link-underline self-center">Home</Link></div>
    </div>
  );
}
