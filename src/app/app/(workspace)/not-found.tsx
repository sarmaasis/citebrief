import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";

export default function WorkspaceNotFound() {
  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold tracking-tight">Not found</h1>
      <EmptyState line="That page is missing. Back to home to pick a brand." cta="Go to home" href="/app" />
      <p className="mt-4 text-sm text-cb-muted">
        Or <Link href="/app/brands" className="text-cb-accent">open brands</Link>.
      </p>
    </div>
  );
}
