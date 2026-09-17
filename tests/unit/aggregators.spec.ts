import { describe, it, expect, beforeEach } from "vitest";
import { MockWoltAdapter } from "@/modules/integrations/aggregators/wolt-adapter";
import { MockTenBisAdapter } from "@/modules/integrations/aggregators/tenbis-adapter";
import { MockMishlohaAdapter } from "@/modules/integrations/aggregators/mishloha-adapter";

describe("Delivery Aggregator Adapters (Wolt, 10bis, Mishloha)", () => {
  let wolt: MockWoltAdapter;
  let tenbis: MockTenBisAdapter;
  let mishloha: MockMishlohaAdapter;

  beforeEach(() => {
    wolt = new MockWoltAdapter("mock-wolt-key", "secret1");
    tenbis = new MockTenBisAdapter("mock-tb-key", "secret2");
    mishloha = new MockMishlohaAdapter("mock-mish-key", "secret3");
  });

  it("Wolt: transforms proprietary payload into UniversalExternalOrderDTO", () => {
    const raw = {
      order: {
        id: "w-999",
        venue_id: "venue-tlv",
        customer: { name: "דן מזרחי", phone_number: "050-1234567" },
        delivery: {
          type: "homedelivery",
          location: { street_address: "אלנבי 40", city: "תל אביב", coordinates: [34.77, 32.06] },
          instructions: "קומה 3 בלי מעלית",
        },
        items: [
          { id: "item-a", name: "שניצל בלחמנייה", count: 2, base_price: 4800, total_price: 9600 },
        ],
        price: { amount: 11000, currency: "ILS" },
        delivery_fee: { amount: 1400 },
      },
    };

    const dto = wolt.transformToCanonicalOrder(raw);
    expect(dto.provider).toBe("WOLT");
    expect(dto.externalOrderId).toBe("w-999");
    expect(dto.customer.name).toBe("דן מזרחי");
    expect(dto.customer.phone).toBe("050-1234567");
    expect(dto.financials.totalAmount).toBe(110.00);
    expect(dto.financials.deliveryFee).toBe(14.00);
    expect(dto.fulfillmentType).toBe("DELIVERY");
    expect(dto.items[0].name).toBe("שניצל בלחמנייה");
    expect(dto.items[0].quantity).toBe(2);
    expect(dto.items[0].unitPrice).toBe(48.00);
  });

  it("Wolt: dispatches outbound status update callback", async () => {
    const res = await wolt.sendOrderStatusUpdate("w-999", "IN_PREPARATION");
    expect(res.success).toBe(true);
    expect(wolt.statusUpdatesSent.length).toBe(1);
    expect(wolt.statusUpdatesSent[0].status).toBe("IN_PREPARATION");
  });

  it("10bis: transforms corporate order payload into UniversalExternalOrderDTO", () => {
    const raw = {
      Order: {
        OrderNumber: "tb-4567",
        ResId: "1234",
        CompanyName: "Amdocs Israel",
        CustomerName: "מיכל לוי",
        PhoneNumber: "054-7778899",
        TotalAmount: 85.50,
        DeliveryFee: 10.00,
        IsTakeaway: false,
        DeliveryAddress: {
          Street: "צומת רעננה",
          HouseNumber: "8",
          City: "רעננה",
        },
        Items: [
          { ItemId: "tb-dish-1", DishName: "פסטה שמנת פטריות", Quantity: 1, Price: 65.00 },
        ],
      },
    };

    const dto = tenbis.transformToCanonicalOrder(raw);
    expect(dto.provider).toBe("TENBIS");
    expect(dto.externalOrderId).toBe("tb-4567");
    expect(dto.customer.name).toBe("מיכל לוי");
    expect(dto.financials.totalAmount).toBe(85.50);
    expect(dto.financials.deliveryFee).toBe(10.00);
    expect(dto.rawMetadata.companyName).toBe("Amdocs Israel");
  });

  it("Mishloha: transforms delivery marketplace order into UniversalExternalOrderDTO", () => {
    const raw = {
      mishlohaOrder: {
        orderId: "mish-888",
        restaurantId: "rest-99",
        customer: {
          fullName: "גיל שחם",
          phoneNumber: "052-3334455",
          address: { street: "הארבעה", houseNumber: "16", city: "תל אביב" },
        },
        orderTotal: 120.00,
        deliveryPrice: 15.00,
        deliveryType: "DELIVERY",
        orderItems: [
          { itemId: "pizza-1", itemName: "פיצה מרגריטה", quantity: 2, price: 50.00 },
        ],
      },
    };

    const dto = mishloha.transformToCanonicalOrder(raw);
    expect(dto.provider).toBe("MISHLOHA");
    expect(dto.externalOrderId).toBe("mish-888");
    expect(dto.customer.name).toBe("גיל שחם");
    expect(dto.financials.totalAmount).toBe(120.00);
    expect(dto.financials.deliveryFee).toBe(15.00);
    expect(dto.items[0].name).toBe("פיצה מרגריטה");
    expect(dto.items[0].quantity).toBe(2);
  });
});
