import { UpgradePrompt } from "@/components/billing/upgrade-prompt";

/** Consistent locked / upgrade panel for trial vs paid module gates. */
export function LockedModule({
  title,
  line,
  upgradeTitle,
  upgradeBody,
  upgradeCta,
}: {
  title: string;
  line: string;
  upgradeTitle: string;
  upgradeBody: string;
  upgradeCta: string;
}) {
  return (
    <div className="min-w-0">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-sm text-cb-muted">{line}</p>
      <div className="mt-6 max-w-xl">
        <UpgradePrompt title={upgradeTitle} body={upgradeBody} cta={upgradeCta} />
      </div>
    </div>
  );
}
