import type { BoardStats, SortMode } from "../types";

interface Props {
  stats: BoardStats | null;
  viewMode: "board" | "list";
  onViewChange: (mode: "board" | "list") => void;
  categories: string[];
  selectedRole: string;
  onRoleChange: (role: string) => void;
  sortMode: SortMode;
  onSortChange: (mode: SortMode) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNewTask: () => void;
  onCommandPalette: () => void;
  onToggleSidebar: () => void;
}

export function Toolbar({
  stats,
  viewMode,
  onViewChange,
  categories,
  selectedRole,
  onRoleChange,
  sortMode,
  onSortChange,
  searchQuery,
  onSearchChange,
  onNewTask,
  onCommandPalette,
  onToggleSidebar,
}: Props) {
  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button className="toolbar-hamburger" onClick={onToggleSidebar} aria-label="Toggle menu">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <line x1="1" y1="4" x2="15" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="1" y1="12" x2="15" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <div className="toolbar-view-toggle">
          <button
            className={`toolbar-view-btn ${viewMode === "board" ? "active" : ""}`}
            onClick={() => onViewChange("board")}
            title="Board view"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <button
            className={`toolbar-view-btn ${viewMode === "list" ? "active" : ""}`}
            onClick={() => onViewChange("list")}
            title="List view"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <line x1="1" y1="3" x2="15" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="1" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="1" y1="13" x2="15" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="toolbar-search">
          <input
            type="text"
            placeholder="Search tasks... (Ctrl+K)"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={onCommandPalette}
          />
        </div>
      </div>

      <div className="toolbar-right">
        {stats && (
          <div className="toolbar-stats">
            <span className="toolbar-stat">{stats.active} active</span>
            <span className="toolbar-stat">{stats.done} done</span>
            <span className="toolbar-stat">{stats.rate}%</span>
          </div>
        )}

        <select className="toolbar-select" value={selectedRole} onChange={(e) => onRoleChange(e.target.value)}>
          <option value="All">All roles</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <div className="toolbar-sort">
          <button className={`toolbar-pill ${sortMode === "time" ? "active" : ""}`} onClick={() => onSortChange("time")}>
            Time
          </button>
          <button className={`toolbar-pill ${sortMode === "priority" ? "active" : ""}`} onClick={() => onSortChange("priority")}>
            Priority
          </button>
        </div>

        <button className="btn-new-task" onClick={onNewTask}>+ New Task</button>
      </div>
    </div>
  );
}
