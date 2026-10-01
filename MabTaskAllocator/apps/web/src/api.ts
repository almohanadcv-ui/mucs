import type { AppUser, DepartmentName, TaskPriority, TaskStatus, TaskType, UserRole } from "@mab/shared";

export type TaskFile = {
  category?: "task" | "reference" | "completion" | "legacy";
  id: string;
  name: string;
  uploadedBy: string;
  uploadedAt: string;
  mimeType: string;
  size: number;
};

export type TaskMessage = {
  createdAtIso?: string;
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type WorkerApproval = {
  id: string;
  name: string;
  approvedAt: string;
};

export type TaskEvent = {
  id: string;
  actorId?: string;
  actorName: string;
  type: string;
  details: string;
  createdAt: string;
  createdAtIso?: string;
};

export type ManagedTask = {
  checklist?: Array<{ id: string; title: string; completed: boolean; assigneeId?: string; assigneeName?: string }>;
  id: string;
  taskCode: string;
  title: string;
  department: DepartmentName;
  priority: TaskPriority;
  status: TaskStatus;
  allocationRequest?: {
    id: string;
    requesterId: string;
    requesterName: string;
    assigneeIds: string[];
    candidateNames: string[];
    dueDate: string | null;
    isNew: boolean;
    state: "pending" | "rejected";
  };
  leaderApprovedById?: string;
  leaderApprovedAt?: string;
  actionRequest?: {
    id: string;
    action: "approve" | "finish" | "reopen";
    comment: string;
    requesterId: string;
    requesterName: string;
    previousStatus: TaskStatus;
    state: "pending";
  };
  assigneeId?: string;
  assigneeIds: string[];
  candidateName?: string;
  candidateNames: string[];
  workerApprovals: WorkerApproval[];
  pendingApprovalNames: string[];
  claimRequest?: {
    userId: string;
    userName: string;
    requestedAt?: string;
  };
  claimRequests: Array<{
    userId: string;
    userName: string;
    requestedAt?: string;
  }>;
  projectId?: string;
  projectName?: string;
  taskType: TaskType;
  complexity: number;
  reopenCount: number;
  events: TaskEvent[];
  startedAt?: string;
  dueDate: string;
  progress: number;
  reviewComment?: string;
  completedAt?: string;
  completedAtIso?: string;
  createdAt: string;
  updatedAt: string;
  files: TaskFile[];
  messages: TaskMessage[];
  mentionableUsers?: Array<{ id: string; name: string }>;
};

export type PerformanceTask = Pick<ManagedTask, "id" | "department" | "status" | "priority" | "taskType" | "progress" | "complexity" | "startedAt" | "createdAt" | "completedAtIso" | "dueDate" | "assigneeIds" | "reopenCount">;

export type OperationalIntelligence = {
  generatedAt: string;
  portfolio: { activeTasks: number; highRiskTasks: number; overloadedUsers: number; unassignedTasks: number; healthScore: number };
  taskInsights: Array<{ taskId: string; delayRisk: number; riskLevel: string; priorityScore: number; smartPriority: string; benchmarkDays?: number | null; suggestedAssigneeId?: string; reasons: string[] }>;
  workforceInsights: Array<{ userId: string; activeTasks: number; complexityLoad: number; urgentTasks: number; overdueTasks: number; blockedTasks: number; burnoutRisk: number; level: string; reasons: string[] }>;
};

export type AuditLog = { id: string; actorName: string; action: string; entityType: string; entityId?: string; department?: string; details: string; createdAt: string; createdAtIso?: string };

export type AttendanceProfile = {
  userId: string;
  employmentStart: string;
  records: Array<{ workDate: string; firstLoginAt?: string; lastLoginAt?: string; loginCount: number }>;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  department: DepartmentName;
  createdAt: string;
  members: AppUser[];
  leaders?: AppUser[];
  taskCount: number;
};

export type AppNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  taskId?: string;
  channelId?: string;
  isRead: boolean;
  createdAt: string;
};

export type ChatChannel = {
  id: string;
  name: string;
  department: DepartmentName;
  isGroup: boolean;
  taskId?: string;
  isDirect?: boolean;
  participantId?: string;
  unreadCount?: number;
};

export type ChatMessageFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
};

export type ChatMessageReplyPreview = {
  id: string;
  authorName: string;
  body: string;
};

export type ChatMessage = {
  id: string;
  channelId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  files: ChatMessageFile[];
  replyTo?: ChatMessageReplyPreview;
  isDeleted?: boolean;
};

