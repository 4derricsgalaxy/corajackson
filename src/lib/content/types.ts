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
  /** Snackbox asset id, when known - lets a nested image be matched to its fully resolved copy */
  assetId?: string;
}

/**
 * An image stored INSIDE a list item. The CMS never resolves those (no srcset, and `url` only if the editor
 * saved one), so they are finished at render time against the asset index - see `resolveImage`.
 */
export interface NestedImage {
  assetId?: string;
  url?: string;
  alt?: string | null;
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
  /** "Children on this page": one block per other parent, holding the children and the photo each gets on THIS page. */
  families?: Family[];
  /** Superseded by `families`; still read for a member whose children are not listed there. */
  partners?: Partner[];
  parentNote?: string;
  birthDate?: string;
  deathDate?: string;
  birthplace?: string;
  residence?: string;
  occupation?: string;
  shortBio?: string;
  bio?: RichContent;
  portrait?: SiteImage;
  /** Childhood photo: this person's frame on the Family Tree and their tile under a parent's Children. Falls back to the portrait. */
  treePhoto?: SiteImage;
  heroImage?: SiteImage;
  /** Background strength, 0-100 (percent). Empty = the standard 45. Applies to the hero image or the default leaves. */
  heroStrength?: number;
  gallery?: SiteImage[];
  accentColor?: string;
  sortOrder?: number | string;
  featured?: boolean;
  published?: boolean;
}

export interface Partner {
  name: string;
  photo?: SiteImage;
}

export interface Family {
  key: string;
  /** "Father" | "Mother" for a block with children, "Spouse" | "Partner" for a childless one */
  role?: string;
  name?: string;
  /** as typed, e.g. "divorced" - title-cased where the parent's page shows it */
  status?: string;
  photo?: NestedImage;
  children: { childId: string; photo?: NestedImage }[];
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
  /** Site settings > write-up font / style / size: the text under every person's portrait */
  bioFont?: string;
  bioFontStyle?: string;
  bioFontSize?: string;
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
