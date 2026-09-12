# RestaurantOS — Normalized Multi-Tenant Database Schema DDL

**Document ID:** `DOC-SCHEMA-001`  
**Version:** `1.1.0`  
**Status:** Approved Canonical DDL  
**Database Engine:** PostgreSQL 16+ with `uuid-ossp` and `postgis` extensions  

---

## 1. Schema Overview & Global Enums

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- Core Enums
CREATE TYPE user_status AS ENUM ('ACTIVE', 'SUSPENDED', 'INVITED', 'DEACTIVATED');
CREATE TYPE order_channel AS ENUM ('WEB', 'POS', 'KIOSK', 'PHONE', 'WOLT', 'TENBIS', 'MISHLOHA', 'MANUAL');
CREATE TYPE order_type AS ENUM ('DINE_IN', 'TAKEAWAY', 'DELIVERY', 'DRIVE_THRU', 'CURBSIDE');

-- 1. Universal Order Status (Customer & Kitchen Lifecycle)
CREATE TYPE order_status AS ENUM (
    'DRAFT',
    'CONFIRMED',
    'ACCEPTED',
    'IN_PREPARATION',
    'READY',
    'COMPLETED',
    'CANCELLED',
    'FAILED'
);

-- 2. Delivery Logistics Status (Transport Lifecycle)
CREATE TYPE delivery_status AS ENUM (
    'WAITING',
    'PREPARING',
    'READY',
    'AVAILABLE_FOR_ASSIGNMENT',
    'ASSIGNED',
    'PICKED_UP',
    'OUT_FOR_DELIVERY',
    'ARRIVED_AT_CUSTOMER_AREA',
    'DELIVERED',
    'FAILED',
    'CANCELLED'
);

-- 3. Multidimensional Driver Status Enums
CREATE TYPE driver_shift_status AS ENUM ('OFF_SHIFT', 'ON_SHIFT', 'BREAK');
CREATE TYPE driver_assignment_status AS ENUM ('AVAILABLE', 'ASSIGNED');
CREATE TYPE driver_trip_status AS ENUM ('NOT_STARTED', 'IN_TRANSIT', 'AT_CUSTOMER', 'RETURNING');

-- 4. Fleet & Telematics Enums
CREATE TYPE vehicle_type AS ENUM ('BIKE', 'SCOOTER', 'SMALL_CAR', 'MEDIUM_CAR', 'LARGE_VAN', 'TRUCK');
CREATE TYPE vehicle_status AS ENUM ('ACTIVE', 'MAINTENANCE', 'RETIRED', 'OUT_OF_SERVICE');
CREATE TYPE tracker_status AS ENUM ('ONLINE', 'OFFLINE', 'LOW_BATTERY', 'TAMPERED', 'DEACTIVATED');
CREATE TYPE geofence_type AS ENUM ('RESTAURANT', 'CUSTOMER_AREA', 'CUSTOM_ZONE');
CREATE TYPE geofence_action AS ENUM ('ENTER', 'EXIT');

-- 5. Business Operations Enums
CREATE TYPE payment_status AS ENUM ('PENDING', 'AUTHORIZED', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED', 'VOIDED');
CREATE TYPE payment_method AS ENUM ('CREDIT_CARD', 'CASH', 'GIFT_CARD', 'TENBIS_CARD', 'WOLT_PAY', 'APPLE_PAY', 'GOOGLE_PAY', 'BANK_TRANSFER');
CREATE TYPE assignment_mode AS ENUM ('FIFO', 'FIFO_WITH_AREA', 'SMART_RECOMMENDATION', 'MANAGER_ONLY');
CREATE TYPE batch_status AS ENUM ('SUGGESTED', 'APPROVED', 'REJECTED', 'DISPATCHED', 'COMPLETED', 'CANCELLED');
CREATE TYPE kds_ticket_status AS ENUM ('QUEUED', 'STARTED', 'READY', 'BUMPED', 'RECALLED');
CREATE TYPE inventory_depletion_policy AS ENUM ('ON_ACCEPTED', 'ON_PREPARATION_START', 'ON_FULFILLMENT');
CREATE TYPE stock_movement_type AS ENUM ('ORDER_CONSUMPTION', 'MANUAL_ADJUSTMENT', 'PURCHASE_RECEIPT', 'WASTE_DISPOSAL', 'BRANCH_TRANSFER');
CREATE TYPE waste_reason AS ENUM ('EXPIRED', 'DROPPED', 'BURNT', 'PREP_ERROR', 'CUSTOMER_RETURN', 'DEFECTIVE_INGREDIENT');
```

---

## 2. Identity, Organizations & Multi-Tenancy

```sql
-- 1. Organizations (Top-level Tenant Root)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    legal_business_id VARCHAR(100),
    billing_email VARCHAR(255) NOT NULL,
    subscription_tier VARCHAR(50) NOT NULL DEFAULT 'ENTERPRISE',
    subscription_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    currency VARCHAR(3) NOT NULL DEFAULT 'ILS',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Jerusalem',
    inventory_depletion_policy inventory_depletion_policy NOT NULL DEFAULT 'ON_ACCEPTED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1
);

