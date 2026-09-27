# API

The API persists users, sessions, tasks, task messages, file metadata, and notifications in PostgreSQL.
It uses a bounded `pg` connection pool and parameterized queries throughout.

```bash
npm run dev:api
```

Set `DATABASE_URL` before starting outside Docker. The API runs the idempotent schema in
`infra/postgres/init.sql` during startup. Passwords use salted scrypt hashes, and browser
sessions use opaque bearer tokens.

## Team leaders

Super admins can assign the **Technical Manager** role. Technical Managers have admin
permissions over Electrical Technical Office Engineer and Mechanical Technical Office
Engineer departments: people, projects, tasks, approvals, reports, and Work Intelligence.
They can create normal users and team leaders in either department, but cannot create
admin accounts or manage other departments. They receive department approval requests
for both technical departments.

Team leaders can create normal users in their own department and optionally add them
to an existing department project during creation. `POST /api/projects/:id/members`
adds normal users to existing projects without removing existing members. Leaders
cannot create, rename, delete, or import project task sheets, nor create higher roles.

Super admins can create team leaders in any department. Department admins can create
or edit normal users and team leaders in their own department. Leaders can see their
department's tasks and projects, allocate work, approve submitted work, finish active
tasks, and reopen tasks with a comment.

Each leader add/allocation, approve/finish, and reopen action asks whether admin approval
is required. No (`requiresApproval: false`) applies the action immediately. Yes (the
API default) persists a request and leaves the task unchanged until reviewed. Approval
request notifications go only to department admins, never super admins. A department
admin or super admin can approve or reject a pending request in Needs Review or on the
task. No department admin means the request fails with an explanatory message; it is
not silently routed to a super admin. Rejected requests can be submitted again.

Reopening clears worker and leader approvals. Completed tasks whose assignees have
been deleted reopen as new, unassigned tasks ready for allocation. The final super
admin account cannot be demoted.

Run `npm run test:integration -w @mab/api` with `TEST_DATABASE_URL` pointing to a local
PostgreSQL test administrator with permission to create databases. The suite creates
and removes a uniquely named disposable database; it does not use application data.

## Optional AI assistant

Set `GEMINI_API_KEY` in the API environment to enable the in-app assistant. The key is
used only by the server and is never returned to the browser. `GEMINI_MODEL` is optional
and defaults to `gemini-2.5-flash-lite`. Without a key, chat remains fully functional and
the assistant displays a configuration notice instead of failing the application.
