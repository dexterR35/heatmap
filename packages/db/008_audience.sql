-- Visitor country (ISO 3166-1 alpha-2) supplied by a trusted edge; the IP itself is never stored.
ALTER TABLE views ADD COLUMN IF NOT EXISTS country text CHECK (country IS NULL OR country ~ '^[A-Z]{2}$');
