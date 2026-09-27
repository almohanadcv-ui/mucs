import test from 'node:test';
import assert from 'node:assert/strict';
import { peopleForViewer } from './src/peopleVisibility.ts';
const users=[{id:'exec',role:'superadmin',department:'Executive'},{id:'admin',role:'admin',department:'A'},{id:'leader',role:'team_leader',department:'A'},{id:'worker',role:'user',department:'A'},{id:'other',role:'user',department:'B'},{id:'manager',role:'technical_manager',department:'Technical Department'},{id:'electrical',role:'team_leader',department:'Electrical Technical office engineer'},{id:'mechanical',role:'user',department:'Mechanical Technical office engineer'}];
test('executive sees everyone; admins and leaders see their whole department; technical manager sees both teams',()=>{
 const ids=role=>peopleForViewer(users,users.find(user=>user.id===role)).map(user=>user.id);
 assert.equal(ids('exec').length,users.length);
 assert.deepEqual(ids('admin'),['admin','leader','worker']);
 assert.deepEqual(ids('leader'),['admin','leader','worker']);
 assert.deepEqual(ids('manager'),['manager','electrical','mechanical']);
 assert.deepEqual(ids('electrical'),['manager','electrical']);
 assert.deepEqual(ids('worker'),['worker']);
});
