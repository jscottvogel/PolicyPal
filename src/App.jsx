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

  return (
    <div className="app-layout">
      <Sidebar
        onSignOut={signOut}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      <main className="main-content">
        {activeTab === 'chat' && <ChatInterface />}
        {activeTab === 'upload' && isAdmin && <UploadInterface />}
        {activeTab === 'upload' && !isAdmin && (
          <div style={{ padding: '2rem', color: 'var(--status-error)' }}>
            <h3>Access Denied</h3>
            <p>You do not have permission to view this page.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <AuthProvider>
          <AppContent signOut={signOut} />
        </AuthProvider>
      )}
    </Authenticator>
  );
}

export default App;
