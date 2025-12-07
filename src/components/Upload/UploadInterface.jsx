import { useState, useEffect } from 'react';
import { StorageManager } from '@aws-amplify/ui-react-storage';
import { list, remove } from 'aws-amplify/storage';
import '@aws-amplify/ui-react-storage/styles.css';

export function UploadInterface() {
    const [files, setFiles] = useState([]);
    const [fetching, setFetching] = useState(true);

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

    return (
        <div className="upload-interface">
            <div className="upload-header">
                <h2>Policy Management</h2>
                <p>Upload new policy documents (PDF) here. These will be indexed for the chatbot.</p>
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
