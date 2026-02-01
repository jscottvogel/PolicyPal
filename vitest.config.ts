
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: [
            'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
            'amplify/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
        ],
        // Ensure we can use node APIs
        environment: 'node',
    },
});
