type DirectoryUser = { id: string; role: string; department: string };
const disciplines = ['electrical technical office engineer', 'mechanical technical office engineer'];
const normalize = (value: string) => value.trim().toLowerCase();
export function peopleForViewer<T extends DirectoryUser>(users: T[], viewer: DirectoryUser | null): T[] {
  if (!viewer) return [];
  if (viewer.role === 'superadmin') return users;
  if (!['admin', 'technical_manager', 'team_leader'].includes(viewer.role)) return users.filter(user => user.id === viewer.id);
  const scope = viewer.role === 'technical_manager' ? disciplines : [normalize(viewer.department)];
  return users.filter(user => scope.includes(normalize(user.department)) ||
    (user.role === 'technical_manager' && scope.some(department => disciplines.includes(department))));
}
