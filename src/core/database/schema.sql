-- RestaurantOS Phase 1 Canonical Schema
-- Supports multi-tenancy hierarchy, auth, sessions, RBAC, audit logging, outbox events, and feature flags.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Multi-Tenancy Hierarchy
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    brand_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_restaurant_org_slug UNIQUE (organization_id, slug)
);

CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    address JSONB NOT NULL DEFAULT '{}'::jsonb,
    phone VARCHAR(50),
    operational_settings JSONB NOT NULL DEFAULT '{
        "currency": "ILS",
        "timezone": "Asia/Jerusalem",
        "taxRate": 0.17,
        "prepTimeMinutes": 20
    }'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_branch_restaurant_slug UNIQUE (restaurant_id, slug)
);

-- 2. Identity & Access Management
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    pin_code_hash VARCHAR(255),
    pin_failed_attempts INT NOT NULL DEFAULT 0,
    pin_locked_until TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_org UNIQUE (user_id, organization_id)
);

CREATE TABLE IF NOT EXISTS user_branch_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_branch UNIQUE (user_id, branch_id)
);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    user_agent TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Immutable Audit Logging
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    actor_id UUID,
    actor_type VARCHAR(50) NOT NULL DEFAULT 'USER',
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Transactional Outbox Subsystem
CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL UNIQUE,
    event_type VARCHAR(150) NOT NULL,
    version VARCHAR(20) NOT NULL DEFAULT '1.0',
    tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    actor_id UUID,
    payload JSONB NOT NULL,
    correlation_id VARCHAR(100) NOT NULL,
    causation_id VARCHAR(100),
    published BOOLEAN NOT NULL DEFAULT FALSE,
    retry_count INT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);

-- 5. Hierarchical Feature Flags
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(100) NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    environment VARCHAR(50),
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for high performance queries
CREATE INDEX IF NOT EXISTS idx_restaurants_org ON restaurants(organization_id);
CREATE INDEX IF NOT EXISTS idx_branches_org_restaurant ON branches(organization_id, restaurant_id);
CREATE INDEX IF NOT EXISTS idx_user_branches_branch ON user_branch_assignments(branch_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox_events(published, created_at ASC) WHERE published = FALSE;
CREATE INDEX IF NOT EXISTS idx_feature_flags_lookup ON feature_flags(key, organization_id, restaurant_id, branch_id);

-- Enable RLS on Tenant-Scoped Tables
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS tenant_isolation_restaurants ON restaurants;
CREATE POLICY tenant_isolation_restaurants ON restaurants
    AS RESTRICTIVE
    USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_branches ON branches;
CREATE POLICY tenant_isolation_branches ON branches
    AS RESTRICTIVE
    USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_audit_logs ON audit_logs;
CREATE POLICY tenant_isolation_audit_logs ON audit_logs
    AS RESTRICTIVE
    USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR organization_id IS NULL)
    WITH CHECK (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_outbox ON outbox_events;
CREATE POLICY tenant_isolation_outbox ON outbox_events
    AS RESTRICTIVE
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid OR tenant_id IS NULL)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ============================================================================
-- Phase 2: CRM, Menu Catalog & Universal Orders
-- ============================================================================

CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    birthdate DATE,
    is_vip BOOLEAN NOT NULL DEFAULT FALSE,
    total_orders_count INT NOT NULL DEFAULT 0,
    total_spent_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    average_order_value NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    last_order_at TIMESTAMPTZ,
    internal_notes TEXT,
    allergies JSONB NOT NULL DEFAULT '[]'::jsonb,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_customer_tenant_phone UNIQUE (tenant_id, phone)
);

