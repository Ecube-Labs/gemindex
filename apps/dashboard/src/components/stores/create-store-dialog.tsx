import { useState, useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateStore } from '@/hooks/use-stores';

interface CreateStoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (storeName: string) => void;
}

export function CreateStoreDialog({ open, onOpenChange, onCreated }: CreateStoreDialogProps) {
  const [displayName, setDisplayName] = useState('');
  const createStore = useCreateStore();
  const triggerRef = useRef<Element | null>(null);

  // Save the element that had focus when dialog opens
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
    }
  }, [open]);

  const handleCloseAutoFocus = (e: Event) => {
    // Restore focus to the element that opened the dialog
    if (triggerRef.current instanceof HTMLElement) {
      e.preventDefault();
      triggerRef.current.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;

    createStore.mutate(
      { displayName: displayName.trim() },
      {
        onSuccess: (data) => {
          setDisplayName('');
          onOpenChange(false);
          if (onCreated && data.name) {
            onCreated(data.name);
          }
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onCloseAutoFocus={handleCloseAutoFocus}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Store</DialogTitle>
            <DialogDescription>
              Create a new file search store to organize and search your documents.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="displayName">Store Name</Label>
              <Input
                id="displayName"
                placeholder="My Document Store"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={createStore.isPending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!displayName.trim() || createStore.isPending}>
              {createStore.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Store
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
