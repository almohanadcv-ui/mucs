import { sendDeadlineReminders } from "./reminders.mjs";
import { createServer } from "node:http";
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { AsyncLocalStorage } from "node:async_hooks";
import pg from "pg";
import ExcelJS from "exceljs";
import { buildOperationalIntelligence } from "./intelligence.mjs";
import { sendEmail, isMailConfigured } from "./email.mjs";
import { notificationEmail, deviceCodeEmail } from "./email-templates.mjs";

// Load apps/api/.env into process.env (Node strips surrounding quotes). The app
// is started as a bare `node server.mjs` with no dotenv, so without this the
// .env file would be ignored. Existing environment variables take precedence.
try {
  process.loadEnvFile(fileURLToPath(new URL("./.env", import.meta.url)));
} catch {
  // No .env file (e.g. env injected another way) — carry on with process.env.
}

function fail(status, message) { throw Object.assign(new Error(message), { status }); }

const { Pool } = pg;
const port = Number(process.env.PORT ?? 4000);
const appDirectory = dirname(fileURLToPath(import.meta.url));
const attachmentsPath = resolve(process.env.ATTACHMENTS_PATH ?? join(appDirectory, "data", "attachments"));
// Stay signed in on a (verified) device — long idle window, overridable.
const sessionIdleMinutes = Number(process.env.SESSION_IDLE_MINUTES) || 30 * 24 * 60;
// New-device email verification: OFF unless DEVICE_VERIFICATION=1 (so it can
// never block sign-in). Turn it on again once the code screen is confirmed.
const deviceVerificationEnabled = process.env.DEVICE_VERIFICATION === "1";
const maxFileSize = 10 * 1024 * 1024;
const maxFilesPerUpload = 5;
const isProduction = process.env.NODE_ENV === "production";
const corsOrigins = String(process.env.CORS_ORIGINS ?? "").split(",").map((origin) => origin.trim()).filter(Boolean);
// Public app URL used to build deep links inside notification emails.
const appUrl = String(process.env.APP_URL ?? corsOrigins[0] ?? "").replace(/\/$/, "");
function appLink(taskId) {
  if (!appUrl) return "";
  return taskId ? `${appUrl}/?task=${encodeURIComponent(taskId)}` : appUrl;
}
const taskTypes = ["Technical", "QS", "Shop Drawings", "BIM", "Variation"];
const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://mab_user@localhost:55432/mab_task_allocator";

mkdirSync(attachmentsPath, { recursive: true });

const pool = new Pool({
  connectionString,
  max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined
});
pool.on("error", (error) => console.error("Unexpected PostgreSQL pool error", error));

const schemaSql = readFileSync(new URL("../../infra/postgres/init.sql", import.meta.url), "utf8");
await pool.query(schemaSql);
const queryContext = new AsyncLocalStorage();

function executeQuery(text, values = []) {
  return (queryContext.getStore() ?? pool).query(text, values);
}

function translateSql(sql) {
  let text = String(sql);
  const ignoreConflicts = /INSERT\s+OR\s+IGNORE/i.test(text);
  text = text
    .replace(/INSERT\s+OR\s+IGNORE/gi, "INSERT")
    .replace(/\s+COLLATE\s+NOCASE/gi, "")
    .replace(/datetime\('now',\s*'-10 minutes'\)/gi, "(timezone('UTC', now() - interval '10 minutes')::text)")
    .replace(/CURRENT_TIMESTAMP/gi, "(timezone('UTC', now())::text)")
    .replace(/MIN\(progress,\s*90\)/gi, "LEAST(progress, 90)")
    .replace(/count\(\*\)\s+AS\s+count/gi, "count(*)::int AS count");

  let parameter = 0;
  text = text.replace(/\?/g, () => "$" + (++parameter));
  if (ignoreConflicts) text = text.trim().replace(/;$/, "") + " ON CONFLICT DO NOTHING";
  return text;
}

const db = {
  prepare(sql) {
    const text = translateSql(sql);
    return {
      async all(...values) {
        return (await executeQuery(text, values)).rows;
      },
      async get(...values) {
        return (await executeQuery(text, values)).rows[0];
      },
      async run(...values) {
        const result = await executeQuery(text, values);
        return { changes: result.rowCount ?? 0 };
      }
    };
  },
  exec(sql) {
    return executeQuery(translateSql(sql));
  },
  async transaction(work) {
    const activeClient = queryContext.getStore();
    if (activeClient) {
      const savepoint = "nested_" + randomUUID().replaceAll("-", "");
      await activeClient.query("SAVEPOINT " + savepoint);
      try {
        const result = await work();
        await activeClient.query("RELEASE SAVEPOINT " + savepoint);
        return result;
      } catch (error) {
        await activeClient.query("ROLLBACK TO SAVEPOINT " + savepoint);
        await activeClient.query("RELEASE SAVEPOINT " + savepoint);
        throw error;
      }
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await queryContext.run(client, work);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
};
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function passwordMatches(password, storedHash) {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  const stored = Buffer.from(key, "hex");
  const supplied = scryptSync(password, salt, stored.length);
  return stored.length === supplied.length && timingSafeEqual(stored, supplied);
}

function validatePassword(password) {
  if (password.length < 10 || !/[a-z]/i.test(password) || !/\d/.test(password)) {
    const error = new Error("Passwords must contain at least 10 characters, including a letter and a number.");
    error.status = 400;
    throw error;
  }
}

const superadminExists = await db.prepare("SELECT id FROM users WHERE role = 'superadmin' LIMIT 1").get();
if (!superadminExists) {
  const initialPassword = process.env.INITIAL_SUPERADMIN_PASSWORD || (isProduction ? "" : "jadjadjad1");
  if (!initialPassword) throw new Error("INITIAL_SUPERADMIN_PASSWORD is required when creating the first production superadmin.");
  validatePassword(initialPassword);
  await db.prepare(`
    INSERT INTO users (id, name, username, password_hash, role, department)
    VALUES (?, ?, ?, ?, 'superadmin', 'Executive')
  `).run("user-superadmin", process.env.INITIAL_SUPERADMIN_NAME || "J. Chehade", process.env.INITIAL_SUPERADMIN_USERNAME || "j.chehade@mabunited.com", hashPassword(initialPassword));
}

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    department: row.department
  };
}

function sameDepartment(first, second) {
  return String(first ?? "").trim().toLocaleLowerCase() === String(second ?? "").trim().toLocaleLowerCase();
}

function riyadhDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

async function recordAttendance(userId, countLogin = false) {
  await db.prepare(`
    INSERT INTO attendance_records (user_id, work_date) VALUES (?, ?)
    ON CONFLICT (user_id, work_date) DO UPDATE SET
      last_login_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE attendance_records.last_login_at END,
      login_count = attendance_records.login_count + ?
  `).run(userId, riyadhDate(), countLogin ? 1 : 0, countLogin ? 1 : 0);
}

