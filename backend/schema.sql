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
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5) Compliance expiry tracking table
CREATE TABLE IF NOT EXISTS axon_compliance_expiry (
    expiry_id SERIAL PRIMARY KEY,
    worker_id INT NOT NULL REFERENCES axon_workers(worker_id) ON DELETE CASCADE,
    compliance_type VARCHAR(64) NOT NULL, -- e.g., 'medical_checkup', 'training_cert'
    expiry_date DATE NOT NULL,
    status VARCHAR(16) DEFAULT 'active' CHECK (status IN ('active','expired','renewed')),
    notification_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6) V-Vault immutable documents storage
CREATE TABLE IF NOT EXISTS axon_v_vault_documents (
    document_id SERIAL PRIMARY KEY,
    worker_id INT NOT NULL REFERENCES axon_workers(worker_id) ON DELETE CASCADE,
    document_type VARCHAR(64) NOT NULL, -- e.g., 'passport', 'license', 'certificate'
    document_hash VARCHAR(128) UNIQUE NOT NULL, -- SHA256 hash for immutability
    file_path VARCHAR(512) NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    verified BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 7) Zone classifications and breach handling
CREATE TABLE IF NOT EXISTS axon_zone_classifications (
    zone_id SERIAL PRIMARY KEY,
    zone_name VARCHAR(128) UNIQUE NOT NULL,
    classification_level VARCHAR(16) NOT NULL CHECK (classification_level IN ('low','medium','high','critical')),
    geofence_coordinates JSONB NOT NULL, -- GeoJSON polygon
    access_requirements JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8) Breach events logging
CREATE TABLE IF NOT EXISTS axon_zone_breaches (
    breach_id SERIAL PRIMARY KEY,
    worker_id INT NOT NULL REFERENCES axon_workers(worker_id),
    zone_id INT NOT NULL REFERENCES axon_zone_classifications(zone_id),
    breach_timestamp TIMESTAMPTZ DEFAULT NOW(),
    breach_type VARCHAR(32) NOT NULL, -- 'entry', 'exit', 'unauthorized_access'
    severity VARCHAR(16) DEFAULT 'medium',
    resolved BOOLEAN DEFAULT FALSE,
    resolution_notes TEXT,
    notified BOOLEAN DEFAULT FALSE
);

-- 9) Fleet vehicles management
CREATE TABLE IF NOT EXISTS axon_fleet_vehicles (
    vehicle_id SERIAL PRIMARY KEY,
    license_plate VARCHAR(32) UNIQUE NOT NULL,
    vehicle_type VARCHAR(64) NOT NULL,
    capacity INT NOT NULL,
    status VARCHAR(16) DEFAULT 'active' CHECK (status IN ('active','maintenance','retired')),
    last_maintenance DATE,
    next_maintenance DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10) Work orders and assignments
CREATE TABLE IF NOT EXISTS axon_work_orders (
    order_id SERIAL PRIMARY KEY,
    order_number VARCHAR(64) UNIQUE NOT NULL,
    title VARCHAR(256) NOT NULL,
    description TEXT,
    priority VARCHAR(16) DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
    status VARCHAR(16) DEFAULT 'pending' CHECK (status IN ('pending','assigned','in_progress','completed','cancelled')),
    assigned_worker_id INT REFERENCES axon_workers(worker_id),
    assigned_vehicle_id INT REFERENCES axon_fleet_vehicles(vehicle_id),
    location JSONB, -- GPS coordinates
    estimated_hours NUMERIC(6,2),
    actual_hours NUMERIC(6,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 11) GPS tracking logs
CREATE TABLE IF NOT EXISTS axon_gps_tracking (
    tracking_id SERIAL PRIMARY KEY,
    worker_id INT NOT NULL REFERENCES axon_workers(worker_id),
    latitude NUMERIC(10,8) NOT NULL,
    longitude NUMERIC(11,8) NOT NULL,
    accuracy NUMERIC(6,2),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    zone_id INT REFERENCES axon_zone_classifications(zone_id)
);

-- 12) Academy courses and certifications
CREATE TABLE IF NOT EXISTS axon_academy_courses (
    course_id SERIAL PRIMARY KEY,
    course_name VARCHAR(256) NOT NULL,
    course_code VARCHAR(32) UNIQUE NOT NULL,
    description TEXT,
    duration_hours INT NOT NULL,
    category VARCHAR(64),
    prerequisites JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13) Course enrollments
CREATE TABLE IF NOT EXISTS axon_course_enrollments (
    enrollment_id SERIAL PRIMARY KEY,
    worker_id INT NOT NULL REFERENCES axon_workers(worker_id),
    course_id INT NOT NULL REFERENCES axon_academy_courses(course_id),
    enrollment_date TIMESTAMPTZ DEFAULT NOW(),
    completion_date TIMESTAMPTZ,
    status VARCHAR(16) DEFAULT 'enrolled' CHECK (status IN ('enrolled','in_progress','completed','failed')),
    progress_percentage NUMERIC(5,2) DEFAULT 0.00,
    score NUMERIC(5,2)
);

-- 14) Certifications earned
CREATE TABLE IF NOT EXISTS axon_certifications (
    certification_id SERIAL PRIMARY KEY,
    worker_id INT NOT NULL REFERENCES axon_workers(worker_id),
    course_id INT NOT NULL REFERENCES axon_academy_courses(course_id),
    certification_number VARCHAR(64) UNIQUE,
    issued_date DATE NOT NULL,
    expiry_date DATE,
    status VARCHAR(16) DEFAULT 'active' CHECK (status IN ('active','expired','revoked')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15) Oracle CRM integration logs (for sync operations)
CREATE TABLE IF NOT EXISTS axon_oracle_sync_logs (
    sync_id SERIAL PRIMARY KEY,
    sync_type VARCHAR(32) NOT NULL, -- 'workers', 'orders', 'compliance'
    sync_timestamp TIMESTAMPTZ DEFAULT NOW(),
    records_processed INT DEFAULT 0,
    records_failed INT DEFAULT 0,
    error_message TEXT,
    status VARCHAR(16) DEFAULT 'completed' CHECK (status IN ('completed','failed','partial'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_axon_workers_national_id ON axon_workers(national_id);
CREATE INDEX IF NOT EXISTS idx_axon_digital_passports_worker_id ON axon_digital_passports(worker_id);
CREATE INDEX IF NOT EXISTS idx_axon_work_orders_status ON axon_work_orders(status);
CREATE INDEX IF NOT EXISTS idx_axon_gps_tracking_worker_timestamp ON axon_gps_tracking(worker_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_axon_compliance_expiry_date ON axon_compliance_expiry(expiry_date);
CREATE INDEX IF NOT EXISTS idx_axon_zone_breaches_timestamp ON axon_zone_breaches(breach_timestamp DESC);

-- Sample data insertion (optional, for testing)
-- INSERT INTO axon_workers (first_name, last_name, national_id, trade_license) VALUES ('John', 'Doe', '123456789', 'TL001');