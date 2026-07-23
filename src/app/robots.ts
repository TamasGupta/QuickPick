import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://grabon.vercel.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/categories", "/login"],
        disallow: [
          "/admin",
          "/seller",
          "/rider",
          "/api",
          "/cart",
          "/checkout",
          "/account",
          "/orders",
          "/monitoring",
          "/sentry-example-page",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
