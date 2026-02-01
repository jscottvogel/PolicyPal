import type { Schema } from '../../data/resource';
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.AWS_REGION });
const BUCKET_NAME = process.env.BUCKET_NAME;

// Helper to convert stream to string
const streamToString = (stream: any): Promise<string> => {
    return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on('data', (chunk: any) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    });
};

export const handler: Schema["getIndexedFiles"]["functionHandler"] = async () => {
    if (!BUCKET_NAME) {
        console.error("BUCKET_NAME missing");
        return [];
    }

    try {
        const getCmd = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: 'vectors/index.json'
        });

        try {
            const res = await s3.send(getCmd);
            const body = await streamToString(res.Body);
            const index = JSON.parse(body);

            // Extract unique paths
            const paths = new Set(index.map((doc: any) => doc.path));
            return Array.from(paths) as string[];
        } catch (err: any) {
            if (err.name === 'NoSuchKey') {
                return [];
            }
            throw err;
        }
    } catch (error) {
        console.error("Error checking index:", error);
        return [];
    }
};
