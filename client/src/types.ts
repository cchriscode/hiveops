export type TaskStatus = "todo" | "claimed" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  category: string;
  project: string;
  agent: string;
  created_at: string;
  updated_at: string;
  claimed_at: string | null;
  completed_at: string | null;
  comment_count: number;
  is_stale: boolean;
  depends_on: string[];
  blocked_by: string[];
  blocks: string[];
  files: string[];
}

export interface BoardState {
  todo: Task[];
  claimed: Task[];
  in_progress: Task[];
  review: Task[];
  done: Task[];
}

export interface Comment {
  id: string;
  task_id: string;
  author: string;
  content: string;
  type: "comment" | "feedback";
  created_at: string;
}

export interface TimelineEntry {
  kind: "comment" | "feedback" | "activity";
  id: string;
  task_id: string;
  created_at: string;
  author?: string;
  content?: string;
  action?: string;
  actor?: string;
  details?: string;
}

export interface BoardStats {
  total: number;
  active: number;
  done: number;
  rate: number;
}

export type SortMode = "time" | "priority";

export interface AgentStats {
  agent: string;
  claimed: number;
  in_progress: number;
  review: number;
  done: number;
  total: number;
  completion_rate: number;
}

export const COLUMNS: { key: TaskStatus; label: string; color: string }[] = [
  { key: "todo", label: "To Do", color: "#6b7280" },
  { key: "claimed", label: "Claimed", color: "#f59e0b" },
  { key: "in_progress", label: "In Progress", color: "#3b82f6" },
  { key: "review", label: "Review", color: "#8b5cf6" },
  { key: "done", label: "Done", color: "#22c55e" },
];
