import { useState } from "react";
import { createTask } from "../api";
import { getErrorMessage } from "../utils";

interface Props {
  onClose: () => void;
}

export function NewTaskModal({ onClose }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [category, setCategory] = useState("");
  const [project, setProject] = useState("default");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError("");
    try {
      await createTask({ title, description, priority, category, project });
      onClose();
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>New Task</h2>
        {error && <div className="modal-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div className="form-group">
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">None</option>
                <option value="backend">Backend</option>
                <option value="frontend">Frontend</option>
                <option value="test">Test</option>
                <option value="devops">DevOps</option>
                <option value="security">Security</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Project</label>
            <input
              value={project}
              onChange={(e) => setProject(e.target.value)}
              placeholder="Project name"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-submit">Create Task</button>
          </div>
        </form>
      </div>
    </div>
  );
}
