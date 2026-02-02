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
    const [syncingFiles, setSyncingFiles] = useState(new Set());
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

            setFiles(s3Files);
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
            const { errors } = await client.mutations.sync();
            if (errors) throw errors[0];
            await fetchFiles(true);
        } catch (e) {
            console.error('Sync failed:', e);
            alert('Failed to trigger sync.');
        } finally {
            setSyncing(false);
        }
    };

    const handleSyncFile = async (filePath) => {
        setSyncingFiles(prev => new Set(prev).add(filePath));
        try {
            const { errors } = await client.mutations.sync({ filePath });
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
                <div>
                    <h1>Policy Management</h1>
                    <p className="section-help">Centralized control for your company's intelligence. Upload and sync documents to keep the AI updated.</p>
                </div>
                <div className="header-actions">
                    <button
                        onClick={async () => {
                            if (!window.confirm("Delete entire index? This cannot be undone.")) return;
                            setSyncing(true);
                            try {
                                await client.mutations.sync({ clear: true });
                                alert("Index cleared successfully.");
                                await fetchFiles(true);
                            } catch (e) {
                                console.error("Clear Index failed:", e);
                                alert("Failed to clear index.");
                            } finally {
                                setSyncing(false);
                            }
                        }}
                        className="btn btn-ghost"
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
                        className={`btn btn-outline ${refreshSuccess ? 'success' : ''}`}
                        disabled={syncing}
                    >
                        {refreshSuccess ? '✓ Refreshed' : '🔄 Refresh Cache'}
                    </button>
                    <button
                        onClick={handleSyncAll}
                        className={`btn btn-primary ${syncing ? 'syncing' : ''}`}
                        disabled={syncing}
                        style={{ justifyContent: 'center' }}
                    >
                        {syncing ? <><span className="loader" style={{ marginRight: '0.5rem' }}></span> Indexing...</> : '⚡ Sync Full Base'}
                    </button>
                </div>
            </header>

            <div className="dashboard-grid">
                <section className="section-card">
                    <h2 className="section-title">Upload Documents</h2>
                    <p className="section-help">Add your company policies (PDF format only).</p>
                    <StorageManager
                        acceptedFileTypes={['application/pdf']}
                        path="public/"
                        maxFileCount={10}
                        isResumable
                        onUploadSuccess={() => fetchFiles(true)}
                    />
                </section>

                <section className="section-card">
                    <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 className="section-title" style={{ margin: 0 }}>Knowledge Base</h2>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <span className="stats-badge">{files.length} Docs</span>
                            <span className="stats-badge">{(totalSize / 1024 / 1024).toFixed(1)} MB</span>
                        </div>
                    </div>

                    {fetching ? (
                        <div className="loading-state" style={{ padding: '2rem' }}><span className="loader"></span></div>
                    ) : files.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--gray-400)' }}>
                            <p>No documents found.</p>
                        </div>
                    ) : (
                        <div className="policy-grid">
                            {files.map((file) => (
                                <div key={file.path} className="policy-card">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        <div className="policy-icon">📄</div>
                                        <div className="policy-info">
                                            <span className="policy-name">{file.path.replace('public/', '')}</span>
                                            <div className="policy-stats">
                                                <span>{(file.size / 1024).toFixed(0)} KB</span>
                                                <div className={`status-indicator ${indexedFiles.has(file.path) ? 'ready' : 'pending'}`}>
                                                    {indexedFiles.has(file.path) ? 'Ready' : 'Pending'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="action-buttons" style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            className="btn btn-primary"
                                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.7rem', justifyContent: 'center' }}
                                            onClick={() => handleSyncFile(file.path)}
                                            disabled={syncing || syncingFiles.has(file.path)}
                                        >
                                            {syncingFiles.has(file.path) ? 'Syncing...' : 'Sync'}
                                        </button>
                                        <button
                                            className="btn btn-outline"
                                            style={{ padding: '0.4rem', fontSize: '0.7rem' }}
                                            onClick={() => handleDelete(file.path)}
                                            disabled={syncing}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
