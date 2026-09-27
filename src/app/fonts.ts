import { Besley, Dancing_Script, Great_Vibes, Lora, Merriweather, Montserrat, Nunito_Sans, Open_Sans, Playfair_Display, Poppins } from "next/font/google";

/**
 * Free stand-ins for the fonts the original Wix site used:
 * Proxima Nova → Nunito Sans, Didot Italic → Playfair Display Italic,
 * Lulo Clean Bold → Montserrat 800 (uppercase, tracked), Clarendon → Besley.
 * Poppins and Arial are used as-is.
 */
export const proxima = Nunito_Sans({
  subsets: ["latin"],
  variable: "--font-proxima",
  display: "swap",
});

export const didot = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-didot",
  style: ["italic"],
  weight: ["500"],
  display: "swap",
});

export const lulo = Montserrat({
  subsets: ["latin"],
  variable: "--font-lulo",
  weight: ["800"],
  display: "swap",
});

export const clarendon = Besley({
  subsets: ["latin"],
  variable: "--font-clarendon",
  weight: ["500"],
  display: "swap",
});

export const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  weight: ["600"],
  display: "swap",
});

/**
 * Choices for Site settings > "Write-up font" (the text under each person's portrait) and for the
 * on-page Design tool (lib/design/model.ts). Not preloaded: a browser only downloads what a page uses.
 */
export const bioPlayfair = Playfair_Display({ subsets: ["latin"], style: ["normal", "italic"], weight: ["400", "500", "700"], display: "swap", preload: false, variable: "--font-bio-playfair" });
export const bioLora = Lora({ subsets: ["latin"], style: ["normal", "italic"], weight: ["400", "700"], display: "swap", preload: false, variable: "--font-bio-lora" });
export const bioMerriweather = Merriweather({ subsets: ["latin"], style: ["normal", "italic"], weight: ["400", "700"], display: "swap", preload: false, variable: "--font-bio-merriweather" });
export const bioBesley = Besley({ subsets: ["latin"], style: ["normal", "italic"], weight: ["400", "700"], display: "swap", preload: false, variable: "--font-bio-besley" });
export const bioNunito = Nunito_Sans({ subsets: ["latin"], style: ["normal", "italic"], weight: ["400", "700"], display: "swap", preload: false, variable: "--font-bio-nunito" });
export const bioMontserrat = Montserrat({ subsets: ["latin"], style: ["normal", "italic"], weight: ["400", "700"], display: "swap", preload: false, variable: "--font-bio-montserrat" });
export const bioPoppins = Poppins({ subsets: ["latin"], style: ["normal", "italic"], weight: ["400", "700"], display: "swap", preload: false, variable: "--font-bio-poppins" });
export const bioOpenSans = Open_Sans({ subsets: ["latin"], style: ["normal", "italic"], weight: ["400", "700"], display: "swap", preload: false, variable: "--font-bio-opensans" });
export const bioDancing = Dancing_Script({ subsets: ["latin"], weight: ["400", "700"], display: "swap", preload: false, variable: "--font-bio-dancing" });
export const bioGreatVibes = Great_Vibes({ subsets: ["latin"], weight: ["400"], display: "swap", preload: false, variable: "--font-bio-greatvibes" });
export const bioFontVariables = [bioPlayfair, bioLora, bioMerriweather, bioBesley, bioNunito, bioMontserrat, bioPoppins, bioOpenSans, bioDancing, bioGreatVibes].map((f) => f.variable).join(" ");