-- 2. Restaurants (Brand Layer)
CREATE TABLE restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    cuisine_type VARCHAR(100),
    logo_url TEXT,
    banner_url TEXT,
    website_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT uq_restaurant_slug UNIQUE (tenant_id, slug)
);

-- 3. Branches (Operational Execution Node)
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    street VARCHAR(255) NOT NULL,
    house_number VARCHAR(50) NOT NULL,
    city VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20),
    location GEOMETRY(Point, 4326),
    geofence_boundary GEOMETRY(Polygon, 4326),
    assignment_mode assignment_mode NOT NULL DEFAULT 'FIFO',
    self_assignment_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    batch_self_assignment_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    driver_release_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    driver_release_requires_manager BOOLEAN NOT NULL DEFAULT FALSE,
    automatic_queue_entry_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT uq_branch_code UNIQUE (tenant_id, code)
);

-- 4. Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255),
    full_name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    status user_status NOT NULL DEFAULT 'ACTIVE',
    two_factor_secret TEXT,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1
);

-- 5. Roles & Permissions
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_role_code UNIQUE (tenant_id, code)
);

CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 6. Employees
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id),
    pin_hash VARCHAR(255),
    can_self_assign_delivery BOOLEAN NOT NULL DEFAULT TRUE,
    can_self_assign_batch BOOLEAN NOT NULL DEFAULT TRUE,
    can_release_delivery BOOLEAN NOT NULL DEFAULT TRUE,
    can_accept_without_manager BOOLEAN NOT NULL DEFAULT TRUE,
    can_participate_in_driver_queue BOOLEAN NOT NULL DEFAULT TRUE,
    hourly_rate NUMERIC(10, 2),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT uq_employee_user_branch UNIQUE (branch_id, user_id)
);
```

---

## 3. Vehicles, Trackers & Fleet Telematics

```sql
-- 7. Vehicles (First-Class Asset)
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    vehicle_type vehicle_type NOT NULL DEFAULT 'SCOOTER',
    license_plate VARCHAR(50) NOT NULL,
    make VARCHAR(100),
    model VARCHAR(100),
    year INTEGER,
    status vehicle_status NOT NULL DEFAULT 'ACTIVE',
    max_order_capacity INTEGER NOT NULL DEFAULT 3,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT uq_vehicle_plate UNIQUE (tenant_id, license_plate)
);

-- 8. Trackers (IoT Telematics Hardware)
CREATE TABLE trackers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider VARCHAR(100) NOT NULL, -- e.g. 'TELTONIKA', 'QUECLINK', 'MOCK_TRACKER'
    provider_device_id VARCHAR(100) NOT NULL,
    imei VARCHAR(50) UNIQUE NOT NULL,
    status tracker_status NOT NULL DEFAULT 'ONLINE',
    battery_level NUMERIC(4, 1),
    firmware_version VARCHAR(50),
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT uq_tracker_provider_device UNIQUE (tenant_id, provider, provider_device_id)
);

-- 9. Driver ↔ Vehicle Temporal Assignment
CREATE TABLE driver_vehicle_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unassigned_at TIMESTAMPTZ,
    assigned_by UUID REFERENCES users(id),
    reason TEXT
);

-- 10. Vehicle ↔ Tracker Temporal Assignment
CREATE TABLE vehicle_tracker_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    tracker_id UUID NOT NULL REFERENCES trackers(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unassigned_at TIMESTAMPTZ,
    assigned_by UUID REFERENCES users(id)
);

