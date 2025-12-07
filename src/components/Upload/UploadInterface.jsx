import { StorageManager } from '@aws-amplify/ui-react-storage';
import '@aws-amplify/ui-react-storage/styles.css';

export function UploadInterface() {
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
                    onUploadSuccess={({ key }) => console.log('Uploaded:', key)}
                />
            </div>
        </div>
    );
}
