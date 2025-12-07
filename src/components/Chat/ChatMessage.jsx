import ReactMarkdown from 'react-markdown';
import { getUrl } from 'aws-amplify/storage';

/**
 * Renders a chat message with markdown support and clickable citations.
 * @param {Object} props
 * @param {string} props.message - The text content.
 * @param {boolean} props.isUser - True if sent by user.
 * @param {Array<{text: string, path: string}>} [props.citations] - RAG citations with S3 paths.
 */
export function ChatMessage({ message, isUser, citations = [] }) {

    const handleCitationClick = async (path) => {
        if (!path) return;
        try {
            const urlInfo = await getUrl({
                path,
                options: { validateObjectExistence: true }
            });
            window.open(urlInfo.url, '_blank');
        } catch (e) {
            console.error("Error opening citation:", e);
            alert("Could not open source file.");
        }
    };

    return (
        <div className={`chat-message ${isUser ? 'user' : 'bot'}`}>
            <div className="message-content">
                <ReactMarkdown>{message}</ReactMarkdown>
            </div>
            {!isUser && citations && citations.length > 0 && (
                <div className="citations">
                    <h4>Sources:</h4>
                    <ul>
                        {citations.map((cite, idx) => (
                            <li key={idx}>
                                <button
                                    className="citation-link"
                                    onClick={() => handleCitationClick(cite.path)}
                                    title={cite.text}
                                >
                                    Source {idx + 1}
                                </button>
                                <p className="citation-snippet">
                                    {cite.text ? cite.text.substring(0, 150) + "..." : "No text snippet available."}
                                </p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
