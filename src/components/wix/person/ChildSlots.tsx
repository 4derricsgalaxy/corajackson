"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { failText, plainError, sendForm } from "@/lib/net";
import { HeicDecodeError, MAX_RAW_BYTES, PHOTO_ACCEPT, isHeicFile, preparePhoto } from "@/lib/photos/prepare";

/**
 * Edit mode only, on the pages the signed-in editor may change: "plug and play" slots in the Children section.
 * Every block (one per other parent) ends with ONE empty child slot - photo + name - and the next one appears
 * only once that one is saved. An empty slot is never seen by visitors, and none show while Design is open.
 * A page with no children starts from the "Add children" button, which turns it into the standard page with
 * the first slot: the other parent (photo, name, marital status) and the first child.
 * Everything is saved by /api/family/children.
 */

const ROLES = ["Mother", "Father", "Spouse", "Partner"];
/** the tiles are 99px wide and the other parent's frame 74px: 1200px is plenty, and keeps two pictures under the request limit */
const SLOT_SIDE = 1200;

type Fields = Record<string, string | Blob | undefined>;
type Picked = { blob: Blob; name: string; preview: string };

/** a picked file -> an upright JPEG (or the HEIC original when this browser can't read it) + a local preview */
async function pickPicture(file: File): Promise<Picked> {
  try {
    const p = await preparePhoto(file, SLOT_SIDE);
    return { blob: p.blob, name: p.name, preview: URL.createObjectURL(p.blob) };
  } catch (err) {
    if (err instanceof HeicDecodeError || (await isHeicFile(file))) {
      if (file.size > MAX_RAW_BYTES) throw new Error("This iPhone photo is too big to use here. Save it as a JPG and try again.");
      return { blob: file, name: /\.hei[cf]$/i.test(file.name) ? file.name : `${file.name || "photo"}.heic`, preview: "" };
    }
    throw err;
  }
}

async function send(path: string, op: string, fields: Fields, verb: string) {
  const form = new FormData();
  form.set("path", path);
  form.set("op", op);
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    if (v instanceof Blob) form.set(k, v, v instanceof File ? v.name : `${k}.jpg`);
    else form.set(k, v);
  }
  let res: Response;
  try {
    res = await sendForm("/api/family/children", form);
  } catch (err) {
    throw new Error(plainError(err, verb));
  }
  const out = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || !out.ok) throw new Error(out.error ?? failText(res.status, verb));
}

/** one save at a time per slot, with its error in plain words; the page re-reads Snackbox afterwards
 *  (and the slot stays "busy" until the updated page is there) */
function useSave() {
  const router = useRouter();
  const [saving, setBusy] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState("");
  const busy = saving || refreshing;
  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await job();
      startRefresh(() => router.refresh());
      return true;
    } catch (err) {
      setError((err as Error).message || "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

/** a hidden file input and the function that opens it */
function usePicker(onFile: (f: File) => void) {
  const input = useRef<HTMLInputElement>(null);
  const el = (
    <input
      ref={input}
      type="file"
      accept={PHOTO_ACCEPT}
      hidden
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) onFile(f);
      }}
    />
  );
  return { open: () => input.current?.click(), el };
}

/** a picture held in the slot until Save: picking it turns it upright and shows it */
function usePicked() {
  const [picked, setPicked] = useState<Picked>();
  const [error, setError] = useState("");
  const [getting, setGetting] = useState(false);
  useEffect(() => () => { if (picked?.preview) URL.revokeObjectURL(picked.preview); }, [picked]);
  const take = async (f: File) => {
    setError("");
    setGetting(true);
    try {
      setPicked(await pickPicture(f));
    } catch (err) {
      setError((err as Error).message || "Couldn't use this picture.");
    } finally {
      setGetting(false);
    }
  };
  return { picked, take, clear: () => setPicked(undefined), error, getting };
}

function Thumb({ picked, getting, label, className }: { picked?: Picked; getting: boolean; label: string; className: string }) {
  return (
    <span className={className} style={picked?.preview ? { backgroundImage: `url(${picked.preview})` } : undefined}>
      {!picked?.preview && <span>{getting ? "Getting it ready…" : picked ? "Photo picked" : label}</span>}
    </span>
  );
}

