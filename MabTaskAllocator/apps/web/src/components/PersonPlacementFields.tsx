import { useState } from "react";
import type { AppUser, UserRole } from "@mab/shared";

export const technicalDepartment = "Technical Department";
export const technicalDisciplines = ["Electrical Technical office engineer", "Mechanical Technical office engineer"];
export function isTechnicalDiscipline(department: string) {
  return technicalDisciplines.some((name) => name.toLowerCase() === department.trim().toLowerCase());
}
export function disciplineLabel(department: string) {
  return isTechnicalDiscipline(department) ? department.toLowerCase().startsWith("electrical") ? "Electrical" : "Mechanical" : department;
}
export function departmentPath(department: string) {
  return isTechnicalDiscipline(department) ? `${technicalDepartment} / ${disciplineLabel(department)}` : department;
}
export function positionLabel(user: Pick<AppUser, "role" | "department">) {
  if (user.role === "technical_manager") return "Technical Manager";
  if (user.role === "superadmin") return "Super Admin";
  if (user.role === "admin") return isTechnicalDiscipline(user.department) ? "Discipline Admin" : "Department Admin";
  if (user.role === "team_leader") return "Team Leader";
  return isTechnicalDiscipline(user.department) ? "Technical Engineer" : "Normal User";
}

type Placement = Pick<AppUser, "role" | "department">;
export function PersonPlacementFields({ actor, departments, value, onChange, locked = false }: {
  actor: AppUser;
  departments: string[];
  value?: Placement;
  onChange?: (placement: Placement) => void;
  locked?: boolean;
}) {
  const available = departments.filter((name) => !["Executive", technicalDepartment, "Technical Management"].includes(name));
  const initialDepartment = actor.role === "superadmin" || actor.role === "technical_manager"
    ? available.find(isTechnicalDiscipline) ?? available[0] ?? ""
    : actor.department;
  const [draft, setDraft] = useState<Placement>({ role: "user", department: initialDepartment });
  const placement = value ?? draft;
  const technical = placement.role === "technical_manager" || isTechnicalDiscipline(placement.department);
  const group = placement.role === "superadmin" ? "Executive" : technical ? technicalDepartment : placement.department;
  const groups = [...new Set(available.map((name) => isTechnicalDiscipline(name) ? technicalDepartment : name))];
  if (actor.role === "superadmin") groups.push("Executive");
  const technicalChoices = available.filter(isTechnicalDiscipline);
  const roles: UserRole[] = group === "Executive" ? ["superadmin"]
    : actor.role === "superadmin" ? technical ? ["user", "team_leader", "technical_manager", "admin"] : ["user", "team_leader", "admin"]
    : actor.role === "team_leader" ? ["user"] : ["user", "team_leader"];
  function update(next: Placement) {
    setDraft(next);
    onChange?.(next);
  }
  const scope = placement.role === "technical_manager"
    ? "Admin access to both Electrical and Mechanical. Can create engineers and team leaders in either discipline, manage projects, and review requests."
    : placement.role === "superadmin" ? "Full organization access across all departments."
    : placement.role === "team_leader" ? "Leads this team, creates normal users, and adds them to existing projects. Cannot create projects."
    : placement.role === "admin" ? "Admin access to this department or discipline only."
    : "Works on assigned tasks and participates in assigned projects within this team.";
  return <fieldset className="person-placement-fields">
    <legend>Department & position</legend>
    <input type="hidden" name="role" value={placement.role} />
    <input type="hidden" name="department" value={placement.department} />
    <label>Department
      <select value={group} disabled={locked || groups.length === 1} onChange={(event) => {
        const nextGroup = event.target.value;
        const department = nextGroup === technicalDepartment ? technicalChoices[0] : nextGroup;
        const role = nextGroup === "Executive" ? "superadmin" : placement.role === "superadmin" || placement.role === "technical_manager" ? "user" : placement.role;
        update({ role, department });
      }}>
        {groups.map((name) => <option key={name} value={name}>{name === "Executive" ? "Organization administration" : name}</option>)}
      </select>
    </label>
    <label>Position
      <select value={placement.role} disabled={locked || roles.length === 1} onChange={(event) => {
        const role = event.target.value as UserRole;
        update({ role, department: role === "technical_manager" ? technicalDepartment : placement.role === "technical_manager" ? technicalChoices[0] : placement.department });
      }}>
        {roles.map((role) => <option key={role} value={role}>{positionLabel({ role, department: technical ? technicalChoices[0] ?? technicalDisciplines[0] : placement.department })}</option>)}
      </select>
    </label>
    {technical ? placement.role === "technical_manager"
      ? <div className="placement-coverage"><strong>Both disciplines</strong><span>Electrical Technical Office + Mechanical Technical Office</span></div>
      : <label>Discipline<select value={placement.department} disabled={locked || technicalChoices.length === 1} onChange={(event) => update({ ...placement, department: event.target.value })}>{technicalChoices.map((name) => <option key={name} value={name}>{disciplineLabel(name)} Technical Office</option>)}</select></label>
      : null}
    <p className="placement-scope"><strong>{placement.role === "technical_manager" ? "Department administrator" : "Access & responsibilities"}</strong>{scope}</p>
    {locked ? <p className="placement-scope">Create another Super Admin before changing this account's position.</p> : null}
  </fieldset>;
}
