import { useState, useEffect } from "react";
import { updateTask, deleteTask, fetchComments, addComment } from "../api";
import type { Task, Comment, TaskPriority } from "../types";

interface Props {
  task: Task;
  onClose: () => void;
}

export function TaskDetailModal({ task, onClose }: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [category, setCategory] = useState(task.category);
  const [project, setProject] = useState(task.project);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchComments(task.id).then(setComments).catch(() => {});
  }, [task.id]);

  async function handleSave() {
    setError("");
    try {
      await updateTask(task.id, { title, description, priority, category, project });
      setEditing(false);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this task?")) return;
    try {
      await deleteTask(task.id);
      onClose();
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleAddComment() {
    if (!newComment.trim()) return;
    try {
      const comment = await addComment(task.id, newComment);
      setComments((prev) => [...prev, comment]);
      setNewComment("");
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-detail" onClick={(e) => e.stopPropagation()}>
        {error && <div className="modal-error">{error}</div>}

        {editing ? (
          <>
            <div className="form-group">
              <label>Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="form-group">
                <label>Category</label>
                <input value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label>Project</label>
              <input value={project} onChange={(e) => setProject(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-cancel" onClick={() => setEditing(false)}>Cancel</button>
              <button type="button" className="btn-submit" onClick={handleSave}>Save</button>
            </div>
          </>
        ) : (
          <>
            <div className="detail-header">
              <h2>{task.title}</h2>
              <div className="detail-actions">
                <button className="btn-cancel" onClick={() => setEditing(true)}>Edit</button>
                <button className="btn-danger" onClick={handleDelete}>Delete</button>
              </div>
            </div>
            <div className="detail-meta">
              {task.priority !== "medium" && (
                <span className={`priority-badge priority-${task.priority}`}>{task.priority}</span>
              )}
              {task.category && <span className={`category-tag ${task.category}`}>{task.category}</span>}
              <span className="detail-status">{task.status.replace("_", " ")}</span>
            </div>
            {task.description && <p className="detail-description">{task.description}</p>}
            <div className="detail-info">
              <span>Project: {task.project}</span>
              <span>Agent: {task.agent || "unassigned"}</span>
              <span>Created: {new Date(task.created_at).toLocaleString()}</span>
            </div>
          </>
        )}

        <div className="detail-comments">
          <h3>Comments ({comments.length})</h3>
          <div className="comments-list">
            {comments.map((c) => (
              <div key={c.id} className="comment">
                <div className="comment-header">
                  <span className="comment-author">{c.author}</span>
                  <span className="comment-time">{new Date(c.created_at).toLocaleString()}</span>
                </div>
                <div className="comment-content">{c.content}</div>
              </div>
            ))}
          </div>
          <div className="comment-input">
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              onKeyDown={(e) => { if (e.key === "Enter") handleAddComment(); }}
            />
            <button className="btn-submit" onClick={handleAddComment}>Post</button>
          </div>
        </div>
      </div>
    </div>
  );
}
