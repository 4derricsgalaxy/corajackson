import { Besley, Montserrat, Nunito_Sans, Playfair_Display, Poppins } from "next/font/google";

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
