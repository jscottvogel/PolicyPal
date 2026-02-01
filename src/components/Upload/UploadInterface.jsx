import { useState, useEffect } from 'react';
import { StorageManager } from '@aws-amplify/ui-react-storage';
import { list, remove } from 'aws-amplify/storage';
import { generateClient } from 'aws-amplify/data';
import '@aws-amplify/ui-react-storage/styles.css';

const client = generateClient();

export function UploadInterface() {
    const [files, setFiles] = useState([]);
    const [fetching, setFetching] = useState(true);
    const [syncing, setSyncing] = useState(false);

    const fetchFiles = async () => {
        setFetching(true);
        try {
            const result = await list({
                path: 'public/',
                options: { listAll: true }
            });
            setFiles(result.items);
        } catch (e) {
            console.error('Error listing files:', e);
        } finally {
            setFetching(false);
        }
    };

    useEffect(() => {
        fetchFiles();
    }, []);

    const handleDelete = async (path) => {
        if (!window.confirm(`Are you sure you want to delete ${path}?`)) return;
        try {
            await remove({ path });
            fetchFiles();
        } catch (e) {
            console.error('Error deleting file:', e);
            alert('Failed to delete file.');
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const { data, errors } = await client.mutations.sync();
            if (errors) throw errors[0];
            alert(`Sync triggered: ${data.message} `);
        } catch (e) {
            console.error('Sync failed:', e);
            alert('Failed to trigger sync. Check logs.');
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="upload-interface">
            <div className="upload-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2>Policy Management</h2>
                        <p>Upload new policy documents (PDF) here. These will be indexed for the chatbot.</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                        <button
                            onClick={handleSync}
                            className="chat-send-btn"
                            style={{
                                padding: '0.5rem 1rem',
                                height: 'fit-content',
                                opacity: syncing ? 0.7 : 1,
                                cursor: syncing ? 'not-allowed' : 'pointer',
                                minWidth: '100px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                            disabled={syncing}
                        >
                            {syncing && <span className="loader"></span>}
                            {syncing ? 'Indexing...' : 'Sync Policies'}
                        </button>
                        {syncing && (
                            <small style={{ color: '#666', fontSize: '0.8rem' }}>
                                This may take a few minutes...
                            </small>
                        )}
                    </div>
                </div>
            </div>

            <div className="upload-container">
                <StorageManager
                    acceptedFileTypes={['application/pdf']}
                    path="public/"
                    maxFileCount={10}
                    isResumable
                    displayText={{
                        dropFilesText: 'Drag & drop PDF policies here',
                        browseFilesText: 'Browse files'
                    }}
                    onUploadSuccess={() => fetchFiles()}
                />
            </div>

            <div className="file-list-section">
                <h3>Existing Policies</h3>
                {fetching ? (
                    <p>Loading policies...</p>
                ) : files.length === 0 ? (
                    <p className="no-files">No policies found.</p>
                ) : (
                    <ul className="file-list">
                        {files.map((file) => (
                            <li key={file.path} className="file-item">
                                <span className="file-name">{file.path.replace('public/', '')}</span>
                                <span className="file-info">
                                    {(file.size / 1024).toFixed(1)} KB &bull; {new Date(file.lastModified).toLocaleDateString()}
                                </span>
                                <button
                                    className="delete-btn"
                                    onClick={() => handleDelete(file.path)}
                                    title="Delete Policy"
                                >
                                    Delete
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
