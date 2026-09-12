export type NotificationChannel = "IN_APP" | "EMAIL" | "SMS" | "WHATSAPP" | "PUSH";

export interface NotificationPayload {
  tenantId: string;
  restaurantId?: string;
  branchId?: string;
  recipientId: string;
  recipientContact?: string; // email, phone number, device token
  title: string;
  body: string;
  data?: Record<string, any>;
  channels: NotificationChannel[];
}

export interface NotificationDispatchResult {
  channel: NotificationChannel;
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface NotificationProvider {
  channel: NotificationChannel;
  send(payload: NotificationPayload): Promise<NotificationDispatchResult>;
}

export class MockEmailProvider implements NotificationProvider {
  channel: NotificationChannel = "EMAIL";
  public sentEmails: NotificationPayload[] = [];

  async send(payload: NotificationPayload): Promise<NotificationDispatchResult> {
    this.sentEmails.push(payload);
    return {
      channel: "EMAIL",
      success: true,
      messageId: `mock_email_${crypto.randomUUID()}`,
    };
  }
}

export class MockSMSProvider implements NotificationProvider {
  channel: NotificationChannel = "SMS";
  public sentSMS: NotificationPayload[] = [];

  async send(payload: NotificationPayload): Promise<NotificationDispatchResult> {
    this.sentSMS.push(payload);
    return {
      channel: "SMS",
      success: true,
      messageId: `mock_sms_${crypto.randomUUID()}`,
    };
  }
}

export class MockWhatsAppProvider implements NotificationProvider {
  channel: NotificationChannel = "WHATSAPP";
  public sentWhatsApp: NotificationPayload[] = [];

  async send(payload: NotificationPayload): Promise<NotificationDispatchResult> {
    this.sentWhatsApp.push(payload);
    return {
      channel: "WHATSAPP",
      success: true,
      messageId: `mock_wa_${crypto.randomUUID()}`,
    };
  }
}

export class MockPushProvider implements NotificationProvider {
  channel: NotificationChannel = "PUSH";
  public sentPush: NotificationPayload[] = [];

  async send(payload: NotificationPayload): Promise<NotificationDispatchResult> {
    this.sentPush.push(payload);
    return {
      channel: "PUSH",
      success: true,
      messageId: `mock_push_${crypto.randomUUID()}`,
    };
  }
}

export class NotificationService {
  private providers: Map<NotificationChannel, NotificationProvider> = new Map();
  public inAppNotifications: Array<NotificationPayload & { id: string; createdAt: Date; read: boolean }> = [];

  constructor() {
    this.registerProvider(new MockEmailProvider());
    this.registerProvider(new MockSMSProvider());
    this.registerProvider(new MockWhatsAppProvider());
    this.registerProvider(new MockPushProvider());
  }

  registerProvider(provider: NotificationProvider) {
    this.providers.set(provider.channel, provider);
  }

  getProvider<T extends NotificationProvider>(channel: NotificationChannel): T | undefined {
    return this.providers.get(channel) as T;
  }

  async send(payload: NotificationPayload): Promise<NotificationDispatchResult[]> {
    const results: NotificationDispatchResult[] = [];

    for (const channel of payload.channels) {
      if (channel === "IN_APP") {
        this.inAppNotifications.push({
          ...payload,
          id: crypto.randomUUID(),
          createdAt: new Date(),
          read: false,
        });
        results.push({
          channel: "IN_APP",
          success: true,
          messageId: `inapp_${crypto.randomUUID()}`,
        });
        continue;
      }

      const provider = this.providers.get(channel);
      if (!provider) {
        results.push({
          channel,
          success: false,
          error: `No provider registered for channel ${channel}`,
        });
        continue;
      }

      try {
        const res = await provider.send(payload);
        results.push(res);
      } catch (err: any) {
        results.push({
          channel,
          success: false,
          error: err?.message || "Provider dispatch failed",
        });
      }
    }

    return results;
  }
}

export const notificationService = new NotificationService();
