import { useEffect, useRef, useState } from "react";

interface SwipeAction {
  label: string;
  icon: React.ReactNode;
  className?: string;
  onAction: () => void | Promise<void>;
}

interface SwipeToActionProps {
  children: React.ReactNode;
  actionLabel?: string;
  actionIcon?: React.ReactNode;
  actionClassName?: string;
  onAction?: () => void | Promise<void>;
  swipeRightAction?: SwipeAction;
  swipeLeftAction?: SwipeAction;
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
  swipeRightAction,
  swipeLeftAction,
  disabled,
}: SwipeToActionProps) {
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragXRef = useRef(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axisLocked = useRef<"x" | "y" | null>(null);
  const acted = useRef(false);
  const wasDragged = useRef(false);
  const surfaceRef = useRef<HTMLDivElement>(null);

  function getAction(direction: "right" | "left"): SwipeAction | undefined {
    const directional = direction === "right" ? swipeRightAction : swipeLeftAction;
    if (directional) return directional;
    if (!onAction || !actionLabel) return undefined;
    return {
      label: actionLabel,
      icon: actionIcon,
      className: actionClassName,
      onAction,
    };
  }

  function begin(x: number, y: number) {
    if (disabled) return;
    start.current = { x, y };
    axisLocked.current = null;
    acted.current = false;
    // Um arraste por toque não gera o clique que resetaria a flag no
    // onClickCapture; sem isso o toque seguinte seria engolido.
    wasDragged.current = false;
    setDragging(true);
  }

  // Retorna true enquanto o gesto estiver travado no eixo horizontal.
  function move(x: number, y: number): boolean {
    if (!start.current) return false;
    const dx = x - start.current.x;
    const dy = y - start.current.y;

    if (!axisLocked.current) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return false;
      axisLocked.current = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
    if (axisLocked.current !== "x") return false;

    wasDragged.current = true;
    const clamped = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, dx));
    dragXRef.current = clamped;
    setDragX(clamped);
    return true;
  }

  async function finish() {
    if (!start.current) return;
    const wasX = axisLocked.current === "x";
    start.current = null;
    axisLocked.current = null;
    setDragging(false);

    const finalX = dragXRef.current;
    dragXRef.current = 0;
    setDragX(0);
    const action = getAction(finalX >= 0 ? "right" : "left");
    if (wasX && Math.abs(finalX) >= THRESHOLD && action && !acted.current) {
      acted.current = true;
      await action.onAction();
    }
  }

  // Toque: listeners nativos não-passivos. O WebView do Android (APK) cancela
  // pointer events e assume a rolagem mesmo com touch-action: pan-y; chamar
  // preventDefault() no touchmove quando o arraste trava na horizontal é a
  // única forma confiável de manter o gesto vivo lá. React registra touchmove
  // como passivo, então os listeners vão direto no elemento via ref.
  const gestureRef = useRef({ begin, move, finish });
  gestureRef.current = { begin, move, finish };

  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) gestureRef.current.begin(t.clientX, t.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      if (gestureRef.current.move(t.clientX, t.clientY) && e.cancelable) {
        e.preventDefault();
      }
    };
    const onTouchEnd = () => void gestureRef.current.finish();
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  // Mouse/caneta continuam via pointer events; toques ficam por conta dos
  // listeners acima para não processar o mesmo gesto duas vezes.
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    begin(e.clientX, e.clientY);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    if (move(e.clientX, e.clientY)) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    void finish();
  }

  const revealFraction = Math.min(1, Math.abs(dragX) / THRESHOLD);
  const side = dragX < 0 ? "right" : "left";
  const activeAction = getAction(dragX >= 0 ? "right" : "left");

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div
        className={`absolute inset-y-0 flex items-center gap-1.5 px-4 text-sm font-medium ${activeAction?.className ?? actionClassName} ${
          side === "right" ? "right-0 justify-end" : "left-0 justify-start"
        }`}
        style={{
          width: MAX_DRAG + 40,
          opacity: dragX === 0 || !activeAction ? 0 : revealFraction,
        }}
        aria-hidden={dragX === 0 || !activeAction}
      >
        {activeAction?.icon}
        {revealFraction > 0.5 && activeAction ? <span>{activeAction.label}</span> : null}
      </div>
      <div
        ref={surfaceRef}
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
        className="touch-pan-y select-none"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? "none" : "transform 0.2s ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}
