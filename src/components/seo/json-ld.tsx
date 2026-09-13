export function JsonLd({ json }: { json: unknown }) {
  const serialized = JSON.stringify(json).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialized }} />;
}