-- 11. Vehicle Location Telemetry (Partitioned by Month)
CREATE TABLE vehicle_locations (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    vehicle_id UUID NOT NULL,
    tracker_id UUID NOT NULL,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    speed_kmh NUMERIC(5, 2),
    heading_degrees NUMERIC(5, 2),
    accuracy_meters NUMERIC(5, 2),
    battery_level NUMERIC(4, 1),
    recorded_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- 12. Vehicle Trips (Aggregated Lifecycle)
CREATE TABLE vehicle_trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delivery_id UUID, -- Optional direct link if trip is for single delivery
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    start_location GEOMETRY(Point, 4326),
    end_location GEOMETRY(Point, 4326),
    distance_meters INTEGER DEFAULT 0,
    duration_seconds INTEGER DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Geofence Events
CREATE TABLE geofence_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    geofence_type geofence_type NOT NULL,
    reference_id UUID, -- branch_id or customer_address_id
    action geofence_action NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 4. Universal Orders, CRM & KDS

```sql
-- 14. Customers
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    birthdate DATE,
    is_vip BOOLEAN NOT NULL DEFAULT FALSE,
    total_orders_count INTEGER NOT NULL DEFAULT 0,
    total_spent_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    average_order_value NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    last_order_at TIMESTAMPTZ,
    internal_notes TEXT,
    allergies JSONB DEFAULT '[]'::jsonb,
    preferences JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT uq_customer_phone UNIQUE (tenant_id, phone)
);

-- 15. Customer Addresses
CREATE TABLE customer_addresses (
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
    location GEOMETRY(Point, 4326),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1
);

-- 16. Universal Master Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id),
    order_number VARCHAR(50) NOT NULL,
    channel order_channel NOT NULL,
    order_type order_type NOT NULL,
    status order_status NOT NULL DEFAULT 'DRAFT',
    payment_status payment_status NOT NULL DEFAULT 'PENDING',
    subtotal NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    tax_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    tip_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'ILS',
    notes TEXT,
    kitchen_notes TEXT,
    estimated_ready_at TIMESTAMPTZ,
    actual_ready_at TIMESTAMPTZ,
    external_order_id VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    version INTEGER NOT NULL DEFAULT 1
);

-- 17. KDS Tickets
CREATE TABLE kds_stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE kds_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    station_id UUID NOT NULL REFERENCES kds_stations(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    ticket_number VARCHAR(50) NOT NULL,
    status kds_ticket_status NOT NULL DEFAULT 'QUEUED',
    priority INTEGER NOT NULL DEFAULT 0,
    target_prep_seconds INTEGER NOT NULL DEFAULT 900,
    started_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    bumped_at TIMESTAMPTZ,
    bumped_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 5. Delivery Logistics, Driver Queue & Smart Batches

```sql
-- 18. Driver Profiles (Multidimensional Status)
CREATE TABLE driver_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shift_status driver_shift_status NOT NULL DEFAULT 'OFF_SHIFT',
    assignment_status driver_assignment_status NOT NULL DEFAULT 'AVAILABLE',
    trip_status driver_trip_status NOT NULL DEFAULT 'NOT_STARTED',
    available_since TIMESTAMPTZ,
    queue_eligible BOOLEAN NOT NULL DEFAULT FALSE,
    active_deliveries_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT uq_driver_profile UNIQUE (branch_id, user_id)
);

-- 19. Deliveries (Independent Transport Lifecycle)
CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES driver_profiles(id),
    vehicle_id UUID REFERENCES vehicles(id),
    batch_id UUID, -- Defined in delivery_batches
    address_id UUID REFERENCES customer_addresses(id),
    status delivery_status NOT NULL DEFAULT 'WAITING',
    assignment_source VARCHAR(50), -- 'MANAGER', 'DRIVER_SELF_ASSIGN', 'SYSTEM_RECOMMENDATION', 'FUTURE_AGENT'
    estimated_distance_meters INTEGER,
    estimated_travel_seconds INTEGER,
    azimuth_degrees NUMERIC(6, 2),
    assigned_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    dispatched_at TIMESTAMPTZ,
    arrived_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    proof_of_delivery_url TEXT,
    proof_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1
);

-- 20. Delivery Batches
CREATE TABLE delivery_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES driver_profiles(id),
    vehicle_id UUID REFERENCES vehicles(id),
    status batch_status NOT NULL DEFAULT 'SUGGESTED',
    strategy VARCHAR(50) NOT NULL DEFAULT 'FIFO_AREA',
    batch_score NUMERIC(8, 4),
    scoring_breakdown JSONB DEFAULT '{}'::jsonb,
    max_wait_seconds INTEGER,
    route_summary JSONB DEFAULT '{}'::jsonb,
    estimated_savings NUMERIC(10, 2),
    sla_risk VARCHAR(20), -- 'LOW', 'MEDIUM', 'HIGH'
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approval_mode VARCHAR(50), -- 'MANUAL_MANAGER', 'DRIVER_SELF_ASSIGN', 'FORCE'
    decision_reason TEXT,
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    dispatched_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE deliveries ADD CONSTRAINT fk_deliveries_batch FOREIGN KEY (batch_id) REFERENCES delivery_batches(id);

-- 21. Decision / Intelligence Logging (Telemetry for Gen 2+ Training)
CREATE TABLE intelligence_decision_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    decision_type VARCHAR(100) NOT NULL, -- 'DELIVERY_BATCH_RECOMMENDATION'
    algorithm_version VARCHAR(50) NOT NULL DEFAULT '1.0.0-heuristic',
    policy_version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    model_version VARCHAR(50), -- NULL for Gen 1 heuristic
    candidate_inputs JSONB NOT NULL,
    recommended_output JSONB NOT NULL,
    heuristic_score NUMERIC(8, 4),
    human_action VARCHAR(50) NOT NULL, -- 'APPROVED', 'REJECTED', 'MODIFIED', 'FORCED'
    human_rejection_reason TEXT,
    actor_id UUID REFERENCES users(id),
    actual_outcome JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);
```
