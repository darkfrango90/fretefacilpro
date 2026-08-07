import { useRef, useState } from "react";

interface SwipeToActionProps {
  children: React.ReactNode;
  actionLabel: string;
  actionIcon: React.ReactNode;
  actionClassName?: string;
  onAction: () => void | Promise<void>;
  disabled?: boolean;
}

const THRESHOLD = 88;
const MAX_DRAG = 140;

export function SwipeToAction({
  children,
  actionLabel,
  actionIcon,
  actionClassName = "bg-destructive text-destructive-foreground",
  onAction,
  disabled,
}: SwipeToActionProps) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axisLocked = useRef<"x" | "y" | null>(null);
  const acted = useRef(false);
  const wasDragged = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    if (disabled) return;
    start.current = { x: e.clientX, y: e.clientY };
    axisLocked.current = null;
    acted.current = false;
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;

    if (!axisLocked.current) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axisLocked.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (axisLocked.current !== "x") return;

    wasDragged.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const clamped = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, dx));
    setDragX(clamped);
  }

  async function onPointerUp() {
    if (!start.current) return;
    const wasX = axisLocked.current === "x";
    start.current = null;
    axisLocked.current = null;
    setDragging(false);

    if (wasX && Math.abs(dragX) >= THRESHOLD && !acted.current) {
      acted.current = true;
      setDragX(0);
      await onAction();
      return;
    }
    setDragX(0);
  }

  const revealFraction = Math.min(1, Math.abs(dragX) / THRESHOLD);
  const side = dragX < 0 ? "right" : "left";

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div
        className={`absolute inset-y-0 flex items-center gap-1.5 px-4 text-sm font-medium ${actionClassName} ${
          side === "right" ? "right-0 justify-end" : "left-0 justify-start"
        }`}
        style={{ width: MAX_DRAG + 40, opacity: dragX === 0 ? 0 : revealFraction }}
        aria-hidden={dragX === 0}
      >
        {actionIcon}
        {revealFraction > 0.5 && <span>{actionLabel}</span>}
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          if (wasDragged.current) {
            e.stopPropagation();
            e.preventDefault();
            wasDragged.current = false;
          }
        }}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? "none" : "transform 0.2s ease",
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}
