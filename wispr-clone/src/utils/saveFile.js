/**
 * Saves the provided transcript to a text file.
 * Detects if running in Tauri (Desktop) or Browser (Web) and handles accordingly.
 * @param {string} transcript - The text to be saved.
 */
export async function saveTranscript(transcript) {
    try {
        // Check if running in a Tauri environment
        // Note: In Tauri v2, we can check specific internals or just attempt the import
        if (window.__TAURI_INTERNALS__) {
            const { save } = await import('@tauri-apps/plugin-dialog');
            const { writeTextFile } = await import('@tauri-apps/plugin-fs');

            const filePath = await save({
                filters: [{
                    name: 'Text',
                    extensions: ['txt']
                }],
                defaultPath: 'transcript.txt',
            });

            if (filePath) {
                await writeTextFile(filePath, transcript);
                return filePath;
            }
            return null;
        } else {
            throw new Error('Web Environment');
        }
    } catch (error) {
        console.log('Falling back to browser download:', error);
        // Browser Fallback: Create a blob and trigger download
        const blob = new Blob([transcript], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'transcript.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return 'downloaded-in-browser';
    }
}