function formatDate(value) {
  if (!value) return undefined;
  // Stored timestamps are UTC; show them in Riyadh time (not the server's UTC),
  // otherwise every time reads 3 hours early for users here.
  return new Date(`${value.replace(" ", "T")}Z`).toLocaleString("en-US", {
    timeZone: "Asia/Riyadh",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

function isoDateTime(value) {
  if (!value) return undefined;
  return new Date(`${value.replace(" ", "T")}Z`).toISOString();
}

async function getTask(taskId) {
  return await db.prepare(`
    SELECT tasks.*, projects.name AS project_name
    FROM tasks LEFT JOIN projects ON projects.id = tasks.project_id
    WHERE tasks.id = ?
  `).get(taskId);
}

async function recordTaskEvent(taskId, actor, eventType, details = "") {
  await db.prepare(`
    INSERT INTO task_events (id, task_id, actor_id, actor_name, event_type, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), taskId, actor?.id ?? null, actor?.name ?? "System", eventType, String(details).slice(0, 1000));
}

async function audit(actor, action, entityType, entityId, department, details = "") {
  await db.prepare(`
    INSERT INTO system_audit_logs (id, actor_id, actor_name, action, entity_type, entity_id, department, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(randomUUID(), actor?.id ?? null, actor?.name ?? "System", action, entityType, entityId ?? null, department ?? null, String(details).slice(0, 2000));
}

async function todosFor(userId) {
  return (await db.prepare(`
    SELECT todos.*, tasks.task_code, tasks.title AS task_title
    FROM todos LEFT JOIN tasks ON tasks.id = todos.task_id
    WHERE todos.user_id = ?
    ORDER BY todos.is_completed ASC, todos.created_at DESC
  `).all(userId)).map((todo) => ({
    id: todo.id,
    title: todo.title,
    completed: Boolean(todo.is_completed),
    taskId: todo.task_id ?? undefined,
    taskCode: todo.task_code ?? undefined,
    taskTitle: todo.task_title ?? undefined,
    createdAt: formatDate(todo.created_at),
    completedAt: formatDate(todo.completed_at)
  }));
}

async function serializeTask(row) {
  const reopenCount = (await db.prepare("SELECT count(*) AS count FROM task_reopen_events WHERE task_id = ?").get(row.id)).count;
  const events = (await db.prepare(`
    SELECT id, actor_id, actor_name, event_type, details, created_at
    FROM task_events WHERE task_id = ? ORDER BY created_at ASC
  `).all(row.id)).map((event) => ({
    id: event.id,
    actorId: event.actor_id ?? undefined,
    actorName: event.actor_name,
    type: event.event_type,
    details: event.details,
    createdAt: formatDate(event.created_at),
    createdAtIso: isoDateTime(event.created_at)
  }));
  const messages = (await db.prepare(`
    SELECT id, author_id, author_name, body, created_at FROM task_messages
    WHERE task_id = ? ORDER BY created_at ASC
  `).all(row.id)).map((message) => ({
    id: message.id,
    authorId: message.author_id ?? "deleted-user",
    authorName: message.author_name,
    body: message.body,
    createdAt: formatDate(message.created_at),
    createdAtIso: isoDateTime(message.created_at)
  }));
  const assignees = await db.prepare(`
    SELECT users.id, users.name FROM task_assignees
    JOIN users ON users.id = task_assignees.user_id
    WHERE task_assignees.task_id = ? ORDER BY users.name
  `).all(row.id);
  const approvals = await db.prepare(`
    SELECT users.id, users.name, task_worker_approvals.approved_at
    FROM task_worker_approvals JOIN users ON users.id = task_worker_approvals.user_id
    WHERE task_worker_approvals.task_id = ? ORDER BY task_worker_approvals.approved_at
  `).all(row.id);
  const approvedIds = approvals.map((approval) => approval.id);
  const claimRequester = row.claim_requested_by_id
    ? await db.prepare("SELECT id, name FROM users WHERE id = ? AND role = 'user'").get(row.claim_requested_by_id)
    : null;
  const claimRequests = await db.prepare(`
    SELECT users.id, users.name, task_claim_requests.requested_at
    FROM task_claim_requests JOIN users ON users.id = task_claim_requests.user_id
    WHERE task_claim_requests.task_id = ? AND users.role = 'user'
    ORDER BY task_claim_requests.requested_at ASC
  `).all(row.id);
  const files = (await db.prepare(`
    SELECT id, name, uploaded_by, uploaded_at, mime_type, size, category FROM task_files
    WHERE task_id = ? ORDER BY uploaded_at ASC
  `).all(row.id)).map((file) => ({
    id: file.id,
    name: file.name,
    category: file.category,
    uploadedBy: file.uploaded_by,
    uploadedAt: formatDate(file.uploaded_at),
    mimeType: file.mime_type ?? "application/octet-stream",
    size: file.size ?? 0
  }));

  return {
    id: row.id,
    taskCode: row.task_code,
    title: row.title,
    department: row.department,
    priority: row.priority,
    status: row.status,
    allocationRequest: row.allocation_request ?? undefined,
    actionRequest: row.action_request ?? undefined,
    leaderApprovedById: row.leader_approved_by_id ?? undefined,
    leaderApprovedAt: isoDateTime(row.leader_approved_at),
    assigneeId: assignees[0]?.id ?? row.assignee_id ?? undefined,
    assigneeIds: assignees.map((assignee) => assignee.id),
    candidateName: assignees.map((assignee) => assignee.name).join(", ") || "Unassigned",
    candidateNames: assignees.map((assignee) => assignee.name),
    workerApprovals: approvals.map((approval) => ({ id: approval.id, name: approval.name, approvedAt: isoDateTime(approval.approved_at) })),
    pendingApprovalNames: assignees.filter((assignee) => !approvedIds.includes(assignee.id)).map((assignee) => assignee.name),
    claimRequest: claimRequester ? {
      userId: claimRequester.id,
      userName: claimRequester.name,
      requestedAt: isoDateTime(row.claim_requested_at)
    } : undefined,
    claimRequests: claimRequests.map((request) => ({
      userId: request.id,
      userName: request.name,
      requestedAt: isoDateTime(request.requested_at)
    })),
    projectId: row.project_id ?? undefined,
    projectName: row.project_name ?? undefined,
    taskType: row.task_type ?? "Technical",
    complexity: normalizeComplexity(row.complexity),
    reopenCount,
    events,
    startedAt: isoDateTime(row.started_at),
    dueDate: row.due_date ?? "",
    progress: row.progress,
    checklist: (row.checklist ?? []).map((item) => ({
      ...item,
      assigneeName: item.assigneeId ? assignees.find((assignee) => assignee.id === item.assigneeId)?.name : undefined
    })),
    reviewComment: row.review_comment ?? undefined,
    completedAt: formatDate(row.completed_at),
    completedAtIso: isoDateTime(row.completed_at),
    createdAt: isoDateTime(row.created_at),
    updatedAt: isoDateTime(row.updated_at),
    files,
    messages,
    mentionableUsers: (await taskConversationPeople(row)).map(user => ({ id: user.id, name: user.name }))
  };
}

async function serializePerformanceTask(row) {
  const assigneeIds = await taskAssigneeIds(row.id);
  const reopenCount = (await db.prepare("SELECT count(*) AS count FROM task_reopen_events WHERE task_id = ?").get(row.id)).count;
  return {
    id: row.id,
    department: row.department,
    status: row.status,
    priority: row.priority,
    taskType: row.task_type ?? "Technical",
    progress: row.progress,
    complexity: normalizeComplexity(row.complexity),
    startedAt: isoDateTime(row.started_at),
    createdAt: isoDateTime(row.created_at),
    completedAtIso: isoDateTime(row.completed_at),
    dueDate: row.due_date ?? "",
    assigneeIds,
    reopenCount
  };
}

async function serializePerformanceTasks(rows) {
  if (!rows.length) return [];
  const placeholders = rows.map(() => "?").join(",");
  const ids = rows.map((row) => row.id);
  const assigneeRows = await db.prepare(`SELECT task_id, user_id FROM task_assignees WHERE task_id IN (${placeholders})`).all(...ids);
  const reopenRows = await db.prepare(`SELECT task_id, count(*) AS count FROM task_reopen_events WHERE task_id IN (${placeholders}) GROUP BY task_id`).all(...ids);
  const assigneesByTask = new Map();
  for (const assignee of assigneeRows) {
    const list = assigneesByTask.get(assignee.task_id) ?? [];
    list.push(assignee.user_id);
    assigneesByTask.set(assignee.task_id, list);
  }
  const reopensByTask = new Map(reopenRows.map((row) => [row.task_id, row.count]));
  return rows.map((row) => ({
    id: row.id,
    department: row.department,
    status: row.status,
    priority: row.priority,
    taskType: row.task_type ?? "Technical",
    progress: row.progress,
    complexity: normalizeComplexity(row.complexity),
    startedAt: isoDateTime(row.started_at),
    createdAt: isoDateTime(row.created_at),
    completedAtIso: isoDateTime(row.completed_at),
    dueDate: row.due_date ?? "",
    assigneeIds: assigneesByTask.get(row.id) ?? [],
    reopenCount: reopensByTask.get(row.id) ?? 0
  }));
}

async function projectsFor(actor) {
  const rows = actor.role === "superadmin"
    ? await db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all()
    : ["admin", "technical_manager", "team_leader"].includes(actor.role)
      ? await db.prepare("SELECT * FROM projects WHERE lower(trim(department)) = ANY(?::text[]) ORDER BY created_at DESC").all([...departmentScope(actor), ...(actor.role === "technical_manager" || actor.role === "team_leader" && technicalDepartments.some(name => sameDepartment(name, actor.department)) ? ["technical department"] : [])])
      : await db.prepare(`
          SELECT projects.* FROM projects JOIN project_members ON project_members.project_id = projects.id
          WHERE project_members.user_id = ? ORDER BY projects.created_at DESC
        `).all(actor.id);
  return Promise.all(rows.map(async (project) => {
    const members = (await db.prepare(`
      SELECT users.id, users.name, users.username, users.role, users.department
      FROM project_members JOIN users ON users.id = project_members.user_id
      WHERE project_members.project_id = ? ORDER BY users.name
    `).all(project.id)).map(publicUser);
    const projectTasks = await db.prepare("SELECT id, department, allocation_request FROM tasks WHERE project_id = ?").all(project.id);
    let taskCount = 0;
    for (const task of projectTasks) if (await canView(actor, task)) taskCount++;
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      department: project.department,
      createdAt: isoDateTime(project.created_at),
      members,
      leaders: (await db.prepare("SELECT users.* FROM project_leaders JOIN users ON users.id = project_leaders.user_id WHERE project_id = ? AND users.role = 'team_leader' ORDER BY users.name").all(project.id)).filter(user => projectIncludes(project.department, user.department)).map(publicUser),
      taskCount
    };
  }));
}

function normalizeTaskType(value) {
  const requested = String(value ?? "Technical").trim().toLowerCase();
  if (requested === "varation") return "Variation";
  return taskTypes.find((type) => type.toLowerCase() === requested) ?? "Technical";
}

function codeInitials(value, fallback) {
  const initials = String(value ?? "").match(/[A-Za-z0-9]+/g)?.map((word) => word[0]).join("").toUpperCase();
  return (initials || fallback).slice(0, 5);
}

async function generateTaskCode(projectName, department) {
  const projectCode = codeInitials(projectName, "GEN");
  const departmentCode = String(department).startsWith("Electrical") ? "E"
    : String(department).startsWith("Mechanical") ? "M"
      : String(department).startsWith("Document") ? "D"
        : codeInitials(department, "D").slice(0, 2);
  const prefix = `${projectCode}${departmentCode}`;
  const result = await executeQuery(`
    INSERT INTO task_code_sequences (prefix, next_number)
    VALUES ($1, 2)
    ON CONFLICT (prefix) DO UPDATE
      SET next_number = task_code_sequences.next_number + 1
    RETURNING next_number - 1 AS number
  `, [prefix]);
  const number = result.rows[0].number;
  return `${prefix}-${String(number).padStart(2, "0")}`;
}

function normalizeComplexity(value) {
  return Math.min(5, Math.max(1, Math.round(Number(value) || 3)));
}

async function ensureTaskChatGroup(taskId) {
  const task = await db.prepare("SELECT id, task_code, department FROM tasks WHERE id = ?").get(taskId);
  if (!task || (await taskAssigneeIds(taskId)).length < 2) return;
  const existing = await db.prepare("SELECT id FROM chat_groups WHERE task_id = ?").get(taskId);
  if (existing) {
    await db.prepare("UPDATE chat_groups SET name = ? WHERE id = ?").run(`Task #${task.task_code}`, existing.id);
    return;
  }
  await db.prepare("INSERT INTO chat_groups (id, name, department, created_by_id, task_id) VALUES (?, ?, ?, NULL, ?)")
    .run(randomUUID(), `Task #${task.task_code}`, task.department, taskId);
}

async function deleteTaskChatGroup(taskId) {
  const group = await db.prepare("SELECT id FROM chat_groups WHERE task_id = ?").get(taskId);
  if (!group) return;
  await deleteChatMessagesForChannel(`group:${group.id}`);
  await db.prepare("DELETE FROM chat_groups WHERE id = ?").run(group.id);
}

async function taskAssigneeIds(taskId) {
  return (await db.prepare("SELECT user_id FROM task_assignees WHERE task_id = ?").all(taskId)).map((item) => item.user_id);
}

async function taskAssigneeNames(taskId) {
  return (await db.prepare(
    "SELECT users.name FROM task_assignees JOIN users ON users.id = task_assignees.user_id WHERE task_assignees.task_id = ? ORDER BY users.name"
  ).all(taskId)).map((item) => item.name);
}

async function setTaskAssignees(taskId, assigneeIds) {
  await db.prepare("DELETE FROM task_assignees WHERE task_id = ?").run(taskId);
  for (const userId of assigneeIds) {
    await db.prepare("INSERT INTO task_assignees (task_id, user_id) VALUES (?, ?)").run(taskId, userId);
  }
  await db.prepare("UPDATE tasks SET assignee_id = ? WHERE id = ?").run(assigneeIds[0] ?? null, taskId);
  if (assigneeIds.length) {
    await db.prepare(`
      DELETE FROM task_worker_approvals WHERE task_id = ?
        AND user_id NOT IN (${assigneeIds.map(() => "?").join(",")})
    `).run(taskId, ...assigneeIds);
  } else {
    await db.prepare("DELETE FROM task_worker_approvals WHERE task_id = ?").run(taskId);
    await db.prepare("UPDATE tasks SET started_at = NULL, due_date = NULL, status = 'new', progress = 0 WHERE id = ? AND status != 'done'")
      .run(taskId);
  }
  await ensureTaskChatGroup(taskId);
}

function projectIncludes(projectDepartment, department) {
  return sameDepartment(projectDepartment, department) || (sameDepartment(projectDepartment, "Technical Department") && technicalDepartments.some(name => sameDepartment(name, department)));
}
function canLeadProject(actor, project) {
  return canManage(actor, project) || (actor.role === "team_leader" && projectIncludes(project.department, actor.department));
}
async function validProjectMembers(ids, projectDepartment, actor) {
  const unique = [...new Set(Array.isArray(ids) ? ids.map(String) : [])];
  const members = [];
  for (const id of unique) {
    const user = await db.prepare("SELECT * FROM users WHERE id = ? AND role = 'user'").get(id);
    if (!user || !projectIncludes(projectDepartment, user.department) || (actor.role === "team_leader" && !sameDepartment(actor.department, user.department))) fail(400, "Choose engineers within the project and your department scope.");
    members.push(user);
  }
  return members;
}
async function requireProjectDepartment(name) {
  if (sameDepartment(name, "Technical Department")) {
    const parent = await db.prepare("SELECT name FROM departments WHERE name = 'Technical Department'").get();
    if (!parent) fail(400, "Technical Department does not exist.");
    return parent.name;
  }
  return requireDepartment(name);
}

async function validTaskAssignees(ids, department, projectId = null) {
  const uniqueIds = [...new Set(Array.isArray(ids) ? ids.map(String) : [])];
  if (!uniqueIds.length) return [];
  const users = await db.prepare(`
    SELECT * FROM users WHERE id IN (${uniqueIds.map(() => "?").join(",")})
      AND role = 'user' AND lower(trim(department)) = lower(trim(?))
  `).all(...uniqueIds, department);
  if (users.length !== uniqueIds.length) throw new Error("Every assignee must be a normal user in the task department.");
  if (projectId) {
    const memberCount = (await db.prepare(`
      SELECT count(*) AS count FROM project_members
      WHERE project_id = ? AND user_id IN (${uniqueIds.map(() => "?").join(",")})
    `).get(projectId, ...uniqueIds)).count;
    if (memberCount !== uniqueIds.length) throw new Error("Task assignees must be members of the selected project.");
  }
  return users;
}

async function requestAllocation(task, actor, assignees, dueDate, isNew = false) {
  const proposal = {
    id: randomUUID(), requesterId: actor.id, requesterName: actor.name,
    assigneeIds: assignees.map((user) => user.id), candidateNames: assignees.map((user) => user.name),
    dueDate, isNew, state: "pending"
  };
  await db.prepare("UPDATE tasks SET allocation_request = ?::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(JSON.stringify(proposal), task.id);
  await recordTaskEvent(task.id, actor, "allocation_requested", `Allocation requested for ${proposal.candidateNames.join(", ") || "the department free task queue"}`);
  await notifyDepartmentAdmins(task, "Task allocation needs approval", `${actor.name} requested allocation of ${task.title}`);
}

async function notifyDepartmentAdmins(task, title, body) {
  const admins = (await db.prepare("SELECT * FROM users WHERE role IN ('admin', 'technical_manager')").all()).filter((user) => canManage(user, task));
  if (!admins.length) throw Object.assign(new Error("No department admin is available to approve this request. Ask a Super Admin to assign a department admin, or choose No to apply the action immediately."), { status: 409 });
  for (const admin of admins) await notify(admin.id, "approval_request", title, body, task.id);
}

async function completeTask(task, actor) {
  await db.prepare("UPDATE tasks SET status = 'done', progress = 100, review_comment = 'Approved.', completed_at = CURRENT_TIMESTAMP, action_request = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(task.id);
  await deleteTaskChatGroup(task.id);
  await recordTaskEvent(
    task.id,
    actor,
    actor.role === "team_leader" ? "leader_approved" : "approved",
    actor.role === "team_leader" ? "Team leader approved and completed the task" : "Task approved and completed"
  );
  for (const userId of await taskAssigneeIds(task.id)) await notify(userId, "approval", "Task approved", `${actor.name} approved: ${task.title}`, task.id);
}

async function reopenCompletedTask(task, actor, comment) {
  const assignedUserIds = await taskAssigneeIds(task.id);
  await db.prepare("UPDATE tasks SET checklist = ?::jsonb WHERE id = ?").run(JSON.stringify((task.checklist ?? []).map(item => ({ ...item, completed: false }))), task.id);
  await db.prepare(`UPDATE tasks SET status = ?, progress = ?, review_comment = ?, completed_at = NULL,
    leader_approved_at = NULL, leader_approved_by_id = NULL, allocation_request = NULL, action_request = NULL,
    started_at = CASE WHEN ? = 1 THEN started_at ELSE NULL END,
    due_date = CASE WHEN ? = 1 THEN due_date ELSE NULL END, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(assignedUserIds.length ? "in_progress" : "new", 0,
      comment, assignedUserIds.length ? 1 : 0, assignedUserIds.length ? 1 : 0, task.id);
  await db.prepare("INSERT INTO task_reopen_events (id, task_id, reviewer_id, comment) VALUES (?, ?, ?, ?)").run(randomUUID(), task.id, actor.id, comment);
  await db.prepare("DELETE FROM task_worker_approvals WHERE task_id = ?").run(task.id);
  await ensureTaskChatGroup(task.id);
  await recordTaskEvent(task.id, actor, "reopened", "Task reopened; checklist steps reset for verification: " + comment);
  for (const userId of assignedUserIds) await notify(userId, "review", "Task reopened", actor.name + ": " + comment, task.id);
}

async function parseTaskSheet(file) {
  const name = basename(String(file?.name ?? "project-tasks.xlsx"));
  const data = Buffer.from(String(file?.data ?? ""), "base64");
  if (!data.length) throw new Error("Choose a project task sheet to import.");
  if (data.length > maxFileSize) throw new Error("The project task sheet exceeds the 10 MB limit.");
  const workbook = new ExcelJS.Workbook();
  let sheet;
  if (extname(name).toLowerCase() === ".csv") {
    sheet = await workbook.csv.read(Readable.from([data]));
  } else {
    await workbook.xlsx.load(data);
    sheet = workbook.worksheets[0];
  }
  if (!sheet) throw new Error("The task sheet has no worksheet.");
  const headerMap = new Map();
  sheet.getRow(1).eachCell((cell, column) => {
    headerMap.set(String(cell.value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " "), column);
  });
  const findColumn = (...names) => names.map((name) => headerMap.get(name)).find(Boolean);
  const titleColumn = findColumn("task", "title", "task title");
  if (!titleColumn) throw new Error("The sheet needs a Task or Title column.");
  const priorityColumn = findColumn("priority");
  const dueColumn = findColumn("due date", "due");
  const progressColumn = findColumn("progress", "progress percent");
  const complexityColumn = findColumn("complexity", "complexity points", "points");
  const typeColumn = findColumn("task type", "type");
  const assigneesColumn = findColumn("assignees", "assigned to", "users");
  const tasks = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const title = String(row.getCell(titleColumn).text ?? "").trim();
    if (!title) return;
    const cellText = (column) => column ? String(row.getCell(column).text ?? "") : "";
    const dueValue = dueColumn ? row.getCell(dueColumn).value : null;
    const dueDate = dueValue instanceof Date
      ? dueValue.toISOString().slice(0, 10)
      : typeof dueValue === "number"
        ? new Date((dueValue - 25569) * 86_400_000).toISOString().slice(0, 10)
      : String(cellText(dueColumn)).slice(0, 10);
    const priority = cellText(priorityColumn).toLowerCase();
    const rawProgress = progressColumn ? row.getCell(progressColumn).value : 0;
    const progress = typeof rawProgress === "number" && rawProgress > 0 && rawProgress <= 1
      ? rawProgress * 100
      : Number(cellText(progressColumn).replace("%", "")) || 0;
    tasks.push({
      title,
      priority: ["low", "medium", "high", "urgent"].includes(priority)
        ? priority
        : "medium",
      dueDate,
      complexity: normalizeComplexity(cellText(complexityColumn)),
      progress: Math.max(0, Math.min(100, progress)),
      taskType: normalizeTaskType(cellText(typeColumn)),
      assignees: cellText(assigneesColumn).split(/[,;]/).map((item) => item.trim()).filter(Boolean)
    });
  });
  if (!tasks.length) throw new Error("No task rows were found in the sheet.");
  return tasks;
}

// Notification kinds that also go out by email (chat/comment noise stays in-app).
const EMAILABLE_KINDS = new Set([
  "assignment", "reminder", "mention", "approval_request", "approval", "review", "delay", "project",
]);

async function notify(userId, kind, title, body, taskId, channelId, dedupeKey) {
  if (!userId) return;
  const result = await db.prepare(`
    INSERT INTO notifications (id, user_id, kind, title, body, task_id, channel_id, dedupe_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
  `).run(randomUUID(), userId, kind, title, body, taskId ?? null, channelId ?? null, dedupeKey ?? null);
  // Only email when a NEW notification row was created (dedupe conflict → no row,
  // so a daily reminder never emails twice). Fire-and-forget, never blocks.
  if ((result?.changes ?? 0) > 0 && EMAILABLE_KINDS.has(kind)) {
    void sendNotificationEmail(userId, kind, title, body, taskId).catch((error) =>
      console.error(`[email] notification to user ${userId} failed:`, error?.message ?? error),
    );
  }
}

async function sendNotificationEmail(userId, kind, title, body, taskId) {
  if (!isMailConfigured()) return;
  const user = await db.prepare("SELECT name, username FROM users WHERE id = ?").get(userId);
  // The username IS the email address in this app.
  if (!user?.username || !user.username.includes("@")) return;

  // Enrich task emails with the deadline, who created/sent it, and the attached
  // documents (name + who sent each).
  let details;
  if (taskId) {
    const task = await db.prepare(
      "SELECT tasks.task_code, tasks.due_date, COALESCE(creator.name, 'System') AS created_by FROM tasks LEFT JOIN users creator ON creator.id = tasks.created_by_id WHERE tasks.id = ?",
    ).get(taskId);
    if (task) {
      const files = await db.prepare("SELECT name, uploaded_by, storage_name, mime_type, size FROM task_files WHERE task_id = ? ORDER BY uploaded_at").all(taskId);
      details = {
        taskCode: task.task_code || undefined,
        deadline: task.due_date || undefined,
        sender: task.created_by || undefined,
        files: files.map((f) => ({ name: f.name, by: f.uploaded_by })),
      };
      // Attach the actual documents (skip missing files or anything over 8 MB, so
      // a stale record or a huge file never breaks the send).
      const MAX_ATTACH = 8 * 1024 * 1024;
      const attachments = [];
      for (const f of files) {
        if (!f.storage_name || (f.size ?? 0) > MAX_ATTACH) continue;
        try {
          attachments.push({ filename: f.name, content: readFileSync(join(attachmentsPath, f.storage_name)), contentType: f.mime_type || undefined });
        } catch {
          // File is gone from disk — list it by name only, don't fail the email.
        }
      }
      details.attachmentsData = attachments;
    }
  }

  const mail = notificationEmail({ kind, name: user.name, title, body, link: appLink(taskId), details });
  await sendEmail({ to: user.username, subject: mail.subject, html: mail.html, text: mail.text, attachments: details?.attachmentsData });
}

async function runTaskReminders() {
  const today = riyadhDate();
  const tasks = await db.prepare("SELECT tasks.*, (SELECT count(*) FROM task_reopen_events WHERE task_id = tasks.id) AS reopen_count FROM tasks WHERE status != 'done' AND (due_date IS NOT NULL OR status IN ('blocked', 'under_review'))").all();
  const leaders = await db.prepare("SELECT * FROM users WHERE role IN ('admin', 'technical_manager', 'team_leader')").all();
  await sendDeadlineReminders({ tasks, leaders, assigneeIds: taskAssigneeIds, assigneeNames: taskAssigneeNames, canLead, notify });
  for (const task of tasks) {
    if (["blocked", "under_review"].includes(task.status)) {
      const managers = (await db.prepare("SELECT * FROM users WHERE role IN ('superadmin', 'admin', 'technical_manager')").all()).filter((user) => canManage(user, task));
      for (const manager of managers) {
        await notify(manager.id, "reminder", task.status === "blocked" ? "Blocked task needs attention" : "Task awaiting review", `${task.task_code}: ${task.title}`, task.id, null, `${today}:${task.status}:${task.id}:${manager.id}`);
      }
    }
  }
}

async function taskConversationPeople(task) {
  const assigned = new Set(await taskAssigneeIds(task.id));
  const candidates = await db.prepare("SELECT * FROM users ORDER BY name").all();
  const people = [];
  for (const person of candidates) {
    const involved = assigned.has(person.id) || person.id === task.created_by_id ||
      (["admin", "technical_manager", "team_leader"].includes(person.role) && canLead(person, task));
    if (involved && await canView(person, task)) people.push(person);
  }
  return people;
}

function taskMentionRecipients(message, people) {
  const names = new Set([...message.matchAll(/@\[([^\]]+)\]/g)].map(match => match[1].trim().toLocaleLowerCase()));
  for (const name of names) if (!people.some(person => person.name.trim().toLocaleLowerCase() === name)) fail(400, "You can mention only people involved in this task. Choose a person from the mention list.");
  return new Set(people.filter(person => names.has(person.name.trim().toLocaleLowerCase())).map(person => person.id));
}

async function notifyTaskAudience(task, actorId, title, body) {
  const audience = await db.prepare(`
    SELECT id FROM users
    WHERE id != ? AND (role = 'superadmin' OR department = ?)
  `).all(actorId, task.department);
  await Promise.all(audience.map((user) => notify(user.id, "message", title, body, task.id)));
}

async function notifyTaskManagers(task, actorId, title, body) {
  const managers = (await db.prepare("SELECT * FROM users WHERE id != ? AND role IN ('superadmin', 'admin', 'technical_manager')").all(actorId)).filter((user) => canManage(user, task));
  await Promise.all(managers.map((user) => notify(user.id, "claim", title, body, task.id)));
}

function dmChannelId(firstUserId, secondUserId) {
  return ["dm", ...[firstUserId, secondUserId].sort()].join(":");
}

async function dmContactsFor(actor) {
  return actor.role === "superadmin"
    ? await db.prepare("SELECT * FROM users WHERE id != ? ORDER BY name").all(actor.id)
    : await db.prepare(`
        SELECT * FROM users WHERE id != ? AND lower(trim(department)) = ANY(?::text[]) ORDER BY name
      `).all(actor.id, departmentScope(actor));
}

async function resolveChatChannel(actor, channelId) {
  if (channelId.startsWith("department:")) {
    const department = channelId.slice("department:".length);
    if (!department) {
      const error = new Error("Chat channel not found.");
      error.status = 404;
      throw error;
    }
    if (!canAccessDepartment(actor, department)) {
      const error = new Error("You can chat only inside your own department.");
      error.status = 403;
      throw error;
    }
    return { department };
  }
  if (channelId.startsWith("group:")) {
    const group = await db.prepare("SELECT department, task_id FROM chat_groups WHERE id = ?").get(channelId.slice("group:".length));
    if (!group) {
      const error = new Error("Chat group not found.");
      error.status = 404;
      throw error;
    }
    if (group.task_id && actor.role === "user" && !(await taskAssigneeIds(group.task_id)).includes(actor.id)) {
      const error = new Error("This task chat is limited to its assigned workers.");
      error.status = 403;
      throw error;
    }
    if (!canAccessDepartment(actor, group.department)) {
      const error = new Error("You can chat only inside your own department.");
      error.status = 403;
      throw error;
    }
    return { department: group.department };
  }
  if (channelId.startsWith("dm:")) {
    const participantIds = channelId.slice("dm:".length).split(":");
    if (participantIds.length !== 2 || !participantIds.includes(actor.id)) {
      const error = new Error("You are not part of this conversation.");
      error.status = 403;
      throw error;
    }
    const otherId = participantIds.find((id) => id !== actor.id);
    const other = await db.prepare("SELECT * FROM users WHERE id = ?").get(otherId);
    if (!other) {
      const error = new Error("This person is no longer available.");
      error.status = 404;
      throw error;
    }
    if (!canAccessDepartment(actor, other.department)) {
      const error = new Error("You can message colleagues in your own department only.");
      error.status = 403;
      throw error;
    }
    if (channelId !== dmChannelId(actor.id, otherId)) {
      const error = new Error("Chat channel not found.");
      error.status = 404;
      throw error;
    }
    return { department: actor.department };
  }
  const error = new Error("Chat channel not found.");
  error.status = 404;
  throw error;
}

async function chatNotificationContext(channelId, department) {
  const departmentChatName = String(department ?? "")
    .replace(/\s+office engineer$/i, "")
    .trim() || department;
  if (channelId.startsWith("department:")) {
    return {
      title: `${departmentChatName} Department chat`,
      taskId: null
    };
  }
  if (channelId.startsWith("group:")) {
    const group = await db.prepare("SELECT name, task_id FROM chat_groups WHERE id = ?").get(channelId.slice("group:".length));
    return {
      title: group?.name ? `${group.name} group chat` : `${department} group chat`,
      taskId: group?.task_id ?? null
    };
  }
  if (channelId.startsWith("dm:")) {
    return {
      title: "Direct message",
      taskId: null
    };
  }
  return {
    title: `${department} chat`,
    taskId: null
  };
}

function chatMessagePreview(messageBody, fileCount) {
  const normalized = String(messageBody ?? "").replace(/\s+/g, " ").trim();
  if (normalized) return normalized.slice(0, 180);
  if (fileCount) return `${fileCount} attachment${fileCount === 1 ? "" : "s"}`;
  return "New message";
}

async function chatDataFor(actor) {
  const departments = actor.role === "superadmin"
    ? (await db.prepare(`
        SELECT department FROM users WHERE department != 'Executive'
        UNION SELECT department FROM tasks WHERE department != 'Executive'
        ORDER BY department
      `).all()).map((item) => item.department)
    : actor.role === "technical_manager" ? technicalDepartments : [actor.department];
  const departmentGroups = departments.length
    ? await db.prepare(`
        SELECT id, name, department, task_id FROM chat_groups
        WHERE department IN (${departments.map(() => "?").join(",")})
        ORDER BY created_at ASC
      `).all(...departments)
    : [];
  const groups = [];
  for (const group of departmentGroups) {
    if (!group.task_id || ["superadmin", "admin", "technical_manager", "team_leader"].includes(actor.role) || (await taskAssigneeIds(group.task_id)).includes(actor.id)) {
      groups.push(group);
    }
  }
  const contacts = await dmContactsFor(actor);
  const channels = [
    ...departments.map((department) => ({
      id: `department:${department}`,
      name: "Department Chat",
      department,
      isGroup: false
    })),
    ...groups.map((group) => ({
      id: `group:${group.id}`,
      name: group.name,
      department: group.department,
      isGroup: true,
      taskId: group.task_id ?? undefined
    })),
    ...contacts.map((contact) => ({
      id: dmChannelId(actor.id, contact.id),
      name: contact.name,
      department: contact.department,
      isGroup: false,
      isDirect: true,
      participantId: contact.id
    }))
  ];
  const channelIds = channels.map((channel) => channel.id);
  if (!channelIds.length) return { chatChannels: channels, chatMessages: [] };

  const rawMessages = await db.prepare(`
    SELECT id, channel_id, author_id, author_name, body, reply_to_id, deleted_at, created_at FROM (
      SELECT id, channel_id, author_id, author_name, body, reply_to_id, deleted_at, created_at,
        row_number() OVER (PARTITION BY channel_id ORDER BY created_at DESC) AS rn
      FROM chat_messages
      WHERE channel_id IN (${channelIds.map(() => "?").join(",")})
        AND NOT EXISTS (
          SELECT 1 FROM chat_message_hidden
          WHERE chat_message_hidden.message_id = chat_messages.id AND chat_message_hidden.user_id = ?
        )
    ) ranked
    WHERE rn <= 150
    ORDER BY created_at ASC
  `).all(...channelIds, actor.id);

  const messageIds = rawMessages.map((message) => message.id);
  const fileRows = messageIds.length
    ? await db.prepare(`
        SELECT id, message_id, name, mime_type, size FROM chat_message_files
        WHERE message_id IN (${messageIds.map(() => "?").join(",")})
        ORDER BY uploaded_at ASC
      `).all(...messageIds)
    : [];
  const filesByMessage = new Map();
  for (const file of fileRows) {
    const list = filesByMessage.get(file.message_id) ?? [];
    list.push({ id: file.id, name: file.name, mimeType: file.mime_type ?? "application/octet-stream", size: file.size ?? 0 });
    filesByMessage.set(file.message_id, list);
  }

  const loadedIds = new Set(messageIds);
  const replyPreviewById = new Map();
  for (const message of rawMessages) {
    replyPreviewById.set(message.id, { id: message.id, authorName: message.author_name, body: message.deleted_at ? "This message was deleted" : message.body });
  }
  const missingReplyIds = [...new Set(
    rawMessages.map((message) => message.reply_to_id).filter((id) => id && !loadedIds.has(id))
  )];
  if (missingReplyIds.length) {
    const extraReplyRows = await db.prepare(`
      SELECT id, author_name, body FROM chat_messages WHERE id IN (${missingReplyIds.map(() => "?").join(",")})
    `).all(...missingReplyIds);
    for (const row of extraReplyRows) replyPreviewById.set(row.id, { id: row.id, authorName: row.author_name, body: row.body });
  }

  const unreadRows = await db.prepare(`
    SELECT messages.channel_id, count(*) AS count FROM chat_messages messages
    LEFT JOIN chat_reads reads ON reads.channel_id = messages.channel_id AND reads.user_id = ?
    WHERE messages.channel_id IN (${channelIds.map(() => "?").join(",")})
      AND messages.author_id IS DISTINCT FROM ? AND messages.deleted_at IS NULL
      AND (reads.last_read_at IS NULL OR messages.created_at > reads.last_read_at)
      AND NOT EXISTS (SELECT 1 FROM chat_message_hidden hidden WHERE hidden.message_id = messages.id AND hidden.user_id = ?)
    GROUP BY messages.channel_id
  `).all(actor.id, ...channelIds, actor.id, actor.id);
  const unreadByChannel = new Map(unreadRows.map((row) => [row.channel_id, row.count]));

  const channelsWithUnread = channels.map((channel) => ({ ...channel, unreadCount: unreadByChannel.get(channel.id) ?? 0 }));
  const messages = rawMessages.map((message) => ({
    id: message.id,
    channelId: message.channel_id,
    authorId: message.author_id ?? "deleted-user",
    authorName: message.author_name,
    body: message.body,
    isDeleted: Boolean(message.deleted_at),
    createdAt: formatDate(message.created_at),
    files: filesByMessage.get(message.id) ?? [],
    replyTo: message.reply_to_id ? replyPreviewById.get(message.reply_to_id) : undefined
  }));

  return { chatChannels: channelsWithUnread, chatMessages: messages };
}

const technicalDepartments = ["Electrical Technical office engineer", "Mechanical Technical office engineer"];
function departmentScope(user) {
  return (user.role === "technical_manager" ? technicalDepartments : [user.department]).map((name) => name.trim().toLowerCase());
}
function canAccessDepartment(user, department) {
  return user.role === "superadmin" || (user.role === "technical_manager" && sameDepartment(department, "Technical Department")) || departmentScope(user).includes(String(department ?? "").trim().toLowerCase());
}

function canManage(user, task) {
  return ["superadmin", "admin", "technical_manager"].includes(user.role) && canAccessDepartment(user, task.department);
}

function canLead(user, task) {
  return canManage(user, task) || (user.role === "team_leader" && sameDepartment(user.department, task.department));
}

async function needsLeaderApproval(task) {
  return !task.leader_approved_at && Boolean(await db.prepare("SELECT id FROM users WHERE role = 'team_leader' AND lower(trim(department)) = lower(trim(?)) LIMIT 1").get(task.department));
}

async function canView(user, task) {
  if (user.role === "superadmin") return true;
  if (!canAccessDepartment(user, task.department)) return false;
  if (["admin", "technical_manager", "team_leader"].includes(user.role)) return true;
  if (task.allocation_request?.isNew) return false;
  const assignedUserIds = await taskAssigneeIds(task.task_id ?? task.id);
  if (assignedUserIds.length) return assignedUserIds.includes(user.id);
  return true;
}

function send(response, status, data) {
  response.writeHead(status, {
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    ...(response.corsOrigin ? { "Access-Control-Allow-Origin": response.corsOrigin, Vary: "Origin" } : {}),
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Content-Type": "application/json",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-Request-Id": response.requestId || ""
  });
  response.end(JSON.stringify(data));
}

function sendBinary(response, status, data, contentType, filename) {
  const originalFilename = basename(filename).replace(/["\r\n]/g, "_");
  const safeFilename = originalFilename.replace(/[^\x20-\x7E]/g, "_");
  response.writeHead(status, {
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    ...(response.corsOrigin ? { "Access-Control-Allow-Origin": response.corsOrigin, Vary: "Origin" } : {}),
    "Access-Control-Expose-Headers": "Content-Disposition",
    "Content-Disposition": `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(originalFilename)}`,
    "Content-Length": data.length,
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
    "X-Request-Id": response.requestId || ""
  });
  response.end(data);
}

async function readBody(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (Buffer.byteLength(raw) > 70 * 1024 * 1024) {
      const error = new Error("Request is too large.");
      error.status = 413;
      throw error;
    }
  }
  return raw ? JSON.parse(raw) : {};
}

async function authenticatedUser(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const row = await db.prepare(`
    SELECT users.*, sessions.last_active_at FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ?
  `).get(token);
  if (row?.last_active_at) {
    const lastActive = new Date(`${row.last_active_at.replace(" ", "T")}Z`).getTime();
    if (Date.now() - lastActive >= sessionIdleMinutes * 60 * 1000) {
      await db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
      return null;
    }
  }
  return row ? publicUser(row) : null;
}

async function touchSession(request) {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (token) await db.prepare("UPDATE sessions SET last_active_at = CURRENT_TIMESTAMP WHERE token = ?").run(token);
}

async function saveTaskFiles(taskId, actor, files, category = "task") {
  const incoming = Array.isArray(files) ? files.slice(0, maxFilesPerUpload) : [];
  if (Array.isArray(files) && files.length > maxFilesPerUpload) {
    const error = new Error(`You can upload up to ${maxFilesPerUpload} files at once.`);
    error.status = 400;
    throw error;
  }

  const prepared = incoming.map((file) => {
    const name = basename(String(file.name ?? "attachment")).slice(0, 180);
    const mimeType = String(file.mimeType ?? "application/octet-stream").slice(0, 120);
    const data = Buffer.from(String(file.data ?? ""), "base64");
    if (!name || !data.length) throw new Error("Each attachment must include a name and file content.");
    if (data.length > maxFileSize) throw new Error(`${name} exceeds the 10 MB file limit.`);
    return { data, mimeType, name, storageName: `${randomUUID()}${extname(name).slice(0, 12)}` };
  });

  const writtenFiles = [];
  try {
    await db.transaction(async () => {
      for (const file of prepared) {
        writeFileSync(join(attachmentsPath, file.storageName), file.data, { flag: "wx" });
        writtenFiles.push(file.storageName);
        await db.prepare(`
          INSERT INTO task_files (id, task_id, name, uploaded_by, storage_name, mime_type, size, category)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(randomUUID(), taskId, file.name, actor.name, file.storageName, file.mimeType, file.data.length, category);
      }
    });
  } catch (error) {
    for (const storageName of writtenFiles) {
      try { unlinkSync(join(attachmentsPath, storageName)); } catch { /* Best-effort cleanup. */ }
    }
    throw error;
  }
}

async function saveChatMessageFiles(messageId, actor, files) {
  const incoming = Array.isArray(files) ? files.slice(0, maxFilesPerUpload) : [];
  if (Array.isArray(files) && files.length > maxFilesPerUpload) {
    const error = new Error(`You can attach up to ${maxFilesPerUpload} files at once.`);
    error.status = 400;
    throw error;
  }

  const prepared = incoming.map((file) => {
    const name = basename(String(file.name ?? "attachment")).slice(0, 180);
    const mimeType = String(file.mimeType ?? "application/octet-stream").slice(0, 120);
    const data = Buffer.from(String(file.data ?? ""), "base64");
    if (!name || !data.length) throw new Error("Each attachment must include a name and file content.");
    if (data.length > maxFileSize) throw new Error(`${name} exceeds the 10 MB file limit.`);
    return { data, mimeType, name, storageName: `${randomUUID()}${extname(name).slice(0, 12)}` };
  });

  const writtenFiles = [];
  try {
    await db.transaction(async () => {
      for (const file of prepared) {
        writeFileSync(join(attachmentsPath, file.storageName), file.data, { flag: "wx" });
        writtenFiles.push(file.storageName);
        await db.prepare(`
          INSERT INTO chat_message_files (id, message_id, name, uploaded_by, storage_name, mime_type, size)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(randomUUID(), messageId, file.name, actor.name, file.storageName, file.mimeType, file.data.length);
      }
    });
  } catch (error) {
    for (const storageName of writtenFiles) {
      try { unlinkSync(join(attachmentsPath, storageName)); } catch { /* Best-effort cleanup. */ }
    }
    throw error;
  }
  return prepared.length;
}

async function deleteChatMessagesForChannel(channelId) {
  const files = await db.prepare(`
    SELECT chat_message_files.storage_name FROM chat_message_files
    JOIN chat_messages ON chat_messages.id = chat_message_files.message_id
    WHERE chat_messages.channel_id = ?
  `).all(channelId);
  await db.prepare("DELETE FROM chat_messages WHERE channel_id = ?").run(channelId);
  for (const file of files) {
    try { unlinkSync(join(attachmentsPath, basename(file.storage_name))); } catch { /* Already absent. */ }
  }
}

for (const task of await db.prepare(`
  SELECT tasks.id, tasks.department, projects.name AS project_name
  FROM tasks LEFT JOIN projects ON projects.id = tasks.project_id
  WHERE tasks.task_code IS NULL OR tasks.task_code = ''
  ORDER BY tasks.created_at
`).all()) {
  await db.prepare("UPDATE tasks SET task_code = ? WHERE id = ?")
    .run(await generateTaskCode(task.project_name, task.department), task.id);
}
await db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_code ON tasks(task_code)");
for (const task of await db.prepare("SELECT id FROM tasks").all()) await ensureTaskChatGroup(task.id);

async function buildProductivityReport(user, month = "") {
  const monthFilter = /^\d{4}-\d{2}$/.test(month) ? month : "";
  const rows = await db.prepare(`
    SELECT DISTINCT tasks.id, tasks.task_code, tasks.title, tasks.department, tasks.priority, tasks.status,
      tasks.due_date, tasks.complexity, tasks.started_at, tasks.progress, tasks.created_at, tasks.updated_at, tasks.completed_at,
      tasks.task_type, projects.name AS project_name,
      (SELECT count(*) FROM task_reopen_events WHERE task_reopen_events.task_id = tasks.id)::int AS reopen_count
    FROM tasks
    JOIN task_assignees ON task_assignees.task_id = tasks.id
    LEFT JOIN projects ON projects.id = tasks.project_id
    WHERE task_assignees.user_id = ?
      AND (? = '' OR substr(tasks.created_at, 1, 7) = ? OR substr(tasks.completed_at, 1, 7) = ?)
    ORDER BY tasks.created_at DESC
  `).all(user.id, monthFilter, monthFilter, monthFilter);
  const today = new Date().toISOString().slice(0, 10);
  const completed = rows.filter((task) => task.status === "done");
  const overdue = rows.filter((task) => task.status !== "done" && task.due_date && task.due_date < today);
  const onTime = completed.filter((task) => task.due_date && task.completed_at?.slice(0, 10) <= task.due_date);
  const completionDurations = completed
    .map((task) => (new Date(`${task.completed_at.replace(" ", "T")}Z`).getTime() - new Date(`${(task.started_at ?? task.created_at).replace(" ", "T")}Z`).getTime()) / 86_400_000)
    .filter((duration) => Number.isFinite(duration) && duration >= 0)
    .sort((a, b) => a - b);
  const averageCompletionDays = completionDurations.length
    ? completionDurations.reduce((sum, duration) => sum + duration, 0) / completionDurations.length
    : 0;
  const medianCompletionDays = completionDurations.length
    ? completionDurations.length % 2
      ? completionDurations[Math.floor(completionDurations.length / 2)]
      : (completionDurations[completionDurations.length / 2 - 1] + completionDurations[completionDurations.length / 2]) / 2
    : 0;
  const totalComplexity = rows.reduce((sum, task) => sum + normalizeComplexity(task.complexity), 0);
  const activeComplexity = rows.filter((task) => task.status !== "done").reduce((sum, task) => sum + normalizeComplexity(task.complexity), 0);
  const completedComplexity = completed.reduce((sum, task) => sum + normalizeComplexity(task.complexity), 0);
  const totalReopens = rows.reduce((sum, task) => sum + (task.reopen_count ?? 0), 0);
  const averageProgress = totalComplexity
    ? Math.round(rows.reduce((sum, task) => sum + task.progress * normalizeComplexity(task.complexity), 0) / totalComplexity)
    : 0;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MAB Task Allocator";
  workbook.created = new Date();
  const summary = workbook.addWorksheet("Summary", { views: [{ showGridLines: false }] });
  const tasks = workbook.addWorksheet("Task Details", { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
  const titleFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1178B8" } };
  const paleFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF8FF" } };

  summary.mergeCells("A1:D1");
  summary.getCell("A1").value = "MAB Productivity Report";
  summary.getCell("A1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 18 };
  summary.getCell("A1").fill = titleFill;
  summary.getCell("A1").alignment = { vertical: "middle" };
  summary.getRow(1).height = 32;
  summary.getCell("A3").value = "Employee";
  summary.getCell("B3").value = user.name;
  summary.getCell("A4").value = "Department";
  summary.getCell("B4").value = user.department;
  summary.getCell("A5").value = "Generated";
  summary.getCell("B5").value = new Date();
  summary.getCell("B5").numFmt = "yyyy-mm-dd hh:mm";
  summary.getCell("A6").value = "Reporting Period";
  summary.getCell("B6").value = monthFilter || "All time";
  const metrics = [
    ["Assigned Tasks", rows.length],
    ["Completed Tasks", completed.length],
    ["Open Tasks", rows.length - completed.length],
    ["Overdue Tasks", overdue.length],
    ["Completed On Time", onTime.length],
    ["Weighted Completion Rate", totalComplexity ? completedComplexity / totalComplexity : 0],
    ["Complexity-Weighted Progress", averageProgress / 100],
    ["Average Completion Time (days)", averageCompletionDays],
    ["Median Completion Time (days)", medianCompletionDays],
    ["Fastest Completion (days)", completionDurations[0] ?? 0],
    ["On-Time Completion Rate", completed.length ? onTime.length / completed.length : 0],
    ["Total Complexity Points", totalComplexity],
    ["Active Complexity Load", activeComplexity],
    ["Completed Complexity Points", completedComplexity],
    ["Admin Reopen Cycles", totalReopens],
    ["Average Reopens per Completed Task", completed.length ? totalReopens / completed.length : 0]
  ];
  summary.getCell("A7").value = "Productivity Summary";
  summary.getCell("A7").font = { bold: true, color: { argb: "FF0B456B" }, size: 13 };
  metrics.forEach(([label, value], index) => {
    const row = 8 + index;
    summary.getCell(row, 1).value = label;
    summary.getCell(row, 2).value = value;
    summary.getCell(row, 1).fill = paleFill;
    summary.getCell(row, 1).font = { bold: true };
  });
  summary.getCell("B13").numFmt = "0%";
  summary.getCell("B14").numFmt = "0%";
  summary.getCell("B15").numFmt = "0.0";
  summary.getCell("B16").numFmt = "0.0";
  summary.getCell("B17").numFmt = "0.0";
  summary.getCell("B18").numFmt = "0%";
  summary.columns = [{ width: 24 }, { width: 28 }, { width: 4 }, { width: 4 }];

  tasks.columns = [
    { header: "Task ID", key: "taskCode", width: 16 },
    { header: "Task", key: "title", width: 38 },
    { header: "Project", key: "project", width: 24 },
    { header: "Task Type", key: "taskType", width: 18 },
    { header: "Department", key: "department", width: 38 },
    { header: "Priority", key: "priority", width: 12 },
    { header: "Status", key: "status", width: 18 },
    { header: "Complexity", key: "complexity", width: 12 },
    { header: "Progress", key: "progress", width: 12 },
    { header: "Created", key: "created", width: 14 },
    { header: "Started", key: "started", width: 18 },
    { header: "Due", key: "due", width: 14 },
    { header: "Completed", key: "completed", width: 18 },
    { header: "On Time", key: "onTime", width: 12 },
    { header: "Cycle Time (days)", key: "cycleTime", width: 18 },
    { header: "Admin Reopens", key: "reopens", width: 15 }
  ];
  tasks.getRow(1).eachCell((cell) => {
    cell.fill = titleFill;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle" };
  });
  for (const task of rows) {
    const completedDate = task.completed_at ? new Date(`${task.completed_at.replace(" ", "T")}Z`) : null;
    tasks.addRow({
      taskCode: task.task_code,
      title: task.title,
      project: task.project_name ?? "No project",
      taskType: task.task_type ?? "Technical",
      department: task.department,
      priority: task.priority,
      status: task.status.replaceAll("_", " "),
      complexity: normalizeComplexity(task.complexity),
      progress: task.progress / 100,
      created: new Date(`${task.created_at.replace(" ", "T")}Z`),
      started: task.started_at ? new Date(`${task.started_at.replace(" ", "T")}Z`) : null,
      due: task.due_date ? new Date(`${task.due_date}T00:00:00`) : null,
      completed: completedDate,
      onTime: completedDate && task.due_date ? (task.completed_at.slice(0, 10) <= task.due_date ? "Yes" : "No") : "",
      cycleTime: completedDate
        ? (completedDate.getTime() - new Date(`${(task.started_at ?? task.created_at).replace(" ", "T")}Z`).getTime()) / 86_400_000
        : null,
      reopens: task.reopen_count ?? 0
    });
  }
  tasks.getColumn("progress").numFmt = "0%";
  tasks.getColumn("created").numFmt = "yyyy-mm-dd";
  tasks.getColumn("started").numFmt = "yyyy-mm-dd hh:mm";
  tasks.getColumn("due").numFmt = "yyyy-mm-dd";
  tasks.getColumn("completed").numFmt = "yyyy-mm-dd hh:mm";
  tasks.getColumn("cycleTime").numFmt = "0.0";
  tasks.autoFilter = { from: "A1", to: "P1" };
  tasks.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && rowNumber % 2 === 0) row.eachCell((cell) => { cell.fill = paleFill; });
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function buildProjectTaskTemplate(project) {
  const members = await db.prepare(`
    SELECT users.name, users.username FROM project_members
    JOIN users ON users.id = project_members.user_id
    WHERE project_members.project_id = ? ORDER BY users.name
  `).all(project.id);
  const usernames = members.map((member) => member.username);
  const firstUser = usernames[0] ?? "user@mabunited.com";
  const secondUser = usernames[1] ?? firstUser;
  const due = (days) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    return date;
  };
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MAB Task Allocator";
  workbook.created = new Date();
  const tasks = workbook.addWorksheet("Tasks", { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
  const instructions = workbook.addWorksheet("Instructions", { views: [{ showGridLines: false }] });
  const headerFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1178B8" } };
  const paleFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEF8FF" } };
  tasks.columns = [
    { header: "Task", key: "task", width: 42 },
    { header: "Priority", key: "priority", width: 14 },
    { header: "Complexity", key: "complexity", width: 14 },
    { header: "Due Date", key: "dueDate", width: 16 },
    { header: "Progress", key: "progress", width: 14 },
    { header: "Task Type", key: "taskType", width: 20 },
    { header: "Assignees", key: "assignees", width: 48 }
  ];
  tasks.addRows([
    { task: "Prepare technical submittal package", priority: "high", complexity: 3, dueDate: due(7), progress: 0, taskType: "Technical", assignees: firstUser },
    { task: "Review quantity takeoff and measurements", priority: "medium", complexity: 2, dueDate: due(12), progress: 25, taskType: "QS", assignees: secondUser },
    { task: "Coordinate BIM model and shop drawings", priority: "urgent", complexity: 5, dueDate: due(18), progress: 0, taskType: "BIM", assignees: `${firstUser};${secondUser}` }
  ]);
  tasks.getRow(1).height = 28;
  tasks.getRow(1).eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle" };
  });
  tasks.getColumn("dueDate").numFmt = "yyyy-mm-dd";
  tasks.getColumn("progress").numFmt = "0";
  tasks.autoFilter = { from: "A1", to: "G1" };
  for (let row = 2; row <= 250; row += 1) {
    tasks.getCell(`B${row}`).dataValidation = { type: "list", allowBlank: false, formulae: ['"low,medium,high,urgent"'] };
    tasks.getCell(`C${row}`).dataValidation = { type: "whole", operator: "between", allowBlank: false, formulae: [1, 5] };
    tasks.getCell(`E${row}`).dataValidation = { type: "whole", operator: "between", allowBlank: true, formulae: [0, 100] };
    tasks.getCell(`F${row}`).dataValidation = { type: "list", allowBlank: false, formulae: ['"Technical,QS,Shop Drawings,BIM,Variation"'] };
  }
  tasks.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && rowNumber % 2 === 0) row.eachCell((cell) => { cell.fill = paleFill; });
  });

  instructions.mergeCells("A1:F1");
  instructions.getCell("A1").value = `${project.name} - Project Task Sheet`;
  instructions.getCell("A1").fill = headerFill;
  instructions.getCell("A1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 17 };
  instructions.getRow(1).height = 32;
  instructions.getCell("A3").value = "Department";
  instructions.getCell("B3").value = project.department;
  instructions.getCell("A4").value = "How to use";
  instructions.getCell("B4").value = "Edit or replace the dummy rows on the Tasks sheet, keep the header names unchanged, then import the completed workbook into this project.";
  instructions.getCell("A6").value = "Assignees";
  instructions.getCell("B6").value = "Use a project member name or username. Separate multiple assignees with a semicolon (;).";
  instructions.getCell("A8").value = "Project members";
  instructions.getCell("B8").value = members.map((member) => `${member.name} (${member.username})`).join("; ") || "Add project members before importing assignments.";
  instructions.getColumn("A").width = 22;
  instructions.getColumn("B").width = 90;
  instructions.getColumn("B").alignment = { wrapText: true, vertical: "top" };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function requireManager(user) {
  if (!user || !["admin", "technical_manager", "superadmin"].includes(user.role)) {
    const error = new Error("Manager permission required.");
    error.status = 403;
    throw error;
  }
}

// The single owner account: highest authority — may manage anyone (Super Admins
// included) and can never be edited or deleted by anyone else.
const OWNER_USERNAME = String(process.env.OWNER_USERNAME || "j.chehade@mabunited.com").trim().toLocaleLowerCase();
function isOwner(user) {
  return !!user && String(user.username || "").trim().toLocaleLowerCase() === OWNER_USERNAME;
}

function validateUserScope(actor, target) {
  if (!["superadmin", "admin", "technical_manager", "team_leader"].includes(actor.role)) throw Object.assign(new Error("People management permission required."), { status: 403 });
  if (!["superadmin", "admin", "technical_manager", "team_leader", "user"].includes(target.role)) {
    const error = new Error("Choose a valid user role.");
    error.status = 400;
    throw error;
  }
  if (actor.role !== "superadmin" && (!(actor.role === "team_leader" ? ["user"] : ["user", "team_leader"]).includes(target.role) || !canAccessDepartment(actor, target.department))) {
    const error = new Error("You can manage only permitted user roles in your departments.");
    error.status = 403;
    throw error;
  }
}

async function requireDepartment(name) {
  const department = await db.prepare("SELECT name FROM departments WHERE lower(name) = lower(?) AND id NOT IN (SELECT parent_id FROM departments WHERE parent_id IS NOT NULL)")
    .get(String(name ?? "").trim());
  if (!department) {
    const error = new Error("Choose a valid department or an Electrical / Mechanical discipline.");
    error.status = 400;
    throw error;
  }
  return department.name;
}

const server = createServer(async (request, response) => {
  response.requestId = randomUUID();
  const requestOrigin = String(request.headers.origin ?? "");
  response.corsOrigin = requestOrigin && (corsOrigins.includes(requestOrigin) || (!isProduction && !corsOrigins.length)) ? requestOrigin : "";
  if (requestOrigin && isProduction && corsOrigins.length && !corsOrigins.includes(requestOrigin)) {
    return send(response, 403, { message: "Origin is not allowed." });
  }
  if (request.method === "OPTIONS") return send(response, 204, {});

  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const path = url.pathname;
    const body = request.method === "GET" ? {} : await readBody(request);

    if (request.method === "GET" && path === "/api/health") {
      const health = await executeQuery("SELECT current_database() AS database, now() AS time");
      return send(response, 200, { ok: true, database: health.rows[0].database, time: health.rows[0].time });
    }

    if (request.method === "POST" && path === "/api/auth/login") {
      const username = String(body.username ?? "").trim().toLocaleLowerCase();
      const row = await db.prepare("SELECT * FROM users WHERE lower(username) = lower(?)").get(username);
      if (!row || !passwordMatches(String(body.password ?? ""), row.password_hash)) {
        return send(response, 401, { message: "Username or password is incorrect." });
      }

      // New-device verification: only when email is configured to deliver the
      // code (otherwise fall through to a normal sign-in so local/dev still works).
      const deviceId = String(body.deviceId ?? "").trim().slice(0, 128);
      // New-device email verification is opt-in (set DEVICE_VERIFICATION=1). Off by
      // default so a login always issues a token — no code step can block sign-in.
      if (deviceVerificationEnabled && isMailConfigured() && deviceId) {
        const trusted = await db.prepare("SELECT 1 FROM trusted_devices WHERE user_id = ? AND device_id = ?").get(row.id, deviceId);
        if (!trusted) {
          const code = String(100000 + (randomBytes(3).readUIntBE(0, 3) % 900000));
          const expires = new Date(Date.now() + 10 * 60_000).toISOString();
          await db.prepare("INSERT INTO login_codes (id, user_id, device_id, code_hash, expires_at) VALUES (?, ?, ?, ?, ?)")
            .run(randomUUID(), row.id, deviceId, hashPassword(code), expires);
          try {
            const mail = deviceCodeEmail({ name: row.name, code });
            await sendEmail({ to: row.username, subject: mail.subject, html: mail.html, text: mail.text });
          } catch (error) {
            console.error("[email] device code send failed:", error?.message ?? error);
            return send(response, 502, { message: "Could not send the verification code. Please try again shortly." });
          }
          return send(response, 200, { requiresVerification: true });
        }
        await db.prepare("UPDATE trusted_devices SET last_seen_at = (timezone('UTC', now())::text) WHERE user_id = ? AND device_id = ?").run(row.id, deviceId);
      }

      const token = randomBytes(32).toString("hex");
      await db.prepare("INSERT INTO sessions (token, user_id, last_active_at) VALUES (?, ?, CURRENT_TIMESTAMP)").run(token, row.id);
      await recordAttendance(row.id, true);
      return send(response, 200, { token, user: publicUser(row) });
    }

    if (request.method === "POST" && path === "/api/auth/verify-device") {
      const username = String(body.username ?? "").trim().toLocaleLowerCase();
      const deviceId = String(body.deviceId ?? "").trim().slice(0, 128);
      const code = String(body.code ?? "").trim();
      const row = await db.prepare("SELECT * FROM users WHERE lower(username) = lower(?)").get(username);
      if (!row || !deviceId || !code) return send(response, 400, { message: "Invalid verification request." });
      const record = await db.prepare("SELECT * FROM login_codes WHERE user_id = ? AND device_id = ? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1").get(row.id, deviceId);
      const nowIso = new Date().toISOString();
      if (!record || record.expires_at < nowIso || !passwordMatches(code, record.code_hash)) {
        return send(response, 401, { message: "The verification code is invalid or has expired." });
      }
      await db.prepare("UPDATE login_codes SET consumed_at = (timezone('UTC', now())::text) WHERE id = ?").run(record.id);
      await db.prepare("INSERT INTO trusted_devices (user_id, device_id) VALUES (?, ?) ON CONFLICT (user_id, device_id) DO UPDATE SET last_seen_at = (timezone('UTC', now())::text)").run(row.id, deviceId);
      const token = randomBytes(32).toString("hex");
      await db.prepare("INSERT INTO sessions (token, user_id, last_active_at) VALUES (?, ?, CURRENT_TIMESTAMP)").run(token, row.id);
      await recordAttendance(row.id, true);
      return send(response, 200, { token, user: publicUser(row) });
    }

    const actor = await authenticatedUser(request);
    if (!actor) return send(response, 401, { message: "Please log in again." });
    await recordAttendance(actor.id);

    if (request.method === "POST" && path === "/api/auth/fork") {
      const token = randomBytes(32).toString("hex");
      await db.prepare("INSERT INTO sessions (token, user_id, last_active_at) VALUES (?, ?, CURRENT_TIMESTAMP)")
        .run(token, actor.id);
      // Best-effort housekeeping — must never fail the fork (which would block a
      // page reload). Expired sessions are also pruned on access.
      try {
        const cutoff = new Date(Date.now() - sessionIdleMinutes * 60_000).toISOString().replace("T", " ").replace("Z", "");
        await db.prepare("DELETE FROM sessions WHERE last_active_at < ?").run(cutoff);
      } catch (error) {
        console.error("[sessions] cleanup skipped:", error?.message ?? error);
      }
      return send(response, 201, { token });
    }

    if (request.method === "POST" && path === "/api/auth/activity") {
      await touchSession(request);
      return send(response, 200, { ok: true });
    }

    if (request.method === "POST" && path === "/api/auth/logout") {
      const token = request.headers.authorization.replace(/^Bearer\s+/i, "");
      await db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
      return send(response, 200, { ok: true });
    }

    if (request.method === "GET" && path === "/api/chat") {
      return send(response, 200, await chatDataFor(actor));
    }

    const fileEditMatch = path.match(/^\/api\/files\/([^/]+)$/);
    if (fileEditMatch && ["PUT", "DELETE"].includes(request.method)) {
      const file = await db.prepare("SELECT * FROM task_files WHERE id = ?").get(fileEditMatch[1]);
      if (!file) fail(404, "Document not found.");
      let obsoleteStorage;
      await db.transaction(async () => {
        const task = await db.prepare("SELECT * FROM tasks WHERE id = ? FOR UPDATE").get(file.task_id);
        if (!task || !canLead(actor, task)) fail(403, "Only task leaders and managers can manage documents.");
        if (task.status === "done") fail(409, "Reopen the completed task before editing its documents.");
        if (request.method === "DELETE") {
          await db.prepare("DELETE FROM task_files WHERE id = ?").run(file.id);
          obsoleteStorage = file.storage_name;
          await recordTaskEvent(task.id, actor, "document_deleted", "Removed document: " + file.name);
        } else {
          const name = basename(String(body.name ?? file.name)).trim();
          const category = body.category ?? file.category;
          if (!name || name.length > 180 || !["task", "reference", "completion", "legacy"].includes(category)) fail(400, "Provide a valid document name and category.");
          if (body.file) {
            await saveTaskFiles(task.id, actor, [{...body.file, name}], category);
            await db.prepare("DELETE FROM task_files WHERE id = ?").run(file.id);
            obsoleteStorage = file.storage_name;
          } else await db.prepare("UPDATE task_files SET name = ?, category = ? WHERE id = ?").run(name, category, file.id);
          await recordTaskEvent(task.id, actor, "document_updated", "Updated document: " + name);
        }
      });
      if (obsoleteStorage) { try { unlinkSync(join(attachmentsPath, basename(obsoleteStorage))); } catch {} }
      return send(response, 200, {ok:true});
    }

    const fileDownloadMatch = path.match(/^\/api\/files\/([^/]+)\/download$/);
    if (request.method === "GET" && fileDownloadMatch) {
      const file = await db.prepare(`
        SELECT task_files.*, tasks.id AS task_id, tasks.department, tasks.assignee_id, tasks.project_id, tasks.allocation_request
        FROM task_files JOIN tasks ON tasks.id = task_files.task_id
        WHERE task_files.id = ?
      `).get(fileDownloadMatch[1]);
      if (!file) return send(response, 404, { message: "File not found." });
      if (!await canView(actor, file)) return send(response, 403, { message: "You cannot download this file." });
      if (!file.storage_name) return send(response, 410, { message: "This older file has no stored content." });
      try {
        const data = readFileSync(join(attachmentsPath, basename(file.storage_name)));
        return sendBinary(response, 200, data, file.mime_type || "application/octet-stream", file.name);
      } catch {
        return send(response, 404, { message: "The stored file could not be found." });
      }
    }

    const reportMatch = path.match(/^\/api\/reports\/productivity\/([^/]+)$/);
    if (request.method === "GET" && reportMatch) {
      requireManager(actor);
      const target = await db.prepare("SELECT * FROM users WHERE id = ? AND role = 'user'").get(reportMatch[1]);
      if (!target) return send(response, 404, { message: "Normal user not found." });
      if (!canAccessDepartment(actor, target.department)) {
        return send(response, 403, { message: "Admins can export reports for their own department only." });
      }
      await touchSession(request);
      const month = url.searchParams.get("month") ?? "";
      const data = await buildProductivityReport(target, month);
      const reportSlug = target.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || target.id.slice(0, 8);
      const reportName = `productivity-${reportSlug}-${/^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 10)}.xlsx`;
      return sendBinary(response, 200, data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", reportName);
    }

    if (request.method === "GET" && path === "/api/bootstrap") {
      const users = (await db.prepare("SELECT * FROM users ORDER BY name").all()).map(publicUser);
      const departmentHierarchy = (await db.prepare("SELECT id, name, parent_id FROM departments WHERE name != 'Technical Management' ORDER BY name").all()).map((item) => ({ id: item.id, name: item.name, parentId: item.parent_id }));
      const parentIds = new Set(departmentHierarchy.map((item) => item.parentId).filter(Boolean));
      const departments = departmentHierarchy.filter((item) => !parentIds.has(item.id)).map((item) => item.name);
      const taskRows = await db.prepare(`
        SELECT tasks.*, projects.name AS project_name
        FROM tasks LEFT JOIN projects ON projects.id = tasks.project_id
        ORDER BY tasks.created_at DESC
      `).all();
      const visibleTaskRows = [];
      for (const task of taskRows) {
        if (await canView(actor, task)) visibleTaskRows.push(task);
      }
      const tasks = await Promise.all(visibleTaskRows.map(serializeTask));
      const performanceRows = actor.role === "superadmin"
        ? taskRows
        : taskRows.filter((task) => canAccessDepartment(actor, task.department));
      const performanceTasks = await serializePerformanceTasks(performanceRows);
      const intelligence = buildOperationalIntelligence(performanceTasks, users.filter((user) =>
        canAccessDepartment(actor, user.department)
      ));
      const attendanceUsers = actor.role === "superadmin"
        ? await db.prepare("SELECT id, created_at FROM users WHERE role = 'user' ORDER BY name").all()
        : await db.prepare("SELECT id, created_at FROM users WHERE role = 'user' AND lower(trim(department)) = ANY(?::text[]) ORDER BY name").all(departmentScope(actor));
      const attendanceProfiles = await Promise.all(attendanceUsers.map(async (user) => ({
        userId: user.id,
        employmentStart: user.created_at.slice(0, 10),
        records: (await db.prepare(`
          SELECT work_date, first_login_at, last_login_at, login_count
          FROM attendance_records WHERE user_id = ? ORDER BY work_date DESC
        `).all(user.id)).map((record) => ({
          workDate: record.work_date,
          firstLoginAt: isoDateTime(record.first_login_at),
          lastLoginAt: isoDateTime(record.last_login_at),
          loginCount: record.login_count
        }))
      })));
      const notifications = (await db.prepare(`
        SELECT id, kind, title, body, task_id, channel_id, is_read, created_at
        FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30
      `).all(actor.id)).map((item) => ({
        id: item.id,
        kind: item.kind,
        title: item.title,
        body: item.body,
        taskId: item.task_id ?? undefined,
        channelId: item.channel_id ?? undefined,
        isRead: Boolean(item.is_read),
        createdAt: formatDate(item.created_at)
      }));
      const auditRows = actor.role === "user" ? [] : actor.role === "superadmin"
        ? await db.prepare("SELECT * FROM system_audit_logs ORDER BY created_at DESC LIMIT 150").all()
        : await db.prepare("SELECT * FROM system_audit_logs WHERE lower(trim(department)) = ANY(?::text[]) ORDER BY created_at DESC LIMIT 150").all(departmentScope(actor));
      const auditLogs = auditRows.map((entry) => ({
        id: entry.id,
        actorName: entry.actor_name,
        action: entry.action,
        entityType: entry.entity_type,
        entityId: entry.entity_id ?? undefined,
        department: entry.department ?? undefined,
        details: entry.details,
        createdAt: formatDate(entry.created_at),
        createdAtIso: isoDateTime(entry.created_at)
      }));
      return send(response, 200, {
        currentUser: actor,
        departments,
        departmentHierarchy,
        users,
        tasks,
        performanceTasks,
        intelligence,
        attendanceProfiles,
        projects: await projectsFor(actor),
        notifications,
        unreadNotificationCount: (await db.prepare("SELECT count(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0").get(actor.id)).count,
        auditLogs,
        todos: await todosFor(actor.id),
        ...(await chatDataFor(actor))
      });
    }

    if (request.method === "POST" && path === "/api/departments") {
      if (actor.role !== "superadmin") {
        return send(response, 403, { message: "Only Super Admin can create departments." });
      }
      const name = String(body.name ?? "").trim().replace(/\s+/g, " ").slice(0, 120);
      if (name.length < 2) throw new Error("Enter a department name.");
      const existing = await db.prepare("SELECT id FROM departments WHERE lower(name) = lower(?)").get(name);
      if (existing) return send(response, 409, { message: "This department already exists." });
      await db.prepare("INSERT INTO departments (id, name, created_by_id) VALUES (?, ?, ?)")
        .run(`department-${randomUUID()}`, name, actor.id);
      await audit(actor, "created", "department", name, name, `Created department ${name}`);
      return send(response, 201, { department: name });
    }

    const departmentMatch = path.match(/^\/api\/departments\/([^/]+)$/);
    if (departmentMatch && request.method === "DELETE") {
      if (actor.role !== "superadmin") {
        return send(response, 403, { message: "Only Super Admin can delete departments." });
      }
      const dept = await db.prepare("SELECT id, name FROM departments WHERE id = ?").get(departmentMatch[1]);
      if (!dept) return send(response, 404, { message: "Department not found." });
      // Reserved departments the org structure depends on may never be deleted.
      if (["Technical Department", "Executive", "Technical Management"].some((n) => sameDepartment(n, dept.name))) {
        return send(response, 400, { message: "This is a reserved department and cannot be deleted." });
      }
      // Block deletion while anything still points at it, so nothing is orphaned.
      const children = await db.prepare("SELECT count(*)::int AS n FROM departments WHERE parent_id = ?").get(dept.id);
      if (children.n > 0) return send(response, 409, { message: "Move or delete its sub-departments first." });
      const usersInDept = await db.prepare("SELECT count(*)::int AS n FROM users WHERE lower(trim(department)) = lower(trim(?))").get(dept.name);
      if (usersInDept.n > 0) return send(response, 409, { message: `Reassign the ${usersInDept.n} user(s) in this department first.` });
      const tasksInDept = await db.prepare("SELECT count(*)::int AS n FROM tasks WHERE lower(trim(department)) = lower(trim(?))").get(dept.name);
      if (tasksInDept.n > 0) return send(response, 409, { message: "This department still has tasks — remove them first." });
      await db.prepare("DELETE FROM departments WHERE id = ?").run(dept.id);
      await audit(actor, "deleted", "department", dept.name, dept.name, `Deleted department ${dept.name}`);
      await touchSession(request);
      return send(response, 200, { deleted: dept.name });
    }

    if (request.method === "POST" && path === "/api/todos") {
      const title = String(body.title ?? "").trim().slice(0, 240);
      const taskId = String(body.taskId ?? "").trim() || null;
      if (!title) throw new Error("TODO title is required.");
      if (taskId) {
        const task = await getTask(taskId);
        if (!task) return send(response, 404, { message: "Linked task not found." });
        if (!await canView(actor, task)) return send(response, 403, { message: "You cannot link a TODO to this task." });
      }
      const id = randomUUID();
      await db.prepare("INSERT INTO todos (id, user_id, task_id, title) VALUES (?, ?, ?, ?)")
        .run(id, actor.id, taskId, title);
      await touchSession(request);
      return send(response, 201, { todo: (await todosFor(actor.id)).find((todo) => todo.id === id) });
    }

    if (request.method === "DELETE" && path === "/api/todos") {
      const result = await db.prepare("DELETE FROM todos WHERE user_id = ?").run(actor.id);
      return send(response, 200, { deleted: result.changes });
    }

    const todoMatch = path.match(/^\/api\/todos\/([^/]+)$/);
    if (todoMatch && request.method === "PUT") {
      const existing = await db.prepare("SELECT * FROM todos WHERE id = ? AND user_id = ?").get(todoMatch[1], actor.id);
      if (!existing) return send(response, 404, { message: "TODO item not found." });
      const title = String(body.title ?? existing.title).trim().slice(0, 240);
      const completed = Boolean(body.completed);
      const taskId = body.taskId === undefined ? existing.task_id : String(body.taskId ?? "").trim() || null;
      if (!title) throw new Error("TODO title is required.");
      if (taskId) {
        const task = await getTask(taskId);
        if (!task) return send(response, 404, { message: "Linked task not found." });
        if (!await canView(actor, task)) return send(response, 403, { message: "You cannot link a TODO to this task." });
      }
      await db.prepare(`
        UPDATE todos
        SET title = ?, task_id = ?, is_completed = ?,
            completed_at = CASE WHEN ? = 1 THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE NULL END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?
      `).run(title, taskId, completed ? 1 : 0, completed ? 1 : 0, existing.id, actor.id);
      await touchSession(request);
      return send(response, 200, { todo: (await todosFor(actor.id)).find((todo) => todo.id === existing.id) });
    }

    if (todoMatch && request.method === "DELETE") {
      const result = await db.prepare("DELETE FROM todos WHERE id = ? AND user_id = ?").run(todoMatch[1], actor.id);
      if (!result.changes) return send(response, 404, { message: "TODO item not found." });
      await touchSession(request);
      return send(response, 200, { ok: true });
    }

    if (request.method === "POST" && path === "/api/users") {
      const target = {
        id: randomUUID(),
        name: String(body.name ?? "").trim(),
        username: String(body.username ?? "").trim(),
        password: String(body.password ?? ""),
        role: body.role ?? "user",
        department: ["admin", "team_leader"].includes(actor.role) ? actor.department : body.department
      };
      validateUserScope(actor, target);
      target.department = target.role === "superadmin" ? "Executive" : target.role === "technical_manager" ? "Technical Department" : await requireDepartment(target.department);
      if (!target.name || !target.username || !target.password) throw new Error("Name, username, and password are required.");
      validatePassword(target.password);
      const project = body.projectId ? await db.prepare("SELECT * FROM projects WHERE id = ?").get(body.projectId) : null;
      if (body.projectId && (!project || !canLeadProject(actor, project) || !projectIncludes(project.department, target.department) || target.role !== "user")) {
        return send(response, 403, { message: "Choose an existing project in the normal user's department." });
      }
      await db.transaction(async () => {
        await db.prepare(`
          INSERT INTO users (id, name, username, password_hash, role, department)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(target.id, target.name, target.username, hashPassword(target.password), target.role, target.department);
        if (project) await db.prepare("INSERT INTO project_members (project_id, user_id) VALUES (?, ?)").run(project.id, target.id);
      });
      await audit(actor, "created", "user", target.id, target.department, `Created ${target.role} ${target.name} (${target.username})`);
      return send(response, 201, { user: publicUser(target) });
    }

    const userMatch = path.match(/^\/api\/users\/([^/]+)$/);
    if (userMatch && request.method === "PUT") {
      const updatedUser = await db.transaction(async () => {
        await db.exec("LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE");
        const existing = await db.prepare("SELECT * FROM users WHERE id = ?").get(userMatch[1]);
        if (!existing) throw Object.assign(new Error("User not found."), { status: 404 });
        // Only the owner may modify the owner account.
        if (isOwner(existing) && !isOwner(actor)) throw Object.assign(new Error("Only the owner can modify the owner account."), { status: 403 });
        // The owner has full authority; other actors keep the normal scope checks.
        if (!isOwner(actor)) validateUserScope(actor, existing);
        const target = {
          ...existing,
          name: String(body.name ?? existing.name).trim(),
          username: String(body.username ?? existing.username).trim(),
          role: body.role ?? existing.role,
          department: ["admin", "team_leader"].includes(actor.role) ? actor.department : body.department
        };
        if (!isOwner(actor)) validateUserScope(actor, target);
        if (existing.role === "superadmin" && target.role !== "superadmin") {
          const otherAdmin = await db.prepare("SELECT id FROM users WHERE role = 'superadmin' AND id != ? LIMIT 1").get(existing.id);
          if (!otherAdmin) throw Object.assign(new Error("The last Super Admin cannot be demoted. Create another Super Admin first."), { status: 409 });
        }
        target.department = target.role === "superadmin" ? "Executive" : target.role === "technical_manager" ? "Technical Department" : await requireDepartment(target.department);
        if (!target.name || !target.username) throw new Error("Name and username are required.");
        await db.prepare("UPDATE users SET name = ?, username = ?, role = ?, department = ? WHERE id = ?")
          .run(target.name, target.username, target.role, target.department, target.id);
        if (body.password) {
          validatePassword(String(body.password));
          await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(body.password), target.id);
        }
        await audit(actor, "updated", "user", target.id, target.department, `Updated ${target.name}${body.password ? " and reset password" : ""}`);
        return publicUser(target);
      });
      return send(response, 200, { user: updatedUser });
    }

    if (userMatch && request.method === "DELETE") {
      requireManager(actor);
      const target = await db.prepare("SELECT * FROM users WHERE id = ?").get(userMatch[1]);
      if (!target) return send(response, 404, { message: "User not found." });
      // The owner may delete anyone (Super Admins included) but never themselves;
      // no one may delete the owner. Non-owners still can't delete a Super Admin.
      if (isOwner(target)) return send(response, 403, { message: "The owner account cannot be deleted." });
      if (target.id === actor.id) return send(response, 403, { message: "You cannot delete your own account." });
      if (!isOwner(actor)) {
        validateUserScope(actor, target);
        if (target.role === "superadmin") return send(response, 403, { message: "Only the owner can delete a Super Admin." });
      }
      await audit(actor, "deleted", "user", target.id, target.department, `Deleted ${target.name} (${target.username})`);
      await db.prepare("DELETE FROM users WHERE id = ?").run(target.id);
      await db.exec(`
        UPDATE tasks SET assignee_id = (SELECT user_id FROM task_assignees WHERE task_id = tasks.id LIMIT 1)
        WHERE assignee_id IS NULL;
        UPDATE tasks SET status = 'new', progress = 0, started_at = NULL, due_date = NULL
        WHERE status != 'done' AND NOT EXISTS (SELECT 1 FROM task_assignees WHERE task_id = tasks.id);
      `);
      return send(response, 200, { ok: true });
    }

    if (request.method === "POST" && path === "/api/projects") {
      requireManager(actor);
      const department = actor.role === "admin" ? actor.department : String(body.department ?? "").trim();
      const name = String(body.name ?? "").trim().slice(0, 140);
      const description = String(body.description ?? "").trim().slice(0, 2000);
      if (!name || !department || department === "Executive") throw new Error("Project name and department are required.");
      await requireProjectDepartment(department);
      if (!canAccessDepartment(actor, department)) return send(response, 403, { message: "This department is outside your management scope." });
      const members = await validProjectMembers(body.memberIds, department, actor);
      const id = randomUUID();
      await db.transaction(async () => {
        await db.prepare("INSERT INTO projects (id, name, description, department, created_by_id) VALUES (?, ?, ?, ?, ?)")
          .run(id, name, description, department, actor.id);
        for (const member of members) {
          await db.prepare("INSERT INTO project_members (project_id, user_id) VALUES (?, ?)").run(id, member.id);
        }
      });
      await audit(actor, "created", "project", id, department, `Created project ${name} with ${members.length} member(s)`);
      return send(response, 201, { project: (await projectsFor(actor)).find((project) => project.id === id) });
    }

    const projectTemplateMatch = path.match(/^\/api\/projects\/([^/]+)\/task-sheet-template$/);
    if (projectTemplateMatch && request.method === "GET") {
      requireManager(actor);
      const project = await db.prepare("SELECT * FROM projects WHERE id = ?").get(projectTemplateMatch[1]);
      if (!project) return send(response, 404, { message: "Project not found." });
      if (!canAccessDepartment(actor, project.department)) {
        return send(response, 403, { message: "You cannot export this project task sheet." });
      }
      const data = await buildProjectTaskTemplate(project);
      const slug = project.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "project";
      return sendBinary(response, 200, data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", `${slug}-task-sheet.xlsx`);
    }

    const projectImportMatch = path.match(/^\/api\/projects\/([^/]+)\/import$/);
    if (projectImportMatch && request.method === "POST") {
      requireManager(actor);
      const project = await db.prepare("SELECT * FROM projects WHERE id = ?").get(projectImportMatch[1]);
      if (!project) return send(response, 404, { message: "Project not found." });
      if (!canAccessDepartment(actor, project.department)) {
        return send(response, 403, { message: "You cannot import tasks into this project." });
      }
      const importedTasks = await parseTaskSheet(body.file);
      const members = await db.prepare(`
        SELECT users.* FROM project_members JOIN users ON users.id = project_members.user_id
        WHERE project_members.project_id = ?
      `).all(project.id);
      const createdIds = [];
      await db.transaction(async () => {
        for (const imported of importedTasks) {
          const assigneeIds = members
            .filter((member) => imported.assignees.some((value) =>
              value.toLowerCase() === member.username.toLowerCase() || value.toLowerCase() === member.name.toLowerCase()))
            .map((member) => member.id);
          const id = randomUUID();
          const memberDepartments = [...new Set(members.filter(member => assigneeIds.includes(member.id)).map(member => member.department))];
          const taskDepartment = sameDepartment(project.department, "Technical Department") ? memberDepartments[0] ?? body.department : project.department;
          if (memberDepartments.length > 1 || !projectIncludes(project.department, taskDepartment)) fail(400, "Each imported task needs engineers from one discipline. Assign Electrical or Mechanical engineers on each row.");
          await requireDepartment(taskDepartment);
          const taskCode = await generateTaskCode(project.name, taskDepartment);
          const status = assigneeIds.length ? "assigned" : "new";
          await db.prepare(`
            INSERT INTO tasks (id, task_code, title, department, priority, status, assignee_id, project_id, task_type, due_date, complexity, started_at, progress, created_by_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END, ?, ?)
          `).run(id, taskCode, imported.title, taskDepartment, imported.priority, status, assigneeIds[0] ?? null,
            project.id, imported.taskType, assigneeIds.length ? (imported.dueDate || null) : null,
            imported.complexity, assigneeIds.length ? 1 : 0, assigneeIds.length ? imported.progress : 0, actor.id);
          for (const userId of assigneeIds) {
            await db.prepare("INSERT INTO task_assignees (task_id, user_id) VALUES (?, ?)").run(id, userId);
          }
          await recordTaskEvent(id, actor, "created", assigneeIds.length ? `Task imported and assigned to ${assigneeIds.length} user(s)` : "Unassigned task imported");
          createdIds.push(id);
        }
      });
      for (const id of createdIds) {
        await ensureTaskChatGroup(id);
        for (const userId of await taskAssigneeIds(id)) await notify(userId, "assignment", "Imported project task", `A task was imported into ${project.name}.`, id);
      }
      await audit(actor, "imported", "project", project.id, project.department, `Imported ${createdIds.length} task(s) into ${project.name}`);
      await touchSession(request);
      return send(response, 201, { imported: createdIds.length });
    }

    const projectLeadersMatch = path.match(/^\/api\/projects\/([^/]+)\/leaders$/);
    if (projectLeadersMatch && request.method === "PUT") {
      requireManager(actor);
      const project = await db.prepare("SELECT * FROM projects WHERE id = ?").get(projectLeadersMatch[1]);
      if (!project) return send(response, 404, { message: "Project not found." });
      if (!canManage(actor, project)) return send(response, 403, { message: "You cannot assign leaders outside your department." });
      if (!Array.isArray(body.leaderIds)) return send(response, 400, { message: "Select the project team leaders." });
      const ids = [...new Set(body.leaderIds.map(String))];
      const leaders = [];
      for (const id of ids) {
        const leader = await db.prepare("SELECT * FROM users WHERE id = ?").get(id);
        if (!leader || leader.role !== "team_leader" || !projectIncludes(project.department, leader.department)) return send(response, 400, { message: "Choose team leaders from this project's department." });
        leaders.push(leader);
      }
      await db.transaction(async () => {
        await db.prepare("SELECT id FROM projects WHERE id = ? FOR UPDATE").get(project.id);
        const previous = await db.prepare("SELECT user_id FROM project_leaders WHERE project_id = ?").all(project.id);
        await db.prepare("DELETE FROM project_leaders WHERE project_id = ?").run(project.id);
        for (const leader of leaders) {
          await db.prepare("INSERT INTO project_leaders (project_id,user_id,assigned_by_id) VALUES (?,?,?)").run(project.id,leader.id,actor.id);
          if (!previous.some(item => item.user_id === leader.id)) await notify(leader.id, "project", "Project leadership assigned", actor.name + " assigned you as a team leader on " + project.name);
        }
        await audit(actor, "leaders_assigned", "project", project.id, project.department, "Team leaders for " + project.name + ": " + (leaders.map(person => person.name).join(", ") || "None"));
      });
      return send(response, 200, { project: (await projectsFor(actor)).find(item => item.id === project.id) });
    }

    const projectMembersMatch = path.match(/^\/api\/projects\/([^/]+)\/members$/);
    if (projectMembersMatch && request.method === "POST") {
      const project = await db.prepare("SELECT * FROM projects WHERE id = ?").get(projectMembersMatch[1]);
      if (!project) return send(response, 404, { message: "Project not found." });
      if (!canLeadProject(actor, project)) return send(response, 403, { message: "You cannot add members to this project." });
      const members = await validProjectMembers(body.memberIds, project.department, actor);
      if (!members.length) return send(response, 400, { message: "Select at least one normal user." });
      await db.transaction(async () => {
        for (const member of members) await db.prepare("INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)").run(project.id, member.id);
        await audit(actor, "members_added", "project", project.id, project.department, `Added ${members.map((member) => member.name).join(", ")} to ${project.name}`);
      });
      return send(response, 200, { project: (await projectsFor(actor)).find((item) => item.id === project.id) });
    }

    const projectMatch = path.match(/^\/api\/projects\/([^/]+)$/);
    if (projectMatch && request.method === "PUT") {
      requireManager(actor);
      const project = await db.prepare("SELECT * FROM projects WHERE id = ?").get(projectMatch[1]);
      if (!project) return send(response, 404, { message: "Project not found." });
      if (!canAccessDepartment(actor, project.department)) return send(response, 403, { message: "You cannot edit this project." });
      const members = await validProjectMembers(body.memberIds, project.department, actor);
      await db.transaction(async () => {
        await db.prepare("UPDATE projects SET name = ?, description = ? WHERE id = ?")
          .run(String(body.name ?? project.name).trim(), String(body.description ?? project.description).trim(), project.id);
        await db.prepare("DELETE FROM project_members WHERE project_id = ?").run(project.id);
        for (const member of members) await db.prepare("INSERT INTO project_members (project_id, user_id) VALUES (?, ?)").run(project.id, member.id);
        await db.prepare(`
          DELETE FROM task_assignees
          WHERE task_id IN (SELECT id FROM tasks WHERE project_id = ?)
            AND user_id NOT IN (SELECT user_id FROM project_members WHERE project_id = ?)
        `).run(project.id, project.id);
        await db.prepare(`
          UPDATE tasks SET assignee_id = (SELECT user_id FROM task_assignees WHERE task_id = tasks.id LIMIT 1)
          WHERE project_id = ?
        `).run(project.id);
        await db.prepare(`
          UPDATE tasks SET status = 'new', progress = 0, started_at = NULL, due_date = NULL
          WHERE project_id = ? AND status != 'done'
            AND NOT EXISTS (SELECT 1 FROM task_assignees WHERE task_id = tasks.id)
        `).run(project.id);
      });
      await audit(actor, "updated", "project", project.id, project.department, `Updated project ${project.name} with ${members.length} member(s)`);
      return send(response, 200, { project: (await projectsFor(actor)).find((item) => item.id === project.id) });
    }

    if (projectMatch && request.method === "DELETE") {
      requireManager(actor);
      const project = await db.prepare("SELECT * FROM projects WHERE id = ?").get(projectMatch[1]);
      if (!project) return send(response, 404, { message: "Project not found." });
      if (!canAccessDepartment(actor, project.department)) return send(response, 403, { message: "You cannot delete this project." });
      await db.prepare("UPDATE tasks SET project_id = NULL WHERE project_id = ?").run(project.id);
      await audit(actor, "deleted", "project", project.id, project.department, `Deleted project ${project.name}`);
      await db.prepare("DELETE FROM projects WHERE id = ?").run(project.id);
      return send(response, 200, { ok: true });
    }

    if (request.method === "POST" && path === "/api/tasks") {
      if (!["superadmin", "admin", "technical_manager", "team_leader"].includes(actor.role)) return send(response, 403, { message: "Task allocation permission required." });
      const requiresApproval = actor.role === "team_leader" && body.requiresApproval !== false;
      const project = body.projectId ? await db.prepare("SELECT * FROM projects WHERE id = ?").get(body.projectId) : null;
      if (body.projectId && !project) return send(response, 404, { message: "Project not found." });
      const requestedIds = Array.isArray(body.assigneeIds) ? body.assigneeIds : body.assigneeId ? [body.assigneeId] : [];
      const firstRequested = requestedIds[0] ? await db.prepare("SELECT * FROM users WHERE id = ? AND role = 'user'").get(requestedIds[0]) : null;
      const department = (project && !sameDepartment(project.department, "Technical Department") ? project.department : undefined) ?? firstRequested?.department ?? (["admin", "team_leader"].includes(actor.role) ? actor.department : body.department);
      await requireDepartment(department);
      if (project && !projectIncludes(project.department, department)) fail(400, "Choose a task discipline within this project.");
      if (!canAccessDepartment(actor, department)) return send(response, 403, { message: "Tasks can be created in your own department only." });
      const assignees = await validTaskAssignees(requestedIds, department, project?.id ?? null);
      const complexity = normalizeComplexity(body.complexity);
      const dueDate = assignees.length ? (String(body.dueDate ?? "").slice(0, 10) || null) : null;
      const task = {
        id: randomUUID(),
        title: String(body.title ?? "").trim(),
        department,
        priority: body.priority,
        status: assignees.length ? "assigned" : "new",
        assigneeIds: assignees.map((assignee) => assignee.id),
        dueDate,
        complexity,
        progress: 0,
        projectId: project?.id ?? null,
        taskType: normalizeTaskType(body.taskType)
      };
      task.taskCode = await generateTaskCode(project?.name, department);
      if (!task.title) throw new Error("Task title is required.");
      const initialSteps = body.checklist ?? [];
      if (!Array.isArray(initialSteps) || initialSteps.length > 100 || initialSteps.some(item => !String(item?.title ?? "").trim() || String(item.title).trim().length > 200)) fail(400, "Provide up to 100 work steps, each with 1?200 characters.");
      const assigneeIdSet = new Set(task.assigneeIds);
      if (initialSteps.some(item => item?.assigneeId && !assigneeIdSet.has(String(item.assigneeId)))) fail(400, "Work step owners must be assigned to this task.");
      const checklist = initialSteps.map(item => ({ id: randomUUID(), title: String(item.title).trim(), assigneeId: item.assigneeId ? String(item.assigneeId) : undefined, completed: false }));
      const createdTask = await db.transaction(async () => {
        await db.prepare(`
          INSERT INTO tasks (id, task_code, title, department, priority, status, assignee_id, project_id, task_type, due_date, complexity, started_at, progress, created_by_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END, ?, ?)
        `).run(task.id, task.taskCode, task.title, task.department, task.priority, requiresApproval ? "new" : task.status, requiresApproval ? null : task.assigneeIds[0] ?? null,
          task.projectId, task.taskType, requiresApproval ? null : task.dueDate, task.complexity, !requiresApproval && task.assigneeIds.length ? 1 : 0, requiresApproval ? 0 : task.progress, actor.id);
        await db.prepare("UPDATE tasks SET checklist = ?::jsonb WHERE id = ?").run(JSON.stringify(checklist), task.id);
        if (requiresApproval) {
          await requestAllocation(task, actor, assignees, task.dueDate, true);
        } else {
          await setTaskAssignees(task.id, task.assigneeIds);
        }
        if (!requiresApproval && task.assigneeIds.length && actor.role === "team_leader") await recordTaskEvent(task.id, actor, "leader_allocated", "Allocated task to " + assignees.map(user => user.name).join(", "));
        await recordTaskEvent(task.id, actor, "created", !requiresApproval && task.assigneeIds.length ? `Task created and assigned to ${task.assigneeIds.length} user(s)` : "Unassigned task created");
        await audit(actor, "created", "task", task.id, task.department, `Created ${task.taskCode}: ${task.title}`);
        try {
          await saveTaskFiles(task.id, actor, body.files);
        } catch (error) {
          await db.prepare("DELETE FROM tasks WHERE id = ?").run(task.id);
          throw error;
        }
        for (const userId of requiresApproval ? [] : task.assigneeIds) await notify(userId, "assignment", "New task allocated", `You were assigned: ${task.title}`, task.id);

        return serializeTask(await getTask(task.id));
      });
      await touchSession(request);
      return send(response, 201, { task: createdTask });
    }

    const taskMatch = path.match(/^\/api\/tasks\/([^/]+)$/);
    if (taskMatch && request.method === "PUT") {
      const existing = await getTask(taskMatch[1]);
      if (!existing) return send(response, 404, { message: "Task not found." });
      if (!canManage(actor, existing)) return send(response, 403, { message: "You cannot edit this task." });
      if (existing.status === "done") return send(response, 409, { message: "Completed tasks must be reopened before they can be edited." });
      if (existing.action_request?.state === "pending") return send(response, 409, { message: "Review the pending task action before editing." });
      if (existing.allocation_request?.isNew || existing.allocation_request?.state === "pending") return send(response, 409, { message: "Review the pending allocation before editing this task." });
      const project = body.projectId ? await db.prepare("SELECT * FROM projects WHERE id = ?").get(body.projectId) : null;
      if (body.projectId && !project) return send(response, 404, { message: "Project not found." });
      const requestedIds = Array.isArray(body.assigneeIds) ? body.assigneeIds : body.assigneeId ? [body.assigneeId] : [];
      const department = (project && !sameDepartment(project.department, "Technical Department") ? project.department : undefined) ?? body.department ?? existing.department;
      await requireDepartment(department);
      if (project && !projectIncludes(project.department, department)) fail(400, "Choose a task discipline within this project.");
      if (!canAccessDepartment(actor, department)) return send(response, 403, { message: "Admins can edit tasks in their department only." });
      const assignees = await validTaskAssignees(requestedIds, department, project?.id ?? null);
      const previousIds = await taskAssigneeIds(existing.id);
      const complexity = normalizeComplexity(body.complexity ?? existing.complexity);
      const dueDate = assignees.length
        ? (String(body.dueDate ?? existing.due_date ?? "").slice(0, 10) || null)
        : null;
      const requestedStatus = String(body.status ?? existing.status);
      if (["done", "under_review"].includes(requestedStatus) && requestedStatus !== existing.status) {
        return send(response, 409, { message: "Use the submit and approval workflow to complete a task." });
      }
      const status = assignees.length ? requestedStatus : "new";
      const progress = assignees.length ? Math.max(0, Math.min(100, Number(body.progress) || 0)) : 0;
      await db.prepare(`
        UPDATE tasks SET title = ?, department = ?, priority = ?, status = ?, assignee_id = ?, project_id = ?, task_type = ?, due_date = ?, complexity = ?,
          started_at = CASE WHEN ? = 1 THEN COALESCE(started_at, CURRENT_TIMESTAMP) ELSE NULL END,
          claim_requested_by_id = NULL, claim_requested_at = NULL, leader_approved_at = NULL, leader_approved_by_id = NULL, progress = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(String(body.title).trim(), department, body.priority, status, assignees[0]?.id ?? null,
        project?.id ?? null, normalizeTaskType(body.taskType), dueDate, complexity,
        assignees.length ? 1 : 0, progress, existing.id);
      await setTaskAssignees(existing.id, assignees.map((assignee) => assignee.id));
      const allowedStepOwners = new Set(assignees.map((assignee) => assignee.id));
      const cleanedChecklist = (existing.checklist ?? []).map((item) => item.assigneeId && !allowedStepOwners.has(item.assigneeId) ? { ...item, assigneeId: undefined } : item);
      await db.prepare("UPDATE tasks SET checklist = ?::jsonb WHERE id = ?").run(JSON.stringify(cleanedChecklist), existing.id);
      if (assignees.length) await db.prepare("DELETE FROM task_claim_requests WHERE task_id = ?").run(existing.id);
      const nextIds = assignees.map((assignee) => assignee.id);
      const changes = [];
      if (String(body.title).trim() !== existing.title) changes.push(`Title: "${existing.title}" → "${String(body.title).trim()}"`);
      if (body.priority !== existing.priority) changes.push(`Priority: ${existing.priority} → ${body.priority}`);
      if (status !== existing.status) changes.push(`Status: ${existing.status} → ${status}`);
      if ((existing.due_date ?? "") !== (dueDate ?? "")) changes.push(`Deadline: ${existing.due_date || "none"} → ${dueDate || "none"}`);
      if (normalizeComplexity(existing.complexity) !== complexity) changes.push(`Complexity: ${normalizeComplexity(existing.complexity)} → ${complexity}`);
      const assignmentChanged = [...previousIds].sort().join(",") !== [...nextIds].sort().join(",");
      if (assignmentChanged || (existing.status === "under_review" && status !== "under_review")) {
        await db.prepare("DELETE FROM task_worker_approvals WHERE task_id = ?").run(existing.id);
        await db.prepare("UPDATE tasks SET leader_approved_at = NULL, leader_approved_by_id = NULL, status = CASE WHEN status = 'under_review' THEN 'assigned' ELSE status END WHERE id = ?").run(existing.id);
      }
      if (assignmentChanged) changes.push(`Assignees: ${previousIds.length || "none"} → ${nextIds.length || "none"}`);
      await recordTaskEvent(existing.id, actor, assignmentChanged ? "reassigned" : "updated", changes.join(" · ") || "Task details saved");
      if (body.status === "done") await deleteTaskChatGroup(existing.id);
      for (const assignee of assignees.filter((item) => !previousIds.includes(item.id))) {
        await notify(assignee.id, "assignment", "Task allocated", `You were assigned: ${body.title}`, existing.id);
      }
      return send(response, 200, { task: await serializeTask(await getTask(existing.id)) });
    }

    if (taskMatch && request.method === "DELETE") {
      const task = await getTask(taskMatch[1]);
      if (!task) return send(response, 404, { message: "Task not found." });
      if (!canManage(actor, task)) return send(response, 403, { message: "You cannot delete this task." });
      const files = await db.prepare("SELECT storage_name FROM task_files WHERE task_id = ?").all(task.id);
      await audit(actor, "deleted", "task", task.id, task.department, `Deleted ${task.task_code}: ${task.title}`);
      await deleteTaskChatGroup(task.id);
      await db.prepare("DELETE FROM tasks WHERE id = ?").run(task.id);
      for (const file of files) {
        if (!file.storage_name) continue;
        try { unlinkSync(join(attachmentsPath, basename(file.storage_name))); } catch { /* Already absent. */ }
      }
      return send(response, 200, { ok: true });
    }

    const checklistMatch = path.match(/^\/api\/tasks\/([^/]+)\/checklist$/);
    if (checklistMatch && request.method === "PUT") {
      await db.transaction(async () => {
        const task = await db.prepare("SELECT * FROM tasks WHERE id = ? FOR UPDATE").get(checklistMatch[1]);
        if (!task || !await canView(actor, task)) fail(404, "Task not found.");
        const manages = canLead(actor, task);
        const assigned = (await taskAssigneeIds(task.id)).includes(actor.id);
        if (!manages && !assigned) fail(403, "Only assigned people or task leaders can update the checklist.");
        if (["done", "under_review"].includes(task.status) || task.action_request || task.allocation_request?.state === "pending") fail(409, "Reopen the task or resolve its pending review before changing the checklist.");
        const assigneeIds = await taskAssigneeIds(task.id);
        const normalizeStepAssignee = () => {
          const assigneeId = String(body.assigneeId ?? "").trim();
          if (!assigneeId) return undefined;
          if (!assigneeIds.includes(assigneeId)) fail(400, "Choose one of this task's assigned users, or leave responsibility open.");
          return assigneeId;
        };
        let items = task.checklist ?? [];
        if (body.action === "add") {
          if (!manages) fail(403, "Only task leaders or managers can define work steps.");
          const title = String(body.title ?? "").trim();
          if (!title || title.length > 200 || items.length >= 100) fail(400, "Use a step of 1?200 characters; up to 100 steps per task.");
          items = [...items, {id: randomUUID(), title, assigneeId: normalizeStepAssignee(), completed: false}];
        } else {
          const item = items.find(item => item.id === body.id);
          if (!item) fail(409, "This checklist step has changed. Refresh the task.");
          if (body.action === "edit") {
            if (!manages) fail(403, "Only task leaders or managers can edit work steps.");
            const title = String(body.title ?? "").trim();
            if (!title || title.length > 200) fail(400, "Use a step of 1?200 characters.");
            items = items.map(item => item.id === body.id ? {...item, title, assigneeId: normalizeStepAssignee(), completed: false} : item);
          } else if (body.action === "delete") {
            if (!manages) fail(403, "Only task leaders or managers can remove work steps.");
            items = items.filter(item => item.id !== body.id);
          } else if (body.action === "toggle" && typeof body.completed === "boolean") {
            if (item.assigneeId && actor.id !== item.assigneeId) fail(403, "Only the responsible user can close this work step.");
            if (!item.assigneeId && !manages && !assigned) fail(403, "Only assigned people or task leaders can close open work steps.");
            items = items.map(item => item.id === body.id ? {...item, completed: body.completed} : item);
          } else fail(400, "Invalid checklist action.");
        }
        // Fill the progress bar automatically from completed work steps (capped
        // at 90% — the final 10% is reserved for the leader's approval → 100%).
        const doneCount = items.filter(item => item.completed).length;
        const stepProgress = items.length ? Math.min(90, Math.round((doneCount / items.length) * 100)) : null;
        await db.prepare("UPDATE tasks SET checklist = ?::jsonb, status = CASE WHEN status = 'assigned' THEN 'in_progress' ELSE status END, progress = COALESCE(?, progress), leader_approved_at = NULL, leader_approved_by_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(JSON.stringify(items), stepProgress, task.id);
        await db.prepare("DELETE FROM task_worker_approvals WHERE task_id = ?").run(task.id);
        await recordTaskEvent(task.id, actor, "checklist_updated", items.filter(item => item.completed).length + " of " + items.length + " work steps completed");
        if (body.action === "add" && body.assigneeId) await notify(body.assigneeId, "assignment", `New work step on ${task.task_code}`, `${actor.name} assigned you: ${String(body.title ?? "").trim()}`, task.id);
      });
      return send(response, 200, { task: await serializeTask(await getTask(checklistMatch[1])) });
    }

    const taskMessageMatch = path.match(/^\/api\/tasks\/([^/]+)\/messages\/([^/]+)$/);
    if (taskMessageMatch && ["PUT", "DELETE"].includes(request.method)) {
      const task = await getTask(taskMessageMatch[1]);
      if (!task || !await canView(actor, task)) return send(response, 404, { message: "Task comment not found." });
      const message = await db.prepare("SELECT * FROM task_messages WHERE id = ? AND task_id = ?")
        .get(taskMessageMatch[2], task.id);
      if (!message) return send(response, 404, { message: "Task comment not found." });
      if (message.author_id !== actor.id) return send(response, 403, { message: "You can change only your own comments." });
      if (task.status === "done") return send(response, 409, { message: "Completed task comments are read-only." });
      if (request.method === "PUT") {
        const nextBody = String(body.body ?? "").trim().slice(0, 2000);
        if (!nextBody) throw new Error("Comment cannot be empty.");
        const people = await taskConversationPeople(task);
        const mentions = taskMentionRecipients(nextBody, people);
        const previousNames = new Set([...message.body.matchAll(/@\[([^\]]+)\]/g)].map(match => match[1].trim().toLocaleLowerCase()));
        for (const person of people) if (person.id !== actor.id && mentions.has(person.id) && !previousNames.has(person.name.trim().toLocaleLowerCase())) await notify(person.id, "mention", `You were mentioned on ${task.task_code}`, `${actor.name}: ${nextBody}`, task.id);
        await db.prepare("UPDATE task_messages SET body = ? WHERE id = ?").run(nextBody, message.id);
        await recordTaskEvent(task.id, actor, "comment_edited", `Edited comment: ${nextBody.slice(0, 180)}`);
      } else {
        await db.prepare("DELETE FROM task_messages WHERE id = ?").run(message.id);
        await recordTaskEvent(task.id, actor, "comment_deleted", `Deleted comment: ${message.body.slice(0, 180)}`);
      }
      await touchSession(request);
      return send(response, 200, { task: await serializeTask(task) });
    }

    const actionMatch = path.match(/^\/api\/tasks\/([^/]+)\/(view|claim|claim-approve|claim-reject|submit|approve|reopen|allocation-request|allocation-approve|allocation-reject|request-approve|request-reject|finish|messages|files)$/);
    if (actionMatch && request.method === "POST") {
      const task = await getTask(actionMatch[1]);
      if (!task) return send(response, 404, { message: "Task not found." });
      const action = actionMatch[2];
      const assignedUserIds = await taskAssigneeIds(task.id);

      if (["allocation-request", "allocation-approve", "allocation-reject"].includes(action)) {
        await db.transaction(async () => {
          const locked = await db.prepare("SELECT * FROM tasks WHERE id = ? FOR UPDATE").get(task.id);
          const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
          if (locked.action_request?.state === "pending") fail(409, "Review the pending task action first.");
          if (!canLead(actor, locked)) fail(403, "You cannot allocate tasks in this department.");
          if (locked.status === "done" || locked.status === "under_review") fail(409, "Reopen this task before changing its allocation.");
          const immediateAllocation = action === "allocation-request" && body.requiresApproval === false;
          let proposal = locked.allocation_request;
          if (action === "allocation-request") {
            if (actor.role !== "team_leader") fail(403, "Only team leaders submit allocation requests.");
            if (locked.allocation_request?.state === "pending") fail(409, "An allocation request is already awaiting approval.");
            const assignees = await validTaskAssignees(body.assigneeIds, locked.department, locked.project_id);
            if (!assignees.length) fail(400, "Select at least one team member.");
            const dueDate = String(body.dueDate ?? "").slice(0, 10) || null;
            if (!immediateAllocation) {
              await requestAllocation(locked, actor, assignees, dueDate, Boolean(locked.allocation_request?.isNew));
              return;
            }
            proposal = { assigneeIds: assignees.map((user) => user.id), dueDate, requesterId: actor.id };
          }
          if (!immediateAllocation && !canManage(actor, locked)) fail(403, "Admin approval is required for allocation requests.");
          if (!immediateAllocation && (proposal?.state !== "pending" || proposal.id !== body.requestId)) fail(409, "This allocation request has changed. Refresh and review it again.");
          if (action === "allocation-reject") {
            proposal.state = "rejected";
            await db.prepare("UPDATE tasks SET allocation_request = ?::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(JSON.stringify(proposal), task.id);
            await recordTaskEvent(task.id, actor, "allocation_rejected", "Admin rejected the allocation request");
            await notify(proposal.requesterId, "allocation", "Allocation rejected", `${actor.name} rejected allocation of ${task.title}`, task.id);
            return;
          }
          const assignees = await validTaskAssignees(proposal.assigneeIds, locked.department, locked.project_id);
          await db.prepare("DELETE FROM task_worker_approvals WHERE task_id = ?").run(task.id);
          await db.prepare("DELETE FROM task_claim_requests WHERE task_id = ?").run(task.id);
          await db.prepare(`UPDATE tasks SET allocation_request = NULL, leader_approved_at = NULL, leader_approved_by_id = NULL,
            status = ?, progress = 0, due_date = ?, started_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END,
            claim_requested_by_id = NULL, claim_requested_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
            .run(assignees.length ? "assigned" : "new", assignees.length ? proposal.dueDate : null, assignees.length ? 1 : 0, task.id);
          await setTaskAssignees(task.id, proposal.assigneeIds);
          if (assignees.length && proposal.requesterId) {
            const leader = await db.prepare("SELECT * FROM users WHERE id = ?").get(proposal.requesterId);
            if (leader?.role === "team_leader") await recordTaskEvent(task.id, leader, "leader_allocated", "Allocated task to " + assignees.map(user => user.name).join(", "));
          }
          await recordTaskEvent(task.id, actor, "allocation_approved", `${immediateAllocation ? "Team leader applied allocation without admin approval" : "Admin approved allocation"} to ${assignees.map((user) => user.name).join(", ") || "the department free task queue"}`);
          if (!immediateAllocation) await notify(proposal.requesterId, "allocation", "Allocation approved", `${actor.name} approved allocation of ${task.title}`, task.id);
          for (const user of assignees) await notify(user.id, "assignment", "New task allocated", `You were assigned: ${task.title}`, task.id);
        });
        return send(response, 200, { task: await serializeTask(await getTask(task.id)) });
      }

      if (action === "view") {
        if (!await canView(actor, task)) return send(response, 403, { message: "You cannot view this task." });
        const recentView = await db.prepare(`
          SELECT id FROM task_events WHERE task_id = ? AND actor_id = ? AND event_type = 'viewed'
            AND created_at::timestamp > timezone('UTC', now() - interval '5 minutes')
          LIMIT 1
        `).get(task.id, actor.id);
        if (!recentView) await recordTaskEvent(task.id, actor, "viewed", "Opened the task workspace");
        await touchSession(request);
        return send(response, 200, { ok: true });
      }

      if (task.allocation_request?.isNew && ["claim", "claim-approve", "submit", "approve", "reopen"].includes(action)) return send(response, 409, { message: "This task is awaiting allocation approval." });
      if (task.action_request?.state === "pending" && ["claim", "claim-approve", "submit"].includes(action)) return send(response, 409, { message: "Review the pending task request first." });

      if (task.allocation_request?.state === "pending" && ["claim", "claim-approve"].includes(action)) return send(response, 409, { message: "Review the pending allocation first." });

      if (action === "claim") {
        if (task.status !== "new" || actor.role !== "user" || !sameDepartment(actor.department, task.department) || assignedUserIds.length || !await canView(actor, task)) return send(response, 403, { message: "This task cannot be claimed." });
        const result = await db.prepare(`
          INSERT OR IGNORE INTO task_claim_requests (task_id, user_id)
          VALUES (?, ?)
        `).run(task.id, actor.id);
        if (!result.changes) return send(response, 409, { message: "Your request is already waiting for approval." });
        await db.prepare(`
          UPDATE tasks SET claim_requested_by_id = COALESCE(claim_requested_by_id, ?),
            claim_requested_at = COALESCE(claim_requested_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(actor.id, task.id);
        for (const leader of await db.prepare("SELECT * FROM users WHERE role = 'team_leader'").all()) {
          if (canLead(leader, task)) await notify(leader.id, "claim", "Task claim needs approval", `${actor.name} requested to take ${task.task_code}: ${task.title}`, task.id);
        }
        await notifyTaskManagers(task, actor.id, "Task claim needs approval", `${actor.name} requested to take ${task.task_code}: ${task.title}`, task.id);
        await recordTaskEvent(task.id, actor, "claim_requested", "Requested to take this task");
      }
      if (action === "claim-approve") {
        if (!canLead(actor, task)) return send(response, 403, { message: "A department admin or team leader must review this request." });
        if (assignedUserIds.length) return send(response, 409, { message: "This task is already assigned." });
        const pendingRequests = await db.prepare(`
          SELECT users.* FROM task_claim_requests JOIN users ON users.id = task_claim_requests.user_id
          WHERE task_claim_requests.task_id = ? AND users.role = 'user'
          ORDER BY task_claim_requests.requested_at ASC
        `).all(task.id);
        if (!pendingRequests.length) return send(response, 409, { message: "This task has no pending claim requests." });
        const requestedUserIds = Array.isArray(body.userIds) ? body.userIds.map(String) : [];
        const approveAll = body.all === true || !requestedUserIds.length;
        const selectedIds = approveAll ? pendingRequests.map((requester) => requester.id) : requestedUserIds;
        const selectedIdSet = new Set(selectedIds);
        const requesters = pendingRequests.filter((requester) => selectedIdSet.has(requester.id) && sameDepartment(requester.department, task.department));
        if (!requesters.length) return send(response, 409, { message: "Select at least one eligible requester." });
        const declinedRequesters = pendingRequests.filter((requester) => !requesters.some((approved) => approved.id === requester.id));
        await db.transaction(async () => {
          const locked = await db.prepare("SELECT * FROM tasks WHERE id = ? FOR UPDATE").get(task.id);
          if (locked.status !== "new" || (await taskAssigneeIds(task.id)).length || locked.action_request || locked.allocation_request?.state === "pending") fail(409, "This task is no longer available for claim approval.");
          const remaining = await db.prepare("SELECT user_id FROM task_claim_requests WHERE task_id = ?").all(task.id);
          if (requesters.some((person) => !remaining.some((request) => request.user_id === person.id))) fail(409, "A selected request is no longer pending.");
          for (const requester of requesters) {
            await db.prepare("INSERT INTO task_assignees (task_id, user_id) VALUES (?, ?)").run(task.id, requester.id);
          }
          await db.prepare(`
            UPDATE tasks SET assignee_id = ?, status = 'assigned', started_at = CURRENT_TIMESTAMP, due_date = ?,
              claim_requested_by_id = NULL, claim_requested_at = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(requesters[0].id, task.due_date ?? null, task.id);
          await db.prepare("DELETE FROM task_claim_requests WHERE task_id = ?").run(task.id);
        });
        for (const requester of requesters) await notify(requester.id, "claim", "Task claim approved", `${actor.name} approved your request for ${task.task_code}: ${task.title}`, task.id);
        for (const requester of declinedRequesters) await notify(requester.id, "claim", "Task claim closed", `${actor.name} assigned ${task.task_code} to another requester.`, task.id);
        if (actor.role === "team_leader") await recordTaskEvent(task.id, actor, "leader_allocated", "Accepted task claim for " + requesters.map(user => user.name).join(", "));
        await recordTaskEvent(task.id, actor, "claim_approved", `${requesters.map((requester) => requester.name).join(", ")} assigned and the task started`);
      }
      if (action === "claim-reject") {
        if (!canLead(actor, task)) return send(response, 403, { message: "A department admin or team leader must review this request." });
        const requesterId = String(body.userId ?? task.claim_requested_by_id ?? "");
        if (!requesterId) return send(response, 409, { message: "Choose a claim request to reject." });
        const requester = await db.prepare("SELECT * FROM users WHERE id = ? AND role = 'user'").get(requesterId);
        const result = await db.prepare("DELETE FROM task_claim_requests WHERE task_id = ? AND user_id = ?").run(task.id, requesterId);
        if (!result.changes) return send(response, 409, { message: "This claim request is no longer pending." });
        const nextRequest = await db.prepare("SELECT user_id, requested_at FROM task_claim_requests WHERE task_id = ? ORDER BY requested_at ASC LIMIT 1").get(task.id);
        await db.prepare("UPDATE tasks SET claim_requested_by_id = ?, claim_requested_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(nextRequest?.user_id ?? null, nextRequest?.requested_at ?? null, task.id);
        await notify(requesterId, "claim", "Task claim declined", `${actor.name} declined your request for ${task.task_code}: ${task.title}`, task.id);
        await recordTaskEvent(task.id, actor, "claim_rejected", `${requester?.name ?? "A requester"} claim request declined`);
      }
      if (task.allocation_request?.state === "pending" && ["submit", "claim", "claim-approve"].includes(action)) return send(response, 409, { message: "Review the pending allocation before starting or submitting this task." });

      if (action === "submit") {
        await db.transaction(async () => {
          const task = await db.prepare("SELECT * FROM tasks WHERE id = ? FOR UPDATE").get(actionMatch[1]);
          const assignedUserIds = await taskAssigneeIds(task.id);
          if (task.action_request?.state === "pending") throw Object.assign(new Error("Review the pending task action first."), { status: 409 });
          if (task.allocation_request?.state === "pending") throw Object.assign(new Error("Review the pending allocation first."), { status: 409 });
          if (actor.role !== "user" || !assignedUserIds.includes(actor.id) || ["done", "under_review"].includes(task.status)) throw Object.assign(new Error("This task cannot be submitted."), { status: 403 });
          const submitted = await db.prepare("INSERT OR IGNORE INTO task_worker_approvals (task_id, user_id) VALUES (?, ?)").run(task.id, actor.id);
          if (!submitted.changes) throw Object.assign(new Error("You already submitted this task for review."), { status: 409 });
          const approvedIds = (await db.prepare("SELECT user_id FROM task_worker_approvals WHERE task_id = ?").all(task.id)).map((item) => item.user_id);
          const remainingIds = assignedUserIds.filter((userId) => !approvedIds.includes(userId));
          const remainingWorkers = remainingIds.length
            ? await db.prepare(`SELECT name FROM users WHERE id IN (${remainingIds.map(() => "?").join(",")}) ORDER BY name`).all(...remainingIds)
            : [];
          const waitingNames = remainingWorkers.map((worker) => worker.name);
          const waitingText = waitingNames.length <= 1
            ? waitingNames[0]
            : `${waitingNames.slice(0, -1).join(", ")} and ${waitingNames.at(-1)}`;
          await recordTaskEvent(
            task.id,
            actor,
            "worker_finished",
            waitingNames.length
              ? `${actor.name} → finished · waiting for ${waitingText} to approve`
              : `${actor.name} → finished · all workers approved, waiting for team leader / admin review`
          );
          if (remainingIds.length) {
            await db.prepare("UPDATE tasks SET status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(task.id);
            for (const userId of remainingIds) await notify(userId, "approval", "Worker approval needed", `${actor.name} finished ${task.task_code}. Waiting for your approval.`, task.id);
          } else {
            await db.prepare("UPDATE tasks SET status = 'under_review', progress = 100, leader_approved_at = NULL, leader_approved_by_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(task.id);
            await notifyTaskAudience(task, actor.id, "Task ready for review", `All workers approved ${task.task_code}: ${task.title}`);
            // Tell the team leader(s)/admin a submission awaits their approval (emailed).
            const reviewers = (await db.prepare("SELECT * FROM users WHERE role IN ('admin', 'technical_manager', 'team_leader')").all()).filter((leader) => canLead(leader, task));
            for (const leader of reviewers) {
              await notify(leader.id, "approval_request", `Approval needed: ${task.task_code}`, `${actor.name} submitted ${task.task_code}: ${task.title} for your review and approval.`, task.id);
            }
          }
        });
      }
      if (["approve", "finish", "reopen", "request-approve", "request-reject"].includes(action)) {
        await db.transaction(async () => {
          const task = await db.prepare("SELECT * FROM tasks WHERE id = ? FOR UPDATE").get(actionMatch[1]);
          const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
          if (!canLead(actor, task)) fail(403, "You cannot review tasks in this department.");
          if (task.allocation_request?.isNew || task.allocation_request?.state === "pending") fail(409, "Review the pending allocation first.");
          const proposal = task.action_request;
          if (action === "request-approve" || action === "request-reject") {
            if (!canManage(actor, task)) fail(403, "An admin must review this request.");
            if (proposal?.state !== "pending" || proposal.id !== body.requestId) fail(409, "This request has changed. Refresh and review it again.");
            if (action === "request-reject") {
              await db.prepare("UPDATE tasks SET action_request = NULL, leader_approved_at = NULL, leader_approved_by_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(task.id);
              await recordTaskEvent(task.id, actor, "action_rejected", "Rejected team leader request: " + proposal.action);
            } else {
              if (task.status !== proposal.previousStatus) fail(409, "The task has changed since this request. Reject it and request again.");
              if (proposal.action === "reopen") await reopenCompletedTask(task, actor, proposal.comment);
              else await completeTask(task, actor);
              await recordTaskEvent(task.id, actor, "action_approved", "Approved team leader request: " + proposal.action);
            }
            await notify(proposal.requesterId, "approval", action === "request-approve" ? "Task request approved" : "Task request rejected", actor.name + " reviewed your " + proposal.action + " request for " + task.title, task.id);
            return;
          }
          // Keep the existing final-approval button compatible with pending leader approvals.
          if (proposal?.state === "pending") {
            if (action !== "approve" || proposal.action !== "approve" || !canManage(actor, task)) fail(409, "Review the pending task request first.");
            await completeTask(task, actor);
            await notify(proposal.requesterId, "approval", "Task request approved", actor.name + " approved " + task.title, task.id);
            return;
          }
          const comment = String(body.comment ?? "").trim();
          if (action === "approve" && task.status !== "under_review") fail(409, "This task is not ready for approval.");
                    if (action === "finish" && (actor.role !== "team_leader" || !["assigned", "in_progress", "blocked"].includes(task.status))) fail(403, "This task cannot be finished by this user.");
          if (action === "reopen") {
            if (!comment) fail(400, "A review comment is required.");
            if (!["done", "under_review"].includes(task.status) && actor.role !== "team_leader") fail(403, "This task cannot be reopened.");
          }
          if (actor.role === "team_leader") {
            if (body.requiresApproval !== false) {
              const request = { id: randomUUID(), action, comment, requesterId: actor.id, requesterName: actor.name, previousStatus: task.status, state: "pending" };
              await notifyDepartmentAdmins(task, "Task " + action + " needs approval", actor.name + " requested to " + action + ": " + task.title);
              await db.prepare("UPDATE tasks SET action_request = ?::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(JSON.stringify(request), task.id);
              if (action === "approve" || action === "finish") await db.prepare("UPDATE tasks SET leader_approved_by_id = ?, leader_approved_at = CURRENT_TIMESTAMP WHERE id = ?").run(actor.id, task.id);
              await recordTaskEvent(task.id, actor, "action_requested", "Requested department admin approval to " + action + (comment ? ": " + comment : ""));
              return;
            }
            if (action !== "reopen") await db.prepare("UPDATE tasks SET leader_approved_by_id = ?, leader_approved_at = CURRENT_TIMESTAMP WHERE id = ?").run(actor.id, task.id);
            await recordTaskEvent(task.id, actor, "approval_not_required", "Team leader chose to " + action + " without admin approval");
          } else if (action === "approve" && actor.role !== "technical_manager" && await needsLeaderApproval(task)) {
            fail(409, "Team leader approval is required before final admin approval.");
          }
          if (action === "reopen") await reopenCompletedTask(task, actor, comment);
          else await completeTask(task, actor);
        });
      }
      if (action === "messages") {
        if (!await canView(actor, task)) return send(response, 403, { message: "You cannot view this task." });
        if (actor.role === "user" && !assignedUserIds.includes(actor.id)) return send(response, 403, { message: "Take or be assigned to this task before adding comments." });
        if (task.status === "done") return send(response, 409, { message: "Approved tasks are read-only. Existing comments remain available." });
        const message = String(body.body ?? "").trim();
        if (!message || message.length > 2000) fail(400, "Write a comment between 1 and 2000 characters.");
        const people = await taskConversationPeople(task);
        const mentions = taskMentionRecipients(message, people);
        await db.prepare("INSERT INTO task_messages (id, task_id, author_id, author_name, body) VALUES (?, ?, ?, ?, ?)")
          .run(randomUUID(), task.id, actor.id, actor.name, message);
        await recordTaskEvent(task.id, actor, "commented", message.slice(0, 240));
        for (const person of people) {
          if (person.id === actor.id) continue;
          await notify(person.id, mentions.has(person.id) ? "mention" : "task", mentions.has(person.id) ? `You were mentioned on ${task.task_code}` : `New comment on ${task.task_code}`, `${actor.name}: ${message}`, task.id);
        }
      }
      if (action === "files") {
        if (!await canView(actor, task)) return send(response, 403, { message: "You cannot view this task." });
        if (actor.role === "user" && !assignedUserIds.includes(actor.id)) return send(response, 403, { message: "Take or be assigned to this task before attaching documents." });
        if (task.status === "done") return send(response, 409, { message: "Approved tasks are locked. Existing documents remain available for download." });
        const uploadedFiles = Array.isArray(body.files) ? body.files : [];
        const category = body.category ?? "completion";
        if (!["task", "reference", "completion"].includes(category)) fail(400, "Choose task, reference, or completion documents.");
        if (category === "task" && !canLead(actor, task)) fail(403, "Only managers and team leaders can add task instruction documents.");
        await saveTaskFiles(task.id, actor, uploadedFiles, category);
        await recordTaskEvent(task.id, actor, "files_uploaded", `Uploaded ${uploadedFiles.length} file(s): ${uploadedFiles.map((file) => basename(String(file.name ?? "attachment"))).join(", ").slice(0, 600)}`);
      }
      await touchSession(request);
      return send(response, 200, { task: await serializeTask(await getTask(task.id)) });
    }

    if (request.method === "POST" && path === "/api/notifications/read") {
      await db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").run(actor.id);
      return send(response, 200, { ok: true, unreadCount: (await db.prepare("SELECT count(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0").get(actor.id)).count });
    }

    const notificationReadMatch = path.match(/^\/api\/notifications\/([^/]+)\/read$/);
    if (request.method === "POST" && notificationReadMatch) {
      const result = await db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?").run(notificationReadMatch[1], actor.id);
      if (!result.changes) return send(response, 404, { message: "Notification not found." });
      return send(response, 200, { ok: true, unreadCount: (await db.prepare("SELECT count(*) AS count FROM notifications WHERE user_id = ? AND is_read = 0").get(actor.id)).count });
    }

    if (request.method === "POST" && path === "/api/ai/chat") {
      const message = String(body.message ?? "").trim().slice(0, 2000);
      const incomingFiles = Array.isArray(body.files) ? body.files.slice(0, 3) : [];
      if (!message && !incomingFiles.length) throw new Error("Write a message or attach a file for the AI assistant.");
      const maxFileBytes = 4 * 1024 * 1024;
      const validFiles = incomingFiles.map((file) => {
        const name = String(file?.name ?? "attachment").slice(0, 180);
        const mimeType = String(file?.mimeType ?? "application/octet-stream").slice(0, 120);
        const data = String(file?.data ?? "");
        if (Buffer.from(data, "base64").length > maxFileBytes) fail(400, `${name} exceeds the 4 MB limit.`);
        return { name, mimeType, data };
      });
      const apiKey = String(process.env.GEMINI_API_KEY ?? "").trim();
      if (!apiKey) {
        const rows = await db.prepare(`
          SELECT tasks.*, projects.name AS project_name
          FROM tasks LEFT JOIN projects ON projects.id = tasks.project_id
          ORDER BY tasks.created_at DESC LIMIT 200
        `).all();
        const visible = [];
        for (const task of rows) if (await canView(actor, task)) visible.push(task);
        const active = visible.filter((task) => task.status !== "done");
        const overdue = active.filter((task) => task.due_date && task.due_date < new Date().toISOString().slice(0, 10));
        const review = active.filter((task) => task.status === "under_review");
        const unassigned = active.filter((task) => !task.assignee_id);
        const urgent = active.filter((task) => ["urgent", "high"].includes(task.priority));
        const normalized = message.toLocaleLowerCase();
        let reply;
        if (validFiles.length) {
          reply = `I received ${validFiles.length} attached file${validFiles.length === 1 ? "" : "s"} (${validFiles.map((f) => f.name).join(", ")}). File analysis requires a configured Gemini API key — ask your administrator to set GEMINI_API_KEY to enable this feature.`;
        } else if (/summar|overview|status|dashboard|how many/.test(normalized)) {
          reply = `Here is your live workload summary: ${active.length} active task${active.length === 1 ? "" : "s"}, ${urgent.length} high or urgent, ${overdue.length} overdue, ${review.length} awaiting review, and ${unassigned.length} unassigned. ${overdue.length ? "I recommend checking overdue work first, then items waiting for review." : "There are no overdue tasks in your visible workload."}`;
        } else if (/overdue|late|priority|urgent|focus|today|plan/.test(normalized)) {
          const focus = [...overdue, ...urgent.filter((task) => !overdue.includes(task))].slice(0, 5);
          reply = focus.length
            ? `Suggested focus order:\n${focus.map((task, index) => `${index + 1}. ${task.task_code}: ${task.title} — ${task.priority}${task.due_date ? `, due ${task.due_date}` : ""}`).join("\n")}\nStart with blockers and overdue deadlines, then communicate progress to the task owner.`
            : "Your visible workload has no overdue or high-priority tasks. Choose the nearest due date, complete one meaningful step, and post a short progress update.";
        } else if (/write|draft|message|update|email/.test(normalized)) {
          reply = "Here is a professional update you can adapt:\n\nHello team,\n\nWork is progressing on the assigned item. The current status is [status/progress]. The next action is [next step], planned for [date/time]. The main blocker or decision needed is [blocker/decision].\n\nPlease let me know if priorities have changed.\n\nBest regards,";
        } else if (/help|what can you do|commands/.test(normalized)) {
          reply = "I can work offline with your live MAB task data. Try asking: 'summarize my workload', 'what should I focus on today?', 'show overdue priorities', or 'draft a professional task update'. Add GEMINI_API_KEY later for open-ended generative answers.";
        } else {
          reply = `I'm running in secure offline mode and can analyze the task data available to you. Right now I can see ${active.length} active task${active.length === 1 ? "" : "s"}. Ask me for a workload summary, today's priorities, overdue work, or a drafted status message.`;
        }
        return send(response, 200, {
          configured: false,
          reply
        });
      }
      const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
      const contents = history
        .filter((item) => item && ["user", "assistant"].includes(item.role) && String(item.text ?? "").trim())
        .map((item) => ({
          role: item.role === "assistant" ? "model" : "user",
          parts: [{ text: String(item.text).slice(0, 2000) }]
        }));
      const userParts = [];
      if (message) userParts.push({ text: message });
      for (const file of validFiles) userParts.push({ inlineData: { mimeType: file.mimeType, data: file.data } });
      contents.push({ role: "user", parts: userParts });
      const model = String(process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite");
      const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: `You are the MAB Task Allocator assistant. Help ${actor.name}, a ${actor.role} in ${actor.department}, with concise professional guidance about tasks, projects, coordination, and workplace productivity. Never claim to have changed application data. Do not reveal secrets or request passwords.` }]
          },
          contents,
          generationConfig: { temperature: 0.35, maxOutputTokens: 600 }
        })
      });
      const aiPayload = await aiResponse.json().catch(() => ({}));
      if (!aiResponse.ok) {
        const providerMessage = aiPayload?.error?.message;
        return send(response, 502, { message: providerMessage || "The AI provider is temporarily unavailable." });
      }
      const reply = aiPayload?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim();
      if (!reply) return send(response, 502, { message: "The AI assistant returned an empty response." });
      await touchSession(request);
      return send(response, 200, { configured: true, reply });
    }

    if (request.method === "POST" && path === "/api/chat/groups") {
      requireManager(actor);
      const name = String(body.name ?? "").trim().slice(0, 80);
      const department = actor.role === "admin" ? actor.department : String(body.department ?? "").trim();
      if (!name) throw new Error("Group name is required.");
      const departmentExists = await db.prepare("SELECT id FROM departments WHERE lower(name) = lower(?) LIMIT 1").get(department);
      if (!departmentExists || department === "Executive") throw new Error("Choose a valid department.");
      if (!canAccessDepartment(actor, department)) return send(response, 403, { message: "This department is outside your management scope." });
      const id = randomUUID();
      await db.prepare("INSERT INTO chat_groups (id, name, department, created_by_id) VALUES (?, ?, ?, ?)")
        .run(id, name, department, actor.id);
      await touchSession(request);
      return send(response, 201, { channel: { id: `group:${id}`, name, department, isGroup: true } });
    }

    const chatGroupMatch = path.match(/^\/api\/chat\/groups\/([^/]+)$/);
    if (chatGroupMatch && request.method === "PUT") {
      if (actor.role !== "superadmin") return send(response, 403, { message: "Only Super Admin can edit group chats." });
      const group = await db.prepare("SELECT * FROM chat_groups WHERE id = ?").get(chatGroupMatch[1]);
      if (!group) return send(response, 404, { message: "Chat group not found." });
      const name = String(body.name ?? "").trim().slice(0, 80);
      if (!name) throw new Error("Group name is required.");
      await db.prepare("UPDATE chat_groups SET name = ? WHERE id = ?").run(name, group.id);
      await touchSession(request);
      return send(response, 200, {
        channel: { id: `group:${group.id}`, name, department: group.department, isGroup: true, taskId: group.task_id ?? undefined }
      });
    }

    if (chatGroupMatch && request.method === "DELETE") {
      requireManager(actor);
      const group = await db.prepare("SELECT * FROM chat_groups WHERE id = ?").get(chatGroupMatch[1]);
      if (!group) return send(response, 404, { message: "Chat group not found." });
      if (!canAccessDepartment(actor, group.department)) {
        return send(response, 403, { message: "Admins can delete group chats in their own department only." });
      }
      const channelId = `group:${group.id}`;
      await deleteChatMessagesForChannel(channelId);
      await db.prepare("DELETE FROM chat_groups WHERE id = ?").run(group.id);
      await touchSession(request);
      return send(response, 200, { ok: true });
    }

    if (request.method === "POST" && path === "/api/chat/messages") {
      const channelId = String(body.channelId ?? "");
      const messageBody = String(body.body ?? "").trim().slice(0, 2000);
      const incomingFiles = Array.isArray(body.files) ? body.files : [];
      if (!messageBody && !incomingFiles.length) throw new Error("Message cannot be empty.");

      const { department } = await resolveChatChannel(actor, channelId);

      let replyToId = null;
      if (body.replyToId) {
        const replySource = await db.prepare("SELECT id, channel_id FROM chat_messages WHERE id = ?").get(String(body.replyToId));
        if (replySource && replySource.channel_id === channelId) replyToId = replySource.id;
      }

      const messageId = randomUUID();
      await db.prepare(`
        INSERT INTO chat_messages (id, channel_id, department, author_id, author_name, body, reply_to_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(messageId, channelId, department, actor.id, actor.name, messageBody, replyToId);
      try {
        await saveChatMessageFiles(messageId, actor, incomingFiles);
      } catch (error) {
        await db.prepare("DELETE FROM chat_messages WHERE id = ?").run(messageId);
        throw error;
      }
      const mentionedNames = new Set([...messageBody.matchAll(/@\[([^\]]+)\]/g)].map((match) => match[1].trim().toLocaleLowerCase()));
      const possibleRecipients = await db.prepare("SELECT * FROM users WHERE id != ? ORDER BY name").all(actor.id);
      const notificationContext = await chatNotificationContext(channelId, department);
      const preview = chatMessagePreview(messageBody, incomingFiles.length);
      for (const recipient of possibleRecipients) {
        try {
          await resolveChatChannel(recipient, channelId);
          const wasMentioned = mentionedNames.has(recipient.name.trim().toLocaleLowerCase());
          await notify(
            recipient.id,
            wasMentioned ? "mention" : "chat",
            notificationContext.title,
            wasMentioned ? `${actor.name} mentioned you: ${preview}` : `New message from ${actor.name}: ${preview}`,
            notificationContext.taskId,
            channelId,
            `chat:${messageId}:${recipient.id}`
          );
        } catch { /* This user is not a participant in the conversation. */ }
      }
      await touchSession(request);
      return send(response, 201, { ok: true });
    }

    const chatFileDownloadMatch = path.match(/^\/api\/chat\/files\/([^/]+)\/download$/);
    if (request.method === "GET" && chatFileDownloadMatch) {
      const file = await db.prepare(`
        SELECT chat_message_files.*, chat_messages.channel_id
        FROM chat_message_files JOIN chat_messages ON chat_messages.id = chat_message_files.message_id
        WHERE chat_message_files.id = ?
      `).get(chatFileDownloadMatch[1]);
      if (!file) return send(response, 404, { message: "File not found." });
      await resolveChatChannel(actor, file.channel_id);
      try {
        const data = readFileSync(join(attachmentsPath, basename(file.storage_name)));
        return sendBinary(response, 200, data, file.mime_type || "application/octet-stream", file.name);
      } catch {
        return send(response, 404, { message: "The stored file could not be found." });
      }
    }

    if (request.method === "POST" && path === "/api/chat/read") {
      const channelId = String(body.channelId ?? "");
      await resolveChatChannel(actor, channelId);
      await db.prepare(`
        INSERT INTO chat_reads (channel_id, user_id, last_read_at) VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT (channel_id, user_id) DO UPDATE SET last_read_at = CURRENT_TIMESTAMP
      `).run(channelId, actor.id);
      return send(response, 200, { ok: true });
    }

    const chatMessageMatch = path.match(/^\/api\/chat\/messages\/([^/]+)$/);
    if (chatMessageMatch && ["PUT", "DELETE"].includes(request.method)) {
      const message = await db.prepare("SELECT * FROM chat_messages WHERE id = ?").get(chatMessageMatch[1]);
      if (!message) return send(response, 404, { message: "Chat message not found." });
      if (request.method === "PUT") {
        if (message.author_id !== actor.id) return send(response, 403, { message: "You can change only your own messages." });
        if (message.deleted_at) return send(response, 409, { message: "A deleted message cannot be edited." });
        const nextBody = String(body.body ?? "").trim().slice(0, 2000);
        const attachmentCount = (await db.prepare("SELECT count(*) AS count FROM chat_message_files WHERE message_id = ?").get(message.id)).count;
        if (!nextBody && !attachmentCount) throw new Error("Message cannot be empty.");
        await db.prepare("UPDATE chat_messages SET body = ? WHERE id = ?").run(nextBody, message.id);
      } else {
        const scope = body.scope === "everyone" ? "everyone" : "me";
        if (scope === "everyone") {
          if (message.author_id !== actor.id) return send(response, 403, { message: "You can delete this message for yourself only." });
          const files = await db.prepare("SELECT storage_name FROM chat_message_files WHERE message_id = ?").all(message.id);
          await db.prepare("DELETE FROM chat_message_files WHERE message_id = ?").run(message.id);
          await db.prepare("UPDATE chat_messages SET body = '', deleted_at = CURRENT_TIMESTAMP WHERE id = ?").run(message.id);
          for (const file of files) {
            try { unlinkSync(join(attachmentsPath, basename(file.storage_name))); } catch { /* Already absent. */ }
          }
        } else {
          await db.prepare("INSERT OR IGNORE INTO chat_message_hidden (message_id, user_id) VALUES (?, ?)").run(message.id, actor.id);
        }
      }
      await touchSession(request);
      return send(response, 200, { ok: true });
    }

    return send(response, 404, { message: "Route not found." });
  } catch (error) {
    console.error(`[${response.requestId}]`, error);
    const databaseConflict = error.code === "23505";
    const knownClientError = error.status || databaseConflict || (!error.code && !(error instanceof TypeError));
    const status = error.status ?? (databaseConflict ? 409 : knownClientError ? 400 : 500);
    const message = status >= 500 ? "Unexpected server error." : databaseConflict ? "This value already exists." : error.message;
    return send(response, status, { message: message || "Unexpected server error.", requestId: response.requestId });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`MAB API listening on http://localhost:${port}`);
  console.log("Database: PostgreSQL");
});

void runTaskReminders().catch((error) => console.error("Reminder automation failed", error));
const reminderInterval = setInterval(() => {
  void runTaskReminders().catch((error) => console.error("Reminder automation failed", error));
}, 60 * 1000);
reminderInterval.unref();

async function shutdown() {
  clearInterval(reminderInterval);
  server.close();
  await pool.end();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
