import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from './modifiers';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { createContext, useContext, type ReactNode } from 'react';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';

interface HandleContextValue {
  attributes: ReturnType<typeof useSortable>['attributes'];
  listeners: ReturnType<typeof useSortable>['listeners'];
  setActivatorNodeRef: (el: HTMLElement | null) => void;
}
const HandleContext = createContext<HandleContextValue | null>(null);

/** Griff zum Verschieben (Maus, Touch und Tastatur: Leertaste + Pfeiltasten). */
export function DragHandle({ className, label }: { className?: string; label?: string }) {
  const ctx = useContext(HandleContext);
  const t = useT();
  if (!ctx) return null;
  return (
    <button
      type="button"
      ref={ctx.setActivatorNodeRef}
      {...ctx.attributes}
      {...ctx.listeners}
      aria-label={label ?? t('common.dragToReorder')}
      className={cn('flex h-7 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground/70 hover:bg-muted hover:text-foreground active:cursor-grabbing', className)}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

function SortableRow({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('relative', isDragging && 'z-10 opacity-80 shadow-lg')}
    >
      <HandleContext.Provider value={{ attributes, listeners, setActivatorNodeRef }}>{children}</HandleContext.Provider>
    </div>
  );
}

/** Sortierbare Liste (Drag & Drop) für Abschnitte, Einträge und Aufzählungen. */
export function SortableList<T extends { id: string }>({
  items,
  onMove,
  children,
  className,
}: {
  items: T[];
  onMove: (from: number, to: number) => void;
  children: (item: T, index: number) => ReactNode;
  className?: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = items.findIndex((i) => i.id === e.active.id);
    const to = items.findIndex((i) => i.id === e.over!.id);
    if (from >= 0 && to >= 0) onMove(from, to);
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis]}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item, index) => (
            <SortableRow key={item.id} id={item.id}>
              {children(item, index)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
