import { DndContext, DragEndEvent, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Column } from "./Column";
import { updateTaskStatus } from "../api";
import type { BoardState, Task, TaskStatus } from "../types";
import { COLUMNS } from "../types";

interface Props {
  board: BoardState;
  projectFilter: string;
  roleFilter: string;
  onTaskClick: (task: Task) => void;
}

export function Board({ board, projectFilter, roleFilter, onTaskClick }: Props) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;
    const task = active.data.current?.task;

    if (task && task.status !== newStatus) {
      updateTaskStatus(taskId, newStatus);
    }
  }

  function filterTasks(tasks: typeof board.todo) {
    return tasks.filter((t) => {
      if (projectFilter && t.project !== projectFilter) return false;
      if (roleFilter !== "All" && t.category !== roleFilter) return false;
      return true;
    });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="board">
        {COLUMNS.map((col) => (
          <Column
            key={col.key}
            status={col.key}
            label={col.label}
            color={col.color}
            tasks={filterTasks(board[col.key])}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>
    </DndContext>
  );
}
