import crypto from "crypto";
import { getDb } from "./db.js";
import type { Task, Comment, BoardState, BoardStats, TaskStatus, ActivityLogEntry, TimelineEntry, CommentType, AgentStats } from "./types.js";

function genId(): string {
  return crypto.randomBytes(8).toString("hex");
}

function getStaleTimeoutMs(): number {
  return parseInt(process.env.HIVEOPS_STALE_TIMEOUT_MS || "3600000", 10);
}

function computeStale(task: Task): Task {
  const isActive = task.status === "claimed" || task.status === "in_progress";
  const elapsed = Date.now() - new Date(task.updated_at).getTime();
  return { ...task, is_stale: isActive && elapsed > getStaleTimeoutMs() };
}

function enrichWithDeps(task: Task, allDeps: { task_id: string; depends_on_id: string }[], statusMap: Map<string, string>): Task {
  const dependsOn = allDeps.filter(d => d.task_id === task.id).map(d => d.depends_on_id);
  const blocks = allDeps.filter(d => d.depends_on_id === task.id).map(d => d.task_id);
  const blockedBy = dependsOn.filter(id => statusMap.get(id) !== "done");
  return { ...task, depends_on: dependsOn, blocks, blocked_by: blockedBy };
}

export function getDependencies(taskId: string): { depends_on: string[]; blocked_by: string[]; blocks: string[] } {
  const db = getDb();
  const dependsOn = db.prepare(
    "SELECT depends_on_id FROM task_dependencies WHERE task_id = ?"
  ).all(taskId) as { depends_on_id: string }[];

  const blocks = db.prepare(
    "SELECT task_id FROM task_dependencies WHERE depends_on_id = ?"
  ).all(taskId) as { task_id: string }[];

  const blockedBy = dependsOn.length > 0
    ? db.prepare(`
        SELECT t.id FROM tasks t
        INNER JOIN task_dependencies d ON d.depends_on_id = t.id
        WHERE d.task_id = ? AND t.status != 'done'
      `).all(taskId) as { id: string }[]
    : [];

  return {
    depends_on: dependsOn.map(r => r.depends_on_id),
    blocks: blocks.map(r => r.task_id),
    blocked_by: blockedBy.map(r => r.id),
  };
}

export function addDependency(taskId: string, dependsOnId: string): void {
  if (taskId === dependsOnId) throw new Error("Task cannot depend on itself");
  const db = getDb();
  db.prepare("INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)").run(taskId, dependsOnId);
  logActivity(taskId, "dependency_added", "system", `Now depends on ${dependsOnId}`);
}

export function getTaskFiles(taskId: string): string[] {
  const db = getDb();
  const rows = db.prepare("SELECT file_path FROM task_files WHERE task_id = ?").all(taskId) as { file_path: string }[];
  return rows.map(r => r.file_path);
}

export function addTaskFile(taskId: string, filePath: string): void {
  const db = getDb();
  db.prepare("INSERT OR IGNORE INTO task_files (task_id, file_path) VALUES (?, ?)").run(taskId, filePath);
  logActivity(taskId, "file_added", "system", `Added file: ${filePath}`);
}

export function removeTaskFile(taskId: string, filePath: string): void {
  const db = getDb();
  db.prepare("DELETE FROM task_files WHERE task_id = ? AND file_path = ?").run(taskId, filePath);
  logActivity(taskId, "file_removed", "system", `Removed file: ${filePath}`);
}

export function removeDependency(taskId: string, dependsOnId: string): void {
  const db = getDb();
  db.prepare("DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?").run(taskId, dependsOnId);
  logActivity(taskId, "dependency_removed", "system", `Removed dependency on ${dependsOnId}`);
}

