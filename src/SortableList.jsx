// SortableList — generic drag-and-drop ordered list using @dnd-kit.
//
// Usage:
//   <SortableList items={arr} onReorder={(newArr) => setArr(newArr)}>
//     {(item, dragHandleProps) => (
//       <div className="card p-4 flex">
//         <button {...dragHandleProps} className="drag-handle">≡</button>
//         <span>{item.label}</span>
//       </div>
//     )}
//   </SortableList>
//
// Each item MUST have a stable `id` field (string).
// On reorder, calls onReorder(newArray) — caller persists.
// Mobile: long-press triggers drag (350 ms / 8 px tolerance).
//
// M14 — MERGE-on-overlap support
// ───────────────────────────────
// If `onMergeDrop(activeId, overId)` is supplied, drops where the dragged
// card's centre is close to the target card's centre (within 30 % of the
// target height) are treated as MERGE drops and trigger `onMergeDrop`
// instead of reorder. Drops at the top/bottom edge of a target still fall
// through to the standard reorder behaviour. `onDragOverChange(info)` is
// fired during drag so the caller can paint a "drop to merge" affordance
// on the over target.

import React, { useRef } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';

/* ─── Item wrapper — wires the dnd hooks into a child render ─── */
function SortableItem({ id, render }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
    zIndex: isDragging ? 50 : 'auto',
    boxShadow: isDragging ? '0 14px 32px -10px rgba(245,184,69,0.55)' : undefined,
  };

  const dragHandleProps = {
    ...attributes,
    ...listeners,
    'aria-label': 'Drag to reorder',
    style: {
      cursor: 'grab',
      touchAction: 'none',
      userSelect: 'none',
      WebkitUserSelect: 'none',
    },
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? 'is-dragging' : ''}>
      {render(dragHandleProps, isDragging)}
    </div>
  );
}

/* ─── Helpers — overlap detection ─── */
function computeMergeZone(activeRect, overRect) {
  if (!activeRect || !overRect) return false;
  const aCenter = activeRect.top + activeRect.height / 2;
  const oCenter = overRect.top + overRect.height / 2;
  // Centres within 30 % of target height = MERGE zone.
  return Math.abs(aCenter - oCenter) < overRect.height * 0.30;
}

/* ─── List container ─── */
export default function SortableList({
  items,
  onReorder,
  onMergeDrop,
  onDragOverChange,
  children,
  className = 'space-y-2.5',
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },          // 5 px before drag starts (lets clicks through)
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 350, tolerance: 8 }, // long-press 350 ms on mobile per M14 spec
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Tracks the most recent merge-zone hit during the active drag — read from
  // handleDragEnd to decide MERGE vs REORDER.
  const mergeZoneRef = useRef(null);

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      mergeZoneRef.current = null;
      if (onDragOverChange) onDragOverChange(null);
      return;
    }
    const aRect = (active.rect && active.rect.current && active.rect.current.translated)
      || (active.rect && active.rect.current && active.rect.current.initial)
      || null;
    const oRect = over.rect;
    const isMergeZone = !!onMergeDrop && computeMergeZone(aRect, oRect);
    mergeZoneRef.current = isMergeZone ? { activeId: active.id, overId: over.id } : null;
    if (onDragOverChange) onDragOverChange({ activeId: active.id, overId: over.id, isMergeZone });
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (onDragOverChange) onDragOverChange(null);
    const wasMerging = !!(
      mergeZoneRef.current
      && mergeZoneRef.current.activeId === active.id
      && over
      && mergeZoneRef.current.overId === over.id
    );
    mergeZoneRef.current = null;

    if (wasMerging && onMergeDrop && over && active.id !== over.id) {
      onMergeDrop(active.id, over.id);
      return;
    }

    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((it) => it.id === active.id);
    const newIndex = items.findIndex((it) => it.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  const handleDragCancel = () => {
    mergeZoneRef.current = null;
    if (onDragOverChange) onDragOverChange(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
    >
      <SortableContext items={items.map(it => it.id)} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item, i) => (
            <SortableItem
              key={item.id}
              id={item.id}
              render={(dragHandleProps, isDragging) => children(item, dragHandleProps, i, isDragging)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
