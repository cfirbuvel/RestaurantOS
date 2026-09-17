# Green Invoice (חשבונית ירוקה / Morning) Integration Specification

**Status:** `SUPPORTED` | `MOCKED` (`MockGreenInvoiceAdapter`)  
**Environment Variables Required:**
- `GREEN_INVOICE_API_KEY` (`PENDING CREDENTIALS`)
- `GREEN_INVOICE_SECRET` (`PENDING CREDENTIALS`)
- `GREEN_INVOICE_API_URL` (Default: `https://api.greeninvoice.co.il/api/v1`)

---

## 1. Overview
Green Invoice provides legally recognized digital tax documents compliant with the Israel Tax Authority (רשות המסים).
- **Documents Supported:**
  - `TAX_INVOICE` (חשבונית מס - Type 305)
  - `RECEIPT` (קבלה - Type 400)
  - `TAX_INVOICE_RECEIPT` (חשבונית מס קבלה - Type 320)
  - `CREDIT_NOTE` (חשבונית זיכוי - Type 330)

## 2. VAT & Fiscal Rules
- Standard Israeli VAT rate (17%) calculated per line item.
- Generates signed PDF URL for customer receipts and fiscal audit records.