function Problem({ text }: { text: string }) {
  return text ? <span className="kid-slot-error" role="alert">{text}</span> : null;
}

/* ------------------------------------------------------------------ */

/** the empty child slot at the end of a block: photo + full name, then Save */
export function KidSlot({ path, block, first }: { path: string; block: string; first: boolean }) {
  const photo = usePicked();
  const [name, setName] = useState("");
  const save = useSave();
  const picker = usePicker((f) => void photo.take(f));
  const ready = name.trim().length > 0 && !photo.getting;

  const submit = () =>
    void save
      .run(() => send(path, "child-add", { block, childName: name.trim(), childPhoto: photo.picked?.blob }, "add this child"))
      .then((ok) => {
        if (!ok) return;
        setName("");
        photo.clear();
      });

  return (
    <li className="kid-slot">
      <button type="button" className="kid-slot-photo" onClick={picker.open} disabled={save.busy} title="Pick this child's photo">
        <Thumb picked={photo.picked} getting={photo.getting} label={first ? "+ Child's photo" : "+ Next child"} className="kid-slot-thumb" />
      </button>
      {picker.el}
      <input
        className="kid-slot-name"
        value={name}
        placeholder="Full name"
        aria-label="Child's full name"
        maxLength={120}
        disabled={save.busy}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && ready) submit(); }}
      />
      {(name || photo.picked) && (
        <button type="button" className="kid-slot-save" onClick={submit} disabled={!ready || save.busy}>
          {save.busy ? "Saving…" : name.trim() ? "Save" : "Type the name"}
        </button>
      )}
      <Problem text={photo.error || save.error} />
    </li>
  );
}

