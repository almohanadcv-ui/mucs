import test from 'node:test';
import assert from 'node:assert/strict';
import { deadlineReminder, sendDeadlineReminders } from './reminders.mjs';
const task = { id:'task',task_code:'T1',title:'Delivery',department:'Electrical',status:'assigned',due_date:'2026-10-10' };
const deadline = Date.parse('2026-10-11T00:00:00+03:00');
const hour=3600000;
test('Riyadh end-of-day reminders at 24h, 1h and expiry, excluding completed and unpublished tasks',()=>{
 assert.equal(deadlineReminder(task,deadline-24*hour-1),null);
 assert.equal(deadlineReminder(task,deadline-24*hour).stage,'24h');
 assert.equal(deadlineReminder(task,deadline-hour-1).stage,'24h');
 assert.equal(deadlineReminder(task,deadline-hour).stage,'1h');
 assert.equal(deadlineReminder(task,deadline).stage,'expired');
 assert.equal(deadlineReminder({...task,status:'done'},deadline),null);
 assert.equal(deadlineReminder({...task,due_date:null},deadline),null);
 assert.equal(deadlineReminder({...task,allocation_request:{isNew:true}},deadline),null);
 assert.notEqual(deadlineReminder(task,deadline).key,deadlineReminder({...task,reopen_count:1},deadline).key);
 assert.notEqual(deadlineReminder(task,deadline).key,deadlineReminder({...task,due_date:'2026-10-09'},deadline).key);
});
test('assignees get reminders and scoped leaders get delay alerts; repeated runs use stable unique keys',async()=>{
 const notifications=new Map();
 const deps={tasks:[task,{...task,id:'done',status:'done'}],leaders:[{id:'leader',department:'Electrical'},{id:'manager',department:'Electrical'},{id:'unrelated',department:'Mechanical'}],assigneeIds:async()=>['worker','leader'],assigneeNames:async()=>['Worker One'],canLead:(user,task)=>user.department===task.department,notify:async(...args)=>notifications.set(args[6],args)};
 for(const now of [deadline-24*hour,deadline-23*hour,deadline-2*hour,deadline-hour,deadline,deadline+hour]) await sendDeadlineReminders({...deps,now});
 // 3 distinct stages (24h, 1h, expired) × (2 assignees + 2 scoped leaders) = 12 unique keys.
 assert.equal(notifications.size,12);
 assert.deepEqual([...new Set([...notifications.values()].map(args=>args[0]))].sort(),['leader','manager','worker']);
 // Leaders are notified with the 'delay' kind, assignees with 'reminder'.
 assert.ok([...notifications.values()].some(args=>args[0]==='manager'&&args[1]==='delay'));
 assert.ok([...notifications.values()].some(args=>args[0]==='worker'&&args[1]==='reminder'));
});
