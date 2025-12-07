import { render, screen } from '@testing-library/react';
import { ChatMessage } from './ChatMessage';
import { describe, it, expect } from 'vitest';

describe('ChatMessage', () => {
    it('renders user message correctly', () => {
        render(<ChatMessage message="User **said** this" isUser={true} />);
        // ReactMarkdown splits text. Match partial.
        expect(screen.getByText(/User/)).toBeInTheDocument();
    });

    it('renders text message', () => {
        render(<ChatMessage message="Hello World" isUser={false} />);
        expect(screen.getByText('Hello World')).toBeInTheDocument();
    });

    it('renders citations if provided', () => {
        const citations = [{ title: 'Doc 1', location: { uri: 'http://doc1' } }];
        render(<ChatMessage message="Bot said this" isUser={false} citations={citations} />);

        expect(screen.getByRole('heading', { name: /Sources:/i })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Doc 1/i })).toHaveAttribute('href', 'http://doc1');
    });

    it('renders citation with defaults', () => {
        const citations = [{}];
        render(<ChatMessage message="Bot" isUser={false} citations={citations} />);
        expect(screen.getByText('Source 1')).toBeInTheDocument();
    });
});
