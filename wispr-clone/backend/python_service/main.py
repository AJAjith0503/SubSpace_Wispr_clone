
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
import uvicorn
import numpy as np
import os
import json
from typing import List, Optional
import sys

# Mock Resemblyzer if not available (for demonstration/no-gpu environments)
try:
    from resemblyzer import VoiceEncoder, preprocess_wav
    print("Resemblyzer loaded successfully.")
    MOCK_MODE = False
except ImportError:
    print("Resemblyzer not found. Running in MOCK MODE.")
    MOCK_MODE = True
    class VoiceEncoder:
        def embed_speaker(self, wav):
            return np.random.rand(256) # Mock embedding
    def preprocess_wav(f):
        return f 

app = FastAPI(title="Voice Identification Service")

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all haders
)

# Global State
encoder = VoiceEncoder()
EMBEDDINGS_FILE = "embeddings.json"
voice_db = {} # { "john": [embedding_list], "jane": ... }

class IdentityResponse(BaseModel):
    speaker: str
    confidence: float

def load_db():
    global voice_db
    if os.path.exists(EMBEDDINGS_FILE):
        try:
            with open(EMBEDDINGS_FILE, 'r') as f:
                data = json.load(f)
                # Convert list back to numpy arrays
                voice_db = {k: [np.array(e) for e in v] for k, v in data.items()}
        except Exception as e:
            print(f"Error loading DB: {e}")

def save_db():
    # Convert numpy arrays to lists for JSON serialization
    serialized = {k: [e.tolist() for e in v] for k, v in voice_db.items()}
    with open(EMBEDDINGS_FILE, 'w') as f:
        json.dump(serialized, f)

# Load DB on startup
load_db()

@app.post("/enroll")
async def enroll_speaker(name: str = Form(...), file: UploadFile = File(...)):
    """
    Enroll a new speaker.
    Accepts an audio file (wav/mp3) and a name.
    """
    try:
        if MOCK_MODE:
            # Mock enrollment
            embedding = np.random.rand(256)
        else:
            # Save temp file
            temp_filename = f"temp_{file.filename}"
            with open(temp_filename, "wb") as buffer:
                buffer.write(await file.read())
            
            # Process
            wav = preprocess_wav(temp_filename)
            embedding = encoder.embed_speaker(wav)
            
            # Cleanup
            os.remove(temp_filename)

        if name not in voice_db:
            voice_db[name] = []
        voice_db[name].append(embedding)
        save_db()
        
        return {"status": "success", "message": f"Enrolled {name}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/identify")
async def identify_speaker(file: UploadFile = File(...)):
    """
    Identify the speaker in the provided audio clip.
    """
    if not voice_db:
        return {"speaker": "Unknown", "confidence": 0.0}

    try:
        if MOCK_MODE:
            query_embedding = np.random.rand(256)
        else:
             # Save temp file
            temp_filename = f"query_{file.filename}"
            with open(temp_filename, "wb") as buffer:
                buffer.write(await file.read())
            
            wav = preprocess_wav(temp_filename)
            query_embedding = encoder.embed_speaker(wav)
            os.remove(temp_filename)

        # Compare with DB
        best_score = -1.0
        best_match = "Unknown"

        for name, embeddings in voice_db.items():
            # Get average similarity to user's enrolled samples
            # Cosine similarity
            for enrolled_emb in embeddings:
                similarity = np.dot(query_embedding, enrolled_emb) / (np.linalg.norm(query_embedding) * np.linalg.norm(enrolled_emb))
                if similarity > best_score:
                    best_score = similarity
                    best_match = name
        
        # Threshold
        if best_score < 0.70: # Tuning parameter
            best_match = "Unknown"

        return {"speaker": best_match, "confidence": float(best_score)}

    except Exception as e:
        print(f"Identification Error: {e}")
        return {"speaker": "Error", "confidence": 0.0}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
