"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions, DialogCloseButton } from "@/components/ui/dialog";

export { UPGRADE_COPY } from "@/lib/upgrade-copy";

export function UpgradePrompt({
  title,
  body,
  cta,
  href = "/app/settings/billing",
  onDismiss,
}: {
  title: string;
  body: string;
  cta: string;
  href?: string;
  onDismiss?: () => void;
}) {
  return (
    <div className="min-w-0 rounded-cb-card border border-cb-line bg-cb-surface p-4">
      <p className="text-sm font-medium text-cb-text">{title}</p>
      <p className="mt-1 text-sm text-cb-muted">{body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm">
          <Link href={href}>{cta}</Link>
        </Button>
        {onDismiss ? (
          <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Use for click-triggered locks (extra run, brand cap) so tables and headers do not reflow. */
export function UpgradeDialog({
  open,
  onOpenChange,
  title,
  body,
  cta,
  href = "/app/settings/billing",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  cta: string;
  href?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={body}>
      <DialogActions>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
        <Button asChild size="sm">
          <Link href={href}>{cta}</Link>
        </Button>
      </DialogActions>
    </Dialog>
  );
}
