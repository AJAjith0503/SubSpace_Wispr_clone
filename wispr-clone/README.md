# WISPR Clone - Real-Time Voice Transcription

A production-ready desktop application for real-time speech-to-text transcription suitable for high-performance usage. Built with **Tauri v2**, **React**, and **Deepgram**.

## 🚀 Key Features

### 🎙 Real-Time Transcription
Uses native **WebSockets** to stream raw audio data (16-bit PCM) directly to Deepgram's API. This ensures significantly lower latency compared to REST-based approaches.
- **Architecture**: `AudioContext` -> `ScriptProcessor` -> `Int16 Conversion` -> `WebSocket` -> `Deepgram`.

### 🌍 Multi-Language Support
Dynamic language switching without reloading.
- Supported: English, Hindi, Spanish, French.
- **Implementation**: Reconfigures the WebSocket connection parameters instantly when the user selects a new language.

### 💾 Native File Saving
Uses Tauri's strictly typed Rust-based file system APIs to securely save transcripts to the local disk.
- **Security Check**: The app asks for a system directory via the native OS dialog, ensuring the user is always in control of where files are written.

---

## 🛠 Architecture & Decisions

### Why WebSockets over REST?
REST APIs require recording an entire chunk (blob), stopping, and uploading. This creates a "record-then-wait" UX.
WebSockets allow **streaming audio**, meaning words appear on screen *while* the user is still speaking.

### Why 16-bit PCM?
Browsers capture audio in 32-bit Float. Deepgram (and most ASR engines) process 16-bit Integer PCM most efficiently.
We implemented a custom `floatTo16BitPCM` converter in the frontend to minimize bandwidth and processing overhead on the server.

### Why Tauri?
- **Memory Efficiency**: Uses the OS's native webview (WebView2 on Windows) instead of bundling Chrome (Electron).
- **Security**: Strict permission system prevents unauthorized file system access.
- **Rust Backend**: Provides near-native performance for heavy tasks.

---

## 📦 Setup & Installation

### Prerequisites
1.  **Node.js** (v18+)
2.  **Rust** (Latest Stable)
3.  **Visual Studio C++ Build Tools** (Required on Windows for the Linker)
    *   *Note: If you see `logging error: linker link.exe not found`, please install the C++ workload in VS Build Tools.*

### Steps
1.  **Clone & Install**
    ```bash
    npm install
    ```

2.  **Configure API Key**
    Create a `.env` file in the root:
    ```env
    VITE_DEEPGRAM_API_KEY=your_deepgram_key_here
    ```

3.  **Run Development Mode**
    ```bash
    npm run tauri dev
    ```

4.  **Build for Production**
    ```bash
    npm run tauri build
    ```

---

## 📝 Tech Stack Details

| Component | Technology | Reason |
|-----------|------------|--------|
| **Frontend** | React + Vite | Fast HMR, Component-based architecture. |
| **Desktop Shell** | Tauri (Rust) | Lightweight, Secure native integration. |
| **Audio** | AudioContext API | Low-level raw audio access. |
| **API** | Deepgram WebSocket | Lowest latency ASR model (Nova-2). |
| **Icons** | Lucide React | Clean, consistent SVG iconography. |

---

## 🎯 Interview Talking Points

**"How did you handle the real-time audio stream?"**
> "I bypassed the higher-level MediaRecorder API in favor of the AudioContext API. This gave me access to the raw audio buffer (Float32). I converted this buffer to Int16 PCM in real-time and piped it through a persistent WebSocket connection to Deepgram. This reduces latency to milliseconds compared to blob-based uploads."

**"How did you secure the application?"**
> "I leveraged Tauri's capability system. Instead of allowing generic FS access, I only whitelisted specific plugins (`dialog`, `fs`) and ensured that file writing is strictly initiated by a user action (File Dialog), prohibiting background file manipulation."

