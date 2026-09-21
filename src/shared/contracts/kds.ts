/**
 * Canonical Kitchen Display System (KDS) Contracts
 */

import {
  KDSStationType,
  KDSTicketStatus,
  KDSTicketPriority,
  KDSSLAStatus,
  KDSStation,
  KDSTicketItem,
  KDSTicket,
} from "@/modules/kds/domain/kds";

export type {
  KDSStationType,
  KDSTicketStatus,
  KDSTicketPriority,
  KDSSLAStatus,
  KDSStation,
  KDSTicketItem,
  KDSTicket,
};

export interface KDSTicketActionPayload {
  ticketId: string;
  action: "START" | "READY" | "COMPLETE" | "RECALL";
  cookId?: string;
  stationId: string;
}

export interface KDSTicketItemUpdatePayload {
  ticketId: string;
  itemId: string;
  status: "PENDING" | "PREPARING" | "READY";
}

export interface KDSStationSnapshot {
  stationId: string;
  stationName: string;
  branchId: string;
  activeTickets: KDSTicket[];
  completedRecentlyCount: number;
  serverTimestamp: string;
}
