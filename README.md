# 🚦 CrowdPulse AI — Real-Time Crowd Analytics & Prediction System

**CrowdPulse AI** is a full-stack, real-time crowd monitoring, spatial analytics, and next-day AI prediction platform built for the **PDPM IIITDM Jabalpur** campus. The system leverages **YOLOv8** deep learning for person detection, streams live telemetry to a **React** dashboard via **WebSockets (Socket.IO)**, features an independent **ML Prediction Microservice** for forecasting future crowd levels, and automatically triggers **SMS alerts** (via Twilio) when density thresholds are breached.

---

## 📸 Core Features

| Feature | Description |
|---------|-------------|
| **Live Person Detection** | YOLOv8 object detection on IP Camera streams (RTSP/HTTP) with adaptive grid-based density estimation |
| **IP Camera Management** | Dynamic Administrator CRUD portal in Control Panel to Add, Edit, Delete, and Enable/Disable IP Cameras stored in MongoDB |
| **Next-Day AI Predictions (PR #1)** | Standalone Machine Learning microservice (XGBoost, Random Forest, Linear Regression) predicting next-day average & peak crowd counts per campus zone |
| **Real-Time Dashboard** | React + Recharts dashboard with live crowd count charts, spatial density heatmap, and per-camera selection |
| **Role-Based Access** | Three roles — *Control Room*, *Security*, and *Public View* — each with tailored UI capabilities |
| **Image Upload & Analysis** | Security personnel can upload still images with campus zone selection for on-demand YOLO analysis; results are broadcast to Control Room |
| **SMS Alerts** | Twilio integration sends SMS notifications when HIGH density breaches threshold limits |
| **Configurable Thresholds** | Density thresholds (LOW / MEDIUM / HIGH) are adjustable from the Settings panel and persisted in MongoDB |
| **Campus Spatial Heatmap** | Interactive SVG heatmap of the PDPM IIITDM Jabalpur campus with real-time density overlays |
| **Historical Data Storage (Task 1)** | Granular database schema & temporal indexing (`hour`, `dayOfWeek`, `dateStr`, `isWeekend`, `weather`, `eventType`, `location`) |
| **Analytics APIs (Task 2.1)** | REST endpoints for historical search (`/api/stats/history`), multi-camera / location / period comparison (`/api/stats/comparison`), and trendlines (`/api/stats/trends`) |
| **Analytics Dashboard & Charts (Task 2.2)** | Dedicated React Analytics view with time-series area charts, 24h peak hour matrix, day-of-week distribution, multi-entity comparative cards, and period delta banners |
| **Aggregation Pipeline & Background Cron (Task 3.1)** | Idempotent background aggregation engine (`HourlyStat`, `DailyStat`) with `node-cron` workers (`0 * * * *` and `0 0 * * *`) |
| **High-Performance Aggregation API (Task 3.2)** | Sub-5ms `/api/analytics/hourly` & `/api/analytics/daily` endpoints, pre-aggregated mode toggle, and query execution timing metrics |
| **Docker Containerization** | Multi-container setup (`docker-compose.yml`) running MongoDB 7.0, Node Backend, React Frontend, Python YOLO AI, and Python ML Predictor |
| **Production Security & Hardening** | Non-root unprivileged container users, isolated internal MongoDB networking, Nginx security headers (`X-Frame-Options`, `X-Content-Type-Options`), and healthchecks |

---

## 🔀 Merged PR #1 — AI Prediction Analysis (`balu-0920/main`)

The project integrates **Pull Request #1**, adding an independent **Next-Day Crowd Prediction Microservice**:

- **ML Microservice (`ml/predictor.py`)**: Runs on port `5002` as a standalone Flask REST API.
- **Automated Dataset Generation & Training**:
  - `dataset_generator.py`: Generates structured historical training datasets incorporating temporal factors, campus events, and day-of-week crowd patterns.
  - `train_model.py`: Trains and evaluates **Random Forest**, **XGBoost**, and **Linear Regression** models, selecting the top performers for both average and peak crowd counts.
- **Model Evaluation & Backtesting**: Generates metrics summary (`ml/metrics.json`) and backtesting history (`ml/backtest.csv`).
- **Node Backend Proxy Integration**: `backend/Server.js` exposes proxy endpoints (`/api/predictions/*`) to query ML predictions without exposing internal service ports.
- **AI Prediction Dashboard (`frontend/src/AIPrediction.js`)**: Interactive UI tab providing next-day crowd forecasts, confidence ratings, model selection details, and backtest accuracy visualization.

---

## 🏗️ System Architecture

```
                               ┌─────────────────┐
                               │   React App     │
                               │   (Frontend)    │
                               │  Port: 3000 / 80│
                               └────────┬────────┘
                                        │ WebSocket / REST
                                        ▼
                               ┌─────────────────┐
                               │ Node.js Server  │
                               │ (Express + IO)  │
                               │   Port: 5000    │
                               └─┬──────┬──────┬─┘
                                 │      │      │
           HTTP / Stream Config  │      │      │ HTTP Proxy (/api/predictions/*)
  ┌──────────────────────────────┘      │      └──────────────────────────────┐
  ▼                                     ▼                                     ▼
┌─────────────────┐           ┌──────────────────┐                  ┌──────────────────┐
│ Flask YOLO AI   │           │     MongoDB      │                  │ Flask ML Service │
│ (Person Detect) │           │  (crowd database)│                  │ (Crowd Predictor)│
│   Port: 5001    │           │    Port: 27017   │                  │    Port: 5002    │
└─────────────────┘           └──────────────────┘                  └──────────────────┘
```

---

## 📂 Project Structure

```
FINAL-Crowd/
├── .env                         # Centralized environment variables
├── .env.example                 # Environment variables template
├── docker-compose.yml           # Multi-container Docker Compose orchestration
│
├── ai/                          # Python YOLOv8 Detection Microservice
│   ├── crowd_detection.py       # YOLOv8 detection + IP camera stream loop + Flask API
│   ├── Dockerfile               # Production Dockerfile (Python 3.11 slim, non-root)
│   ├── requirements.txt         # Pinned Python dependencies
│   └── yolov8n.pt               # Pre-trained YOLOv8 nano model weights
│
├── backend/                     # Node.js Express API & Real-Time Engine
│   ├── Server.js                # Express + Socket.IO server, IP Camera APIs, ML Proxies
│   ├── Seed.js                  # Database seeder (creates default users)
│   ├── Dockerfile               # Production Dockerfile (Node 20 Alpine, non-root)
│   ├── test_analytics_api.js    # Verification suite for analytics APIs
│   ├── routes/
│   │   └── analytics.js         # REST router for history, comparison & trend APIs
│   ├── models/
│   │   ├── Camera.js            # Mongoose schema for IP Camera configuration
│   │   ├── CrowdStat.js         # Mongoose schema for crowd telemetry with temporal metadata
│   │   ├── DailyStat.js         # Aggregated 24h daily summary schema
│   │   ├── HourlyStat.js        # Aggregated 1h hourly summary schema
│   │   └── User.js              # Mongoose schema for user authentication
│   └── package.json
│
├── ml/                          # Machine Learning Prediction Microservice (PR #1)
│   ├── predictor.py             # Flask API serving predictions & backtest metrics
│   ├── train_model.py           # Model training pipeline (Random Forest, XGBoost)
│   ├── dataset_generator.py     # Training dataset generation script
│   ├── Dockerfile               # Production Dockerfile (Python 3.11 slim, non-root)
│   ├── metrics.json             # Trained model performance metrics
│   ├── backtest.csv             # Model backtesting dataset
│   └── requirements.txt         # Pinned Python dependencies
│
├── frontend/                    # React Control Panel & Analytics Dashboard
│   ├── Dockerfile               # Multi-stage Nginx build Dockerfile
│   ├── nginx.conf               # Nginx server configuration with security headers
│   ├── public/                  # Static web assets
│   ├── src/
│   │   ├── App.js               # Main dashboard container & socket event listeners
│   │   ├── AIPrediction.js      # Next-day AI prediction dashboard (PR #1)
│   │   ├── Analytics.js         # Interactive Analytics & Trend Dashboard
│   │   ├── Crowdheatmap.js      # Interactive campus SVG heatmap
│   │   ├── History.js           # Historical telemetry table & filters
│   │   ├── Login.js             # Role-based authentication component
│   │   ├── Settings.js          # IP Camera Management & Density Thresholds
│   │   ├── App.css              # Dashboard styling
│   │   └── index.js             # React entry point
│   └── package.json
│
└── README.md
```

---

## 🛠️ Tech Stack

### Frontend
- **React 19** — UI framework
- **Recharts** — Time-series line & area chart visualization
- **Socket.IO Client** — Real-time WebSocket streaming
- **Axios** — HTTP requests

### Backend
- **Node.js + Express 5** — REST API server
- **Socket.IO** — Real-time bidirectional event engine
- **Mongoose** — MongoDB ODM
- **Multer** — File upload handling
- **node-cron** — Automated background aggregation scheduler
- **bcrypt + JWT** — Authentication & authorization

### AI & Computer Vision Service
- **Python 3.11** + **Flask** — Streaming & processing server
- **Ultralytics YOLOv8** — Deep learning person detection
- **OpenCV** — Frame processing, NMS, & MJPEG video streaming
- **Twilio** — Automated SMS alert dispatcher

### Machine Learning Service (PR #1)
- **Python 3.11** + **Flask** — Standalone prediction API
- **scikit-learn** & **XGBoost** — Regression models for crowd forecasting
- **pandas** & **joblib** — Feature engineering & model serialization

### Database & Operations
- **MongoDB 7.0** — Telemetry, camera configs, aggregations, and accounts
- **Docker & Docker Compose** — Containerized environment deployment

---

## ⚡ Prerequisites

| Requirement | Version |
|-------------|---------|
| Docker & Docker Compose | ≥ 24.0 (for containerized deployment) |
| Node.js     | ≥ 18 (for manual local setup) |
| Python      | ≥ 3.11 (for manual local setup) |
| MongoDB     | ≥ 6.0 (for manual local setup) |

---

## 🚀 Deployment & Installation

### Option A: Quickstart with Docker Compose (Recommended)

Run the entire platform (MongoDB, Backend, Frontend, AI Service, ML Predictor) with a single command:

```bash
git clone https://github.com/Sasank1236/CrowdPulse-AI.git
cd FINAL-Crowd

# Copy environment template
cp .env.example .env

# Build and launch all containers
docker compose up --build
```

Access the applications:
- **Frontend Control Panel**: `http://localhost:3000`
- **Node Backend API**: `http://localhost:5000`
- **AI YOLO Microservice**: `http://localhost:5001`
- **ML Prediction Service**: `http://localhost:5002`

---

### Option B: Manual Local Setup

#### 1. Configure Environment Variables
Create a `.env` file in the root directory:

```env
PORT=5000
AI_PORT=5001
ML_PORT=5002
FRONTEND_PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/crowd
AI_SERVICE_URL=http://localhost:5001
ML_SERVICE_URL=http://localhost:5002
BACKEND_URL=http://localhost:5000
JWT_SECRET=supersecretjwtkey123
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_NUMBER=+10000000000
USER_MOBILE=+910000000000
```

#### 2. Start Backend & Seed Database
```bash
cd backend
npm install
node Seed.js    # Seed default users
npm start       # Backend runs on http://localhost:5000
```

Default credentials:
| Username | Password | Role |
|----------|----------|------|
| `balu_control` | `605124` | Control Room |
| `balu_security` | `605124` | Security |

#### 3. Start Frontend
```bash
cd frontend
npm install
npm start       # React runs on http://localhost:3000
```

#### 4. Start AI Detection Service
```bash
cd ai
pip install -r requirements.txt
python crowd_detection.py    # AI service runs on http://localhost:5001
```

#### 5. Start ML Prediction Service (PR #1)
```bash
cd ml
pip install -r requirements.txt
python train_model.py        # Generate dataset & train models
python predictor.py          # ML Predictor runs on http://localhost:5002
```

---

## 🔌 API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/login` | Authenticate user (returns JWT token) |

### IP Camera Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/cameras` | List all configured IP Cameras from MongoDB |
| `POST` | `/api/cameras` | Register a new IP Camera (Name, Location, Stream URL, Status) |
| `PUT`  | `/api/cameras/:id` | Update an existing IP Camera or toggle Enable/Disable status |
| `DELETE` | `/api/cameras/:id` | Remove an IP Camera configuration |

### Telemetry & Crowd Data (Task 1)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/live-stats` | Stream live YOLO telemetry from AI service |
| `GET`  | `/api/locations` | List all 20 monitored IIITDM Jabalpur campus zones |
| `GET`  | `/api/daily-summary` | Aggregate daily summary stats per location |

### Analytics & Intelligence (Task 2)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/stats/history` | Filterable, paginated search over raw historical records |
| `GET`  | `/api/stats/comparison` | Comparative analysis across cameras, locations, or time periods (Period A vs B) |
| `GET`  | `/api/stats/trends` | Time-series trendlines, 24-hour peak hour matrix, and day-of-week breakdown |

### Aggregated Analytics (Task 3)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/analytics/hourly` | Pre-aggregated 1-hour summary stats with query execution timing |
| `GET`  | `/api/analytics/daily` | Pre-aggregated 24-hour daily summaries with peak hour detection |
| `POST` | `/api/stats/aggregate/trigger` | Programmatically trigger background aggregation jobs |

### AI Crowd Predictions (PR #1)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/predictions/all` | Next-day crowd predictions for all known campus cameras |
| `GET`  | `/api/predictions/:camera` | Next-day crowd predictions for a specific camera |
| `GET`  | `/api/predictions/analytics/metrics` | Model performance & accuracy metrics summary |
| `GET`  | `/api/predictions/analytics/backtest` | Historical backtest evaluation dataset |

### Health Checks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/health` (Backend) | Backend service health check |
| `GET`  | `/health` (AI) | AI detection service health check |
| `GET`  | `/health` (ML) | ML predictor service health check |

---

## 🎥 AI Service — Video Streaming

The AI service exposes MJPEG video streams for annotated live feed display in the Control Room:

```
GET http://localhost:5001/video_feed/<cam_id>
```

Shows bounding boxes around detected persons, adaptive density grids, and real-time crowd counts.

---

## 🗺️ Monitored Campus Locations

The system monitors **20 campus zones** at PDPM IIITDM Jabalpur:

`Entrance` · `Admin` · `PHC` · `CC` · `LHTC` · `CL` · `Hex` · `OAT` · `SAC` · `H1` · `H3` · `H4` · `PA` · `PB` · `N` · `M` · `Mess` · `Nescafe` · `ATM` · `Visitor_Hostel`

---

## 📋 User Roles & Permissions

| Role | Capabilities |
|------|-------------|
| **Control Room** (`control`) | Full access: live streams, IP Camera Management, threshold settings, analytics, predictions, receives security uploads |
| **Security** (`security`) | Live stats, spatial heatmap, image upload & analysis with zone dropdown, historical data viewer |
| **Public View** (`public`) | Read-only live stats, chart analytics, spatial heatmap, and AI predictions (no login required) |

---

## 📄 License

Developed as part of a course project at **PDPM IIITDM Jabalpur**.