function logActivity(taskId: string, action: string, actor: string, details: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO activity_log (id, task_id, action, actor, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(genId(), taskId, action, actor, details, new Date().toISOString());
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

  const task = getTask(id)!;
  logActivity(id, "created", params.agent || "system", "Task created");
  return task;
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
  if (!row) return null;
  const deps = getDependencies(id);
  const files = getTaskFiles(id);
  return computeStale({ ...row, ...deps, files });
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

  const rows = db.prepare(`
    SELECT t.*, COALESCE(c.cnt, 0) as comment_count
    FROM tasks t
    LEFT JOIN (SELECT task_id, COUNT(*) as cnt FROM comments GROUP BY task_id) c
      ON c.task_id = t.id
    ${where}
    ORDER BY t.created_at DESC
  `).all(...values) as Task[];

  // Batch-enrich with dependency info and files
  const allDeps = db.prepare("SELECT task_id, depends_on_id FROM task_dependencies").all() as { task_id: string; depends_on_id: string }[];
  const allFiles = db.prepare("SELECT task_id, file_path FROM task_files").all() as { task_id: string; file_path: string }[];
  const filesMap = new Map<string, string[]>();
  for (const f of allFiles) {
    if (!filesMap.has(f.task_id)) filesMap.set(f.task_id, []);
    filesMap.get(f.task_id)!.push(f.file_path);
  }
  const statusMap = new Map(rows.map(t => [t.id, t.status]));
  return rows.map(t => computeStale({ ...enrichWithDeps(t, allDeps, statusMap), files: filesMap.get(t.id) || [] }));
}

export function updateTaskStatus(taskId: string, status: TaskStatus): Task {
  const db = getDb();
  const oldTask = getTask(taskId);
  const oldStatus = oldTask?.status || "unknown";

  // Note: blocked_by check is UI-side only — agents can freely complete tasks

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
  logActivity(taskId, "status_changed", task.agent || "system", `${oldStatus} → ${status}`);
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
  logActivity(taskId, "claimed", agent, `Claimed by ${agent}`);
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
  const changed = Object.keys(params).filter(k => (params as any)[k] !== undefined);
  logActivity(taskId, "edited", "system", `Updated: ${changed.join(", ")}`);
  return task;
}

export function addComment(params: {
  task_id: string;
  content: string;
  author?: string;
  type?: CommentType;
}): Comment {
  const db = getDb();
  const id = genId();
  const now = new Date().toISOString();
  const type = params.type || "comment";

  db.prepare(`
    INSERT INTO comments (id, task_id, author, content, type, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, params.task_id, params.author || "agent", params.content, type, now);

  return db.prepare("SELECT * FROM comments WHERE id = ?").get(id) as Comment;
}

export function listComments(taskId: string): Comment[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM comments WHERE task_id = ? ORDER BY created_at ASC"
  ).all(taskId) as Comment[];
}

export function getTimeline(taskId: string): TimelineEntry[] {
  const db = getDb();

  const comments = db.prepare(
    "SELECT * FROM comments WHERE task_id = ? ORDER BY created_at ASC"
  ).all(taskId) as Comment[];

  const activities = db.prepare(
    "SELECT * FROM activity_log WHERE task_id = ? ORDER BY created_at ASC"
  ).all(taskId) as ActivityLogEntry[];

  const timeline: TimelineEntry[] = [
    ...comments.map(c => ({
      kind: c.type as "comment" | "feedback",
      id: c.id,
      task_id: c.task_id,
      created_at: c.created_at,
      author: c.author,
      content: c.content,
    })),
    ...activities.map(a => ({
      kind: "activity" as const,
      id: a.id,
      task_id: a.task_id,
      created_at: a.created_at,
      action: a.action,
      actor: a.actor,
      details: a.details,
    })),
  ];

  timeline.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return timeline;
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

export function getStaleTasks(): Task[] {
  const db = getDb();
  const cutoff = new Date(Date.now() - getStaleTimeoutMs()).toISOString();
  const rows = db.prepare(`
    SELECT t.*, COALESCE(c.cnt, 0) as comment_count
    FROM tasks t
    LEFT JOIN (SELECT task_id, COUNT(*) as cnt FROM comments GROUP BY task_id) c
      ON c.task_id = t.id
    WHERE t.status IN ('claimed', 'in_progress')
      AND t.updated_at < ?
    ORDER BY t.updated_at ASC
  `).all(cutoff) as Task[];
  return rows.map(t => ({ ...t, is_stale: true, depends_on: [], blocked_by: [], blocks: [], files: [] }));
}

export function getAgentStats(): AgentStats[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT agent, status, COUNT(*) as cnt FROM tasks WHERE agent != '' GROUP BY agent, status"
  ).all() as { agent: string; status: string; cnt: number }[];

  const map = new Map<string, AgentStats>();
  for (const row of rows) {
    if (!map.has(row.agent)) {
      map.set(row.agent, { agent: row.agent, claimed: 0, in_progress: 0, review: 0, done: 0, total: 0, completion_rate: 0 });
    }
    const stats = map.get(row.agent)!;
    if (row.status === "claimed") stats.claimed = row.cnt;
    else if (row.status === "in_progress") stats.in_progress = row.cnt;
    else if (row.status === "review") stats.review = row.cnt;
    else if (row.status === "done") stats.done = row.cnt;
    stats.total += row.cnt;
  }

  for (const stats of map.values()) {
    stats.completion_rate = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  }

  return [...map.values()].sort((a, b) => b.total - a.total);
}
