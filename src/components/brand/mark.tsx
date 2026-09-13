import { cn } from "@/lib/utils";

/** Forest-green paper brief. Shared by chrome, favicon, and app icons. */
export function CiteBriefMark({
  className,
  title,
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("h-6 w-6 shrink-0", className)}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <rect width="32" height="32" rx="7" fill="#0B3D2E" />
      <path
        d="M9.5 7.5h9.25L23 11.75V24.25A1.25 1.25 0 0 1 21.75 25.5h-12A1.25 1.25 0 0 1 8.5 24.25V8.75A1.25 1.25 0 0 1 9.5 7.5Z"
        fill="#FAFAF8"
      />
      <path d="M18.75 7.5 23 11.75h-3A1.25 1.25 0 0 1 18.75 10.5V7.5Z" fill="#C5D4CE" />
      <rect x="11" y="15.25" width="10" height="1.65" rx="0.825" fill="#0B3D2E" />
      <rect x="11" y="18.75" width="7" height="1.65" rx="0.825" fill="#0B3D2E" opacity="0.45" />
    </svg>
  );
}
