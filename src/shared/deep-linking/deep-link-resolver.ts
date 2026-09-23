/**
 * Canonical Deep Link Parser & Router
 *
 * Implements Prompt 17 Section 4: Deep Links & Equivalent Web / Mobile Routing.
 * Pure platform-neutral implementation (Node.js, Web, React Native).
 */

import {
  DEEP_LINK_SCHEME,
  ParsedDeepLink,
  DeepLinkResolution,
  WebRouteResolution,
  ManagerAppRouteResolution,
  DriverAppRouteResolution,
  KDSRouteResolution,
} from "../contracts/deep-linking";
import { TargetEntityType } from "../contracts/notifications";

const ID_VALIDATION_REGEX = /^[a-zA-Z0-9_-]+$/;

export class DeepLinkResolver {
  /**
   * Check if a URI matches the canonical restaurantos:// scheme
   */
  static isValid(uri: string): boolean {
    try {
      this.parse(uri);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parse a raw deep link URI into canonical components
   * Supports format:
   *  - restaurantos://delivery/{id}
   *  - restaurantos://order/{id}
   *  - restaurantos://kds/ticket/{id}
   *  - restaurantos://driver/{id}
   *  - restaurantos://alert/{id}
   */
  static parse(rawUri: string): ParsedDeepLink {
    if (!rawUri || typeof rawUri !== "string") {
      throw new Error("Deep link URI must be a non-empty string");
    }

    const trimmed = rawUri.trim();
    const schemePrefix = `${DEEP_LINK_SCHEME}://`;

    if (!trimmed.startsWith(schemePrefix)) {
      throw new Error(`Invalid deep link scheme. Expected '${schemePrefix}', received: ${trimmed}`);
    }

    const withoutScheme = trimmed.slice(schemePrefix.length);
    const [pathPart, queryPart] = withoutScheme.split("?");

    const segments = pathPart.split("/").filter(Boolean);
    if (segments.length === 0) {
      throw new Error("Missing target entity in deep link URI");
    }

    let entity: string;
    let targetEntityType: TargetEntityType;
    let targetId: string;
    let subPath: string | undefined;

    // Handle compound paths like kds/ticket/{id}
    if (segments[0] === "kds" && segments[1] === "ticket") {
      if (segments.length < 3) {
        throw new Error("Missing ticket ID for kds/ticket deep link");
      }
      entity = "kds/ticket";
      targetEntityType = "KDS_TICKET";
      targetId = segments[2];
    } else {
      entity = segments[0];
      if (segments.length < 2) {
        throw new Error(`Missing target ID for entity '${entity}'`);
      }
      targetId = segments[1];

      switch (entity) {
        case "delivery":
          targetEntityType = "DELIVERY";
          break;
        case "order":
          targetEntityType = "ORDER";
          break;
        case "driver":
          targetEntityType = "DRIVER";
          break;
        case "alert":
          targetEntityType = "ALERT";
          break;
        default:
          throw new Error(`Unsupported deep link entity: '${entity}'`);
      }
    }

    // Security check: ID sanitization against path traversal / script injection
    if (!ID_VALIDATION_REGEX.test(targetId)) {
      throw new Error(`Invalid target ID characters in deep link: '${targetId}'`);
    }

    // Parse query params if present
    const queryParams: Record<string, string> = {};
    if (queryPart) {
      const pairs = queryPart.split("&");
      for (const pair of pairs) {
        const [k, v] = pair.split("=");
        if (k) {
          queryParams[decodeURIComponent(k)] = v ? decodeURIComponent(v) : "";
        }
      }
    }

    return {
      rawUri: trimmed,
      scheme: DEEP_LINK_SCHEME,
      entity,
      targetEntityType,
      targetId,
      subPath,
      queryParams,
    };
  }

  /**
   * Build a canonical deep link URI
   */
  static buildUri(entity: "delivery" | "order" | "kds/ticket" | "driver" | "alert", id: string, queryParams?: Record<string, string>): string {
    if (!id || !ID_VALIDATION_REGEX.test(id)) {
      throw new Error(`Invalid ID for deep link: '${id}'`);
    }

    let uri = `${DEEP_LINK_SCHEME}://${entity}/${id}`;
    if (queryParams && Object.keys(queryParams).length > 0) {
      const qs = Object.entries(queryParams)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&");
      uri += `?${qs}`;
    }
    return uri;
  }

  /**
   * Translate parsed deep link to equivalent Web route
   */
  static toWebRoute(parsed: ParsedDeepLink): WebRouteResolution {
    const { targetEntityType, targetId, queryParams = {} } = parsed;

    let path = "/";
    const searchParams: Record<string, string> = { ...queryParams };

    switch (targetEntityType) {
      case "DELIVERY":
        searchParams["tab"] = "dispatch";
        searchParams["deliveryId"] = targetId;
        break;
      case "ORDER":
        searchParams["tab"] = "orders";
        searchParams["orderId"] = targetId;
        break;
      case "KDS_TICKET": {
        const branchId = queryParams.branchId || "default";
        path = `/kds/${branchId}`;
        searchParams["ticketId"] = targetId;
        break;
      }
      case "DRIVER":
        searchParams["tab"] = "drivers";
        searchParams["driverId"] = targetId;
        break;
      case "ALERT":
        searchParams["tab"] = "notifications";
        searchParams["alertId"] = targetId;
        break;
    }

    const qs = Object.entries(searchParams)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");

    const fullUrl = qs ? `${path}?${qs}` : path;

    return {
      path,
      searchParams,
      fullUrl,
    };
  }

  /**
   * Translate parsed deep link to Manager Android route
   */
  static toManagerAppRoute(parsed: ParsedDeepLink): ManagerAppRouteResolution {
    const { targetEntityType, targetId } = parsed;

    switch (targetEntityType) {
      case "DELIVERY":
        return { tab: "deliveries", entityId: targetId };
      case "ORDER":
        return { tab: "orders", entityId: targetId };
      case "KDS_TICKET":
        return { tab: "kds", entityId: targetId };
      case "DRIVER":
        return { tab: "drivers", entityId: targetId };
      case "ALERT":
        return { tab: "notifications", entityId: targetId };
      default:
        return { tab: "dashboard" };
    }
  }

  /**
   * Translate parsed deep link to Driver Android route
   */
  static toDriverAppRoute(parsed: ParsedDeepLink): DriverAppRouteResolution {
    const { targetEntityType, targetId } = parsed;

    switch (targetEntityType) {
      case "DELIVERY":
        return { screen: "delivery", deliveryId: targetId };
      case "ORDER":
        return { screen: "queue", deliveryId: targetId };
      case "ALERT":
        return { screen: "notifications" };
      default:
        return { screen: "home" };
    }
  }

  /**
   * Translate parsed deep link to KDS route
   */
  static toKDSRoute(parsed: ParsedDeepLink): KDSRouteResolution {
    const { targetEntityType, targetId, queryParams = {} } = parsed;

    if (targetEntityType === "KDS_TICKET") {
      return {
        ticketId: targetId,
        branchId: queryParams.branchId,
        stationId: queryParams.stationId,
      };
    }

    return {};
  }

  /**
   * Full comprehensive resolution for all platforms
   */
  static resolve(rawUri: string): DeepLinkResolution {
    const parsed = this.parse(rawUri);

    return {
      parsed,
      web: this.toWebRoute(parsed),
      managerApp: this.toManagerAppRoute(parsed),
      driverApp: this.toDriverAppRoute(parsed),
      kds: this.toKDSRoute(parsed),
    };
  }
}
