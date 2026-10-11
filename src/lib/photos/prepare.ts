/**
 * Browser side of every photo upload (drag-and-drop "Add photos" and the Design tool).
 *
 * Any picture a family member has - including iPhone HEIC photos - becomes an upright JPEG of at most
 * 2400px before it leaves their computer: small enough for the site's 4.5 MB request cap, turned the right
 * way up (the CMS does not apply camera rotation), and without the phone's location data.
 */

/** what the file pickers accept: every image type plus HEIC/HEIF, which some browsers don't list as image/* */
export const PHOTO_ACCEPT = "image/*,.heic,.heif,.HEIC,.HEIF";

/** the largest file we send untouched to the server's own HEIC converter (Vercel caps a request at 4.5 MB) */
export const MAX_RAW_BYTES = 4_400_000;

/** thrown when this browser cannot decode a HEIC photo; the caller may hand the original to the server */
export class HeicDecodeError extends Error {}

const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs", "mif1", "msf1"]);

/** by type, extension, or the file's own header (phones and Windows often send HEIC with no type at all) */
export async function isHeicFile(file: File): Promise<boolean> {
  if (/^image\/hei[cf](-sequence)?$/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) return true;
  if (file.type && file.type !== "application/octet-stream") return false;
  try {
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const ascii = (a: number, b: number) => String.fromCharCode(...head.slice(a, b));
    return ascii(4, 8) === "ftyp" && HEIC_BRANDS.has(ascii(8, 12));
  } catch {
    return false;
  }
}

/** a picture we can try: anything image/*, HEIC, or an untyped file with a picture extension */
export function looksLikePicture(file: File): boolean {
  return file.type.startsWith("image/") || /\.(hei[cf]|jpe?g|png|webp|gif|avif|bmp|tiff?)$/i.test(file.name) || file.type === "";
}

export interface PreparedPhoto {
  blob: Blob;
  name: string;
  w: number;
  h: number;
  /** true when the source was HEIC */
  heic: boolean;
}

/** HEIC -> JPEG in the browser (libheif, loaded only when a HEIC photo actually arrives) */
async function decodeHeic(file: File): Promise<Blob> {
  try {
    const { heicTo } = await import("heic-to");
    return await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
  } catch {
    throw new HeicDecodeError("This browser could not read the iPhone photo.");
  }
}

/** Any picture -> an upright JPEG no larger than `maxSide` px, on a white background (for transparent PNGs). */
export async function preparePhoto(file: File, maxSide = 2400): Promise<PreparedPhoto> {
  const heic = await isHeicFile(file);
  const source: Blob = heic ? await decodeHeic(file) : file;

  let bmp: ImageBitmap;
  try {
    // "from-image" turns phone photos the right way up using their camera rotation tag
    bmp = await createImageBitmap(source, { imageOrientation: "from-image" });
  } catch {
    if (heic) throw new HeicDecodeError("This browser could not read the iPhone photo.");
    throw new Error("This file isn't a picture the browser can open. Save it as a JPG and try again.");
  }
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * scale));
  c.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not read that picture."))), "image/jpeg", 0.88));
  return { blob, name: `${baseName(file.name) || "photo"}.jpg`, w: c.width, h: c.height, heic };
}

/** "IMG_1234.HEIC" -> "IMG_1234" */
export function baseName(name: string): string {
  return name.replace(/\.[A-Za-z0-9]{1,5}$/, "").trim();
}

/** A readable title from a file name, or "" when the name is just camera numbering (IMG_1234, PXL_2024..., 20231225_101500). */
export function titleFromFileName(name: string): string {
  const base = baseName(name);
  if (/^(img|image|pxl|dsc|dscn|dcim|mvimg|photo|pic|picture|screenshot|screen shot|fb_img|received|whatsapp image|snapchat|signal|wp_|vid|p\d|_mg)[\s_-]*[\d\s_.:-]*(\(\d+\))?$/i.test(base)) return "";
  if (/^[\d\s_.:()-]+$/.test(base)) return "";
  return base.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}
