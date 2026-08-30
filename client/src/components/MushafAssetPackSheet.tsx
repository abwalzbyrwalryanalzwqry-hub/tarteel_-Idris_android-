import { useEffect, useState } from "react";
import { Download, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getMushafAssetPackStatus, isMushafAssetPackReady, downloadMushafAssetPack, subscribeMushafAssetPack } from "@/lib/mushafAssetPack";
import type { MushafVisualManifest } from "../../../shared/mushafVisual";

export function MushafAssetPackSheet({ open, onOpenChange, manifest }: { open: boolean; onOpenChange: (open: boolean) => void; manifest: MushafVisualManifest }) {
  const [status, setStatus] = useState(getMushafAssetPackStatus());
  useEffect(() => {
    if (!open) return;
    let active = true;
    void isMushafAssetPackReady().then((ready) => active && setStatus(ready ? { state: "ready", completed: manifest.pages.length * 2, total: manifest.pages.length * 2 } : getMushafAssetPackStatus()));
    return subscribeMushafAssetPack(setStatus);
  }, [open]);
  const downloading = status.state === "downloading";
  const ready = status.state === "ready";
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" dir="rtl" className="rounded-t-[2rem]">
        <SheetHeader className="text-right"><SheetTitle>المصحف دون إنترنت</SheetTitle><SheetDescription>نزّل صفحات المصحف وبيانات التفاعل على جهازك لاستخدامها دون اتصال. حجم التنزيل كبير، ويفضل استخدام Wi‑Fi.</SheetDescription></SheetHeader>
        <div className="space-y-4 p-5">
          {ready ? <div className="flex items-center gap-2 rounded-2xl bg-primary/10 p-4 text-sm font-bold text-primary"><CheckCircle2 className="h-5 w-5" />المصحف محفوظ على هذا الجهاز.</div> : <>
            {downloading && <div className="space-y-2"><div className="flex justify-between text-sm text-muted-foreground"><span>جارٍ التنزيل…</span><span>{status.completed}/{status.total}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${status.total ? (status.completed / status.total) * 100 : 0}%` }} /></div></div>}
            {status.error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{status.error}</p>}
            <Button className="w-full" disabled={downloading} onClick={() => void downloadMushafAssetPack(manifest)}>{downloading ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Download className="ml-2 h-4 w-4" />} {downloading ? "جارٍ تنزيل المصحف" : "تنزيل المصحف للاستخدام دون إنترنت"}</Button>
          </>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