/** the ✎ on a child already on the page: their photo here, their name, or (if added by mistake) take them off */
export function KidTools({ path, child, name, hasPagePhoto, removable }: { path: string; child: string; name: string; hasPagePhoto: boolean; removable: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(name);
  const save = useSave();
  const box = useRef<HTMLSpanElement>(null);
  const done = (ok: boolean) => { if (ok) setOpen(false); };
  const picker = usePicker((f) => void save.run(async () => {
    const p = await pickPicture(f);
    if (p.preview) URL.revokeObjectURL(p.preview);
    await send(path, "child-photo", { child, file: p.blob }, "change this photo");
  }).then(done));

  // one menu at a time: a click anywhere else closes it
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  return (
    <span className="kid-tools" ref={box}>
      <button type="button" className="kid-tools-open" onClick={() => setOpen((v) => !v)} aria-expanded={open} title={`Change ${name}'s photo or name`}>
        {save.busy ? "…" : "✎"}
      </button>
      {picker.el}
      {open && (
        <span className="kid-tools-menu">
          <button type="button" onClick={picker.open} disabled={save.busy}>Change photo</button>
          {hasPagePhoto && (
            <button type="button" disabled={save.busy} onClick={() => void save.run(() => send(path, "child-photo", { child, remove: "1" }, "remove this photo")).then(done)}>
              Use their own photo
            </button>
          )}
          <label>
            Full name
            <input value={text} maxLength={120} onChange={(e) => setText(e.target.value)} disabled={save.busy} />
          </label>
          <button
            type="button"
            className="kid-slot-save"
            disabled={save.busy || !text.trim() || text.trim() === name}
            onClick={() => void save.run(() => send(path, "child-name", { child, childName: text.trim() }, "rename this child")).then(done)}
          >
            Save name
          </button>
          {removable && (
            <button
              type="button"
              className="kid-tools-remove"
              disabled={save.busy}
              onClick={() => {
                if (window.confirm(`Take ${name} off this page? Their page will be deleted too.`)) void save.run(() => send(path, "child-remove", { child }, "remove this child")).then(done);
              }}
            >
              Remove (added by mistake)
            </button>
          )}
          <Problem text={save.error} />
        </span>
      )}
    </span>
  );
}

/** the other parent's photo frame in the block's gutter: an empty slot to fill, or a small Change button on the photo */
export function PartnerSlot({ path, block, filled }: { path: string; block: string; filled: boolean }) {
  const save = useSave();
  const picker = usePicker((f) => void save.run(async () => {
    const p = await pickPicture(f);
    if (p.preview) URL.revokeObjectURL(p.preview);
    await send(path, "parent-photo", { block, file: p.blob }, "save this photo");
  }));
  return (
    <>
      <button type="button" className={filled ? "partner-slot-change" : "partner-slot"} onClick={picker.open} disabled={save.busy} title="The other parent's photo">
        {save.busy ? "Saving…" : filled ? "Change" : "+ Their photo"}
      </button>
      {picker.el}
      {save.error && <span className="partner-slot-error"><Problem text={save.error} /></span>}
    </>
  );
}

/** the words of a block's other parent: "Mother: Tacia Bond / Marital Status: married" */
function ParentFields({ role, name, status, onRole, onName, onStatus, disabled }: {
  role: string; name: string; status: string; disabled: boolean;
  onRole: (v: string) => void; onName: (v: string) => void; onStatus: (v: string) => void;
}) {
  return (
    <span className="parent-slot-fields">
      <select value={role} onChange={(e) => onRole(e.target.value)} disabled={disabled} aria-label="They are the children's…">
        <option value="">They are the children&apos;s…</option>
        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <input value={name} placeholder="Other parent's full name" aria-label="Other parent's full name" maxLength={120} onChange={(e) => onName(e.target.value)} disabled={disabled} />
      <input value={status} placeholder="Marital status (married, divorced…)" aria-label="Marital status" maxLength={120} onChange={(e) => onStatus(e.target.value)} disabled={disabled} />
    </span>
  );
}

/** "✎ Other parent" under a block's note (or "+ Other parent" when the block has none) */
export function ParentEdit({ path, block, role, name, status, empty, canRemove }: { path: string; block: string; role: string; name: string; status: string; empty: boolean; canRemove: boolean }) {
  const [open, setOpen] = useState(false);
  const [r, setR] = useState(role);
  const [n, setN] = useState(name);
  const [s, setS] = useState(status);
  const save = useSave();
  if (!open) {
    return (
      <button type="button" className="parent-slot-open" onClick={() => setOpen(true)}>
        {empty ? "+ Other parent's name" : "✎ Other parent"}
      </button>
    );
  }
  return (
    <span className="parent-slot-form">
      <ParentFields role={r} name={n} status={s} onRole={setR} onName={setN} onStatus={setS} disabled={save.busy} />
      <span className="parent-slot-buttons">
        <button
          type="button"
          className="kid-slot-save"
          disabled={save.busy}
          onClick={() => void save.run(() => send(path, "parent", { block, role: r, name: n.trim(), status: s.trim() }, "save the other parent")).then((ok) => ok && setOpen(false))}
        >
          {save.busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => { setOpen(false); setR(role); setN(name); setS(status); }} disabled={save.busy}>Cancel</button>
        {canRemove && (
          <button type="button" className="kid-tools-remove" disabled={save.busy} onClick={() => void save.run(() => send(path, "block-remove", { block }, "remove this group"))}>
            Remove this group
          </button>
        )}
      </span>
      <Problem text={save.error} />
    </span>
  );
}

/**
 * A new block: the other parent (photo, name, status) + the first child, saved together. On a page that has
 * children it waits as one dashed "+ Children with another parent" line; Cancel folds it away again.
 */
export function NewBlock({ path, starter, onCancel }: { path: string; starter?: boolean; onCancel?: () => void }) {
  const [open, setOpen] = useState(Boolean(starter));
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [kid, setKid] = useState("");
  const parentPhoto = usePicked();
  const kidPhoto = usePicked();
  const parentPicker = usePicker((f) => void parentPhoto.take(f));
  const kidPicker = usePicker((f) => void kidPhoto.take(f));
  const save = useSave();
  const hasSomething = Boolean(kid.trim() || name.trim() || role || parentPhoto.picked);
  const tooBig = (parentPhoto.picked?.blob.size ?? 0) + (kidPhoto.picked?.blob.size ?? 0) > MAX_RAW_BYTES;

  if (!open) {
    return (
      <button type="button" className="block-slot-open" onClick={() => setOpen(true)}>
        + Children with another parent
      </button>
    );
  }
  const cancel = () => {
    setOpen(false);
    setRole(""); setName(""); setStatus(""); setKid("");
    parentPhoto.clear();
    kidPhoto.clear();
    onCancel?.();
  };
  const submit = () =>
    void save.run(() =>
      send(path, "block-new", {
        role, name: name.trim(), status: status.trim(), parentPhoto: parentPhoto.picked?.blob,
        childName: kid.trim(), childPhoto: kid.trim() ? kidPhoto.picked?.blob : undefined,
      }, "save the children"),
    );

  return (
    <div className="wix-person-group block-slot">
      <div className="wix-person-group-note block-slot-note">
        <ParentFields role={role} name={name} status={status} onRole={setRole} onName={setName} onStatus={setStatus} disabled={save.busy} />
      </div>
      <div className="wix-person-group-body">
        <button type="button" className="partner-slot partner-slot-picked" onClick={parentPicker.open} disabled={save.busy} title="The other parent's photo">
          <Thumb picked={parentPhoto.picked} getting={parentPhoto.getting} label="+ Their photo" className="partner-slot-thumb" />
        </button>
        {parentPicker.el}
        <ul className="wix-person-kids">
          <li className="kid-slot">
            <button type="button" className="kid-slot-photo" onClick={kidPicker.open} disabled={save.busy} title="Pick the child's photo">
              <Thumb picked={kidPhoto.picked} getting={kidPhoto.getting} label="+ Child's photo" className="kid-slot-thumb" />
            </button>
            {kidPicker.el}
            <input className="kid-slot-name" value={kid} placeholder="Child's full name" aria-label="Child's full name" maxLength={120} onChange={(e) => setKid(e.target.value)} disabled={save.busy} />
          </li>
        </ul>
      </div>
      <p className="block-slot-buttons">
        <button type="button" className="kid-slot-save" onClick={submit} disabled={!hasSomething || save.busy || parentPhoto.getting || kidPhoto.getting || tooBig}>
          {save.busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={cancel} disabled={save.busy}>Cancel</button>
        {tooBig && <span className="kid-slot-hint">These two photos are too big together: save with one, then add the other.</span>}
        {!tooBig && kidPhoto.picked && !kid.trim() && <span className="kid-slot-hint">Type the child&apos;s name to save their photo.</span>}
      </p>
      <Problem text={parentPhoto.error || kidPhoto.error || save.error} />
    </div>
  );
}

/**
 * A page with no children: the "+ Add children" button (bottom right, over "Add photos"). Pressing it turns the
 * page into the standard page right away and opens the first slot in the Children column; Cancel puts it back.
 */
export function ChildrenStart({ path, first }: { path: string; first: string }) {
  const [active, setActive] = useState(false);
  const [column, setColumn] = useState<Element | null>(null);

  // the page's own layout class: standard while the slot is open, solo again after Cancel
  useEffect(() => {
    document.querySelector(".wix-person-body")?.classList.toggle("wix-person-solo", !active);
  }, [active]);
  const start = () => {
    setColumn(document.querySelector(".wix-person-right"));
    setActive(true);
  };

  let form: ReactNode = null;
  if (active && column) {
    form = createPortal(
      <section className="wix-person-children kid-slot-start" aria-label="Children">
        <h2 className="wix-h2 wix-person-children-h">Children</h2>
        <NewBlock path={path} starter onCancel={() => setActive(false)} />
      </section>,
      column,
    );
  }
  return (
    <>
      {!active && (
        <button type="button" className="pd-ui children-add-launch" onClick={start} title={`Add ${first}'s children (and the other parent) to this page`}>
          <span aria-hidden>＋</span> <strong>Add children</strong>
        </button>
      )}
      {form}
    </>
  );
}
