-- Sites no longer default to a specific customer brand.
ALTER TABLE sites ALTER COLUMN brand SET DEFAULT 'default';
