-- Real sites go live only through an audited owner approval that records the reviewed consent policy.
ALTER TABLE sites ADD COLUMN IF NOT EXISTS consent_policy_version text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS approved_at timestamptz;
