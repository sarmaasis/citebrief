import { MembersForm } from "@/components/settings/members-form";

export default function MembersPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Members</h1>
      <p className="mt-3 text-sm text-cb-muted">
        Invite account managers on Agency or Studio. Roles: owner, member.
      </p>
      <div className="mt-8">
        <MembersForm />
      </div>
    </div>
  );
}
