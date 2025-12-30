import { useState, useRef, useEffect } from 'react';
import { Mic, Square, AlertCircle, Loader2 } from 'lucide-react';

/**
 * RealtimeRecorder Component
 * - Manages Microphone AudioContext
 * - Converts Float32 audio to Int16 PCM
 * - Streams to Deepgram WebSocket
 */
export function RealtimeRecorder({ onTranscript, onStatusChange, language }) {
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState(null);

    // Refs for permanent connections across renders
    const socketRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const audioContextRef = useRef(null);
    const processorRef = useRef(null);

    // Stop recording on unmount
    useEffect(() => {
        return () => stopRecording();
    }, []);

    const getApiKey = () => {
        const key = import.meta.env.VITE_DEEPGRAM_API_KEY;
        if (!key || key.includes('your_deepgram_api_key')) {
            throw new Error('Missing API Key');
        }
        return key;
    };

    const startRecording = async () => {
        setError(null);
        try {
            const apiKey = getApiKey();
            const USE_BACKEND = true; // Toggle to switch between Backend and Direct Deepgram

            let url;
            let socket;

            if (USE_BACKEND) {
                // Connect to local Node.js Middleware
                url = 'ws://localhost:3000';
                socket = new WebSocket(url);
            } else {
                // Direct Deepgram Connection
                url = `wss://api.deepgram.com/v1/listen?action=start&encoding=linear16&sample_rate=16000&model=nova-2&language=${language}&diarize=true&punctuate=true`;
                socket = new WebSocket(url, ['token', apiKey]);
            }

            socketRef.current = socket;

            socket.onopen = async () => {
                onStatusChange('recording');
                setIsRecording(true);
                // Start Microphone only after socket is ready to avoid dropped frames
                await startAudioCapture();
            };

            socket.onmessage = (event) => {
                try {
                    let data = JSON.parse(event.data);

                    // Handle Wrapped Backend Messages
                    if (data.type === 'transcript') {
                        data = data.data;
                    } else if (data.type === 'identification') {
                        // Pass ID event to parent if they handle it
                        if (onTranscript) onTranscript(data, true, 'identity');
                        return;
                    }

                    if (data.channel && data.channel.alternatives[0]) {
                        const alternative = data.channel.alternatives[0];
                        if (alternative.transcript) {
                            // Send full alternative to parent to handle diarization
                            if (onTranscript) {
                                onTranscript({
                                    transcript: alternative.transcript,
                                    words: alternative.words,
                                    isFinal: data.is_final
                                }, data.is_final);
                            }
                        }
                    }
                } catch (e) {
                    console.error("Error parsing message:", e);
                }
            };

            socket.onclose = () => {
                onStatusChange('idle');
                setIsRecording(false);
            };

            socket.onerror = (error) => {
                console.error("Socket Error:", error);
                // If backend fails, we might want to suggest running it, but for now just error.
                setError("Connection failed. Ensure Backend is running (see README).");
                stopRecording();
            };

        } catch (err) {
            console.error(err);
            setError(err.message || "Failed to start recording");
            onStatusChange('idle');
        }
    };

    const startAudioCapture = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            // Create Audio Context
            const audioContext = new AudioContext({ sampleRate: 16000 });
            audioContextRef.current = audioContext;

            const source = audioContext.createMediaStreamSource(stream);

            // ScriptProcessor is deprecated but widely supported for raw access. 
            // AudioWorklet is better but more complex for a single file demo.
            // We use a buffer size of 4096.
            const processor = audioContext.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
                if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) return;

                const inputData = e.inputBuffer.getChannelData(0);
                // Convert Float32 to Int16 PCM
                const pcmData = floatTo16BitPCM(inputData);
                socketRef.current.send(pcmData);
            };

            source.connect(processor);
            processor.connect(audioContext.destination);

        } catch (err) {
            setError("Microphone access denied.");
            stopRecording();
        }
    };

    const stopRecording = () => {
        // 1. Stop Microphone
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }

        // 2. Stop Processor
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }

        if (audioContextRef.current) {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }

        // 3. Close Socket (sends remaining data automatically if handled, but we force close)
        if (socketRef.current) {
            if (socketRef.current.readyState === WebSocket.OPEN) {
                // Send a close frame (Deepgram recommendation to finish strict processing)
                socketRef.current.send(JSON.stringify({ type: 'CloseStream' }));
                socketRef.current.close();
            }
            socketRef.current = null;
        }

        setIsRecording(false);
        onStatusChange('idle');
    };

    const floatTo16BitPCM = (input) => {
        const output = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        return output.buffer;
    };

    return (
        <div className="recorder-controls">
            {error && (
                <div className="error-badge">
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {!isRecording ? (
                <button className="btn-primary" onClick={startRecording}>
                    <Mic size={20} /> Start Recording
                </button>
            ) : (
                <button className="btn-danger" onClick={stopRecording}>
                    <Square size={20} fill="currentColor" /> Stop Recording
                </button>
            )}

            <style>{`
        .recorder-controls {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 15px;
        }
        
        .btn-primary {
          background-color: var(--primary);
          color: white;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 24px;
        }
        
        .btn-danger {
          background-color: #ef4444;
          color: white;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 24px;
          border: 1px solid rgba(255,255,255,0.1);
        }

        .error-badge {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 10px;
        }
      `}</style>
        </div>
    );
}
