import { useState, useMemo, useCallback } from "react";
import { useBoardSync } from "./api";
import { flattenBoard } from "./utils";
import { Sidebar } from "./components/Sidebar";
import { Toolbar } from "./components/Toolbar";
import { Board } from "./components/Board";
import { ListView } from "./components/ListView";
import { NewTaskModal } from "./components/NewTaskModal";
import { TaskDetailPanel } from "./components/TaskDetailPanel";
import { AgentDashboard } from "./components/AgentDashboard";
import { CommandPalette } from "./components/CommandPalette";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import type { Task, SortMode } from "./types";

export default function App() {
  const { board, stats } = useBoardSync();
  const [showNewTask, setShowNewTask] = useState(false);
  const [showAgents, setShowAgents] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [projectFilter, setProjectFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");
  const [sortMode, setSortMode] = useState<SortMode>("time");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  const { projects, categories } = useMemo(() => {
    if (!board) return { projects: [] as string[], categories: [] as string[] };
    const all = flattenBoard(board);
    return {
      projects: [...new Set(all.map((t) => t.project).filter(Boolean))],
      categories: [...new Set(all.map((t) => t.category).filter(Boolean))].sort(),
    };
  }, [board]);

  const closeTopPanel = useCallback(() => {
    if (showCommandPalette) { setShowCommandPalette(false); return; }
    if (showNewTask) { setShowNewTask(false); return; }
    if (showAgents) { setShowAgents(false); return; }
    if (selectedTask) { setSelectedTask(null); return; }
  }, [showCommandPalette, showNewTask, showAgents, selectedTask]);

  useKeyboardShortcuts({
    onNewTask: () => setShowNewTask(true),
    onToggleView: () => setViewMode((v) => (v === "board" ? "list" : "board")),
    onClosePanel: closeTopPanel,
    onCommandPalette: () => setShowCommandPalette((v) => !v),
  });

  if (!board) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
        Connecting to HiveOps...
      </div>
    );
  }

  return (
    <div className={`app-layout ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        projects={projects}
        selectedProject={projectFilter}
        onProjectChange={setProjectFilter}
        viewMode={viewMode}
        onViewChange={setViewMode}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        onShowAgents={() => setShowAgents(true)}
      />
      <div className="main-area">
        <Toolbar
          stats={stats}
          viewMode={viewMode}
          onViewChange={setViewMode}
          categories={categories}
          selectedRole={roleFilter}
          onRoleChange={setRoleFilter}
          sortMode={sortMode}
          onSortChange={setSortMode}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onNewTask={() => setShowNewTask(true)}
          onCommandPalette={() => setShowCommandPalette(true)}
          onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
        />
        {viewMode === "board" ? (
          <Board board={board} projectFilter={projectFilter} roleFilter={roleFilter} sortMode={sortMode} searchQuery={searchQuery} onTaskClick={setSelectedTask} />
        ) : (
          <ListView board={board} projectFilter={projectFilter} roleFilter={roleFilter} sortMode={sortMode} searchQuery={searchQuery} onTaskClick={setSelectedTask} />
        )}
      </div>
      {selectedTask && <TaskDetailPanel task={selectedTask} onClose={() => setSelectedTask(null)} />}
      {showNewTask && <NewTaskModal onClose={() => setShowNewTask(false)} />}
      {showAgents && <AgentDashboard onClose={() => setShowAgents(false)} />}
      {showCommandPalette && (
        <CommandPalette
          board={board}
          onClose={() => setShowCommandPalette(false)}
          onTaskClick={(task) => { setShowCommandPalette(false); setSelectedTask(task); }}
          onNewTask={() => { setShowCommandPalette(false); setShowNewTask(true); }}
          onViewChange={(mode) => { setShowCommandPalette(false); setViewMode(mode); }}
          onShowAgents={() => { setShowCommandPalette(false); setShowAgents(true); }}
        />
      )}
    </div>
  );
}
