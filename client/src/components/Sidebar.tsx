interface Props {
  projects: string[];
  selectedProject: string;
  onProjectChange: (project: string) => void;
  viewMode: "board" | "list";
  onViewChange: (mode: "board" | "list") => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onShowAgents: () => void;
}

export function Sidebar({
  projects,
  selectedProject,
  onProjectChange,
  viewMode,
  onViewChange,
  collapsed,
  onToggleCollapse,
  onShowAgents,
}: Props) {
  return (
    <aside className={`sidebar ${collapsed ? "sidebar--collapsed" : ""}`}>
      <div className="sidebar-header">
        {!collapsed && (
          <div className="logo">
            Hive<span className="logo-accent">Ops</span>
          </div>
        )}
        <button className="sidebar-toggle" onClick={onToggleCollapse} aria-label="Toggle sidebar">
          {collapsed ? "\u25B6" : "\u25C0"}
        </button>
      </div>

      {!collapsed && (
        <>
          <nav className="sidebar-nav">
            <div className="sidebar-section-label">Views</div>
            <button
              className={`sidebar-item ${viewMode === "board" ? "sidebar-item--active" : ""}`}
              onClick={() => onViewChange("board")}
            >
              <span className="sidebar-icon">{"\u25A6"}</span> Board
            </button>
            <button
              className={`sidebar-item ${viewMode === "list" ? "sidebar-item--active" : ""}`}
              onClick={() => onViewChange("list")}
            >
              <span className="sidebar-icon">{"\u2630"}</span> List
            </button>
          </nav>

          <div className="sidebar-section">
            <div className="sidebar-section-label">Projects</div>
            <button
              className={`sidebar-item ${selectedProject === "" ? "sidebar-item--active" : ""}`}
              onClick={() => onProjectChange("")}
            >
              All Projects
            </button>
            {projects.map((p) => (
              <button
                key={p}
                className={`sidebar-item ${selectedProject === p ? "sidebar-item--active" : ""}`}
                onClick={() => onProjectChange(p)}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="sidebar-footer">
            <button className="sidebar-item" onClick={onShowAgents}>
              Agents
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
