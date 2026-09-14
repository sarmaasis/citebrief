import { cn } from "@/lib/utils";

/** Scroll wrapper that keeps wide tables from blowing out the workspace shell. */
export function DataTable({
  children,
  className,
  minWidth = "640px",
}: {
  children: React.ReactNode;
  className?: string;
  minWidth?: string;
}) {
  return (
    <div className={cn("min-w-0 overflow-x-auto rounded-cb-card border border-cb-line bg-cb-surface", className)}>
      <table className="w-full text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 font-medium", className)}>{children}</th>;
}

export function Td({
  children,
  className,
  truncate,
}: {
  children?: React.ReactNode;
  className?: string;
  truncate?: boolean;
}) {
  return (
    <td className={cn("px-4", truncate && "max-w-[220px] truncate", className)}>{children}</td>
  );
}
