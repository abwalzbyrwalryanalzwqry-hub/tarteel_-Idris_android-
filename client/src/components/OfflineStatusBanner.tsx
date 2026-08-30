import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { loadOfflineQuranState, subscribeOfflineQuranState } from "@/lib/offlineQuranStore";

export function OfflineStatusBanner() {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [pendingCount, setPendingCount] = useState(() => {
    const state = loadOfflineQuranState();
    return state.bookmarkMutations.length + state.preferenceMutations.length;
  });

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    const updatePending = () => {
      const state = loadOfflineQuranState();
      setPendingCount(state.bookmarkMutations.length + state.preferenceMutations.length);
    };
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    const unsubscribe = subscribeOfflineQuranState(updatePending);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      unsubscribe();
    };
  }, []);

  if (online && pendingCount === 0) return null;
  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-border/70 bg-card/95 px-4 py-3 text-sm shadow-xl backdrop-blur" dir="rtl" role="status">
      {online ? <Wifi className="h-4 w-4 shrink-0 text-primary" /> : <WifiOff className="h-4 w-4 shrink-0 text-amber-600" />}
      <span className="flex-1 text-muted-foreground">
        {online ? `ستتم مزامنة ${pendingCount} ${pendingCount === 1 ? "عملية" : "عمليات"} محفوظة محلياً.` : "أنت غير متصل. ستبقى تغييرات القرآن محفوظة على الجهاز."}
      </span>
    </div>
  );
}
