import { RISK_LABEL, type ClientRisk } from "@/lib/command-center";
import { StatusPill } from "@/components/ui/status-pill";

const STATUS: Record<ClientRisk, "named" | "queued" | "missing"> = {
  stable: "named",
  watch: "queued",
  at_risk: "missing",
};

export function RiskPill({ risk }: { risk: ClientRisk }) {
  return <StatusPill status={STATUS[risk]}>{RISK_LABEL[risk]}</StatusPill>;
}
