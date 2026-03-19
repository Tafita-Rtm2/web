"use client";

import { AppLayout } from "@/components/app-layout";
import { useLanguage } from "@/lib/i18n";
import { Search, Filter, Download, Star, FileText, Bookmark, Clock, ArrowRight, BookOpen, RefreshCw, CheckCircle2, RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, memo } from "react";
import { GSIStore, Lesson, Assignment } from "@/lib/store";
import { toast } from "sonner";

export default function LibraryPage() {
  const { t } = useLanguage();
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const user = GSIStore.getCurrentUser();

    // Instant Load from Cache
    const cached = GSIStore.getCache<any[]>("library_books");
    if (cached) {
      setBooks(cached);
      setLoading(false);
    }

    const updateLibrary = (lessons: Lesson[], assignments: Assignment[]) => {
      const lessonItems = lessons.filter(l =>
        !user || user.role === 'admin' || (l.niveau === user.niveau && (l.filiere.includes(user.filiere) || l.filiere.length === 0))
      ).map(l => ({
        id: l.id,
        title: l.title,
        author: `Cours: ${l.subject}`,
        type: "Leçon",
        url: l.files?.[0] || "",
        favorite: false,
        downloaded: GSIStore.isDownloaded(l.id)
      }));

      const assignmentItems = assignments.filter(a =>
        !user || user.role === 'admin' || (a.niveau === user.niveau && (a.filiere.includes(user.filiere) || a.filiere.length === 0))
      ).map(a => ({
        id: a.id,
        title: a.title,
        author: `Devoir: ${a.subject}`,
        type: "Devoir",
        url: a.files?.[0] || "",
        favorite: false,
        downloaded: GSIStore.isDownloaded(a.id)
      }));

      const all = [...lessonItems, ...assignmentItems];
      setBooks(all);
      GSIStore.setCache("library_books", all);
      setLoading(false);
    };

    let currentLessons: Lesson[] = [];
    let currentAssignments: Assignment[] = [];

    const unsubLessons = GSIStore.subscribeLessons({ niveau: user?.niveau }, (ls) => {
      currentLessons = ls;
      updateLibrary(currentLessons, currentAssignments);
    });

    const unsubAssignments = GSIStore.subscribeAssignments({ niveau: user?.niveau }, (as) => {
      currentAssignments = as;
      updateLibrary(currentLessons, currentAssignments);
    });

    return () => {
      unsubLessons();
      unsubAssignments();
    };
  }, []);

  const handleDownload = (url: string, id: string, title: string) => {
    if (!url) return toast.error("Pas de fichier joint.");

    toast.promise(
      GSIStore.downloadPackFile(url, title, id),
      {
        loading: `Téléchargement de "${title}"...`,
        success: (path) => {
          setBooks(prev => prev.map(b => b.id === id ? { ...b, downloaded: true } : b));
          return 'Document enregistré hors-ligne !';
        },
        error: (err) => `Échec: ${err.message || 'Erreur inconnue'}`,
      }
    );
  };

  const handleToggleFavorite = (id: string) => {
    setBooks(books.map(b => b.id === id ? { ...b, favorite: !b.favorite } : b));
  };

  return (
    <AppLayout>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">{t("biblio")}</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
               <CheckCircle2 size={10} className="text-green-500" /> Mode Hors-Ligne Actif
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                 setIsRefreshing(true);
                 setTimeout(() => { setIsRefreshing(false); toast.success("Bibliothèque synchronisée"); }, 1500);
              }}
              className={cn("bg-gray-100 p-2 rounded-xl text-gray-500", isRefreshing && "animate-spin")}
            >
              <RefreshCcw size={20} />
            </button>
            <button className="bg-gray-100 p-2 rounded-xl text-gray-500">
              <Filter size={20} />
            </button>
          </div>
        </div>

        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Rechercher un cours ou devoir..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-100 rounded-2xl py-3 pl-12 pr-4 outline-none text-sm focus:ring-2 ring-primary/20 transition-all"
          />
        </div>

        {/* Categories / Tabs */}
        <div className="flex gap-4 overflow-x-auto pb-4 mb-6 scrollbar-hide">
          <CategoryBadge label="Tous" active={filter === "all"} onClick={() => setFilter("all")} />
          <CategoryBadge label="Favoris" icon={Star} active={filter === "fav"} onClick={() => setFilter("fav")} />
          <CategoryBadge label="Cours" active={filter === "cours"} onClick={() => setFilter("cours")} />
          <CategoryBadge label="Devoirs" active={filter === "devoir"} onClick={() => setFilter("devoir")} />
          <CategoryBadge label="Récents" icon={Clock} active={filter === "recent"} onClick={() => setFilter("recent")} />
        </div>

        {/* Featured Section */}
        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[40px] p-8 text-white mb-8 relative overflow-hidden shadow-xl">
           <div className="absolute right-[-20px] bottom-[-20px] w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
           <div className="relative z-10">
              <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4 inline-block">Suggestion IA</span>
              <h2 className="text-xl font-bold mb-2">Guide de Réussite GSI</h2>
              <p className="text-xs opacity-80 mb-6 leading-relaxed">Basé sur vos cours récents de Mathématiques et Physique, nous vous recommandons ce support spécial.</p>
              <button className="bg-white text-indigo-600 px-6 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2">
                Lire maintenant
                <ArrowRight size={14} />
              </button>
           </div>
        </div>

        {/* Book List */}
        <h3 className="text-lg font-bold mb-4">
          {filter === "cours" ? "Mes Cours" : filter === "devoir" ? "Mes Devoirs" : "Mes documents"}
        </h3>
        <div className="space-y-4">
          {books
            .filter(b => {
              if (filter === "fav") return b.favorite;
              if (filter === "cours") return b.type === "Leçon";
              if (filter === "devoir") return b.type === "Devoir";
              if (filter === "recent") return GSIStore.getProgress(b.id);
              return true;
            })
            .filter(b =>
              b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              b.author.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((book) => (
            <div
              key={book.id}
              onClick={() => {
                if(book.url) {
                  GSIStore.saveProgress(book.id, { lastOpened: Date.now() });
                  GSIStore.openPackFile(book.id, book.url);
                }
              }}
              className="bg-white p-4 rounded-3xl border border-gray-100 flex items-center gap-4 hover:border-primary/20 transition-all group cursor-pointer"
            >
              <div className="w-12 h-16 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100 group-hover:bg-primary/5 transition-colors">
                <FileText className="text-primary opacity-40" size={24} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                   <h4 className="font-bold text-gray-800 text-sm line-clamp-1">{book.title}</h4>
                   {book.downloaded && <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>}
                </div>
                <p className="text-[10px] text-gray-400 font-medium">{book.author}</p>
                {GSIStore.getProgress(book.id) && (
                   <span className="text-[8px] text-indigo-500 font-bold uppercase tracking-tighter">Lu le {new Date(GSIStore.getProgress(book.id).ts).toLocaleDateString()}</span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleFavorite(book.id); }}
                  className={cn(
                    "p-2 rounded-xl transition-colors",
                    book.favorite ? "text-accent bg-accent/10" : "text-gray-300 bg-gray-50"
                  )}>
                  <Star size={16} fill={book.favorite ? "currentColor" : "none"} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownload(book.url, book.id, book.title); }}
                  className={cn(
                    "p-2 rounded-xl transition-colors",
                    book.downloaded ? "bg-green-100 text-green-600" : "bg-gray-50 text-primary hover:bg-primary/10"
                  )}>
                  <Download size={16} />
                </button>
              </div>
            </div>
          ))}
          {books.length === 0 && !loading && (
             <div className="text-center py-10 text-gray-400">
                <BookOpen size={40} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">Aucun document publié pour votre niveau.</p>
             </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

const CategoryBadge = memo(({ label, icon: Icon, active, onClick }: any) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-6 py-3 rounded-2xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all",
        active ? "bg-primary text-white shadow-lg shadow-primary/20 scale-105" : "bg-white text-gray-500 border border-gray-100"
      )}
    >
      {Icon && <Icon size={14} />}
      {label}
    </button>
  );
});
