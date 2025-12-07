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

            const botMsg = {
                text: data?.answer || "No response received.",
                isUser: false,
                citations: data?.citations?.map(c => ({ title: 'Source', location: { uri: '#' }, content: c })) || []
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
