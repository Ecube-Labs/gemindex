import { useState, useEffect } from 'react';
import {
  Routes,
  Route,
  Navigate,
  useParams,
  useNavigate,
  useSearchParams,
  useLocation,
} from 'react-router-dom';
import { Sun, Moon, Monitor, Database, Search, FolderOpen } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { StoreList } from '@/components/stores/store-list';
import { CreateStoreDialog } from '@/components/stores/create-store-dialog';
import { FileList } from '@/components/files/file-list';
import { SearchPanel } from '@/components/search/search-panel';
import { useTheme } from '@/hooks/use-theme';

function StoreDetails() {
  const { storeId } = useParams<{ storeId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get('tab') || 'files';
  const storeName = storeId ? `fileSearchStores/${storeId}` : null;

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  if (!storeName) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Select a store to view its contents
      </div>
    );
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      activationMode="manual"
      className="flex flex-col h-full"
    >
      <div className="flex-none border-b bg-muted/30 px-4 py-2">
        <TabsList className="h-8">
          <TabsTrigger value="files" className="gap-1.5 text-xs">
            <FolderOpen className="h-3.5 w-3.5" />
            Files
          </TabsTrigger>
          <TabsTrigger value="search" className="gap-1.5 text-xs">
            <Search className="h-3.5 w-3.5" />
            Search
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="files" className="flex-1 m-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4">
            <FileList storeName={storeName} />
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="search" className="flex-1 m-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4">
            <SearchPanel storeName={storeName} />
          </div>
        </ScrollArea>
      </TabsContent>
    </Tabs>
  );
}

function NoStoreSelected() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
      <Database className="h-12 w-12 opacity-30" />
      <p>Select a store to view its contents</p>
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const label = theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System';
  const nextTheme = theme === 'light' ? 'Dark' : theme === 'dark' ? 'System' : 'Light';

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={cycleTheme}
            className="h-7 w-7"
            aria-label={`Current theme: ${label}. Click to change theme.`}
          >
            {theme === 'light' && <Sun className="h-4 w-4" aria-hidden="true" />}
            {theme === 'dark' && <Moon className="h-4 w-4" aria-hidden="true" />}
            {theme === 'system' && <Monitor className="h-4 w-4" aria-hidden="true" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">
            Theme: <span className="font-medium">{label}</span>
          </p>
          <p className="text-[10px] opacity-70">Click to switch to {nextTheme}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
    >
      Skip to main content
    </a>
  );
}

function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [createStoreOpen, setCreateStoreOpen] = useState(false);

  // Extract storeId from pathname: /stores/:storeId
  const pathMatch = location.pathname.match(/^\/stores\/([^/?]+)/);
  const storeId = pathMatch ? pathMatch[1] : null;

  // Global keyboard shortcut: Cmd/Ctrl+K to go to search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (storeId) {
          // Navigate to search tab and focus search input
          navigate(`/stores/${storeId}?tab=search`);
          // Focus search input after navigation
          setTimeout(() => {
            const searchInput = document.querySelector<HTMLInputElement>(
              '[aria-label="Search query"]'
            );
            searchInput?.focus();
          }, 100);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [storeId, navigate]);

  const handleStoreCreated = (storeName: string) => {
    const id = storeName.replace('fileSearchStores/', '');
    navigate(`/stores/${id}?tab=files`);
  };

  const handleStoreDeleted = (deletedStoreName: string) => {
    // Navigate to /stores if the deleted store was selected
    const deletedId = deletedStoreName.replace('fileSearchStores/', '');
    if (storeId === deletedId) {
      navigate('/stores', { replace: true });
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <SkipLink />

      {/* Title Bar */}
      <header className="flex-none h-10 border-b bg-muted/40 flex items-center px-3" role="banner">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <h1 className="text-sm font-semibold">GemIndex</h1>
        </div>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className="flex-none w-64 border-r bg-muted/20 flex flex-col"
          role="complementary"
          aria-label="Store navigation"
        >
          <ScrollArea className="flex-1">
            <div className="p-3">
              <StoreList
                onCreateStore={() => setCreateStoreOpen(true)}
                onStoreDeleted={handleStoreDeleted}
              />
            </div>
          </ScrollArea>
        </aside>

        {/* Main Content */}
        <main
          id="main-content"
          className="flex-1 flex flex-col overflow-hidden"
          role="main"
          tabIndex={-1}
        >
          <Routes>
            <Route path="/" element={<NoStoreSelected />} />
            <Route path="/:storeId" element={<StoreDetails />} />
          </Routes>
        </main>
      </div>

      {/* Dialogs */}
      <CreateStoreDialog
        open={createStoreOpen}
        onOpenChange={setCreateStoreOpen}
        onCreated={handleStoreCreated}
      />
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/stores" replace />} />
      <Route path="/stores/*" element={<DashboardLayout />} />
    </Routes>
  );
}

export default App;
