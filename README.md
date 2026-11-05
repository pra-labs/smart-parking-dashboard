# PraLabs Smart Parking System 🚗🅿️

Live, responsive IoT web dashboard for an ESP32-powered Smart Car Parking System (college/capstone project). Designed for real-time visualization of slot occupancy, available slots, barrier gate telemetry, and automated online/offline health monitoring.

![Next.js](https://img.shields.io/badge/Next.js-16%2B-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?style=flat-square&logo=tailwindcss)
![Vercel Ready](https://img.shields.io/badge/Vercel-Deployment%20Ready-white?style=flat-square&logo=vercel)

---

## 🌟 Key Features

- **Live Real-Time Telemetry**: Auto-polls every 1 second via client-side fetch, updating UI slots without browser reloads.
- **Realistic Bay Layout**:
  - **Slot 01, 02, 03** displayed as parking bays with road divider markings.
  - **Emerald Green**: Available slot with glowing pulses.
  - **Rose / Crimson Red**: Occupied slot with car silhouette and ping indicators.
- **Gate Barrier Telemetry**: Real-time status badge (`OPEN`, `CLOSED`, `FULL`, or `IDLE`).
- **ESP32 Connectivity Pill**: Displays `🟢 ESP32 Connected` when pings are fresh, and flips to `🔴 ESP32 Offline (>10s)` if the microcontroller disconnects or stops sending heartbeats.
- **Interactive Demo Controller**: Floating sticky bottom bar allowing manual toggling of individual slots and gate status directly from the browser for presentations and hardware debugging.

---

## 🚀 Instant Deployment on Vercel

### Option 1: Vercel CLI (Fastest)

```bash
cd smart-parking-dashboard
npx vercel
```
Follow the interactive prompts to link and deploy to production:
```bash
npx vercel --prod
```

### Option 2: Push to GitHub & 1-Click Deploy

1. Create a repository on GitHub (under `pra-labs`):
   ```bash
   cd smart-parking-dashboard
   git add .
   git commit -m "feat: complete ESP32 smart parking dashboard with live API and demo controls"
   git branch -M main
   git remote add origin https://github.com/pra-labs/smart-parking-dashboard.git
   git push -u origin main
   ```
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Keep default settings (`Framework Preset: Next.js`) and click **Deploy**.

---

## 📡 API Reference & Testing

### 1. Send Telemetry from ESP32 (`POST /api/parking`)

**Endpoint**:
```http
POST /api/parking
Content-Type: application/json
```

**JSON Payload**:
```json
{
  "s1": true,
  "s2": false,
  "s3": false,
  "free": 2,
  "gate": "OPEN"
}
```

#### Test via `curl`:
```bash
curl -X POST "http://localhost:3000/api/parking" \
  -H "Content-Type: application/json" \
  -d '{"s1": true, "s2": false, "s3": true, "free": 1, "gate": "OPEN"}'
```
*(Replace `http://localhost:3000` with your deployed Vercel domain, e.g. `https://smart-parking-dashboard.vercel.app/api/parking`)*

**Response**:
```json
{
  "status": "success",
  "message": "Parking state updated",
  "received": {
    "s1": true,
    "s2": false,
    "s3": true,
    "free": 1,
    "gate": "OPEN"
  },
  "timestamp": 1793872813389
}
```

---

### 2. Query Parking State (`GET /api/parking`)

**Endpoint**:
```http
GET /api/parking
```

#### Test via `curl`:
```bash
curl -s http://localhost:3000/api/parking
```

**Response**:
```json
{
  "status": "success",
  "totalCapacity": 3,
  "slots": {
    "s1": true,
    "s2": false,
    "s3": true
  },
  "free": 1,
  "occupied": 2,
  "gate": "OPEN",
  "lastUpdated": 1793872813389,
  "elapsedSeconds": 2,
  "device": {
    "online": true,
    "statusText": "ESP32 Online",
    "thresholdSeconds": 10
  }
}
```

---

## 🔌 ESP32 / Arduino C++ Code Snippet (HTTP POST)

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "https://<your-vercel-domain>.vercel.app/api/parking";

void sendParkingTelemetry(bool s1, bool s2, bool s3, const char* gate) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<200> doc;
    doc["s1"] = s1;
    doc["s2"] = s2;
    doc["s3"] = s3;
    doc["gate"] = gate;

    String requestBody;
    serializeJson(doc, requestBody);

    int httpResponseCode = http.POST(requestBody);
    Serial.print("HTTP Response code: ");
    Serial.println(httpResponseCode);
    http.end();
  }
}
```

---

## 🛠️ Local Development

```bash
# Clone and enter directory
cd smart-parking-dashboard

# Install dependencies
npm install

# Run development server
npm run dev

# Run production build check
npm run build
```
Visit `http://localhost:3000` to view the live dashboard.
