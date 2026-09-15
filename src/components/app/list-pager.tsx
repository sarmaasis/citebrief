import Link from "next/link";

export function ListPager({
  page,
  pageSize,
  total,
  hrefForPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefForPage: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center gap-3 text-sm" aria-label="Pagination">
      {page > 1 ? (
        <Link href={hrefForPage(page - 1)} className="text-cb-accent">
          Previous
        </Link>
      ) : (
        <span className="text-cb-muted">Previous</span>
      )}
      <span className="text-cb-muted">
        {page}/{pages}
      </span>
      {page < pages ? (
        <Link href={hrefForPage(page + 1)} className="text-cb-accent">
          Next
        </Link>
      ) : (
        <span className="text-cb-muted">Next</span>
      )}
    </nav>
  );
}
