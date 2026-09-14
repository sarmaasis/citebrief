"use client";

import { useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-[color:var(--cb-overlay)]"
        onClick={() => onOpenChange(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full max-w-md rounded-cb-panel border border-cb-line bg-cb-surface p-5 shadow-cb-menu outline-none",
          className,
        )}
      >
        <h2 id={titleId} className="text-base font-medium text-cb-text">
          {title}
        </h2>
        {description ? (
          <p id={descriptionId} className="mt-1 text-sm text-cb-muted">
            {description}
          </p>
        ) : null}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function DialogActions({ children }: { children: React.ReactNode }) {
  return <div className="mt-5 flex flex-wrap justify-end gap-2">{children}</div>;
}

export function DialogCloseButton({ onClick, label = "Cancel" }: { onClick: () => void; label?: string }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick}>
      {label}
    </Button>
  );
}
