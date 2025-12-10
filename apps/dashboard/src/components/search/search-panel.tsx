import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Search,
  Loader2,
  MessageSquare,
  FileText,
  Settings2,
  Save,
  Trash2,
  RotateCcw,
  Quote,
  Keyboard,
  Sparkles,
  BookmarkPlus,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSearch } from '@/hooks/use-search';
import { useSearchPresets, AVAILABLE_MODELS } from '@/hooks/use-search-presets';
import type { SearchResponse, GroundingSource, GroundingSupport } from '@/types/api';

interface SearchPanelProps {
  storeName: string | null;
}

function SourceCard({
  index,
  source,
  isExpanded,
  onToggle,
  isCited,
  citedTexts,
  onNavigate,
  totalSources,
}: {
  index: number;
  source: GroundingSource;
  isExpanded: boolean;
  onToggle: () => void;
  isCited: boolean;
  citedTexts: string[];
  onNavigate?: (direction: 'prev' | 'next' | 'first' | 'last') => void;
  totalSources: number;
}) {
  // Extract first meaningful line as preview
  const preview = source.text.split('\n').find((line) => line.trim().length > 0) || '';

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        onToggle();
        break;
      case 'ArrowDown':
        e.preventDefault();
        onNavigate?.('next');
        break;
      case 'ArrowUp':
        e.preventDefault();
        onNavigate?.('prev');
        break;
      case 'Home':
        e.preventDefault();
        onNavigate?.('first');
        break;
      case 'End':
        e.preventDefault();
        onNavigate?.('last');
        break;
    }
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-expanded={isExpanded}
      aria-label={`Source ${index + 1} of ${totalSources}: ${source.title}${isCited ? '' : ' (not cited)'}${isExpanded ? ', expanded' : ', collapsed'}`}
      className={`cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${isExpanded ? 'ring-2 ring-primary' : 'hover:bg-muted/50'} ${!isCited ? 'opacity-50' : ''}`}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
    >
      <CardHeader className="p-3 pb-2">
        <div className="flex items-start gap-2">
          <span
            className={`flex items-center justify-center w-5 h-5 text-[10px] font-medium rounded-full flex-shrink-0 ${isCited ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            aria-hidden="true"
          >
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-medium truncate">
              {source.title}
              {!isCited && <span className="text-xs text-muted-foreground ml-2">(not cited)</span>}
            </CardTitle>
            {!isExpanded && (
              <CardDescription className="text-xs mt-1 line-clamp-2">{preview}</CardDescription>
            )}
          </div>
          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="p-3 pt-0 space-y-3">
          {/* Cited texts from supports */}
          {citedTexts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Quote className="h-3 w-3" aria-hidden="true" />
                Cited in response ({citedTexts.length})
              </div>
              <div className="space-y-1.5" role="list" aria-label="Cited texts">
                {citedTexts.map((text, i) => (
                  <div
                    key={i}
                    role="listitem"
                    className="text-xs bg-primary/5 border-l-2 border-primary/30 pl-2 py-1 rounded-r"
                  >
                    {`"${text}"`}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Source chunk text */}
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Source chunk</div>
            <ScrollArea className="h-40">
              <div className="text-xs text-muted-foreground whitespace-pre-wrap pr-4">
                {source.text}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function SearchPanel({ storeName }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [expandedSource, setExpandedSource] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [showShortcuts, setShowShortcuts] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const sourceCardsRef = useRef<HTMLDivElement>(null);

  const search = useSearch();
  const { presets, settings, setSettings, resetSettings, savePreset, loadPreset, deletePreset } =
    useSearchPresets();

  // Global keyboard shortcuts for search panel
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      // Cmd/Ctrl + Enter: Submit search (when input focused)
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === 'Enter' &&
        document.activeElement === searchInputRef.current
      ) {
        e.preventDefault();
        if (query.trim() && storeName) {
          const form = searchInputRef.current?.closest('form');
          form?.requestSubmit();
        }
        return;
      }

      if (isInput) return;

      // Escape: Close settings
      if (e.key === 'Escape') {
        if (settingsOpen) {
          setSettingsOpen(false);
        }
        return;
      }

      // S: Toggle settings
      if (e.key === 's' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSettingsOpen((prev) => !prev);
        return;
      }

      // ?: Show keyboard shortcuts
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }

      // Number keys 1-9: Jump to source
      if (/^[1-9]$/.test(e.key) && result?.sources.length) {
        const sourceIndex = parseInt(e.key, 10) - 1;
        if (sourceIndex < result.sources.length) {
          e.preventDefault();
          setExpandedSource(expandedSource === sourceIndex ? null : sourceIndex);
          // Focus the source card
          setTimeout(() => {
            const cards = sourceCardsRef.current?.querySelectorAll('[role="button"]');
            (cards?.[sourceIndex] as HTMLElement)?.focus();
          }, 0);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [query, storeName, settingsOpen, result, expandedSource]);

  // Focus search input when component mounts or becomes visible
  useEffect(() => {
    // Small delay to ensure the component is fully rendered
    const timer = setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeName || !query.trim()) return;

    setExpandedSource(null);
    search.mutate(
      {
        storeName,
        query: query.trim(),
        systemPrompt: settings.systemPrompt || undefined,
        model: settings.model || undefined,
        temperature: settings.temperature,
        topP: settings.topP,
        topK: settings.topK,
        maxOutputTokens: settings.maxOutputTokens,
      },
      {
        onSuccess: (data) => {
          setResult(data);
        },
      }
    );
  };

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    savePreset(presetName.trim());
    setPresetName('');
  };

  const scrollToSource = useCallback((index: number) => {
    setExpandedSource(index);
    // Scroll to sources section
    document.getElementById('sources-section')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Navigate between source cards
  const handleSourceNavigate = useCallback(
    (currentIndex: number, direction: 'prev' | 'next' | 'first' | 'last') => {
      if (!result?.sources.length) return;
      let newIndex: number;
      switch (direction) {
        case 'prev':
          newIndex = Math.max(0, currentIndex - 1);
          break;
        case 'next':
          newIndex = Math.min(result.sources.length - 1, currentIndex + 1);
          break;
        case 'first':
          newIndex = 0;
          break;
        case 'last':
          newIndex = result.sources.length - 1;
          break;
      }
      setTimeout(() => {
        const cards = sourceCardsRef.current?.querySelectorAll('[role="button"]');
        (cards?.[newIndex] as HTMLElement)?.focus();
      }, 0);
    },
    [result]
  );

  if (!storeName) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Search className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Select a store to search</p>
        </CardContent>
      </Card>
    );
  }

  // Render text with inline source citations
  const renderTextWithSources = (
    text: string,
    sources: GroundingSource[],
    supports: GroundingSupport[]
  ) => {
    if (!supports.length) {
      return (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      );
    }

    // Convert byte index to character index
    // Gemini API returns UTF-8 byte indices, but JS strings use UTF-16 characters
    const byteToCharIndex = (byteIndex: number): number => {
      const encoder = new TextEncoder(); // UTF-8 encoder
      let byteCount = 0;
      for (let charIdx = 0; charIdx < text.length; charIdx++) {
        if (byteCount >= byteIndex) {
          return charIdx;
        }
        // Get UTF-8 byte length of this character
        const char = text[charIdx];
        if (char) {
          byteCount += encoder.encode(char).length;
        }
      }
      return text.length;
    };

    // Sort supports by startIndex
    const sortedSupports = [...supports].sort((a, b) => a.startIndex - b.startIndex);

    // Build marked text by inserting markers at support boundaries
    // Use format: ⸢idx:sources⸣ at START and ⸣idx⸢ at END to wrap the cited region
    // Insert in reverse order to preserve positions
    let markedText = text;
    for (let i = sortedSupports.length - 1; i >= 0; i--) {
      const support = sortedSupports[i];
      if (!support) continue;
      const uniqueIndices = [...new Set(support.chunkIndices)];
      // Convert byte indices to character indices
      const charStartIndex = byteToCharIndex(support.startIndex);
      const charEndIndex = byteToCharIndex(support.endIndex);
      // Format: ⸢idx:sources⸣...cited text...⸣idx⸢
      const startMarker = `⸢${i}:${uniqueIndices.join(',')}⸣`;
      const endMarker = `⸣${i}⸢`;
      markedText =
        markedText.slice(0, charStartIndex) +
        startMarker +
        markedText.slice(charStartIndex, charEndIndex) +
        endMarker +
        markedText.slice(charEndIndex);
    }

    // Render source badge with support text context
    const renderSourceBadge = (sourceIndex: number, _supportIdx: number, keyPrefix: string) => {
      const source = sources[sourceIndex];

      return (
        <Tooltip key={`${keyPrefix}-tooltip`}>
          <TooltipTrigger asChild>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                scrollToSource(sourceIndex);
              }}
              className="inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-primary text-primary-foreground rounded-full hover:bg-primary/80 transition-colors cursor-pointer align-super ml-0.5"
            >
              {sourceIndex + 1}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-sm p-0 overflow-hidden">
            <div className="bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium flex items-center gap-2">
              <FileText className="h-3 w-3" />
              {source?.title ?? 'Unknown source'}
            </div>
            {source?.text && (
              <div className="px-3 py-2 text-xs text-popover-foreground line-clamp-3">
                {source.text.slice(0, 150)}
                {source.text.length > 150 ? '...' : ''}
              </div>
            )}
            <div className="px-3 py-1.5 bg-muted/50 text-[10px] text-popover-foreground/70">
              Click to view full source
            </div>
          </TooltipContent>
        </Tooltip>
      );
    };

    // Custom component to render markers as highlighted citations with badges
    const renderContent = (content: string): React.ReactNode[] => {
      const result: React.ReactNode[] = [];
      // Pattern: ⸢supportIdx:source1,source2,...⸣...cited text...⸣supportIdx⸢
      // We need to match start marker, capture content, and end marker
      const startPattern = /⸢(\d+):([^⸣]*)⸣/g;

      let lastIndex = 0;
      let match;

      while ((match = startPattern.exec(content)) !== null) {
        // Add text before this marker
        if (match.index > lastIndex) {
          result.push(content.slice(lastIndex, match.index));
        }

        // Parse the start marker
        const supportIdxStr = match[1] ?? '0';
        const supportIdx = parseInt(supportIdxStr, 10);
        const sourceIndicesStr = match[2] ?? '';
        const sourceIndices = sourceIndicesStr
          ? sourceIndicesStr
              .split(',')
              .map((s) => parseInt(s, 10))
              .filter((n) => !isNaN(n))
          : [];

        // Find the corresponding end marker
        const endMarker = `⸣${supportIdx}⸢`;
        const contentStartIdx = match.index + match[0].length;
        const endMarkerIdx = content.indexOf(endMarker, contentStartIdx);

        if (endMarkerIdx !== -1) {
          // Extract the cited text between markers
          const citedText = content.slice(contentStartIdx, endMarkerIdx);

          // Render highlighted citation with badges
          result.push(
            <span
              key={`citation-${supportIdx}`}
              className="bg-primary/10 border-b border-primary/30 rounded-sm px-0.5 -mx-0.5"
            >
              {citedText}
              {sourceIndices.map((sourceIndex, badgeIdx) =>
                renderSourceBadge(sourceIndex, supportIdx, `s${supportIdx}-b${badgeIdx}`)
              )}
            </span>
          );

          lastIndex = endMarkerIdx + endMarker.length;
          // Reset regex to continue from after the end marker
          startPattern.lastIndex = lastIndex;
        } else {
          // No end marker found, just render badges after start marker
          sourceIndices.forEach((sourceIndex, badgeIdx) => {
            result.push(renderSourceBadge(sourceIndex, supportIdx, `s${supportIdx}-b${badgeIdx}`));
          });
          lastIndex = match.index + match[0].length;
        }
      }

      // Add remaining text (also clean up any orphan end markers)
      if (lastIndex < content.length) {
        const remaining = content.slice(lastIndex).replace(/⸣\d+⸢/g, '');
        if (remaining) {
          result.push(remaining);
        }
      }

      return result;
    };

    // Recursively process React children
    const processNode = (node: React.ReactNode): React.ReactNode => {
      if (typeof node === 'string') {
        if (node.includes('⸢')) {
          return <>{renderContent(node)}</>;
        }
        return node;
      }
      if (Array.isArray(node)) {
        return node.map((child, i) => <span key={i}>{processNode(child)}</span>);
      }
      return node;
    };

    return (
      <TooltipProvider delayDuration={300}>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children, ...props }) => <p {...props}>{processNode(children)}</p>,
              li: ({ children, ...props }) => <li {...props}>{processNode(children)}</li>,
              td: ({ children, ...props }) => <td {...props}>{processNode(children)}</td>,
              th: ({ children, ...props }) => <th {...props}>{processNode(children)}</th>,
              strong: ({ children, ...props }) => (
                <strong {...props}>{processNode(children)}</strong>
              ),
              em: ({ children, ...props }) => <em {...props}>{processNode(children)}</em>,
              h1: ({ children, ...props }) => <h1 {...props}>{processNode(children)}</h1>,
              h2: ({ children, ...props }) => <h2 {...props}>{processNode(children)}</h2>,
              h3: ({ children, ...props }) => <h3 {...props}>{processNode(children)}</h3>,
              h4: ({ children, ...props }) => <h4 {...props}>{processNode(children)}</h4>,
              blockquote: ({ children, ...props }) => (
                <blockquote {...props}>{processNode(children)}</blockquote>
              ),
            }}
          >
            {markedText}
          </ReactMarkdown>
        </div>
      </TooltipProvider>
    );
  };

  return (
    <section className="space-y-3" aria-label="Search panel">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        {/* Settings Popover */}
        <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-8"
              aria-label={`Search settings${settings.systemPrompt || settings.model !== 'gemini-2.0-flash' ? ' (customized)' : ''}`}
              aria-expanded={settingsOpen}
              aria-haspopup="dialog"
            >
              <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="text-xs">Settings</span>
              {(settings.systemPrompt || settings.model !== 'gemini-2.0-flash') && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-hidden="true" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-96 p-0"
            align="start"
            role="dialog"
            aria-label="Search settings"
            onOpenAutoFocus={(e) => {
              // Focus the first tab trigger on open
              e.preventDefault();
              const target = e.currentTarget as HTMLElement | null;
              const firstTab = target?.querySelector('[role="tab"]');
              (firstTab as HTMLElement)?.focus();
            }}
            onCloseAutoFocus={(e) => {
              // Ensure focus returns to trigger
              e.preventDefault();
            }}
          >
            <Tabs defaultValue="model" className="w-full">
              <div className="border-b px-3 py-2 flex items-center justify-between">
                <TabsList className="h-8 p-0.5" aria-label="Settings categories">
                  <TabsTrigger value="model" className="text-xs h-7 px-2.5 gap-1.5">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    Model
                  </TabsTrigger>
                  <TabsTrigger value="prompt" className="text-xs h-7 px-2.5 gap-1.5">
                    <MessageSquare className="h-3 w-3" aria-hidden="true" />
                    Prompt
                  </TabsTrigger>
                  <TabsTrigger value="presets" className="text-xs h-7 px-2.5 gap-1.5">
                    <BookmarkPlus className="h-3 w-3" aria-hidden="true" />
                    Presets
                  </TabsTrigger>
                </TabsList>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={resetSettings}
                  aria-label="Reset all settings to defaults"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                </Button>
              </div>

              {/* Model Tab */}
              <TabsContent value="model" className="m-0 p-3 space-y-4" tabIndex={-1}>
                <div className="space-y-2">
                  <Label htmlFor="model-select" className="text-xs font-medium">
                    Model
                  </Label>
                  <Select
                    value={settings.model}
                    onValueChange={(value) => setSettings((prev) => ({ ...prev, model: value }))}
                  >
                    <SelectTrigger id="model-select" className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_MODELS.map((model) => (
                        <SelectItem key={model} value={model} className="text-xs">
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <fieldset className="grid grid-cols-2 gap-3">
                  <legend className="sr-only">Generation parameters</legend>

                  {/* Temperature */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="temperature-slider" className="text-xs font-medium">
                        Temperature
                      </Label>
                      <output
                        id="temperature-value"
                        htmlFor="temperature-slider"
                        className="text-[10px] text-muted-foreground font-mono"
                      >
                        {settings.temperature?.toFixed(2) ?? '1.00'}
                      </output>
                    </div>
                    <Slider
                      id="temperature-slider"
                      value={[settings.temperature ?? 1.0]}
                      onValueChange={([value]) =>
                        setSettings((prev) => ({ ...prev, temperature: value }))
                      }
                      min={0}
                      max={2}
                      step={0.05}
                      className="w-full"
                      aria-label="Temperature"
                      aria-valuemin={0}
                      aria-valuemax={2}
                      aria-valuenow={settings.temperature ?? 1.0}
                      aria-valuetext={`${settings.temperature?.toFixed(2) ?? '1.00'}`}
                    />
                  </div>

                  {/* Top P */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="topp-slider" className="text-xs font-medium">
                        Top P
                      </Label>
                      <output
                        id="topp-value"
                        htmlFor="topp-slider"
                        className="text-[10px] text-muted-foreground font-mono"
                      >
                        {settings.topP?.toFixed(2) ?? '0.95'}
                      </output>
                    </div>
                    <Slider
                      id="topp-slider"
                      value={[settings.topP ?? 0.95]}
                      onValueChange={([value]) => setSettings((prev) => ({ ...prev, topP: value }))}
                      min={0}
                      max={1}
                      step={0.05}
                      className="w-full"
                      aria-label="Top P"
                      aria-valuemin={0}
                      aria-valuemax={1}
                      aria-valuenow={settings.topP ?? 0.95}
                      aria-valuetext={`${settings.topP?.toFixed(2) ?? '0.95'}`}
                    />
                  </div>

                  {/* Top K */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="topk-slider" className="text-xs font-medium">
                        Top K
                      </Label>
                      <output
                        id="topk-value"
                        htmlFor="topk-slider"
                        className="text-[10px] text-muted-foreground font-mono"
                      >
                        {settings.topK ?? 40}
                      </output>
                    </div>
                    <Slider
                      id="topk-slider"
                      value={[settings.topK ?? 40]}
                      onValueChange={([value]) =>
                        setSettings((prev) => ({ ...prev, topK: Math.round(value ?? 40) }))
                      }
                      min={1}
                      max={100}
                      step={1}
                      className="w-full"
                      aria-label="Top K"
                      aria-valuemin={1}
                      aria-valuemax={100}
                      aria-valuenow={settings.topK ?? 40}
                      aria-valuetext={`${settings.topK ?? 40}`}
                    />
                  </div>

                  {/* Max Tokens */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="maxtokens-slider" className="text-xs font-medium">
                        Max Tokens
                      </Label>
                      <output
                        id="maxtokens-value"
                        htmlFor="maxtokens-slider"
                        className="text-[10px] text-muted-foreground font-mono"
                      >
                        {settings.maxOutputTokens ?? 8192}
                      </output>
                    </div>
                    <Slider
                      id="maxtokens-slider"
                      value={[settings.maxOutputTokens ?? 8192]}
                      onValueChange={([value]) =>
                        setSettings((prev) => ({
                          ...prev,
                          maxOutputTokens: Math.round(value ?? 8192),
                        }))
                      }
                      min={256}
                      max={65536}
                      step={256}
                      className="w-full"
                      aria-label="Max output tokens"
                      aria-valuemin={256}
                      aria-valuemax={65536}
                      aria-valuenow={settings.maxOutputTokens ?? 8192}
                      aria-valuetext={`${settings.maxOutputTokens ?? 8192} tokens`}
                    />
                  </div>
                </fieldset>
              </TabsContent>

              {/* Prompt Tab */}
              <TabsContent value="prompt" className="m-0 p-3 space-y-3" tabIndex={-1}>
                <div className="space-y-2">
                  <Label htmlFor="system-prompt" className="text-xs font-medium">
                    System Prompt
                  </Label>
                  <Textarea
                    id="system-prompt"
                    placeholder="Instructions for the AI..."
                    value={settings.systemPrompt}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, systemPrompt: e.target.value }))
                    }
                    rows={6}
                    className="text-xs resize-none"
                    aria-describedby="system-prompt-hint"
                  />
                  <p id="system-prompt-hint" className="text-[10px] text-muted-foreground">
                    Provide instructions for how the AI should respond to queries.
                  </p>
                </div>
              </TabsContent>

              {/* Presets Tab */}
              <TabsContent value="presets" className="m-0 p-3 space-y-3" tabIndex={-1}>
                {/* Save New Preset */}
                <div className="space-y-2">
                  <Label htmlFor="preset-name" className="text-xs font-medium">
                    Save Current Settings
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="preset-name"
                      placeholder="Preset name..."
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSavePreset();
                      }}
                      className="h-8 text-xs"
                      aria-label="Preset name"
                    />
                    <Button
                      size="sm"
                      className="h-8 px-3"
                      onClick={handleSavePreset}
                      disabled={!presetName.trim()}
                      aria-label={
                        presetName.trim()
                          ? `Save preset "${presetName}"`
                          : 'Save preset (enter a name first)'
                      }
                    >
                      <Save className="h-3 w-3 mr-1" aria-hidden="true" />
                      Save
                    </Button>
                  </div>
                </div>

                {/* Preset List */}
                <div className="space-y-2">
                  <Label id="presets-list-label" className="text-xs font-medium">
                    Saved Presets
                  </Label>
                  {presets.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-4 text-center" role="status">
                      No presets saved yet
                    </p>
                  ) : (
                    <div
                      className="space-y-1 max-h-40 overflow-y-auto"
                      role="list"
                      aria-labelledby="presets-list-label"
                    >
                      {presets.map((preset) => (
                        <div
                          key={preset.id}
                          role="listitem"
                          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted focus-within:bg-muted group"
                        >
                          <button
                            className="flex-1 text-left text-xs truncate hover:text-primary focus:outline-none focus:text-primary"
                            onClick={() => {
                              loadPreset(preset.id);
                              setSettingsOpen(false);
                            }}
                            aria-label={`Load preset "${preset.name}"`}
                          >
                            {preset.name}
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100"
                            onClick={() => deletePreset(preset.id)}
                            aria-label={`Delete preset "${preset.name}"`}
                          >
                            <Trash2
                              className="h-3 w-3 text-muted-foreground hover:text-destructive"
                              aria-hidden="true"
                            />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </PopoverContent>
        </Popover>

        {/* Keyboard Shortcuts */}
        <Popover open={showShortcuts} onOpenChange={setShowShortcuts}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Keyboard shortcuts">
              <Keyboard className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3" align="start">
            <div className="space-y-2">
              <h4 className="text-xs font-medium">Keyboard Shortcuts</h4>
              <div className="grid gap-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Focus search</span>
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">⌘K</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Toggle settings</span>
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">S</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jump to source</span>
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">1-9</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Close panels</span>
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Esc</kbd>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <form
        onSubmit={handleSearch}
        className="flex gap-2"
        role="search"
        aria-labelledby="search-heading"
      >
        <Input
          ref={searchInputRef}
          placeholder="Ask a question about your documents... (Cmd/Ctrl+K)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={search.isPending}
          className="flex-1"
          aria-label="Search query"
          aria-describedby="search-hint"
        />
        <Button
          type="submit"
          disabled={!query.trim() || search.isPending}
          aria-label={search.isPending ? 'Searching...' : 'Search'}
        >
          {search.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="h-4 w-4" aria-hidden="true" />
          )}
          Search
        </Button>
      </form>
      <span id="search-hint" className="sr-only">
        Press Enter to search, or use Cmd/Ctrl+K to focus this field from anywhere
      </span>

      {search.error && (
        <Card className="border-destructive" role="alert" aria-live="assertive">
          <CardContent className="p-4">
            <p className="text-sm text-destructive">{search.error.message}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-4">
          {/* Response */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Response</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {renderTextWithSources(result.text, result.sources, result.supports)}
            </CardContent>
          </Card>

          {/* Sources */}
          {result.sources.length > 0 && (
            <div id="sources-section" className="space-y-3" aria-label="Sources section">
              {(() => {
                // Calculate which sources are actually cited and collect cited texts
                const citedIndices = new Set(result.supports.flatMap((s) => s.chunkIndices));
                const citedCount = citedIndices.size;

                // Build map of source index -> cited texts
                const sourceToCitedTexts = new Map<number, string[]>();
                result.supports.forEach((support) => {
                  support.chunkIndices.forEach((chunkIdx) => {
                    const existing = sourceToCitedTexts.get(chunkIdx) ?? [];
                    if (support.text && !existing.includes(support.text)) {
                      existing.push(support.text);
                    }
                    sourceToCitedTexts.set(chunkIdx, existing);
                  });
                });

                return (
                  <>
                    <div className="flex items-center justify-between">
                      <h3
                        id="sources-heading"
                        className="text-sm font-medium text-muted-foreground"
                      >
                        Sources ({citedCount} cited, {result.sources.length - citedCount} retrieved)
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        Press{' '}
                        <kbd className="px-1 py-0.5 bg-muted rounded border text-[10px]">1-9</kbd>{' '}
                        to jump
                      </span>
                    </div>
                    <div
                      ref={sourceCardsRef}
                      className="grid gap-2"
                      role="list"
                      aria-labelledby="sources-heading"
                    >
                      {result.sources.map((source, index) => (
                        <SourceCard
                          key={index}
                          index={index}
                          source={source}
                          isExpanded={expandedSource === index}
                          onToggle={() =>
                            setExpandedSource(expandedSource === index ? null : index)
                          }
                          isCited={citedIndices.has(index)}
                          citedTexts={sourceToCitedTexts.get(index) ?? []}
                          onNavigate={(direction) => handleSourceNavigate(index, direction)}
                          totalSources={result.sources.length}
                        />
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
