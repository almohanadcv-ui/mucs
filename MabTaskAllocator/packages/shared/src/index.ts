export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskStatus = "new" | "assigned" | "in_progress" | "blocked" | "under_review" | "done";

export type TaskType = "Technical" | "QS" | "Shop Drawings" | "BIM" | "Variation";

export type UserRole = "superadmin" | "admin" | "technical_manager" | "team_leader" | "user";

export type DepartmentName = string;

/** SA = Saudi Arabia (Friday off), JO = Jordan (Friday + Saturday off). */
export type WorkCountry = "SA" | "JO";

export interface AppUser {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: UserRole;
  department: DepartmentName;
  workCountry?: WorkCountry;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  department: string;
  capacity: number;
  assignedTasks: number;
}

export interface TaskSummary {
  id: string;
  title: string;
  department: string;
  priority: TaskPriority;
  status: TaskStatus;
  assigneeName?: string;
  candidateName?: string;
  dueDate: string;
  progress: number;
}
