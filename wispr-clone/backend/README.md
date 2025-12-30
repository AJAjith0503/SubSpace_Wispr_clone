# WISPR Clone Backend Services

This directory contains the backend services required for the advanced features: **Speaker Identification** and **Voice Enrollment**.

## Prerequisites
- Node.js (v18+)
- Python (3.9+)

## 1. Python Identity Service
This service uses `id` (mocked or real) to generate voice embeddings and match speakers.

### Setup
```bash
cd backend/python_service
pip install -r requirements.txt
```
*Note: If `resemblyzer` or `torch` fails to install, the service will automatically fallback to MOCK MODE, returning random IDs for demonstration.*

### Run
```bash
python main.py
# Runs on http://localhost:8000
```

## 2. Node.js WebSocket Gateway
This intermediary server handles the audio stream, forwards it to Deepgram for text, and creates buffers for the Python service to identify speakers.

### Setup
```bash
cd backend/node_server
npm install
```

### Run
```bash
npm start
# Runs on ws://localhost:3000
```
*Make sure your root `.env` file has `VITE_DEEPGRAM_API_KEY` set.*

## Architecture
1. **React App** streams audio to **Node Server** (ws://localhost:3000).
2. **Node Server**:
   - Streams audio to **Deepgram** (Text & Diarization).
   - Buffers audio (3s chunks) and sends to **Python Service** (`/identify`).
3. **Python Service** compares audio against enrolled database (`embeddings.json`) and returns speaker name.
4. **Node Server** sends both Transcript and Identity events back to React.
