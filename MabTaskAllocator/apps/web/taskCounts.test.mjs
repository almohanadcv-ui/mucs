import test from 'node:test';
import assert from 'node:assert/strict';
import { archiveProjects, archiveSummary, filterArchive, isFreeTask, needsReview } from './src/taskCounts.ts';
const blank = {taskId:'',projectId:'',priority:'',assigneeId:'',from:'',to:''};
const task = {status:'done',taskCode:'MAB-104',assigneeIds:['u'],priority:'medium',completedAtIso:'2026-09-10T12:00:00Z',dueDate:'2026-09-11',projectId:'p',projectName:'Tower'};
test('project filter includes legacy projects and unlinked tasks with accurate summaries',()=>{
 const tasks=[task,{...task,projectId:'q',projectName:'Office',dueDate:'2026-09-09'},{...task,projectId:undefined,projectName:undefined,dueDate:''},{...task,status:'new'}];
 const finished=filterArchive(tasks,blank);
 assert.equal(finished.length,3);
 assert.deepEqual(archiveProjects(finished).map(p=>p.count),[1,1,1]);
 assert.equal(filterArchive(tasks,{...blank,projectId:'p'}).length,1);
 assert.equal(filterArchive(tasks,{...blank,projectId:'__none__'}).length,1);
 assert.equal(filterArchive(tasks,{...blank,projectId:'q',taskId:'104',assigneeId:'u',from:'2026-09-10',to:'2026-09-10'}).length,1);
 assert.deepEqual(archiveSummary(finished,new Date('2026-09-20T12:00:00Z')),{total:3,thisMonth:3,onTimePercent:50});
 assert.equal(archiveSummary([]).onTimePercent,null);
 assert.equal(filterArchive([{...task,completedAtIso:undefined}],{...blank,from:'2026-01-01'}).length,0);
});
test('pending allocations are not free tasks and overlapping review reasons count once',()=>{
 const free={...task,status:'new',assigneeIds:[]};
 assert.equal(isFreeTask(free),true);
 assert.equal(isFreeTask({...free,allocationRequest:{isNew:true,state:'pending'}}),false);
 assert.equal(isFreeTask({...free,allocationRequest:{isNew:true,state:'rejected'}}),false);
 assert.equal([ {...task,status:'under_review',actionRequest:{state:'pending'}},task ].filter(needsReview).length,1);
});
