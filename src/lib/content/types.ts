/** Content types for the site. Source of record is Snackbox CMS. */

/** A resolved image, ready for <img>: CDN url + srcset built by the CMS. */
export interface SiteImage {
  url: string;
  srcset?: string;
  originalUrl?: string;
  width?: number | null;
  height?: number | null;
  alt?: string | null;
  /** CSS object-position honoring the CMS hotspot/crop */
  position?: string;
}

/** Portable Text blocks (Snackbox) or legacy HTML (seed). */
export type RichContent = unknown[] | string;

export interface FamilyMember {
  _id: string;
  title: string;
  slug: string;
  nickname?: string;
  generation: number;
  parentId?: string | null;
  lineageId?: string | null;
  spouse?: string;
  parentNote?: string;
  birthDate?: string;
  deathDate?: string;
  birthplace?: string;
  residence?: string;
  occupation?: string;
  shortBio?: string;
  bio?: RichContent;
  portrait?: SiteImage;
  heroImage?: SiteImage;
  gallery?: SiteImage[];
  accentColor?: string;
  sortOrder?: number | string;
  featured?: boolean;
  published?: boolean;
}

export interface Story {
  _id: string;
  title: string;
  slug: string;
  excerpt?: string;
  body?: RichContent;
  coverImage?: SiteImage;
  gallery?: SiteImage[];
  storyDate?: string;
  authorName?: string;
  authorId?: string | null;
  peopleIds?: string[];
  sortOrder?: number | string;
  published?: boolean;
}

export interface Photo {
  _id: string;
  title: string;
  image: SiteImage;
  caption?: string;
  year?: number;
  album?: string;
  lineageId?: string | null;
  peopleIds?: string[];
  featured?: boolean;
  sortOrder?: number | string;
  published?: boolean;
}

export interface HistoryEntry {
  _id: string;
  title: string;
  year?: number;
  dateLabel?: string;
  body?: RichContent;
  image?: SiteImage;
  location?: string;
  peopleIds?: string[];
  sortOrder?: number | string;
  published?: boolean;
}

export interface SiteSettings {
  _id?: string;
  title: string;
  tagline?: string;
  heroHeading?: string;
  heroIntro?: RichContent;
  heroImage?: SiteImage;
  treeImage?: SiteImage;
  backgroundImage?: SiteImage;
  footerText?: string;
  contactEmail?: string;
  primaryColor?: string;
  accentColor?: string;
}

export interface TreeNode extends FamilyMember {
  children: TreeNode[];
  depth: number;
  lineSlug?: string;
}

export const TYPES = {
  members: "familyMember",
  stories: "story",
  photos: "photo",
  history: "historyEntry",
  settings: "siteSettings",
} as const;
