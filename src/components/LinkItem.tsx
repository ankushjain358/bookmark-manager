import * as React from 'react';
import { type Link } from '../db/schema';
import { getFavicon } from '../db/favicon';
import { deleteLink, updateLink } from '../db/operations';
import { useSettings } from '../context/SettingsContext';
import { MoreVertical, Edit2, Trash } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input
} from './ui';

interface LinkItemProps {
  link: Link;
}

export function LinkItem({ link }: LinkItemProps) {
  const { hideHostnames } = useSettings();
  const [faviconUrl, setFaviconUrl] = React.useState<string | null>(null);
  const [imgFailed, setImgFailed] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  // Edit Link Form State
  const [title, setTitle] = React.useState(link.title);
  const [url, setUrl] = React.useState(link.url);
  const [tagsStr, setTagsStr] = React.useState(link.tags ? link.tags.join(', ') : '');

  // Asynchronously resolve favicon from cache or API
  React.useEffect(() => {
    let active = true;
    setImgFailed(false);

    getFavicon(link.url, link.faviconDomain)
      .then(res => {
        if (active) setFaviconUrl(res);
      })
      .catch(() => {
        if (active) setFaviconUrl(null);
      });

    return () => {
      active = false;
    };
  }, [link.url, link.faviconDomain]);

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;

    const parsedTags = tagsStr
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    await updateLink(link.id!, {
      title: title.trim(),
      url: url.trim(),
      tags: parsedTags
    });
    setIsEditDialogOpen(false);
  };

  const handleDelete = async () => {
    await deleteLink(link.id!);
    setIsDeleteDialogOpen(false);
  };

  // Generate a nice letter avatar from title
  const letterAvatar = link.title ? link.title.charAt(0).toUpperCase() : '?';

  return (
    <div className={`group relative flex items-center justify-between rounded-xl border border-white/60 dark:border-white/5 bg-white/40 dark:bg-card/45 backdrop-blur-md hover:bg-white/75 dark:hover:bg-card/65 hover:border-violet-500/20 dark:hover:border-violet-500/20 hover:shadow-lg hover:shadow-violet-500/5 transition-all duration-300 ${hideHostnames ? 'p-1.5' : 'p-2'}`}>
      
      {/* Link Content Area */}
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3.5 min-w-0 flex-1 select-none"
      >
        {/* Favicon / Letter Avatar */}
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-card border border-border text-muted-foreground shrink-0 group-hover:border-violet-500/30 overflow-hidden transition-all duration-300">
          {faviconUrl && !imgFailed ? (
            <img
              src={faviconUrl}
              alt=""
              onError={() => setImgFailed(true)}
              className="h-5 w-5 object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-semibold bg-gradient-to-br from-violet-600/10 to-indigo-600/10 text-violet-400 font-mono">
              {letterAvatar}
            </div>
          )}
        </div>

        {/* Text */}
        <div className="flex flex-col min-w-0 leading-tight">
          <span className="font-medium text-foreground text-sm group-hover:text-violet-400 truncate transition-colors duration-200">
            {link.title}
          </span>
          {!hideHostnames && (
            <span className="text-[11px] text-muted-foreground truncate mt-0.5">
              {link.faviconDomain}
            </span>
          )}
        </div>
      </a>

      {/* Tags and Options Menu */}
      <div className="flex items-center gap-1">
        {/* Tag Pill Display */}
        {link.tags && link.tags.length > 0 && (
          <div className="hidden md:flex gap-1 max-w-[120px] overflow-hidden truncate">
            {link.tags.slice(0, 1).map(tag => (
              <span
                key={tag}
                className="text-[9px] px-2 py-0.5 rounded-full bg-card border border-border text-muted-foreground font-mono"
                title={link.tags?.join(', ')}
              >
                {tag}
              </span>
            ))}
            {link.tags.length > 1 && (
              <span 
                className="text-[9px] px-1.5 py-0.5 rounded-full bg-card border border-border text-muted-foreground/60 font-mono"
                title={link.tags.slice(1).join(', ')}
              >
                +{link.tags.length - 1}
              </span>
            )}
          </div>
        )}

        {/* Dropdown Operations */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-500 hover:text-white rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-300"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsEditDialogOpen(true)}>
              <Edit2 className="mr-2 h-3.5 w-3.5" />
              Edit Link
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setIsDeleteDialogOpen(true)}
              className="text-red-400 hover:text-red-300 focus:bg-red-950/20"
            >
              <Trash className="mr-2 h-3.5 w-3.5" />
              Delete Link
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ====================================================================
          EDIT DIALOG
          ==================================================================== */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Bookmark</DialogTitle>
            <DialogDescription>Modify your bookmark properties.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Title
              </label>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Google"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                URL
              </label>
              <Input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://google.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Tags (comma separated)
              </label>
              <Input
                value={tagsStr}
                onChange={e => setTagsStr(e.target.value)}
                placeholder="Search, Tech, Tools"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ====================================================================
          DELETE CONFIRMATION DIALOG
          ==================================================================== */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bookmark</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this bookmark? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-900 text-sm font-mono truncate text-slate-400">
            {link.title} ({link.url})
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete Permanent
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
