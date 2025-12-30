import { useState, useRef } from 'react';
import { Mic, Square, Save, Loader2, UserPlus } from 'lucide-react';

export function VoiceEnrollment() {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [name, setName] = useState('');
    const [status, setStatus] = useState('idle'); // idle | recording | uploading | success | error
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
                setAudioBlob(blob);
                stream.getTracks().forEach(t => t.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            setStatus('recording');
        } catch (e) {
            console.error(e);
            setStatus('error');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setStatus('idle');
        }
    };

    const handleEnroll = async () => {
        if (!audioBlob || !name) return;
        setStatus('uploading');

        const formData = new FormData();
        formData.append('name', name);
        formData.append('file', audioBlob, 'enrollment.wav');

        try {
            const res = await fetch('http://localhost:8000/enroll', {
                method: 'POST',
                body: formData,
            });

            if (res.ok) {
                setStatus('success');
                setTimeout(() => {
                    setStatus('idle');
                    setAudioBlob(null);
                    setName('');
                }, 2000);
            } else {
                throw new Error('Enrollment failed');
            }
        } catch (e) {
            console.error(e);
            setStatus('error');
        }
    };

    return (
        <div className="enrollment-card">
            <h3><UserPlus size={20} /> New Voice Profile</h3>

            <div className="input-group">
                <label>Speaker Name</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. John Doe"
                    disabled={isRecording || status === 'uploading'}
                />
            </div>

            <div className="action-area">
                {!isRecording ? (
                    !audioBlob ? (
                        <button className="btn-secondary" onClick={startRecording}>
                            <Mic size={16} /> Record Sample (5s)
                        </button>
                    ) : (
                        <div className="review-area">
                            <audio src={URL.createObjectURL(audioBlob)} controls className="audio-preview" />
                            <div className="review-actions">
                                <button className="btn-text" onClick={() => setAudioBlob(null)}>Retake</button>
                                <button className="btn-primary" onClick={handleEnroll} disabled={!name}>
                                    {status === 'uploading' ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                                    Save Profile
                                </button>
                            </div>
                        </div>
                    )
                ) : (
                    <button className="btn-danger" onClick={stopRecording}>
                        <Square size={16} fill="currentColor" /> Stop
                    </button>
                )}
            </div>

            {status === 'success' && <div className="success-msg">Profile Created!</div>}
            {status === 'error' && <div className="error-msg">Error connecting to ID Service</div>}

            <style>{`
        .enrollment-card {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--glass-border);
            border-radius: 12px;
            padding: 1.5rem;
            margin-bottom: 2rem;
        }
        .enrollment-card h3 {
            margin-top: 0;
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 1.1rem;
            color: var(--primary);
        }
        .input-group {
            margin: 1rem 0;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .input-group input {
            background: rgba(0,0,0,0.2);
            border: 1px solid var(--glass-border);
            padding: 10px;
            border-radius: 6px;
            color: white;
            font-size: 1rem;
        }
        .audio-preview {
            width: 100%;
            height: 32px;
            margin-bottom: 10px;
        }
        .review-area {
            width: 100%;
        }
        .review-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }
        .success-msg { color: #4ade80; margin-top: 10px; font-size: 0.9rem; }
        .error-msg { color: #ef4444; margin-top: 10px; font-size: 0.9rem; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
        </div>
    );
}