export type TodoItem = {
  id: string;
  title: string;
  completed: boolean;
  taskId?: string;
  taskCode?: string;
  taskTitle?: string;
  createdAt: string;
  completedAt?: string;
};

export type BootstrapData = {
  currentUser: AppUser;
  departments: DepartmentName[];
  departmentHierarchy: Array<{ id: string; name: string; parentId: string | null }>;
  users: AppUser[];
  tasks: ManagedTask[];
  performanceTasks: PerformanceTask[];
  attendanceProfiles: AttendanceProfile[];
  intelligence: OperationalIntelligence;
  auditLogs: AuditLog[];
  projects: Project[];
  notifications: AppNotification[];
  unreadNotificationCount: number;
  todos: TodoItem[];
  chatChannels: ChatChannel[];
  chatMessages: ChatMessage[];
};

const tokenKey = "mab-task-allocator.session";
const activityKey = "mab-task-allocator.last-activity";
// Stay signed in on a verified device: keep the session for 30 days of
// inactivity and persist it in localStorage so closing the browser doesn't sign
// the user out. (The new-device email code is the security gate.)
export const inactivityLimitMs = 30 * 24 * 60 * 60 * 1000;

// Migrate any token left in the old sessionStorage location to localStorage.
try {
  const legacyToken = window.sessionStorage.getItem(tokenKey);
  if (legacyToken && !window.localStorage.getItem(tokenKey)) {
    window.localStorage.setItem(tokenKey, legacyToken);
    const legacyActivity = window.sessionStorage.getItem(activityKey);
    if (legacyActivity) window.localStorage.setItem(activityKey, legacyActivity);
  }
  window.sessionStorage.removeItem(tokenKey);
  window.sessionStorage.removeItem(activityKey);
} catch {
  // storage unavailable — sign-in still works for the current page load
}

export function hasSession() {
  return Boolean(window.localStorage.getItem(tokenKey));
}

function setSession(token: string | null) {
  if (token) {
    window.localStorage.setItem(tokenKey, token);
    markActivity();
  } else {
    window.localStorage.removeItem(tokenKey);
    window.localStorage.removeItem(activityKey);
  }
}

export function getLastActivity() {
  return Number(window.localStorage.getItem(activityKey) ?? 0);
}

export function markActivity() {
  const timestamp = Date.now();
  window.localStorage.setItem(activityKey, String(timestamp));
  return timestamp;
}

type UploadFile = { name: string; mimeType: string; data: string };

function encodeFile(file: File) {
  return new Promise<UploadFile>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => resolve({
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      data: String(reader.result).split(",")[1] ?? ""
    });
    reader.readAsDataURL(file);
  });
}

async function encodeFiles(files: File[]) {
  if (files.length > 5) throw new Error("You can upload up to 5 files at once.");
  const oversized = files.find((file) => file.size > 10 * 1024 * 1024);
  if (oversized) throw new Error(`${oversized.name} exceeds the 10 MB file limit.`);
  return Promise.all(files.map(encodeFile));
}

async function request<T>(path: string, options: RequestInit = {}) {
  const token = window.localStorage.getItem(tokenKey);
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const text = await response.text();
  let data = {} as T & { message?: string };

  if (text) {
    try {
      data = JSON.parse(text) as T & { message?: string };
    } catch {
      data = {
        message: response.ok
          ? "The server returned an unreadable response."
          : "The server is reachable, but it did not return a valid application response."
      } as T & { message?: string };
    }
  }

  if (!response.ok) {
    if (response.status === 401) setSession(null);
    throw new Error(data.message ?? "The server could not complete this request.");
  }
  return data;
}

