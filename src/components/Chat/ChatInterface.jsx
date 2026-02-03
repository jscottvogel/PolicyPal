import { useState, useRef, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

const client = generateClient();

export function ChatInterface() {
    const [messages, setMessages] = useState([
        { text: "Hello! I'm **PolicyPal**, your intelligent policy assistant. I can help you find answers within your company's documents. What can I help you with today?", isUser: false }
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

        try {
            const { data, errors } = await client.queries.chat({ message: text });
            if (errors) throw errors[0];

            const botMsg = {
                text: data?.answer || "I couldn't generate a response. Please try again.",
                isUser: false,
                citations: data?.citations || []
            };
            setMessages(prev => [...prev, botMsg]);
        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, {
                text: "I'm having trouble connecting to the intelligence engine. Please check your connection and try again.",
                isUser: false
            }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="chat-interface">
            <div className="chat-header">
                <div>
                    <h3>Policy Intelligence</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2px' }}>
                        <span style={{ width: '8px', height: '8px', background: 'var(--success)', borderRadius: '50%' }}></span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Engine Online</span>
                    </div>
                </div>
            </div>

            <div className="messages-list">
                {messages.map((msg, i) => (
                    <ChatMessage
                        key={i}
                        message={msg.text}
                        isUser={msg.isUser}
                        citations={msg.citations}
                    />
                ))}

                {loading && (
                    <div className="chat-message bot" style={{ animation: 'pulse 1.5s infinite' }}>
                        <div className="message-content" style={{ background: 'var(--gray-50)', color: 'var(--gray-400)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span className="loader" style={{ width: '16px', height: '16px' }}></span>
                            Thinking...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <ChatInput onSend={handleSend} disabled={loading} />
        </div>
    );
}
