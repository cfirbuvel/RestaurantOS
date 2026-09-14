import { memoryDb, getPostgresPool } from "@/core/database/db";
import {
  Customer,
  CustomerAddress,
  DeliveryViewDTO,
  toDeliveryViewDTO,
} from "../domain/customer";

export class CustomerService {
  /**
   * Find customer by ID within tenant
   */
  async getCustomerById(tenantId: string, customerId: string): Promise<Customer | null> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const customers = memoryDb.find(
        "customers",
        (c: any) => c.id === customerId && c.tenant_id === tenantId && !c.deleted_at
      );
      return customers.length > 0 ? (customers[0] as Customer) : null;
    }

    const pool = getPostgresPool();
    const res = await pool.query(
      "SELECT * FROM customers WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [customerId, tenantId]
    );
    return res.rows.length > 0 ? (res.rows[0] as Customer) : null;
  }

  /**
   * Find customer by phone within tenant
   */
  async findByPhone(tenantId: string, phone: string): Promise<Customer | null> {
    const cleanPhone = phone.trim();
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const customers = memoryDb.find(
        "customers",
        (c: any) => c.phone === cleanPhone && c.tenant_id === tenantId && !c.deleted_at
      );
      return customers.length > 0 ? (customers[0] as Customer) : null;
    }

    const pool = getPostgresPool();
    const res = await pool.query(
      "SELECT * FROM customers WHERE phone = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [cleanPhone, tenantId]
    );
    return res.rows.length > 0 ? (res.rows[0] as Customer) : null;
  }

  /**
   * Search customers by phone, email, or name
   */
  async searchCustomers(
    tenantId: string,
    query: string,
    limit: number = 20
  ): Promise<Customer[]> {
    const q = query.toLowerCase().trim();
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const matches = memoryDb.find("customers", (c: any) => {
        if (c.tenant_id !== tenantId || c.deleted_at) return false;
        if (!q) return true;
        const fullName = `${c.first_name || ""} ${c.last_name || ""}`.toLowerCase();
        return (
          fullName.includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q))
        );
      });
      return matches.slice(0, limit) as Customer[];
    }

    const pool = getPostgresPool();
    const searchPattern = `%${q}%`;
    const res = await pool.query(
      `SELECT * FROM customers 
       WHERE tenant_id = $1 AND deleted_at IS NULL
         AND (phone ILIKE $2 OR email ILIKE $2 OR (first_name || ' ' || last_name) ILIKE $2)
       LIMIT $3`,
      [tenantId, searchPattern, limit]
    );
    return res.rows as Customer[];
  }

  /**
   * Create customer profile
   */
  async createCustomer(
    tenantId: string,
    input: {
      phone: string;
      email?: string | null;
      firstName: string;
      lastName: string;
      birthdate?: string | null;
      internalNotes?: string | null;
      allergies?: string[];
      preferences?: Record<string, any>;
    }
  ): Promise<Customer> {
    const existing = await this.findByPhone(tenantId, input.phone);
    if (existing) {
      throw new Error(`Customer with phone ${input.phone} already exists in this tenant`);
    }

    const customerRecord: Partial<Customer> = {
      tenant_id: tenantId,
      phone: input.phone.trim(),
      email: input.email ? input.email.toLowerCase().trim() : null,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      birthdate: input.birthdate || null,
      is_vip: false,
      total_orders_count: 0,
      total_spent_amount: 0.0,
      average_order_value: 0.0,
      last_order_at: null,
      internal_notes: input.internalNotes || null,
      allergies: input.allergies || [],
      preferences: input.preferences || {},
      version: 1,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      return memoryDb.insert("customers", customerRecord) as Customer;
    }

    const pool = getPostgresPool();
    const res = await pool.query(
      `INSERT INTO customers (
        tenant_id, phone, email, first_name, last_name, birthdate,
        is_vip, total_orders_count, total_spent_amount, average_order_value,
        internal_notes, allergies, preferences, version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        tenantId,
        customerRecord.phone,
        customerRecord.email,
        customerRecord.first_name,
        customerRecord.last_name,
        customerRecord.birthdate,
        false,
        0,
        0.0,
        0.0,
        customerRecord.internal_notes,
        JSON.stringify(customerRecord.allergies),
        JSON.stringify(customerRecord.preferences),
        1,
      ]
    );
    return res.rows[0] as Customer;
  }

  /**
   * Update customer profile
   */
  async updateCustomer(
    tenantId: string,
    customerId: string,
    updates: Partial<{
      email: string | null;
      firstName: string;
      lastName: string;
      birthdate: string | null;
      isVip: boolean;
      internalNotes: string | null;
      allergies: string[];
      preferences: Record<string, any>;
    }>
  ): Promise<Customer> {
    const customer = await this.getCustomerById(tenantId, customerId);
    if (!customer) throw new Error("Customer not found");

    const patch: any = { updated_at: new Date() };
    if (updates.email !== undefined) patch.email = updates.email;
    if (updates.firstName !== undefined) patch.first_name = updates.firstName;
    if (updates.lastName !== undefined) patch.last_name = updates.lastName;
    if (updates.birthdate !== undefined) patch.birthdate = updates.birthdate;
    if (updates.isVip !== undefined) patch.is_vip = updates.isVip;
    if (updates.internalNotes !== undefined) patch.internal_notes = updates.internalNotes;
    if (updates.allergies !== undefined) patch.allergies = updates.allergies;
    if (updates.preferences !== undefined) patch.preferences = updates.preferences;

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      return memoryDb.update("customers", customerId, patch) as Customer;
    }

    const pool = getPostgresPool();
    const res = await pool.query(
      `UPDATE customers SET 
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        email = COALESCE($3, email),
        birthdate = COALESCE($4, birthdate),
        is_vip = COALESCE($5, is_vip),
        internal_notes = COALESCE($6, internal_notes),
        updated_at = NOW()
       WHERE id = $7 AND tenant_id = $8
       RETURNING *`,
      [
        patch.first_name,
        patch.last_name,
        patch.email,
        patch.birthdate,
        patch.is_vip,
        patch.internal_notes,
        customerId,
        tenantId,
      ]
    );
    return res.rows[0] as Customer;
  }

  /**
   * Soft-delete customer
   */
  async deleteCustomer(tenantId: string, customerId: string): Promise<boolean> {
    const customer = await this.getCustomerById(tenantId, customerId);
    if (!customer) return false;

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.delete("customers", customerId);
      return true;
    }

    const pool = getPostgresPool();
    await pool.query("UPDATE customers SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2", [
      customerId,
      tenantId,
    ]);
    return true;
  }

  /**
   * Add address for customer
   */
  async addAddress(
    tenantId: string,
    customerId: string,
    input: {
      street: string;
      houseNumber: string;
      entrance?: string | null;
      floor?: string | null;
      apartment?: string | null;
      city: string;
      postalCode?: string | null;
      gateCode?: string | null;
      parkingInstructions?: string | null;
      deliveryNotes?: string | null;
      location?: { lat: number; lng: number } | null;
      isDefault?: boolean;
    }
  ): Promise<CustomerAddress> {
    const customer = await this.getCustomerById(tenantId, customerId);
    if (!customer) throw new Error("Customer not found");

    if (input.isDefault) {
      await this.resetDefaultAddresses(tenantId, customerId);
    }

    const addressRecord: Partial<CustomerAddress> = {
      tenant_id: tenantId,
      customer_id: customerId,
      street: input.street.trim(),
      house_number: input.houseNumber.trim(),
      entrance: input.entrance || null,
      floor: input.floor || null,
      apartment: input.apartment || null,
      city: input.city.trim(),
      postal_code: input.postalCode || null,
      gate_code: input.gateCode || null,
      parking_instructions: input.parkingInstructions || null,
      delivery_notes: input.deliveryNotes || null,
      location: input.location || null,
      is_default: input.isDefault ?? false,
      version: 1,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      return memoryDb.insert("customer_addresses", addressRecord) as CustomerAddress;
    }

    const pool = getPostgresPool();
    const res = await pool.query(
      `INSERT INTO customer_addresses (
        tenant_id, customer_id, street, house_number, entrance, floor,
        apartment, city, postal_code, gate_code, parking_instructions,
        delivery_notes, is_default, version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        tenantId,
        customerId,
        addressRecord.street,
        addressRecord.house_number,
        addressRecord.entrance,
        addressRecord.floor,
        addressRecord.apartment,
        addressRecord.city,
        addressRecord.postal_code,
        addressRecord.gate_code,
        addressRecord.parking_instructions,
        addressRecord.delivery_notes,
        addressRecord.is_default,
        1,
      ]
    );
    return res.rows[0] as CustomerAddress;
  }

  /**
   * Get all addresses for a customer
   */
  async getAddresses(tenantId: string, customerId: string): Promise<CustomerAddress[]> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      return memoryDb.find(
        "customer_addresses",
        (a: any) => a.customer_id === customerId && a.tenant_id === tenantId && !a.deleted_at
      ) as CustomerAddress[];
    }

    const pool = getPostgresPool();
    const res = await pool.query(
      "SELECT * FROM customer_addresses WHERE customer_id = $1 AND tenant_id = $2 AND deleted_at IS NULL ORDER BY is_default DESC, created_at ASC",
      [customerId, tenantId]
    );
    return res.rows as CustomerAddress[];
  }

  /**
   * Get delivery view DTO with data minimization
   */
  async getDeliveryView(
    tenantId: string,
    customerId: string,
    addressId?: string
  ): Promise<DeliveryViewDTO> {
    const customer = await this.getCustomerById(tenantId, customerId);
    if (!customer) throw new Error("Customer not found");

    let address: CustomerAddress | null = null;
    if (addressId) {
      if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
        const found = memoryDb.find(
          "customer_addresses",
          (a: any) => a.id === addressId && a.tenant_id === tenantId
        );
        address = found.length > 0 ? (found[0] as CustomerAddress) : null;
      } else {
        const pool = getPostgresPool();
        const res = await pool.query(
          "SELECT * FROM customer_addresses WHERE id = $1 AND tenant_id = $2",
          [addressId, tenantId]
        );
        address = res.rows.length > 0 ? (res.rows[0] as CustomerAddress) : null;
      }
    } else {
      const addresses = await this.getAddresses(tenantId, customerId);
      address = addresses.find((a) => a.is_default) || addresses[0] || null;
    }

    return toDeliveryViewDTO(customer, address);
  }

  /**
   * Record order completion for metrics (LTV, order count, VIP auto-upgrade)
   */
  async recordOrderCompleted(
    tenantId: string,
    customerId: string,
    orderAmount: number
  ): Promise<void> {
    const customer = await this.getCustomerById(tenantId, customerId);
    if (!customer) return;

    const newCount = (customer.total_orders_count || 0) + 1;
    const newTotalSpent = Number((customer.total_spent_amount || 0) + orderAmount);
    const newAov = Number((newTotalSpent / newCount).toFixed(2));
    const isVip = customer.is_vip || newCount >= 5 || newTotalSpent >= 500;

    const patch = {
      total_orders_count: newCount,
      total_spent_amount: newTotalSpent,
      average_order_value: newAov,
      last_order_at: new Date(),
      is_vip: isVip,
      updated_at: new Date(),
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.update("customers", customerId, patch);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `UPDATE customers SET
          total_orders_count = $1,
          total_spent_amount = $2,
          average_order_value = $3,
          last_order_at = NOW(),
          is_vip = $4,
          updated_at = NOW()
         WHERE id = $5 AND tenant_id = $6`,
        [newCount, newTotalSpent, newAov, isVip, customerId, tenantId]
      );
    }
  }

  private async resetDefaultAddresses(tenantId: string, customerId: string) {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const addresses = memoryDb.find(
        "customer_addresses",
        (a: any) => a.customer_id === customerId && a.tenant_id === tenantId
      );
      for (const a of addresses) {
        memoryDb.update("customer_addresses", a.id, { is_default: false });
      }
    } else {
      const pool = getPostgresPool();
      await pool.query(
        "UPDATE customer_addresses SET is_default = false WHERE customer_id = $1 AND tenant_id = $2",
        [customerId, tenantId]
      );
    }
  }
}

export const customerService = new CustomerService();
