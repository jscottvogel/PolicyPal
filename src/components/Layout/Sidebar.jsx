import { generateClient } from 'aws-amplify/data';
import { useAuth } from '../../context/AuthContext';

const client = generateClient();

export function Sidebar({ onSignOut, activeTab, setActiveTab, isOpen, onClose }) {
    const { user, isAdmin } = useAuth();

    const handleRefresh = async () => {
        try {
            alert("Refreshing chatbot knowledge base...");
            // @ts-ignore
            await client.queries.chat({ message: "", forceRefresh: true });
            alert("Chatbot knowledge base refreshed!");
        } catch (e) {
            alert("Refresh failed: " + e.message);
        }
    };

    return (
        <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
                <img src="/PolicyPal.png" alt="PolicyPal Logo" className="sidebar-logo" />
                <button className="mobile-close-btn" onClick={onClose}>×</button>
            </div>

            <nav className="sidebar-nav">
                <button
                    className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('chat'); onClose?.(); }}
                >
                    Chat
                </button>
                {isAdmin && (
                    <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        <button
                            className={`nav-item ${activeTab === 'upload' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('upload'); onClose?.(); }}
                        >
                            Manage Policies
                        </button>
                        <button
                            className="nav-item"
                            style={{
                                border: '1px solid var(--border-color)',
                                fontSize: '0.85rem'
                            }}
                            onClick={handleRefresh}
                        >
                            🔄 Refresh Cache
                        </button>
                    </div>
                )}
            </nav>

            <div className="sidebar-footer">
                <div className="user-profile">
                    <div className="user-avatar">
                        {(user?.signInDetails?.loginId || user?.username || 'U')[0].toUpperCase()}
                    </div>
                    <div className="user-details">
                        <span className="user-name">{user?.signInDetails?.loginId || user?.username}</span>
                        {isAdmin && <span className="user-badge">Admin</span>}
                    </div>
                </div>
                <button onClick={onSignOut} className="sign-out-btn">
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
