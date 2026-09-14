-- Studio custom sender domain: manual DNS / Cloudflare Email checklist status.
-- Verification is owner-attested (no automatic DNS poll).

ALTER TABLE workspaces ADD COLUMN sender_domain_spf_ok INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workspaces ADD COLUMN sender_domain_dkim_ok INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workspaces ADD COLUMN sender_domain_dmarc_ok INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workspaces ADD COLUMN sender_domain_cf_ok INTEGER NOT NULL DEFAULT 0;
ALTER TABLE workspaces ADD COLUMN sender_domain_verified_at INTEGER;
