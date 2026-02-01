
import * as fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');

async function testParse() {
    console.log("Reading file...");
    const buffer = fs.readFileSync('test-policy.pdf');
    const data = new Uint8Array(buffer);

    console.log("Loading document with PDF.js...");
    const loadingTask = pdfjs.getDocument({
        data: data,
        useSystemFonts: true,
        disableFontFace: true,
    });

    try {
        const pdf = await loadingTask.promise;
        console.log(`PDF Loaded. Pages: ${pdf.numPages}`);

        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const strings = content.items.map((item: any) => item.str);
            fullText += strings.join(" ") + "\n";
            console.log(`Page ${i} processed.`);
        }

        console.log("Success! Extracted text length:", fullText.length);
        console.log("Review Sample:", fullText.substring(0, 200));

    } catch (e) {
        console.error("Parse Error:", e);
    }
}

testParse();
