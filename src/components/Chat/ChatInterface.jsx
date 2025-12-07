import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

export function ChatInterface() {
    const [messages, setMessages] = useState([
        { text: "Hello! I'm PolicyPal. Ask me anything about company policies.", isUser: false }
    ]);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (text) => {
        const userMsg = { text, isUser: true };
        setMessages(prev => [...prev, userMsg]);
        setLoading(true);

        // Mock response for now (AWS Bedrock hook later)
        setTimeout(() => {
            const botMsg = {
                text: `I received your query: "${text}". \n\nI need to be connected to Bedrock to give a real answer.`,
                isUser: false,
                citations: []
            };
            setMessages(prev => [...prev, botMsg]);
            setLoading(false);
        }, 1000);
    };

    return (
        <div className="chat-interface">
            <div className="messages-list">
                {messages.map((msg, i) => (
                    <ChatMessage
                        key={i}
                        message={msg.text}
                        isUser={msg.isUser}
                        citations={msg.citations}
                    />
                ))}
                {loading && <div className="typing-indicator">Thinking...</div>}
                <div ref={messagesEndRef} />
            </div>
            <ChatInput onSend={handleSend} disabled={loading} />
        </div>
    );
}