CREATE TABLE IF NOT EXISTS customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    street VARCHAR(255) NOT NULL,
    house_number VARCHAR(50) NOT NULL,
    entrance VARCHAR(50),
    floor VARCHAR(50),
    apartment VARCHAR(50),
    city VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20),
    gate_code VARCHAR(50),
    parking_instructions TEXT,
    delivery_notes TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS menu_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_category_tenant_slug UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_price NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'ILS',
    sku VARCHAR(100),
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    tax_rate NUMERIC(4, 2) NOT NULL DEFAULT 0.17,
    modifier_group_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price_adjustment NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    sku VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modifier_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    min_selection INT NOT NULL DEFAULT 0,
    max_selection INT NOT NULL DEFAULT 1,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS modifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    price_adjustment NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    order_number VARCHAR(100) NOT NULL,
    channel VARCHAR(50) NOT NULL DEFAULT 'WEB',
    order_type VARCHAR(50) NOT NULL DEFAULT 'DELIVERY',
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    payment_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    tip_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'ILS',
    notes TEXT,
    kitchen_notes TEXT,
    delivery_address_id UUID REFERENCES customer_addresses(id) ON DELETE SET NULL,
    estimated_ready_at TIMESTAMPTZ,
    actual_ready_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    external_order_id VARCHAR(100),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    variant_id UUID REFERENCES product_variants(id),
    name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(10, 2) NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL,
    notes TEXT,
    selected_modifiers JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Phase 3: Kitchen Display System (KDS) & Real-Time Ephemeral Tickets
-- ============================================================================

CREATE TABLE IF NOT EXISTS kds_stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    station_type VARCHAR(50) NOT NULL DEFAULT 'KITCHEN',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_station_branch_name UNIQUE (branch_id, name)
);

CREATE TABLE IF NOT EXISTS product_station_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    station_id UUID NOT NULL REFERENCES kds_stations(id) ON DELETE CASCADE,
    product_id VARCHAR(100),
    category_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kds_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    station_id UUID NOT NULL REFERENCES kds_stations(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_number VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    started_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    recalled_at TIMESTAMPTZ,
    cook_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kds_ticket_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ticket_id UUID NOT NULL REFERENCES kds_tickets(id) ON DELETE CASCADE,
    order_item_id VARCHAR(100) NOT NULL,
    product_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    notes TEXT,
    selected_modifiers JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS realtime_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket VARCHAR(255) NOT NULL UNIQUE,
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    role VARCHAR(50) NOT NULL,
    station_id UUID,
    channel VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for Phase 3
CREATE INDEX IF NOT EXISTS idx_kds_stations_branch ON kds_stations(branch_id);
CREATE INDEX IF NOT EXISTS idx_kds_tickets_station_status ON kds_tickets(station_id, status);
CREATE INDEX IF NOT EXISTS idx_kds_tickets_order ON kds_tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_kds_ticket_items_ticket ON kds_ticket_items(ticket_id);
CREATE INDEX IF NOT EXISTS idx_product_station_lookup ON product_station_assignments(branch_id, product_id, category_id);
CREATE INDEX IF NOT EXISTS idx_realtime_tickets_lookup ON realtime_tickets(ticket, expires_at);

-- RLS Policies for Phase 2 & 3
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE kds_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kds_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE kds_ticket_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_station_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE realtime_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_kds_stations ON kds_stations;
CREATE POLICY tenant_isolation_kds_stations ON kds_stations
    AS RESTRICTIVE
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_kds_tickets ON kds_tickets;
CREATE POLICY tenant_isolation_kds_tickets ON kds_tickets
    AS RESTRICTIVE
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_realtime_tickets ON realtime_tickets;
CREATE POLICY tenant_isolation_realtime_tickets ON realtime_tickets
    AS RESTRICTIVE
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ============================================================================
-- Phase 4: Delivery Management, Driver Availability Queue, Fleet & Batching
-- ============================================================================

CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    vehicle_type VARCHAR(50) NOT NULL DEFAULT 'SCOOTER',
    license_plate VARCHAR(50) NOT NULL,
    make VARCHAR(100),
    model VARCHAR(100),
    capacity INT NOT NULL DEFAULT 4,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_vehicle_plate UNIQUE (tenant_id, license_plate)
);

CREATE TABLE IF NOT EXISTS trackers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    provider VARCHAR(100) NOT NULL DEFAULT 'MOCK',
    provider_device_id VARCHAR(100) NOT NULL,
    external_device_id VARCHAR(100),
    battery_level INT DEFAULT 100,
    status VARCHAR(50) NOT NULL DEFAULT 'ONLINE',
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_tracker_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    tracker_id UUID NOT NULL REFERENCES trackers(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unassigned_at TIMESTAMPTZ,
    assigned_by UUID
);

