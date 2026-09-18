import type { SiteImage } from "@/lib/content/types";

/** Serializable node passed from server pages into the client-side tree. */
export interface SceneNode {
  id: string;
  slug: string;
  title: string;
  nickname?: string;
  shortBio?: string;
  portrait?: SiteImage;
  generation: number;
  parentId: string | null;
  lineIndex: number;
  lineSlug?: string;
  color: string;
  position: [number, number, number];
  childCount: number;
  birthDate?: string;
  deathDate?: string;
}

export interface SceneLine {
  index: number;
  slug: string;
  title: string;
  color: string;
}
