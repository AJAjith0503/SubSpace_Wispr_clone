export async function transcribeAudio(audioBlob) {
    const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;

    if (!apiKey || apiKey === 'your_deepgram_api_key_here') {
        throw new Error('Deepgram API Key is missing. Please add it to your .env file.');
    }

    try {
        const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
            method: 'POST',
            headers: {
                'Authorization': `Token ${apiKey}`,
                'Content-Type': audioBlob.type || 'audio/webm',
            },
            body: audioBlob,
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to transcribe audio');
        }

        const data = await response.json();

        // Extract transcript
        const transcript = data.results?.channels[0]?.alternatives[0]?.transcript;
        return transcript || '';
    } catch (error) {
        console.error('Transcription error:', error);
        throw error;
    }
}
