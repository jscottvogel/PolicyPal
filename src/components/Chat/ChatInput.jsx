import { useState, useRef, useEffect } from 'react';

export function ChatInput({ onSend, disabled }) {
    const [input, setInput] = useState('');
    const textareaRef = useRef(null);

    const handleSubmit = (e) => {
        if (e) e.preventDefault();
        if (!input.trim() || disabled) return;
        onSend(input);
        setInput('');
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    // Auto-expand textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'inherit';
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
        }
    }, [input]);

    return (
        <form className="chat-input-wrapper" onSubmit={handleSubmit}>
            <textarea
                ref={textareaRef}
                className="chat-input"
                rows="1"
                value={input}
                onKeyDown={handleKeyDown}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                disabled={disabled}
            />
            <button
                type="submit"
                className="btn-icon"
                disabled={disabled || !input.trim()}
                title="Send message"
            >
                {disabled ? <span className="loader" style={{ width: '20px', height: '20px' }}></span> : '🚀'}
            </button>
        </form>
    );
}
