import { Link } from "@tanstack/react-router";
import { Wifi, WifiOff, CloudUpload } from "lucide-react";
import { useOnline, usePendingCount } from "@/hooks/use-offline";

export function SyncStatus() {
  const online = useOnline();
  const pending = usePendingCount();

  return (
    <Link
      to="/sincronizacao"
      className="flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] hover:bg-accent"
      title={online ? "Online" : "Offline"}
    >
      {online ? (
        <Wifi className="h-3.5 w-3.5 text-emerald-500" />
      ) : (
        <WifiOff className="h-3.5 w-3.5 text-amber-500" />
      )}
      {pending > 0 ? (
        <span className="flex items-center gap-1 text-amber-600">
          <CloudUpload className="h-3.5 w-3.5" />
          {pending}
        </span>
      ) : (
        <span className="text-muted-foreground">{online ? "online" : "offline"}</span>
      )}
    </Link>
  );
}
