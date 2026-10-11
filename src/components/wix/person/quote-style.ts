import type { CSSProperties } from "react";
import type { SiteSettings } from "@/lib/content/types";

/** Site settings "Write-up font" option -> font stack (the --font-bio-* variables come from app/fonts.ts). */
const FAMILIES: Record<string, string> = {
  "Playfair Display": "var(--font-bio-playfair), Didot, Georgia, serif",
  Lora: "var(--font-bio-lora), Georgia, serif",
  Merriweather: "var(--font-bio-merriweather), Georgia, serif",
  Besley: "var(--font-bio-besley), Georgia, serif",
  "Nunito Sans": "var(--font-bio-nunito), Arial, sans-serif",
  Montserrat: "var(--font-bio-montserrat), Arial, sans-serif",
  Poppins: "var(--font-bio-poppins), Arial, sans-serif",
  "Open Sans": "var(--font-bio-opensans), Arial, sans-serif",
  Georgia: "Georgia, serif",
  Arial: "Arial, Helvetica, sans-serif",
};
const SIZES: Record<string, string> = { Small: "13px", Standard: "14px", Large: "16px", "Extra large": "18px" };

/**
 * CSS variables for `.wix-quote`, from Site settings. Nothing chosen = no variables = the original
 * look (Playfair Display italic 500, 14px/1.1), so the page is unchanged until someone picks a font.
 */
export function quoteStyle(settings: SiteSettings): CSSProperties | undefined {
  const family = settings.bioFont ? FAMILIES[settings.bioFont] : undefined;
  const size = settings.bioFontSize ? SIZES[settings.bioFontSize] : undefined;
  const upright = settings.bioFontStyle === "Upright";
  const vars: Record<string, string> = {};
  // the original italic face is only loaded in italic 500; any other combination uses the bio set
  if ((family && settings.bioFont !== "Playfair Display") || upright) vars["--wix-quote-font"] = family ?? FAMILIES["Playfair Display"];
  if (upright) vars["--wix-quote-style"] = "normal";
  if (family && settings.bioFont !== "Playfair Display") { vars["--wix-quote-weight"] = "400"; vars["--wix-quote-leading"] = "1.3"; }
  if (size) vars["--wix-quote-size"] = size;
  return Object.keys(vars).length ? (vars as CSSProperties) : undefined;
}
