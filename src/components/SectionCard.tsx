import * as React from 'react';
import { type Section, type Link, db } from '../db/schema';
import { deleteSection, updateSection, addLink } from '../db/operations';
import { useLiveQuery } from 'dexie-react-hooks';
import { LinkItem } from './LinkItem';
import { MoreVertical, Plus, Edit2, Trash2, ArrowLeftRight, GripVertical } from 'lucide-react';
import {
  DndContext,
  useSensors,
  useSensor,
  PointerSensor,
  TouchSensor,
  type DragEndEvent
} from '@dnd-kit/core';
import { useSortable, SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

interface SectionCardProps {
  section: Section;
}

// Wrapper to make each link card sortable
function SortableLinkItem({ link }: { link: Link }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: link.id! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative flex items-center min-w-0 w-full ${isDragging ? 'opacity-40 shadow-2xl scale-[1.01]' : ''}`}
    >
      {/* Drag handle absolute on left */}
      <button
        {...attributes}
        {...listeners}
        className="absolute left-1 cursor-grab active:cursor-grabbing p-1 text-slate-500 hover:text-slate-300 focus:outline-none rounded shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Main Link Item shifted to make room for handle */}
      <div className="flex-1 min-w-0 pl-7">
        <LinkItem link={link} />
      </div>
    </div>
  );
}

export function SectionCard({ section }: SectionCardProps) {
  // Read all links in this section from IndexedDB
  const links = useLiveQuery(
    async () => {
      const records = await db.links.where('sectionId').equals(section.id!).toArray();
      return records.sort((a, b) => a.order - b.order);
    },
    [section.id]
  ) || [];

  // Setup sensors for click safety
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5
      }
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = links.findIndex(l => l.id === active.id);
    const newIndex = links.findIndex(l => l.id === over.id);
    const newLinks = arrayMove(links, oldIndex, newIndex);

    await db.transaction('rw', db.links, async () => {
      for (let i = 0; i < newLinks.length; i++) {
        await db.links.update(newLinks[i].id!, { order: i + 1 });
      }
    });
  };

  // Fetch other pages for the "Move to page..." feature
  const pages = useLiveQuery(() => db.pages.toArray()) || [];

  // Local Dialog Trigger States
  const [isAddLinkOpen, setIsAddLinkOpen] = React.useState(false);
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [isMoveOpen, setIsMoveOpen] = React.useState(false);

  // Form inputs
  const [sectionName, setSectionName] = React.useState(section.name);
  const [linkTitle, setLinkTitle] = React.useState('');
  const [linkUrl, setLinkUrl] = React.useState('');
  const [linkTags, setLinkTags] = React.useState('');

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTitle.trim() || !linkUrl.trim()) return;

    const parsedTags = linkTags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    await addLink(section.id!, linkTitle.trim(), linkUrl.trim(), parsedTags);
    setLinkTitle('');
    setLinkUrl('');
    setLinkTags('');
    setIsAddLinkOpen(false);
  };

  const handleEditSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionName.trim()) return;
    await updateSection(section.id!, { name: sectionName.trim() });
    setIsEditOpen(false);
  };

  const handleDeleteSection = async () => {
    await deleteSection(section.id!);
    setIsDeleteOpen(false);
  };

  const handleMoveSection = async (targetPageId: number) => {
    await updateSection(section.id!, { pageId: targetPageId });
    setIsMoveOpen(false);
  };

  return (
    <div className="glass-card flex flex-col p-5 rounded-2xl h-full border border-border shadow-xl bg-card/45">
      {/* Section Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border select-none">
        <h3 className="font-bold text-foreground tracking-wide text-base truncate">
          {section.name}
        </h3>
        
        <div className="flex items-center gap-1">
          {/* Add Bookmark button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsAddLinkOpen(true)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/40"
            title="Add link to section"
          >
            <Plus className="h-4 w-4" />
          </Button>

          {/* Section Options Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/40"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditOpen(true)}>
                <Edit2 className="mr-2 h-3.5 w-3.5" />
                Rename Section
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsMoveOpen(true)}>
                <ArrowLeftRight className="mr-2 h-3.5 w-3.5" />
                Move to Page...
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setIsDeleteOpen(true)}
                className="text-red-400 hover:text-red-300 focus:bg-red-950/20"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete Section
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Sortable List of Links */}
      <div className="flex-1 mt-4">
        {links.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 rounded-xl border border-dashed border-border text-center">
            <span className="text-xs text-muted-foreground mb-2">No bookmarks in this section</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddLinkOpen(true)}
              className="text-[11px] h-7 px-3 bg-muted/40 border-border"
            >
              Add Link
            </Button>
          </div>
        ) : (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext items={links.map(l => l.id!)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {links.map(link => (
                  <SortableLinkItem key={link.id} link={link} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* ====================================================================
          ADD LINK DIALOG
          ==================================================================== */}
      <Dialog open={isAddLinkOpen} onOpenChange={setIsAddLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Bookmark</DialogTitle>
            <DialogDescription>Create a new link in "{section.name}".</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddLink} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Title
              </label>
              <Input
                value={linkTitle}
                onChange={e => setLinkTitle(e.target.value)}
                placeholder="GitHub"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                URL
              </label>
              <Input
                type="url"
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://github.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Tags (comma separated)
              </label>
              <Input
                value={linkTags}
                onChange={e => setLinkTags(e.target.value)}
                placeholder="Coding, Git, Dev"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddLinkOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Bookmark</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ====================================================================
          RENAME SECTION DIALOG
          ==================================================================== */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Section</DialogTitle>
            <DialogDescription>Provide a new name for this section.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSection} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Section Name
              </label>
              <Input
                value={sectionName}
                onChange={e => setSectionName(e.target.value)}
                placeholder="My Section"
                required
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Rename</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ====================================================================
          MOVE SECTION DIALOG
          ==================================================================== */}
      <Dialog open={isMoveOpen} onOpenChange={setIsMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Section to Page</DialogTitle>
            <DialogDescription>
              Select which page to move the section "{section.name}" to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {pages.length <= 1 ? (
              <div className="text-center text-sm text-slate-500 py-4">
                No other pages available to move to. Create a new page first!
              </div>
            ) : (
              pages
                .filter(p => p.id !== section.pageId)
                .map(page => (
                  <button
                    key={page.id}
                    onClick={() => handleMoveSection(page.id!)}
                    className="w-full text-left p-3 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-900 hover:border-violet-500/30 text-sm font-semibold transition-colors duration-200"
                  >
                    {page.name}
                  </button>
                ))
            )}
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setIsMoveOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====================================================================
          DELETE SECTION DIALOG
          ==================================================================== */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Section</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete section "{section.name}"? This will permanently
              delete all bookmarks stored inside it. This action is irreversible.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteSection}>
              Delete Permanent
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
