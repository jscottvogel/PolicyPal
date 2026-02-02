import { useAuth } from '../../context/AuthContext';

export function Sidebar({ onSignOut, activeTab, setActiveTab, isOpen, onClose }) {
    const { user, isAdmin } = useAuth();

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
