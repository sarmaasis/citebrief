import { redirect } from "next/navigation";

/** Legacy activity URL → Settings (failed runs live on Briefs / Home strip). */
export default function ActivityRedirect() {
  redirect("/app/settings");
}
