import { z } from "zod";

/** The seven workshop statuses a vehicle moves through, in flow order. */
export const VEHICLE_STATUSES = [
  "AWAITING_RECEPTION", // بانتظار الاستلام
  "UNDER_INSPECTION", // قيد الفحص
  "UNDER_MAINTENANCE", // قيد الصيانة
  "AWAITING_PARTS", // بانتظار قطع الغيار
  "READY", // جاهزة
  "DELIVERED", // تم التسليم
  "CANCELLED", // ملغية
] as const;
export type VehicleStatusValue = (typeof VEHICLE_STATUSES)[number];

/** English + Arabic labels for each status (UI display). */
export const VEHICLE_STATUS_LABELS: Record<VehicleStatusValue, { en: string; ar: string }> = {
  AWAITING_RECEPTION: { en: "Awaiting reception", ar: "بانتظار الاستلام" },
  UNDER_INSPECTION: { en: "Under inspection", ar: "قيد الفحص" },
  UNDER_MAINTENANCE: { en: "Under maintenance", ar: "قيد الصيانة" },
  AWAITING_PARTS: { en: "Awaiting parts", ar: "بانتظار قطع الغيار" },
  READY: { en: "Ready", ar: "جاهزة" },
  DELIVERED: { en: "Delivered", ar: "تم التسليم" },
  CANCELLED: { en: "Cancelled", ar: "ملغية" },
};

/** Fuel level, high → low. */
export const FUEL_LEVELS = ["FULL", "THREE_QUARTERS", "HALF", "QUARTER", "EMPTY"] as const;
export type FuelLevelValue = (typeof FUEL_LEVELS)[number];

export const FUEL_LEVEL_LABELS: Record<FuelLevelValue, { en: string; ar: string }> = {
  FULL: { en: "Full", ar: "ممتلئ" },
  THREE_QUARTERS: { en: "Three quarters", ar: "ثلاثة أرباع" },
  HALF: { en: "Half", ar: "نصف" },
  QUARTER: { en: "Quarter", ar: "ربع" },
  EMPTY: { en: "Empty", ar: "فارغ" },
};

/** Accepts either a plain date (YYYY-MM-DD from a date input) or a full ISO datetime. */
const optionalDateString = z
  .string()
  .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "Invalid date")
  .optional();

export const createVehicleSchema = z.object({
  name: z.string().max(200).optional(), // اسم السيارة
  plateNumber: z.string().min(1),
  vin: z.string().min(1),
  make: z.string().min(1), // نوع السيارة / الماركة
  model: z.string().min(1),
  year: z.coerce.number().int().min(1900).max(2100),
  trim: z.string().optional(),
  color: z.string().optional(),
  bodyType: z.string().optional(),
  engine: z.string().optional(),
  transmission: z.string().optional(),
  fuelType: z.string().optional(),
  fuelLevel: z.enum(FUEL_LEVELS).optional(), // مستوى الوقود
  odometer: z.coerce.number().int().min(0).default(0), // العداد الحالي
  oilMeter: z.coerce.number().int().min(0).optional(), // عداد الزيت
  oilChangeDueAt: optionalDateString, // موعد تغيير الزيت
  lastOilChangeAt: optionalDateString, // تاريخ آخر تغيير زيت
  oilChangeOdometer: z.coerce.number().int().min(0).optional(), // قراءة العداد عند تغيير الزيت
  nextMaintenanceAt: optionalDateString, // موعد الصيانة القادمة
  nextInspectionAt: optionalDateString, // موعد الفحص/التشييك القادم
  receiverName: z.string().max(200).optional(), // اسم المستلم
  party: z.string().max(200).optional(), // الجهة
  // Optional in the single-workshop model: the API defaults it to the primary
  // branch, so the Mechanic form doesn't need a branch picker.
  branchId: z.string().optional(),
  currentDriverId: z.string().optional(),
  insuranceExpiry: z.string().datetime().optional(),
  registrationExpiry: z.string().datetime().optional(),
  licenseExpiry: z.string().datetime().optional(),
  purchaseDate: z.string().datetime().optional(),
  purchasePrice: z.coerce.number().min(0).optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

export const updateVehicleSchema = createVehicleSchema
  .partial()
  .omit({ plateNumber: true, vin: true })
  .extend({
    status: z.enum(VEHICLE_STATUSES).optional(),
    currentDriverId: z.string().nullable().optional(),
  });
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
