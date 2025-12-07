import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatMessage } from './ChatMessage';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Storage from 'aws-amplify/storage';

// Mock Amplify Storage
vi.mock('aws-amplify/storage', () => ({
    getUrl: vi.fn(),
}));

// Mock window.open
window.open = vi.fn();
window.alert = vi.fn();

describe('ChatMessage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders user message correctly', () => {
        render(<ChatMessage message="User **said** this" isUser={true} />);
        expect(screen.getByText(/User/)).toBeInTheDocument();
        expect(screen.queryByText(/Sources/)).not.toBeInTheDocument();
    });

    it('renders citations if provided', () => {
        const citations = [{ text: 'Snippet content', path: 'public/doc1.pdf' }];
        render(<ChatMessage message="Bot said this" isUser={false} citations={citations} />);

        expect(screen.getByRole('heading', { name: /Sources:/i })).toBeInTheDocument();
        expect(screen.getByText('Source 1')).toBeInTheDocument();
        expect(screen.getByText(/Snippet content/)).toBeInTheDocument();
    });

    it('opens citation link when clicked', async () => {
        const citations = [{ text: 'Snippet', path: 'public/doc1.pdf' }];

        // Mock getUrl response
        const mockUrl = 'https://signed-url.com/doc1.pdf';
        Storage.getUrl.mockResolvedValue({ url: mockUrl });

        render(<ChatMessage message="Bot" isUser={false} citations={citations} />);

        const link = screen.getByText('Source 1');
        fireEvent.click(link);

        await waitFor(() => {
            expect(Storage.getUrl).toHaveBeenCalledWith({
                path: 'public/doc1.pdf',
                options: { validateObjectExistence: true }
            });
            expect(window.open).toHaveBeenCalledWith(mockUrl, '_blank');
        });
    });
});
