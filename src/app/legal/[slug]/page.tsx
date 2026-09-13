import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalArticleView } from "@/components/marketing/article-views";
import { LEGAL_ARTICLES, legalBySlug } from "@/lib/legal-articles";
import { legalMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return LEGAL_ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return legalMetadata(slug);
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = legalBySlug(slug);
  if (!article) notFound();
  return <LegalArticleView article={article} />;
}
