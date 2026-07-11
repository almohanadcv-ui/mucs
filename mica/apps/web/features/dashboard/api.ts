import { apiClient } from "@/lib/api-client";

export interface DashboardKpis {
  totalVehicles: number;
  totalDrivers: number;
  vehiclesByStatus: { status: string; count: number }[];
  maintenanceByStatus: { status: string; count: number }[];
  invoicesByStatus: { status: string; count: number }[];
  pendingInvoices: number;
  acceptedInvoices: number;
  rejectedInvoices: number;
  upcomingAppointments: number;
  overdueVehicleDocs: number;
  overdueDriverLicenses: number;
  oilChangeDueSoon: number;
  maintenanceDueSoon: number;
  monthlyMaintenanceCost: number;
  monthlyApprovedInvoiceCost: number;
}

export async function getDashboardKpis(branchId?: string) {
  const { data } = await apiClient.get<DashboardKpis>("/dashboard/kpis", { params: { branchId } });
  return data;
}

export interface MaintenanceAlert {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  nextMaintenanceAt: string | null;
  nextInspectionAt: string | null;
  currentDriver: { firstName: string; lastName: string } | null;
  earliestDueAt: string;
  urgency: "overdue" | "soon";
}

export async function getMaintenanceAlerts(branchId?: string) {
  const { data } = await apiClient.get<MaintenanceAlert[]>("/dashboard/alerts", {
    params: { branchId },
  });
  return data;
}
