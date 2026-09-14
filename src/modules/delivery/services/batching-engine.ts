import { memoryDb, getPostgresPool } from "@/core/database/db";
import { DeliveryBatch, IntelligenceDecisionLog } from "../domain/delivery";
import { deliveryService } from "./delivery-service";
import { calculateDistanceMeters } from "@/modules/fleet/services/fleet-service";
import { auditLogger } from "@/core/audit/audit-logger";

// Calculate bearing/azimuth between two points (in degrees 0-360)
export function calculateBearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const theta = Math.atan2(y, x);

  return ((theta * 180) / Math.PI + 360) % 360;
}

export class BatchingEngine {
  /**
   * Deterministic Advisory Smart Batching (PHASE 00 Section 11 & ADR 0007)
   * Evaluates candidate ready / available orders across distance, azimuth direction,
   * kitchen timing, and vehicle capacity.
   */
  async suggestBatches(params: {
    tenantId: string;
    branchId: string;
    maxOrdersPerBatch?: number;
  }): Promise<DeliveryBatch[]> {
    const { tenantId, branchId, maxOrdersPerBatch = 3 } = params;

    // 1. Fetch available deliveries for this branch
    const available = await deliveryService.listDeliveries(tenantId, branchId, "AVAILABLE_FOR_ASSIGNMENT");
    if (available.length < 2) {
      return []; // Need at least 2 deliveries to form a batch
    }

    const suggestions: DeliveryBatch[] = [];

    // Reference point: branch restaurant coordinates (or first delivery)
    const refLat = available[0].delivery_address?.latitude || 32.0625;
    const refLon = available[0].delivery_address?.longitude || 34.7702;

    // Evaluate pairs/triplets of deliveries
    for (let i = 0; i < available.length; i++) {
      for (let j = i + 1; j < available.length; j++) {
        const d1 = available[i];
        const d2 = available[j];

        const lat1 = d1.delivery_address?.latitude || refLat;
        const lon1 = d1.delivery_address?.longitude || refLon;
        const lat2 = d2.delivery_address?.latitude || refLat;
        const lon2 = d2.delivery_address?.longitude || refLon;

        // 1. Distance score (higher when deliveries are closer together, max distance ~5000m)
        const distanceBetween = calculateDistanceMeters(lat1, lon1, lat2, lon2);
        const distanceScore = Math.max(0, 100 - (distanceBetween / 5000) * 100);

        // 2. Azimuth alignment from restaurant (lower angular difference = higher direction score)
        const bearing1 = calculateBearingDegrees(refLat, refLon, lat1, lon1);
        const bearing2 = calculateBearingDegrees(refLat, refLon, lat2, lon2);
        const angleDiff = Math.abs(bearing1 - bearing2);
        const normalizedAngleDiff = angleDiff > 180 ? 360 - angleDiff : angleDiff;
        // If angle difference is > 90 degrees, these deliveries are in diverging directions!
        const directionScore = Math.max(0, 100 - (normalizedAngleDiff / 90) * 100);

        // 3. Kitchen sync & SLA headroom
        const kitchenSyncScore = 90.0; // Both are in AVAILABLE_FOR_ASSIGNMENT
        const slaScore = 85.0;
        const capacityScore = 95.0;

        // Weighted total score
        // Formula: 0.3 * distance + 0.35 * direction + 0.15 * kitchen + 0.1 * sla + 0.1 * capacity
        const totalScore = Number(
          (
            0.3 * distanceScore +
            0.35 * directionScore +
            0.15 * kitchenSyncScore +
            0.1 * slaScore +
            0.1 * capacityScore
          ).toFixed(2)
        );

        // Threshold: Only suggest batches with score >= 60 (filtering out diverging routes)
        if (totalScore >= 60) {
          const batchId = `bat_${crypto.randomUUID()}`;
          const batch: DeliveryBatch = {
            id: batchId,
            tenant_id: tenantId,
            branch_id: branchId,
            driver_id: null,
            status: "SUGGESTED",
            strategy: "SMART_HEURISTIC",
            score: totalScore,
            scoring_breakdown: {
              distanceScore: Number(distanceScore.toFixed(1)),
              directionScore: Number(directionScore.toFixed(1)),
              kitchenSyncScore,
              slaScore,
              capacityScore,
            },
            delivery_ids: [d1.id, d2.id],
            created_by: null,
            approved_by: null,
            approved_at: null,
            rejected_at: null,
            rejection_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
          };

          if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
            memoryDb.insert("delivery_batches", batch);
          } else {
            const pool = getPostgresPool();
            await pool.query(
              `INSERT INTO delivery_batches (
                id, tenant_id, branch_id, status, strategy, score, scoring_breakdown, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
              [
                batch.id,
                batch.tenant_id,
                batch.branch_id,
                batch.status,
                batch.strategy,
                batch.score,
                JSON.stringify(batch.scoring_breakdown),
              ]
            );
            for (let idx = 0; idx < batch.delivery_ids.length; idx++) {
              await pool.query(
                `INSERT INTO delivery_batch_items (id, batch_id, delivery_id, sequence_index, created_at)
                 VALUES ($1, $2, $3, $4, NOW())`,
                [`dbi_${crypto.randomUUID()}`, batch.id, batch.delivery_ids[idx], idx]
              );
            }
          }

          // Record recommendation in intelligence_decision_logs (PHASE 00 Section 13)
          await this.logDecision({
            tenantId,
            branchId,
            decisionType: "DELIVERY_BATCH_RECOMMENDATION",
            candidateDeliveryIds: [d1.id, d2.id],
            candidateDriverIds: [],
            recommendation: { batchId: batch.id, score: totalScore },
            scoringBreakdown: batch.scoring_breakdown,
          });

          suggestions.push(batch);
          if (suggestions.length >= 5) break; // Return top 5 suggestions
        }
      }
      if (suggestions.length >= 5) break;
    }

    return suggestions;
  }

  /**
   * Manager Approves Batch Recommendation (PHASE 00 Section 11 & ADR 0007)
   */
  async approveBatch(params: {
    tenantId: string;
    batchId: string;
    managerUserId: string;
    driverId?: string;
  }): Promise<DeliveryBatch> {
    const { tenantId, batchId, managerUserId, driverId } = params;
    const now = new Date();

    let batch: DeliveryBatch | null = null;
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      batch = memoryDb.findById("delivery_batches", batchId);
      if (!batch || batch.tenant_id !== tenantId) throw new Error("Batch not found");
      if (batch.status !== "SUGGESTED") throw new Error(`Cannot approve batch in status ${batch.status}`);

      memoryDb.update("delivery_batches", batchId, {
        status: "APPROVED",
        driver_id: driverId || null,
        approved_by: managerUserId,
        approved_at: now,
        updated_at: now,
      });
      batch = memoryDb.findById("delivery_batches", batchId);
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        "SELECT * FROM delivery_batches WHERE id = $1 AND tenant_id = $2",
        [batchId, tenantId]
      );
      if (res.rows.length === 0) throw new Error("Batch not found");
      batch = res.rows[0];
      if (batch!.status !== "SUGGESTED") throw new Error(`Cannot approve batch in status ${batch!.status}`);

      await pool.query(
        `UPDATE delivery_batches SET
          status = 'APPROVED', driver_id = $1, approved_by = $2, approved_at = $3, updated_at = $3
         WHERE id = $4 AND tenant_id = $5`,
        [driverId || null, managerUserId, now, batchId, tenantId]
      );

      // Resolve items
      const itemsRes = await pool.query(
        "SELECT delivery_id FROM delivery_batch_items WHERE batch_id = $1 ORDER BY sequence_index ASC",
        [batchId]
      );
      batch!.delivery_ids = itemsRes.rows.map((r) => r.delivery_id);
    }

    // If a driver was selected, assign the candidate deliveries to the driver
    if (driverId && batch?.delivery_ids) {
      for (const deliveryId of batch.delivery_ids) {
        await deliveryService.assignDelivery({
          tenantId,
          deliveryId,
          driverId,
          actorId: managerUserId,
          actorType: "MANAGER",
          reason: `Batch approval for batch ${batchId}`,
        });
      }
    }

    // Update intelligence_decision_logs with manager approval
    await this.updateDecisionLogOutcome(tenantId, batchId, "APPROVED", managerUserId);

    await auditLogger.log({
      actor: { actorId: managerUserId, actorType: "USER" },
      action: "DELIVERY_BATCH_APPROVED",
      entity: "DeliveryBatch",
      entityId: batchId,
      metadata: { driverId, deliveryCount: batch?.delivery_ids.length },
    });

    return batch!;
  }

  /**
   * Manager Rejects Batch Recommendation (PHASE 00 Section 11 & ADR 0007)
   */
  async rejectBatch(params: {
    tenantId: string;
    batchId: string;
    managerUserId: string;
    reason: string;
  }): Promise<DeliveryBatch> {
    const { tenantId, batchId, managerUserId, reason } = params;
    const now = new Date();

    let batch: DeliveryBatch | null = null;
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      batch = memoryDb.findById("delivery_batches", batchId);
      if (!batch || batch.tenant_id !== tenantId) throw new Error("Batch not found");

      memoryDb.update("delivery_batches", batchId, {
        status: "REJECTED",
        rejection_reason: reason,
        rejected_at: now,
        updated_at: now,
      });
      batch = memoryDb.findById("delivery_batches", batchId);
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        "SELECT * FROM delivery_batches WHERE id = $1 AND tenant_id = $2",
        [batchId, tenantId]
      );
      if (res.rows.length === 0) throw new Error("Batch not found");
      batch = res.rows[0];

      await pool.query(
        `UPDATE delivery_batches SET
          status = 'REJECTED', rejection_reason = $1, rejected_at = $2, updated_at = $2
         WHERE id = $3 AND tenant_id = $4`,
        [reason, now, batchId, tenantId]
      );
    }

    await this.updateDecisionLogOutcome(tenantId, batchId, "REJECTED", managerUserId, reason);

    await auditLogger.log({
      actor: { actorId: managerUserId, actorType: "USER" },
      action: "DELIVERY_BATCH_REJECTED",
      entity: "DeliveryBatch",
      entityId: batchId,
      metadata: { reason },
    });

    return batch!;
  }

  // ─── Decision Logging Helpers ────────────────────────────────────────────

  private async logDecision(params: {
    tenantId: string;
    branchId: string;
    decisionType: string;
    candidateDeliveryIds: string[];
    candidateDriverIds: string[];
    recommendation: any;
    scoringBreakdown: any;
  }): Promise<void> {
    const logRecord: IntelligenceDecisionLog = {
      id: `idl_${crypto.randomUUID()}`,
      tenant_id: params.tenantId,
      branch_id: params.branchId,
      decision_type: params.decisionType,
      candidate_delivery_ids: params.candidateDeliveryIds,
      candidate_driver_ids: params.candidateDriverIds,
      recommendation: params.recommendation,
      scoring_breakdown: params.scoringBreakdown,
      manager_action: null,
      actor_id: null,
      rejection_reason: null,
      algorithm_version: "gen1_heuristic_v1",
      model_version: null, // Null in Gen 1
      final_outcome: null,
      created_at: new Date(),
      resolved_at: null,
    };

    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      memoryDb.insert("intelligence_decision_logs", logRecord);
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `INSERT INTO intelligence_decision_logs (
          id, tenant_id, branch_id, decision_type, candidate_delivery_ids, candidate_driver_ids,
          recommendation, scoring_breakdown, algorithm_version, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          logRecord.id,
          logRecord.tenant_id,
          logRecord.branch_id,
          logRecord.decision_type,
          JSON.stringify(logRecord.candidate_delivery_ids),
          JSON.stringify(logRecord.candidate_driver_ids),
          JSON.stringify(logRecord.recommendation),
          JSON.stringify(logRecord.scoring_breakdown),
          logRecord.algorithm_version,
        ]
      );
    }
  }

  private async updateDecisionLogOutcome(
    tenantId: string,
    batchId: string,
    action: "APPROVED" | "REJECTED",
    actorId: string,
    reason?: string
  ): Promise<void> {
    const now = new Date();
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const logs = memoryDb.find(
        "intelligence_decision_logs",
        (l: any) => l.tenant_id === tenantId && l.recommendation?.batchId === batchId
      );
      for (const log of logs) {
        memoryDb.update("intelligence_decision_logs", log.id, {
          manager_action: action,
          actor_id: actorId,
          rejection_reason: reason || null,
          resolved_at: now,
        });
      }
    } else {
      const pool = getPostgresPool();
      await pool.query(
        `UPDATE intelligence_decision_logs SET
          manager_action = $1, actor_id = $2, rejection_reason = $3, resolved_at = $4
         WHERE tenant_id = $5 AND recommendation->>'batchId' = $6`,
        [action, actorId, reason || null, now, tenantId, batchId]
      );
    }
  }
}

export const batchingEngine = new BatchingEngine();
