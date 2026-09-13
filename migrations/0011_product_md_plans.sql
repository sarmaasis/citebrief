-- PRODUCT.md §11 / §18: Enterprise extras, premium engine pack, report approval + suggested email.

ALTER TABLE subscriptions ADD COLUMN premium_engine_pack INTEGER NOT NULL DEFAULT 0;

ALTER TABLE reports ADD COLUMN approval_state TEXT NOT NULL DEFAULT 'needs_review';
ALTER TABLE reports ADD COLUMN approved_at INTEGER;
ALTER TABLE reports ADD COLUMN approved_by_user_id TEXT;
ALTER TABLE reports ADD COLUMN suggested_email_subject TEXT;
ALTER TABLE reports ADD COLUMN suggested_email_body TEXT;

-- Existing reports were generated before approval existed; do not block historic sends.
UPDATE reports SET approval_state = 'approved' WHERE sent_at IS NOT NULL;
