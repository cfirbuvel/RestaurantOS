/**
 * RestaurantOS Platform-Neutral Realtime Client Manager
 *
 * Implements:
 * - Ephemeral Ticket Handshake (POST /api/v1/realtime/ticket)
 * - State Machine: DISCONNECTED -> CONNECTING -> AUTHENTICATING -> SUBSCRIBING -> SNAPSHOT_SYNCING -> CONNECTED -> RECONNECTING
 * - Reconnect Lifecycle: New Ticket -> Resubscribe -> Fetch Snapshot -> Reconcile State -> Resume Events
 * - Snapshot + Event Model: Initial Snapshot + Realtime Events = Current Client State
 * - Zero Browser/DOM Globals (Node / React Native / Web compatible)
 */

import {
  RealtimeConnectionState,
  RealtimeEvent,
  RealtimeSnapshot,
  RealtimeTicketResponse,
} from "../contracts/realtime";
import { RestaurantOSClient } from "../api-client/restaurant-os-client";

export type RealtimeEventHandler<T = any> = (event: RealtimeEvent<T>) => void;
export type StateChangeHandler = (newState: RealtimeConnectionState, oldState: RealtimeConnectionState) => void;
export type SnapshotFetcher<T = any> = (channel: string) => Promise<T>;
export type SnapshotReconciler<T = any> = (snapshot: T, pendingEvents: RealtimeEvent[]) => void;

export interface IRealtimeTransport {
  connect(url: string): Promise<void>;
  disconnect(): void;
  send(data: string): void;
  onMessage(callback: (rawMessage: string) => void): void;
  onClose(callback: (code: number, reason: string) => void): void;
  onError(callback: (error: any) => void): void;
  isConnected(): boolean;
}

/**
 * In-Memory Transport for testing and environments without global WebSockets
 */
export class InMemoryRealtimeTransport implements IRealtimeTransport {
  private connected: boolean = false;
  private messageCallback?: (rawMessage: string) => void;
  private closeCallback?: (code: number, reason: string) => void;
  private errorCallback?: (error: any) => void;

  public async connect(url: string): Promise<void> {
    this.connected = true;
  }

  public disconnect(): void {
    this.connected = false;
    this.closeCallback?.(1000, "Normal closure");
  }

  public send(data: string): void {
    // In-memory loopback or mock dispatch
  }

  public onMessage(callback: (rawMessage: string) => void): void {
    this.messageCallback = callback;
  }

  public onClose(callback: (code: number, reason: string) => void): void {
    this.closeCallback = callback;
  }

  public onError(callback: (error: any) => void): void {
    this.errorCallback = callback;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Helper for tests to simulate server event push
   */
  public simulateServerEvent(event: RealtimeEvent): void {
    if (this.messageCallback) {
      this.messageCallback(JSON.stringify({ type: "EVENT", event }));
    }
  }

  /**
   * Helper for tests to simulate sudden network disconnection
   */
  public simulateDisconnect(code = 1006, reason = "Abnormal closure"): void {
    this.connected = false;
    this.closeCallback?.(code, reason);
  }
}

export interface RealtimeClientConfig {
  apiClient: RestaurantOSClient;
  wsBaseUrl: string;
  transport?: IRealtimeTransport;
  autoReconnect?: boolean;
  reconnectBaseDelayMs?: number;
  maxReconnectAttempts?: number;
}

export class RestaurantOSRealtimeClient {
  private state: RealtimeConnectionState = "DISCONNECTED";
  private apiClient: RestaurantOSClient;
  private wsBaseUrl: string;
  private transport: IRealtimeTransport;
  private autoReconnect: boolean;
  private reconnectBaseDelayMs: number;
  private maxReconnectAttempts: number;

  private currentTicket?: string;
  private subscribedChannels: Set<string> = new Set();
  private channelListeners: Map<string, Set<RealtimeEventHandler>> = new Map();
  private stateListeners: Set<StateChangeHandler> = new Set();

  private snapshotFetchers: Map<string, SnapshotFetcher> = new Map();
  private snapshotReconcilers: Map<string, SnapshotReconciler> = new Map();

  private eventBufferWhileReconciling: RealtimeEvent[] = [];
  private reconnectAttempts = 0;
  private isIntentionalClose = false;

  constructor(config: RealtimeClientConfig) {
    this.apiClient = config.apiClient;
    this.wsBaseUrl = config.wsBaseUrl.replace(/\/$/, "");
    this.transport = config.transport || new InMemoryRealtimeTransport();
    this.autoReconnect = config.autoReconnect ?? true;
    this.reconnectBaseDelayMs = config.reconnectBaseDelayMs ?? 500;
    this.maxReconnectAttempts = config.maxReconnectAttempts ?? 10;

    this.setupTransportHandlers();
  }

  public getState(): RealtimeConnectionState {
    return this.state;
  }

  public onStateChange(listener: StateChangeHandler): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /**
   * Register authoritative snapshot fetcher and state reconciler for a channel
   */
  public registerSnapshotHandler<T>(
    channel: string,
    fetcher: SnapshotFetcher<T>,
    reconciler: SnapshotReconciler<T>
  ) {
    this.snapshotFetchers.set(channel, fetcher);
    this.snapshotReconcilers.set(channel, reconciler);
  }

