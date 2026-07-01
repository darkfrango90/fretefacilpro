import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, Check, UserX } from "lucide-react";

export interface SignaturePadProps {
  onConfirm: (blob: Blob) => void;
  onSkip?: () => void;
}

export function SignaturePad({ onConfirm, onSkip }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [empty, setEmpty] = useState(true);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = 200;
    c.width = w * ratio;
    c.height = h * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0b1230";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
  }, []);

  function pos(e: React.PointerEvent) {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function start(e: React.PointerEvent) {
    e.preventDefault();
    drawing.current = true;
    last.current = pos(e);
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const p = pos(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (empty) setEmpty(false);
  }
  function end() {
    drawing.current = false;
    last.current = null;
  }

  function clear() {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const w = c.clientWidth;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, 200);
    setEmpty(true);
  }

  function confirm() {
    const c = canvasRef.current!;
    c.toBlob((b) => {
      if (b) onConfirm(b);
    }, "image/png");
  }

  return (
    <div className="space-y-2">
      <div className="rounded-md border bg-white">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: 200, touchAction: "none" }}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button type="button" variant="outline" size="sm" onClick={clear} disabled={empty}>
          <Eraser className="h-4 w-4 mr-1" /> Limpar
        </Button>
        <Button type="button" variant="action" size="sm" onClick={confirm} disabled={empty}>
          <Check className="h-4 w-4 mr-1" /> Confirmar assinatura
        </Button>
        {onSkip && (
          <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
            <UserX className="h-4 w-4 mr-1" /> Cliente ausente
          </Button>
        )}
      </div>
    </div>
  );
}
