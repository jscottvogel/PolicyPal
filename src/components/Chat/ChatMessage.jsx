import ReactMarkdown from 'react-markdown';

export function ChatMessage({ message, isUser, citations = [] }) {
    return (
        <div className={`chat-message ${isUser ? 'user' : 'bot'}`}>
            <div className="message-content">
                <ReactMarkdown>{message}</ReactMarkdown>
            </div>
            {citations.length > 0 && (
                <div className="citations">
                    <h4>Sources:</h4>
                    <ul>
                        {citations.map((cite, idx) => (
                            <li key={idx}>
                                <a href={cite.location?.uri} target="_blank" rel="noopener noreferrer">
                                    {cite.title || `Source ${idx + 1}`}
                                </a>
                                {cite.content && <p className="citation-snippet">{cite.content && cite.content.substring(0, 100)}...</p>}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
