import type { NextConfig } from "next";

// SnackBox serves media from Supabase Storage. next/image rejects any remote
// host not listed here (400 INVALID_IMAGE_OPTIMIZE_REQUEST). This is the one
// place the media host is declared for every site — change it here only.
const SNACKBOX_MEDIA_PATTERN = {
  protocol: "https" as const,
  hostname: "lapgrwxnirzmxhyhlviu.supabase.co",
  pathname: "/storage/v1/object/public/cms-media/**",
};

export function withSnackbox(config: NextConfig = {}): NextConfig {
  // Allow the CMS's Studio visual editor to frame this site (and nobody else).
  const cmsOrigin = (process.env.NEXT_PUBLIC_SNACKBOX_URL ?? "https://snackbox-cms.vercel.app").replace(/\/$/, "");
  return {
    ...config,
    images: {
      ...config.images,
      remotePatterns: [...(config.images?.remotePatterns ?? []), SNACKBOX_MEDIA_PATTERN],
    },
    async headers() {
      const own = config.headers ? await config.headers() : [];
      return [
        ...own,
        {
          source: "/:path*",
          headers: [
            { key: "Content-Security-Policy", value: `frame-ancestors 'self' ${cmsOrigin}` },
          ],
        },
      ];
    },
  };
}