CREATE TABLE IF NOT EXISTS driver_vehicle_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unassigned_at TIMESTAMPTZ,
    assigned_by UUID
);

CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shift_status VARCHAR(50) NOT NULL DEFAULT 'OFF_SHIFT',
    assignment_status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE',
    trip_status VARCHAR(50) NOT NULL DEFAULT 'NOT_STARTED',
    available_since TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    can_self_assign BOOLEAN NOT NULL DEFAULT TRUE,
    can_self_batch BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_driver_user UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'WAITING',
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    delivery_address JSONB NOT NULL DEFAULT '{}'::jsonb,
    customer_notes TEXT,
    delivery_notes TEXT,
    assigned_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    dispatched_at TIMESTAMPTZ,
    arrived_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    failure_reason TEXT,
    proof_of_delivery JSONB,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_assignment_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    previous_driver_id UUID,
    new_driver_id UUID,
    actor_type VARCHAR(50) NOT NULL,
    actor_id UUID,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    tracker_id UUID REFERENCES trackers(id) ON DELETE SET NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    accuracy_meters NUMERIC(6, 2) DEFAULT 5.0,
    speed_kmh NUMERIC(5, 2) DEFAULT 0.0,
    heading_degrees NUMERIC(5, 2) DEFAULT 0.0,
    recorded_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delivery_id UUID REFERENCES deliveries(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    distance_meters NUMERIC(10, 2) DEFAULT 0
);

CREATE TABLE IF NOT EXISTS delivery_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SUGGESTED',
    strategy VARCHAR(50) NOT NULL DEFAULT 'SMART_HEURISTIC',
    score NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
    scoring_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_batch_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES delivery_batches(id) ON DELETE CASCADE,
    delivery_id UUID NOT NULL REFERENCES deliveries(id) ON DELETE CASCADE,
    sequence_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS intelligence_decision_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    decision_type VARCHAR(100) NOT NULL DEFAULT 'DELIVERY_BATCH_RECOMMENDATION',
    candidate_delivery_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    candidate_driver_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommendation JSONB NOT NULL DEFAULT '{}'::jsonb,
    scoring_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    manager_action VARCHAR(50),
    actor_id UUID,
    rejection_reason TEXT,
    algorithm_version VARCHAR(50) NOT NULL DEFAULT 'gen1_heuristic_v1',
    model_version VARCHAR(50),
    final_outcome JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Indexes for Phase 4
