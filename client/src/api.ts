import { useState, useEffect, useCallback, useRef } from "react";
import type { BoardState, BoardStats, Task, TaskStatus, Comment, TimelineEntry, AgentStats } from "./types";

interface BoardData {
  board: BoardState | null;
  stats: BoardStats | null;
}

function computeStats(board: BoardState): BoardStats {
  const done = board.done.length;
  const total = board.todo.length + board.claimed.length + board.in_progress.length + board.review.length + done;
  const active = total - done;
  const rate = total > 0 ? Math.round((done / total) * 100) : 0;
  return { total, active, done, rate };
}

export function useBoardSync(): BoardData {
  const [board, setBoard] = useState<BoardState | null>(null);
  const [stats, setStats] = useState<BoardStats | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const retryRef = useRef(0);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      retryRef.current = 0;
    };

    ws.onmessage = (event) => {
      let data: any;
      try { data = JSON.parse(event.data); } catch { return; }
      switch (data.type) {
        case "board:sync":
          setBoard(data.state);
          if (data.stats) setStats(data.stats);
          break;
        case "task:created":
          setBoard((prev) => {
            if (!prev) return prev;
            const col = data.task.status as TaskStatus;
            return { ...prev, [col]: [data.task, ...prev[col]] };
          });
          break;
        case "task:updated":
          setBoard((prev) => {
            if (!prev) return prev;
            const next = { ...prev };
            // Remove from all columns
            for (const key of Object.keys(next) as TaskStatus[]) {
              next[key] = next[key].filter((t) => t.id !== data.task.id);
            }
            // Add to new column
            const col = data.task.status as TaskStatus;
            next[col] = [data.task, ...next[col]];
            return next;
          });
          break;
        case "task:deleted":
          setBoard((prev) => {
            if (!prev) return prev;
            const next = { ...prev };
            for (const key of Object.keys(next) as TaskStatus[]) {
              next[key] = next[key].filter((t) => t.id !== data.taskId);
            }
            return next;
          });
          break;
      }
    };

    ws.onclose = () => {
      const delay = Math.min(1000 * 2 ** retryRef.current, 30000);
      retryRef.current++;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => ws.close();
  }, []);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  useEffect(() => {
    if (board) setStats(computeStats(board));
  }, [board]);

  return { board, stats };
}

// REST API helpers
const BASE = "/api";

async function getApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

export async function createTask(params: {
  title: string;
  description?: string;
  priority?: string;
  category?: string;
  project?: string;
}): Promise<Task> {
  const res = await fetch(`${BASE}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await getApiError(res, "Create failed"));
  return res.json();
}

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
  const res = await fetch(`${BASE}/tasks/${taskId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await getApiError(res, "Update failed"));
  return res.json();
}

export async function updateTask(taskId: string, params: {
  title?: string;
  description?: string;
  priority?: string;
  category?: string;
  project?: string;
}): Promise<Task> {
  const res = await fetch(`${BASE}/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(await getApiError(res, "Update failed"));
  return res.json();
}

export async function deleteTask(taskId: string): Promise<void> {
  const res = await fetch(`${BASE}/tasks/${taskId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Delete failed");
}

export async function fetchComments(taskId: string): Promise<Comment[]> {
  const res = await fetch(`${BASE}/tasks/${taskId}/comments`);
  return res.json();
}

export async function addComment(taskId: string, content: string, author?: string, type?: "comment" | "feedback"): Promise<Comment> {
  const res = await fetch(`${BASE}/tasks/${taskId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, author, type }),
  });
  if (!res.ok) throw new Error(await getApiError(res, "Comment failed"));
  return res.json();
}

export async function fetchTimeline(taskId: string): Promise<TimelineEntry[]> {
  const res = await fetch(`${BASE}/tasks/${taskId}/activity`);
  return res.json();
}

export async function fetchTask(taskId: string): Promise<Task> {
  const res = await fetch(`${BASE}/tasks/${taskId}`);
  if (!res.ok) throw new Error("Task not found");
  return res.json();
}

export async function fetchAgentStats(): Promise<AgentStats[]> {
  const res = await fetch(`${BASE}/agents/stats`);
  return res.json();
}

export async function addDependency(taskId: string, dependsOnId: string): Promise<void> {
  const res = await fetch(`${BASE}/tasks/${taskId}/dependencies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ depends_on_id: dependsOnId }),
  });
  if (!res.ok) throw new Error(await getApiError(res, "Failed to add dependency"));
}

export async function addTaskFile(taskId: string, filePath: string): Promise<void> {
  const res = await fetch(`${BASE}/tasks/${taskId}/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_path: filePath }),
  });
  if (!res.ok) throw new Error(await getApiError(res, "Failed to add file"));
}

export async function removeTaskFile(taskId: string, filePath: string): Promise<void> {
  const res = await fetch(`${BASE}/tasks/${taskId}/files?path=${encodeURIComponent(filePath)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to remove file");
}

export async function removeDependency(taskId: string, dependsOnId: string): Promise<void> {
  const res = await fetch(`${BASE}/tasks/${taskId}/dependencies/${dependsOnId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to remove dependency");
}
