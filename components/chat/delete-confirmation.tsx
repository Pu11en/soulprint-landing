'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DeleteConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationTitle: string;
  onConfirm: () => void;
  isDeleting: boolean;
}

export function DeleteConfirmation({
  open,
  onOpenChange,
  conversationTitle,
  onConfirm,
  isDeleting,
}: DeleteConfirmationProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Conversation?</DialogTitle>
          <DialogDescription>
            This will permanently delete '{conversationTitle}' and all its messages. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex gap-2">
          <button
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            className="flex-1 py-2.5 px-4 bg-muted text-foreground border border-border rounded-lg font-medium hover:bg-accent transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 py-2.5 px-4 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
