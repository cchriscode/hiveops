import { useDraggable } from "@dnd-kit/core";
import type { Task } from "../types";

interface Props {
  task: Task;
  onClick: (task: Task) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
      className={`task-card ${isDragging ? "dragging" : ""}`}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => { if (!isDragging) onClick(task); }}
    >
      <div className="task-card-top">
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
