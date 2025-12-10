import { useState, useRef, useEffect } from 'react';
import { Loader2, Upload } from 'lucide-react';
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
import { useUploadFile } from '@/hooks/use-files';

interface UploadFileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeName: string;
}

export function UploadFileDialog({ open, onOpenChange, storeName }: UploadFileDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<Element | null>(null);
  const uploadFile = useUploadFile();

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!displayName) {
        setDisplayName(selectedFile.name);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    uploadFile.mutate(
      {
        storeName,
        file,
        config: displayName ? { displayName } : undefined,
      },
      {
        onSuccess: () => {
          setFile(null);
          setDisplayName('');
          onOpenChange(false);
        },
      }
    );
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setFile(null);
      setDisplayName('');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent onCloseAutoFocus={handleCloseAutoFocus}>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
            <DialogDescription>
              Upload a file to the store. Supported formats: PDF, TXT, MD, and more.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>File</Label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-accent transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {file ? (
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Click to select a file</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploadFile.isPending}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="displayName">Display Name (optional)</Label>
              <Input
                id="displayName"
                placeholder="Custom file name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={uploadFile.isPending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!file || uploadFile.isPending}>
              {uploadFile.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
