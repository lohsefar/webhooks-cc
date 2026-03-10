import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getConvexClient } from "@/lib/convex-client";
import { api } from "@convex/_generated/api";
import { compileBlogMDX } from "@/lib/blog-mdx";
import { createDynamicBlogPostMetadata } from "@/lib/seo";
import { BlogPostShell, type BlogPostData } from "@/components/blog/blog-post-shell";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const convex = getConvexClient();
  const post = await convex.query(api.blogPosts.getPublishedBySlug, { slug });

  if (!post) return {};

  return createDynamicBlogPostMetadata(post as BlogPostData);
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const convex = getConvexClient();
  const post = await convex.query(api.blogPosts.getPublishedBySlug, { slug });

  if (!post) notFound();

  const { content, headings } = await compileBlogMDX(post.content);

  const allPosts = await convex.query(api.blogPosts.listPublished);
  const relatedPosts = allPosts
    .filter((p) => p.slug !== post.slug)
    .slice(0, 2)
    .map((p) => ({ slug: p.slug, title: p.title, description: p.description }));

  return (
    <BlogPostShell
      post={post as BlogPostData}
      headings={headings}
      relatedPosts={relatedPosts}
    >
      {content}
    </BlogPostShell>
  );
}
