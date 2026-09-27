import type { ManagedTask } from "./api";

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function completedDate(task: ManagedTask) {
  if (!task.completedAtIso) return "";
  const date = new Date(task.completedAtIso);
  return Number.isNaN(date.getTime()) ? "" : localDateKey(date);
}
export function isFreeTask(task: ManagedTask) {
  return task.status === "new" && !task.assigneeIds.length && !task.allocationRequest?.isNew && task.allocationRequest?.state !== "pending" && !task.actionRequest;
}
export function needsReview(task: ManagedTask) {
  return task.status === "under_review" || task.allocationRequest?.state === "pending" || task.actionRequest?.state === "pending";
}
export function archiveProjects(tasks: ManagedTask[]) {
  const groups = new Map<string, { id: string; name: string; count: number }>();
  for (const task of tasks) {
    const id = task.projectId ?? "__none__";
    const group = groups.get(id) ?? { id, name: task.projectId ? task.projectName || "Unnamed project" : "No project", count: 0 };
    group.count++;
    groups.set(id, group);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}
export type ArchiveFilters = { taskId: string; projectId: string; priority: string; assigneeId: string; from: string; to: string };
export function filterArchive(tasks: ManagedTask[], filters: ArchiveFilters) {
  const query = filters.taskId.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
  return tasks.filter((task) => {
    if (task.status !== "done") return false;
    if (filters.projectId && (task.projectId ?? "__none__") !== filters.projectId) return false;
    if (query && !task.taskCode.toLocaleLowerCase().replace(/[^a-z0-9]/g, "").includes(query)) return false;
    if (filters.priority && task.priority !== filters.priority) return false;
    if (filters.assigneeId && !task.assigneeIds.includes(filters.assigneeId)) return false;
    const date = completedDate(task);
    if ((filters.from || filters.to) && !date) return false;
    return (!filters.from || date >= filters.from) && (!filters.to || date <= filters.to);
  });
}
export function archiveSummary(tasks: ManagedTask[], now = new Date()) {
  const finished = tasks.filter((task) => task.status === "done");
  const dated = finished.filter((task) => task.dueDate && completedDate(task));
  return {
    total: finished.length,
    thisMonth: finished.filter((task) => completedDate(task).startsWith(localDateKey(now).slice(0, 7))).length,
    onTimePercent: dated.length ? Math.round(dated.filter((task) => completedDate(task) <= task.dueDate).length / dated.length * 100) : null
  };
}
