import crypto from "crypto";
import { IInvoiceAdapter } from "./invoice-adapter";
import { UniversalInvoiceDTO, InvoiceResult } from "../domain/canonical-dtos";

export class RivhitAdapter implements IInvoiceAdapter {
  readonly providerName = "RIVHIT" as const;

  constructor(
    protected apiToken: string = process.env.RIVHIT_API_TOKEN || "mock-rivhit-token",
    protected groupId: string = process.env.RIVHIT_GROUP_ID || "mock-rivhit-group"
  ) {}

  async createTaxInvoice(invoice: UniversalInvoiceDTO): Promise<InvoiceResult> {
    return this.issueRivhitDocument(invoice, 1); // Rivhit document type 1 = Tax Invoice
  }

  async createReceipt(receipt: UniversalInvoiceDTO): Promise<InvoiceResult> {
    return this.issueRivhitDocument(receipt, 2); // Rivhit document type 2 = Receipt
  }

  async createTaxInvoiceReceipt(doc: UniversalInvoiceDTO): Promise<InvoiceResult> {
    return this.issueRivhitDocument(doc, 3); // Rivhit document type 3 = Tax Invoice Receipt
  }

  async createCreditNote(creditNote: UniversalInvoiceDTO): Promise<InvoiceResult> {
    return this.issueRivhitDocument(creditNote, 4); // Rivhit document type 4 = Credit Invoice
  }

  async getInvoicePdfUrl(invoiceId: string): Promise<string> {
    return `https://api.rivhit.co.il/online/service.svc/GetDocumentPDF?document_id=${invoiceId}`;
  }

  protected async issueRivhitDocument(
    doc: UniversalInvoiceDTO,
    documentType: number
  ): Promise<InvoiceResult> {
    const docId = `rivhit-${crypto.randomUUID().slice(0, 8)}`;
    return {
      success: true,
      invoiceId: docId,
      documentNumber: `RIV-${Date.now().toString().slice(-6)}`,
      pdfUrl: await this.getInvoicePdfUrl(docId),
      documentType: documentType.toString(),
      issuedAt: new Date().toISOString(),
    };
  }
}

export class MockRivhitAdapter extends RivhitAdapter {
  public issuedDocuments: Array<{ docType: number; doc: UniversalInvoiceDTO; result: InvoiceResult }> = [];
  public simulateFailure: boolean = false;
  private documentCounter: number = 2000;

  async issueRivhitDocument(
    doc: UniversalInvoiceDTO,
    documentType: number
  ): Promise<InvoiceResult> {
    if (this.simulateFailure) {
      return { success: false, error: "Simulated Rivhit server communication fault" };
    }

    this.documentCounter += 1;
    const docId = `rivhit-mock-${this.documentCounter}`;
    const result: InvoiceResult = {
      success: true,
      invoiceId: docId,
      documentNumber: `RIV-${this.documentCounter}`,
      pdfUrl: `https://mock.rivhit.co.il/pdf/${docId}`,
      documentType: documentType.toString(),
      issuedAt: new Date().toISOString(),
    };

    this.issuedDocuments.push({ docType: documentType, doc, result });
    return result;
  }
}
