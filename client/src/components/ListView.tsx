import { useEffect, useRef, useMemo } from "react";
import type { Task, TaskStatus, SortMode, BoardState } from "../types";
import { timeAgo, flattenBoard, filterTasks, sortTasks } from "../utils";

const STATUS_ICONS: Record<TaskStatus, string> = {
  todo: "\u25CB",
  claimed: "\u25D4",
  in_progress: "\u25D0",
  review: "\u25CE",
  done: "\u25CF",
};

interface Props {
  board: BoardState;
  projectFilter: string;
  roleFilter: string;
  sortMode: SortMode;
  searchQuery: string;
  onTaskClick: (task: Task) => void;
}

export function ListView({ board, projectFilter, roleFilter, sortMode, searchQuery, onTaskClick }: Props) {
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  const sorted = useMemo(() => {
    const all = flattenBoard(board);
    const filtered = filterTasks(all, projectFilter, roleFilter, searchQuery);
    return sortTasks(filtered, sortMode);
  }, [board, projectFilter, roleFilter, searchQuery, sortMode]);

  // J/K keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;

      if (e.key === "j" || e.key === "k") {
        const rows = tbodyRef.current?.querySelectorAll<HTMLTableRowElement>(".list-row");
        if (!rows || rows.length === 0) return;

        const currentIndex = Array.from(rows).findIndex((r) => r === document.activeElement);
        let nextIndex: number;

        if (e.key === "j") {
          nextIndex = currentIndex < rows.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : rows.length - 1;
        }

        rows[nextIndex].focus();
        e.preventDefault();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="list-view">
      <table className="list-table">
        <thead>
          <tr>
            <th className="list-th-status">Status</th>
            <th className="list-th-priority"></th>
            <th className="list-th-title">Title</th>
            <th className="list-th-agent">Agent</th>
            <th className="list-th-project">Project</th>
            <th className="list-th-category">Category</th>
            <th className="list-th-updated">Updated</th>
          </tr>
        </thead>
        <tbody ref={tbodyRef}>
          {sorted.map((task) => (
            <tr
              key={task.id}
              className="list-row"
              onClick={() => onTaskClick(task)}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter") onTaskClick(task); }}
            >
              <td className="list-cell-status">
                <span className={`list-status-icon status-${task.status}`} title={task.status.replace("_", " ")}>
                  {STATUS_ICONS[task.status]}
                </span>
              </td>
              <td className="list-cell-priority">
                <span className={`list-priority-dot priority-dot-${task.priority}`} title={task.priority} />
              </td>
              <td className="list-cell-title">
                {task.title}
                {task.comment_count > 0 && <span className="list-comment-count">{task.comment_count}</span>}
              </td>
              <td className="list-cell-agent">{task.agent || "---"}</td>
              <td className="list-cell-project">{task.project || "---"}</td>
              <td className="list-cell-category">
                {task.category ? <span className={`category-tag ${task.category}`}>{task.category}</span> : "---"}
              </td>
              <td className="list-cell-updated">{timeAgo(task.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sorted.length === 0 && <div className="list-empty">No tasks match the current filters</div>}
    </div>
  );
}
