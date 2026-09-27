import test from 'node:test';
import assert from 'node:assert/strict';
import { deadlineReminder, sendDeadlineReminders } from './reminders.mjs';
const task = { id:'task',task_code:'T1',title:'Delivery',department:'Electrical',status:'assigned',due_date:'2026-10-10' };
const deadline = Date.parse('2026-10-11T00:00:00+03:00');
const hour=3600000;
test('Riyadh end-of-day reminders at 24h, 2h and expiry, excluding completed and unpublished tasks',()=>{
 assert.equal(deadlineReminder(task,deadline-24*hour-1),null);
 assert.equal(deadlineReminder(task,deadline-24*hour).stage,'24h');
 assert.equal(deadlineReminder(task,deadline-2*hour-1).stage,'24h');
 assert.equal(deadlineReminder(task,deadline-2*hour).stage,'2h');
 assert.equal(deadlineReminder(task,deadline).stage,'expired');
 assert.equal(deadlineReminder({...task,status:'done'},deadline),null);
 assert.equal(deadlineReminder({...task,due_date:null},deadline),null);
 assert.equal(deadlineReminder({...task,allocation_request:{isNew:true}},deadline),null);
 assert.notEqual(deadlineReminder(task,deadline).key,deadlineReminder({...task,reopen_count:1},deadline).key);
 assert.notEqual(deadlineReminder(task,deadline).key,deadlineReminder({...task,due_date:'2026-10-09'},deadline).key);
});
test('audience includes assigned people and scoped leaders; repeated runs use stable unique keys',async()=>{
 const notifications=new Map();
 const deps={tasks:[task,{...task,id:'done',status:'done'}],leaders:[{id:'leader',department:'Electrical'},{id:'manager',department:'Electrical'},{id:'unrelated',department:'Mechanical'}],assigneeIds:async()=>['worker','leader'],canLead:(user,task)=>user.department===task.department,notify:async(...args)=>notifications.set(args[6],args)};
 for(const now of [deadline-24*hour,deadline-23*hour,deadline-2*hour,deadline-hour,deadline,deadline+hour]) await sendDeadlineReminders({...deps,now});
 assert.equal(notifications.size,9);
 assert.deepEqual([...new Set([...notifications.values()].map(args=>args[0]))].sort(),['leader','manager','worker']);
});