CREATE INDEX IF NOT EXISTS idx_deliveries_branch_status ON deliveries(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_deliveries_driver ON deliveries(driver_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_order ON deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_drivers_queue ON drivers(branch_id, shift_status, assignment_status, available_since);
CREATE INDEX IF NOT EXISTS idx_vehicle_locations_lookup ON vehicle_locations(vehicle_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_trips_delivery ON vehicle_trips(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_batches_branch ON delivery_batches(branch_id, status);

-- RLS Policies for Phase 4
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trackers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_tracker_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_vehicle_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_assignment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_decision_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_deliveries ON deliveries;
CREATE POLICY tenant_isolation_deliveries ON deliveries
    AS RESTRICTIVE
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_drivers ON drivers;
CREATE POLICY tenant_isolation_drivers ON drivers
    AS RESTRICTIVE
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_vehicles ON vehicles;
CREATE POLICY tenant_isolation_vehicles ON vehicles
    AS RESTRICTIVE
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- ============================================================================
-- Phase 5: Inventory, Warehouses, Suppliers, Recipes (BOM) & Waste
-- ============================================================================

-- 1. Units of Measure & Conversions
CREATE TABLE IF NOT EXISTS units_of_measure (
    id VARCHAR(50) PRIMARY KEY,
    tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    dimension VARCHAR(50) NOT NULL, -- 'WEIGHT', 'VOLUME', 'UNIT', 'PACKAGE'
    base_unit_id VARCHAR(50),
    conversion_factor NUMERIC(14, 6) NOT NULL DEFAULT 1.0,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS unit_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    from_unit_id VARCHAR(50) NOT NULL REFERENCES units_of_measure(id),
    to_unit_id VARCHAR(50) NOT NULL REFERENCES units_of_measure(id),
    factor NUMERIC(14, 6) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Raw Ingredients & Items
CREATE TABLE IF NOT EXISTS ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    primary_unit_id VARCHAR(50) NOT NULL REFERENCES units_of_measure(id),
    storage_unit_id VARCHAR(50) NOT NULL REFERENCES units_of_measure(id),
    cost_per_unit NUMERIC(12, 4) NOT NULL DEFAULT 0.0,
    currency VARCHAR(10) NOT NULL DEFAULT 'ILS',
    minimum_stock_level NUMERIC(12, 4) NOT NULL DEFAULT 0.0,
    reorder_point NUMERIC(12, 4) NOT NULL DEFAULT 0.0,
    reorder_quantity NUMERIC(12, 4) NOT NULL DEFAULT 0.0,
    allergens JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ingredient_sku UNIQUE (tenant_id, sku)
);

-- 3. Warehouses & Storage Locations
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    warehouse_type VARCHAR(50) NOT NULL DEFAULT 'MAIN_WAREHOUSE', -- 'MAIN_WAREHOUSE', 'KITCHEN', 'WALK_IN_FREEZER', 'DRY_STORAGE', 'BAR', 'COMMISSARY'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS storage_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    zone VARCHAR(50),
    shelf VARCHAR(50),
    bin VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Inventory Stock Levels
CREATE TABLE IF NOT EXISTS inventory_stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity NUMERIC(14, 4) NOT NULL DEFAULT 0.0,
    reserved_quantity NUMERIC(14, 4) NOT NULL DEFAULT 0.0,
    available_quantity NUMERIC(14, 4) NOT NULL DEFAULT 0.0,
    last_counted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_warehouse_ingredient UNIQUE (warehouse_id, ingredient_id)
);

-- 5. Recipes & Bill of Materials (BOM)
CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    modifier_id UUID REFERENCES modifiers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    yield_portions NUMERIC(10, 2) NOT NULL DEFAULT 1.0,
    prep_time_minutes INTEGER NOT NULL DEFAULT 0,
    is_sub_recipe BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipe_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
    sub_recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
    quantity NUMERIC(14, 4) NOT NULL,
    unit_id VARCHAR(50) NOT NULL REFERENCES units_of_measure(id),
    yield_percentage NUMERIC(5, 2) NOT NULL DEFAULT 100.0, -- Account for prep waste
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Suppliers & Catalog
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    payment_terms VARCHAR(100),
    lead_time_days INTEGER NOT NULL DEFAULT 1,
    tax_id VARCHAR(50),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    supplier_sku VARCHAR(100),
    purchase_unit_id VARCHAR(50) NOT NULL REFERENCES units_of_measure(id),
    cost_price NUMERIC(12, 4) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'ILS',
    minimum_order_quantity NUMERIC(12, 4) NOT NULL DEFAULT 1.0,
    is_preferred BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Purchase Orders & Goods Receipts
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    destination_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    po_number VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'SUBMITTED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    currency VARCHAR(10) NOT NULL DEFAULT 'ILS',
    expected_delivery_date DATE,
    submitted_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    ordered_quantity NUMERIC(14, 4) NOT NULL,
    received_quantity NUMERIC(14, 4) NOT NULL DEFAULT 0.0,
    unit_id VARCHAR(50) NOT NULL REFERENCES units_of_measure(id),
    unit_price NUMERIC(12, 4) NOT NULL,
    total_price NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS goods_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    receipt_number VARCHAR(50) NOT NULL,
    idempotency_key VARCHAR(255) UNIQUE,
    received_by UUID REFERENCES users(id),
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
);

CREATE TABLE IF NOT EXISTS goods_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    goods_receipt_id UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity NUMERIC(14, 4) NOT NULL,
    unit_id VARCHAR(50) NOT NULL REFERENCES units_of_measure(id),
    unit_cost NUMERIC(12, 4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Immutable Stock Movements Ledger
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    source_warehouse_id UUID REFERENCES warehouses(id),
    destination_warehouse_id UUID REFERENCES warehouses(id),
    movement_type VARCHAR(50) NOT NULL, -- 'RECEIPT', 'SALE_DEPLETION', 'SALE_ROLLBACK', 'TRANSFER_OUT', 'TRANSFER_IN', 'WASTE', 'COUNT_ADJUSTMENT', 'RETURN'
    quantity NUMERIC(14, 4) NOT NULL,
    unit_id VARCHAR(50) NOT NULL REFERENCES units_of_measure(id),
    unit_cost NUMERIC(12, 4) NOT NULL DEFAULT 0.0,
    total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    reference_type VARCHAR(50), -- 'ORDER', 'PURCHASE_ORDER', 'TRANSFER', 'WASTE_REPORT', 'STOCK_TAKE', 'MANUAL'
    reference_id VARCHAR(255),
    idempotency_key VARCHAR(255) UNIQUE,
    actor_id UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Inventory Transfers
CREATE TABLE IF NOT EXISTS inventory_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    transfer_number VARCHAR(50) NOT NULL,
    source_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    destination_warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'REQUESTED', -- 'REQUESTED', 'APPROVED', 'IN_TRANSIT', 'COMPLETED', 'REJECTED'
    requested_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    dispatched_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    transfer_id UUID NOT NULL REFERENCES inventory_transfers(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity NUMERIC(14, 4) NOT NULL,
    unit_id VARCHAR(50) NOT NULL REFERENCES units_of_measure(id),
    received_quantity NUMERIC(14, 4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Waste Tracking & Spoilage
CREATE TABLE IF NOT EXISTS waste_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    quantity NUMERIC(14, 4) NOT NULL,
    unit_id VARCHAR(50) NOT NULL REFERENCES units_of_measure(id),
    waste_reason VARCHAR(50) NOT NULL, -- 'EXPIRED', 'SPOILED', 'PREP_MISTAKE', 'DROPPED', 'SPILLAGE', 'THEFT', 'SAMPLE'
    cost_impact NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    reported_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Stock Counts & Physical Inventory Reconciliation
CREATE TABLE IF NOT EXISTS inventory_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    count_number VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS', -- 'IN_PROGRESS', 'COMPLETED', 'RECONCILED', 'CANCELLED'
    counted_by UUID REFERENCES users(id),
    reconciled_by UUID REFERENCES users(id),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    reconciled_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_count_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    count_id UUID NOT NULL REFERENCES inventory_counts(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    system_quantity NUMERIC(14, 4) NOT NULL,
    counted_quantity NUMERIC(14, 4) NOT NULL,
    variance NUMERIC(14, 4) NOT NULL,
    unit_id VARCHAR(50) NOT NULL REFERENCES units_of_measure(id),
    unit_cost NUMERIC(12, 4) NOT NULL DEFAULT 0.0,
    variance_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.0,
    reconciled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for Phase 5
CREATE INDEX IF NOT EXISTS idx_inventory_stocks_wh ON inventory_stocks(warehouse_id, ingredient_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ing ON stock_movements(ingredient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ref ON stock_movements(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_recipes_product ON recipes(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier ON purchase_orders(supplier_id, status);
CREATE INDEX IF NOT EXISTS idx_waste_records_branch ON waste_records(branch_id, created_at DESC);

-- RLS Policies for Phase 5
ALTER TABLE units_of_measure ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE waste_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_count_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_ingredients ON ingredients;
CREATE POLICY tenant_isolation_ingredients ON ingredients
    AS RESTRICTIVE
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_warehouses ON warehouses;
CREATE POLICY tenant_isolation_warehouses ON warehouses
    AS RESTRICTIVE
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

DROP POLICY IF EXISTS tenant_isolation_stocks ON inventory_stocks;
CREATE POLICY tenant_isolation_stocks ON inventory_stocks
    AS RESTRICTIVE
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

