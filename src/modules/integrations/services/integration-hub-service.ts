import { IAggregatorAdapter } from "../aggregators/aggregator-adapter";
import { WoltAdapter, MockWoltAdapter } from "../aggregators/wolt-adapter";
import { TenBisAdapter, MockTenBisAdapter } from "../aggregators/tenbis-adapter";
import { MishlohaAdapter, MockMishlohaAdapter } from "../aggregators/mishloha-adapter";
import { IInvoiceAdapter } from "../invoicing/invoice-adapter";
import { GreenInvoiceAdapter, MockGreenInvoiceAdapter } from "../invoicing/green-invoice-adapter";
import { RivhitAdapter, MockRivhitAdapter } from "../invoicing/rivhit-adapter";
import { ICountAdapter, MockICountAdapter } from "../invoicing/icount-adapter";
import { IPaymentGatewayAdapter } from "../payments/payment-gateway-adapter";
import { MeshulamAdapter, MockMeshulamAdapter } from "../payments/meshulam-adapter";
import { StripeAdapter, MockStripeAdapter } from "../payments/stripe-adapter";
import { integrationRetryQueue, IntegrationRetryQueue } from "../core/retry-queue";
import { integrationPipelineRunner, IntegrationPipelineRunner } from "../core/integration-pipeline";

export class IntegrationHubService {
  private static instance: IntegrationHubService;

  private aggregators: Map<string, IAggregatorAdapter> = new Map();
  private invoiceAdapters: Map<string, IInvoiceAdapter> = new Map();
  private paymentGateways: Map<string, IPaymentGatewayAdapter> = new Map();

  private constructor() {
    this.initializeDefaultAdapters();
  }

  static getInstance(): IntegrationHubService {
    if (!IntegrationHubService.instance) {
      IntegrationHubService.instance = new IntegrationHubService();
    }
    return IntegrationHubService.instance;
  }

  private initializeDefaultAdapters() {
    const isTest = process.env.NODE_ENV === "test" || !process.env.WOLT_API_KEY;

    // Aggregators
    this.aggregators.set("WOLT", isTest ? new MockWoltAdapter() : new WoltAdapter());
    this.aggregators.set("TENBIS", isTest ? new MockTenBisAdapter() : new TenBisAdapter());
    this.aggregators.set("MISHLOHA", isTest ? new MockMishlohaAdapter() : new MishlohaAdapter());

    // Invoicing
    this.invoiceAdapters.set("GREEN_INVOICE", isTest ? new MockGreenInvoiceAdapter() : new GreenInvoiceAdapter());
    this.invoiceAdapters.set("RIVHIT", isTest ? new MockRivhitAdapter() : new RivhitAdapter());
    this.invoiceAdapters.set("ICOUNT", isTest ? new MockICountAdapter() : new ICountAdapter());

    // Payments
    this.paymentGateways.set("MESHULAM", isTest ? new MockMeshulamAdapter() : new MeshulamAdapter());
    this.paymentGateways.set("STRIPE", isTest ? new MockStripeAdapter() : new StripeAdapter());
  }

  // ── Aggregators ────────────────────────────────────────────────────────────

  getAggregator(name: "WOLT" | "TENBIS" | "MISHLOHA" | string): IAggregatorAdapter {
    const key = name.toUpperCase();
    const adapter = this.aggregators.get(key);
    if (!adapter) {
      throw new Error(`Aggregator adapter not found for provider "${name}"`);
    }
    return adapter;
  }

  setAggregator(name: string, adapter: IAggregatorAdapter) {
    this.aggregators.set(name.toUpperCase(), adapter);
  }

  // ── Invoicing ──────────────────────────────────────────────────────────────

  getInvoiceAdapter(name: "GREEN_INVOICE" | "RIVHIT" | "ICOUNT" | string): IInvoiceAdapter {
    const key = name.toUpperCase();
    const adapter = this.invoiceAdapters.get(key);
    if (!adapter) {
      throw new Error(`Invoice adapter not found for provider "${name}"`);
    }
    return adapter;
  }

  setInvoiceAdapter(name: string, adapter: IInvoiceAdapter) {
    this.invoiceAdapters.set(name.toUpperCase(), adapter);
  }

  // ── Payments ───────────────────────────────────────────────────────────────

  getPaymentGateway(name: "MESHULAM" | "STRIPE" | string): IPaymentGatewayAdapter {
    const key = name.toUpperCase();
    const adapter = this.paymentGateways.get(key);
    if (!adapter) {
      throw new Error(`Payment gateway adapter not found for provider "${name}"`);
    }
    return adapter;
  }

  setPaymentGateway(name: string, adapter: IPaymentGatewayAdapter) {
    this.paymentGateways.set(name.toUpperCase(), adapter);
  }

  // ── Pipeline & Retry Facade ────────────────────────────────────────────────

  get pipeline(): IntegrationPipelineRunner {
    return integrationPipelineRunner;
  }

  get retryQueue(): IntegrationRetryQueue {
    return integrationRetryQueue;
  }

  reset() {
    this.initializeDefaultAdapters();
    this.retryQueue.reset();
  }
}

export const integrationHubService = IntegrationHubService.getInstance();
