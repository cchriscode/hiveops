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
}

export interface Comment {
  id: string;
  task_id: string;
  author: string;
  content: string;
  created_at: string;
}

export interface BoardState {
  todo: Task[];
  claimed: Task[];
  in_progress: Task[];
  review: Task[];
  done: Task[];
}

export interface BoardStats {
  total: number;
  active: number;
  done: number;
  rate: number;
}
