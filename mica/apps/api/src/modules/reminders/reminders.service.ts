import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "@/database/prisma/prisma.service";
import { PermissionCacheService } from "@/common/permission-cache/permission-cache.service";
import { NotificationsService } from "@/modules/notifications/notifications.service";

const DUE_WINDOW_DAYS = 7;
const RESEND_AFTER_DAYS = 7;

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionCache: PermissionCacheService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async runDailyReminders() {
    const result = await this.sendDueDateReminders();
    const appts = await this.sendAppointmentReminders();
    this.logger.log(
      `Due-date reminders: ${result.oil} oil, ${result.maintenance} maintenance; appointment reminders: ${appts}.`,
    );
    return { ...result, appointments: appts };
  }

  /**
   * A day before a scheduled maintenance/inspection appointment, remind both the
   * driver (via their user account) and the assigned technician. Runs from the
   * daily cron; the ~26h window keeps it to roughly one reminder per appointment.
   */
  async sendAppointmentReminders(): Promise<number> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 26 * 60 * 60 * 1000);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        deletedAt: null,
        status: { in: ["SCHEDULED", "CONFIRMED"] },
        startAt: { gte: now, lte: windowEnd },
      },
      include: { vehicle: true, driver: { select: { userId: true } } },
    });

    let sent = 0;
    for (const appt of appointments) {
      const recipients = new Set<string>();
      if (appt.driver?.userId) recipients.add(appt.driver.userId);
      if (appt.assignedToId) recipients.add(appt.assignedToId);
      if (recipients.size === 0) continue;

      const when = appt.startAt.toLocaleString("ar-SA");
      const plate = appt.vehicle?.plateNumber ?? "";
      await this.fanOut([...recipients], {
        type: "appointment.reminder",
        title: appt.type === "INSPECTION" ? "تذكير: موعد فحص قريب" : "تذكير: موعد صيانة قريب",
        body: `${appt.title} — ${plate} بتاريخ ${when}.`,
        vehicleId: appt.vehicleId ?? "",
      });
      sent += 1;
    }
    return sent;
  }

  /** Notifies the workshop about oil-change / next-maintenance dates coming due
   *  within the next week, once per approaching due date (re-sent weekly while
   *  still due). Returns how many of each were sent. */
  async sendDueDateReminders(): Promise<{ oil: number; maintenance: number }> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + DUE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const resendCutoff = new Date(now.getTime() - RESEND_AFTER_DAYS * 24 * 60 * 60 * 1000);

    // People who act on vehicles (Mechanic + Technical Support). Management
    // tracks these via the dashboard's due-soon cards instead.
    const recipientIds = await this.permissionCache.findUserIdsWithPermission("vehicles:update");
    if (recipientIds.length === 0) return { oil: 0, maintenance: 0 };

    const notActive = { notIn: ["DELIVERED", "CANCELLED"] as ("DELIVERED" | "CANCELLED")[] };

    const [oilDue, maintDue] = await Promise.all([
      this.prisma.vehicle.findMany({
        where: {
          deletedAt: null,
          status: notActive,
          oilChangeDueAt: { not: null, lte: windowEnd },
          OR: [{ oilReminderSentAt: null }, { oilReminderSentAt: { lt: resendCutoff } }],
        },
      }),
      this.prisma.vehicle.findMany({
        where: {
          deletedAt: null,
          status: notActive,
          nextMaintenanceAt: { not: null, lte: windowEnd },
          OR: [{ maintenanceReminderSentAt: null }, { maintenanceReminderSentAt: { lt: resendCutoff } }],
        },
      }),
    ]);

    for (const vehicle of oilDue) {
      await this.fanOut(recipientIds, {
        type: "vehicle.oil_due",
        title: "Oil change due soon",
        body: `Oil change for ${vehicle.plateNumber} is due ${vehicle.oilChangeDueAt?.toLocaleDateString()}.`,
        vehicleId: vehicle.id,
      });
      await this.prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { oilReminderSentAt: now },
      });
    }

    for (const vehicle of maintDue) {
      await this.fanOut(recipientIds, {
        type: "vehicle.maintenance_due",
        title: "Maintenance due soon",
        body: `Maintenance for ${vehicle.plateNumber} is due ${vehicle.nextMaintenanceAt?.toLocaleDateString()}.`,
        vehicleId: vehicle.id,
      });
      await this.prisma.vehicle.update({
        where: { id: vehicle.id },
        data: { maintenanceReminderSentAt: now },
      });
    }

    return { oil: oilDue.length, maintenance: maintDue.length };
  }

  private async fanOut(
    recipientIds: string[],
    n: { type: string; title: string; body: string; vehicleId: string },
  ): Promise<void> {
    await Promise.all(
      recipientIds.map((recipientId) =>
        this.notifications.notify({
          recipientId,
          type: n.type,
          title: n.title,
          body: n.body,
          payload: { vehicleId: n.vehicleId },
          channels: ["IN_APP"],
        }),
      ),
    );
  }
}
