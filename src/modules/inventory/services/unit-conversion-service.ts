import { memoryDb, getPostgresPool } from "@/core/database/db";
import { UnitOfMeasure, UnitConversion } from "../domain/inventory";

export class UnitConversionService {
  /**
   * Convert a quantity from one unit to another
   */
  async convertQuantity(params: {
    tenantId: string;
    fromUnitId: string;
    toUnitId: string;
    quantity: number;
  }): Promise<number> {
    const { tenantId, fromUnitId, toUnitId, quantity } = params;

    if (fromUnitId === toUnitId) {
      return quantity;
    }

    // 1. Check direct unit_conversions table
    const directConversion = await this.findDirectConversion(tenantId, fromUnitId, toUnitId);
    if (directConversion !== null) {
      return quantity * directConversion;
    }

    // 2. Check inverse direct conversion
    const inverseConversion = await this.findDirectConversion(tenantId, toUnitId, fromUnitId);
    if (inverseConversion !== null && inverseConversion !== 0) {
      return quantity / inverseConversion;
    }

    // 3. Convert via base units in units_of_measure
    const fromUnit = await this.getUnit(tenantId, fromUnitId);
    const toUnit = await this.getUnit(tenantId, toUnitId);

    if (fromUnit && toUnit) {
      // Must belong to the same dimension (e.g. WEIGHT to WEIGHT, VOLUME to VOLUME)
      if (fromUnit.dimension === toUnit.dimension) {
        // Normalize 'from' quantity to the dimension's base unit
        const fromBaseFactor = Number(fromUnit.conversion_factor || 1);
        const toBaseFactor = Number(toUnit.conversion_factor || 1);

        const quantityInBase = quantity * fromBaseFactor;
        return quantityInBase / toBaseFactor;
      }
    }

    throw new Error(`Incompatible or missing unit conversion between '${fromUnitId}' and '${toUnitId}'.`);
  }

  private async findDirectConversion(
    tenantId: string,
    fromUnitId: string,
    toUnitId: string
  ): Promise<number | null> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const conv = memoryDb.find(
        "unit_conversions",
        (c: any) =>
          (!c.tenant_id || c.tenant_id === tenantId) &&
          c.from_unit_id === fromUnitId &&
          c.to_unit_id === toUnitId
      )[0];
      return conv ? Number(conv.factor) : null;
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        `SELECT factor FROM unit_conversions
         WHERE (tenant_id = $1 OR tenant_id IS NULL) AND from_unit_id = $2 AND to_unit_id = $3
         LIMIT 1`,
        [tenantId, fromUnitId, toUnitId]
      );
      return res.rows.length > 0 ? Number(res.rows[0].factor) : null;
    }
  }

  async getUnit(tenantId: string, unitId: string): Promise<UnitOfMeasure | null> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      const unit = memoryDb.find(
        "units_of_measure",
        (u: any) => (!u.tenant_id || u.tenant_id === tenantId) && u.id === unitId
      )[0];
      return unit || null;
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        `SELECT * FROM units_of_measure
         WHERE (tenant_id = $1 OR tenant_id IS NULL) AND id = $2
         LIMIT 1`,
        [tenantId, unitId]
      );
      return res.rows.length > 0 ? res.rows[0] : null;
    }
  }

  async listUnits(tenantId: string): Promise<UnitOfMeasure[]> {
    if (process.env.NODE_ENV === "test" || !process.env.DATABASE_URL) {
      return memoryDb.find(
        "units_of_measure",
        (u: any) => !u.tenant_id || u.tenant_id === tenantId
      );
    } else {
      const pool = getPostgresPool();
      const res = await pool.query(
        "SELECT * FROM units_of_measure WHERE tenant_id = $1 OR tenant_id IS NULL ORDER BY dimension, name ASC",
        [tenantId]
      );
      return res.rows;
    }
  }
}

export const unitConversionService = new UnitConversionService();
