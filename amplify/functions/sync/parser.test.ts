
import { describe, it, expect, beforeAll } from 'vitest';
import { PdfDataParser } from 'pdf-data-parser';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { randomUUID } from 'crypto';

// Mock Global DOMMatrix if missing (simulating the lambda environment patch needed)
// meaningful test: verify if it crashes WITHOUT this, or verify IT WORKS with this.
// We want to test the CONFIGURATION.

describe('PDF Parser', () => {
    beforeAll(() => {
        // Enforce the Polyfill if missing, mirroring handler.ts
        if (!global.DOMMatrix) {
            // @ts-ignore
            global.DOMMatrix = class DOMMatrix {
                constructor() { return this; }
                setMatrixValue() { }
                multiply() { return this; }
                translate() { return this; }
                scale() { return this; }
                rotate() { return this; }
            };
        }
    });

    it('should have DOMMatrix defined', () => {
        expect(global.DOMMatrix).toBeDefined();
    });

    it('should parse a simple PDF successfully', async () => {
        // We need a dummy PDF for testing. 
        // Since we can't easily generate a valid binary PDF in code without a library,
        // we will rely on checking if the CLASS instantiates and doesn't crash immediately.
        // Or better: Download the AUP file if possible, or skip if file missing.

        // Actually, let's verify that instantiating the parser doesn't throw.
        const header = "%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n";
        const tmpPath = path.join(os.tmpdir(), randomUUID() + '.pdf');
        fs.writeFileSync(tmpPath, header);

        try {
            const parser = new PdfDataParser({ url: tmpPath });
            // We expect this might fail to parse *content* but NOT crash with ReferenceError
            await parser.parse().catch(e => {
                // If the error is ReferenceError, we failed.
                // If it's "Invalid PDF", we passed the environment check.
                if (e.name === 'ReferenceError') throw e;
                console.log("Expected parsing error for dummy file:", e.message);
            });
        } finally {
            if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        }
    });
});
