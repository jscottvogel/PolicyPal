import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ChatInterface } from './ChatInterface';

// Hoist mock function
const mocks = vi.hoisted(() => {
    return {
        chat: vi.fn(),
    }
});

vi.mock('aws-amplify/data', () => ({
    generateClient: () => ({
        queries: {
            chat: mocks.chat
        }
    })
}));

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('ChatInterface', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders initial welcome message', () => {
        render(<ChatInterface />);
        expect(screen.getByText(/Hello! I'm PolicyPal/i)).toBeInTheDocument();
    });

    it('sends message and displays response', async () => {
        mocks.chat.mockResolvedValue({
            data: {
                answer: 'Here is the answer.',
                citations: [{ text: 'Citation text', path: 'doc.pdf' }]
            }
        });

        render(<ChatInterface />);

        const input = screen.getByPlaceholderText(/Ask a question/i);
        const button = screen.getByRole('button', { name: /Send/i });

        fireEvent.change(input, { target: { value: 'How does PTO work?' } });
        fireEvent.click(button);

        // Check user message appeared
        expect(screen.getByText('How does PTO work?')).toBeInTheDocument();

        // Check loading state
        expect(screen.getByText('Thinking...')).toBeInTheDocument();

        // specific wait for response
        await waitFor(() => {
            expect(screen.getByText('Here is the answer.')).toBeInTheDocument();
        });

        // Check citations
        expect(screen.getByText('Source 1')).toBeInTheDocument();
    });

    it('handles API errors', async () => {
        mocks.chat.mockRejectedValue(new Error('Network error'));

        render(<ChatInterface />);

        const input = screen.getByPlaceholderText(/Ask a question/i);
        fireEvent.change(input, { target: { value: 'Crash test' } });
        fireEvent.click(screen.getByRole('button', { name: /Send/i }));

        await waitFor(() => {
            expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
        });
    });
});
