import { useState, useRef, useEffect } from 'react';
import { Copy, FileText, Download, Trash2 } from 'lucide-react';
import { RealtimeRecorder } from './components/RealtimeRecorder';
import { LanguageSelector } from './components/LanguageSelector';
import { VoiceEnrollment } from './components/VoiceEnrollment';
import { saveTranscript } from './utils/saveFile';

function App() {
  const [status, setStatus] = useState('idle'); // idle | recording
  const [segments, setSegments] = useState([]); // Array of { speaker: number, text: string }
  const [speakerMap, setSpeakerMap] = useState({}); // { 0: 'John', 1: 'Jane' }
  const [language, setLanguage] = useState('en');
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);
  const [showEnrollment, setShowEnrollment] = useState(false);

  // Real-time updates need to append to the previous state.
  // However, Deepgram sends both partials and finals.
  // We will collect "Final" parts into a buffer state, and show "Interim" in a temp state.
  // For simplicity implementation: we will just append text as it flows in this MVP.
  // Ideally: Use a reducer to handle { is_final: true } correctly.

  // Handle incoming transcript data
  // Handle incoming transcript data
  const handleTranscript = (data, isFinalOrFlag, type) => {
    // 1. Handle Identification Events
    if (type === 'identity') {
      const { speaker, confidence } = data;
      if (speaker !== 'Unknown' && confidence > 0.6) {
        // Heuristic: Assign this identity to the most recent speaker seen
        // In a perfect world, we have IDs match. Deepgram uses ints (0,1).
        // We assume the active speaker is the one identified.
        // We can't map 'John' to '0' easily without more data from Backend.
        // DEMO HACK: If we get "John", find the last "Unknown" segment and label it?
        // OR: Just label the last active numeric speaker as this name.

        // Let's assume the ID service result corresponds to the currently talking Deepgram speaker.
        // We need to know who is talking NOW.
        // We will check the last added segment.
        setSegments(prev => {
          if (prev.length === 0) return prev;
          const lastSeg = prev[prev.length - 1];
          const speakerId = lastSeg.speaker;

          // Update map: 0 -> John
          setSpeakerMap(m => ({ ...m, [speakerId]: speaker })); // This might trigger re-renders
          return prev;
        });
      }
      return;
    }

    // 2. Handle Transcript
    const { words, isFinal, transcript } = data;

    // We only process final results to ensure stable speaker diarization
    if (!isFinalOrFlag) return;

    if (words && words.length > 0) {
      setSegments(prev => {
        const newSegments = [...prev];
        let lastSegment = newSegments.length > 0 ? { ...newSegments[newSegments.length - 1] } : null;

        const incomingSegments = [];
        let currentLoopSegment = null;

        words.forEach(word => {
          const speaker = word.speaker !== undefined ? word.speaker : 'Unknown';
          const content = word.punctuated_word || word.word;

          if (currentLoopSegment && currentLoopSegment.speaker === speaker) {
            currentLoopSegment.text += ' ' + content;
          } else {
            currentLoopSegment = { speaker, text: content };
            incomingSegments.push(currentLoopSegment);
          }
        });

        if (incomingSegments.length === 0) return prev;

        // Merge first new segment with the last existing segment if speaker matches
        if (lastSegment && lastSegment.speaker === incomingSegments[0].speaker) {
          lastSegment.text += ' ' + incomingSegments[0].text;
          newSegments[newSegments.length - 1] = lastSegment;
          return [...newSegments, ...incomingSegments.slice(1)];
        } else {
          return [...newSegments, ...incomingSegments];
        }
      });
    } else if (transcript) {
      // Fallback for cases where words array is missing but transcript exists
      setSegments(prev => [...prev, { speaker: 'Unknown', text: transcript }]);
    }
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear the transcript?')) {
      setSegments([]);
    }
  };

  const getFormattedTranscript = () => {
    return segments.map(s => {
      const name = speakerMap[s.speaker] ? `${speakerMap[s.speaker]} (Speaker ${s.speaker})` : `Speaker ${s.speaker}`;
      return `${name}: ${s.text}`;
    }).join('\n\n');
  };

  const handleSave = async () => {
    if (segments.length === 0) return;
    try {
      await saveTranscript(getFormattedTranscript());
      alert('Transcript saved successfully!');
    } catch (error) {
      // Error handled in util or canceled
    }
  };

  const copyToClipboard = () => {
    if (segments.length > 0) {
      navigator.clipboard.writeText(getFormattedTranscript());
      setShowCopyFeedback(true);
      setTimeout(() => setShowCopyFeedback(false), 2000);
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>WISPR Clone</h1>
        <p className="subtitle">Real-time Voice Transcription</p>
      </header>

      <main className="card">
        {/* Top Controls: Language */}
        <div className="controls-row">
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <LanguageSelector
              selectedLanguage={language}
              onLanguageChange={setLanguage}
              disabled={status === 'recording'}
            />
            <button className="btn-small" onClick={() => setShowEnrollment(!showEnrollment)}>
              {showEnrollment ? 'Hide Enrollment' : 'Enroll New Voice'}
            </button>
          </div>

          <div className={`status-indicator ${status}`}>
            <div className="dot"></div>
            {status === 'recording' ? 'Live Listening' : 'Ready'}
          </div>
        </div>

        {showEnrollment && <VoiceEnrollment />}

        {/* Recorder Action */}
        <RealtimeRecorder
          onTranscript={handleTranscript}
          onStatusChange={setStatus}
          language={language}
        />

        {/* Transcript Area */}
        <div className="transcript-area">
          <div className="transcript-header">
            <span>Transcript</span>
            <div className="actions">
              {segments.length > 0 && (
                <>
                  <button onClick={handleClear} title="Clear" className="icon-btn">
                    <Trash2 size={16} />
                  </button>
                  <button onClick={copyToClipboard} title="Copy" className="icon-btn">
                    {showCopyFeedback ? 'Copied' : <Copy size={16} />}
                  </button>
                  <button onClick={handleSave} title="Save to File" className="icon-btn primary-icon">
                    <Download size={16} />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="transcript-content">
            {segments.length > 0 ? (
              <div className="segments-container">
                {segments.map((seg, idx) => (
                  <div key={idx} className="segment">
                    <div className="speaker-label">
                      {speakerMap[seg.speaker]
                        ? <span className="identified-speaker">{speakerMap[seg.speaker]} <span style={{ opacity: 0.5, fontSize: '0.8em' }}>#{seg.speaker}</span></span>
                        : `Speaker ${seg.speaker}`
                      }
                    </div>
                    <div className="segment-text">{seg.text}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="placeholder">
                Words will appear here as you speak...
              </div>
            )}
            {status === 'recording' && <span className="cursor">|</span>}
          </div>
        </div>
      </main>

      <style>{`
        .app-container {
          padding: 2rem;
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        header h1 {
          margin: 0;
          font-size: 2.5rem;
          background: linear-gradient(to right, #fff, #a1a1aa);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .subtitle {
          color: var(--text-muted);
          margin-top: 0.5rem;
        }

        .controls-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.9rem;
          font-weight: 500;
          color: var(--text-muted);
        }

        .status-indicator.recording { color: #ef4444; }
        .status-indicator .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: currentColor;
        }
        .status-indicator.recording .dot {
          animation: pulse 1.5s infinite;
        }

        .transcript-area {
          background: rgba(0,0,0,0.3);
          border-radius: 12px;
          border: 1px solid var(--glass-border);
          min-height: 300px;
          display: flex;
          flex-direction: column;
          margin-top: 2rem;
          overflow: hidden;
        }

        .transcript-header {
          padding: 12px 16px;
          background: rgba(255,255,255,0.03);
          border-bottom: 1px solid var(--glass-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: var(--text-muted);
          font-size: 0.9rem;
          font-weight: 500;
        }

        .segments-container {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .segment {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .speaker-label {
          color: var(--primary);
          font-size: 0.85rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .segment-text {
          color: #e4e4e7;
          font-size: 1.1rem;
          line-height: 1.6;
        }

        .btn-small {
            background: rgba(255,255,255,0.1);
            border: 1px solid var(--glass-border);
            color: white;
            padding: 6px 12px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.85rem;
        }
        .btn-small:hover { background: rgba(255,255,255,0.2); }
        .identified-speaker { color: #4ade80; }

        .transcript-content {
          padding: 20px;
          flex-grow: 1;
          text-align: left;
          font-size: 1.1rem;
          line-height: 1.6;
          white-space: pre-wrap;
          max-height: 400px;
          overflow-y: auto;
        }

        .placeholder {
          color: rgba(255,255,255,0.2);
          font-style: italic;
        }

        .actions {
          display: flex;
          gap: 8px;
        }

        .icon-btn {
          background: transparent;
          border: 1px solid var(--glass-border);
          color: var(--text-muted);
          padding: 6px;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: none;
        }

        .icon-btn:hover {
          background: rgba(255,255,255,0.05);
          color: white;
        }

        .primary-icon {
          color: var(--primary);
          border-color: var(--primary);
          background: rgba(100, 108, 255, 0.1);
        }
        
        .cursor {
          display: inline-block;
          width: 2px;
          height: 1.2em;
          background-color: var(--primary);
          margin-left: 2px;
          vertical-align: middle;
          animation: blink 1s step-end infinite;
        }

        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}

export default App;
