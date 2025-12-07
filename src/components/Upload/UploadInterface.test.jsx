import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { UploadInterface } from './UploadInterface';
import * as Storage from 'aws-amplify/storage';

// Hoist storage mocks
const storageMocks = vi.hoisted(() => ({
    list: vi.fn(),
    remove: vi.fn(),
}));

// Mock amplify storage module
vi.mock('aws-amplify/storage', () => ({
    list: storageMocks.list,
    remove: storageMocks.remove,
}));

// Mock Amplify UI Component (StorageManager)
vi.mock('@aws-amplify/ui-react-storage', () => ({
    StorageManager: ({ onUploadSuccess }) => (
        <div data-testid="storage-manager">
            <button onClick={() => onUploadSuccess({ key: 'new.pdf' })}>Simulate Upload</button>
        </div>
    )
}));

// Mock window.confirm
window.confirm = vi.fn(() => true);
window.alert = vi.fn();

// Mock Data Client (for Sync)
const dataMocks = vi.hoisted(() => ({
    sync: vi.fn(),
}));

vi.mock('aws-amplify/data', () => ({
    generateClient: () => ({
        mutations: {
            sync: dataMocks.sync
        }
    })
}));

describe('UploadInterface', () => {

    beforeEach(() => {
        vi.clearAllMocks();
        // Default list mock implementation for tests
        storageMocks.list.mockResolvedValue({
            items: [
                { path: 'public/policy1.pdf', size: 1024, lastModified: new Date() },
                { path: 'public/policy2.pdf', size: 2048, lastModified: new Date() }
            ]
        });
        storageMocks.remove.mockResolvedValue({});
        dataMocks.sync.mockResolvedValue({ data: { message: 'Sync started' } });
    });

    it('renders and lists files', async () => {
        render(<UploadInterface />);

        expect(screen.getByText('Policy Management')).toBeInTheDocument();
        expect(await screen.findByText('policy1.pdf')).toBeInTheDocument();
        expect(screen.getByText('policy2.pdf')).toBeInTheDocument();
    });

    it('refreshes list on upload success', async () => {
        render(<UploadInterface />);
        await screen.findByText('policy1.pdf'); // Wait for initial load

        // Trigger upload
        fireEvent.click(screen.getByText('Simulate Upload'));

        // Check if list was called again
        await waitFor(() => {
            expect(storageMocks.list).toHaveBeenCalledTimes(2);
        });
    });

    it('deletes file when confirmed', async () => {
        render(<UploadInterface />);
        await screen.findByText('policy1.pdf');

        // Click delete on first item
        const deleteBtns = screen.getAllByText('Delete');
        fireEvent.click(deleteBtns[0]);

        expect(window.confirm).toHaveBeenCalled();
        expect(storageMocks.remove).toHaveBeenCalledWith({ path: 'public/policy1.pdf' });

        // Should refresh list after delete
        await waitFor(() => {
            expect(storageMocks.list).toHaveBeenCalledTimes(2);
        });
    });

    it('triggers sync job when button clicked', async () => {
        render(<UploadInterface />);
        const syncBtn = screen.getByText('Sync Knowledge Base');

        fireEvent.click(syncBtn);

        expect(screen.getByText('Syncing...')).toBeInTheDocument();

        await waitFor(() => {
            expect(dataMocks.sync).toHaveBeenCalled();
            expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Sync triggered'));
        });
    });
});
