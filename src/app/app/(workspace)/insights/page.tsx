import { redirect } from "next/navigation";

/** Legacy insights URL → This week Home. */
export default function InsightsRedirect() {
  redirect("/app");
}
