// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

// Disable worker to run in Node.js environment
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = '';

/**
 * Extracts text from a PDF buffer using pdfjs-dist
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
    const data = new Uint8Array(pdfBuffer);

    // Load document
    const loadingTask = pdfjsLib.getDocument({
        data,
        disableFontFace: true, // Disable font faces to avoid canvas dependency
        verbosity: 0 // Suppress info/warnings
    });

    const doc = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= doc.numPages; i++) {
        try {
            const page = await doc.getPage(i);
            const textContent = await page.getTextContent();

            // Map items to strings and join
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');

            fullText += pageText + '\n\n';
        } catch (err) {
            console.warn(`Failed to extract text from page ${i}`, err);
        }
    }

    return fullText;
}