async function download(path: string, fallbackName: string) {
  const token = window.localStorage.getItem(tokenKey);
  const response = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let data: { message?: string } = { message: "The download failed." };
    if (text) {
      try {
        data = JSON.parse(text) as { message?: string };
      } catch {
        data = { message: "The server did not return a valid download response." };
      }
    }
    if (response.status === 401) setSession(null);
    throw new Error(data.message ?? "The download failed.");
  }
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// A stable per-browser id so a verified device isn't challenged again.
function deviceId(): string {
  const key = "mab-task-allocator.device-id";
  try {
    let id = window.localStorage.getItem(key);
    if (!id) {
      id = (window.crypto?.randomUUID?.() ?? `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      window.localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return "web";
  }
}

export type LoginResult = { status: "ok"; user: AppUser } | { status: "verify" };

export const api = {
  async login(username: string, password: string): Promise<LoginResult> {
    const result = await request<{ token?: string; user?: AppUser; requiresVerification?: boolean }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password, deviceId: deviceId() })
    });
    if (result.requiresVerification) return { status: "verify" };
    setSession(result.token!);
    return { status: "ok", user: result.user! };
  },
  async verifyDevice(username: string, code: string): Promise<AppUser> {
    const result = await request<{ token: string; user: AppUser }>("/api/auth/verify-device", {
      method: "POST",
      body: JSON.stringify({ username, code, deviceId: deviceId() })
    });
    setSession(result.token);
    return result.user;
  },
  async logout() {
    try {
      await request("/api/auth/logout", { method: "POST" });
    } finally {
      setSession(null);
    }
  },
  async forkSession() {
    const result = await request<{ token: string }>("/api/auth/fork", { method: "POST" });
    setSession(result.token);
  },
  touchSession: () => request<{ ok: boolean }>("/api/auth/activity", { method: "POST" }),
  bootstrap: () => request<BootstrapData>("/api/bootstrap"),
  createDepartment: (name: string) =>
    request<{ department: DepartmentName }>("/api/departments", {
      method: "POST",
      body: JSON.stringify({ name })
    }),
  deleteDepartment: (id: string) =>
    request<{ deleted: string }>(`/api/departments/${id}`, { method: "DELETE" }),
  createTodo: (todo: { title: string; taskId?: string }) =>
    request<{ todo: TodoItem }>("/api/todos", { method: "POST", body: JSON.stringify(todo) }),
  updateTodo: (todo: TodoItem) =>
    request<{ todo: TodoItem }>(`/api/todos/${todo.id}`, { method: "PUT", body: JSON.stringify(todo) }),
  deleteAllTodos: () => request<{ deleted: number }>("/api/todos", { method: "DELETE" }),
  deleteTodo: (todoId: string) => request(`/api/todos/${todoId}`, { method: "DELETE" }),
  loadChat: () => request<{ chatChannels: ChatChannel[]; chatMessages: ChatMessage[] }>("/api/chat"),
  createUser: (user: { name: string; username: string; password: string; role: UserRole; department: DepartmentName; projectId?: string }) =>
    request("/api/users", { method: "POST", body: JSON.stringify(user) }),
  updateUser: (user: AppUser & { password?: string }) =>
    request(`/api/users/${user.id}`, { method: "PUT", body: JSON.stringify(user) }),
  deleteUser: (userId: string) => request(`/api/users/${userId}`, { method: "DELETE" }),
  async createTask(
    task: Omit<ManagedTask, "id" | "taskCode" | "files" | "messages" | "status" | "createdAt" | "updatedAt" | "completedAtIso" | "startedAt" | "workerApprovals" | "pendingApprovalNames" | "claimRequest" | "claimRequests" | "reopenCount" | "events">,
    files: File[] = [],
    requiresApproval?: boolean
  ) {
    return request("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ ...task, requiresApproval, files: await encodeFiles(files) })
    });
  },
  updateTask: (task: ManagedTask) =>
    request(`/api/tasks/${task.id}`, { method: "PUT", body: JSON.stringify(task) }),
  deleteTask: (taskId: string) => request(`/api/tasks/${taskId}`, { method: "DELETE" }),
  taskAction: (taskId: string, action: "view" | "claim" | "claim-approve" | "claim-reject" | "submit" | "approve" | "finish" | "allocation-request" | "allocation-approve" | "allocation-reject" | "request-approve" | "request-reject", body = {}) =>
    request(`/api/tasks/${taskId}/${action}`, { method: "POST", body: JSON.stringify(body) }),
  reopenTask: (taskId: string, comment: string, requiresApproval?: boolean) =>
    request(`/api/tasks/${taskId}/reopen`, { method: "POST", body: JSON.stringify({ comment, requiresApproval }) }),
  trackTaskView: (taskId: string) => request(`/api/tasks/${taskId}/view`, { method: "POST", body: "{}" }),
  updateChecklist: (taskId: string, body: {action: string; id?: string; title?: string; completed?: boolean; assigneeId?: string}) => request(`/api/tasks/${taskId}/checklist`, {method: "PUT", body: JSON.stringify(body)}),
  addMessage: (taskId: string, body: string) =>
    request(`/api/tasks/${taskId}/messages`, { method: "POST", body: JSON.stringify({ body }) }),
  updateTaskMessage: (taskId: string, messageId: string, body: string) =>
    request<{ task: ManagedTask }>(`/api/tasks/${taskId}/messages/${messageId}`, { method: "PUT", body: JSON.stringify({ body }) }),
  deleteTaskMessage: (taskId: string, messageId: string) =>
    request<{ task: ManagedTask }>(`/api/tasks/${taskId}/messages/${messageId}`, { method: "DELETE" }),
  async addFiles(taskId: string, files: File[], category: "task" | "reference" | "completion" = "completion") {
    return request(`/api/tasks/${taskId}/files`, {
      method: "POST",
      body: JSON.stringify({ files: await encodeFiles(files), category })
    });
  },
  async updateDocument(fileId: string, name: string, category: string, file?: File) {
    return request(`/api/files/${fileId}`, {method: "PUT", body: JSON.stringify({name, category, file: file ? await encodeFile(file) : undefined})});
  },
  deleteDocument: (fileId: string) => request(`/api/files/${fileId}`, {method:"DELETE"}),
  downloadFile: (file: TaskFile) => download(`/api/files/${file.id}/download`, file.name),
  downloadProductivityReport: (userId: string) =>
    download(`/api/reports/productivity/${userId}`, "productivity-report.xlsx"),
  downloadMonthlyProductivityReport: (userId: string, month: string) =>
    download(`/api/reports/productivity/${userId}?month=${encodeURIComponent(month)}`, `productivity-${month}.xlsx`),
  createProject: (project: { name: string; description: string; department: DepartmentName; memberIds: string[] }) =>
    request("/api/projects", { method: "POST", body: JSON.stringify(project) }),
  updateProject: (projectId: string, project: { name: string; description: string; memberIds: string[] }) =>
    request(`/api/projects/${projectId}`, { method: "PUT", body: JSON.stringify(project) }),
  deleteProject: (projectId: string) => request(`/api/projects/${projectId}`, { method: "DELETE" }),
  assignProjectLeaders: (projectId: string, leaderIds: string[]) => request(`/api/projects/${projectId}/leaders`, { method: "PUT", body: JSON.stringify({ leaderIds }) }),
  addProjectMembers: (projectId: string, memberIds: string[]) =>
    request(`/api/projects/${projectId}/members`, { method: "POST", body: JSON.stringify({ memberIds }) }),
  downloadProjectTaskTemplate: (projectId: string, projectName: string) =>
    download(`/api/projects/${projectId}/task-sheet-template`, `${projectName}-task-sheet.xlsx`),
  async importProjectTasks(projectId: string, file: File) {
    return request<{ imported: number }>(`/api/projects/${projectId}/import`, {
      method: "POST",
      body: JSON.stringify({ file: await encodeFile(file) })
    });
  },
  createChatGroup: (name: string, department: DepartmentName) =>
    request<{ channel: ChatChannel }>("/api/chat/groups", {
      method: "POST",
      body: JSON.stringify({ name, department })
    }),
  updateChatGroup: (channelId: string, name: string) =>
    request<{ channel: ChatChannel }>(`/api/chat/groups/${channelId.replace(/^group:/, "")}`, {
      method: "PUT",
      body: JSON.stringify({ name })
    }),
  deleteChatGroup: (channelId: string) =>
    request(`/api/chat/groups/${channelId.replace(/^group:/, "")}`, { method: "DELETE" }),
  async sendChatMessage(channelId: string, body: string, files: File[] = [], replyToId?: string) {
    return request("/api/chat/messages", {
      method: "POST",
      body: JSON.stringify({ channelId, body, replyToId, files: await encodeFiles(files) })
    });
  },
  updateChatMessage: (messageId: string, body: string) =>
    request(`/api/chat/messages/${messageId}`, { method: "PUT", body: JSON.stringify({ body }) }),
  deleteChatMessage: (messageId: string, scope: "me" | "everyone") =>
    request(`/api/chat/messages/${messageId}`, { method: "DELETE", body: JSON.stringify({ scope }) }),
  downloadChatFile: (file: ChatMessageFile) => download(`/api/chat/files/${file.id}/download`, file.name),
  async loadChatFilePreview(fileId: string) {
    const token = window.localStorage.getItem(tokenKey);
    const response = await fetch(`/api/chat/files/${fileId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!response.ok) throw new Error("Could not load this image.");
    return response.blob();
  },
  markChatRead: (channelId: string) =>
    request("/api/chat/read", { method: "POST", body: JSON.stringify({ channelId }) }),
  askAiAssistant: (message: string, history: Array<{ role: "user" | "assistant"; text: string }>) =>
    request<{ reply: string; configured: boolean }>("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({ message, history })
    }),
  markNotificationsRead: () => request<{ unreadCount: number }>("/api/notifications/read", { method: "POST" }),
  markNotificationRead: (notificationId: string) => request<{ unreadCount: number }>(`/api/notifications/${notificationId}/read`, { method: "POST", body: "{}" })
};
