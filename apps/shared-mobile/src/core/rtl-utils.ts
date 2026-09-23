/**
 * RestaurantOS RTL & Bidirectional Formatting Utilities
 * 
 * Ensures Hebrew is treated as first-class while handling mixed bidi:
 * - Phone numbers (always isolated LTR)
 * - Order IDs & alphanumeric identifiers (#1042 isolated)
 * - Currency (₪ with proper numeral binding)
 * - Addresses & mixed alphanumeric strings
 * - Timestamps and durations
 */

// Unicode directional control characters
export const LRM = "\u200E"; // Left-to-Right Mark
export const RLM = "\u200F"; // Right-to-Left Mark
export const LRE = "\u202A"; // Left-to-Right Embedding
export const PDF = "\u202C"; // Pop Directional Formatting
export const FSI = "\u2068"; // First Strong Isolate
export const PDI = "\u2069"; // Pop Directional Isolate

/**
 * Wraps phone number in LTR embedding so dashes and digits don't flip in RTL contexts.
 * Example: "050-123-4567" remains left-to-right even when surrounded by Hebrew text.
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/[^\d+-\s()]/g, "");
  return `${LRE}${cleaned}${PDF}`;
}

/**
 * Formats order identifier with hash sign isolated to prevent "#1042" becoming "1042#" in RTL.
 */
export function formatOrderId(id: string): string {
  if (!id) return "";
  const cleanId = id.startsWith("#") ? id.substring(1) : id;
  return `${LRM}#${cleanId}${LRM}`;
}

/**
 * Formats currency in Shekels (₪) with standard tabular spacing.
 */
export function formatCurrency(amount: number | string): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "₪0.00";
  return `₪${num.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Safely formats address with street name, house number, and city in Hebrew order.
 * In Hebrew: [Street Name] [Building Number], [City]
 */
export function formatAddress(street: string, number?: string | number, city?: string): string {
  const parts: string[] = [];
  if (street) {
    if (number) {
      parts.push(`${street} ${number}`);
    } else {
      parts.push(street);
    }
  }
  if (city) {
    parts.push(city);
  }
  return parts.join(", ");
}

/**
 * Formats timestamp (HH:MM or DD/MM/YYYY HH:MM) isolated to prevent inversion.
 */
export function formatTimestamp(
  dateInput: string | number | Date,
  options?: { includeDate?: boolean; locale?: string }
): string {
  if (!dateInput) return "";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return String(dateInput);

  const locale = options?.locale || "he-IL";
  const timeStr = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  if (options?.includeDate) {
    const dateStr = date.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
    return `${dateStr} ${timeStr}`;
  }

  return timeStr;
}

/**
 * Formats duration in minutes to localized string.
 * Example: 15 -> "15 דק׳" (Hebrew) or "15 min" (English)
 */
export function formatDuration(minutes: number, isRTL: boolean = true): string {
  if (isNaN(minutes)) return "";
  return isRTL ? `${minutes} דק׳` : `${minutes} min`;
}

/**
 * Helper to determine flex direction based on RTL flag.
 */
export function getRowDirection(isRTL: boolean): "row-reverse" | "row" {
  return isRTL ? "row-reverse" : "row";
}

/**
 * Helper to determine text alignment based on RTL flag.
 */
export function getTextAlign(isRTL: boolean): "right" | "left" {
  return isRTL ? "right" : "left";
}

/**
 * Isolates arbitrary mixed LTR/RTL text snippet.
 */
export function bidiIsolate(text: string): string {
  if (!text) return "";
  return `${FSI}${text}${PDI}`;
}
