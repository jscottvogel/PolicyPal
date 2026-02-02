import { useState, useRef, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

const client = generateClient();

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

        try {
            // Call Amplify Backend
            const { data, errors } = await client.queries.chat({ message: text });

            if (errors) throw errors[0];

            console.log("Chat Response:", data);

            const botMsg = {
                text: data?.answer || "No response received.",
                isUser: false,
                citations: data?.citations || []
            };
            setMessages(prev => [...prev, botMsg]);
        } catch (err) {
            console.error(err);
            setMessages(prev => [...prev, {
                text: "Sorry, something went wrong communicating with the server.",
                isUser: false
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        setLoading(true);
        try {
            const { data, errors } = await client.queries.chat({
                message: "",
                forceRefresh: true
            });
            if (errors) throw errors[0];
            alert("Chatbot knowledge base refreshed!");
        } catch (err) {
            console.error("Refresh failed:", err);
            alert("Failed to refresh knowledge base.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="chat-interface">
            <div className="chat-header" style={{
                padding: '1rem',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <h3 style={{ margin: 0 }}>Policy Chat</h3>
                <button
                    onClick={handleRefresh}
                    disabled={loading}
                    className="refresh-btn"
                    title="Refresh knowledge base"
                    style={{
                        background: 'transparent',
                        border: '1px solid var(--border-color)',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                    }}
                >
                    🔄 Refresh
                </button>
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
                {loading && <div className="typing-indicator">Thinking...</div>}
                <div ref={messagesEndRef} />
            </div>
            <ChatInput onSend={handleSend} disabled={loading} />
        </div>
    );
}
