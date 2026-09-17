import { WebhookIncomingCallPayload, WebhookCallStatusPayload } from "../domain/telephony";

export interface ITelephonyAdapter {
  readonly providerName: string;

  /**
   * Parse incoming vendor webhook payload into standard incoming call event
   */
  parseIncomingCallPayload(body: any): WebhookIncomingCallPayload;

  /**
   * Parse vendor status event payload into standard call status event
   */
  parseStatusPayload(body: any): WebhookCallStatusPayload;

  /**
   * Verify vendor signature / auth token for webhook security
   */
  verifyWebhookSignature(headers: Record<string, string | string[] | undefined>, body: any): boolean;
}

export class MockSIPAdapter implements ITelephonyAdapter {
  readonly providerName = "MOCK_SIP";

  parseIncomingCallPayload(body: any): WebhookIncomingCallPayload {
    return {
      sessionId: body.sessionId || body.call_id || body.CallSid || crypto.randomUUID(),
      callerNumber: body.callerNumber || body.from || body.From || body.caller || "",
      destinationNumber: body.destinationNumber || body.to || body.To,
      branchId: body.branchId,
      timestamp: body.timestamp || new Date().toISOString(),
      direction: (body.direction || "INBOUND").toUpperCase() as "INBOUND" | "OUTBOUND",
      metadata: body.metadata || {},
    };
  }

  parseStatusPayload(body: any): WebhookCallStatusPayload {
    return {
      sessionId: body.sessionId || body.call_id || body.CallSid || "",
      status: (body.status || body.CallStatus || "COMPLETED").toUpperCase() as any,
      operatorId: body.operatorId || body.agentId,
      durationSeconds: body.durationSeconds ? Number(body.durationSeconds) : 0,
      recordingUrl: body.recordingUrl || body.RecordingUrl,
      timestamp: body.timestamp || new Date().toISOString(),
      metadata: body.metadata || {},
    };
  }

  verifyWebhookSignature(headers: Record<string, string | string[] | undefined>, _body: any): boolean {
    // In mock/dev environment, allow all or verify custom mock token header if present
    const authHeader = headers["x-telephony-token"] || headers["authorization"];
    if (process.env.NODE_ENV === "test") return true;
    if (!authHeader) return true; // dev permissive
    return true;
  }
}
