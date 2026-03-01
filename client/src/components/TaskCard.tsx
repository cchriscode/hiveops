import { useDraggable } from "@dnd-kit/core";
import type { Task } from "../types";
import { timeAgo } from "../utils";

interface Props {
  task: Task;
  onClick: (task: Task) => void;
}

export function TaskCard({ task, onClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      className={`task-card ${isDragging ? "dragging" : ""} ${task.is_stale ? "task-stale" : ""}`}
      data-priority={task.priority}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => { if (!isDragging) onClick(task); }}
    >
      <div className="task-card-top">
        {task.is_stale && <span className="stale-badge">STALE</span>}
        {task.priority !== "medium" && (
          <span className={`priority-badge priority-${task.priority}`}>
            {task.priority}
          </span>
        )}
        {task.category && (
          <span className={`category-tag ${task.category}`}>
            {task.category}
          </span>
        )}
        {task.blocked_by?.length > 0 && (
          <span className="blocked-badge">Blocked ({task.blocked_by.length})</span>
        )}
        {task.blocks?.length > 0 && (
          <span className="blocks-badge">Blocks {task.blocks.length}</span>
        )}
      </div>

      <div className="task-title">{task.title}</div>

      <div className="task-card-bottom">
        <span className="task-agent">
          {task.agent || "unassigned"}
        </span>
        <div className="task-meta">
          {task.comment_count > 0 && (
            <span className="task-comments">
              {"💬"} {task.comment_count}
            </span>
          )}
          <span>{timeAgo(task.updated_at)}</span>
        </div>
      </div>
    </div>
  );
}
