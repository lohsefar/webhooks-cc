import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./admin";
import type { Database } from "./database";
import type { BlogPostData } from "@/components/blog/blog-post-shell";

type BlogPostRow = Database["public"]["Tables"]["blog_posts"]["Row"];
type BlogPostStatus = BlogPostRow["status"];
type SelectedBlogPostRow = Pick<
  BlogPostRow,
  | "slug"
  | "title"
  | "description"
  | "content"
  | "category"
  | "read_minutes"
  | "tags"
  | "status"
  | "published_at"
  | "updated_at"
  | "author_name"
  | "seo_title"
  | "seo_description"
  | "canonical_url"
  | "featured"
  | "keywords"
  | "schema_type"
  | "change_frequency"
  | "priority"
>;
type BlogPostPreview = Pick<SelectedBlogPostRow, Exclude<keyof SelectedBlogPostRow, "content">>;

export interface BlogPostRecord extends BlogPostData {
  content: string;
  status: BlogPostStatus;
  changeFrequency: "weekly" | "monthly" | "yearly";
  priority: number;
}

const BASE_SELECT =
  "slug, title, description, category, read_minutes, tags, status, published_at, updated_at, author_name, seo_title, seo_description, canonical_url, featured, keywords, schema_type, change_frequency, priority";
const FULL_SELECT = `${BASE_SELECT}, content`;

let _public: SupabaseClient<Database> | null = null;

function createPublicClient(): SupabaseClient<Database> {
  if (_public) {
    return _public;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required");
  }

  _public = createClient<Database>(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return _public;
}

function parseMillis(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeBlogPost(row: SelectedBlogPostRow): BlogPostRecord {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    content: row.content,
    category: row.category,
    readMinutes: row.read_minutes,
    publishedAt: parseMillis(row.published_at),
    updatedAt: parseMillis(row.updated_at) ?? Date.now(),
    tags: row.tags,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    keywords: row.keywords,
    schemaType: row.schema_type,
    authorName: row.author_name,
    canonicalUrl: row.canonical_url ?? undefined,
    featured: row.featured,
    status: row.status,
    changeFrequency: row.change_frequency,
    priority: row.priority,
  };
}

function normalizeBlogPreview(row: BlogPostPreview): Omit<BlogPostRecord, "content"> {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    readMinutes: row.read_minutes,
    publishedAt: parseMillis(row.published_at),
    updatedAt: parseMillis(row.updated_at) ?? Date.now(),
    tags: row.tags,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    keywords: row.keywords,
    schemaType: row.schema_type,
    authorName: row.author_name,
    canonicalUrl: row.canonical_url ?? undefined,
    featured: row.featured,
    status: row.status,
    changeFrequency: row.change_frequency,
    priority: row.priority,
  };
}

export async function listPublishedBlogPosts(): Promise<Array<Omit<BlogPostRecord, "content">>> {
  const client = createPublicClient();
  const { data, error } = await client
    .from("blog_posts")
    .select(BASE_SELECT)
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .returns<BlogPostPreview[]>();

  if (error) {
    throw error;
  }

  return (data ?? []).map(normalizeBlogPreview);
}

export async function getPublishedBlogPostBySlug(slug: string): Promise<BlogPostRecord | null> {
  const client = createPublicClient();
  const { data, error } = await client
    .from("blog_posts")
    .select(FULL_SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .returns<SelectedBlogPostRow>()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? normalizeBlogPost(data) : null;
}

export async function getDraftBlogPostBySlug(slug: string): Promise<BlogPostRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("blog_posts")
    .select(FULL_SELECT)
    .eq("slug", slug)
    .eq("status", "draft")
    .returns<SelectedBlogPostRow>()
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? normalizeBlogPost(data) : null;
}
