import { useState, useEffect, useCallback, useRef } from "react";
import type { BoardState, BoardStats, Task, TaskStatus, Comment } from "./types";

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

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
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
      reconnectTimer.current = setTimeout(connect, 3000);
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
  if (!res.ok) throw new Error((await res.json()).error || "Create failed");
  return res.json();
}

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<Task> {
  const res = await fetch(`${BASE}/tasks/${taskId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Update failed");
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
  if (!res.ok) throw new Error((await res.json()).error || "Update failed");
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

export async function addComment(taskId: string, content: string, author?: string): Promise<Comment> {
  const res = await fetch(`${BASE}/tasks/${taskId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, author }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Comment failed");
  return res.json();
}
