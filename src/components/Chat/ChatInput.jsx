import { useState } from 'react';

export function ChatInput({ onSend, disabled }) {
    const [input, setInput] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!input.trim() || disabled) return;
        onSend(input);
        setInput('');
    };

    return (
        <form className="chat-input-wrapper" onSubmit={handleSubmit}>
            <input
                className="chat-input"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question about policies..."
                disabled={disabled}
            />
            <button
                type="submit"
                className="btn-icon"
                disabled={disabled || !input.trim()}
                title="Send message"
            >
                {disabled ? <span className="loader"></span> : '🚀'}
            </button>
        </form>
    );
}
