import type { ManagedTask } from './api';
export function riyadhDay(value: string | Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Date(date.getTime() + 3 * 3600000).toISOString().slice(0, 10);
}
export function weekStart(value = riyadhDay(new Date())) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date.toISOString().slice(0, 10);
}
export function leaderMetrics(tasks: ManagedTask[], leaderId: string, start: string, now = new Date()) {
  const endDate = new Date(`${start}T00:00:00Z`); endDate.setUTCDate(endDate.getUTCDate() + 7);
  const end = endDate.toISOString().slice(0, 10);
  const within = (value?: string) => Boolean(value && riyadhDay(value) >= start && riyadhDay(value) < end);
  const requested = new Set<string>(), allocated = new Set<string>();
  const owned: ManagedTask[] = [];
  for (const task of tasks) {
    let owner: string | undefined;
    let requester: string | undefined;
    const events = [...task.events].sort((a,b) => (Date.parse(a.createdAtIso ?? '') || 0) - (Date.parse(b.createdAtIso ?? '') || 0));
    for (const event of events) {
      if (event.type === 'allocation_requested') {
        requester = event.actorId;
        if (event.actorId === leaderId && within(event.createdAtIso)) requested.add(task.id);
      }
      if (event.type === 'allocation_rejected') requester = undefined;
      const assignment = event.type === 'leader_allocated' || event.type === 'claim_approved' || event.type === 'reassigned' ||
        (event.type === 'created' && /created and assigned/.test(event.details)) || event.type === 'allocation_approved';
      if (event.type === 'allocation_approved' && event.details.includes('free task queue')) { owner = undefined; requester = undefined; continue; }
      if (assignment) {
        owner = event.type === 'allocation_approved' ? requester ?? (event.actorId === leaderId ? leaderId : owner) : event.actorId;
        if (owner === leaderId && within(event.createdAtIso)) allocated.add(task.id);
        if (event.type === 'allocation_approved') requester = undefined;
      }
    }
    if (owner === leaderId) owned.push(task);
  }
  const completed = owned.filter(task => task.status === 'done' && within(task.completedAtIso));
  const dated = completed.filter(task => task.dueDate);
  return {
    requested: requested.size, allocated: allocated.size,
    pending: tasks.filter(task => task.allocationRequest?.requesterId === leaderId && task.allocationRequest.state === 'pending').length,
    active: owned.filter(task => task.status !== 'done').length,
    completed: completed.length,
    overdue: owned.filter(task => task.status !== 'done' && task.dueDate && task.dueDate < riyadhDay(now)).length,
    onTime: dated.length ? Math.round(dated.filter(task => riyadhDay(task.completedAtIso!) <= task.dueDate).length / dated.length * 100) : null,
    people: new Set(owned.filter(task => task.status !== 'done').flatMap(task => task.assigneeIds)).size,
    tasks: owned
  };
}
