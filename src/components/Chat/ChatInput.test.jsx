import { render, screen, fireEvent } from '@testing-library/react';
import { ChatInput } from './ChatInput';
import { vi, describe, it, expect } from 'vitest';

describe('ChatInput', () => {
    it('renders input and button', () => {
        render(<ChatInput onSend={() => { }} disabled={false} />);
        expect(screen.getByPlaceholderText(/Ask a question/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Send/i })).toBeInTheDocument();
    });

    it('calls onSend when form submitted', () => {
        const handleSend = vi.fn();
        render(<ChatInput onSend={handleSend} disabled={false} />);

        const input = screen.getByPlaceholderText(/Ask a question/i);
        fireEvent.change(input, { target: { value: 'Hello' } });
        fireEvent.submit(screen.getByRole('button'));

        expect(handleSend).toHaveBeenCalledWith('Hello');
    });

    it('does not call onSend if input empty', () => {
        const handleSend = vi.fn();
        render(<ChatInput onSend={handleSend} disabled={false} />);

        fireEvent.submit(screen.getByRole('button'));
        expect(handleSend).not.toHaveBeenCalled();
    });

    it('is disabled when disabled prop is true', () => {
        render(<ChatInput onSend={() => { }} disabled={true} />);
        expect(screen.getByPlaceholderText(/Ask a question/i)).toBeDisabled();
        expect(screen.getByRole('button')).toBeDisabled();
    });
});
