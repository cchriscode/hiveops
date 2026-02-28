import type { BoardStats } from "../types";

interface Props {
  stats: BoardStats | null;
  onNewTask: () => void;
}

export function Header({ stats, onNewTask }: Props) {
  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">
          Hive<span className="logo-accent">Ops</span>
        </div>
        <div className="live-badge">
          <span className="live-dot" />
          Live
        </div>
      </div>

      {stats && (
        <div className="header-stats">
          <span>Total:<span className="stat-value">{stats.total}</span></span>
          <span>Active:<span className="stat-value">{stats.active}</span></span>
          <span>Done:<span className="stat-value">{stats.done}</span></span>
          <span>Rate:<span className="stat-value">{stats.rate}%</span></span>
        </div>
      )}

      <div className="header-actions">
        <button className="btn-new-task" onClick={onNewTask}>
          + New Task
        </button>
      </div>
    </header>
  );
}
