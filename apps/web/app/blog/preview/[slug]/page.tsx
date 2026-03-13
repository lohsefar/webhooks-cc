import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { compileBlogMDX } from "@/lib/blog-mdx";
import { BlogPostShell, type BlogPostData } from "@/components/blog/blog-post-shell";
import { getDraftBlogPostBySlug } from "@/lib/supabase/blog-posts";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    robots: { index: false, follow: false },
  };
}

export default async function BlogPreviewPage({ params }: PageProps) {
  const { slug } = await params;
  const post = await getDraftBlogPostBySlug(slug);

  if (!post) notFound();

  const { content, headings } = await compileBlogMDX(post.content);

  return (
    <BlogPostShell post={post as BlogPostData} headings={headings} relatedPosts={[]} isDraft>
      {content}
    </BlogPostShell>
  );
}
