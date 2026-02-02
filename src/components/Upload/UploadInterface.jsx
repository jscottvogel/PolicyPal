import { useState, useEffect } from 'react';
import { StorageManager } from '@aws-amplify/ui-react-storage';
import { list, remove } from 'aws-amplify/storage';
import { generateClient } from 'aws-amplify/data';
import '@aws-amplify/ui-react-storage/styles.css';

const client = generateClient();

export function UploadInterface() {
    const [files, setFiles] = useState([]);
    const [indexedFiles, setIndexedFiles] = useState(new Set());
    const [fetching, setFetching] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [syncingFiles, setSyncingFiles] = useState(new Set()); // Track individual file syncs

    const fetchFiles = async (silent = false) => {
        if (!silent) setFetching(true);
        try {
            const [result, indexResult] = await Promise.all([
                list({
                    path: 'public/',
                    options: { listAll: true }
                }),
                // @ts-ignore
                client.queries.getIndexedFiles()
            ]);

            const s3Files = result.items;
            const indexedSet = new Set(indexResult.data || []);

            setFiles(prev => {
                // Only update if data changed (simple check)
                if (JSON.stringify(prev) === JSON.stringify(s3Files)) return prev;
                return s3Files;
            });
            setIndexedFiles(indexedSet);

        } catch (e) {
            console.error('Error fetching data:', e);
        } finally {
            if (!silent) setFetching(false);
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

    const handleSyncAll = async () => {
        setSyncing(true);
        try {
            const { data, errors } = await client.mutations.sync();
            if (errors) throw errors[0];
            // alert(`Sync triggered: ${data.message}`);
            // Refresh status after sync
            await fetchFiles(true);
        } catch (e) {
            console.error('Sync failed:', e);
            alert('Failed to trigger sync. Check logs.');
        } finally {
            setSyncing(false);
        }
    };

    const handleSyncFile = async (filePath) => {
        setSyncingFiles(prev => new Set(prev).add(filePath));
        try {
            const { data, errors } = await client.mutations.sync({ filePath });
            if (errors) throw errors[0];
            await fetchFiles(true);
        } catch (e) {
            console.error(`Sync failed for ${filePath}:`, e);
            alert(`Failed to sync ${filePath}.`);
        } finally {
            setSyncingFiles(prev => {
                const next = new Set(prev);
                next.delete(filePath);
                return next;
            });
        }
    };

    return (
        <div className="upload-interface">
            <div className="upload-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h2>Policy Management</h2>
                        <p>Upload new policy documents (PDF) here. </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                        <button
                            onClick={handleSyncAll}
                            className="chat-send-btn"
                            style={{
                                padding: '0.5rem 1rem',
                                height: 'fit-content',
                                opacity: syncing ? 0.7 : 1,
                                cursor: syncing ? 'not-allowed' : 'pointer',
                                minWidth: '120px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                            disabled={syncing}
                        >
                            {syncing && <span className="loader"></span>}
                            {syncing ? 'Indexing All...' : 'Sync All Policies'}
                        </button>
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
                    onUploadSuccess={() => fetchFiles(true)}
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
                        {files.map((file) => {
                            const isIndexed = indexedFiles.has(file.path);
                            const isSyncing = syncingFiles.has(file.path);

                            return (
                                <li key={file.path} className="file-item" style={{ gap: '1rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                        <span className="file-name">{file.path.replace('public/', '')}</span>
                                        <span className="file-info" style={{ fontSize: '0.8rem', color: '#666' }}>
                                            {(file.size / 1024).toFixed(1)} KB &bull; {new Date(file.lastModified).toLocaleDateString()}
                                        </span>
                                    </div>

                                    {/* Status Badge */}
                                    <div className={`sync-badge ${isIndexed ? 'indexed' : 'pending'}`}>
                                        {isIndexed ? (
                                            <>
                                                <span>✓</span> Indexed
                                            </>
                                        ) : (
                                            <>
                                                <span>○</span> Not Indexed
                                            </>
                                        )}
                                    </div>

                                    {/* Sync Button (if not indexed or force re-sync) */}
                                    <button
                                        className="chat-send-btn"
                                        onClick={() => handleSyncFile(file.path)}
                                        disabled={isSyncing || syncing}
                                        style={{
                                            padding: '0.3rem 0.8rem',
                                            fontSize: '0.85rem',
                                            opacity: (isSyncing || syncing) ? 0.6 : 1,
                                            background: isSyncing ? '#ccc' : undefined,
                                            borderColor: isSyncing ? '#ccc' : undefined
                                        }}
                                        title="Re-index this file"
                                    >
                                        {isSyncing ? 'Syncing...' : 'Sync'}
                                    </button>

                                    <button
                                        className="delete-btn"
                                        onClick={() => handleDelete(file.path)}
                                        title="Delete Policy"
                                        disabled={isSyncing || syncing}
                                    >
                                        Delete
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
