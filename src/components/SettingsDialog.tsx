import * as React from 'react';
import { db } from '../db/schema';
import { platform } from '@platform';
import { exportToJson, importFromJson } from '../import-export/json';
import { exportToNetscape, importFromNetscape } from '../import-export/netscape';
import { FileUp, FileDown, ShieldAlert, Check, RefreshCw, Settings, Trash2 } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button
} from './ui';

interface SettingsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportSummary {
  addedPages: number;
  addedSections: number;
  addedLinks: number;
  skippedLinks: number;
  flattenedFoldersCount: number;
}

export function SettingsDialog({ isOpen, onOpenChange }: SettingsDialogProps) {
  const { hideHostnames, setHideHostnames } = useSettings();
  const [importMode, setImportMode] = React.useState<'merge' | 'replace'>('merge');
  const [importSummary, setImportSummary] = React.useState<ImportSummary | null>(null);
  const [summaryOpen, setSummaryOpen] = React.useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = React.useState(false);

  // File Input References
  const jsonInputRef = React.useRef<HTMLInputElement>(null);
  const htmlInputRef = React.useRef<HTMLInputElement>(null);

  // Export JSON Handler
  const handleExportJson = async () => {
    try {
      const dataStr = await exportToJson();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `linkhub_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Failed to export backup: ' + e);
    }
  };

  // Export HTML Handler
  const handleExportHtml = async () => {
    try {
      const pages = await db.pages.toArray();
      const sections = await db.sections.toArray();
      const links = await db.links.toArray();

      const htmlContent = exportToNetscape(pages, sections, links);
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `linkhub_bookmarks_${new Date().toISOString().split('T')[0]}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Failed to export bookmarks: ' + e);
    }
  };

  // JSON Import parser
  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const summary = await importFromJson(text, importMode);
        setImportSummary(summary);
        setSummaryOpen(true);
        onOpenChange(false); // Close settings
      } catch (err: any) {
        alert('JSON Import Error: ' + err.message);
      }
    };
    reader.readAsText(file);
    // Reset file value
    e.target.value = '';
  };

  // HTML Bookmark parser
  const handleImportHtmlFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const summary = await importFromNetscape(text, importMode);
        setImportSummary(summary);
        setSummaryOpen(true);
        onOpenChange(false); // Close settings
      } catch (err: any) {
        alert('HTML Bookmark Import Error: ' + err.message);
      }
    };
    reader.readAsText(file);
    // Reset file value
    e.target.value = '';
  };

  // Database Wipe Handler
  const handleWipeDatabase = async () => {
    await db.transaction('rw', [db.pages, db.sections, db.links, db.faviconCache], async () => {
      await db.pages.clear();
      await db.sections.clear();
      await db.links.clear();
      await db.faviconCache.clear();
    });
    setIsResetConfirmOpen(false);
    onOpenChange(false);
    // Force reload to flush FlexSearch indexes
    window.location.reload();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-violet-400 animate-spin-slow" />
              LinkHub Dashboard Settings
            </DialogTitle>
            <DialogDescription>
              Configure import/export, data syncing, or perform database maintenance.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Platform indicator */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card text-xs">
              <span className="text-muted-foreground font-semibold uppercase tracking-wider">
                Environment Build
              </span>
              <span className="px-2 py-0.5 rounded font-bold bg-violet-950/40 border border-violet-800/30 text-violet-400 font-mono">
                {platform.isExtension ? 'Chrome Extension (MV3)' : 'Standalone Web Site'}
              </span>
            </div>

            {/* Display Preferences */}
            <div className="space-y-3 border border-border p-3.5 rounded-xl bg-muted/20">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Display Preferences
              </span>
              <div className="flex items-center justify-between mt-1 select-none">
                <span className="text-xs font-semibold text-foreground">Hide Bookmark Hostnames</span>
                <button
                  type="button"
                  onClick={() => setHideHostnames(!hideHostnames)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    hideHostnames ? 'bg-violet-600' : 'bg-slate-750'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      hideHostnames ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Import Mode Settings */}
            <div className="space-y-2 border border-border p-3.5 rounded-xl bg-muted/20">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Import Behavior
              </span>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setImportMode('merge')}
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-semibold transition-all ${
                    importMode === 'merge'
                      ? 'border-violet-500 bg-violet-600/10 text-violet-400 font-bold'
                      : 'border-border bg-transparent text-muted-foreground hover:border-slate-400 dark:hover:border-slate-700'
                  }`}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Merge & Dedup (Safe)
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('replace')}
                  className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs font-semibold transition-all ${
                    importMode === 'replace'
                      ? 'border-red-500 bg-red-600/10 text-red-400 font-bold'
                      : 'border-border bg-transparent text-muted-foreground hover:border-slate-400 dark:hover:border-slate-700'
                  }`}
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Replace Everything
                </button>
              </div>
            </div>

            {/* Import Actions */}
            <div className="grid grid-cols-2 gap-3.5">
              {/* Native JSON */}
              <div className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-card text-center">
                <span className="text-xs font-bold text-muted-foreground">Native Backups (Lossless)</span>
                <input
                  type="file"
                  accept=".json"
                  ref={jsonInputRef}
                  onChange={handleImportJsonFile}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => jsonInputRef.current?.click()}
                  className="h-8.5 text-xs font-semibold gap-1.5"
                >
                  <FileUp className="h-3.5 w-3.5" />
                  Import JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportJson}
                  className="h-8.5 text-xs font-semibold gap-1.5 border-border bg-transparent hover:bg-muted/40"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Export JSON
                </Button>
              </div>

              {/* Netscape HTML */}
              <div className="flex flex-col gap-2 p-3 rounded-xl border border-border bg-card text-center">
                <span className="text-xs font-bold text-muted-foreground">Netscape Bookmarks</span>
                <input
                  type="file"
                  accept=".html"
                  ref={htmlInputRef}
                  onChange={handleImportHtmlFile}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => htmlInputRef.current?.click()}
                  className="h-8.5 text-xs font-semibold gap-1.5"
                  title="Folders deeper than 2 levels will be flattened into tags"
                >
                  <FileUp className="h-3.5 w-3.5" />
                  Import HTML
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportHtml}
                  className="h-8.5 text-xs font-semibold gap-1.5 border-border bg-transparent hover:bg-muted/40"
                  title="Tags are not preserved in Netscape HTML standard format"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Export HTML
                </Button>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground bg-muted/10 p-2.5 rounded-lg border border-border select-none leading-relaxed">
              <strong>Notice:</strong> Standard HTML format does not store tags. 
              Importing deep nesting HTML folders automatically flattens folders deeper than 2 levels into tag lists (e.g. <code>Work/Reading/ML</code>) to keep sections tidy. Use <strong>JSON</strong> format for complete, lossless backups.
            </div>

            <div className="border-t border-border pt-4 flex justify-between items-center">
              <Button
                variant="danger"
                size="sm"
                className="text-xs font-semibold gap-1.5 h-9 bg-red-950/30 border border-red-800/40 text-red-400 hover:bg-red-900/20"
                onClick={() => setIsResetConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Factory Hard Reset
              </Button>
              
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====================================================================
          POST IMPORT REPORT MODAL
          ==================================================================== */}
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-950 border border-emerald-800 text-emerald-400 mb-2">
              <Check className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center w-full">Import Completed Successfully</DialogTitle>
            <DialogDescription className="text-center w-full">
              Your bookmarks have been parsed and loaded into IndexedDB.
            </DialogDescription>
          </DialogHeader>

          {importSummary && (
            <div className="grid grid-cols-2 gap-2 text-left p-3.5 bg-slate-950/60 rounded-xl border border-slate-900 text-xs font-semibold font-mono space-y-0.5">
              <div className="text-slate-400">Pages Created:</div>
              <div className="text-slate-100 text-right">{importSummary.addedPages}</div>

              <div className="text-slate-400">Sections Created:</div>
              <div className="text-slate-100 text-right">{importSummary.addedSections}</div>

              <div className="text-slate-400">Links Created:</div>
              <div className="text-slate-100 text-right text-emerald-400">+{importSummary.addedLinks}</div>

              <div className="text-slate-400">Duplicates Skipped:</div>
              <div className="text-slate-100 text-right text-slate-500">{importSummary.skippedLinks}</div>

              {importSummary.flattenedFoldersCount > 0 && (
                <>
                  <div className="text-slate-400">Deep folders flattened to tags:</div>
                  <div className="text-slate-100 text-right text-violet-400">{importSummary.flattenedFoldersCount}</div>
                </>
              )}
            </div>
          )}

          <div className="flex justify-center pt-2">
            <Button onClick={() => setSummaryOpen(false)}>
              Awesome
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====================================================================
          WIPE CONFIRMATION DIALOG
          ==================================================================== */}
      <Dialog open={isResetConfirmOpen} onOpenChange={setIsResetConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-950 border border-red-800 text-red-400 mb-2">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center w-full text-red-500">Wipe All Bookmark Data?</DialogTitle>
            <DialogDescription className="text-center w-full">
              This action is destructive and will completely delete all Pages, Sections, Bookmarks, and Favicon caches.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center gap-3 pt-3">
            <Button variant="outline" onClick={() => setIsResetConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleWipeDatabase}>
              Permanently Clear All
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
