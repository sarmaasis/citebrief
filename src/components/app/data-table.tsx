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

export function Th({
  children,
  className,
  nowrap,
}: {
  children?: React.ReactNode;
  className?: string;
  nowrap?: boolean;
}) {
  return <th className={cn("px-4 font-medium", nowrap && "whitespace-nowrap", className)}>{children}</th>;
}

export function Td({
  children,
  className,
  truncate,
  nowrap,
  title,
}: {
  children?: React.ReactNode;
  className?: string;
  truncate?: boolean;
  nowrap?: boolean;
  title?: string;
}) {
  return (
    <td
      title={title}
      className={cn(
        "px-4 align-middle",
        truncate && "max-w-[220px] truncate",
        nowrap && "whitespace-nowrap",
        className,
      )}
    >
      {children}
    </td>
  );
}
