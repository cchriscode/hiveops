import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as store from "./store.js";
import type { EventEmitter } from "events";

function mcpError(e: any) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: e.message }, null, 2) }], isError: true as const };
}

export function registerMcp(server: McpServer, events: EventEmitter): void {
  // ── Tools ──

  server.tool(
    "create_task",
    "Create a new task on the HiveOps Kanban board",
    {
      title: z.string().describe("Task title"),
      description: z.string().optional().describe("Task description"),
      priority: z.enum(["low", "medium", "high", "critical"]).optional().describe("Task priority"),
      category: z.string().optional().describe("Category tag: backend, frontend, test, devops, etc."),
      project: z.string().optional().describe("Project name"),
      agent: z.string().optional().describe("Agent name creating this task"),
    },
    async (args) => {
      try {
        const task = store.createTask(args);
        events.emit("task:created", task);
        return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
      } catch (e: any) {
        return mcpError(e);
      }
    }
  );

  server.tool(
    "update_task_status",
    "Move a task to a different Kanban column",
    {
      task_id: z.string().describe("Task ID"),
      status: z.enum(["todo", "claimed", "in_progress", "review", "done"]).describe("New status"),
    },
    async ({ task_id, status }) => {
      try {
        const task = store.updateTaskStatus(task_id, status);
        events.emit("task:updated", task);
        return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
      } catch (e: any) {
        return mcpError(e);
      }
    }
  );

  server.tool(
    "claim_task",
    "Agent claims a task and moves it to 'claimed' status",
    {
      task_id: z.string().describe("Task ID to claim"),
      agent: z.string().describe("Name of the agent claiming the task"),
    },
    async ({ task_id, agent }) => {
      try {
        const task = store.claimTask(task_id, agent);
        events.emit("task:updated", task);
        return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
      } catch (e: any) {
        return mcpError(e);
      }
    }
  );

  server.tool(
    "update_task",
    "Update a task's title, description, priority, category, or project",
    {
      task_id: z.string().describe("Task ID"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      priority: z.enum(["low", "medium", "high", "critical"]).optional().describe("New priority"),
      category: z.string().optional().describe("New category"),
      project: z.string().optional().describe("New project"),
    },
    async ({ task_id, ...params }) => {
      try {
        const task = store.updateTask(task_id, params);
        events.emit("task:updated", task);
        return { content: [{ type: "text" as const, text: JSON.stringify(task, null, 2) }] };
      } catch (e: any) {
        return mcpError(e);
      }
    }
  );

  server.tool(
    "delete_task",
    "Delete a task from the board",
    {
      task_id: z.string().describe("Task ID to delete"),
    },
    async ({ task_id }) => {
      try {
        store.deleteTask(task_id);
        events.emit("task:deleted", task_id);
        return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: task_id }) }] };
      } catch (e: any) {
        return mcpError(e);
      }
    }
  );

  server.tool(
    "add_comment",
    "Add a comment to a task",
    {
      task_id: z.string().describe("Task ID"),
      content: z.string().describe("Comment content"),
      author: z.string().optional().describe("Comment author name"),
      type: z.enum(["comment", "feedback"]).optional().describe("Type: 'comment' (default) or 'feedback' for PM feedback"),
    },
    async (args) => {
      try {
        const comment = store.addComment(args);
        events.emit("comment:added", { task_id: args.task_id, comment });
        return { content: [{ type: "text" as const, text: JSON.stringify(comment, null, 2) }] };
      } catch (e: any) {
        return mcpError(e);
      }
    }
  );

  server.tool(
    "get_activity",
    "Get the activity timeline for a task (comments, feedback, and status changes)",
    {
      task_id: z.string().describe("Task ID"),
    },
    async ({ task_id }) => {
      try {
        const timeline = store.getTimeline(task_id);
        return { content: [{ type: "text" as const, text: JSON.stringify(timeline, null, 2) }] };
      } catch (e: any) {
        return mcpError(e);
      }
    }
  );

  server.tool(
    "get_comments",
    "Get all comments for a task",
    {
      task_id: z.string().describe("Task ID"),
    },
    async ({ task_id }) => {
      try {
        const comments = store.listComments(task_id);
        return { content: [{ type: "text" as const, text: JSON.stringify(comments, null, 2) }] };
      } catch (e: any) {
        return mcpError(e);
      }
    }
  );

  server.tool(
    "list_tasks",
    "List tasks with optional filters",
    {
      status: z.enum(["todo", "claimed", "in_progress", "review", "done"]).optional(),
      project: z.string().optional(),
      agent: z.string().optional(),
      category: z.string().optional(),
    },
    async (filters) => {
      try {
        const tasks = store.listTasks(filters);
        return { content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }] };
      } catch (e: any) {
        return mcpError(e);
      }
    }
  );

  server.tool(
    "get_board_state",
    "Get the full Kanban board state with all tasks grouped by column",
    {},
    async () => {
      try {
        const state = store.getBoardState();
        const stats = store.getStats();
        return { content: [{ type: "text" as const, text: JSON.stringify({ ...state, stats }, null, 2) }] };
      } catch (e: any) {
        return mcpError(e);
      }
    }
  );

  server.tool(
    "get_agent_stats",
    "Get per-agent statistics: tasks claimed, in-progress, completed, and completion rate",
    {},
    async () => {
      try {
        const stats = store.getAgentStats();
        return { content: [{ type: "text" as const, text: JSON.stringify(stats, null, 2) }] };
      } catch (e: any) {
        return mcpError(e);
      }
    }
  );

  server.tool(
    "get_stale_tasks",
    "Get tasks that have been in 'claimed' or 'in_progress' status past the timeout threshold",
    {},
    async () => {
      try {
        const tasks = store.getStaleTasks();
        return { content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }] };
      } catch (e: any) {
        return mcpError(e);
      }
    }
  );

  server.tool(
    "add_dependency",
    "Make a task depend on another task (blocked-by relationship)",
    {
      task_id: z.string().describe("The task that will be blocked"),
      depends_on_id: z.string().describe("The task it depends on"),
    },
    async ({ task_id, depends_on_id }) => {
      try {
        store.addDependency(task_id, depends_on_id);
        const task = store.getTask(task_id);
        events.emit("task:updated", task);
        const target = store.getTask(depends_on_id);
        if (target) events.emit("task:updated", target);
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true, task }, null, 2) }] };
      } catch (e: any) {
        return mcpError(e);
      }
    }
  );

  server.tool(
    "remove_dependency",
    "Remove a dependency between tasks",
    {
      task_id: z.string().describe("The blocked task"),
      depends_on_id: z.string().describe("The task to remove as dependency"),
    },
    async ({ task_id, depends_on_id }) => {
      try {
        store.removeDependency(task_id, depends_on_id);
        const task = store.getTask(task_id);
        events.emit("task:updated", task);
        const target = store.getTask(depends_on_id);
        if (target) events.emit("task:updated", target);
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true }, null, 2) }] };
      } catch (e: any) {
        return mcpError(e);
      }
    }
  );

  server.tool(
    "add_task_file",
    "Associate a file path with a task (scope)",
    {
      task_id: z.string().describe("Task ID"),
      file_path: z.string().describe("File path to associate"),
    },
    async ({ task_id, file_path }) => {
      try {
        store.addTaskFile(task_id, file_path);
        const task = store.getTask(task_id);
        events.emit("task:updated", task);
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true, task }, null, 2) }] };
      } catch (e: any) {
        return mcpError(e);
      }
    }
  );

  server.tool(
    "remove_task_file",
    "Remove a file association from a task",
    {
      task_id: z.string().describe("Task ID"),
      file_path: z.string().describe("File path to remove"),
    },
    async ({ task_id, file_path }) => {
      try {
        store.removeTaskFile(task_id, file_path);
        const task = store.getTask(task_id);
        events.emit("task:updated", task);
        return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true }, null, 2) }] };
      } catch (e: any) {
        return mcpError(e);
      }
    }
  );

  // ── Resources ──

  server.resource(
    "board-state",
    "board://state",
    { description: "Current board state with all tasks grouped by column", mimeType: "application/json" },
    async (uri) => ({
      contents: [{ uri: uri.href, text: JSON.stringify(store.getBoardState()), mimeType: "application/json" }]
    })
  );

  server.resource(
    "board-stats",
    "board://stats",
    { description: "Board statistics: total, active, done, completion rate", mimeType: "application/json" },
    async (uri) => ({
      contents: [{ uri: uri.href, text: JSON.stringify(store.getStats()), mimeType: "application/json" }]
    })
  );

  server.resource(
    "task-detail",
    new ResourceTemplate("board://tasks/{id}", { list: undefined }),
    { description: "Individual task details", mimeType: "application/json" },
    async (uri, { id }) => {
      const task = store.getTask(id as string);
      return {
        contents: [{ uri: uri.href, text: JSON.stringify(task), mimeType: "application/json" }]
      };
    }
  );
}
