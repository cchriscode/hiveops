import { useState, useMemo } from "react";
import { useBoardSync } from "./api";
import { Header } from "./components/Header";
import { Filters } from "./components/Filters";
import { Board } from "./components/Board";
import { NewTaskModal } from "./components/NewTaskModal";
import { TaskDetailModal } from "./components/TaskDetailModal";
import type { Task } from "./types";

export default function App() {
  const { board, stats } = useBoardSync();
  const [showNewTask, setShowNewTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [projectFilter, setProjectFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");

  const projects = useMemo(() => {
    if (!board) return [];
    const all: Task[] = [
      ...board.todo,
      ...board.claimed,
      ...board.in_progress,
      ...board.review,
      ...board.done,
    ];
    return [...new Set(all.map((t) => t.project).filter(Boolean))];
  }, [board]);

  const categories = useMemo(() => {
    if (!board) return [];
    const all: Task[] = [
      ...board.todo,
      ...board.claimed,
      ...board.in_progress,
      ...board.review,
      ...board.done,
    ];
    return [...new Set(all.map((t) => t.category).filter(Boolean))].sort();
  }, [board]);

  if (!board) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        Connecting to HiveOps...
      </div>
    );
  }

  return (
    <>
      <Header stats={stats} onNewTask={() => setShowNewTask(true)} />
      <Filters
        projects={projects}
        categories={categories}
        selectedProject={projectFilter}
        selectedRole={roleFilter}
        onProjectChange={setProjectFilter}
        onRoleChange={setRoleFilter}
      />
      <Board board={board} projectFilter={projectFilter} roleFilter={roleFilter} onTaskClick={setSelectedTask} />
      {showNewTask && <NewTaskModal onClose={() => setShowNewTask(false)} />}
      {selectedTask && <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />}
    </>
  );
}
