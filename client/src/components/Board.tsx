import { useMemo } from "react";
import { DndContext, DragEndEvent, MouseSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { Column } from "./Column";
import { updateTaskStatus } from "../api";
import { filterTasks, sortTasks } from "../utils";
import type { BoardState, Task, TaskStatus, SortMode } from "../types";
import { COLUMNS } from "../types";

interface Props {
  board: BoardState;
  projectFilter: string;
  roleFilter: string;
  sortMode: SortMode;
  searchQuery: string;
  onTaskClick: (task: Task) => void;
}

export function Board({ board, projectFilter, roleFilter, sortMode, searchQuery, onTaskClick }: Props) {
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
      if (newStatus === "done" && task.blocked_by?.length > 0) {
        alert(`Cannot move to Done — blocked by ${task.blocked_by.length} task(s)`);
        return;
      }
      updateTaskStatus(taskId, newStatus).catch((err) => {
        alert(err.message || "Failed to update status");
      });
    }
  }

  const filteredColumns = useMemo(() => {
    const result: Record<string, Task[]> = {};
    for (const col of COLUMNS) {
      result[col.key] = sortTasks(
        filterTasks(board[col.key], projectFilter, roleFilter, searchQuery),
        sortMode,
      );
    }
    return result;
  }, [board, projectFilter, roleFilter, searchQuery, sortMode]);

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="board">
        {COLUMNS.map((col) => (
          <Column
            key={col.key}
            status={col.key}
            label={col.label}
            color={col.color}
            tasks={filteredColumns[col.key]}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>
    </DndContext>
  );
}
