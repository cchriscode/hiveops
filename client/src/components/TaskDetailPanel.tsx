import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import {
  updateTask, deleteTask, updateTaskStatus, fetchTask,
  fetchTimeline, addComment, addDependency, removeDependency,
  addTaskFile, removeTaskFile,
} from "../api";
import { getErrorMessage } from "../utils";
import type { Task, TaskPriority, TaskStatus, TimelineEntry } from "../types";

interface Props {
  task: Task;
  onClose: () => void;
}

export function TaskDetailPanel({ task: initialTask, onClose }: Props) {
  const [task, setTask] = useState(initialTask);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [category, setCategory] = useState(task.category);
  const [project, setProject] = useState(task.project);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [newComment, setNewComment] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [newDepId, setNewDepId] = useState("");
  const [newFilePath, setNewFilePath] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setTask(initialTask);
    setTitle(initialTask.title);
    setDescription(initialTask.description);
    setPriority(initialTask.priority);
    setCategory(initialTask.category);
    setProject(initialTask.project);
    setEditing(false);
    setError("");
  }, [initialTask.id]);

  function refreshTimeline() {
    fetchTimeline(task.id).then(setTimeline).catch(() => {});
  }

  useEffect(() => {
    refreshTimeline();
  }, [task.id]);

  async function refreshTask() {
    try {
      const updated = await fetchTask(task.id);
      setTask(updated);
    } catch {
      // will get updated via WebSocket
    }
  }

  async function handleSave() {
    setError("");
    try {
      await updateTask(task.id, { title, description, priority, category, project });
      setEditing(false);
      await refreshTask();
      refreshTimeline();
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this task?")) return;
    try {
      await deleteTask(task.id);
      onClose();
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    }
  }

  async function handleStatusChange(status: string) {
    setError("");
    try {
      await updateTaskStatus(task.id, status as TaskStatus);
      await refreshTask();
      refreshTimeline();
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    }
  }

  async function handleAddComment() {
    if (!newComment.trim()) return;
    try {
      await addComment(task.id, newComment);
      setNewComment("");
      refreshTimeline();
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    }
  }

  async function handleAddDep() {
    const id = newDepId.trim();
    if (!id) return;
    try {
      await addDependency(task.id, id);
      setNewDepId("");
      await refreshTask();
      refreshTimeline();
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    }
  }

  async function handleRemoveDep(depId: string) {
    try {
      await removeDependency(task.id, depId);
      await refreshTask();
      refreshTimeline();
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    }
  }

  async function handleAddFile() {
    const fp = newFilePath.trim();
    if (!fp) return;
    try {
      await addTaskFile(task.id, fp);
      setNewFilePath("");
      await refreshTask();
      refreshTimeline();
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    }
  }

  async function handleRemoveFile(fp: string) {
    try {
      await removeTaskFile(task.id, fp);
      await refreshTask();
      refreshTimeline();
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    }
  }

  async function handleAddFeedback() {
    if (!feedbackText.trim()) return;
    try {
      await addComment(task.id, feedbackText, "PM", "feedback");
      setFeedbackText("");
      refreshTimeline();
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    }
  }

  function renderTimelineEntry(entry: TimelineEntry) {
    if (entry.kind === "activity") {
      return (
        <div key={entry.id} className="timeline-activity">
          <span className="timeline-dot" />
          <span className="timeline-activity-text">{entry.details}</span>
          <span className="timeline-time">{new Date(entry.created_at).toLocaleString()}</span>
        </div>
      );
    }

    const isFeedback = entry.kind === "feedback";
    return (
      <div key={entry.id} className={`comment ${isFeedback ? "comment-feedback" : ""}`}>
        <div className="comment-header">
          <span className={`comment-author ${isFeedback ? "comment-author-pm" : ""}`}>
            {isFeedback ? `PM: ${entry.author}` : entry.author}
          </span>
          <span className="comment-time">{new Date(entry.created_at).toLocaleString()}</span>
        </div>
        <div className="comment-content markdown-content">
          <ReactMarkdown>{entry.content || ""}</ReactMarkdown>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="panel-backdrop" onClick={onClose} />
      <div className="detail-panel">
        <div className="panel-header">
          <button className="panel-close" onClick={onClose} aria-label="Close">&times;</button>
        </div>
        <div className="panel-body">
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

              {task.description && (
                <div className="detail-description markdown-content">
                  <ReactMarkdown>{task.description}</ReactMarkdown>
                </div>
              )}

              <div className="detail-grid">
                <div className="detail-field">
                  <span className="detail-label">Project</span>
                  <span className="detail-value">{task.project}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-label">Status</span>
                  <span className={`detail-value detail-status status-${task.status}`}>{task.status.replace("_", " ")}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-label">Priority</span>
                  <span className={`detail-value priority-badge priority-${task.priority}`}>{task.priority}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-label">Claimed By</span>
                  <span className="detail-value">{task.agent || "unassigned"}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-label">Created</span>
                  <span className="detail-value">{new Date(task.created_at).toLocaleString()}</span>
                </div>
                <div className="detail-field">
                  <span className="detail-label">Updated</span>
                  <span className="detail-value">{new Date(task.updated_at).toLocaleString()}</span>
                </div>
                {task.category && (
                  <div className="detail-field">
                    <span className="detail-label">Category</span>
                    <span className={`detail-value category-tag ${task.category}`}>{task.category}</span>
                  </div>
                )}
              </div>

              {/* Scope (Files) */}
              <div className="detail-section">
                <h4>Scope (Files)</h4>
                {task.files?.length > 0 && (
                  <div className="file-list">
                    {task.files.map((fp) => (
                      <span key={fp} className="file-chip">
                        {fp}
                        <button className="dep-remove" onClick={() => handleRemoveFile(fp)}>&times;</button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="dep-add">
                  <input
                    value={newFilePath}
                    onChange={(e) => setNewFilePath(e.target.value)}
                    placeholder="path/to/file.ts"
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddFile(); }}
                  />
                  <button onClick={handleAddFile}>Add</button>
                </div>
              </div>

              {/* Dependencies */}
              {(task.depends_on?.length > 0 || task.blocks?.length > 0) && (
                <div className="detail-section">
                  {task.depends_on?.length > 0 && (
                    <>
                      <h4>Depends on ({task.blocked_by?.length || 0} blocking)</h4>
                      <div className="dep-list">
                        {task.depends_on.map((id) => (
                          <span key={id} className="dep-chip">
                            {id.slice(0, 8)}
                            <button className="dep-remove" onClick={() => handleRemoveDep(id)}>&times;</button>
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                  {task.blocks?.length > 0 && (
                    <>
                      <h4>Blocks</h4>
                      <div className="dep-list">
                        {task.blocks.map((id) => (
                          <span key={id} className="dep-chip">{id.slice(0, 8)}</span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              <div className="dep-add">
                <input
                  value={newDepId}
                  onChange={(e) => setNewDepId(e.target.value)}
                  placeholder="Task ID to depend on"
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddDep(); }}
                />
                <button onClick={handleAddDep}>Add Dep</button>
              </div>

              {/* Workflow actions */}
              <div className="detail-workflow">
                {task.status === "review" && (
                  <>
                    <button className="btn-reject" onClick={() => handleStatusChange("in_progress")}>Reject</button>
                    <button className="btn-approve" onClick={() => handleStatusChange("done")}>Approve</button>
                  </>
                )}
                {task.status === "in_progress" && (
                  <button className="btn-submit" onClick={() => handleStatusChange("review")}>Submit for Review</button>
                )}
                {task.status === "claimed" && (
                  <button className="btn-submit" onClick={() => handleStatusChange("in_progress")}>Start Work</button>
                )}
                {task.status === "todo" && (
                  <button className="btn-submit" onClick={() => handleStatusChange("claimed")}>Claim</button>
                )}
              </div>
            </>
          )}

          <div className="detail-comments">
            <h3>Activity Log ({timeline.length})</h3>
            <div className="timeline-list">
              {timeline.map(renderTimelineEntry)}
            </div>

            <div className="feedback-input">
              <label>PM Feedback</label>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Write PM feedback..."
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddFeedback(); } }}
              />
              <div className="feedback-actions">
                <button className="btn-feedback" onClick={handleAddFeedback}>Send Feedback</button>
              </div>
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
    </>
  );
}
