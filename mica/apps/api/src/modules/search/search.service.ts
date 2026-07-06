import { Injectable } from "@nestjs/common";
import { PrismaService } from "@/database/prisma/prisma.service";

export interface VehicleHit {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  score: number;
}
export interface DriverHit {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  score: number;
}
export interface MaintenanceHit {
  id: string;
  requestNumber: string;
  title: string;
  score: number;
}

const RESULT_LIMIT = 8;

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fuzzy, ranked search across vehicles/drivers/maintenance requests using
   * pg_trgm (partial plate/VIN/name matches survive typos and truncation),
   * with a plain ILIKE fallback so very short queries (where trigram
   * similarity is unreliable) still return substring matches.
   */
  async search(query: string) {
    const term = query.trim();
    if (!term) return { vehicles: [], drivers: [], maintenanceRequests: [] };
    const like = `%${term}%`;

    const [vehicles, drivers, maintenanceRequests] = await Promise.all([
      this.prisma.$queryRaw<VehicleHit[]>`
        SELECT id, "plateNumber", make, model,
          GREATEST(
            similarity("plateNumber", ${term}),
            similarity(vin, ${term}),
            similarity(make || ' ' || model, ${term})
          ) AS score
        FROM vehicles
        WHERE "deletedAt" IS NULL
          AND ("plateNumber" ILIKE ${like} OR vin ILIKE ${like} OR make ILIKE ${like} OR model ILIKE ${like}
               OR "plateNumber" % ${term} OR vin % ${term})
        ORDER BY score DESC
        LIMIT ${RESULT_LIMIT}
      `,
      this.prisma.$queryRaw<DriverHit[]>`
        SELECT id, "firstName", "lastName", "employeeCode",
          GREATEST(
            similarity("firstName" || ' ' || "lastName", ${term}),
            similarity("employeeCode", ${term}),
            similarity("licenseNumber", ${term})
          ) AS score
        FROM drivers
        WHERE "deletedAt" IS NULL
          AND ("firstName" ILIKE ${like} OR "lastName" ILIKE ${like} OR "employeeCode" ILIKE ${like}
               OR "licenseNumber" ILIKE ${like} OR ("firstName" || ' ' || "lastName") % ${term})
        ORDER BY score DESC
        LIMIT ${RESULT_LIMIT}
      `,
      this.prisma.$queryRaw<MaintenanceHit[]>`
        SELECT id, "requestNumber", title,
          GREATEST(similarity("requestNumber", ${term}), similarity(title, ${term})) AS score
        FROM maintenance_requests
        WHERE "deletedAt" IS NULL
          AND ("requestNumber" ILIKE ${like} OR title ILIKE ${like} OR "requestNumber" % ${term})
        ORDER BY score DESC
        LIMIT ${RESULT_LIMIT}
      `,
    ]);

    return { vehicles, drivers, maintenanceRequests };
  }
}
