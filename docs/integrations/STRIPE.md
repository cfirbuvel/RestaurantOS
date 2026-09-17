# Stripe Global Payments Integration Specification

**Status:** `SUPPORTED` | `MOCKED` (`MockStripeAdapter`)  
**Environment Variables Required:**
- `STRIPE_SECRET_KEY` (`PENDING CREDENTIALS`)
- `STRIPE_WEBHOOK_SECRET` (`PENDING CREDENTIALS`)

---

## 1. Overview
Stripe handles international credit cards, Apple Pay, Google Pay, and multi-currency billing (ILS, USD, EUR).
- **Capabilities:**
  - PaymentIntent creation & immediate capture or authorization
  - Customer payment method tokenization (`pm_...`)
  - Webhook signature verification (`Stripe-Signature`)
  - Full and partial refund processing
