# 🚦 CrowdPulse AI — Real-Time Crowd Analytics System

**CrowdPulse AI** is a full-stack, real-time crowd monitoring and spatial analytics platform built for **PDPM IIITDM Jabalpur** campus. The system leverages **YOLOv8** deep learning for person detection, streams live telemetry to a **React** dashboard via **WebSockets (Socket.IO)**, and automatically triggers **SMS alerts** (via Twilio) when density thresholds are breached.

---

## 📸 Features

| Feature | Description |
|---------|-------------|
| **Live Person Detection** | YOLOv8 object detection on webcam / IP camera feeds with adaptive grid-based density estimation |
| **Real-Time Dashboard** | React + Recharts dashboard with live crowd count charts, density heatmap, and per-camera selection |
| **Role-Based Access** | Three roles — *Control Room*, *Security*, and *Public View* — each with tailored UI capabilities |
| **Image Upload & Analysis** | Security personnel can upload still images for on-demand YOLO analysis; results are broadcast to the Control Room |
| **SMS Alerts** | Twilio integration sends SMS notifications when HIGH density persists for ≥ 5 seconds |
| **Configurable Thresholds** | Density thresholds (LOW / MEDIUM / HIGH) are adjustable from the Settings panel and persisted in MongoDB |
| **Campus Heatmap** | Interactive SVG heatmap of the PDPM IIITDM Jabalpur campus with real-time density overlays |
| **Historical Data Storage (Task 1)** | Granular database schema & temporal indexing (`hour`, `dayOfWeek`, `dateStr`, `isWeekend`, `weather`, `eventType`, `location`) |
| **Analytics APIs (Task 2.1)** | REST endpoints for historical search (`/api/stats/history`), multi-camera / location / period comparison (`/api/stats/comparison`), and trendlines (`/api/stats/trends`) |
| **Analytics Dashboard & Charts (Task 2.2)** | Dedicated React Analytics view with time-series area charts, 24h peak hour matrix, day-of-week distribution, multi-entity comparative cards, and period delta banners |
| **Aggregation Pipeline & Background Cron Jobs (Task 3.1)** | Idempotent background aggregation engine (`HourlyStat`, `DailyStat`) with `node-cron` workers (`0 * * * *` and `0 0 * * *`) |
| **High-Performance Aggregated Analytics API & UI (Task 3.2)** | Fast `/api/analytics/hourly` & `/api/analytics/daily` endpoints, pre-aggregated mode toggle, query execution timing metrics (`<5ms`), 24h peak hour cards, and dedicated summary table view |

---

## 🏗️ Architecture

```
┌────────────────┐    WebSocket / REST     ┌─────────────────┐
│   React App    │ ◄────────────────────►  │  Node.js + Express │
│   (Frontend)   │       :5000             │    + Socket.IO      │
└────────────────┘                         │    (Backend)        │
                                           └────────┬────────────┘
                                                    │  HTTP
                                                    ▼
                                           ┌─────────────────┐
                                           │  Flask + YOLOv8  │
                                           │  (AI Service)    │
                                           │     :5001        │
                                           └────────┬────────────┘
                                                    │
                                                    ▼
                                           ┌─────────────────┐
                                           │    MongoDB       │
                                           │  (crowd DB)      │
                                           └─────────────────┘
```

---

## 📂 Project Structure

