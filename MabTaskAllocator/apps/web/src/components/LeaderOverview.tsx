import { useState } from 'react';
import type { AppUser } from '@mab/shared';
import type { ManagedTask, Project } from '../api';
import { leaderMetrics, weekStart } from '../leaderMetrics';
export function LeaderOverview({ users, tasks, projects, department }: { users: AppUser[]; tasks: ManagedTask[]; projects: Project[]; department: string }) {
  const [week, setWeek] = useState(weekStart());
  const leaders = users.filter(user => user.role === 'team_leader' && (!department || user.department === department));
  return <section className="leader-overview"><header className="panel-header"><div><h2>Team leader performance</h2><p>Weekly activity and delivery for tasks allocated by each leader.</p></div><label>Week starting (Sunday)<input type="date" value={week} onChange={event => { if (event.target.value) setWeek(weekStart(event.target.value)); }} /></label></header>
    <p className="leader-metric-note">Weeks run Sunday�Saturday in Riyadh time. Weekly counts use distinct tasks. Active, overdue, people, and pending approvals show the current position; completions and on-time delivery use the selected week. Task history determines allocation responsibility.</p>
    <div className="leader-overview-grid">{leaders.map(leader => {
      const metrics = leaderMetrics(tasks, leader.id, week);
      const assignedProjects = projects.filter(project => project.leaders?.some(person => person.id === leader.id));
      return <article className="leader-performance-card" key={leader.id}><header><strong>{leader.name}</strong><small>{leader.department}</small></header><div className="leader-projects"><span>Working on</span><strong>{assignedProjects.map(project => project.name).join(', ') || 'No project assigned'}</strong></div>
        <dl className="leader-metrics">{[['Requests this week',metrics.requested],['Allocated this week',metrics.allocated],['Completed this week',metrics.completed],['On time this week',metrics.onTime === null ? '�' : `${metrics.onTime}%`],['Active tasks',metrics.active],['Overdue tasks',metrics.overdue],['People with active tasks',metrics.people],['Awaiting admin approval',metrics.pending]].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <details><summary>View allocated work ({metrics.tasks.length})</summary><ul>{metrics.tasks.map(task => <li key={task.id}><strong>{task.taskCode} � {task.title}</strong><span>{task.projectName || 'No project'} � {task.status.replace(/_/g,' ')} � {task.candidateName || 'Unassigned'}</span></li>)}</ul>{!metrics.tasks.length ? <p>No recorded allocations for this leader.</p> : null}</details>
      </article>;
    })}</div>{!leaders.length ? <p className="empty-state">No team leaders in this department.</p> : null}
  </section>;
}
