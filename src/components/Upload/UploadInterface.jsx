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
    const [refreshSuccess, setRefreshSuccess] = useState(false);
    const [syncingFiles, setSyncingFiles] = useState(new Set()); // Track individual file syncs
    const [totalSize, setTotalSize] = useState(0);

    useEffect(() => {
        const total = files.reduce((acc, file) => acc + (file.size || 0), 0);
        setTotalSize(total);
    }, [files]);

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
        <div className="manage-policies-screen">
            <header className="page-header">
                <div className="header-title">
                    <h1>Policy Management</h1>
                    <p>Securely upload and index your company documents for the Chatbot Knowledge Base.</p>
                </div>
                <div className="header-actions">
                    <button
                        onClick={async () => {
                            if (!window.confirm("Are you sure you want to clear the entire search index? The chatbot will have no policy knowledge until you sync again.")) return;
                            setSyncing(true);
                            try {
                                const { data, errors } = await client.mutations.sync({ clear: true });
                                if (errors) throw errors[0];
                                alert("Index cleared successfully.");
                                await fetchFiles(true);
                            } catch (e) {
                                console.error("Clear Index failed:", e);
                                alert("Failed to clear index.");
                            } finally {
                                setSyncing(false);
                            }
                        }}
                        className="btn btn-danger"
                        disabled={syncing}
                    >
                        🗑 Clear Index
                    </button>
                    <button
                        onClick={async () => {
                            setSyncing(true);
                            try {
                                await client.queries.chat({ message: "", forceRefresh: true });
                                setRefreshSuccess(true);
                                setTimeout(() => setRefreshSuccess(false), 3000);
                            } catch (e) {
                                console.error("Refresh failed:", e);
                                alert("Failed to refresh index cache.");
                            } finally {
                                setSyncing(false);
                            }
                        }}
                        className={`btn btn-secondary ${refreshSuccess ? 'success' : ''}`}
                        disabled={syncing}
                    >
                        {syncing ? (
                            <span className="loader"></span>
                        ) : refreshSuccess ? (
                            <><span>✓</span> Cache Refreshed</>
                        ) : (
                            <>🔄 Refresh Cache</>
                        )}
                    </button>
                    <button
                        onClick={handleSyncAll}
                        className={`btn btn-primary ${syncing ? 'syncing' : ''}`}
                        disabled={syncing}
                    >
                        {syncing && <span className="loader"></span>}
                        {syncing ? 'Indexing Knowledge...' : 'Sync All Policies'}
                    </button>
                </div>
            </header>

            <div className="page-content">
                <section className="upload-section card">
                    <h2>Upload Documents</h2>
                    <p className="section-help">Add PDF documents to the repository. These will be available for indexing immediately.</p>
                    <div className="storage-manager-wrapper">
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
                </section>

                <section className="files-section card">
                    <div className="section-header">
                        <h2>Knowledge Base Inventory</h2>
                        <div className="header-badges">
                            <span className="file-count stats-badge">{files.length} PDF Documents</span>
                            <span className="storage-count stats-badge">{(totalSize / 1024 / 1024).toFixed(2)} MB Total</span>
                        </div>
                    </div>

                    {fetching ? (
                        <div className="loading-state">
                            <span className="loader large"></span>
                            <p>Loading your policies...</p>
                        </div>
                    ) : files.length === 0 ? (
                        <div className="empty-state">
                            <p>No policies found. Start by uploading a document above.</p>
                        </div>
                    ) : (
                        <div className="file-grid">
                            {files.map((file) => {
                                const isIndexed = indexedFiles.has(file.path);
                                const isSyncing = syncingFiles.has(file.path);

                                return (
                                    <div key={file.path} className={`file-card ${isIndexed ? 'is-indexed' : 'is-pending'}`}>
                                        <div className="file-status-indicator"></div>
                                        <div className="file-content">
                                            <div className="file-main">
                                                <span className="file-name">{file.path.replace('public/', '')}</span>
                                                <div className="file-meta">
                                                    <span>{(file.size / 1024).toFixed(1)} KB</span>
                                                    <span className="dot">•</span>
                                                    <span>{new Date(file.lastModified).toLocaleDateString()}</span>
                                                </div>
                                            </div>

                                            <div className="file-actions">
                                                <div className={`status-badge ${isIndexed ? 'indexed' : 'pending'}`}>
                                                    {isIndexed ? '✓ Indexed' : '○ Not Indexed'}
                                                </div>
                                                <div className="action-buttons">
                                                    <button
                                                        className="action-btn sync-btn"
                                                        onClick={() => handleSyncFile(file.path)}
                                                        disabled={isSyncing || syncing}
                                                        title="Re-index this file"
                                                    >
                                                        {isSyncing ? 'Syncing...' : 'Sync'}
                                                    </button>
                                                    <button
                                                        className="action-btn delete-btn"
                                                        onClick={() => handleDelete(file.path)}
                                                        title="Delete Policy"
                                                        disabled={isSyncing || syncing}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
