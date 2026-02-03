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
                <div className="header-meta">
                    <div>
                        <div className="stats-badge" style={{ marginBottom: '1rem', background: 'var(--primary-light)', color: 'var(--primary)' }}>Admin Command Center</div>
                        <h1>Knowledge Base</h1>
                        <p className="section-help">Transform your static documents into interactive intelligence. Manage, sync, and monitor your policy repository.</p>
                    </div>
                </div>
                <div className="header-actions" style={{ marginTop: '2rem' }}>
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
                        {refreshSuccess ? '✓ Cache Updated' : '🔄 Refresh Cache'}
                    </button>
                    <button
                        onClick={handleSyncAll}
                        className={`btn btn-primary ${syncing ? 'syncing' : ''}`}
                        disabled={syncing}
                        style={{ minWidth: '200px' }}
                    >
                        {syncing ? <><span className="loader" style={{ width: '16px', height: '16px', marginRight: '0.5rem' }}></span> Full Sync...</> : '⚡ Sync All Policies'}
                    </button>
                </div>
            </header>

            <div className="dashboard-grid">
                <section className="section-card">
                    <h2 className="section-title">
                        <span style={{ fontSize: '1.5rem' }}>📤</span> Upload Source
                    </h2>
                    <p className="section-help">Add new PDF policies to your repository. They will be available for indexing immediately.</p>
                    <div style={{ background: 'var(--gray-50)', padding: '1rem', borderRadius: 'var(--r-md)', border: '1px dashed var(--border-medium)' }}>
                        <StorageManager
                            acceptedFileTypes={['application/pdf']}
                            path="public/"
                            maxFileCount={10}
                            isResumable
                            onUploadSuccess={() => fetchFiles(true)}
                        />
                    </div>
                </section>

                <section className="section-card">
                    <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 className="section-title" style={{ margin: 0 }}>
                            <span style={{ fontSize: '1.5rem' }}>📚</span> Document Inventory
                        </h2>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <span className="stats-badge">{files.length} Files</span>
                            <span className="stats-badge">{(totalSize / 1024 / 1024).toFixed(1)} MB</span>
                        </div>
                    </div>

                    {fetching ? (
                        <div className="loading-state" style={{ padding: '4rem', textAlign: 'center' }}>
                            <span className="loader" style={{ width: '40px', height: '40px', borderColor: 'var(--primary)', borderBottomColor: 'transparent' }}></span>
                            <p style={{ marginTop: '1rem', color: 'var(--gray-500)', fontWeight: 600 }}>Retrieving Policies...</p>
                        </div>
                    ) : files.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '5rem 2rem', background: 'var(--gray-50)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border-subtle)' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
                            <h3 style={{ marginBottom: '0.5rem' }}>No Documents Yet</h3>
                            <p style={{ color: 'var(--gray-500)' }}>Upload your first policy to get started.</p>
                        </div>
                    ) : (
                        <div className="policy-grid">
                            {files.map((file) => (
                                <div key={file.path} className="policy-card">
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                                        <div className="policy-icon">📄</div>
                                        <div className="policy-info" style={{ flex: 1 }}>
                                            <span className="policy-name">{file.path.replace('public/', '')}</span>
                                            <div className="policy-stats">
                                                <span>{(file.size / 1024).toFixed(0)} KB</span>
                                                <span style={{ opacity: 0.3 }}>•</span>
                                                <div className={`status-indicator ${indexedFiles.has(file.path) ? 'ready' : 'pending'}`}>
                                                    {indexedFiles.has(file.path) ? 'Active' : 'Pending'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="action-buttons" style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.75rem' }}>
                                        <button
                                            className="btn btn-outline"
                                            style={{ padding: '0.6rem', fontSize: '0.8125rem', width: '100%', border: '1px solid var(--border-subtle)' }}
                                            onClick={() => handleSyncFile(file.path)}
                                            disabled={syncing || syncingFiles.has(file.path)}
                                        >
                                            {syncingFiles.has(file.path) ? <span className="loader" style={{ width: '12px', height: '12px' }}></span> : '⚡ Sync'}
                                        </button>
                                        <button
                                            className="btn btn-ghost"
                                            style={{ padding: '0.6rem', color: 'var(--gray-400)' }}
                                            onClick={() => handleDelete(file.path)}
                                            disabled={syncing}
                                            title="Delete permanently"
                                        >
                                            🗑
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
