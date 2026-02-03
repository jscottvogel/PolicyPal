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
                list({ path: 'public/', options: { listAll: true } }),
                client.queries.getIndexedFiles()
            ]);

            setFiles(result.items);
            setIndexedFiles(new Set(indexResult.data || []));
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
        if (!window.confirm(`Delete ${path}?`)) return;
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
            await client.mutations.sync();
            await fetchFiles(true);
        } catch (e) {
            console.error('Sync failed:', e);
            alert('Failed to sync.');
        } finally {
            setSyncing(false);
        }
    };

    const handleSyncFile = async (filePath) => {
        setSyncingFiles(prev => new Set(prev).add(filePath));
        try {
            await client.mutations.sync({ filePath });
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
                <h1>Policy Management</h1>
                <p className="section-help">Upload and manage your company policy documents.</p>

                <div className="header-actions">
                    <button
                        onClick={async () => {
                            if (!window.confirm("Clear entire index?")) return;
                            setSyncing(true);
                            try {
                                await client.mutations.sync({ clear: true });
                                await fetchFiles(true);
                            } catch (e) {
                                console.error("Clear failed:", e);
                            } finally {
                                setSyncing(false);
                            }
                        }}
                        className="btn btn-ghost"
                        disabled={syncing}
                    >
                        Clear Index
                    </button>
                    <button
                        onClick={async () => {
                            setSyncing(true);
                            try {
                                await client.queries.chat({ message: "", forceRefresh: true });
                                setRefreshSuccess(true);
                                setTimeout(() => setRefreshSuccess(false), 2000);
                            } catch (e) {
                                console.error("Refresh failed:", e);
                            } finally {
                                setSyncing(false);
                            }
                        }}
                        className="btn btn-outline"
                        disabled={syncing}
                    >
                        {refreshSuccess ? '✓ Refreshed' : 'Refresh Cache'}
                    </button>
                    <button
                        onClick={handleSyncAll}
                        className="btn btn-primary"
                        disabled={syncing}
                    >
                        {syncing ? <><span className="loader"></span> Syncing...</> : 'Sync All'}
                    </button>
                </div>
            </header>

            <div className="dashboard-grid">
                <section className="section-card">
                    <h2 className="section-title">Upload Documents</h2>
                    <p className="section-help">Add PDF files to your knowledge base.</p>
                    <StorageManager
                        acceptedFileTypes={['application/pdf']}
                        path="public/"
                        maxFileCount={10}
                        isResumable
                        onUploadSuccess={() => fetchFiles(true)}
                    />
                </section>

                <section className="section-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 className="section-title" style={{ margin: 0 }}>Documents</h2>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <span className="stats-badge">{files.length} files</span>
                            <span className="stats-badge">{(totalSize / 1024 / 1024).toFixed(1)} MB</span>
                        </div>
                    </div>

                    {fetching ? (
                        <div className="loading-state">
                            <span className="loader" style={{ width: '32px', height: '32px' }}></span>
                            <p style={{ marginTop: '12px' }}>Loading...</p>
                        </div>
                    ) : files.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--gray-500)' }}>
                            <p>No documents yet. Upload your first file to get started.</p>
                        </div>
                    ) : (
                        <div className="policy-grid">
                            {files.map((file) => (
                                <div key={file.path} className="policy-card">
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <div className="policy-icon">📄</div>
                                        <div className="policy-info">
                                            <span className="policy-name">{file.path.replace('public/', '')}</span>
                                            <div className="policy-stats">
                                                <span>{(file.size / 1024).toFixed(0)} KB</span>
                                                <span>•</span>
                                                <div className={`status-indicator ${indexedFiles.has(file.path) ? 'ready' : 'pending'}`}>
                                                    {indexedFiles.has(file.path) ? 'Indexed' : 'Pending'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="action-buttons">
                                        <button
                                            className="btn btn-outline"
                                            style={{ flex: 1, fontSize: '13px', padding: '8px' }}
                                            onClick={() => handleSyncFile(file.path)}
                                            disabled={syncing || syncingFiles.has(file.path)}
                                        >
                                            {syncingFiles.has(file.path) ? <span className="loader"></span> : 'Sync'}
                                        </button>
                                        <button
                                            className="btn btn-ghost"
                                            style={{ fontSize: '13px', padding: '8px' }}
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
