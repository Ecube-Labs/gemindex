import { useRef, useCallback, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Database, Trash2, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStores, useDeleteStore } from '@/hooks/use-stores';
import type { FileSearchStore } from '@/types/api';

interface StoreListProps {
  onCreateStore: () => void;
  onStoreDeleted?: (storeName: string) => void;
}

export function StoreList({ onCreateStore, onStoreDeleted }: StoreListProps) {
  const location = useLocation();
  const { data: stores, isLoading, error } = useStores();
  const deleteStore = useDeleteStore();
  const listRef = useRef<HTMLDivElement>(null);
  const newStoreButtonRef = useRef<HTMLButtonElement>(null);
  const initialFocusSetRef = useRef(false);

  // Derive selected store from URL
  const pathMatch = location.pathname.match(/^\/stores\/([^/?]+)/);
  const storeId = pathMatch ? pathMatch[1] : null;
  const selectedStore = storeId ? `fileSearchStores/${storeId}` : null;

  // Track which item has roving tabindex (only one item is tabbable at a time)
  const [focusedIndex, setFocusedIndex] = useState(0);
  // Track if focus was in the list (persists across DOM changes)
  const hadFocusInListRef = useRef(false);

  // Set initial focus and focusedIndex based on selectedStore
  useEffect(() => {
    if (initialFocusSetRef.current || !stores) return;

    // No stores: focus "New Store" button
    if (stores.length === 0) {
      initialFocusSetRef.current = true;
      requestAnimationFrame(() => {
        newStoreButtonRef.current?.focus();
      });
      return;
    }

    // Find selected store index, default to 0
    const selectedIndex = selectedStore ? stores.findIndex((s) => s.name === selectedStore) : -1;
    const targetIndex = selectedIndex >= 0 ? selectedIndex : 0;

    setFocusedIndex(targetIndex);
    initialFocusSetRef.current = true;

    // Focus the store item
    requestAnimationFrame(() => {
      const storeItems = listRef.current?.querySelectorAll('[data-store-item]');
      (storeItems?.[targetIndex] as HTMLElement)?.focus();
    });
  }, [stores, selectedStore]);

  // Track focus entering/leaving the list
  const handleListFocus = () => {
    hadFocusInListRef.current = true;
  };
  const handleListBlur = (e: React.FocusEvent) => {
    // Only mark as lost focus if focus moved outside the list
    if (!listRef.current?.contains(e.relatedTarget as Node)) {
      hadFocusInListRef.current = false;
    }
  };

  // Keep focus within list when stores change (e.g., after deletion)
  useEffect(() => {
    if (!stores || stores.length === 0) return;

    // Adjust focusedIndex if out of bounds
    if (focusedIndex >= stores.length) {
      const newIndex = stores.length - 1;
      setFocusedIndex(newIndex);

      // Restore focus if it was in the list before the change
      if (hadFocusInListRef.current) {
        requestAnimationFrame(() => {
          const storeItems = listRef.current?.querySelectorAll('[data-store-item]');
          (storeItems?.[newIndex] as HTMLElement)?.focus();
        });
      }
    }
  }, [stores, focusedIndex]);

  const handleDelete = (e: React.MouseEvent | React.KeyboardEvent, store: FileSearchStore) => {
    e.stopPropagation();
    if (store.protected) {
      return;
    }
    if (confirm(`Are you sure you want to delete "${store.displayName}"?`)) {
      deleteStore.mutate(
        { storeName: store.name, force: true },
        {
          onSuccess: () => {
            if (onStoreDeleted) {
              onStoreDeleted(store.name);
            }
          },
        }
      );
    }
  };

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, store: FileSearchStore, index: number, totalItems: number) => {
      const storeItems = listRef.current?.querySelectorAll('[data-store-item]');
      if (!storeItems) return;

      let newIndex = index;

      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          // Skip if store is protected
          if (store.protected) {
            break;
          }
          // Inline delete logic to avoid dependency issues
          if (confirm(`Are you sure you want to delete "${store.displayName}"?`)) {
            deleteStore.mutate(
              { storeName: store.name, force: true },
              {
                onSuccess: () => {
                  if (onStoreDeleted) {
                    onStoreDeleted(store.name);
                  }
                },
              }
            );
          }
          break;
        case 'ArrowDown':
        case 'j':
          e.preventDefault();
          newIndex = Math.min(index + 1, totalItems - 1);
          setFocusedIndex(newIndex);
          (storeItems[newIndex] as HTMLElement)?.focus();
          break;
        case 'ArrowUp':
        case 'k':
          e.preventDefault();
          newIndex = Math.max(index - 1, 0);
          setFocusedIndex(newIndex);
          (storeItems[newIndex] as HTMLElement)?.focus();
          break;
        case 'Home':
          e.preventDefault();
          setFocusedIndex(0);
          (storeItems[0] as HTMLElement)?.focus();
          break;
        case 'End':
          e.preventDefault();
          setFocusedIndex(totalItems - 1);
          (storeItems[totalItems - 1] as HTMLElement)?.focus();
          break;
      }
    },
    [deleteStore, onStoreDeleted]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">Failed to load stores: {error.message}</div>
    );
  }

  return (
    <nav className="space-y-3" aria-label="File Search Stores">
      <div className="flex items-center justify-between">
        <h2
          id="stores-heading"
          className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
        >
          Stores
        </h2>
        <Button
          ref={newStoreButtonRef}
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onCreateStore}
          aria-label="Create new store"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {!stores?.length ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Database className="h-8 w-8 text-muted-foreground/50 mb-3" aria-hidden="true" />
          <p className="text-muted-foreground text-xs mb-2">No stores yet</p>
          <Button variant="outline" size="sm" onClick={onCreateStore} className="text-xs">
            <Plus className="h-3 w-3 mr-1" />
            New Store
          </Button>
        </div>
      ) : (
        <div
          ref={listRef}
          role="listbox"
          aria-labelledby="stores-heading"
          aria-activedescendant={selectedStore ? `store-${selectedStore}` : undefined}
          className="space-y-0.5"
          onFocus={handleListFocus}
          onBlur={handleListBlur}
        >
          {stores.map((store, index) => {
            const isSelected = selectedStore === store.name;
            // Roving tabindex: only the focused item is tabbable
            const isTabbable = index === focusedIndex;
            const storeId = store.name.replace('fileSearchStores/', '');
            return (
              <Link
                key={store.name}
                to={`/stores/${storeId}?tab=files`}
                id={`store-${store.name}`}
                data-store-item
                role="option"
                aria-selected={isSelected}
                tabIndex={isTabbable ? 0 : -1}
                className={`group flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 ${
                  isSelected
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted/80 text-foreground/80 hover:text-foreground'
                }`}
                onClick={() => setFocusedIndex(index)}
                onKeyDown={(e) => handleKeyDown(e, store, index, stores.length)}
                onFocus={() => setFocusedIndex(index)}
              >
                <Database
                  className={`h-4 w-4 flex-none ${isSelected ? 'text-accent-foreground' : 'text-muted-foreground'}`}
                  aria-hidden="true"
                />
                <span className="flex-1 truncate text-xs font-medium">{store.displayName}</span>
                {!store.protected && (
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => handleDelete(e, store)}
                    disabled={deleteStore.isPending}
                    className="flex-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 p-0.5 rounded hover:bg-destructive/20 transition-opacity"
                    aria-label={`Delete ${store.displayName}`}
                  >
                    {deleteStore.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2
                        className="h-3 w-3 text-muted-foreground hover:text-destructive"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* Keyboard shortcuts hint */}
      {stores && stores.length > 0 && (
        <p className="text-[10px] text-muted-foreground/60 pt-2 border-t" aria-live="polite">
          <kbd className="px-1 py-0.5 bg-muted/50 rounded text-[9px]">↑↓</kbd> navigate{' '}
          <kbd className="px-1 py-0.5 bg-muted/50 rounded text-[9px]">⏎</kbd> select{' '}
          <kbd className="px-1 py-0.5 bg-muted/50 rounded text-[9px]">⌫</kbd> delete
        </p>
      )}
    </nav>
  );
}
