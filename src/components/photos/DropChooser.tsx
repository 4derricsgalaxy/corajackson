"use client";

import { useEffect, useState } from "react";
import { ROLES, pickPicture, send } from "@/components/wix/person/ChildSlots";

/**
 * Edit mode, on a person's page the editor may change: a photo dropped on the page (or picked with "Add photos")
 * is first asked about - a memory (-> the Memories strip, as before), a child's photo, or the other parent's photo -
 * and then saved there. Several photos are asked about one by one; "the same for the rest" sends the remaining
 * ones to Memories in one go. Dropping a photo straight onto a child, a parent's frame or an empty slot starts
 * with that answer picked.
 */

export interface DropChoices {
  /** the page, e.g. /family/lamont */
  path: string;
  /** this person's first name, for the questions */
  first: string;
  /** "Children on this page" blocks: one per other parent */
  blocks: { key: string; role: string; name: string; hasPhoto: boolean }[];
  /** the children in those blocks */
  kids: { id: string; name: string; block: string; hasPhoto: boolean }[];
}

/** what the drop landed on: a child's tile, an other parent's frame, or a block's empty child slot */
export type DropHint = { kid?: string; parent?: string; newKidIn?: string };

type Step = "what" | "child" | "new-child" | "parent" | "new-parent";

const blockLabel = (b: DropChoices["blocks"][number]) => (b.name ? `${b.role ? `${b.role}: ` : ""}${b.name}` : b.role || "Other parent (no name yet)");

