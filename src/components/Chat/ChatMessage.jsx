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
        }
    };

    // Replace [n] with superscript-like markers if we wanted to be fancy, 
    // but ReactMarkdown handles the text. We can customize the components though.

    return (
        <div className={`chat-message ${isUser ? 'user' : 'bot'}`}>
            <div className="message-content">
                <ReactMarkdown>{message}</ReactMarkdown>
            </div>
            {!isUser && citations && citations.length > 0 && (
                <div className="citations-container">
                    <span className="citations-header">Derived from:</span>
                    <div className="citations-list">
                        {citations.map((cite, idx) => (
                            <button
                                key={idx}
                                className="citation-tag"
                                onClick={() => handleCitationClick(cite.path)}
                                title={cite.path.replace('public/', '')}
                            >
                                📄 {cite.path.replace('public/', '').replace('.pdf', '')}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
