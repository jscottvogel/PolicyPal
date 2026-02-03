import { useState } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Layout/Sidebar';
import { ChatInterface } from './components/Chat/ChatInterface';
import { UploadInterface } from './components/Upload/UploadInterface';
import './App.css';

function AppContent({ signOut }) {
  const { isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="app-layout">
      <div className="mobile-header">
        <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}>
          ☰
        </button>
        <img src="/PolicyPal.png" alt="PolicyPal Logo" className="mobile-logo" />
        <div style={{ width: '40px' }}></div> {/* Spacer for balance */}
      </div>

      <Sidebar
        onSignOut={signOut}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      <main className="main-content">
        {activeTab === 'chat' && <ChatInterface />}
        {activeTab === 'upload' && isAdmin && <UploadInterface />}
        {activeTab === 'upload' && !isAdmin && (
          <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--gray-50)'
          }}>
            <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🔐</div>
            <h2 style={{ marginBottom: '0.5rem' }}>Access Restricted</h2>
            <p style={{ color: 'var(--gray-500)', fontWeight: 500 }}>This portal is reserved for Enterprise Administrators.</p>
            <button
              className="btn btn-primary"
              style={{ marginTop: '2rem' }}
              onClick={() => setActiveTab('chat')}
            >
              Return to Intelligence Portal
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <Authenticator>
      {({ signOut }) => (
        <AuthProvider>
          <AppContent signOut={signOut} />
        </AuthProvider>
      )}
    </Authenticator>
  );
}

export default App;
