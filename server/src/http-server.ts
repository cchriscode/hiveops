import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import * as store from "./store.js";
import type { EventEmitter } from "events";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function startHttpServer(port: number, events: EventEmitter): void {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Serve built React client
  const clientDist = path.join(__dirname, "..", "..", "client", "dist");
  app.use(express.static(clientDist));

  // ── REST API ──

  app.get("/api/board", (_req, res) => {
    res.json(store.getBoardState());
  });

  app.get("/api/stats", (_req, res) => {
    res.json(store.getStats());
  });

  app.get("/api/tasks/stale", (_req, res) => {
    res.json(store.getStaleTasks());
  });

  app.get("/api/tasks", (req, res) => {
    res.json(store.listTasks(req.query as Record<string, string>));
  });

  app.get("/api/tasks/:id", (req, res) => {
    const task = store.getTask(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  });

  app.post("/api/tasks", (req, res) => {
    const task = store.createTask(req.body);
    broadcast({ type: "task:created", task });
    res.status(201).json(task);
  });

  app.patch("/api/tasks/:id/status", (req, res) => {
    try {
      const task = store.updateTaskStatus(req.params.id, req.body.status);
      broadcast({ type: "task:updated", task });
      res.json(task);
    } catch (e: any) {
      res.status(404).json({ error: e.message });
    }
  });

  app.patch("/api/tasks/:id/claim", (req, res) => {
    try {
      const task = store.claimTask(req.params.id, req.body.agent);
      broadcast({ type: "task:updated", task });
      res.json(task);
    } catch (e: any) {
      res.status(404).json({ error: e.message });
    }
  });

  app.patch("/api/tasks/:id", (req, res) => {
    try {
      const task = store.updateTask(req.params.id, req.body);
      broadcast({ type: "task:updated", task });
      res.json(task);
    } catch (e: any) {
      res.status(404).json({ error: e.message });
    }
  });

  app.delete("/api/tasks/:id", (req, res) => {
    store.deleteTask(req.params.id);
    broadcast({ type: "task:deleted", taskId: req.params.id });
    res.status(204).end();
  });

  app.get("/api/tasks/:id/activity", (req, res) => {
    res.json(store.getTimeline(req.params.id));
  });

  app.get("/api/tasks/:id/comments", (req, res) => {
    const comments = store.listComments(req.params.id);
    res.json(comments);
  });

  app.post("/api/tasks/:id/comments", (req, res) => {
    const comment = store.addComment({ task_id: req.params.id, ...req.body });
    broadcast({ type: "comment:added", taskId: req.params.id, comment });
    res.status(201).json(comment);
  });

  app.get("/api/tasks/:id/dependencies", (req, res) => {
    res.json(store.getDependencies(req.params.id));
  });

  app.post("/api/tasks/:id/dependencies", (req, res) => {
    try {
      store.addDependency(req.params.id, req.body.depends_on_id);
      const task = store.getTask(req.params.id)!;
      broadcast({ type: "task:updated", task });
      const target = store.getTask(req.body.depends_on_id);
      if (target) broadcast({ type: "task:updated", task: target });
      res.status(201).json({ ok: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/tasks/:id/dependencies/:depId", (req, res) => {
    store.removeDependency(req.params.id, req.params.depId);
    const task = store.getTask(req.params.id)!;
    broadcast({ type: "task:updated", task });
    const target = store.getTask(req.params.depId);
    if (target) broadcast({ type: "task:updated", task: target });
    res.status(204).end();
  });

  app.get("/api/tasks/:id/files", (req, res) => {
    res.json(store.getTaskFiles(req.params.id));
  });

  app.post("/api/tasks/:id/files", (req, res) => {
    try {
      store.addTaskFile(req.params.id, req.body.file_path);
      const task = store.getTask(req.params.id)!;
      broadcast({ type: "task:updated", task });
      res.status(201).json({ ok: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/tasks/:id/files", (req, res) => {
    const filePath = req.query.path as string;
    if (!filePath) return res.status(400).json({ error: "Missing path query param" });
    store.removeTaskFile(req.params.id, filePath);
    const task = store.getTask(req.params.id)!;
    broadcast({ type: "task:updated", task });
    res.status(204).end();
  });

  app.get("/api/projects", (_req, res) => {
    res.json(store.getProjects());
  });

  app.get("/api/categories", (_req, res) => {
    res.json(store.getCategories());
  });

  app.get("/api/agents/stats", (_req, res) => {
    res.json(store.getAgentStats());
  });

  // SPA fallback
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });

  // ── HTTP + WebSocket ──

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({
      type: "board:sync",
      state: store.getBoardState(),
      stats: store.getStats(),
    }));
    ws.on("close", () => clients.delete(ws));
  });

  function broadcast(event: object): void {
    const msg = JSON.stringify(event);
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    }
  }

  // Poll for changes from MCP stdio agents (every 2s)
  let lastHash = "";
  setInterval(() => {
    const stats = store.getStats();
    const hash = JSON.stringify(stats);
    if (hash !== lastHash) {
      lastHash = hash;
      broadcast({
        type: "board:sync",
        state: store.getBoardState(),
        stats,
      });
    }
  }, 2000);

  // Stale task check (every 60s) — broadcast updated board if stale tasks exist
  setInterval(() => {
    const stale = store.getStaleTasks();
    if (stale.length > 0) {
      broadcast({
        type: "board:sync",
        state: store.getBoardState(),
        stats: store.getStats(),
      });
    }
  }, 60_000);

  // Forward events from MCP (when running in same process)
  events.on("task:created", (task) => broadcast({ type: "task:created", task }));
  events.on("task:updated", (task) => broadcast({ type: "task:updated", task }));
  events.on("task:deleted", (taskId) => broadcast({ type: "task:deleted", taskId }));
  events.on("comment:added", (data) => broadcast({ type: "comment:added", ...data }));

  httpServer.listen(port);
}
