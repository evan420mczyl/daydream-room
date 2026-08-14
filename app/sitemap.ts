import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { allPosts } from "@/lib/posts";

export default function sitemap(): MetadataRoute.Sitemap {
  // 文章日期 "2026.07.20" → ISO "2026-07-20"（sitemap 的 lastModified 用）
  const posts = allPosts.map((p) => ({
    url: `${SITE_URL}/posts/${p.slug}`,
    lastModified: p.date.replace(/\./g, "-"),
  }));

  return [{ url: `${SITE_URL}/`, changeFrequency: "weekly" as const, priority: 1 }, ...posts];
}
