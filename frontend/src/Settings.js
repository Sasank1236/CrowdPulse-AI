import { useState, useEffect } from "react";

const BASE = "http://localhost:5000";

export default function Settings() {
  // ── Thresholds State ─────────────────────────────────────────
  const [low, setLow] = useState("");
  const [medium, setMedium] = useState("");
  const [savingThresholds, setSavingThresholds] = useState(false);
  const [thresholdStatus, setThresholdStatus] = useState(null);
  const [loadError, setLoadError] = useState(null);

  // ── IP Cameras State ─────────────────────────────────────────
  const [cameras, setCameras] = useState([]);
  const [loadingCams, setLoadingCams] = useState(false);
  const [camStatus, setCamStatus] = useState(null);

  // ── Camera Form State (Add / Edit) ───────────────────────────
  const [editingId, setEditingId] = useState(null); // null = not editing
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formStreamUrl, setFormStreamUrl] = useState("");
  const [formStatusVal, setFormStatusVal] = useState("enabled");

  // ── Load thresholds on mount ──────────────────────────────────
  useEffect(() => {
    fetch(`${BASE}/api/thresholds`)
      .then((r) => {
        if (!r.ok) throw new Error(`Server error: ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setLow(d.LOW ?? 0.4);
        setMedium(d.MEDIUM ?? 0.7);
      })
      .catch((e) => {
        setLoadError("Could not load thresholds: " + e.message);
        setLow(0.4);
        setMedium(0.7);
      });
  }, []);

  // ── Load IP Cameras ──────────────────────────────────────────
  const fetchCameras = () => {
    setLoadingCams(true);
    fetch(`${BASE}/api/cameras`)
      .then((r) => r.json())
      .then((data) => setCameras(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Failed to load IP cameras:", err))
      .finally(() => setLoadingCams(false));
  };

  useEffect(() => {
    fetchCameras();
  }, []);

  // ── Threshold Save ───────────────────────────────────────────
  const validateThresholds = () => {
    const l = parseFloat(low);
    const m = parseFloat(medium);
    if (isNaN(l) || isNaN(m)) return "Both values must be numbers.";
    if (l <= 0) return "Low threshold must be > 0.";
    if (m >= 1) return "Medium threshold must be < 1.";
    if (m <= l) return "Medium must be greater than Low.";
    return null;
  };

  const saveThresholds = async () => {
    const err = validateThresholds();
    if (err) {
      setThresholdStatus({ type: "error", msg: err });
      return;
    }
    setSavingThresholds(true);
    setThresholdStatus(null);
    try {
      const r = await fetch(`${BASE}/api/thresholds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ LOW: parseFloat(low), MEDIUM: parseFloat(medium) }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error || "Save failed");
      }
      setThresholdStatus({ type: "success", msg: "✓ Thresholds saved" });
    } catch (e) {
      setThresholdStatus({ type: "error", msg: e.message });
    } finally {
      setSavingThresholds(false);
    }
  };

  // ── Open Form for Add / Edit ────────────────────────────────
  const openAddForm = () => {
    setEditingId(null);
    setFormName("");
    setFormLocation("");
    setFormStreamUrl("");
    setFormStatusVal("enabled");
    setIsFormOpen(true);
  };

  const openEditForm = (cam) => {
    setEditingId(cam._id);
    setFormName(cam.name);
    setFormLocation(cam.location);
    setFormStreamUrl(cam.streamUrl);
    setFormStatusVal(cam.status);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
  };

  // ── Submit Add / Edit Camera ────────────────────────────────
  const handleSaveCamera = async (e) => {
    e.preventDefault();
    if (!formName.trim() || !formLocation.trim() || !formStreamUrl.trim()) {
      setCamStatus({ type: "error", msg: "Please fill in all fields." });
      return;
    }

    const payload = {
      name: formName.trim(),
      location: formLocation.trim(),
      streamUrl: formStreamUrl.trim(),
      status: formStatusVal,
    };

    try {
      const url = editingId
        ? `${BASE}/api/cameras/${editingId}`
        : `${BASE}/api/cameras`;
      const method = editingId ? "PUT" : "POST";

      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const errData = await r.json();
        throw new Error(errData.error || "Operation failed");
      }

      setCamStatus({
        type: "success",
        msg: `✓ Camera ${editingId ? "updated" : "added"} successfully`,
      });
      closeForm();
      fetchCameras();
    } catch (err) {
      setCamStatus({ type: "error", msg: err.message });
    }
  };

  // ── Delete Camera ────────────────────────────────────────────
  const handleDeleteCamera = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete camera "${name}"?`)) return;

    try {
      const r = await fetch(`${BASE}/api/cameras/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Delete failed");
      setCamStatus({ type: "success", msg: "✓ Camera deleted" });
      fetchCameras();
    } catch (err) {
      setCamStatus({ type: "error", msg: err.message });
    }
  };

  // ── Toggle Enable / Disable Status ────────────────────────────
  const handleToggleStatus = async (cam) => {
    const newStatus = cam.status === "enabled" ? "disabled" : "enabled";
    try {
      const r = await fetch(`${BASE}/api/cameras/${cam._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cam, status: newStatus }),
      });
      if (!r.ok) throw new Error("Status update failed");
      fetchCameras();
    } catch (err) {
      setCamStatus({ type: "error", msg: err.message });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "20px 0" }}>
      {/* ── IP Camera Management Section ──────────────────────────── */}
      <div className="settings-container" style={{ maxWidth: 840 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 className="section-title" style={{ margin: 0 }}>📹 IP Camera Management</h2>
            <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "4px 0 0 0" }}>
              Configure RTSP / HTTP IP Cameras for AI processing.
            </p>
          </div>
          {!isFormOpen && (
            <button className="save-btn" style={{ background: "#2563eb" }} onClick={openAddForm}>
              + Add IP Camera
            </button>
          )}
        </div>

        {camStatus && (
          <div style={{
            padding: "8px 12px",
            borderRadius: 6,
            marginBottom: 16,
            fontSize: "0.88rem",
            background: camStatus.type === "success" ? "#dcfce7" : "#fee2e2",
            color: camStatus.type === "success" ? "#166534" : "#991b1b",
          }}>
            {camStatus.msg}
          </div>
        )}

        {/* ── Add / Edit Form Modal ─────────────────────────────── */}
        {isFormOpen && (
          <form onSubmit={handleSaveCamera} style={{
            background: "#f1f5f9",
            padding: 16,
            borderRadius: 8,
            marginBottom: 20,
            display: "flex",
            flexDirection: "column",
            gap: 12
          }}>
            <h3 style={{ margin: 0, fontSize: "1rem", color: "#1e293b" }}>
              {editingId ? "✏️ Edit IP Camera" : "➕ Add IP Camera"}
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="form-label">Camera Name</label>
                <input
                  className="form-input"
                  placeholder="e.g. Entrance Cam 1"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label">Location</label>
                <input
                  className="form-input"
                  placeholder="e.g. Main Entrance"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="form-label">Stream URL (RTSP / HTTP)</label>
              <input
                className="form-input"
                placeholder="e.g. rtsp://192.168.1.100:554/stream1"
                value={formStreamUrl}
                onChange={(e) => setFormStreamUrl(e.target.value)}
                required
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Status:</label>
              <select
                className="form-input"
                style={{ width: 140 }}
                value={formStatusVal}
                onChange={(e) => setFormStatusVal(e.target.value)}
              >
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button type="submit" className="save-btn" style={{ background: "#16a34a" }}>
                {editingId ? "Update Camera" : "Save Camera"}
              </button>
              <button type="button" className="save-btn" style={{ background: "#64748b" }} onClick={closeForm}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* ── Camera List Table ─────────────────────────────────── */}
        {loadingCams ? (
          <p style={{ color: "#64748b" }}>Loading cameras...</p>
        ) : cameras.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", background: "#f8fafc", borderRadius: 8, border: "1px dashed #cbd5e1" }}>
            <p style={{ margin: 0, color: "#64748b", fontWeight: 500 }}>No IP cameras configured.</p>
            <p style={{ margin: "4px 0 0 0", color: "#94a3b8", fontSize: "0.85rem" }}>
              Click "+ Add IP Camera" above to register an IP stream.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "left", borderBottom: "2px solid #e2e8f0" }}>
                  <th style={{ padding: "10px 12px" }}>Name</th>
                  <th style={{ padding: "10px 12px" }}>Location</th>
                  <th style={{ padding: "10px 12px" }}>Stream URL</th>
                  <th style={{ padding: "10px 12px" }}>Status</th>
                  <th style={{ padding: "10px 12px", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {cameras.map((cam) => (
                  <tr key={cam._id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "10px 12px", fontWeight: 600 }}>{cam.name}</td>
                    <td style={{ padding: "10px 12px" }}>{cam.location}</td>
                    <td style={{ padding: "10px 12px", fontFamily: "monospace", color: "#475569", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {cam.streamUrl}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        padding: "3px 8px",
                        borderRadius: 12,
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        background: cam.status === "enabled" ? "#dcfce7" : "#f1f5f9",
                        color: cam.status === "enabled" ? "#15803d" : "#64748b",
                      }}>
                        {cam.status}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button
                          onClick={() => handleToggleStatus(cam)}
                          style={{
                            padding: "4px 8px",
                            fontSize: "0.75rem",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                            background: cam.status === "enabled" ? "#fef3c7" : "#e0e7ff",
                            color: cam.status === "enabled" ? "#92400e" : "#3730a3",
                          }}
                        >
                          {cam.status === "enabled" ? "Disable" : "Enable"}
                        </button>

                        <button
                          onClick={() => openEditForm(cam)}
                          style={{
                            padding: "4px 8px",
                            fontSize: "0.75rem",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                            background: "#e2e8f0",
                            color: "#1e293b",
                          }}
                        >
                          Edit
                        </button>

                        <button
                          onClick={() => handleDeleteCamera(cam._id, cam.name)}
                          style={{
                            padding: "4px 8px",
                            fontSize: "0.75rem",
                            border: "none",
                            borderRadius: 4,
                            cursor: "pointer",
                            background: "#fee2e2",
                            color: "#b91c1c",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Threshold Settings Section ───────────────────────────── */}
      <div className="settings-container" style={{ maxWidth: 840 }}>
        <h2 className="section-title">⚙️ Density Thresholds</h2>
        <p style={{ fontSize: "0.85rem", color: "#64748b", marginTop: 0, marginBottom: 20 }}>
          Density ratio thresholds for LOW / MEDIUM / HIGH classification.
          Values must be between 0 and 1 with LOW &lt; MEDIUM.
        </p>

        {loadError && <p className="save-error" style={{ marginBottom: 12 }}>⚠️ {loadError}</p>}

        <div className="settings-form">
          <div className="form-group">
            <label className="form-label" htmlFor="low-input">Low density threshold</label>
            <input
              id="low-input"
              className="form-input"
              type="number"
              step="0.05"
              min="0.01"
              max="0.99"
              value={low}
              onChange={(e) => setLow(e.target.value)}
            />
            <span className="form-hint">Ratios below this → LOW (e.g. 0.4)</span>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="medium-input">Medium density threshold</label>
            <input
              id="medium-input"
              className="form-input"
              type="number"
              step="0.05"
              min="0.01"
              max="0.99"
              value={medium}
              onChange={(e) => setMedium(e.target.value)}
            />
            <span className="form-hint">Above Low → MEDIUM; above this → HIGH (e.g. 0.7)</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <button className="save-btn" onClick={saveThresholds} disabled={savingThresholds}>
              {savingThresholds ? "Saving…" : "Save Thresholds"}
            </button>
            {thresholdStatus && (
              <span className={thresholdStatus.type === "success" ? "save-success" : "save-error"}>
                {thresholdStatus.msg}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
