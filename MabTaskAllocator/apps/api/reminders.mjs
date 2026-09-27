// Date-only deadlines expire at the end of the selected day in Riyadh (UTC+3).
export function deadlineReminder(task, now = Date.now()) {
  if (task.status === 'done' || !task.due_date || task.allocation_request?.isNew) return null;
  const deadline = Date.parse(`${task.due_date}T00:00:00+03:00`) + 24 * 60 * 60 * 1000;
  if (!Number.isFinite(deadline)) return null;
  const remaining = deadline - now;
  if (remaining > 24 * 60 * 60 * 1000) return null;
  const stage = remaining <= 0 ? 'expired' : remaining <= 2 * 60 * 60 * 1000 ? '2h' : '24h';
  return { stage, title: stage === 'expired' ? 'Task deadline reached' : stage === '2h' ? 'Task due within 2 hours' : 'Task due within 24 hours',
    key: `deadline:${task.id}:${task.due_date}:${task.reopen_count ?? 0}:${stage}` };
}

export async function sendDeadlineReminders({ tasks, leaders, assigneeIds, canLead, notify, now = Date.now() }) {
  for (const task of tasks) {
    const reminder = deadlineReminder(task, now);
    if (!reminder) continue;
    const recipients = new Set(await assigneeIds(task.id));
    for (const leader of leaders) if (canLead(leader, task)) recipients.add(leader.id);
    for (const id of recipients) await notify(id, 'reminder', reminder.title,
      `${task.task_code}: ${task.title} · deadline ${task.due_date}, end of day (Riyadh)`, task.id, null, `${reminder.key}:${id}`);
  }
}
