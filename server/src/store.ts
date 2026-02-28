import crypto from "crypto";
import { getDb } from "./db.js";
import type { Task, Comment, BoardState, BoardStats, TaskStatus } from "./types.js";

function genId(): string {
  return crypto.randomBytes(8).toString("hex");
}

export function createTask(params: {
  title: string;
  description?: string;
  priority?: string;
  category?: string;
  project?: string;
  agent?: string;
  status?: string;
}): Task {
  const db = getDb();
  const id = genId();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO tasks (id, title, description, priority, category, project, agent, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.title,
    params.description || "",
    params.priority || "medium",
    params.category || "",
    params.project || "default",
    params.agent || "",
    params.status || "todo",
    now,
    now
  );

  return getTask(id)!;
}

export function getTask(id: string): Task | null {
  const db = getDb();
  const row = db.prepare(`
    SELECT t.*, COALESCE(c.cnt, 0) as comment_count
    FROM tasks t
    LEFT JOIN (SELECT task_id, COUNT(*) as cnt FROM comments GROUP BY task_id) c
      ON c.task_id = t.id
    WHERE t.id = ?
  `).get(id) as Task | undefined;
  return row || null;
}

export function listTasks(filters: {
  status?: string;
  project?: string;
  agent?: string;
  category?: string;
}): Task[] {
  const db = getDb();
  const conditions: string[] = [];
  const values: string[] = [];

  if (filters.status) { conditions.push("t.status = ?"); values.push(filters.status); }
  if (filters.project) { conditions.push("t.project = ?"); values.push(filters.project); }
  if (filters.agent) { conditions.push("t.agent = ?"); values.push(filters.agent); }
  if (filters.category) { conditions.push("t.category = ?"); values.push(filters.category); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  return db.prepare(`
    SELECT t.*, COALESCE(c.cnt, 0) as comment_count
    FROM tasks t
    LEFT JOIN (SELECT task_id, COUNT(*) as cnt FROM comments GROUP BY task_id) c
      ON c.task_id = t.id
    ${where}
    ORDER BY t.created_at DESC
  `).all(...values) as Task[];
}

export function updateTaskStatus(taskId: string, status: TaskStatus): Task {
  const db = getDb();
  const now = new Date().toISOString();
  const extra: Record<string, string | null> = { updated_at: now };

  if (status === "claimed") extra.claimed_at = now;
  if (status === "done") extra.completed_at = now;

  db.prepare(`
    UPDATE tasks SET status = ?, updated_at = ?,
      claimed_at = COALESCE(?, claimed_at),
      completed_at = COALESCE(?, completed_at)
    WHERE id = ?
  `).run(status, now, extra.claimed_at || null, extra.completed_at || null, taskId);

  const task = getTask(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);
  return task;
}

export function claimTask(taskId: string, agent: string): Task {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    UPDATE tasks SET status = 'claimed', agent = ?, claimed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(agent, now, now, taskId);

  const task = getTask(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);
  return task;
}

export function updateTask(taskId: string, params: {
  title?: string;
  description?: string;
  priority?: string;
  category?: string;
  project?: string;
}): Task {
  const db = getDb();
  const now = new Date().toISOString();
  const sets: string[] = ["updated_at = ?"];
  const values: string[] = [now];

  if (params.title !== undefined) { sets.push("title = ?"); values.push(params.title); }
  if (params.description !== undefined) { sets.push("description = ?"); values.push(params.description); }
  if (params.priority !== undefined) { sets.push("priority = ?"); values.push(params.priority); }
  if (params.category !== undefined) { sets.push("category = ?"); values.push(params.category); }
  if (params.project !== undefined) { sets.push("project = ?"); values.push(params.project); }

  db.prepare(`UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`).run(...values, taskId);

  const task = getTask(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);
  return task;
}

export function addComment(params: {
  task_id: string;
  content: string;
  author?: string;
}): Comment {
  const db = getDb();
  const id = genId();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO comments (id, task_id, author, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, params.task_id, params.author || "agent", params.content, now);

  return db.prepare("SELECT * FROM comments WHERE id = ?").get(id) as Comment;
}

export function listComments(taskId: string): Comment[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM comments WHERE task_id = ? ORDER BY created_at ASC"
  ).all(taskId) as Comment[];
}

export function deleteTask(taskId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM tasks WHERE id = ?").run(taskId);
}

export function getBoardState(): BoardState {
  const tasks = listTasks({});
  return {
    todo: tasks.filter(t => t.status === "todo"),
    claimed: tasks.filter(t => t.status === "claimed"),
    in_progress: tasks.filter(t => t.status === "in_progress"),
    review: tasks.filter(t => t.status === "review"),
    done: tasks.filter(t => t.status === "done"),
  };
}

export function getStats(): BoardStats {
  const db = getDb();
  const rows = db.prepare(
    "SELECT status, COUNT(*) as cnt FROM tasks GROUP BY status"
  ).all() as { status: string; cnt: number }[];

  let total = 0, done = 0;
  for (const row of rows) {
    total += row.cnt;
    if (row.status === "done") done = row.cnt;
  }
  const active = total - done;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;

  return { total, active, done, rate };
}

export function getProjects(): string[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT DISTINCT project FROM tasks ORDER BY project"
  ).all() as { project: string }[];
  return rows.map(r => r.project);
}

export function getCategories(): string[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT DISTINCT category FROM tasks WHERE category != '' ORDER BY category"
  ).all() as { category: string }[];
  return rows.map(r => r.category);
}
