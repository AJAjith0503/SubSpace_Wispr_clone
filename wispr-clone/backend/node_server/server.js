const WebSocket = require('ws');
const fs = require('fs');
const http = require('http');
const axios = require('axios');
const FormData = require('form-data');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
require('dotenv').config({ path: '../../.env' }); // Load from root .env

/**
 * CONFIGURATION
 */
const PYTHON_SERVICE_URL = 'http://localhost:8000';
const WS_PORT = 3000;
const DEEPGRAM_API_KEY = process.env.VITE_DEEPGRAM_API_KEY;

if (!DEEPGRAM_API_KEY) {
    console.error("Deepgram API Key missing from .env (VITE_DEEPGRAM_API_KEY)");
    process.exit(1);
}

/**
 * STATE
 */
// Map to track active Deepgram connections per client
const clients = new Map();

const wss = new WebSocket.Server({ port: WS_PORT });

console.log(`Node.js WebSocket Server running on port ${WS_PORT}`);

wss.on('connection', (ws) => {
    console.log('Client connected');

    // 1. Setup Deepgram Connection
    const deepgram = createClient(DEEPGRAM_API_KEY);
    let keepAlive;
    let audioBuffer = []; // Buffer for raw audio to send to Python for ID
    let lastIdentifyTime = Date.now();
    let currentSpeakerMap = new Map(); // speakerId (0,1) -> identifiedName ("John")

    const dgConnection = deepgram.listen.live({
        model: "nova-2",
        language: "en-US",
        smart_format: true,
        diarize: true,
        punctuate: true,
        encoding: "linear16",
        sample_rate: 16000,
    });

    // 2. Handle Deepgram Events
    dgConnection.on(LiveTranscriptionEvents.Open, () => {
        console.log("Connected to Deepgram");

        // KeepAlive logic
        keepAlive = setInterval(() => {
            if (dgConnection.getReadyState() === 1) { // 1 = OPEN
                dgConnection.keepAlive();
            }
        }, 10000);
    });

    dgConnection.on(LiveTranscriptionEvents.Transcript, (data) => {
        // Forward transcript to React Client
        // We enrich it with our local speaker mapping
        const enrichedData = enrichTranscriptWithIdentity(data, currentSpeakerMap);
        ws.send(JSON.stringify({ type: 'transcript', data: enrichedData }));
    });

    dgConnection.on(LiveTranscriptionEvents.Close, () => {
        console.log("Deepgram connection closed");
        clearInterval(keepAlive);
    });

    dgConnection.on(LiveTranscriptionEvents.Error, (err) => {
        console.error("Deepgram error:", err);
    });

    // 3. Handle Client Messages (Audio + Control)
    ws.on('message', async (message) => {
        // Assume binary message is audio (Int16 PCM)
        if (Buffer.isBuffer(message)) {
            // Send to Deepgram
            if (dgConnection.getReadyState() === 1) {
                dgConnection.send(message);
            }

            // Buffer for Python Identification
            audioBuffer.push(message);

            // Every 3 seconds, try to identify
            if (Date.now() - lastIdentifyTime > 3000) {
                lastIdentifyTime = Date.now();
                const bufferPayload = Buffer.concat(audioBuffer);
                audioBuffer = []; // Clear buffer

                identifySpeaker(bufferPayload).then((result) => {
                    if (result && result.speaker !== 'Unknown') {
                        console.log("Identified:", result);
                        // In a real app, we need to correlate this identification 
                        // with the ACTIVE Deepgram speaker. 
                        // Ideally, we check who Deepgram said was speaking recently.
                        // For this demo, let's just broadcast the Identity Event.
                        ws.send(JSON.stringify({
                            type: 'identification',
                            speaker: result.speaker,
                            confidence: result.confidence
                        }));

                        // Heuristic: Map the most probable speaker to the active diarized label?
                        // This is complex without precise timestamp alignment.
                        // We will let Frontend handle the "Current Speaker" UI update.
                    }
                });
            }
        } else {
            // Text message (control)
            try {
                const msg = JSON.parse(message);
                if (msg.type === 'close') {
                    dgConnection.finish();
                }
            } catch (e) {
                // Ignore
            }
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        if (keepAlive) clearInterval(keepAlive);
        dgConnection.finish();
    });
});

/**
 * Helper: Identify Speaker via Python Service
 */
async function identifySpeaker(pcmBuffer) {
    try {
        // Python expects a file upload. We need to convert PCM to WAV headers or just send raw if Python handles it.
        // resemblyzer uses librosa/audioread usually, which prefers WAV.
        // We'll wrap PCM in a WAV header.
        const wavBuffer = createWavHeader(pcmBuffer);

        const form = new FormData();
        form.append('file', wavBuffer, { filename: 'chunk.wav', contentType: 'audio/wav' });

        const response = await axios.post(`${PYTHON_SERVICE_URL}/identify`, form, {
            headers: { ...form.getHeaders() }
        });

        return response.data;
    } catch (error) {
        // console.error("Identity Service Error (is Python running?):", error.message);
        return null;
    }
}

function enrichTranscriptWithIdentity(data, map) {
    // Pass through for now
    return data;
}

/**
 * Utility: Create WAV Header for valid file upload
 */
function createWavHeader(pcmData) {
    const numChannels = 1;
    const sampleRate = 16000;
    const bitsPerSample = 16;
    const blockAlign = numChannels * bitsPerSample / 8;
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmData.length;
    const fileSize = 36 + dataSize;

    const buffer = Buffer.alloc(44);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(fileSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    return Buffer.concat([buffer, pcmData]);
}
