import { describe, it, expect, beforeEach } from "vitest";
import { memoryDb } from "@/core/database/db";
import { customerService } from "@/modules/crm/services/customer-service";

describe("CRM & Address Intelligence Subsystem", () => {
  const tenantA = "org-tenant-a-111";
  const tenantB = "org-tenant-b-222";

  beforeEach(() => {
    memoryDb.reset();
  });

  it("creates a customer and retrieves by ID and phone", async () => {
    const customer = await customerService.createCustomer(tenantA, {
      phone: "050-1112233",
      email: "avi@cohen.co.il",
      firstName: "אבי",
      lastName: "כהן",
      birthdate: "1985-03-20",
      internalNotes: "אוהב שולחן ליד החלון",
      allergies: ["גלוטן"],
      preferences: { spicy: false },
    });

    expect(customer).toBeDefined();
    expect(customer.id).toBeDefined();
    expect(customer.first_name).toBe("אבי");
    expect(customer.is_vip).toBe(false);

    // Retrieve by ID
    const retrieved = await customerService.getCustomerById(tenantA, customer.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.email).toBe("avi@cohen.co.il");

    // Retrieve by Phone
    const byPhone = await customerService.findByPhone(tenantA, "050-1112233");
    expect(byPhone?.id).toBe(customer.id);
  });

  it("prevents duplicate phone registration within the same tenant", async () => {
    await customerService.createCustomer(tenantA, {
      phone: "052-9998877",
      firstName: "רוני",
      lastName: "לוי",
    });

    await expect(
      customerService.createCustomer(tenantA, {
        phone: "052-9998877",
        firstName: "אחר",
        lastName: "לוי",
      })
    ).rejects.toThrow(/already exists/i);
  });

  it("enforces multi-tenant isolation: Tenant B cannot see Tenant A customers", async () => {
    const custA = await customerService.createCustomer(tenantA, {
      phone: "050-3334455",
      firstName: "שרה",
      lastName: "אהרוני",
    });

    // Tenant B cannot find by ID
    const findB = await customerService.getCustomerById(tenantB, custA.id);
    expect(findB).toBeNull();

    // Tenant B cannot find by Phone
    const findPhoneB = await customerService.findByPhone(tenantB, "050-3334455");
    expect(findPhoneB).toBeNull();

    // Tenant B can register same phone in their own independent tenant
    const custB = await customerService.createCustomer(tenantB, {
      phone: "050-3334455",
      firstName: "שרה ב",
      lastName: "אהרוני",
    });
    expect(custB.id).not.toBe(custA.id);
  });

  it("manages multiple addresses and enforces default address flag", async () => {
    const customer = await customerService.createCustomer(tenantA, {
      phone: "054-7778899",
      firstName: "יוסי",
      lastName: "ישראלי",
    });

    const addr1 = await customerService.addAddress(tenantA, customer.id, {
      street: "דיזנגוף",
      houseNumber: "100",
      floor: "2",
      apartment: "5",
      city: "תל אביב",
      gateCode: "1234",
      deliveryNotes: "להניח ליד השטיחון",
      isDefault: true,
    });

    const addr2 = await customerService.addAddress(tenantA, customer.id, {
      street: "הירקון",
      houseNumber: "20",
      city: "תל אביב",
      isDefault: true, // Should reset addr1 as default
    });

    const addresses = await customerService.getAddresses(tenantA, customer.id);
    expect(addresses).toHaveLength(2);

    const updatedAddr1 = addresses.find((a) => a.id === addr1.id);
    const updatedAddr2 = addresses.find((a) => a.id === addr2.id);

    expect(updatedAddr1?.is_default).toBe(false);
    expect(updatedAddr2?.is_default).toBe(true);
  });

  it("calculates customer LTV, average order value, and auto-upgrades to VIP", async () => {
    const customer = await customerService.createCustomer(tenantA, {
      phone: "058-1234567",
      firstName: "מיכל",
      lastName: "גולן",
    });

    expect(customer.is_vip).toBe(false);
    expect(customer.total_spent_amount).toBe(0);

    // Record 4 small orders
    await customerService.recordOrderCompleted(tenantA, customer.id, 50);
    await customerService.recordOrderCompleted(tenantA, customer.id, 50);
    await customerService.recordOrderCompleted(tenantA, customer.id, 50);
    await customerService.recordOrderCompleted(tenantA, customer.id, 50);

    let updated = await customerService.getCustomerById(tenantA, customer.id);
    expect(updated?.total_orders_count).toBe(4);
    expect(updated?.total_spent_amount).toBe(200);
    expect(updated?.average_order_value).toBe(50);
    expect(updated?.is_vip).toBe(false);

    // 5th order triggers VIP auto-upgrade
    await customerService.recordOrderCompleted(tenantA, customer.id, 60);
    updated = await customerService.getCustomerById(tenantA, customer.id);
    expect(updated?.total_orders_count).toBe(5);
    expect(updated?.total_spent_amount).toBe(260);
    expect(updated?.is_vip).toBe(true);
  });

  it("data minimization: DeliveryViewDTO strips customer financial and CRM history", async () => {
    const customer = await customerService.createCustomer(tenantA, {
      phone: "050-1234567",
      email: "secret@email.com",
      firstName: "ישראל",
      lastName: "ישראלי",
      internalNotes: "לקוח רגיש מאוד - מנהל בנק",
      allergies: ["אגוזים"],
    });

    const addr = await customerService.addAddress(tenantA, customer.id, {
      street: "בן יהודה",
      houseNumber: "55",
      entrance: "א",
      floor: "4",
      apartment: "15",
      city: "תל אביב",
      gateCode: "9876#",
      deliveryNotes: "להשאיר מחוץ לדלת",
      isDefault: true,
    });

    const deliveryView = await customerService.getDeliveryView(tenantA, customer.id, addr.id);

    // Must include operational delivery details
    expect(deliveryView.customerDisplayName).toBe("ישראל ישראלי");
    expect(deliveryView.deliveryAddress.street).toBe("בן יהודה");
    expect(deliveryView.deliveryAddress.houseNumber).toBe("55");
    expect(deliveryView.accessInstructions.gateCode).toBe("9876#");
    expect(deliveryView.deliveryNotes).toBe("להשאיר מחוץ לדלת");
    expect(deliveryView.contactPhoneMasked).toBe("050-***4567");

    // Must NOT expose private CRM fields
    expect((deliveryView as any).total_spent_amount).toBeUndefined();
    expect((deliveryView as any).total_orders_count).toBeUndefined();
    expect((deliveryView as any).average_order_value).toBeUndefined();
    expect((deliveryView as any).internal_notes).toBeUndefined();
    expect((deliveryView as any).email).toBeUndefined();
  });
});
