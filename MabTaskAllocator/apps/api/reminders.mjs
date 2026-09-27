// Date-only deadlines expire at the end of the selected day in Riyadh (UTC+3).
export function deadlineReminder(task, now = Date.now()) {
  if (task.status === 'done' || !task.due_date || task.allocation_request?.isNew) return null;
  const deadline = Date.parse(`${task.due_date}T00:00:00+03:00`) + 24 * 60 * 60 * 1000;
  if (!Number.isFinite(deadline)) return null;
  const remaining = deadline - now;
  if (remaining > 24 * 60 * 60 * 1000) return null;
  const stage = remaining <= 0 ? 'expired' : remaining <= 60 * 60 * 1000 ? '1h' : '24h';
  return {
    stage,
    title: stage === 'expired' ? 'Task deadline reached' : stage === '1h' ? 'Task due within 1 hour' : 'Task due within 24 hours',
    key: `deadline:${task.id}:${task.due_date}:${task.reopen_count ?? 0}:${stage}`,
  };
}

export async function sendDeadlineReminders({ tasks, leaders, assigneeIds, assigneeNames, canLead, notify, now = Date.now() }) {
  for (const task of tasks) {
    const reminder = deadlineReminder(task, now);
    if (!reminder) continue;
    const ids = await assigneeIds(task.id);
    const names = assigneeNames ? await assigneeNames(task.id) : [];
    const who = names.length ? names.join(', ') : 'the assignee';
    const deadlineText = `${task.task_code}: ${task.title} — deadline ${task.due_date}, end of day (Riyadh)`;

    // The assignee(s): a plain deadline reminder.
    for (const id of ids) {
      await notify(id, 'reminder', reminder.title, deadlineText, task.id, null, `${reminder.key}:${id}`);
    }

    // The team leader(s)/manager: a delay alert that names the employee.
    const leaderTitle = reminder.stage === 'expired'
      ? `Delay: ${who} missed a deadline`
      : reminder.stage === '1h'
        ? `Delay risk: ${who} — task due within 1 hour`
        : `Upcoming deadline: ${who} — due within 24 hours`;
    for (const leader of leaders) {
      if (canLead(leader, task)) {
        await notify(leader.id, 'delay', leaderTitle,
          `${task.task_code}: ${task.title} — assigned to ${who}, deadline ${task.due_date}, end of day (Riyadh)`,
          task.id, null, `${reminder.key}:leader:${leader.id}`);
      }
    }
  }
}