  /**
   * Connect with full lifecycle:
   * 1. Request new ephemeral ticket (POST /api/v1/realtime/ticket)
   * 2. Connect transport with ticket
   * 3. Send subscription messages
   * 4. Fetch initial authoritative snapshots
   * 5. Transition to CONNECTED
   */
  public async connect(): Promise<void> {
    this.isIntentionalClose = false;
    this.transitionState("CONNECTING");

    try {
      // Step 1: Request new ticket via server API client
      this.transitionState("AUTHENTICATING");
      const ticketRes = await this.apiClient.post<RealtimeTicketResponse>("/api/v1/realtime/ticket", {
        branchId: this.apiClient.getContext().branchId,
      });

      this.currentTicket = (ticketRes as any)?.data?.ticket || (ticketRes as any)?.ticket || "";

      // Step 2: Establish transport connection
      const connectUrl = `${this.wsBaseUrl}?ticket=${encodeURIComponent(this.currentTicket || "")}`;
      await this.transport.connect(connectUrl);

      // Step 3: Subscriptions
      this.transitionState("SUBSCRIBING");
      for (const channel of this.subscribedChannels) {
        this.transport.send(JSON.stringify({ action: "SUBSCRIBE", channel }));
      }

      // Step 4: Snapshot Synchronization & Reconciliation
      await this.reconcileAllSnapshots();

      // Step 5: Connected & Ready
      this.reconnectAttempts = 0;
      this.transitionState("CONNECTED");
    } catch (err) {
      this.transitionState("DISCONNECTED");
      if (this.autoReconnect && !this.isIntentionalClose) {
        this.scheduleReconnect();
      }
      throw err;
    }
  }

  public disconnect(): void {
    this.isIntentionalClose = true;
    this.transport.disconnect();
    this.transitionState("DISCONNECTED");
  }

  /**
   * Subscribe to a scoped domain channel
   */
  public subscribe<T = any>(channel: string, handler: RealtimeEventHandler<T>): () => void {
    this.subscribedChannels.add(channel);

    if (!this.channelListeners.has(channel)) {
      this.channelListeners.set(channel, new Set());
    }
    this.channelListeners.get(channel)!.add(handler);

    if (this.state === "CONNECTED" && this.transport.isConnected()) {
      this.transport.send(JSON.stringify({ action: "SUBSCRIBE", channel }));
    }

    return () => {
      const listeners = this.channelListeners.get(channel);
      if (listeners) {
        listeners.delete(handler);
        if (listeners.size === 0) {
          this.channelListeners.delete(channel);
          this.subscribedChannels.delete(channel);
          if (this.state === "CONNECTED" && this.transport.isConnected()) {
            this.transport.send(JSON.stringify({ action: "UNSUBSCRIBE", channel }));
          }
        }
      }
    };
  }

  // ==========================================================================
  // Internal Reconnection & Snapshot Reconciliation Pipeline
  // ==========================================================================

  private setupTransportHandlers(): void {
    this.transport.onMessage((raw) => {
      try {
        const message = JSON.parse(raw);
        if (message.type === "EVENT" && message.event) {
          this.handleIncomingEvent(message.event);
        }
      } catch (err) {
        console.error("[RestaurantOSRealtimeClient] Failed to parse message:", err);
      }
    });

    this.transport.onClose((code, reason) => {
      if (!this.isIntentionalClose) {
        this.transitionState("DISCONNECTED");
        if (this.autoReconnect) {
          this.scheduleReconnect();
        }
      }
    });

    this.transport.onError((err) => {
      console.warn("[RestaurantOSRealtimeClient] Transport error:", err);
    });
  }

  private handleIncomingEvent(event: RealtimeEvent): void {
    // If currently synchronizing snapshots, buffer events to prevent race conditions
    if (this.state === "SNAPSHOT_SYNCING") {
      this.eventBufferWhileReconciling.push(event);
      return;
    }

    this.dispatchToSubscribers(event);
  }

  private dispatchToSubscribers(event: RealtimeEvent): void {
    const listeners = this.channelListeners.get(event.channel);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (e) {
          console.error("[RestaurantOSRealtimeClient] Listener callback error:", e);
        }
      }
    }
  }

  private async reconcileAllSnapshots(): Promise<void> {
    this.transitionState("SNAPSHOT_SYNCING");
    this.eventBufferWhileReconciling = [];

    for (const channel of this.subscribedChannels) {
      const fetcher = this.snapshotFetchers.get(channel);
      const reconciler = this.snapshotReconcilers.get(channel);

      if (fetcher && reconciler) {
        try {
          const snapshot = await fetcher(channel);
          reconciler(snapshot, [...this.eventBufferWhileReconciling]);
        } catch (e) {
          console.error(`[RestaurantOSRealtimeClient] Failed snapshot reconciliation for ${channel}:`, e);
        }
      }
    }

    // Play any newly buffered events that arrived during snapshot fetch
    const buffered = [...this.eventBufferWhileReconciling];
    this.eventBufferWhileReconciling = [];
    for (const event of buffered) {
      this.dispatchToSubscribers(event);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn("[RestaurantOSRealtimeClient] Max reconnect attempts reached");
      return;
    }

    this.reconnectAttempts++;
    this.transitionState("RECONNECTING");

    const delay = this.reconnectBaseDelayMs * Math.pow(2, this.reconnectAttempts - 1) + Math.random() * 100;

    setTimeout(async () => {
      try {
        await this.connect();
      } catch (err) {
        // scheduleReconnect will be called by catch/onClose if failed
      }
    }, delay);
  }

  private transitionState(newState: RealtimeConnectionState): void {
    if (this.state === newState) return;
    const oldState = this.state;
    this.state = newState;
    for (const listener of this.stateListeners) {
      try {
        listener(newState, oldState);
      } catch (e) {
        console.error("[RestaurantOSRealtimeClient] State listener error:", e);
      }
    }
  }
}
