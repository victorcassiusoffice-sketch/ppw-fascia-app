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
// Mobile: long-press triggers drag (250 ms / 5 px tolerance).

import React from 'react';
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

/* ─── List container ─── */
export default function SortableList({ items, onReorder, children, className = 'space-y-2.5' }) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },          // 5 px before drag starts (lets clicks through)
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 }, // long-press 220 ms on mobile
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((it) => it.id === active.id);
    const newIndex = items.findIndex((it) => it.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
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
