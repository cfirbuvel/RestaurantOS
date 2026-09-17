import { TelephonyService, telephonyService } from "./services/telephony-service";
import { MockSIPAdapter } from "./adapters/mock-sip-adapter";

const globalForTelephony = globalThis as unknown as {
  telephonyService?: TelephonyService;
};

export const telephony = globalForTelephony.telephonyService ?? telephonyService;
globalForTelephony.telephonyService = telephony;

export * from "./domain/telephony";
export * from "./adapters/mock-sip-adapter";
export * from "./services/telephony-service";
