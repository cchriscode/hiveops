import { useState, useEffect, useRef, useMemo } from "react";
import type { Task, BoardState } from "../types";

interface Props {
  board: BoardState;
  onClose: () => void;
  onTaskClick: (task: Task) => void;
  onNewTask: () => void;
  onViewChange: (mode: "board" | "list") => void;
  onShowAgents: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  action: () => void;
}

export function CommandPalette({ board, onClose, onTaskClick, onNewTask, onViewChange, onShowAgents }: Props) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const allTasks: Task[] = useMemo(() => {
    return [...board.todo, ...board.claimed, ...board.in_progress, ...board.review, ...board.done];
  }, [board]);

  const commands: CommandItem[] = useMemo(() => {
    const actions: CommandItem[] = [
      { id: "new-task", label: "Create new task", hint: "C", action: () => { onClose(); onNewTask(); } },
      { id: "board-view", label: "Switch to Board view", hint: "B", action: () => { onClose(); onViewChange("board"); } },
      { id: "list-view", label: "Switch to List view", hint: "B", action: () => { onClose(); onViewChange("list"); } },
      { id: "agents", label: "Open Agent Dashboard", action: () => { onClose(); onShowAgents(); } },
    ];

    const taskItems: CommandItem[] = allTasks.map((t) => ({
      id: t.id,
      label: t.title,
      hint: t.status.replace("_", " "),
      action: () => { onClose(); onTaskClick(t); },
    }));

    return [...actions, ...taskItems];
  }, [allTasks, onClose, onNewTask, onViewChange, onShowAgents, onTaskClick]);

  const filtered = useMemo(() => {
    if (!query) return commands.slice(0, 10);
    const q = query.toLowerCase();
    return commands.filter((c) => c.label.toLowerCase().includes(q)).slice(0, 12);
  }, [query, commands]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % (filtered.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + (filtered.length || 1)) % (filtered.length || 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) filtered[selectedIndex].action();
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmd-input"
          type="text"
          placeholder="Type a command or search tasks..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="cmd-list">
          {filtered.map((item, i) => (
            <button
              key={item.id}
              className={`cmd-item ${i === selectedIndex ? "cmd-item--selected" : ""}`}
              onClick={item.action}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span className="cmd-item-label">{item.label}</span>
              {item.hint && <span className="cmd-item-hint">{item.hint}</span>}
            </button>
          ))}
          {filtered.length === 0 && <div className="cmd-empty">No results</div>}
        </div>
      </div>
    </div>
  );
}
