import * as React from 'react';
import { type Section, db } from '../db/schema';
import { addSection } from '../db/operations';
import { useLiveQuery } from 'dexie-react-hooks';
import { SectionCard } from './SectionCard';
import { Plus, ArrowLeftRight, GripVertical } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
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
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input
} from './ui';

interface PageGridProps {
  activePageId: number;
}

// Simplified Sortable row inside the Reorder Dialog
function SortableSectionItem({ section }: { section: Section }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: section.id! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-3.5 rounded-xl border border-border bg-card/65 backdrop-blur-sm select-none transition-all ${
        isDragging ? 'opacity-40 scale-[1.01] border-violet-500/25 shadow-lg' : ''
      }`}
    >
      <span className="text-sm font-semibold text-foreground truncate">
        {section.name}
      </span>
      <button
        {...attributes}
        {...listeners}
        type="button"
        className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg focus:outline-none cursor-grab active:cursor-grabbing hover:bg-muted/40 transition-colors"
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
    </div>
  );
}

export function PageGrid({ activePageId }: PageGridProps) {
  // Query sections belonging to this page, sorted by order
  const { columnsCount } = useSettings();

  // Query sections belonging to this page, sorted by order
  const sections = useLiveQuery(
    async () => {
      const records = await db.sections.where('pageId').equals(activePageId).toArray();
      return records.sort((a, b) => a.order - b.order);
    },
    [activePageId]
  ) || [];

  // Columns count mappings for Masonry columns layout
  const columnsClass = {
    2: 'columns-1 md:columns-2 gap-6',
    3: 'columns-1 md:columns-2 lg:columns-3 gap-6',
    4: 'columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-6',
    5: 'columns-1 md:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5 gap-6'
  }[columnsCount as 2 | 3 | 4 | 5] || 'columns-1 md:columns-3 gap-6';

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

  const [isReorderSectionsOpen, setIsReorderSectionsOpen] = React.useState(false);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex(s => s.id === active.id);
    const newIndex = sections.findIndex(s => s.id === over.id);
    const newSections = arrayMove(sections, oldIndex, newIndex);

    await db.transaction('rw', db.sections, async () => {
      for (let i = 0; i < newSections.length; i++) {
        await db.sections.update(newSections[i].id!, { order: i + 1 });
      }
    });
  };

  const [isAddSectionOpen, setIsAddSectionOpen] = React.useState(false);
  const [sectionName, setSectionName] = React.useState('');

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionName.trim()) return;

    await addSection(activePageId, sectionName.trim());
    setSectionName('');
    setIsAddSectionOpen(false);
  };

  return (
    <div className="space-y-6">
      {sections.length === 0 ? (
        // Empty State
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-2xl border border-dashed border-border bg-card/30 max-w-xl mx-auto mt-8 select-none">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-600/10 to-indigo-600/10 text-violet-400 flex items-center justify-center mb-4">
            <Plus className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">Create your first Section</h3>
          <p className="text-sm text-muted-foreground max-w-xs mb-6">
            Sections group links together. Create one to start adding bookmarks.
          </p>
          <Button onClick={() => setIsAddSectionOpen(true)}>
            Create Section
          </Button>
        </div>
      ) : (
        /* Sections Render Area */
        <div className="space-y-4">
          <div className="flex justify-end pr-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReorderSectionsOpen(true)}
              className="h-10 text-xs font-semibold gap-1.5 border-border bg-card/45 hover:bg-card/65 rounded-xl shadow-sm"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Reorder Sections
            </Button>
          </div>

          <div className={columnsClass}>
            {sections.map(section => (
              <div key={section.id} className="break-inside-avoid mb-6">
                <SectionCard 
                  section={section} 
                />
              </div>
            ))}

            {/* Quick Add Section Card */}
            <button
              onClick={() => setIsAddSectionOpen(true)}
              className="flex flex-col items-center justify-center p-8 h-[200px] w-full rounded-2xl border border-dashed border-border hover:border-violet-500/30 hover:bg-card/20 text-muted-foreground hover:text-foreground transition-all duration-300 group select-none shadow-sm break-inside-avoid mb-6"
            >
              <div className="h-10 w-10 rounded-full bg-card border border-border group-hover:border-violet-500/25 flex items-center justify-center mb-3 transition-colors">
                <Plus className="h-5 w-5 group-hover:text-violet-400" />
              </div>
              <span className="text-sm font-semibold">Add Section</span>
            </button>
          </div>
        </div>
      )}

      {/* ====================================================================
          ADD SECTION DIALOG
          ==================================================================== */}
      <Dialog open={isAddSectionOpen} onOpenChange={setIsAddSectionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Section</DialogTitle>
            <DialogDescription>
              Create a new section category for grouping your links.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddSection} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Section Name
              </label>
              <Input
                value={sectionName}
                onChange={e => setSectionName(e.target.value)}
                placeholder="Developer Tools, Social Media, etc."
                required
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddSectionOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Section</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ====================================================================
          REORDER SECTIONS DIALOG
          ==================================================================== */}
      <Dialog open={isReorderSectionsOpen} onOpenChange={setIsReorderSectionsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reorder Sections</DialogTitle>
            <DialogDescription>
              Drag and drop sections to change their layout order on the page.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext items={sections.map(s => s.id!)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {sections.map(section => (
                    <SortableSectionItem key={section.id} section={section} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => setIsReorderSectionsOpen(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
