import { UniversalInvoiceDTO, InvoiceResult } from "../domain/canonical-dtos";

export interface IInvoiceAdapter {
  readonly providerName: "GREEN_INVOICE" | "RIVHIT" | "ICOUNT";

  /**
   * Issue a digital tax invoice (חשבונית מס)
   */
  createTaxInvoice(invoice: UniversalInvoiceDTO): Promise<InvoiceResult>;

  /**
   * Issue an official receipt (קבלה)
   */
  createReceipt(receipt: UniversalInvoiceDTO): Promise<InvoiceResult>;

  /**
   * Issue combined tax invoice receipt (חשבונית מס קבלה)
   */
  createTaxInvoiceReceipt(doc: UniversalInvoiceDTO): Promise<InvoiceResult>;

  /**
   * Issue a credit note / refund document (חשבונית זיכוי)
   */
  createCreditNote(creditNote: UniversalInvoiceDTO): Promise<InvoiceResult>;

  /**
   * Retrieve signed PDF URL for customer download or printing
   */
  getInvoicePdfUrl(invoiceId: string): Promise<string>;
}
