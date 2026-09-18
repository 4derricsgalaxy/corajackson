import type { NextConfig } from "next";
import { withSnackbox } from "./src/lib/cms/next";

/** Old Wix slugs → new clean URLs, so bookmarks and search results keep working. */
const OLD_SLUGS: Record<string, string> = {
  cora: "/family/cora",
  joanne: "/family/joanne",
  marietha: "/family/marietha",
  renae: "/family/renae",
  derrick: "/family/derrick",
  anthony: "/family/anthony",
  tammie: "/family/tammie",
  tanya: "/family/tanya",
  darwin: "/family/darwin",
  nakita: "/family/nakita",
  greg: "/family/greg",
  lamont: "/family/lamont",
  carlos: "/family/carlos",
  corey: "/family/corey",
  h: "/family/shaun",
  shaun: "/family/crystal",
  hanna: "/family/hanna",
  bubba: "/family/bubba",
  sam: "/family/sam",
  "page-28": "/family/keith",
  "little-derrick": "/family/little-derrick",
  "page-26": "/family/christopher",
  "page-27": "/family/camren",
  "copy-of-little-derrick-2": "/family/alicia",
  josh: "/family/josh",
  "copy-of-little-derrick": "/family/josh",
  gabrielle: "/family/gabrielle",
  bernard: "/family/bernard",
  blank: "/",
};

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  async redirects() {
    return Object.entries(OLD_SLUGS).map(([from, to]) => ({ source: `/${from}`, destination: to, permanent: true }));
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default withSnackbox(nextConfig);
