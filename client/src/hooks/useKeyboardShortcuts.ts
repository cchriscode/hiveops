import { useEffect } from "react";

interface ShortcutHandlers {
  onNewTask: () => void;
  onToggleView: () => void;
  onClosePanel: () => void;
  onCommandPalette: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable;

      // Cmd/Ctrl+K — always fires
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        handlers.onCommandPalette();
        return;
      }

      // ESC — always fires
      if (e.key === "Escape") {
        handlers.onClosePanel();
        return;
      }

      // Rest only outside input fields
      if (isInput) return;

      if (e.key === "c" || e.key === "C") {
        handlers.onNewTask();
        return;
      }

      if (e.key === "b" || e.key === "B") {
        handlers.onToggleView();
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handlers]);
}
