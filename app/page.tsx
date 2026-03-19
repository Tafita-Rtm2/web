"use client";

import { AppLayout } from "@/components/app-layout";
import { Bell, Sparkles, BookOpen, FileText, Clock, X, CheckCircle2, RefreshCcw, AlertCircle, TrendingUp, WifiOff } from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GSIStore, User, Lesson, Assignment, Announcement, StructuredSchedule } from "@/lib/store";
import { toast } from "sonner";

export default function Home() {
  const { t } = useLanguage();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [readNotifications, setReadNotifications] = useState<string[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'offline' | 'ready'>('syncing');
  const [schedule, setSchedule] = useState<StructuredSchedule | null>(null);
  const [progressData, setProgressData] = useState<Record<string, any>>({});

  useEffect(() => {
    const initialUser = GSIStore.getCurrentUser();
    if (!initialUser) {
      router.replace("/login");
      return;
    }

    if (initialUser.role === 'admin') {
      router.replace("/admin");
      return;
    } else if (initialUser.role === 'professor') {
      router.replace("/professor");
      return;
    }

    setUser(initialUser);

    const unsubs = [
      GSIStore.subscribeAuth((u) => setUser(u)),
      GSIStore.subscribeLessons({ niveau: initialUser.niveau }, (all) => {
        const filtered = all.filter(l =>
          (l.campus.includes(initialUser.campus) || l.campus.length === 0) &&
          (l.filiere.includes(initialUser.filiere) || l.filiere.length === 0)
        );
        setLessons(filtered);
        setSyncStatus('ready');
      }),
      GSIStore.subscribeAssignments({ niveau: initialUser.niveau }, (all) => {
        const filtered = all.filter(a =>
          (a.campus.includes(initialUser.campus) || a.campus.length === 0) &&
          (a.filiere.includes(initialUser.filiere) || a.filiere.length === 0)
        );
        setAssignments(filtered);
      }),
      GSIStore.subscribeAnnouncements((anns) => {
        const filtered = anns.filter(a =>
          (!a.targetUserId || a.targetUserId === initialUser.id) &&
          (!a.campus || a.campus.includes(initialUser.campus) || a.campus.length === 0) &&
          (!a.filiere || a.filiere.includes(initialUser.filiere) || a.filiere.length === 0) &&
          (!a.niveau || a.niveau === initialUser.niveau)
        );
        setAnnouncements(filtered);
      })
    ];

    const handleOffline = () => setSyncStatus('offline');
    const handleOnline = () => setSyncStatus('syncing');
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      unsubs.forEach(u => u());
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [router]);

  useEffect(() => {
     if (user) {
        return GSIStore.subscribeLatestSchedule(user.campus, user.niveau, (s) => setSchedule(s));
     }
  }, [user]);

  useEffect(() => {
     const saved = localStorage.getItem('gsi_progress');
     if (saved) setProgressData(JSON.parse(saved));

     const read = localStorage.getItem('gsi_read_notifications');
     if (read) setReadNotifications(JSON.parse(read));
  }, [lessons]);

  const markNotificationAsRead = (id: string) => {
    const updated = Array.from(new Set([...readNotifications, id]));
    setReadNotifications(updated);
    localStorage.setItem('gsi_read_notifications', JSON.stringify(updated));
  };

  if (!user) return null;

  const firstName = user.fullName.split(' ')[0];
  const convocations = announcements.filter(a => a.type === 'convocation');

  const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const currentDay = days[new Date().getDay()];
  const currentTime = new Date().getHours() * 60 + new Date().getMinutes();

  const nextClass = schedule?.slots
    ?.filter(s => s.day === currentDay && s.startTime && s.startTime.includes(':'))
    ?.map(s => {
       try {
         const [h, m] = s.startTime.split(':').map(Number);
         return { ...s, totalMinutes: (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m) };
       } catch (e) {
         return { ...s, totalMinutes: 0 };
       }
    })
    ?.filter(s => s.totalMinutes > currentTime)
    ?.sort((a, b) => a.totalMinutes - b.totalMinutes)[0];

  const subjects = Array.from(new Set(lessons.map(l => l.subject)));

  return (
    <AppLayout>
      <div className="p-6 pb-24 max-w-md mx-auto bg-[#F8FAFC] min-h-screen">
        {/* Sync Indicator */}
        <div className="flex justify-center mb-4">
           <div className={cn(
             "px-4 py-1.5 rounded-full flex items-center gap-2 text-[10px] font-bold uppercase transition-all",
             syncStatus === 'ready' ? "bg-emerald-100 text-emerald-600" :
             syncStatus === 'offline' ? "bg-orange-100 text-orange-600" : "bg-indigo-100 text-indigo-600 animate-pulse"
           )}>
              {syncStatus === 'ready' ? <CheckCircle2 size={12} /> :
               syncStatus === 'offline' ? <WifiOff size={12} /> : <RefreshCcw size={12} className="animate-spin" />}
              {syncStatus === 'ready' ? "Cloud Connecté" : syncStatus === 'offline' ? "Mode Local" : "Sync GSI Cloud..."}
           </div>
        </div>

        {/* Convocations Alert */}
        {convocations.length > 0 && (
          <div className="mb-6 bg-rose-50 border-2 border-rose-100 p-5 rounded-[32px] animate-in slide-in-from-top duration-500">
             <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200">
                   <AlertCircle size={20} />
                </div>
                <h3 className="text-rose-600 font-black text-xs uppercase tracking-widest">Convocation Administrative</h3>
             </div>
             <p className="text-[11px] text-rose-500 font-bold leading-relaxed mb-4">{convocations[0].message}</p>
             <button onClick={() => toast.success("Confirmation envoyée à l'administration.")} className="w-full py-3 bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md active:scale-95 transition-all">Confirmer Réception</button>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center mb-8 pt-6">
          <div className="flex items-center gap-4">
             <Link href="/profile" className="w-14 h-14 rounded-[22px] bg-white p-0.5 shadow-xl shadow-indigo-100/50 border border-indigo-50 rotate-[-3deg] hover:rotate-0 transition-all duration-500 overflow-hidden">
                <img
                  src={user.photo ? GSIStore.getAbsoluteUrl(user.photo) : `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.fullName}`}
                  alt="Avatar"
                  className="w-full h-full object-cover rounded-[20px]"
                  onError={(e) => {
                    e.currentTarget.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.fullName}`;
                  }}
                />
             </Link>
             <div>
               <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mb-0.5">Bonjour {firstName}</p>
               <h1 className="text-xl font-black text-gray-900 tracking-tight leading-none">
                  GSI Insight <span className="text-primary">Plus</span>
               </h1>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={() => setShowNotifications(!showNotifications)} className="relative w-12 h-12 flex items-center justify-center bg-white shadow-xl shadow-indigo-100/30 border border-gray-100 rounded-2xl text-gray-400 hover:text-primary transition-all active:scale-90">
                <Bell size={22} />
                {(announcements.length > 0 || assignments.length > 0) && <div className="absolute top-3.5 right-3.5 w-2.5 h-2.5 bg-rose-500 border-[3px] border-white rounded-full shadow-sm"></div>}
             </button>
          </div>
        </div>

        {/* Day Summary */}
        <div className="mb-8">
           <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 px-1">Votre journée en un coup d’œil</h3>

           <div className="grid grid-cols-1 gap-4">
              <div className="bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden group">
                 <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                       <Clock size={20} />
                    </div>
                    <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">Suivant</span>
                 </div>
                 {nextClass ? (
                    <>
                       <h4 className="font-black text-sm uppercase mb-1">{nextClass.subject}</h4>
                       <p className="text-[10px] font-bold text-gray-500 mb-2">{nextClass.startTime} — Salle {nextClass.room}</p>
                       <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-gray-100 overflow-hidden">
                             <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${nextClass.instructor}`} />
                          </div>
                          <span className="text-[9px] font-black text-gray-400 uppercase">{nextClass.instructor}</span>
                       </div>
                    </>
                 ) : (
                    <p className="text-[10px] font-black text-gray-300 uppercase italic">Aucun cours à venir aujourd'hui</p>
                 )}
                 <div className="absolute right-[-10px] top-[-10px] w-20 h-20 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors"></div>
              </div>

              {(assignments.length > 0 || announcements.length > 0) && (
                 <div className="bg-orange-50/50 p-5 rounded-[32px] border border-orange-100">
                    <div className="flex items-center gap-2 mb-3">
                       <AlertCircle size={16} className="text-orange-500" />
                       <span className="text-[9px] font-black uppercase tracking-widest text-orange-600">Alertes Actives</span>
                    </div>
                    <div className="space-y-2">
                       {assignments.slice(0, 1).map((a, i) => (
                          <div key={i} className="flex justify-between items-center text-[10px]">
                             <span className="font-bold text-gray-700 truncate mr-2">Devoir: {a.title}</span>
                             <span className="font-black text-orange-600 whitespace-nowrap">{a.deadline}</span>
                          </div>
                       ))}
                       {announcements.filter(a => a.type !== 'convocation').slice(0, 1).map((a, i) => (
                          <div key={i} className="text-[10px] font-bold text-gray-500 truncate italic">
                             Annonce: {a.title}
                          </div>
                       ))}
                    </div>
                 </div>
              )}

              <div className="bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm">
                 <div className="flex justify-between items-center mb-4">
                    <span className="text-[9px] font-black uppercase text-gray-400">Progression par matière</span>
                    <TrendingUp size={14} className="text-emerald-500" />
                 </div>
                 <div className="space-y-4">
                    {subjects.slice(0, 4).map((sub, i) => {
                       const subLessons = lessons.filter(l => l.subject === sub);
                       const completedCount = subLessons.filter(l => progressData[l.id]?.completed).length;
                       const prog = subLessons.length > 0 ? Math.round((completedCount / subLessons.length) * 100) : 0;
                       const colors = ["bg-indigo-500", "bg-emerald-500", "bg-orange-500", "bg-rose-500"];
                       return (
                          <div key={sub}>
                             <div className="flex justify-between text-[8px] font-black uppercase mb-1">
                                <span className="text-gray-600 truncate mr-4">{sub}</span>
                                <span>{prog}%</span>
                             </div>
                             <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div className={cn("h-full rounded-full transition-all duration-1000", colors[i % 4])} style={{ width: `${prog}%` }}></div>
                             </div>
                          </div>
                       );
                    })}
                    {subjects.length === 0 && <p className="text-[9px] text-center text-gray-300 uppercase italic">Aucune donnée disponible</p>}
                 </div>
              </div>
           </div>
        </div>

        {/* AI Card */}
        <Link href="/chat" className="block mb-10 group active:scale-[0.98] transition-all">
           <div className="bg-gradient-to-br from-[#3F51B5] via-[#5C6BC0] to-[#7986CB] p-7 rounded-[44px] text-white shadow-2xl shadow-indigo-200 relative overflow-hidden">
              <div className="relative z-10">
                 <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={18} className="text-violet-200" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-violet-200">Ask Insight AI</span>
                 </div>
                 <h2 className="text-xl font-black mb-1 leading-tight">Des questions ?</h2>
                 <p className="text-[11px] text-violet-200/80 font-medium mb-4">Emplois du temps, devoirs, notes...</p>
                 <div className="inline-flex bg-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10">Lancer Assistant</div>
              </div>
              <div className="absolute right-[-20px] bottom-[-20px] w-32 h-32 bg-white/5 rounded-full blur-3xl"></div>
           </div>
        </Link>

        {/* Lessons */}
        <div className="mb-10">
          <div className="flex justify-between items-end mb-5">
            <h2 className="text-lg font-black text-gray-900 uppercase tracking-tighter">Cours du jour</h2>
            <Link href="/library" className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">Voir tout</Link>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
            {lessons.map((l, i) => {
              const isCompleted = progressData[l.id]?.completed;
              return (
                <div
                  key={i}
                  className="min-w-[200px] p-5 bg-white rounded-[32px] border border-gray-100 shadow-sm active:scale-95 transition-all cursor-pointer group relative"
                  onClick={() => l.files?.[0] && GSIStore.openPackFile(l.id, l.files[0])}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      GSIStore.toggleLessonCompleted(l.id);
                      const saved = localStorage.getItem('gsi_progress');
                      if (saved) setProgressData(JSON.parse(saved));
                      toast.success(isCompleted ? "Marqué comme non lu" : "Félicitations ! Cours terminé.");
                    }}
                    className={cn(
                      "absolute top-4 right-4 w-6 h-6 rounded-full border flex items-center justify-center transition-all",
                      isCompleted ? "bg-emerald-500 border-emerald-500 text-white" : "bg-gray-50 border-gray-200 text-gray-300"
                    )}
                  >
                    <CheckCircle2 size={12} />
                  </button>
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors",
                    isCompleted ? "bg-emerald-50 text-emerald-500" : "bg-indigo-50 text-indigo-500 group-hover:bg-primary group-hover:text-white"
                  )}>
                    <BookOpen size={20} />
                  </div>
                  <h3 className="font-black text-xs text-gray-800 mb-1 line-clamp-1 uppercase">{l.title}</h3>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{l.subject}</p>
                </div>
              );
            })}
            {lessons.length === 0 && <p className="text-gray-300 text-[10px] font-black uppercase py-10 px-4 border-2 border-dashed border-gray-100 rounded-[32px] text-center w-full">Aucun contenu pédagogique</p>}
          </div>
        </div>

        {/* Deadlines */}
        <div className="mb-10">
          <h2 className="text-lg font-black text-gray-900 uppercase tracking-tighter mb-5">Devoirs à rendre</h2>
          <div className="space-y-4">
            {assignments.map((a, i) => (
               <div key={i} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm relative overflow-hidden">
                  <div className="flex justify-between items-center mb-4">
                    <span className="bg-orange-50 text-orange-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">En attente</span>
                    <div className="flex items-center gap-1 text-[9px] font-black text-gray-300 uppercase">
                       <Clock size={10} />
                       {a.deadline}
                    </div>
                  </div>
                  <h4 className="font-black text-sm uppercase tracking-tight mb-1">{a.title}</h4>
                  <p className="text-[10px] font-bold text-gray-400 mb-4">{a.subject}</p>

                  {a.files && a.files.length > 0 && (
                     <button
                        onClick={() => GSIStore.openPackFile(a.id, a.files![0])}
                        className="w-full py-3 mb-3 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                     >
                        <FileText size={12} />
                        Consulter les ressources
                     </button>
                  )}

                  <button
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.onchange = async (e: any) => {
                        const file = e.target.files[0];
                        if (file) {
                          const tid = toast.loading(`Téléversement de "${file.name}"...`);
                          try {
                            const fileUrl = await GSIStore.uploadFile(file, `submissions/${a.id}_${user.id}_${file.name}`);
                            await GSIStore.addSubmission({
                              id: Math.random().toString(36).substr(2, 9),
                              assignmentId: a.id,
                              studentId: user.id,
                              studentName: user.fullName,
                              date: new Date().toISOString(),
                              file: fileUrl
                            });
                            toast.success("Devoir envoyé avec succès !", { id: tid });
                          } catch (err: any) {
                            toast.error("Échec de l'envoi : " + err.message, { id: tid });
                          }
                        }
                      };
                      input.click();
                    }}
                    className="w-full py-4 bg-gray-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary transition-colors shadow-lg active:scale-95"
                  >
                    Déposer mon travail
                  </button>
               </div>
            ))}
            {assignments.length === 0 && <div className="p-10 border-2 border-dashed border-gray-100 rounded-[32px] text-center"><p className="text-[10px] font-black text-gray-300 uppercase">Aucune deadline</p></div>}
          </div>
        </div>

        {/* Notifications Modal */}
        {showNotifications && (
          <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
             <div className="bg-white rounded-[48px] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="p-8 bg-primary text-white flex justify-between items-center">
                   <div>
                      <h3 className="font-black text-sm uppercase tracking-widest">Notifications</h3>
                      <p className="text-[9px] font-bold opacity-60 uppercase">Flux GSI Internationale</p>
                   </div>
                   <button onClick={() => setShowNotifications(false)} className="p-3 bg-white/10 rounded-2xl active:scale-90 transition-all">
                      <X size={20} />
                   </button>
                </div>

                <div className="p-4 space-y-3 max-h-[450px] overflow-y-auto bg-gray-50/50">
                   {announcements.length === 0 && assignments.length === 0 && (
                      <div className="py-20 flex flex-col items-center text-center">
                         <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-300 mb-4">
                            <Bell size={24} />
                         </div>
                         <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest italic">Aucune notification pour le moment</p>
                      </div>
                   )}

                   {announcements.map((a, i) => {
                     const isRead = readNotifications.includes(a.id);
                     return (
                        <div
                          key={a.id}
                          className={cn(
                            "p-5 rounded-[32px] border transition-all duration-300",
                            isRead ? "bg-white border-gray-100 opacity-60" : "bg-white border-indigo-100 shadow-lg shadow-indigo-500/5 ring-1 ring-indigo-500/10"
                          )}
                          onClick={() => markNotificationAsRead(a.id)}
                        >
                           <div className="flex justify-between items-start mb-2">
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                                a.type === 'convocation' ? "bg-rose-500 text-white" : "bg-primary text-white"
                              )}>
                                 {a.type === 'convocation' ? 'OFFICIEL' : 'INFO'}
                              </span>
                              <span className="text-[8px] font-bold text-gray-300">{new Date(a.date).toLocaleDateString()}</span>
                           </div>
                           <h4 className="text-[11px] font-black uppercase mb-1 text-gray-800">{a.title}</h4>
                           <p className="text-[11px] text-gray-500 font-medium leading-relaxed">{a.message}</p>
                        </div>
                     );
                   })}

                   {assignments.map((a) => (
                      <div key={a.id} className="p-5 bg-orange-50/50 border border-orange-100 rounded-[32px]">
                         <div className="flex justify-between items-center mb-2">
                            <span className="bg-orange-500 text-white px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">DEVOIR</span>
                            <span className="text-[8px] font-black text-orange-600 uppercase tracking-widest">À RENDRE</span>
                         </div>
                         <h4 className="text-[11px] font-black uppercase mb-1 text-gray-800">{a.title}</h4>
                         <p className="text-[10px] text-orange-600 font-bold">Date limite : {a.deadline}</p>
                      </div>
                   ))}
                </div>

                <div className="p-6 bg-white border-t border-gray-100">
                   <button
                     onClick={() => {
                        const allIds = announcements.map(a => a.id);
                        setReadNotifications(allIds);
                        localStorage.setItem('gsi_read_notifications', JSON.stringify(allIds));
                        toast.success("Tout est marqué comme lu");
                     }}
                     className="w-full py-4 bg-gray-50 text-gray-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-primary transition-colors"
                   >
                      Tout marquer comme lu
                   </button>
                </div>
             </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
