import { useEffect, useState, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import History from "./History";
import Analytics from "./Analytics";
import Settings from "./Settings";
import CrowdHeatmap from "./Crowdheatmap";
import Login from "./Login";
import AIPrediction from "./AIPrediction";
import "./App.css";

const socket = io("http://localhost:5000");
// const socket = io("https://real-time-crowd-analytics-system.onrender.com");
const DENSITY_COLORS = { LOW: "#16a34a", MEDIUM: "#d97706", HIGH: "#dc2626" };

const camDataStore = {};

function getCamData(camId) {
  if (!camDataStore[camId]) {
    camDataStore[camId] = { latest: null, chart: [] };
  }
  return camDataStore[camId];
}

function CameraSelector({ cameras, selected, onSelect, liveStates }) {
  if (!cameras.length) {
    return (
      <div className="cam-selector-empty">
        No cameras detected yet. Start the Python detector.
      </div>
    );
  }
  return (
    <div className="cam-selector">
      {cameras.map((cam) => {
        const state   = liveStates[cam];
        const density = state?.density || null;
        return (
          <button
            key={cam}
            className={`cam-btn ${selected === cam ? "active" : ""} ${
              density ? `density-${density.toLowerCase()}` : ""
            }`}
            onClick={() => onSelect(cam)}
          >
            <span className="cam-btn-icon">📷</span>
            <span className="cam-btn-id">{cam}</span>
            {density && (
              <span
                className="cam-btn-badge"
                style={{ background: DENSITY_COLORS[density] }}
              >
                {density}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Role badge config ──────────────────────────────────────────────────────────
const ROLE_LABELS = {
  control:  "🖥 Control Room",
  security: "🛡 Security",
  public:   "👁 Public View",
};

export default function App() {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const [auth, setAuth] = useState(() => {
    const role     = sessionStorage.getItem("userRole");
    const username = sessionStorage.getItem("username");
    const token    = sessionStorage.getItem("token");
    return role ? { role, username, token } : null;
  });

  const handleLogin = (authData) => {
    setAuth(authData);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("userRole");
    sessionStorage.removeItem("username");
    sessionStorage.removeItem("token");
    setAuth(null);
  };

  // ── Dashboard state ────────────────────────────────────────────────────────
  const [view,        setView]        = useState("live");
  const [connected,   setConnected]   = useState(false);
  const [cameras,     setCameras]     = useState([]);
  const [selectedCam, setSelectedCam] = useState(null);
  const [liveStates,  setLiveStates]  = useState({});
  const [displayLatest,  setDisplayLatest]  = useState(null);
  const [displayChart,   setDisplayChart]   = useState([]);
  const [alerts, setAlerts] = useState([]);
  const alertTimers = useRef({});

  // ── Security image upload ─────────────────────────────────────────────────
  const [uploadFile,     setUploadFile]     = useState(null);
  const [uploading,      setUploading]      = useState(false);
  const [uploadError,    setUploadError]    = useState("");
  const [uploadedImage,  setUploadedImage]  = useState(null);
  const [uploadLocation, setUploadLocation] = useState("");  // selected campus location
  const [locationList,   setLocationList]   = useState([]);  // list from /api/locations

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError("");

    const form = new FormData();
    form.append("image", uploadFile);
    form.append("username", auth.username);
    if (uploadLocation) form.append("location", uploadLocation);

    try {
      const res = await fetch("http://localhost:5000/api/upload-image", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Upload failed.");
      } else {
        setUploadedImage(data);
        setUploadFile(null);
      }
    } catch (err) {
      setUploadError("Cannot reach server. Is the backend running?");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Load campus locations for the security upload dropdown
  useEffect(() => {
    fetch("http://localhost:5000/api/locations")
      .then((r) => r.json())
      .then((data) => setLocationList(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("http://localhost:5000/api/cameras")
    // fetch("https://real-time-crowd-analytics-system.onrender.com/api/cameras")
      .then((r) => r.json())
      .then((list) => {
        setCameras(list);
        if (list.length && !selectedCam) setSelectedCam(list[0]);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissAlert = useCallback((id) => {
    clearTimeout(alertTimers.current[id]);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  useEffect(() => {
    socket.on("connect",    () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("live", (data) => {
      const cam = data.camera || "default";
      setLiveStates((prev) => ({ ...prev, [cam]: data }));
      setCameras((prev) => prev.includes(cam) ? prev : [...prev, cam]);

      const store = getCamData(cam);
      store.latest = data;
      store.chart  = [
        ...store.chart.slice(-30),
        {
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit", minute: "2-digit", second: "2-digit",
          }),
          people: data.people,
        },
      ];

      setSelectedCam((selCam) => {
        if (selCam === cam || (!selCam && cam)) {
          setDisplayLatest(data);
          setDisplayChart([...store.chart]);
        }
        return selCam;
      });
    });

    socket.on("alert", ({ camera, message }) => {
      const id = `${camera}-${Date.now()}`;
      setAlerts((prev) => [...prev.slice(-4), { id, camera, message }]);

      if (Notification.permission === "granted") {
        new Notification("🚨 Crowd Alert", { body: message });
      }

      alertTimers.current[id] = setTimeout(() => {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
      }, 8000);
    });

    socket.on("uploadedImage", (data) => {
      setUploadedImage(data);
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("live");
      socket.off("alert");
      socket.off("uploadedImage");
      Object.values(alertTimers.current).forEach(clearTimeout);
    };
  }, []);

  const handleSelectCam = useCallback((cam) => {
    setSelectedCam(cam);
    const store = getCamData(cam);
    setDisplayLatest(store.latest);
    setDisplayChart([...store.chart]);
  }, []);

  // ── Login gate ─────────────────────────────────────────────────────────────
  if (!auth) return <Login onLogin={handleLogin} />;

  const liveData     = displayLatest || {};
  const densityColor = DENSITY_COLORS[liveData.density] || "#6b7280";
  const isPublic     = auth.role === "public";

  // Public users see live + prediction; staff also get analytics/history/settings
  const availableTabs = isPublic
    ? ["live", "prediction"]
    : ["live", "analytics", "history", "settings", "prediction"];

  return (
    <div className="app-container">
      <header className="app-header">
        <h1 className="app-title">🚦 CrowdPulse AI — Real-Time Crowd Analytics</h1>
        <div className="header-right">
          {auth.username && (
            <span className="username-badge">👤 {auth.username}</span>
          )}
          <span className="role-badge">{ROLE_LABELS[auth.role]}</span>
          <span className={`connection-badge ${connected ? "online" : "offline"}`}>
            {connected ? "● Live" : "○ Disconnected"}
          </span>
          <button className="logout-btn" onClick={handleLogout}>
            {isPublic ? "Switch Portal" : "Sign out"}
          </button>
        </div>
      </header>

      <nav className="nav-tabs">
        {availableTabs.map((tab) => (
          <button
            key={tab}
            className={`nav-tab ${view === tab ? "active" : ""}`}
            onClick={() => setView(tab)}
          >
            {tab === "prediction"
              ? "AI Prediction"
              : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
        {isPublic && (
          <span className="public-tab-note">
            🔒 History &amp; Settings require login
          </span>
        )}
      </nav>

      {alerts.length > 0 && (
        <div className="alert-stack">
          {alerts.map((a) => (
            <div key={a.id} className="alert-banner" role="alert">
              <span>{a.message}</span>
              <button
                className="alert-close"
                onClick={() => dismissAlert(a.id)}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {view === "live" && (
        <div className="view-content">
          <div className="cam-selector-row">
            <span className="cam-selector-label">Camera</span>
            <CameraSelector
              cameras={cameras}
              selected={selectedCam}
              onSelect={handleSelectCam}
              liveStates={liveStates}
            />
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-label">People Detected</span>
              <span className="stat-value">{liveData.people ?? "—"}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Estimated Capacity</span>
              <span className="stat-value">{liveData.capacity ?? "—"}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Density Level</span>
              <span className="stat-value" style={{ color: densityColor }}>
                {liveData.density ?? "—"}
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Density Ratio</span>
              <span className="stat-value">
                {liveData.densityRatio != null
                  ? (liveData.densityRatio * 100).toFixed(1) + "%"
                  : "—"}
              </span>
            </div>
          </div>

          <div className="charts-row">
            {auth.role === "security" && (
              <div className="chart-section">
                <h2 className="section-title">Upload Image for Analysis</h2>

                {/* Location dropdown */}
                <div style={{ marginBottom: 14 }}>
                  <label
                    htmlFor="upload-location-select"
                    style={{
                      display: "block",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "#475569",
                      marginBottom: 5,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    📍 Campus Location
                  </label>
                  <select
                    id="upload-location-select"
                    className="form-input"
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 7,
                      border: "1.5px solid #cbd5e1",
                      fontSize: "0.88rem",
                      background: "#f8fafc",
                      color: uploadLocation ? "#1e293b" : "#94a3b8",
                      cursor: "pointer",
                    }}
                    value={uploadLocation}
                    onChange={(e) => setUploadLocation(e.target.value)}
                  >
                    <option value="">— Select location —</option>
                    {locationList.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>

                {/* File picker */}
                <input
                  type="file"
                  accept="image/*"
                  style={{ width: "100%", marginBottom: 4 }}
                  onChange={(e) => setUploadFile(e.target.files[0] || null)}
                />
                <button
                  className="save-btn"
                  style={{ marginTop: 10, width: "100%" }}
                  onClick={handleUpload}
                  disabled={uploading || !uploadFile}
                >
                  {uploading ? "Analyzing…" : "Upload & Analyze"}
                </button>

                {uploadError && <p className="login-error">{uploadError}</p>}

                {uploadedImage && (
                  <div style={{ marginTop: 16 }}>
                    <img
                      src={uploadedImage.image}
                      alt="Analyzed upload"
                      style={{ width: "100%", borderRadius: 8, marginBottom: 10 }}
                    />
                    <div style={{
                      background: "#f0f9ff",
                      border: "1.5px solid #bae6fd",
                      borderRadius: 9,
                      padding: "10px 14px",
                      fontSize: "0.88rem",
                    }}>
                      {uploadLocation && (
                        <div style={{ marginBottom: 6 }}>
                          <span style={{
                            background: "#0ea5e9",
                            color: "#fff",
                            borderRadius: 999,
                            padding: "2px 10px",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                          }}>
                            📍 {uploadLocation}
                          </span>
                        </div>
                      )}
                      <span>
                        People: <strong>{uploadedImage.people}</strong>
                        {" · "}
                        Density:{" "}
                        <strong style={{ color: DENSITY_COLORS[uploadedImage.density] }}>
                          {uploadedImage.density}
                        </strong>
                        {uploadedImage.capacity != null && (
                          <span style={{ color: "#64748b" }}>
                            {" · "} Capacity: <strong style={{ color: "#1e293b" }}>{uploadedImage.capacity}</strong>
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {auth.role === "control" && uploadedImage && (
              <div className="chart-section">
                <h2 className="section-title">
                  Security Upload
                  <span className="section-badge">{uploadedImage.uploadedBy}</span>
                </h2>
                <img
                  src={uploadedImage.image}
                  alt="Uploaded by security"
                  style={{ width: "100%", borderRadius: 8 }}
                />
                <p style={{ marginTop: 8 }}>
                  People: <strong>{uploadedImage.people}</strong> · Density:{" "}
                  <strong style={{ color: DENSITY_COLORS[uploadedImage.density] }}>
                    {uploadedImage.density}
                  </strong>{" "}
                  · {new Date(uploadedImage.timestamp).toLocaleTimeString()}
                </p>
              </div>
            )}

            {auth.role === "control" && selectedCam && (
              <div className="chart-section">
                <h2 className="section-title">
                  Live Camera Feed
                  <span className="section-badge">{selectedCam}</span>
                </h2>
                <img
                  src={`http://localhost:5001/video_feed/${selectedCam}`}
                  alt={`Live processed feed for ${selectedCam}`}
                  style={{ width: "100%", borderRadius: 8, display: "block" }}
                />
              </div>
            )}

            <div className="chart-section">
              <h2 className="section-title">
                Live Crowd Count
                {selectedCam && (
                  <span className="section-badge">{selectedCam}</span>
                )}
              </h2>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart
                  data={displayChart}
                  margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="people"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-section heatmap-section">
              <h2 className="section-title">
                Density Heatmap
                <span className="section-badge">Spatial</span>
              </h2>
              <CrowdHeatmap
                key="heatmap"
                latestStat={displayLatest}
                cameraId={selectedCam}
                liveStates={liveStates}
              />
            </div>
          </div>
        </div>
      )}

      {view === "analytics" && !isPublic && <Analytics cameras={cameras} selectedCam={selectedCam} />}
      {view === "history"   && !isPublic && <History selectedCam={selectedCam} cameras={cameras} />}
      {view === "settings"  && !isPublic && <Settings token={auth.token} />}
      {view === "prediction" && <AIPrediction cameras={cameras} />}
    </div>
  );
}