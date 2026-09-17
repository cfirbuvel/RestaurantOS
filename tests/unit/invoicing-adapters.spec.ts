import { describe, it, expect, beforeEach } from "vitest";
import { MockGreenInvoiceAdapter } from "@/modules/integrations/invoicing/green-invoice-adapter";
import { MockRivhitAdapter } from "@/modules/integrations/invoicing/rivhit-adapter";
import { MockICountAdapter } from "@/modules/integrations/invoicing/icount-adapter";
import { UniversalInvoiceDTO } from "@/modules/integrations/domain/canonical-dtos";

describe("Fiscal Invoicing Adapters (Green Invoice, Rivhit, iCount)", () => {
  let greenInvoice: MockGreenInvoiceAdapter;
  let rivhit: MockRivhitAdapter;
  let icount: MockICountAdapter;

  const sampleInvoice: UniversalInvoiceDTO = {
    tenantId: "1b9ca808-44c7-4fec-b94f-05c133c959f0",
    branchId: "be7c3e30-b28b-4d23-9d78-b56b545351f5",
    orderId: "ord-test-555",
    invoiceType: "TAX_INVOICE",
    recipient: {
      name: "ישראל ישראלי",
      taxId: "012345678",
      email: "israel@example.com",
    },
    items: [
      {
        description: "המבורגר ארוחה עסקית",
        quantity: 2,
        unitPrice: 65.00,
        vatRate: 0.17, // 17% Israeli VAT
        totalAmount: 130.00,
      },
    ],
    subtotal: 111.11,
    vatAmount: 18.89,
    totalAmount: 130.00,
    currency: "ILS",
    metadata: {},
  };

  beforeEach(() => {
    greenInvoice = new MockGreenInvoiceAdapter();
    rivhit = new MockRivhitAdapter();
    icount = new MockICountAdapter();
  });

  it("Green Invoice: issues tax invoice with document number and PDF link", async () => {
    const res = await greenInvoice.createTaxInvoice(sampleInvoice);
    expect(res.success).toBe(true);
    expect(res.documentNumber).toMatch(/^GI-\d+/);
    expect(res.pdfUrl).toContain(".pdf");
    expect(res.documentType).toBe("TAX_INVOICE");
    expect(greenInvoice.issuedDocuments.length).toBe(1);
  });

  it("Green Invoice: issues receipt for paid transaction", async () => {
    const res = await greenInvoice.createReceipt(sampleInvoice);
    expect(res.success).toBe(true);
    expect(res.documentType).toBe("RECEIPT");
  });

  it("Rivhit: issues fiscal tax invoice and records document in mock ledger", async () => {
    const res = await rivhit.createTaxInvoice(sampleInvoice);
    expect(res.success).toBe(true);
    expect(res.documentNumber).toMatch(/^RIV-\d+/);
    expect(res.pdfUrl).toContain("mock.rivhit.co.il");
    expect(rivhit.issuedDocuments.length).toBe(1);
  });

  it("iCount: creates digital cloud receipt with encrypted link", async () => {
    const res = await icount.createReceipt(sampleInvoice);
    expect(res.success).toBe(true);
    expect(res.documentNumber).toMatch(/^IC-\d+/);
    expect(res.pdfUrl).toContain("mock.icount.co.il");
    expect(icount.issuedDocuments.length).toBe(1);
  });

  it("handles provider failure gracefully when upstream is unavailable", async () => {
    greenInvoice.simulateFailure = true;
    const res = await greenInvoice.createTaxInvoice(sampleInvoice);
    expect(res.success).toBe(false);
    expect(res.error).toContain("503 Service Unavailable");
  });
});
