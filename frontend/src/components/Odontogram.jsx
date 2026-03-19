"use client";

import { useRef, useState, useCallback } from "react";
import { cn } from "../lib/utils";

const UPPER_TEETH = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_TEETH = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const isMolar = (t) => {
  const n = t % 10;
  return n === 6 || n === 7 || n === 8;
};

export default function Odontogram({ selected = [], onToggle, readonly = false }) {
  const containerRef = useRef(null);
  const toothRefs = useRef({});
  const [dragRect, setDragRect] = useState(null);
  const dragStart = useRef(null);
  const isDragging = useRef(false);

  const isSelected = (tooth) => selected.includes(String(tooth));

  const handleClick = (tooth) => {
    if (readonly || !onToggle || isDragging.current) return;
    onToggle(String(tooth));
  };

  // Rectangle drag selection
  const getRelativePos = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const handleMouseDown = useCallback((e) => {
    if (readonly || !onToggle) return;
    if (e.target.closest("button[data-quick]")) return;
    isDragging.current = false;
    dragStart.current = getRelativePos(e);
    setDragRect(null);

    const handleMouseMove = (e2) => {
      if (!dragStart.current) return;
      const current = getRelativePos(e2);
      const x = Math.min(dragStart.current.x, current.x);
      const y = Math.min(dragStart.current.y, current.y);
      const w = Math.abs(current.x - dragStart.current.x);
      const h = Math.abs(current.y - dragStart.current.y);
      if (w < 6 && h < 6) return;
      isDragging.current = true;
      setDragRect({ x, y, w, h });
    };

    const handleMouseUp = (e2) => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);

      if (isDragging.current && dragStart.current) {
        const end = getRelativePos(e2);
        const rx = Math.min(dragStart.current.x, end.x);
        const ry = Math.min(dragStart.current.y, end.y);
        const rw = Math.abs(end.x - dragStart.current.x);
        const rh = Math.abs(end.y - dragStart.current.y);

        if (rw > 8 || rh > 8) {
          const containerRect = containerRef.current?.getBoundingClientRect();
          if (containerRect) {
            const selectionRect = {
              left: containerRect.left + rx,
              top: containerRect.top + ry,
              right: containerRect.left + rx + rw,
              bottom: containerRect.top + ry + rh,
            };

            const overlapped = [];
            [...UPPER_TEETH, ...LOWER_TEETH].forEach((tooth) => {
              const el = toothRefs.current[tooth];
              if (!el) return;
              const tr = el.getBoundingClientRect();
              const overlaps =
                tr.left < selectionRect.right &&
                tr.right > selectionRect.left &&
                tr.top < selectionRect.bottom &&
                tr.bottom > selectionRect.top;
              if (overlaps) overlapped.push(String(tooth));
            });

            // Default behavior: replace selection with dragged rectangle result.
            // Shift key keeps additive behavior for power users.
            if (e2.shiftKey) {
              overlapped.forEach((tooth) => {
                if (!selected.includes(tooth)) onToggle(tooth);
              });
            } else {
              selected.forEach((tooth) => {
                if (!overlapped.includes(tooth)) onToggle(tooth);
              });
              overlapped.forEach((tooth) => {
                if (!selected.includes(tooth)) onToggle(tooth);
              });
            }
          }
        }
      }

      dragStart.current = null;
      setDragRect(null);
      setTimeout(() => { isDragging.current = false; }, 50);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [readonly, onToggle, selected, getRelativePos]);

  const ToothButton = ({ tooth }) => {
    const sel = isSelected(tooth);
    return (
      <button
        type="button"
        data-tooth={tooth}
        ref={(el) => { toothRefs.current[tooth] = el; }}
        onClick={() => handleClick(tooth)}
        disabled={readonly}
        title={`Diş ${tooth}`}
        className={cn(
          "relative flex flex-col items-center gap-0.5 group transition-all",
          !readonly && "hover:scale-110 cursor-pointer",
          readonly && "cursor-default"
        )}
      >
        <span className={cn(
          "text-[9px] font-mono font-semibold leading-none",
          sel ? "text-primary" : "text-muted-foreground"
        )}>
          {tooth}
        </span>
        <div className={cn(
          "border-2 transition-all duration-150",
          isMolar(tooth)
            ? "w-7 h-8 rounded-md"
            : tooth % 10 === 4 || tooth % 10 === 5
              ? "w-5 h-7 rounded-md"
              : "w-4 h-7 rounded-t-full rounded-b-md",
          sel
            ? "bg-primary/30 border-primary shadow-sm shadow-primary/30"
            : "bg-background border-border hover:border-primary/50"
        )} />
      </button>
    );
  };

  const selectAll = () => {
    if (readonly || !onToggle) return;
    const all = [...UPPER_TEETH, ...LOWER_TEETH].map(String);
    all.forEach((t) => { if (!selected.includes(t)) onToggle(t); });
  };

  const clearAll = () => {
    if (readonly || !onToggle) return;
    selected.forEach((t) => onToggle(t));
  };

  const selectGroup = (group) => {
    if (readonly || !onToggle) return;
    let teeth = [];
    if (group === "upper") teeth = UPPER_TEETH;
    else if (group === "lower") teeth = LOWER_TEETH;
    else if (group === "upper-right") teeth = UPPER_TEETH.slice(0, 8);
    else if (group === "upper-left") teeth = UPPER_TEETH.slice(8);
    else if (group === "lower-right") teeth = LOWER_TEETH.slice(8);
    else if (group === "lower-left") teeth = LOWER_TEETH.slice(0, 8);
    teeth.forEach((t) => { if (!selected.includes(String(t))) onToggle(String(t)); });
  };

  return (
    <div
      ref={containerRef}
      className="space-y-3 relative select-none"
      onMouseDown={handleMouseDown}
    >
      {/* Quick select buttons */}
      {!readonly && (
        <div className="flex flex-wrap gap-1.5 text-xs">
          {[
            { label: "Üst Çene", action: () => selectGroup("upper") },
            { label: "Alt Çene", action: () => selectGroup("lower") },
            { label: "Sağ Üst", action: () => selectGroup("upper-right") },
            { label: "Sol Üst", action: () => selectGroup("upper-left") },
            { label: "Sağ Alt", action: () => selectGroup("lower-right") },
            { label: "Sol Alt", action: () => selectGroup("lower-left") },
            { label: "Tümü", action: selectAll },
            { label: "Temizle", action: clearAll },
          ].map((btn) => (
            <button
              key={btn.label}
              type="button"
              data-quick="true"
              onClick={btn.action}
              className="px-2 py-1 rounded border border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors text-[10px]"
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}

      {/* Upper jaw */}
      <div className="space-y-1">
        <div className="text-[10px] text-muted-foreground font-medium text-center">Üst Çene</div>
        <div className="flex justify-center gap-1">
          {UPPER_TEETH.map((tooth) => (
            <ToothButton key={tooth} tooth={tooth} />
          ))}
        </div>
      </div>

      {/* Midline */}
      <div className="border-t border-dashed border-border/60 my-1" />

      {/* Lower jaw */}
      <div className="space-y-1">
        <div className="flex justify-center gap-1">
          {LOWER_TEETH.map((tooth) => (
            <ToothButton key={tooth} tooth={tooth} />
          ))}
        </div>
        <div className="text-[10px] text-muted-foreground font-medium text-center">Alt Çene</div>
      </div>

      {/* Selected indicator */}
      {selected.length > 0 && (
        <div className="text-xs text-primary font-medium text-center">
          Seçili: {selected.sort((a, b) => Number(a) - Number(b)).join(", ")}
        </div>
      )}

      {/* Drag selection rectangle */}
      {dragRect && dragRect.w > 4 && dragRect.h > 4 && (
        <div
          className="absolute border-2 border-primary/50 bg-primary/10 rounded-sm pointer-events-none z-10"
          style={{
            left: dragRect.x,
            top: dragRect.y,
            width: dragRect.w,
            height: dragRect.h,
          }}
        />
      )}
    </div>
  );
}
