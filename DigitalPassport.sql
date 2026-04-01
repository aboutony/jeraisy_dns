-- AXON Phase 5-A: Digital Passport & Onboarding Foundation SQL Schema
-- File: DigitalPassport.sql
-- Purpose: Define sovereign resource onboarding + V-Profile extension + compliance expiry tracking + V-Vault immutable documents.

-- 1) Workers base table extension (existing user/worker may already exist in normalized system)
CREATE TABLE IF NOT EXISTS axon_workers (
    worker_id SERIAL PRIMARY KEY,
    first_name VARCHAR(128) NOT NULL,
    last_name VARCHAR(128) NOT NULL,
    national_id VARCHAR(64) UNIQUE NOT NULL,
    trade_license VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- 2) Digital Passport core table
CREATE TABLE IF NOT EXISTS axon_digital_passports (
    passport_id SERIAL PRIMARY KEY,
    worker_id INT NOT NULL REFERENCES axon_workers(worker_id) ON DELETE CASCADE,
    v_profile_version VARCHAR(16) DEFAULT 'v1',
    specializations JSONB NOT NULL, -- e.g., ['electrical','HVAC','network']
    language_proficiency JSONB NOT NULL, -- e.g., {"english":"verified","arabic":"verified"}
    verified_bilingual BOOLEAN GENERATED ALWAYS AS (
        (language_proficiency->> 'english' = 'verified' AND language_proficiency->> 'arabic' = 'verified')
        OR (language_proficiency->> 'english' = 'verified' AND language_proficiency->> 'french' = 'verified')
    ) STORED,
    composite_score NUMERIC(5,2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3) Certification badges placeholder
CREATE TABLE IF NOT EXISTS axon_passport_badges (
    badge_id SERIAL PRIMARY KEY,
    passport_id INT NOT NULL REFERENCES axon_digital_passports(passport_id) ON DELETE CASCADE,
    badge_key VARCHAR(64) NOT NULL,
    badge_name VARCHAR(128) NOT NULL,
    awarded_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 4) TTI benchmarks per SKU placeholder
CREATE TABLE IF NOT EXISTS axon_passport_tti_benchmarks (
    benchmark_id SERIAL PRIMARY KEY,
    passport_id INT NOT NULL REFERENCES axon_digital_passports(passport_id) ON DELETE CASCADE,
    sku VARCHAR(64) NOT NULL,
    metric_name VARCHAR(64) NOT NULL,
    metric_value NUMERIC(8,4) NOT NULL,
    unit VARCHAR(16) NOT NULL DEFAULT '%',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5) V-Vault immutable document registry
CREATE TABLE IF NOT EXISTS axon_vvault_documents (
    document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id INT NULL REFERENCES axon_workers(worker_id) ON DELETE SET NULL,
    passport_id INT NULL REFERENCES axon_digital_passports(passport_id) ON DELETE CASCADE,
    document_type VARCHAR(64) NOT NULL,
    source VARCHAR(128) NOT NULL,
    vault_path TEXT NOT NULL,
    sha256_hash CHAR(64) NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NULL,
    immutable BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 6) Compliance expiry and V-Predict scheduling
CREATE TABLE IF NOT EXISTS axon_passport_compliance_events (
    compliance_id SERIAL PRIMARY KEY,
    passport_id INT NOT NULL REFERENCES axon_digital_passports(passport_id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES axon_vvault_documents(document_id) ON DELETE CASCADE,
    compliance_type VARCHAR(64) NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    last_alerted_at TIMESTAMPTZ NULL,
    -- Stored as the initial 90-day alert anchor. Dynamic tier (90/30/7-day) is resolved
    -- at query time via axon_vpredict_compliance_alerts view; this column tracks the
    -- last-known next scheduled alert for cron/job-queue targeting.
    next_alert_at TIMESTAMPTZ GENERATED ALWAYS AS (valid_until - INTERVAL '90 days') STORED
);

-- 7) Zone Classifications (toggle for dispatch constraints)
CREATE TABLE IF NOT EXISTS axon_zone_classifications (
    zone_id SERIAL PRIMARY KEY,
    zone_name VARCHAR(64) NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS axon_zone_breach_hardblocks (
    id SERIAL PRIMARY KEY,
    zone_id INT NOT NULL REFERENCES axon_zone_classifications(zone_id) ON DELETE CASCADE,
    work_order_priority VARCHAR(32) NOT NULL,
    requires_verified_bilingual BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8) Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION axon_updated_at_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS axon_digital_passport_updated_at ON axon_digital_passports;
CREATE TRIGGER axon_digital_passport_updated_at
BEFORE UPDATE ON axon_digital_passports
FOR EACH ROW EXECUTE FUNCTION axon_updated_at_trigger();

-- 9) V-Predict helper view for near-expiry alerts (90/30/7 days)
CREATE OR REPLACE VIEW axon_vpredict_compliance_alerts AS
SELECT
    c.compliance_id,
    c.passport_id,
    p.worker_id,
    c.compliance_type,
    c.valid_until,
    CASE
        WHEN c.valid_until - now() <= INTERVAL '7 days' THEN '7-day'
        WHEN c.valid_until - now() <= INTERVAL '30 days' THEN '30-day'
        WHEN c.valid_until - now() <= INTERVAL '90 days' THEN '90-day'
        ELSE NULL
    END AS alert_bucket,
    c.last_alerted_at,
    c.next_alert_at
FROM axon_passport_compliance_events c
JOIN axon_digital_passports p ON p.passport_id = c.passport_id
WHERE c.valid_until > now();
