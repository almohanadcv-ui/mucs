import test from 'node:test';
import assert from 'node:assert/strict';
import {leaderMetrics,weekStart} from './src/leaderMetrics.ts';
const event=(type,actorId,date,details='')=>({type,actorId,createdAtIso:date,details});
const base={id:'t1',events:[],status:'assigned',assigneeIds:['worker'],dueDate:'2026-09-29'};
test('Sunday Riyadh week and distinct requests versus approved allocations',()=>{
 assert.equal(weekStart('2026-09-30'),'2026-09-27');
 const task={...base,events:[event('allocation_requested','leader','2026-09-26T21:00:00Z'),event('allocation_requested','leader','2026-09-28T00:00:00Z'),event('leader_allocated','leader','2026-09-29T00:00:00Z'),event('allocation_approved','admin','2026-09-29T00:00:00Z')]};
 const result=leaderMetrics([task], 'leader','2026-09-27',new Date('2026-09-30T00:00:00Z'));
 assert.equal(result.requested,1);assert.equal(result.allocated,1);assert.equal(result.active,1);assert.equal(result.overdue,1);assert.equal(result.people,1);
 assert.equal(leaderMetrics([task],'other','2026-09-27').allocated,0);
});
test('pending, legacy approvals, transfers, completion dates and deadline eligibility',()=>{
 const tasks=[{...base,allocationRequest:{requesterId:'leader',state:'pending'},events:[event('allocation_requested','leader','2026-09-28T00:00:00Z')]},
 {...base,id:'done',status:'done',completedAtIso:'2026-09-29T21:10:00Z',events:[event('allocation_requested','leader','2026-09-20T00:00:00Z'),event('allocation_approved','admin','2026-09-21T00:00:00Z')]},
 {...base,id:'transfer',events:[event('created','leader','2026-09-28T00:00:00Z','Task created and assigned to 1 user(s)'),event('reassigned','admin','2026-09-29T00:00:00Z')]},
 {...base,id:'no-date',dueDate:'',status:'done',completedAtIso:'2026-09-30T10:00:00Z',events:[event('claim_approved','leader','2026-09-28T00:00:00Z')]}];
 const result=leaderMetrics(tasks,'leader','2026-09-27');
 assert.equal(result.pending,1);assert.equal(result.requested,1);assert.equal(result.allocated,2);assert.equal(result.completed,2);assert.equal(result.onTime,0);assert.equal(result.active,0);
 assert.equal(result.tasks.some(task=>task.id==='transfer'),false);
});
