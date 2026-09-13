import type { AppContext } from "@/lib/session";
import { jsonError } from "@/server/json";

export type WorkspaceRole = "owner" | "admin" | "member";

export function parseWorkspaceRole(value: string | null | undefined): WorkspaceRole {
  if (value === "owner") return "owner";
  if (value === "admin") return "admin";
  return "member";
}

export function canManageBilling(role: WorkspaceRole) {
  return role === "owner";
}

/** PRODUCT §5: owners invite members only. */
export function canInviteMembers(role: WorkspaceRole) {
  return role === "owner";
}

export function canManageSettings(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

export function canManageMembers(role: WorkspaceRole) {
  return role === "owner";
}

export function roleForbidden(message: string) {
  return jsonError(message, 403);
}

export function requireOwner(ctx: AppContext, message = "Only the workspace owner can do that.") {
  if (ctx.impersonating) return null;
  if (ctx.role === "owner") return null;
  return roleForbidden(message);
}

export function requireSettingsAccess(ctx: AppContext) {
  if (ctx.impersonating) return null;
  if (canManageSettings(ctx.role)) return null;
  return roleForbidden("Only owners and admins can change workspace settings.");
}