```
FINAL-Crowd/
├── ai/                          # Python AI service
│   ├── crowd_detection.py       # YOLOv8 detection + Flask API + MJPEG streaming
│   └── yolov8n.pt               # Pre-trained YOLOv8 nano weights
│
├── backend/                     # Node.js API server
│   ├── Server.js                # Express + Socket.IO server, REST endpoints
│   ├── Seed.js                  # Database seeder (creates default users)
│   ├── test_analytics_api.js    # Verification suite for analytics APIs
│   ├── routes/
│   │   └── analytics.js         # REST router for history, comparison & trend APIs
│   ├── models/
│   │   ├── CrowdStat.js         # Mongoose schema for crowd statistics with temporal metadata
│   │   └── User.js              # Mongoose schema for user authentication
│   └── package.json
│
├── frontend/                    # React dashboard (Create React App)
│   ├── public/                  # Static assets (favicon, manifest)
│   ├── src/
│   │   ├── App.js               # Main dashboard component
│   │   ├── App.css              # Application styles
│   │   ├── Analytics.js          # Task 2.2 Interactive Analytics & Trend Dashboard
│   │   ├── Crowdheatmap.js      # Interactive campus heatmap (SVG)
│   │   ├── History.js           # Historical data viewer table
│   │   ├── Login.js             # Authentication form
│   │   ├── Settings.js          # Threshold configuration panel
│   │   ├── index.js             # React entry point
│   │   └── index.css            # Global styles
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## 🛠️ Tech Stack

### Frontend
- **React 19** — UI framework
- **Recharts** — Real-time line charts
- **Socket.IO Client** — WebSocket communication
- **Axios** — HTTP requests

### Backend
- **Node.js + Express 5** — REST API server
- **Socket.IO** — Real-time bidirectional events
- **Mongoose** — MongoDB ODM
- **Multer** — File upload handling
- **bcrypt + JWT** — Authentication

### AI Service
- **Python 3** + **Flask** — Lightweight API server
- **Ultralytics YOLOv8** — Object detection (person class)
- **OpenCV** — Frame capture, processing, and MJPEG streaming
- **Twilio** — SMS alerting

### Database
- **MongoDB** — Stores crowd statistics, user accounts, and threshold configs

---

## ⚡ Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js     | ≥ 18    |
| Python      | ≥ 3.9   |
| MongoDB     | ≥ 6.0   |
| npm         | ≥ 9     |
| pip         | ≥ 22    |

---

## 🚀 Getting Started

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/<your-username>/CrowdPulse-AI.git
cd FINAL-Crowd

# Install dependencies for both backend and frontend via npm workspaces
npm install
```

### 2. Seed & Start the Backend

```bash
cd backend

# Seed default users (requires MongoDB running locally on port 27017)
node Seed.js

# Start the Node.js server
npm start
# → Server runs on http://localhost:5000
```

Default credentials created by `Seed.js`:
| Username | Password | Role |
|----------|----------|------|
| `balu_control` | `605124` | Control Room |
| `balu_security` | `605124` | Security |

### 3. Start the Frontend

In a new terminal:

```bash
cd frontend
npm start
# → React app runs on http://localhost:3000
```

### 4. Start the AI Detection Service

In a separate terminal:

```bash
cd ai
pip install flask ultralytics opencv-python numpy requests twilio
python crowd_detection.py
# → AI service runs on http://localhost:5001
# → MJPEG video stream on http://localhost:5001/video_feed/<cam_id>
```

> **Note:** On first run, YOLOv8 may download additional model files. Ensure you have internet connectivity.

---

## 🔌 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Authenticate user (returns JWT token) |

### Crowd Data & Infrastructure (Task 1)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/live-stats` | Stream live YOLO telemetry (supports extended temporal & environmental metadata) |
| `POST` | `/api/stats` | Endpoint alias for live stat ingestion |
| `GET`  | `/api/cameras` | List all detected camera IDs |
| `GET`  | `/api/locations` | List all 20 monitored IIITDM Jabalpur campus zones |
| `GET`  | `/api/daily-summary` | Aggregate daily summary stats per camera/location |

### Analytics & Comparative Intelligence (Task 2)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/stats/history` | Filterable, paginated search over raw historical records with period summary stats |
| `GET`  | `/api/stats/comparison` | Side-by-side comparative analysis across cameras, locations, or time periods (Period A vs B) |
| `GET`  | `/api/stats/trends` | Time-series trendlines, 24-hour peak hour matrix, day-of-week breakdown, and density share |

