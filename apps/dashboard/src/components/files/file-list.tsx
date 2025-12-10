import { useState, useCallback, useRef } from 'react';
import { File, Trash2, Loader2, Upload, AlertCircle, CheckCircle2, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFiles, useDeleteFile, useUploadFile } from '@/hooks/use-files';
import type { FileSearchStoreFile } from '@/types/api';

interface FileListProps {
  storeName: string | null;
}

interface UploadingFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

function FileStatusIcon({ state }: { state: FileSearchStoreFile['state'] }) {
  switch (state) {
    case 'ACTIVE':
    case 'STATE_ACTIVE':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'PROCESSING':
    case 'STATE_PENDING_PROCESSING':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'FAILED':
    case 'STATE_FAILED':
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    default:
      return null;
  }
}

function formatBytes(bytes: string | number | undefined): string {
  if (!bytes) return 'Unknown size';
  const size = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function FileList({ storeName }: FileListProps) {
  const { data: files, isLoading, error } = useFiles(storeName);
  const deleteFile = useDeleteFile();
  const uploadFile = useUploadFile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

  const handleDelete = (file: FileSearchStoreFile) => {
    if (confirm(`Are you sure you want to delete "${file.displayName}"?`)) {
      deleteFile.mutate({ storeName: storeName!, fileName: file.name });
    }
  };

  const uploadFiles = useCallback(
    async (filesToUpload: File[]) => {
      if (!storeName) return;

      const newUploadingFiles: UploadingFile[] = filesToUpload.map((file) => ({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        status: 'pending' as const,
      }));

      setUploadingFiles((prev) => [...prev, ...newUploadingFiles]);

      for (const uploadingFile of newUploadingFiles) {
        setUploadingFiles((prev) =>
          prev.map((f) => (f.id === uploadingFile.id ? { ...f, status: 'uploading' } : f))
        );

        try {
          await uploadFile.mutateAsync({
            storeName,
            file: uploadingFile.file,
          });

          setUploadingFiles((prev) =>
            prev.map((f) => (f.id === uploadingFile.id ? { ...f, status: 'success' } : f))
          );

          // Remove successful upload after 2 seconds
          setTimeout(() => {
            setUploadingFiles((prev) => prev.filter((f) => f.id !== uploadingFile.id));
          }, 2000);
        } catch (err) {
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === uploadingFile.id
                ? {
                    ...f,
                    status: 'error',
                    error: err instanceof Error ? err.message : 'Upload failed',
                  }
                : f
            )
          );
        }
      }
    },
    [storeName, uploadFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        uploadFiles(droppedFiles);
      }
    },
    [uploadFiles]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || []);
      if (selectedFiles.length > 0) {
        uploadFiles(selectedFiles);
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [uploadFiles]
  );

  const removeUploadingFile = (id: string) => {
    setUploadingFiles((prev) => prev.filter((f) => f.id !== id));
  };

  if (!storeName) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <File className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Select a store to view files</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">Failed to load files: {error.message}</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Files</h2>
        <Button size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4" />
          Upload Files
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />
      </div>

      {/* Drop Zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.02]'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload
          className={`h-10 w-10 mx-auto mb-3 transition-colors ${
            isDragging ? 'text-primary' : 'text-muted-foreground'
          }`}
        />
        <p className="text-sm font-medium">
          {isDragging ? 'Drop files here' : 'Drag & drop files here'}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          or click to select files (PDF, TXT, MD, and more)
        </p>
      </div>

      {/* Uploading Files */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Uploading</h3>
          {uploadingFiles.map((uploadingFile) => (
            <Card key={uploadingFile.id} className="bg-muted/50">
              <CardHeader className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {uploadingFile.status === 'uploading' || uploadingFile.status === 'pending' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                    ) : uploadingFile.status === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{uploadingFile.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(uploadingFile.file.size)}
                        {uploadingFile.status === 'pending' && ' • Waiting...'}
                        {uploadingFile.status === 'uploading' && ' • Uploading...'}
                        {uploadingFile.status === 'success' && ' • Done'}
                        {uploadingFile.status === 'error' && ` • ${uploadingFile.error}`}
                      </p>
                    </div>
                  </div>
                  {uploadingFile.status === 'error' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeUploadingFile(uploadingFile.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* File List */}
      {!files?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <File className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-sm">No files in this store</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <Card key={file.name}>
              <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm truncate">
                          {file.originalDisplayName || file.displayName}
                        </CardTitle>
                        <FileStatusIcon state={file.state} />
                      </div>
                      <CardDescription className="text-xs">
                        {formatBytes(file.sizeBytes)} • {file.mimeType || 'Unknown type'}
                      </CardDescription>
                      <CardDescription className="text-xs text-muted-foreground/70">
                        {formatDate(file.createTime)}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={() => handleDelete(file)}
                    disabled={deleteFile.isPending}
                  >
                    {deleteFile.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    )}
                  </Button>
                </div>
                {file.error && (
                  <p className="text-xs text-destructive mt-2">{file.error.message}</p>
                )}
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
