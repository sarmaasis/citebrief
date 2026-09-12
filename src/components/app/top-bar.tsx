import { Button } from "@/components/ui/button";

export function AppTopBar({ userLabel }: { userLabel: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-cb-line bg-cb-bg px-6">
      <div className="text-sm text-cb-muted">Brand switcher</div>
      <div className="flex items-center gap-3">
        <Button type="button">Run now</Button>
        <span className="text-sm text-cb-muted">{userLabel}</span>
      </div>
    </header>
  );
}
