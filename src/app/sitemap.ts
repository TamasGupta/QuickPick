import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://grabon.vercel.app";

  return [
    {
      url: `${base}/`,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${base}/categories`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${base}/login`,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${base}/about`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${base}/contact`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${base}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/terms`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${base}/refund-policy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
