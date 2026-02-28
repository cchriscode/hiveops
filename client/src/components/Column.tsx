import { useDroppable } from "@dnd-kit/core";
import { TaskCard } from "./TaskCard";
import type { Task, TaskStatus } from "../types";

interface Props {
  status: TaskStatus;
  label: string;
  color: string;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export function Column({ status, label, color, tasks, onTaskClick }: Props) {
  const { isOver, setNodeRef } = useDroppable({ id: status });

  return (
    <div className="column">
      <div className="column-header" style={{ background: color }}>
        <span className="column-title">{label}</span>
        <span className="column-count">{tasks.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`column-body ${isOver ? "drag-over" : ""}`}
      >
        {tasks.length === 0 ? (
          <div className="column-empty">No tasks</div>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} onClick={onTaskClick} />)
        )}
      </div>
    </div>
  );
}
