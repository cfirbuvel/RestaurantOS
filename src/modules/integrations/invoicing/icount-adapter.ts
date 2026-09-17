import crypto from "crypto";
import { IInvoiceAdapter } from "./invoice-adapter";
import { UniversalInvoiceDTO, InvoiceResult } from "../domain/canonical-dtos";

export class ICountAdapter implements IInvoiceAdapter {
  readonly providerName = "ICOUNT" as const;

  constructor(
    protected cid: string = process.env.ICOUNT_CID || "mock-icount-cid",
    protected user: string = process.env.ICOUNT_USER || "mock-icount-user",
    protected pass: string = process.env.ICOUNT_PASS || "mock-icount-pass"
  ) {}

  async createTaxInvoice(invoice: UniversalInvoiceDTO): Promise<InvoiceResult> {
    return this.issueDoc(invoice, "inv");
  }

  async createReceipt(receipt: UniversalInvoiceDTO): Promise<InvoiceResult> {
    return this.issueDoc(receipt, "rec");
  }

  async createTaxInvoiceReceipt(doc: UniversalInvoiceDTO): Promise<InvoiceResult> {
    return this.issueDoc(doc, "invrec");
  }

  async createCreditNote(creditNote: UniversalInvoiceDTO): Promise<InvoiceResult> {
    return this.issueDoc(creditNote, "cinv");
  }

  async getInvoicePdfUrl(invoiceId: string): Promise<string> {
    return `https://api.icount.co.il/api/v3.php/doc/pdf?doc_id=${invoiceId}`;
  }

  protected async issueDoc(
    doc: UniversalInvoiceDTO,
    doctype: string
  ): Promise<InvoiceResult> {
    const docId = `icount-${crypto.randomUUID().slice(0, 8)}`;
    return {
      success: true,
      invoiceId: docId,
      documentNumber: `IC-${Date.now().toString().slice(-6)}`,
      pdfUrl: await this.getInvoicePdfUrl(docId),
      documentType: doctype,
      issuedAt: new Date().toISOString(),
    };
  }
}

export class MockICountAdapter extends ICountAdapter {
  public issuedDocuments: Array<{ docType: string; doc: UniversalInvoiceDTO; result: InvoiceResult }> = [];
  public simulateFailure: boolean = false;
  private docCounter: number = 3000;

  async issueDoc(
    doc: UniversalInvoiceDTO,
    doctype: string
  ): Promise<InvoiceResult> {
    if (this.simulateFailure) {
      return { success: false, error: "Simulated iCount authentication rejection" };
    }

    this.docCounter += 1;
    const docId = `icount-mock-${this.docCounter}`;
    const result: InvoiceResult = {
      success: true,
      invoiceId: docId,
      documentNumber: `IC-${this.docCounter}`,
      pdfUrl: `https://mock.icount.co.il/docs/${docId}.pdf`,
      documentType: doctype,
      issuedAt: new Date().toISOString(),
    };

    this.issuedDocuments.push({ docType: doctype, doc, result });
    return result;
  }
}
