interface Props {
  projects: string[];
  categories: string[];
  selectedProject: string;
  selectedRole: string;
  onProjectChange: (project: string) => void;
  onRoleChange: (role: string) => void;
}

export function Filters({ projects, categories, selectedProject, selectedRole, onProjectChange, onRoleChange }: Props) {
  return (
    <div className="filters">
      <span className="filter-label">Project:</span>
      <select
        className="filter-select"
        value={selectedProject}
        onChange={(e) => onProjectChange(e.target.value)}
      >
        <option value="">All Projects</option>
        {projects.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>

      <span className="filter-label">Role:</span>
      <div className="filter-pills">
        {["All", ...categories].map((role) => (
          <button
            key={role}
            className={`filter-pill ${selectedRole === role ? "active" : ""}`}
            onClick={() => onRoleChange(role)}
          >
            {role}
          </button>
        ))}
      </div>
    </div>
  );
}
