import crypto from "crypto";
import { IInvoiceAdapter } from "./invoice-adapter";
import { UniversalInvoiceDTO, InvoiceResult } from "../domain/canonical-dtos";

export class GreenInvoiceAdapter implements IInvoiceAdapter {
  readonly providerName = "GREEN_INVOICE" as const;

  constructor(
    protected apiKey: string = process.env.GREEN_INVOICE_API_KEY || "mock-green-key",
    protected secret: string = process.env.GREEN_INVOICE_SECRET || "mock-green-secret"
  ) {}

  async createTaxInvoice(invoice: UniversalInvoiceDTO): Promise<InvoiceResult> {
    return this.issueDocument(invoice, "TAX_INVOICE");
  }

  async createReceipt(receipt: UniversalInvoiceDTO): Promise<InvoiceResult> {
    return this.issueDocument(receipt, "RECEIPT");
  }

  async createTaxInvoiceReceipt(doc: UniversalInvoiceDTO): Promise<InvoiceResult> {
    return this.issueDocument(doc, "TAX_INVOICE_RECEIPT");
  }

  async createCreditNote(creditNote: UniversalInvoiceDTO): Promise<InvoiceResult> {
    return this.issueDocument(creditNote, "CREDIT_NOTE");
  }

  async getInvoicePdfUrl(invoiceId: string): Promise<string> {
    return `https://api.greeninvoice.co.il/v1/documents/public/${invoiceId}/pdf`;
  }

  protected async issueDocument(
    doc: UniversalInvoiceDTO,
    docType: string
  ): Promise<InvoiceResult> {
    // In production, make HTTP POST to Green Invoice API
    if (process.env.NODE_ENV === "production" && process.env.GREEN_INVOICE_API_URL) {
      try {
        const payload = {
          type: docType === "TAX_INVOICE" ? 305 : docType === "RECEIPT" ? 400 : 320,
          client: {
            name: doc.recipient.name,
            taxId: doc.recipient.taxId,
            emails: doc.recipient.email ? [doc.recipient.email] : [],
            phone: doc.recipient.phone,
            address: doc.recipient.address,
          },
          income: doc.items.map((it) => ({
            description: it.description,
            quantity: it.quantity,
            price: it.unitPrice,
            vatRate: it.vatRate,
          })),
          remarks: `Order ref: ${doc.orderId || "N/A"}`,
        };

        const res = await fetch(`${process.env.GREEN_INVOICE_API_URL}/documents`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          return {
            success: false,
            error: `Green Invoice API error: ${errData.message || res.statusText}`,
          };
        }

        const data = await res.json();
        return {
          success: true,
          invoiceId: data.id,
          documentNumber: data.number,
          pdfUrl: data.url?.pdf,
          documentType: docType,
          issuedAt: data.created_at || new Date().toISOString(),
          rawResponse: data,
        };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    }

    // Default mock response
    const docId = `ginv-${crypto.randomUUID().slice(0, 8)}`;
    return {
      success: true,
      invoiceId: docId,
      documentNumber: `GI-${Date.now().toString().slice(-6)}`,
      pdfUrl: await this.getInvoicePdfUrl(docId),
      documentType: docType,
      issuedAt: new Date().toISOString(),
    };
  }
}

export class MockGreenInvoiceAdapter extends GreenInvoiceAdapter {
  public issuedDocuments: Array<{ docType: string; doc: UniversalInvoiceDTO; result: InvoiceResult }> = [];
  public simulateFailure: boolean = false;
  private documentCounter: number = 1000;

  async issueDocument(
    doc: UniversalInvoiceDTO,
    docType: string
  ): Promise<InvoiceResult> {
    if (this.simulateFailure) {
      return {
        success: false,
        error: "Simulated Green Invoice API timeout (503 Service Unavailable)",
      };
    }

    this.documentCounter += 1;
    const docId = `ginv-mock-${this.documentCounter}`;
    const result: InvoiceResult = {
      success: true,
      invoiceId: docId,
      documentNumber: `GI-${this.documentCounter}`,
      pdfUrl: `https://mock.greeninvoice.co.il/download/${docId}.pdf`,
      documentType: docType,
      issuedAt: new Date().toISOString(),
    };

    this.issuedDocuments.push({ docType, doc, result });
    return result;
  }
}
