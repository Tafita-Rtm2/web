"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Calendar, BookOpen, Library, User, MessageCircle, Users, X, Maximize2, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { useState, useEffect } from "react";
import { GSIStore, User as GSIUser } from "@/lib/store";
import { toast } from "sonner";
import dynamic from "next/dynamic";

// Dynamic import for the viewer to avoid SSR issues with pdfjs and mammoth
const GSIViewer = dynamic(() => import("./gsi-viewer").then(mod => mod.GSIViewer), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex flex-col items-center justify-center bg-gray-50">
       <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  )
});

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [user, setUser] = useState<GSIUser | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const [viewerData, setViewerData] = useState<{ url: string, type: string, originalUrl?: string } | null>(null);
  const [viewerLoading, setViewerLoading] = useState(true);

  useEffect(() => {
    setUser(GSIStore.getCurrentUser());

    // Request permissions for notifications
    if (typeof window !== 'undefined' && 'Capacitor' in window) {
       import('@capacitor/local-notifications').then(ln => {
          ln.LocalNotifications.requestPermissions();
       });
    }

    const handleOpen = (e: any) => {
      setViewerLoading(true);
      setViewerData(e.detail);
      // Safety timeout to prevent infinite loading screen
      setTimeout(() => setViewerLoading(false), 8000);
    };
    window.addEventListener('gsi-open-viewer', handleOpen);

    const unsubSync = GSIStore.subscribeSyncStatus((s) => setIsSyncing(s));

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('gsi-open-viewer', handleOpen);
      unsubSync();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const navItems = [
    { icon: Home, label: t("accueil"), href: "/" },
    { icon: Calendar, label: t("planning"), href: "/schedule" },
    { icon: BookOpen, label: t("matieres"), href: "/subjects" },
    { icon: Library, label: t("biblio"), href: "/library" },
    { icon: Users, label: t("community"), href: "/community" },
    { icon: User, label: t("profil"), href: "/profile" },
  ];

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-background shadow-xl overflow-hidden relative">
      {/* Top Status Bar (Integrated) */}
      <div className="absolute top-0 left-0 right-0 h-1 z-[60] flex">
         {isSyncing && (
            <div className="h-full bg-accent animate-pulse w-full shadow-[0_0_10px_rgba(255,107,0,0.5)]"></div>
         )}
      </div>

      <div className="absolute top-4 right-4 z-[60] pointer-events-none">
         <div className={cn(
            "px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter flex items-center gap-1.5 transition-all duration-500 backdrop-blur-md border",
            !isOnline ? "bg-red-500/90 text-white border-red-400" :
            isSyncing ? "bg-accent/90 text-white border-accent-400 scale-105" :
            "bg-green-500/10 text-green-600 border-green-500/20 opacity-40 hover:opacity-100"
         )}>
            {!isOnline ? <WifiOff size={10} /> : <Wifi size={10} className={cn(isSyncing && "animate-ping")} />}
            <span>{!isOnline ? "Hors-ligne" : isSyncing ? "Sync..." : "GSI Cloud"}</span>
         </div>
      </div>

      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      <nav className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 flex justify-between items-center z-10">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center p-2 rounded-lg transition-all active:scale-90",
                isActive ? "text-primary scale-110" : "text-gray-500"
              )}
            >
              <item.icon size={24} />
              <span className="text-[10px] mt-1 font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Floating Action Button for Ask Insight */}
      {!pathname.includes('chat') && !pathname.includes('community') && (
        <Link
          href="/web/chat"
          className="absolute bottom-24 right-4 bg-accent text-white p-4 rounded-full shadow-lg hover:scale-110 active:scale-95 transition-all z-20"
        >
          <MessageCircle size={24} />
        </Link>
      )}

      {/* In-App Global Viewer */}
      {viewerData && (
        <div className="fixed inset-0 bg-black z-[100] flex flex-col animate-in slide-in-from-bottom duration-300">
           <div className="p-4 bg-gray-900 text-white flex justify-between items-center safe-top">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <Maximize2 size={16} />
                 </div>
                 <div>
                    <span className="text-[10px] font-black uppercase tracking-widest block">Lecteur GSI</span>
                    <span className="text-[8px] font-bold text-gray-400 uppercase">Document Sécurisé</span>
                 </div>
              </div>
              <button onClick={() => setViewerData(null)} className="p-3 bg-white/10 rounded-xl active:scale-90 transition-all">
                 <X size={20} />
              </button>
           </div>
           <div className="flex-1 bg-white relative overflow-hidden">
              <GSIViewer
                url={viewerData.url}
                type={viewerData.type as any}
                onLoadComplete={() => setViewerLoading(false)}
                onError={(err) => {
                  setViewerLoading(false);
                  toast.error(err);
                }}
              />
           </div>
           <div className="p-4 bg-gray-900 text-center">
              <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">© Groupe GSI — Confidentialité Totale</p>
           </div>
        </div>
      )}
    </div>
  );
}
