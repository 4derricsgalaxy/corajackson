import type { SiteImage } from "@/lib/content/types";

export interface NavLine {
  slug: string;
  title: string;
  nickname?: string;
  portrait?: SiteImage;
  descendants: number;
  color: string;
  children: { slug: string; title: string }[];
}

export interface NavPerson {
  slug: string;
  title: string;
  nickname?: string;
  lineSlug?: string;
  lineTitle?: string;
  generation: number;
  portrait?: SiteImage;
}

export interface NavData {
  siteTitle: string;
  lines: NavLine[];
  people: NavPerson[];
  rootSlug?: string;
}
