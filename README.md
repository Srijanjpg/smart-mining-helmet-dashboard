# 🦺 Smart Mining Helmet - Real-time Safety Monitoring System

![Dashboard Screenshot](./Untitled.jpg)

> A comprehensive IoT-based safety monitoring system for mining operations that tracks environmental hazards and miner health in real-time using an Arduino-based smart helmet with multi-sensor integration and cloud dashboarding.

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Features](#features)
- [System Architecture](#system-architecture)
- [Hardware Components](#hardware-components)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Arduino Sketches](#arduino-sketches)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Project Overview

**Smart Mining Helmet** is an advanced safety system designed for mining operations. It continuously monitors:

- **Environmental Hazards**: Oxygen levels, CO2, CO, Methane, and H2S gas concentrations
- **Miner Health**: Heart rate, temperature, and humidity
- **Location Tracking**: GPS coordinates for emergency rescue operations
- **Physical Safety**: Obstacle detection using ultrasonic sensors
- **Real-time Alerts**: Immediate notifications when hazardous conditions are detected

The system consists of three main components:
1. **Arduino-based Hardware** - Sensor data collection via ESP32 microcontroller
2. **Backend Server** - Express.js API with SQLite database for data persistence
3. **Web Dashboard** - React-based real-time monitoring interface with data visualization

---

## ⭐ Features

### Core Monitoring
✅ **Real-time Sensor Data Streaming** - Live updates from multiple sensors with 3-second heartbeat
✅ **Multi-gas Detection** - Oxygen, CO2, CO, Methane (CH4), and Hydrogen Sulfide (H2S)
✅ **Health Monitoring** - Heart rate tracking and temperature monitoring
✅ **GPS Location Tracking** - Real-time miner positioning for rescue operations
✅ **Obstacle Detection** - Ultrasonic sensor for proximity awareness

### Safety & Alerts
✅ **Intelligent Alert System** - Three-tier alerting (Normal, Warning, Danger)
✅ **Auto Audio Alerts** - Audio notifications when dangerous conditions detected
✅ **Alert History** - Stores up to 1000 alerts for historical review
✅ **Threshold-based Triggering** - Customizable gas and health thresholds
✅ **Miner Health Profiles** - Individual health condition tracking

### Rescue Operations
✅ **Emergency Rescue Mode** - Dedicated rescue mission management
✅ **Quick Location Data** - Immediate access to last known miner coordinates
✅ **Mission Logging** - Track all rescue operations with timestamps and hazard levels
✅ **Multi-miner Support** - Support for multiple miners with individual tracking

### Data Management
✅ **Historical Data Storage** - SQLite database with persistent sensor readings
✅ **Trend Analysis** - Hourly averages for pattern detection
✅ **Data Visualization** - Charts and gauges for easy interpretation
✅ **Session Tracking** - Individual work session recording per miner

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Smart Mining Helmet                       │
├──────────────────────┬──────────────────────────────────────┤
│                      │                                        │
│   Arduino/ESP32      │        Backend Infrastructure         │
│   ─────────────────  │        ───────────────────────        │
│                      │                                        │
│  • Oxygen Sensor  ──┬┼─→ Express.js Server (Port 4000)      │
│  • CO2 Sensor     ──┤│    • CORS Enabled                     │
│  • CO Sensor      ──┤│    • Real-time APIs                   │
│  • CH4 Sensor     ──┤│    • WebSocket Support                │
│  • H2S Sensor     ──┤│                                        │
│  • Temp/Humidity  ──┤│    ┌─────────────────┐               │
│  • GPS Module     ──┤│    │  SQLite DB      │               │
│  • Ultrasonic     ──┤│    │ (helmet.db)     │               │
│  • Heart Rate     ──┤│    │                 │               │
│  • Buzzer Audio   ──┤│    │ • miners        │               │
│                      │    │ • sensors       │               │
│                      │    │ • alerts        │               │
│                      │    │ • sessions      │               │
│                      │    │ • rescue_missions
│                      │    └─────────────────┘               │
│                      │                                        │
└──────────────────────┴────────────────┬─────────────────────┘
                                        │
                    ┌───────────────────┴─────────────────────┐
                    │                                           │
            ┌───────▼────────┐              ┌──────────────────▼──┐
            │  Frontend App  │              │  Browser Client     │
            │  (React/Vite)  │              │  (Port 5173)        │
            ├────────────────┤              │                     │
            │ • Dashboard    │◄─────────────│ Real-time Data      │
            │ • Charts       │ REST API     │ Visualization       │
            │ • Alerts Panel │ (Port 4000)  │                     │
            │ • Map View     │              │                     │
            │ • Rescue Mode  │              │                     │
            └────────────────┘              └─────────────────────┘
```

---

## 🔧 Hardware Components

### Microcontroller
- **ESP32** - Main processing unit with WiFi connectivity

### Gas Sensors
| Sensor | Parameter | Range | Model |
|--------|-----------|-------|-------|
| **O₂ Sensor** | Oxygen Level | 0-25% | DFRobot OxygenSensor |
| **CO₂ Sensor** | Carbon Dioxide | 0-5000 ppm | MH-Z19B |
| **CO Sensor** | Carbon Monoxide | 0-1000 ppm | Serial-based |
| **CH₄ Sensor** | Methane | 0-100% LEL | MQ-4 |
| **H₂S Sensor** | Hydrogen Sulfide | 0-100 ppm | MQ-136 |

### Biometric Sensors
- **Heart Rate Sensor** - Pulse monitoring
- **Temperature Sensor** - Environmental & body temperature

### Location & Distance
- **GPS Module** - Geographic positioning
- **Ultrasonic Sensor** - Obstacle detection

### Audio
- **Buzzer** - Audio alert system for critical warnings

---

## 📁 Project Structure

```
smart-mining-helmet/
├── Arduino-sketches/              # Hardware firmware
│   ├── buzzer_code/              # Audio alert control
│   ├── CO_sensor/                # Carbon monoxide sensor interface
│   ├── CO2_sensor/               # Carbon dioxide sensor interface
│   ├── O2_CO/                    # Combined oxygen/CO reading
│   └── oxygen_sensor/            # Oxygen level monitoring
│
├── Dashboard/                     # Web application
│   ├── setup.sh                  # Initial project setup script
│   └── smart-helmet-dashboard/
│       ├── package.json          # Root package configuration
│       │
│       ├── backend/              # Express.js API Server
│       │   ├── package.json
│       │   ├── server.js         # Main server file
│       │   ├── database-schema.md # DB structure documentation
│       │   └── database/
│       │       ├── init.js       # Database initialization
│       │       └── queries.js    # Database query functions
│       │
│       └── frontend/             # React Dashboard Application
│           ├── package.json
│           ├── vite.config.js    # Vite build configuration
│           ├── tailwind.config.js # Tailwind CSS setup
│           ├── postcss.config.js # PostCSS configuration
│           ├── index.html        # Entry HTML
│           └── src/
│               ├── main.jsx      # React entry point
│               ├── App.jsx       # Main app component
│               ├── index.css     # Global styles
│               │
│               ├── pages/        # Page components
│               │   ├── Dashboard.jsx  # Main monitoring dashboard
│               │   └── Rescue.jsx     # Emergency rescue interface
│               │
│               ├── components/   # Reusable UI components
│               │   ├── AlertsPanel.jsx     # Active alerts display
│               │   ├── AudioStatus.jsx     # Audio alert indicator
│               │   ├── ChartsPanel.jsx     # Data visualization
│               │   ├── GaugeCard.jsx       # Circular gauge displays
│               │   ├── HealthPanel.jsx     # Miner health info
│               │   ├── MapView.jsx         # GPS location map
│               │   ├── SensorCard.jsx      # Individual sensor display
│               │   ├── Sidebar.jsx         # Navigation sidebar
│               │   ├── SystemStatus.jsx    # Overall system health
│               │   └── Topbar.jsx          # Header information
│               │
│               ├── hooks/        # Custom React hooks
│               │   └── useRealtimeData.js  # Real-time data streaming
│               │
│               └── utils/        # Utility functions
│                   ├── status.js       # Status calculation logic
│                   └── thresholds.js   # Alert threshold definitions
│
└── README.md                    # This file
```

---

## 📦 Installation

### Prerequisites
- Node.js (v16 or higher)
- npm (v7 or higher)
- Arduino IDE (for uploading sketches to ESP32)

### Backend Setup

```bash
cd Dashboard/smart-helmet-dashboard/backend
npm install
```

**Dependencies:**
- `express` - Web server framework
- `cors` - Cross-Origin Resource Sharing
- `sql.js` - SQLite for JavaScript

### Frontend Setup

```bash
cd Dashboard/smart-helmet-dashboard/frontend
npm install
```

**Dependencies:**
- `react` - UI library
- `vite` - Build tool
- `tailwindcss` - Utility CSS framework
- `chart.js` & `react-chartjs-2` - Data visualization
- `leaflet` & `react-leaflet` - Map integration

### One-Command Installation

From the root `smart-helmet-dashboard` directory:

```bash
npm run install:all
```

### Arduino/ESP32 Setup

1. Install Arduino IDE from [arduino.cc](https://www.arduino.cc)
2. Add ESP32 board support via Board Manager
3. Upload sketches to ESP32:
   - Navigate to each sketch in `Arduino-sketches/`
   - Select appropriate board and COM port
   - Click Upload

---

## 🚀 Usage

### Start Development Environment

**Backend & Frontend (Concurrent):**
```bash
npm run dev
```

**Backend Only:**
```bash
npm run dev:backend
```
- Server runs on: `http://localhost:4000`

**Frontend Only:**
```bash
npm run dev:frontend
```
- Dashboard runs on: `http://localhost:5173`

### Accessing the Dashboard

1. Ensure backend server is running
2. Open browser to `http://localhost:5173`
3. Dashboard displays:
   - Real-time sensor readings
   - Gas level gauges
   - Health monitoring data
   - Geographic location on map
   - Active alerts panel
   - Historical charts

### Emergency Rescue Mode

1. Click **"Rescue"** button in sidebar
2. System displays:
   - Miner's last known GPS coordinates
   - Current hazard levels
   - Allows logging rescue missions
   - Records hazard assessment data

---

## 📡 API Documentation

### Base URL
```
http://localhost:4000
```

### Endpoints

#### Sensor Data
- **GET** `/api/sensor-readings` - Get historical sensor data
- **POST** `/api/sensor-readings` - Submit new sensor reading

#### Alerts
- **GET** `/api/alerts` - Retrieve alert history
- **POST** `/api/alerts` - Create new alert
- **GET** `/api/alerts/active` - Get currently active alerts

#### Miners
- **GET** `/api/miners` - List all registered miners
- **GET** `/api/miners/:minerId` - Get specific miner details
- **PUT** `/api/miners/:minerId` - Update miner profile
- **POST** `/api/miners/:minerId/session` - Start work session

#### Rescue Operations
- **POST** `/api/rescue-mission` - Create rescue mission
- **GET** `/api/rescue-missions` - Get mission history

#### Trends & Analytics
- **GET** `/api/trends` - Get sensor trend data
- **GET** `/api/hourly-averages` - Get hourly aggregated data

---

## 💾 Database Schema

**Database:** SQLite (helmet.db)

### Main Tables

#### `miners`
Stores miner profiles and health information
```
miner_id (TEXT, PRIMARY KEY)
name (TEXT)
contact_info (TEXT)
health_profile (TEXT)
created_at (TEXT)
updated_at (TEXT)
```

#### `sensors`
Real-time and historical sensor readings
```
id (INTEGER, PRIMARY KEY)
timestamp (TEXT)
miner_id (TEXT, FK)
oxygen (REAL)           # Percentage
co2 (REAL)              # ppm
co (REAL)               # ppm
ch4 (REAL)              # Percentage
h2s (REAL)              # ppm
heart_rate (REAL)       # BPM
temperature (REAL)      # °C
humidity (REAL)         # Percentage
obstacle_distance (REAL) # cm
latitude (REAL)
longitude (REAL)
created_at (TEXT)
```

#### `alerts`
Safety alerts and warnings
```
alert_id (INTEGER, PRIMARY KEY)
timestamp (TEXT)
miner_id (TEXT, FK)
alert_level (TEXT)      # NORMAL, WARNING, DANGER
message (TEXT)
sensor_type (TEXT)
reading_value (REAL)
threshold_value (REAL)
created_at (TEXT)
```

#### `sessions`
Work session tracking
```
session_id (INTEGER, PRIMARY KEY)
miner_id (TEXT, FK)
start_time (TEXT)
end_time (TEXT)
location_city (TEXT)
created_at (TEXT)
```

#### `rescue_missions`
Emergency rescue operations
```
mission_id (INTEGER, PRIMARY KEY)
miner_id (TEXT, FK)
timestamp (TEXT)
latitude (REAL)
longitude (REAL)
gas_hazard_level (TEXT)
status (TEXT)           # ACTIVE, COMPLETED
created_at (TEXT)
```

---

## 📝 Arduino Sketches

### File Descriptions

| Sketch | Purpose |
|--------|---------|
| `buzzer_code.ino` | Controls audio alert buzzer for critical warnings |
| `oxygen_sensor.ino` | Interfaces with DFRobot oxygen sensor via I2C |
| `CO_sensor.ino` | Reads CO levels via serial communication |
| `CO2_sensor.ino` | Interfaces with CO2 sensor module |
| `O2_CO.ino` | Combined sketch for simultaneous O2/CO monitoring |

### Calibration Notes
- **Oxygen Sensor**: Calibrate in fresh air (20.9%) at system startup
- **Gas Sensors**: Require warm-up period of 5-10 seconds
- **All Sensors**: Send readings at configurable intervals (default: 3 seconds)

---

## 🔑 Key Alert Thresholds

| Parameter | Warning Level | Danger Level |
|-----------|---------------|--------------|
| **Oxygen** | < 20.0% | < 19.5% |
| **CO₂** | > 1500 ppm | > 2000 ppm |
| **CO** | > 20 ppm | > 35 ppm |
| **CH₄** | > 0.5% | > 1.0% |
| **H₂S** | > 10 ppm | > 15 ppm |

*Thresholds can be adjusted in `frontend/src/utils/thresholds.js`*

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines
- Follow existing code style
- Add comments for complex logic
- Test changes in development environment
- Update documentation as needed

---

## 📄 License

This project is licensed under the MIT License - see LICENSE file for details.

---

## 📞 Support & Contact

For issues, questions, or suggestions:
- Create an issue in the repository
- Contact the development team

---

## 🙏 Acknowledgments

- DFRobot for oxygen sensor library and documentation
- Arduino and ESP32 communities
- React and Vite ecosystems
- Tailwind CSS for styling framework

---

**Last Updated:** May 3, 2026  
**Version:** 1.0.0
