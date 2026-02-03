import { useState, useRef, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

const client = generateClient();

export function ChatInterface() {
    const [messages, setMessages] = useState([
        { text: "Hello! I'm PolicyPal. Ask me anything about your company policies.", isUser: false }
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
                text: data?.answer || "I couldn't generate a response.",
                isUser: false,
                citations: data?.citations || []
            };
            setMessages(prev => [...prev, botMsg]);
        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, {
                text: "Sorry, I encountered an error. Please try again.",
                isUser: false
            }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="chat-interface">
            <div className="chat-header">
                <h3>Policy Chat</h3>
                <div style={{ fontSize: '12px', color: 'var(--gray-500)', marginTop: '2px' }}>
                    Ask questions about your company policies
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
                    <div className="chat-message bot">
                        <div className="message-content" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="loader"></span>
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
