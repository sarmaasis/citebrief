import { cn } from "@/lib/utils";

export type FormNotice = {
  type: "success" | "error";
  text: string;
};

export function FormNoticeText({ notice, className }: { notice: FormNotice | null; className?: string }) {
  if (!notice) return null;
  return (
    <p className={cn("text-sm", notice.type === "error" ? "text-cb-danger" : "text-cb-muted", className)}>
      {notice.text}
    </p>
  );
}
