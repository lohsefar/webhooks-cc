import { notFound } from "next/navigation";
import { compileMDX } from "next-mdx-remote/rsc";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeSlug from "rehype-slug";
import { getDocBySlug } from "@/lib/docs";
import { createPageMetadata } from "@/lib/seo";
import { mdxComponents } from "@/components/docs/mdx-components";
import { PrevNextNav } from "@/components/docs/prev-next";
import { getPrevNext } from "@/lib/docs-nav";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ slug: string[] }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const slugPath = slug.join("/");
  const doc = await getDocBySlug(slugPath);

  if (!doc) return {};

  const { frontmatter: fm } = doc;
  return createPageMetadata({
    title: fm.seo?.ogTitle ?? fm.title,
    description: fm.seo?.ogDescription ?? fm.description,
    path: `/docs/${slugPath}`,
    keywords: fm.keywords,
  });
}

export default async function DocsCatchAllPage({ params }: PageProps) {
  const { slug } = await params;
  const slugPath = slug.join("/");
  const doc = await getDocBySlug(slugPath);

  if (!doc) notFound();

  const { content, frontmatter: fm } = doc;

  const { content: mdxContent } = await compileMDX({
    source: content,
    components: mdxComponents,
    options: {
      mdxOptions: {
        rehypePlugins: [
          rehypeSlug,
          [
            rehypePrettyCode,
            {
              theme: {
                light: "github-light",
                dark: "github-dark",
              },
              keepBackground: false,
            },
          ],
        ],
      },
    },
  });

  const href = `/docs/${slugPath}`;
  const { prev, next } = getPrevNext(href);

  return (
    <div className="flex gap-10">
      <article className="max-w-3xl flex-1 min-w-0">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">{fm.title}</h1>
        <p className="text-lg text-muted-foreground mb-10">{fm.description}</p>
        {mdxContent}
        <PrevNextNav prev={prev} next={next} />
      </article>
    </div>
  );
}
