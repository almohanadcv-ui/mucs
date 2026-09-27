import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";

// Runs against a disposable database, never the application's database.
test("department team leader permissions and approval lifecycle", { timeout: 60000 }, async () => {
  const databaseName = `mab_leader_test_${randomUUID().replaceAll("-", "")}`;
  const base = new URL(process.env.TEST_DATABASE_URL ?? "postgresql://mab_user@localhost:55432/postgres");
  const admin = new pg.Client({ connectionString: base.href });
  await admin.connect();
  const attachmentsPath = await mkdtemp(join(tmpdir(), "mab-attachments-test-"));
  let database;
  let server;
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    base.pathname = `/${databaseName}`;
    database = new pg.Client({ connectionString: base.href });
    await database.connect();
    const serverPort = 14000 + Math.floor(Math.random() * 10000);
    server = spawn(process.execPath, ["server.mjs"], {
      cwd: new URL(".", import.meta.url),
      env: { ...process.env, ATTACHMENTS_PATH: attachmentsPath, DATABASE_URL: base.href, PORT: String(serverPort), INITIAL_SUPERADMIN_PASSWORD: "TestPassword123" },
      stdio: ["ignore", "pipe", "pipe"], windowsHide: true
    });
    let output = "";
    server.stdout.on("data", (data) => { output += data; });
    server.stderr.on("data", (data) => { output += data; });
    for (let i = 0; i < 100 && !output.includes("MAB API listening"); i++) {
      if (server.exitCode !== null) throw new Error(output);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.match(output, /MAB API listening/, output);
    await database.query("INSERT INTO departments (id, name) VALUES ('test-a', 'Test A'), ('test-b', 'Test B')");
    for (const [id, role, department] of [["admin", "admin", "Test A"], ["other-admin", "admin", "Test B"], ["worker", "user", "Test A"], ["worker2", "user", "Test A"], ["other-worker", "user", "Test B"]]) {
      await database.query("INSERT INTO users (id,name,username,password_hash,role,department) VALUES ($1,$1,$1,'unused',$2,$3)", [id, role, department]);
    }
    async function session(id) {
      const token = randomUUID();
      await database.query("INSERT INTO sessions (token,user_id) VALUES ($1,$2)", [token, id]);
      return token;
    }
    const tokens = {};
    for (const id of ["user-superadmin", "admin", "other-admin", "worker", "worker2", "other-worker"]) tokens[id] = await session(id);
    async function call(user, path, body, expected = 200, method = body === undefined ? "GET" : "POST") {
      const response = await fetch(`http://127.0.0.1:${serverPort}/api${path}`, {
        method, headers: { Authorization: `Bearer ${tokens[user]}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      const data = await response.json();
      assert.equal(response.status, expected, `${user} ${method} ${path}: ${JSON.stringify(data)} ${response.status !== expected ? output.slice(-3000) : ""}`);
      return data;
    }
    const createLeader = { name: "Team Leader A", username: "leader-a@test.local", password: "TestPassword123", role: "team_leader", department: "Test A" };
    await call("user-superadmin", "/users/user-superadmin", { role: "team_leader", department: "Test A" }, 409, "PUT");
    assert.equal((await database.query("SELECT role FROM users WHERE id = 'user-superadmin'")).rows[0].role, "superadmin");
    for (const actor of ["admin", "user-superadmin"]) {
      const project = (await call(actor, "/projects", { name: `${actor} project`, description: "Project creation regression", department: "Test A", memberIds: ["worker"] }, 201)).project;
      assert.equal(project.department, "Test A");
      assert.deepEqual(project.members.map((member) => member.id), ["worker"]);
      assert.ok((await call(actor, "/bootstrap")).projects.some((item) => item.id === project.id));
    }
    const leader = (await call("admin", "/users", createLeader, 201)).user;
    tokens.leader = await session(leader.id);
    const otherLeader = (await call("user-superadmin", "/users", { ...createLeader, username: "leader-b@test.local", department: "Test B" }, 201)).user;
    tokens.otherLeader = await session(otherLeader.id);
    await call("leader", "/users", { ...createLeader, username: "forbidden@test.local" }, 403);
    await call("admin", "/users", { ...createLeader, role: "superadmin" }, 403);
    await call("admin", "/users/other-admin", { name: "Forbidden", role: "user" }, 403, "PUT");
    await call("admin", `/users/${otherLeader.id}`, { name: "Forbidden", role: "team_leader" }, 403, "PUT");
    await call("admin", `/users/${leader.id}`, { name: "Updated Leader", role: "team_leader" }, 200, "PUT");
    const draft = { title: "Leader task", department: "Test A", priority: "medium", assigneeIds: ["worker"], taskType: "Technical", dueDate: "2026-12-31" };
    await call("leader", "/tasks", { ...draft, assigneeIds: ["other-worker"] }, 403);
    let task = (await call("leader", "/tasks", draft, 201)).task;
    const taskPath = `/tasks/${task.id}`;
    assert.equal(task.allocationRequest.state, "pending");
    assert.deepEqual((await database.query("SELECT user_id FROM notifications WHERE task_id = $1 AND kind = 'approval_request'", [task.id])).rows.map((row) => row.user_id), ["admin"]);
    assert.deepEqual(task.assigneeIds, []);
    assert.equal(task.startedAt, undefined);
    await database.query(await readFile(new URL("../../infra/postgres/init.sql", import.meta.url), "utf8"));
    assert.equal((await database.query("SELECT allocation_request FROM tasks WHERE id = $1", [task.id])).rows[0].allocation_request.id, task.allocationRequest.id);
    assert.equal((await call("worker", "/bootstrap")).tasks.some((item) => item.id === task.id), false);
    await call("worker", `${taskPath}/claim`, {}, 409);
    await call("leader", `${taskPath}/allocation-approve`, { requestId: task.allocationRequest.id }, 403);
    await call("other-admin", `${taskPath}/allocation-approve`, { requestId: task.allocationRequest.id }, 403);
    await call("admin", `${taskPath}/allocation-approve`, { requestId: "stale" }, 409);
    task = (await call("admin", `${taskPath}/allocation-approve`, { requestId: task.allocationRequest.id })).task;
    assert.deepEqual(task.assigneeIds, ["worker"]);
    assert.equal(task.status, "assigned");
    assert.equal(task.dueDate, draft.dueDate);
    assert.ok(task.startedAt);
    task = (await call("worker", `${taskPath}/submit`, {})).task;
    assert.equal(task.status, "under_review");
    await call("admin", `${taskPath}/approve`, {}, 409);
    await call("user-superadmin", `${taskPath}/approve`, {}, 409);
    await call("otherLeader", `${taskPath}/approve`, {}, 403);
    task = (await call("leader", `${taskPath}/approve`, {})).task;
    assert.equal(task.status, "under_review");
    assert.ok(task.leaderApprovedAt);
    await call("leader", `${taskPath}/approve`, {}, 409);
    const approvals = await Promise.all(["admin", "user-superadmin"].map(async (user) => {
      const response = await fetch(`http://127.0.0.1:${serverPort}/api${taskPath}/approve`, {
        method: "POST", headers: { Authorization: `Bearer ${tokens[user]}`, "Content-Type": "application/json" }, body: "{}"
      });
      return { status: response.status, data: await response.json() };
    }));
    assert.deepEqual(approvals.map((result) => result.status).sort(), [200, 409]);
    task = approvals.find((result) => result.status === 200).data.task;
    assert.equal(task.status, "done");
    await call("otherLeader", `${taskPath}/reopen`, { comment: "No access" }, 403);
    task = (await call("leader", `${taskPath}/reopen`, { comment: "Needs correction", requiresApproval: false })).task;
    assert.equal(task.status, "in_progress");
    assert.equal(task.leaderApprovedAt, undefined);
    assert.deepEqual(task.workerApprovals, []);
    await call("leader", `${taskPath}/reopen`, { comment: "Reopen active task", requiresApproval: false });
    await call("worker", `${taskPath}/reopen`, { comment: "No access" }, 403);
    await call("leader", taskPath, { ...draft, status: "done" }, 403, "PUT");
    await call("leader", taskPath, undefined, 403, "DELETE");
    task = (await call("leader", `${taskPath}/allocation-request`, { assigneeIds: ["worker2"], dueDate: "2027-01-01" })).task;
    assert.deepEqual(task.assigneeIds, ["worker"]);
    await call("worker", `${taskPath}/submit`, {}, 409);
    task = (await call("admin", `${taskPath}/allocation-reject`, { requestId: task.allocationRequest.id })).task;
    assert.deepEqual(task.assigneeIds, ["worker"]);
    task = (await call("leader", `${taskPath}/allocation-request`, { assigneeIds: ["worker2"], dueDate: "2027-01-01" })).task;
    task = (await call("user-superadmin", `${taskPath}/allocation-approve`, { requestId: task.allocationRequest.id })).task;
    assert.deepEqual(task.assigneeIds, ["worker2"]);
    assert.equal(task.dueDate, "2027-01-01");
    await call("worker2", `${taskPath}/submit`, {});
    await call("admin", `${taskPath}/approve`, {}, 409);
    await call("leader", `${taskPath}/approve`, {});
    assert.equal((await call("admin", `${taskPath}/approve`, {})).task.status, "done");
    // Rejected new tasks remain unavailable until a revised request is approved.
    task = (await call("leader", "/tasks", draft, 201)).task;
    await call("admin", `/tasks/${task.id}/allocation-reject`, { requestId: task.allocationRequest.id });
    assert.equal((await call("worker", "/bootstrap")).tasks.some((item) => item.id === task.id), false);
    task = (await call("leader", `/tasks/${task.id}/allocation-request`, { assigneeIds: ["worker"] })).task;
    await call("admin", `/tasks/${task.id}/allocation-approve`, { requestId: task.allocationRequest.id });
    // Choosing No applies immediately; Yes waits and notifies only department admins.
    let immediate = (await call("leader", "/tasks", { ...draft, requiresApproval: false }, 201)).task;
    assert.equal(immediate.status, "assigned");
    assert.deepEqual(immediate.assigneeIds, ["worker"]);
    assert.equal(immediate.allocationRequest, undefined);
    const immediatePath = `/tasks/${immediate.id}`;
    immediate = (await call("leader", `${immediatePath}/finish`, { requiresApproval: true })).task;
    assert.equal(immediate.status, "assigned");
    assert.equal(immediate.actionRequest.action, "finish");
    assert.deepEqual((await database.query("SELECT user_id FROM notifications WHERE task_id = $1 AND kind = 'approval_request'", [immediate.id])).rows.map((row) => row.user_id), ["admin"]);
    await call("leader", `${immediatePath}/request-approve`, { requestId: immediate.actionRequest.id }, 403);
    await call("other-admin", `${immediatePath}/request-approve`, { requestId: immediate.actionRequest.id }, 403);
    await call("worker", `${immediatePath}/submit`, {}, 409);
    await call("admin", `${immediatePath}/request-approve`, { requestId: "stale" }, 409);
    immediate = (await call("admin", `${immediatePath}/request-reject`, { requestId: immediate.actionRequest.id })).task;
    assert.equal(immediate.status, "assigned");
    assert.equal(immediate.actionRequest, undefined);
    immediate = (await call("leader", `${immediatePath}/finish`, { requiresApproval: false })).task;
    assert.equal(immediate.status, "done");
    const originalReopens = immediate.reopenCount;
    immediate = (await call("leader", `${immediatePath}/reopen`, { comment: "Request correction", requiresApproval: true })).task;
    assert.equal(immediate.status, "done");
    assert.equal(immediate.reopenCount, originalReopens);
    assert.equal(immediate.actionRequest.action, "reopen");
    await database.query(await readFile(new URL("../../infra/postgres/init.sql", import.meta.url), "utf8"));
    assert.equal((await database.query("SELECT action_request FROM tasks WHERE id = $1", [immediate.id])).rows[0].action_request.id, immediate.actionRequest.id);
    assert.equal((await database.query("SELECT count(*)::int AS count FROM notifications WHERE task_id = $1 AND kind = 'approval_request' AND user_id != 'admin'", [immediate.id])).rows[0].count, 0);
    immediate = (await call("admin", `${immediatePath}/request-approve`, { requestId: immediate.actionRequest.id })).task;
    assert.equal(immediate.status, "in_progress");
    assert.equal(immediate.reopenCount, originalReopens + 1);
    assert.equal(immediate.leaderApprovedAt, undefined);
    assert.equal(immediate.actionRequest, undefined);
    await call("worker", `${immediatePath}/submit`, {});
    immediate = (await call("leader", `${immediatePath}/approve`, { requiresApproval: false })).task;
    assert.equal(immediate.status, "done");
    await call("admin", `${immediatePath}/reopen`, { comment: "Admin reopened" });
    immediate = (await call("leader", `${immediatePath}/allocation-request`, { assigneeIds: ["worker2"], requiresApproval: false })).task;
    assert.deepEqual(immediate.assigneeIds, ["worker2"]);
    assert.equal(immediate.allocationRequest, undefined);
    immediate = (await call("leader", `${immediatePath}/finish`, { requiresApproval: true })).task;
    immediate = (await call("admin", `${immediatePath}/request-approve`, { requestId: immediate.actionRequest.id })).task;
    assert.equal(immediate.status, "done");
    // Deleted assignees must not make completed tasks impossible to reopen.
    await database.query("DELETE FROM task_assignees WHERE task_id = $1", [immediate.id]);
    await database.query("UPDATE tasks SET assignee_id = NULL WHERE id = $1", [immediate.id]);
    for (const actor of ["admin", "user-superadmin", "leader"]) {
      await database.query("UPDATE tasks SET status = 'done', progress = 100, completed_at = timezone('UTC',now())::text WHERE id = $1", [immediate.id]);
      const reopened = (await call(actor, `${immediatePath}/reopen`, { comment: "Reopen without assignees", requiresApproval: false })).task;
      assert.equal(reopened.status, "new");
      assert.equal(reopened.progress, 0);
      assert.deepEqual(reopened.assigneeIds, []);
      assert.equal(reopened.completedAtIso, undefined);
    }
    await database.query("UPDATE tasks SET status = 'done' WHERE id = $1", [immediate.id]);
    immediate = (await call("leader", `${immediatePath}/reopen`, { comment: "Approval for orphaned task", requiresApproval: true })).task;
    assert.equal(immediate.status, "done");
    assert.equal((await call("admin", `${immediatePath}/request-approve`, { requestId: immediate.actionRequest.id })).task.status, "new");
    // A department without a leader keeps direct admin completion approval.
    await call("user-superadmin", `/users/${otherLeader.id}`, undefined, 200, "DELETE");
    task = (await call("other-admin", "/tasks", { ...draft, department: "Test B", assigneeIds: ["other-worker"] }, 201)).task;
    await call("other-worker", `/tasks/${task.id}/submit`, {});
    assert.equal((await call("other-admin", `/tasks/${task.id}/approve`, {})).task.status, "done");
    // Technical Managers oversee both technical departments, but no others.
    const electrical = "Electrical Technical office engineer";
    const mechanical = "Mechanical Technical office engineer";
    await database.query("INSERT INTO departments (id,name) VALUES ('electrical',$1),('mechanical',$2) ON CONFLICT DO NOTHING", [electrical, mechanical]);
    const technicalManager = (await call("user-superadmin", "/users", { ...createLeader, name: "Technical Manager", username: "technical@test.local", role: "technical_manager" }, 201)).user;
    tokens.technical = await session(technicalManager.id);
    await call("admin", "/users", { ...createLeader, username: "invalid-manager@test.local", role: "technical_manager" }, 403);
    await call("technical", "/users", { ...createLeader, username: "invalid-admin@test.local", role: "admin", department: electrical }, 403);
    await call("technical", "/users", { ...createLeader, username: "invalid-scope@test.local", department: "Test A" }, 403);
    await call("technical", "/projects", { name: "Out of scope", department: "Test A", memberIds: [] }, 403);
    const technicalProjects = [];
    for (const [index, department] of [electrical, mechanical].entries()) {
      const leaderAccount = (await call("technical", "/users", { ...createLeader, username: `technical-leader-${index}@test.local`, department }, 201)).user;
      tokens.technicalLeader = await session(leaderAccount.id);
      const project = (await call("technical", "/projects", { name: `Technical project ${index}`, department, memberIds: [] }, 201)).project;
      technicalProjects.push(project);
      const leaderPath = '/projects/' + project.id + '/leaders';
      await call('technicalLeader', leaderPath, {leaderIds:[leaderAccount.id]}, 403, 'PUT');
      await call('admin', leaderPath, {leaderIds:[leaderAccount.id]}, 403, 'PUT');
      await call('technical', leaderPath, {leaderIds:['worker']}, 400, 'PUT');
      await call('technical', leaderPath, {leaderIds:[leader.id]}, 400, 'PUT');
      for (const assigner of ['technical','user-superadmin']) {
        const assignedProject = (await call(assigner, leaderPath, {leaderIds:[leaderAccount.id,leaderAccount.id]}, 200, 'PUT')).project;
        assert.deepEqual(assignedProject.leaders.map(person => person.id), [leaderAccount.id]);
        assert.equal(assignedProject.members.length,0);
      }
      assert.ok((await call('technicalLeader','/bootstrap')).projects.find(item => item.id === project.id).leaders.some(person => person.id === leaderAccount.id));
      await call('technical',leaderPath,{leaderIds:[]},200,'PUT');
      assert.equal((await call('technical','/bootstrap')).projects.find(item => item.id === project.id).leaders.length,0);
      await call('technical',leaderPath,{leaderIds:[leaderAccount.id]},200,'PUT');
      const normal = (await call("technicalLeader", "/users", { ...createLeader, name: "New normal user", username: `new-user-${index}@test.local`, role: "user", department, projectId: project.id }, 201)).user;
      assert.equal(normal.role, "user");
      assert.equal(normal.department, department);
      let memberProject = (await call("technicalLeader", "/bootstrap")).projects.find((item) => item.id === project.id);
      assert.deepEqual(memberProject.members.map((member) => member.id), [normal.id]);
      const laterUser = (await call("technicalLeader", "/users", { ...createLeader, username: `later-user-${index}@test.local`, role: "user", department }, 201)).user;
      memberProject = (await call("technicalLeader", `/projects/${project.id}/members`, { memberIds: [laterUser.id] })).project;
      assert.equal(memberProject.members.length, 2);
      assert.ok(memberProject.members.some((member) => member.id === normal.id));
      await call("technicalLeader", `/projects/${project.id}/members`, { memberIds: [laterUser.id] });
      await call("technicalLeader", "/users", { ...createLeader, username: `forbidden-role-${index}@test.local`, department }, 403);
      await call("technicalLeader", "/projects", { name: "Not allowed", department, memberIds: [] }, 403);
      await call("technicalLeader", `/projects/${project.id}`, { name: "Not allowed", memberIds: [] }, 403, "PUT");
      await call("technicalLeader", `/projects/${project.id}`, undefined, 403, "DELETE");
      await call("technicalLeader", `/projects/${project.id}/members`, { memberIds: ["worker"] }, 400);
      const leaderTask = (await call("technicalLeader", "/tasks", { ...draft, department, projectId: project.id, assigneeIds: [normal.id], requiresApproval: true }, 201)).task;
      assert.deepEqual((await database.query("SELECT user_id FROM notifications WHERE task_id=$1 AND kind='approval_request'", [leaderTask.id])).rows.map((row) => row.user_id), [technicalManager.id]);
      await call("technical", `/tasks/${leaderTask.id}/allocation-approve`, { requestId: leaderTask.allocationRequest.id });
      await call("technical", `/projects/${project.id}`, { name: `Updated ${index}`, memberIds: [normal.id, laterUser.id] }, 200, "PUT");
    }
    const technicalData = await call("technical", "/bootstrap");
    assert.equal(technicalData.projects.length, 2);
    assert.equal(technicalData.tasks.length, 2);
    assert.ok(technicalData.tasks.every(task => task.events.some(event => event.type === "leader_allocated" && event.actorId !== technicalManager.id)));
    assert.ok(technicalData.projects.every(project => project.leaders.length === 1));
    assert.ok(technicalData.performanceTasks.every((item) => [electrical, mechanical].includes(item.department)));
    await call("technicalLeader", `/projects/${technicalProjects[0].id}/members`, { memberIds: [] }, 403);
    await call("technicalLeader", "/users", { ...createLeader, username: "invalid-project-user@test.local", role: "user", projectId: technicalProjects[0].id }, 403);
    assert.equal((await database.query("SELECT count(*)::int AS count FROM users WHERE username='invalid-project-user@test.local'")).rows[0].count, 0);
    await call("technical", "/users/worker", { name: "Not allowed", role: "user", department: electrical }, 403, "PUT");
    const adminProject = (await call('admin','/bootstrap')).projects[0];
    assert.deepEqual((await call('admin','/projects/' + adminProject.id + '/leaders',{leaderIds:[leader.id]},200,'PUT')).project.leaders.map(person => person.id),[leader.id]);
    // Parent Technical projects accept both disciplines without widening task access.
    const techUsers=(await call('technical','/bootstrap')).users;
    const electricalWorker=techUsers.find(user=>user.role==='user' && user.department===electrical);
    const mechanicalWorker=techUsers.find(user=>user.role==='user' && user.department===mechanical);
    const technicalLeaders=techUsers.filter(user=>user.role==='team_leader' && [electrical,mechanical].includes(user.department));
    const combined=(await call('technical','/projects',{name:'Combined Technical Project',department:'Technical Department',memberIds:[electricalWorker.id,mechanicalWorker.id]},201)).project;
    assert.equal(combined.members.length,2);
    assert.equal(combined.department,'Technical Department');
    const combinedPath='/projects/'+combined.id;
    await call('technical',combinedPath+'/leaders',{leaderIds:technicalLeaders.map(user=>user.id)},200,'PUT');
    assert.equal((await call('technical','/bootstrap')).projects.find(project=>project.id===combined.id).leaders.length,2);
    await call('technical',combinedPath,{name:combined.name,memberIds:[electricalWorker.id,mechanicalWorker.id]},200,'PUT');
    await call('technical',combinedPath+'/members',{memberIds:['worker']},400);
    await call('admin',combinedPath,{name:'Forbidden',memberIds:[]},403,'PUT');
    assert.ok((await call('technicalLeader','/bootstrap')).projects.some(project=>project.id===combined.id));
    await call('technicalLeader',combinedPath+'/members',{memberIds:[electricalWorker.id]},400);
    tokens.electricalWorker=await session(electricalWorker.id);
    assert.ok((await call('electricalWorker','/bootstrap')).projects.some(project=>project.id===combined.id));
    for(const worker of [electricalWorker,mechanicalWorker]) {
      const child=(await call('technical','/tasks',{...draft,projectId:combined.id,department:worker.department,assigneeIds:[worker.id]},201)).task;
      assert.equal(child.department,worker.department);
      assert.equal(child.projectId,combined.id);
    }
    await call('technical','/tasks',{...draft,projectId:combined.id,assigneeIds:[electricalWorker.id,mechanicalWorker.id]},400);
    await call('technicalLeader','/tasks',{...draft,projectId:combined.id,department:electrical,assigneeIds:[electricalWorker.id],requiresApproval:false},403);
    const superProject=(await call('user-superadmin','/projects',{name:'Executive Technical project',department:'Technical Department',memberIds:[electricalWorker.id,mechanicalWorker.id]},201)).project;
    assert.equal(superProject.members.length,2);
    // Department leaders can review free-task requests, with role/scope protection.
    const claimable = (await call('admin', '/tasks', { ...draft, assigneeIds: [] }, 201)).task;
    await call('worker', '/tasks/' + claimable.id + '/claim', {});
    assert.ok((await call('leader', '/bootstrap')).notifications.some(item => item.taskId === claimable.id && item.title === 'Task claim needs approval'));
    await call('worker2', '/tasks/' + claimable.id + '/claim-approve', { userIds: ['worker'] }, 403);
    await call('technicalLeader', '/tasks/' + claimable.id + '/claim-approve', { userIds: ['worker'] }, 403);
    const accepted = (await call('leader', '/tasks/' + claimable.id + '/claim-approve', { userIds: ['worker'] })).task;
    assert.equal(accepted.status, 'assigned');
    assert.deepEqual(accepted.assigneeIds, ['worker']);
    await call('admin', '/tasks/' + claimable.id + '/claim-approve', { userIds: ['worker'] }, 409);
    // Task-only mentions notify the selected participant and preserve sortable timestamps.
    const conversation = (await call('worker', '/bootstrap')).tasks.find(item => item.id === claimable.id);
    assert.ok(conversation.mentionableUsers.some(person => person.id === leader.id));
    assert.ok(conversation.mentionableUsers.some(person => person.id === 'admin'));
    assert.ok(!conversation.mentionableUsers.some(person => person.id === 'worker2'));
    await call('worker', '/tasks/' + claimable.id + '/messages', {body:'Hello @[worker2]'}, 400);
    await call('worker2', '/tasks/' + claimable.id + '/messages', {body:'Unassigned comment'}, 403);
    const commented = (await call('worker', '/tasks/' + claimable.id + '/messages', {body:'Please check @[Updated Leader]'})).task;
    assert.equal(commented.messages.length, 1);
    assert.ok(Number.isFinite(Date.parse(commented.messages[0].createdAtIso)));
    const mentionNotifications = (await database.query("SELECT user_id FROM notifications WHERE task_id=$1 AND kind='mention'", [claimable.id])).rows;
    assert.deepEqual(mentionNotifications.map(item => item.user_id), [leader.id]);
    const twice = (await call('leader', '/tasks/' + claimable.id + '/messages', {body:'Checking now @[worker]'})).task;
    assert.equal(twice.messages.length, 2);
    assert.ok(Date.parse(twice.messages[1].createdAtIso) >= Date.parse(twice.messages[0].createdAtIso));
    // Progress comes from completed steps, not a manually supplied percentage.
    let measured = (await call('admin','/tasks',{...draft,progress:90},201)).task;
    assert.equal(measured.progress,0);
    const checklistPath='/tasks/'+measured.id+'/checklist';
    await call('worker',checklistPath,{action:'add',title:'Not authorized'},403,'PUT');
    await call('other-admin',checklistPath,{action:'add',title:'Wrong department'},404,'PUT');
    measured=(await call('leader',checklistPath,{action:'add',title:'Prepare drawings'},200,'PUT')).task;
    measured=(await call('admin',checklistPath,{action:'add',title:'Verify quantities'},200,'PUT')).task;
    const [step1,step2]=measured.checklist;
    await call('worker2',checklistPath,{action:'toggle',id:step1.id,completed:true},404,'PUT');
    measured=(await call('worker',checklistPath,{action:'toggle',id:step1.id,completed:true},200,'PUT')).task;
    assert.equal(measured.progress,50);
    await call('worker',checklistPath,{action:'edit',id:step1.id,title:'Changed'},403,'PUT');
    measured=(await call('leader',checklistPath,{action:'edit',id:step1.id,title:'Prepare revised drawings'},200,'PUT')).task;
    assert.equal(measured.checklist[0].title,'Prepare revised drawings');
    assert.equal(measured.progress,0);
    await call('worker',checklistPath,{action:'toggle',id:step1.id,completed:true},200,'PUT');
    measured=(await call('worker',checklistPath,{action:'toggle',id:step2.id,completed:true},200,'PUT')).task;
    assert.equal(measured.progress,100);
    assert.notEqual(measured.status,'done');
    measured=(await call('worker','/tasks/'+measured.id+'/submit',{})).task;
    assert.equal(measured.status,'under_review');
    await call('leader',checklistPath,{action:'toggle',id:step2.id,completed:false},409,'PUT');
    measured=(await call('leader','/tasks/'+measured.id+'/approve',{requiresApproval:false})).task;
    assert.equal(measured.status,'done');
    measured=(await call('admin','/tasks/'+measured.id+'/reopen',{comment:'Verify again'})).task;
    assert.equal(measured.progress,0);
    assert.ok(measured.checklist.every(step=>!step.completed));
    // Optional steps do not prevent submission. Documents retain their purpose.
    const instructionFile={name:'instructions.txt',mimeType:'text/plain',data:Buffer.from('Task instructions').toString('base64')};
    let documented=(await call('admin','/tasks',{...draft,files:[instructionFile],checklist:[{title:'Prepare drawing',completed:true},{title:'Review quantities'}]},201)).task;
    assert.equal(documented.checklist.length,2);
    assert.deepEqual(documented.checklist.map(step=>step.title),['Prepare drawing','Review quantities']);
    assert.ok(documented.checklist.every(step=>!step.completed));
    assert.equal(documented.progress,0);
    const initialPending=(await call('leader','/tasks',{...draft,checklist:[{title:'Pending allocation step'}],requiresApproval:true},201)).task;
    assert.equal(initialPending.checklist[0].title,'Pending allocation step');
    assert.equal(initialPending.progress,0);
    await call('admin','/tasks',{...draft,checklist:[{title:' '}]},400);
    assert.equal(documented.files[0].category,'task');
    assert.equal(documented.files[0].name,'instructions.txt');
    const optionalPath='/tasks/'+documented.id;
    await call('leader',optionalPath+'/checklist',{action:'add',title:'Optional guide step'},200,'PUT');
    await call('worker',optionalPath+'/files',{files:[instructionFile],category:'task'},403);
    documented=(await call('worker',optionalPath+'/files',{files:[{...instructionFile,name:'delivery.txt'}],category:'completion'})).task;
    assert.deepEqual(documented.files.map(file=>file.category),['task','completion']);
    const originalFile=documented.files[0];
    await call('worker','/files/'+originalFile.id,{name:'Not allowed.txt',category:'reference'},403,'PUT');
    await call('other-admin','/files/'+originalFile.id,undefined,403,'DELETE');
    documented=(await call('worker',optionalPath+'/files',{files:[{...instructionFile,name:'help-request.pdf'}],category:'reference'})).task;
    const helpReference=documented.files.find(file=>file.name==='help-request.pdf');
    assert.equal(helpReference.category,'reference');
    assert.equal(helpReference.uploadedBy,'worker');
    await call('leader','/files/'+originalFile.id,{name:'Reference drawing.txt',category:'reference'},200,'PUT');
    documented=(await call('admin','/bootstrap')).tasks.find(task=>task.id===documented.id);
    assert.equal(documented.files.find(file=>file.id===originalFile.id).category,'reference');
    const referenceFile=documented.files.find(file=>file.id===originalFile.id);
    await call('admin','/files/'+referenceFile.id,{name:'Revised drawing.txt',category:'reference',file:{...instructionFile,data:Buffer.from('Revised file').toString('base64')}},200,'PUT');
    documented=(await call('worker','/bootstrap')).tasks.find(task=>task.id===documented.id);
    const replacement=documented.files.find(file=>file.name==='Revised drawing.txt');
    assert.ok(replacement);
    assert.equal(replacement.category,'reference');
    assert.ok(!documented.files.some(file=>file.id===originalFile.id));
    const download=await fetch('http://127.0.0.1:'+serverPort+'/api/files/'+replacement.id+'/download',{headers:{Authorization:'Bearer '+tokens.worker}});
    assert.equal(download.status,200);
    assert.equal(await download.text(),'Revised file');
    await call('worker','/files/'+replacement.id,undefined,403,'DELETE');
    await call('leader','/files/'+replacement.id,undefined,200,'DELETE');
    assert.ok(!(await call('admin','/bootstrap')).tasks.find(task=>task.id===documented.id).files.some(file=>file.id===replacement.id));
    const submittedOptional=(await call('worker',optionalPath+'/submit',{})).task;
    assert.equal(submittedOptional.status,'under_review');
    assert.equal(submittedOptional.progress,100);
    assert.equal(submittedOptional.checklist[0].completed,false);
    // Bulk deletion is limited to the signed-in user's TODOs, including finished items.
    const ownTodo=(await call('worker','/todos',{title:'Own active item'},201)).todo;
    await call('worker','/todos',{title:'Own second item'},201);
    await call('worker','/todos/'+ownTodo.id,{completed:true},200,'PUT');
    const otherTodo=(await call('worker2','/todos',{title:'Other person item'},201)).todo;
    assert.equal((await call('worker','/todos',undefined,200,'DELETE')).deleted,2);
    assert.equal((await call('worker','/bootstrap')).todos.length,0);
    assert.ok((await call('worker2','/bootstrap')).todos.some(item=>item.id===otherTodo.id));
    assert.equal((await call('worker','/todos',undefined,200,'DELETE')).deleted,0);
    // Totals cover all records, while preview lists stay bounded, for every role.
    for (const actor of ['worker', 'admin', 'leader', 'technical', 'user-superadmin']) {
      const data = await call(actor, '/bootstrap');
      const userId = data.currentUser.id;
      await database.query('DELETE FROM notifications WHERE user_id=$1', [userId]);
      await database.query("INSERT INTO notifications (id,user_id,kind,title,body) SELECT $1 || '-' || n, $1, 'test', 'Count test', 'Test' FROM generate_series(1,35) n", [userId]);
      const counted = await call(actor, '/bootstrap');
      assert.equal(counted.notifications.length, 30);
      assert.equal(counted.unreadNotificationCount, 35);
      assert.equal((await call(actor, '/notifications/' + userId + '-1/read', {})).unreadCount, 34);
      assert.equal((await call(actor, '/notifications/read', {})).unreadCount, 0);
      assert.equal((await call(actor, '/bootstrap')).unreadNotificationCount, 0);
      for (const project of counted.projects) assert.equal(project.taskCount, counted.tasks.filter(task => task.projectId === project.id).length);
    }
    const chatData = await call('worker', '/bootstrap');
    const channelId = chatData.chatChannels.find(channel => !channel.isGroup && !channel.isDirect).id;
    await database.query('DELETE FROM chat_reads WHERE user_id=$1 AND channel_id=$2', ['worker', channelId]);
    await database.query("INSERT INTO chat_messages (id,channel_id,department,author_id,author_name,body) SELECT 'count-chat-' || n, $1, 'Test A', 'admin', 'Admin', 'Test' FROM generate_series(1,160) n", [channelId]);
    await database.query("UPDATE chat_messages SET deleted_at=created_at WHERE id='count-chat-1'");
    await database.query("UPDATE chat_messages SET author_id='worker' WHERE id='count-chat-2'");
    await database.query("INSERT INTO chat_message_hidden (message_id,user_id) VALUES ('count-chat-3','worker')");
    assert.equal((await call('worker', '/bootstrap')).chatChannels.find(channel => channel.id === channelId).unreadCount,157);
    await call('worker', '/chat/read', {channelId});
    assert.equal((await call('worker', '/bootstrap')).chatChannels.find(channel => channel.id === channelId).unreadCount,0);
    // No admin: never silently reroute approval notifications to super admins.
    await database.query("INSERT INTO departments (id,name) VALUES ('test-c','Test C')");
    const isolatedLeader = (await call("user-superadmin", "/users", { ...createLeader, username: "leader-c@test.local", department: "Test C" }, 201)).user;
    tokens.isolatedLeader = await session(isolatedLeader.id);
    const isolatedDraft = { ...draft, department: "Test C", assigneeIds: [], requiresApproval: true };
    await call("isolatedLeader", "/tasks", isolatedDraft, 409);
    assert.equal((await database.query("SELECT count(*)::int AS count FROM tasks WHERE department = 'Test C'")).rows[0].count, 0);
    const isolated = (await call("isolatedLeader", "/tasks", { ...isolatedDraft, requiresApproval: false }, 201)).task;
    await database.query("UPDATE tasks SET status = 'done' WHERE id = $1", [isolated.id]);
    await call("isolatedLeader", `/tasks/${isolated.id}/reopen`, { comment: "No admin available", requiresApproval: true }, 409);
    const unchanged = (await database.query("SELECT status,action_request FROM tasks WHERE id = $1", [isolated.id])).rows[0];
    assert.equal(unchanged.status, "done");
    assert.equal(unchanged.action_request, null);
    assert.equal((await call("isolatedLeader", `/tasks/${isolated.id}/reopen`, { comment: "Apply directly", requiresApproval: false })).task.status, "new");
  } finally {
    if (server && server.exitCode === null) {
      const stopped = once(server, "exit");
      server.kill();
      await stopped;
    }
    await rm(attachmentsPath, { recursive: true, force: true });
    await database?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
    await admin.end();
  }
});
