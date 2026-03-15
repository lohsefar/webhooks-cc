import { SITE_URL } from "@/lib/seo";
import { listPublishedBlogPosts } from "@/lib/supabase/blog-posts";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export async function GET() {
  const posts = await listPublishedBlogPosts();

  const latestUpdate = posts.reduce<Date | null>((latest, post) => {
    const d = new Date(post.updatedAt);
    return !latest || d > latest ? d : latest;
  }, null);

  const urls = [
    `<url>
  <loc>${SITE_URL}/blog</loc>
  <lastmod>${(latestUpdate ?? new Date()).toISOString()}</lastmod>
  <changefreq>weekly</changefreq>
  <priority>0.7</priority>
</url>`,
    ...posts.map(
      (post) => `<url>
  <loc>${SITE_URL}/blog/${post.slug}</loc>
  <lastmod>${new Date(post.updatedAt).toISOString()}</lastmod>
  <changefreq>${post.changeFrequency}</changefreq>
  <priority>${post.priority}</priority>
</url>`
    ),
  ].join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      Vary: "Accept-Encoding",
    },
  });
}
