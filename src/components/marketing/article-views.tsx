import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingHeader } from "@/components/marketing/header";
import { JsonLd } from "@/components/seo/json-ld";
import type { LegalArticle } from "@/lib/legal-articles";
import { articleByPath, type PublicArticle } from "@/lib/public-articles";
import { articleJsonLd, articleMetadata, legalJsonLd } from "@/lib/seo";
import { notFound } from "next/navigation";

export function PublicArticleView({ article }: { article: PublicArticle }) {
  return (
    <div className="min-h-screen bg-cb-bg">
      <JsonLd json={articleJsonLd(article)} />
      <MarketingHeader />
      <main id="main" className="mx-auto max-w-2xl px-6 py-16">
        {article.kicker ? (
          <p className="text-xs font-medium uppercase tracking-wide text-cb-accent">{article.kicker}</p>
        ) : null}
        <h1 className="mt-3 font-serif text-4xl tracking-tight">{article.title}</h1>
        <p className="mt-6 text-base leading-7 text-cb-muted">{article.lede}</p>
        <div className="mt-10 space-y-8 text-sm leading-6 text-cb-text">
          {article.sections.map((section) => (
            <section key={section.heading ?? section.paragraphs[0]}>
              {section.heading ? <h2 className="text-base font-medium tracking-tight">{section.heading}</h2> : null}
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)} className={section.heading ? "mt-3 text-cb-muted" : "text-cb-muted"}>
                  {paragraph}
                </p>
              ))}
              {section.bullets ? (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-cb-muted">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
        {article.related?.length ? (
          <ul className="mt-10 space-y-2 border-t border-cb-line pt-8 text-sm">
            {article.related.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-cb-accent hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/signup?plan=agency">Start the first report</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/report">View a sample</Link>
          </Button>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

export function LegalArticleView({ article }: { article: LegalArticle }) {
  return (
    <div className="min-h-screen bg-cb-bg">
      <JsonLd json={legalJsonLd(article.slug)} />
      <MarketingHeader />
      <main id="main" className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">{article.title}</h1>
        <p className="mt-2 text-xs text-cb-muted">Updated {article.updated}</p>
        <div className="mt-8 space-y-8 text-sm leading-6 text-cb-muted">
          {article.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-base font-medium tracking-tight text-cb-text">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="mt-3">
                  {paragraph}
                </p>
              ))}
              {section.bullets ? (
                <ul className="mt-3 list-disc space-y-2 pl-5">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>
        <p className="mt-10 text-sm text-cb-muted">Contact: support@getcitebrief.com</p>
      </main>
      <MarketingFooter />
    </div>
  );
}

export function staticArticlePage(path: string) {
  const article = articleByPath(path);
  return {
    metadata: article ? articleMetadata(article) : { title: "CiteBrief" },
    Page() {
      if (!article) notFound();
      return <PublicArticleView article={article} />;
    },
  };
}
