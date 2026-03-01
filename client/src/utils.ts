import type { Task, TaskPriority, BoardState, SortMode } from "./types";

export const PRIORITY_ORDER: Record<TaskPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function filterTasks(
  tasks: Task[],
  projectFilter: string,
  roleFilter: string,
  searchQuery: string,
): Task[] {
  return tasks.filter((t) => {
    if (projectFilter && t.project !== projectFilter) return false;
    if (roleFilter !== "All" && t.category !== roleFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

export function sortTasks(tasks: Task[], sortMode: SortMode): Task[] {
  if (sortMode !== "priority") return tasks;
  return [...tasks].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

export function flattenBoard(board: BoardState): Task[] {
  return [...board.todo, ...board.claimed, ...board.in_progress, ...board.review, ...board.done];
}

export function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
