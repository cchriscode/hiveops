import { useState, useEffect } from "react";
import { fetchAgentStats } from "../api";
import type { AgentStats } from "../types";

interface Props {
  onClose: () => void;
}

export function AgentDashboard({ onClose }: Props) {
  const [agents, setAgents] = useState<AgentStats[]>([]);

  useEffect(() => {
    fetchAgentStats().then(setAgents).catch(() => {});
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-dashboard" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header">
          <h2>Agent Dashboard</h2>
          <button className="btn-cancel" onClick={onClose}>Close</button>
        </div>
        {agents.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No agent data available.</p>
        ) : (
          <table className="agent-table">
            <thead>
              <tr>
                <th>Agent</th>
                <th>Claimed</th>
                <th>In Progress</th>
                <th>Review</th>
                <th>Done</th>
                <th>Total</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.agent}>
                  <td className="agent-name">{a.agent}</td>
                  <td>{a.claimed}</td>
                  <td>{a.in_progress}</td>
                  <td>{a.review}</td>
                  <td>{a.done}</td>
                  <td>{a.total}</td>
                  <td>{a.completion_rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