### High-Performance Aggregated Analytics (Task 3)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/analytics/hourly` | Pre-aggregated 1-hour summary stats with execution timing & query provenance |
| `GET`  | `/api/analytics/daily` | Pre-aggregated 24-hour daily summaries with peak hour detection & max crowd counts |
| `POST` | `/api/stats/aggregate/trigger` | Programmatic / manual trigger to run background aggregation pipelines |


### Image Upload

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload-image` | Upload image for YOLO analysis (Security role) |

### Thresholds

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/thresholds` | Get current density thresholds |
| `POST` | `/api/thresholds` | Update density thresholds |

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `live` | Server → Client | Real-time crowd stat updates |
| `alert` | Server → Client | HIGH density alert notifications |
| `uploadedImage` | Server → Client | Broadcast analyzed upload to Control Room |
| `thresholds` | Server → Client | Updated threshold values |
| `subscribe` | Client → Server | Subscribe to a specific camera room |

---

## 🎥 AI Service — Video Streaming

The AI service also exposes an MJPEG stream endpoint for the Control Room dashboard to display annotated live camera feeds:

```
GET http://localhost:5001/video_feed/<cam_id>
```

The stream shows bounding boxes around detected persons, an adaptive density grid, and real-time crowd count overlays.

---

## 🗺️ Campus Locations

The system is configured for the **PDPM IIITDM Jabalpur** campus with the following monitored zones:

`Entrance` · `Admin` · `PHC` · `CC` · `LHTC` · `CL` · `Hex` · `OAT` · `SAC` · `H1` · `H3` · `H4` · `PA` · `PB` · `N` · `M` · `Mess` · `Nescafe` · `ATM` · `Visitor_Hostel`

---

## ⚙️ Configuration

### Camera Sources

Edit `CAMERAS` in [`ai/crowd_detection.py`](ai/crowd_detection.py):

```python
CAMERAS = {
    "cam1": 0,                                    # Local webcam
    "cam2": "http://10.22.226.213:4747/video",    # IP camera (DroidCam etc.)
}
```

### Twilio SMS Alerts

Update the Twilio credentials in [`ai/crowd_detection.py`](ai/crowd_detection.py):

```python
ACCOUNT_SID   = "your_account_sid"
AUTH_TOKEN    = "your_auth_token"
TWILIO_NUMBER = "+1XXXXXXXXXX"
USER_MOBILE   = "+91XXXXXXXXXX"
```

### MongoDB Connection

The backend connects to `mongodb://127.0.0.1:27017/crowd` by default. To use a remote MongoDB (e.g., Atlas), uncomment the `dotenv` lines in [`backend/Server.js`](backend/Server.js) and set `MONGO_URI` in a `.env` file:

```env
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/crowd
PORT=5000
```

---

## 📋 User Roles

| Role | Capabilities |
|------|-------------|
| **Control Room** (`control`) | Full dashboard: live feed, charts, heatmap, history, settings, receives security uploads |
| **Security** (`security`) | Live stats, charts, heatmap, image upload & analysis, history, settings |
| **Public View** (`public`) | Live stats, charts, and heatmap only (read-only, no login required) |

---

## 🧪 Development Notes

- The frontend proxies API requests to `http://localhost:5000` (configured in `frontend/package.json`)
- Detection uses **YOLOv8 Nano** (`yolov8n.pt`) for fast inference — swap with `yolov8s.pt` or `yolov8m.pt` for higher accuracy
- The AI service runs a background **Flask** server for MJPEG streaming alongside the main detection loop
- Custom **NMS (Non-Maximum Suppression)** is applied post-YOLO to remove duplicate detections at IoU > 0.4
- A **smoothing buffer** (window = 10 frames) stabilizes the people count

---

## 📄 License

This project was developed as part of a course project at **PDPM IIITDM Jabalpur**.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
