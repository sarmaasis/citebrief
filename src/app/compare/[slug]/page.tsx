import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicArticleView } from "@/components/marketing/article-views";
import { articleByPath, PUBLIC_ARTICLES } from "@/lib/public-articles";
import { articleMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

const PREFIX = "/compare/";

export function generateStaticParams() {
  return PUBLIC_ARTICLES.filter((article) => article.path.startsWith(PREFIX)).map((article) => ({
    slug: article.path.slice(PREFIX.length),
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = articleByPath(`${PREFIX}${slug}`);
  if (!article) return { title: "Compare" };
  return articleMetadata(article);
}

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = articleByPath(`${PREFIX}${slug}`);
  if (!article) notFound();
  return <PublicArticleView article={article} />;
}