export function DropChooser({ choices, files, hint, onMemory, onDone }: {
  choices: DropChoices;
  files: File[];
  hint?: DropHint;
  /** photos that are memories: added to the Memories strip by PhotoDrop */
  onMemory: (files: File[]) => void;
  /** every photo answered; `changed`: something was saved here (the page re-reads Snackbox) */
  onDone: (changed: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  const [changed, setChanged] = useState(false);
  const [step, setStep] = useState<Step>(() => (hint?.kid ? "child" : hint?.parent ? "parent" : hint?.newKidIn ? "new-child" : "what"));
  const [sameForRest, setSameForRest] = useState(true);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [block, setBlock] = useState(hint?.newKidIn ?? choices.blocks[0]?.key ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const file = files[index];
  const left = files.length - index - 1;

  // a quick look at the photo being asked about (an iPhone HEIC photo may not show in this browser)
  const [preview, setPreview] = useState<{ file?: File; src: string }>({ src: "" });
  useEffect(() => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview({ file, src: typeof reader.result === "string" ? reader.result : "" });
    reader.readAsDataURL(file);
    return () => reader.abort();
  }, [file]);
  const src = preview.file === file ? preview.src : "";

  const next = (savedHere: boolean) => {
    const anyChange = changed || savedHere;
    setChanged(anyChange);
    setError("");
    setName("");
    setRole("");
    setStep("what");
    if (index + 1 >= files.length) onDone(anyChange);
    else setIndex(index + 1);
  };

  const memory = () => {
    if (sameForRest && left > 0) {
      onMemory(files.slice(index));
      onDone(changed);
      return;
    }
    onMemory([file]);
    next(false);
  };

  /** turns the photo upright, then saves it where it was said to go */
  const save = async (op: string, fields: Record<string, string>, photoField: string, verb: string) => {
    setBusy(true);
    setError("");
    try {
      const p = await pickPicture(file);
      if (p.preview) URL.revokeObjectURL(p.preview);
      await send(choices.path, op, { ...fields, [photoField]: p.blob }, verb);
      next(true);
    } catch (err) {
      setError((err as Error).message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const kids = hint?.kid ? [...choices.kids].sort((a, b) => Number(b.id === hint.kid) - Number(a.id === hint.kid)) : choices.kids;
  const blocks = hint?.parent ? [...choices.blocks].sort((a, b) => Number(b.key === hint.parent) - Number(a.key === hint.parent)) : choices.blocks;

  return (
    <div className="pd-ui drop-ask-backdrop" role="dialog" aria-modal="true" aria-label="Where does this photo go?">
      <div className="drop-ask">
        <div className="drop-ask-head">
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the dropped photo */}
          {src ? <img src={src} alt="" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} /> : <span className="drop-ask-thumb" aria-hidden />}
          <span>
            <strong>{files.length > 1 ? `Photo ${index + 1} of ${files.length}` : "New photo"}</strong>
            <small title={file?.name}>{file?.name}</small>
          </span>
        </div>

        {step === "what" && (
          <>
            <p className="drop-ask-q">What is this photo?</p>
            <div className="drop-ask-list">
              <button type="button" className="pd-primary" onClick={memory} disabled={busy}>
                A memory <small>→ {choices.first}&apos;s Memories strip</small>
              </button>
              {left > 0 && (
                <label className="drop-ask-check">
                  <input type="checkbox" checked={sameForRest} onChange={(e) => setSameForRest(e.target.checked)} /> The other {left} photo{left > 1 ? "s are" : " is"} memories too
                </label>
              )}
              <button type="button" onClick={() => setStep(choices.kids.length ? "child" : "new-child")} disabled={busy}>
                A child&apos;s photo <small>→ their picture under Children</small>
              </button>
              <button type="button" onClick={() => setStep(choices.blocks.length ? "parent" : "new-parent")} disabled={busy}>
                The other parent&apos;s photo <small>→ the small framed photo beside their children</small>
              </button>
            </div>
          </>
        )}

        {step === "child" && (
          <>
            <p className="drop-ask-q">Which child?</p>
            <div className="drop-ask-list">
              {kids.map((k) => (
                <button key={k.id} type="button" className={k.id === hint?.kid ? "pd-primary" : undefined} disabled={busy}
                  onClick={() => void save("child-photo", { child: k.id }, "file", "save this photo")}>
                  {k.name} {k.hasPhoto && <small>(replaces the photo here)</small>}
                </button>
              ))}
              <button type="button" onClick={() => setStep("new-child")} disabled={busy}>+ A child who isn&apos;t on the page yet</button>
            </div>
          </>
        )}

        {step === "new-child" && (
          <>
            <p className="drop-ask-q">A new child of {choices.first}</p>
            <div className="drop-ask-list">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Child's full name" aria-label="Child's full name" maxLength={120} autoFocus disabled={busy} />
              {choices.blocks.length > 1 && (
                <select value={block} onChange={(e) => setBlock(e.target.value)} aria-label="Their other parent" disabled={busy}>
                  {choices.blocks.map((b) => <option key={b.key} value={b.key}>{blockLabel(b)}</option>)}
                </select>
              )}
              <button type="button" className="pd-primary" disabled={busy || !name.trim()}
                onClick={() => void (choices.blocks.length
                  ? save("child-add", { block: block || choices.blocks[0].key, childName: name.trim() }, "childPhoto", "add this child")
                  : save("block-new", { childName: name.trim() }, "childPhoto", "add this child"))}>
                {busy ? "Saving…" : "Add this child"}
              </button>
            </div>
          </>
        )}

        {step === "parent" && (
          <>
            <p className="drop-ask-q">Which other parent?</p>
            <div className="drop-ask-list">
              {blocks.map((b) => (
                <button key={b.key} type="button" className={b.key === hint?.parent ? "pd-primary" : undefined} disabled={busy}
                  onClick={() => void save("parent-photo", { block: b.key }, "file", "save this photo")}>
                  {blockLabel(b)} {b.hasPhoto && <small>(replaces their photo)</small>}
                </button>
              ))}
              <button type="button" onClick={() => setStep("new-parent")} disabled={busy}>+ Someone not on the page yet</button>
            </div>
          </>
        )}

        {step === "new-parent" && (
          <>
            <p className="drop-ask-q">The other parent of {choices.first}&apos;s children</p>
            <div className="drop-ask-list">
              <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="They are the children's…" disabled={busy}>
                <option value="">They are the children&apos;s…</option>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Their full name" aria-label="Their full name" maxLength={120} disabled={busy} />
              <button type="button" className="pd-primary" disabled={busy || (!name.trim() && !role)}
                onClick={() => void save("block-new", { role, name: name.trim() }, "parentPhoto", "save this photo")}>
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </>
        )}

        {error && <p className="drop-ask-error" role="alert">{error}</p>}
        <div className="drop-ask-foot">
          {step !== "what" && <button type="button" onClick={() => { setStep("what"); setError(""); }} disabled={busy}>← Back</button>}
          <button type="button" onClick={() => next(false)} disabled={busy}>{left > 0 ? "Skip this photo" : "Don't add it"}</button>
          {left > 0 && <button type="button" onClick={() => onDone(changed)} disabled={busy}>Stop (skip the rest)</button>}
        </div>
      </div>
    </div>
  );
}
