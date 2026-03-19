"use client";

import { useState, useEffect, memo } from "react";
import {
  ShieldCheck,
  Users,
  Megaphone,
  GraduationCap,
  BarChart3,
  Search,
  LogOut,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  RefreshCcw,
  BookOpen,
  FileText,
  Mail,
  X,
  Wifi,
  WifiOff,
  FileSpreadsheet,
  CheckCircle2,
  TrendingUp
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { GSIStore, User, Lesson, Assignment } from "@/lib/store";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';
import { CAMPUSES, ALL_FILIERES as FILIERES } from "@/lib/constants";

export default function AdminPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [viewingStudent, setViewingStudent] = useState<User | null>(null);
  const [showConvocationModal, setShowConvocationModal] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCampus, setFilterCampus] = useState("");
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'ready' | 'offline'>('syncing');

  // Filters for submissions
  const [subFilterCampus, setSubFilterCampus] = useState("");
  const [subFilterFiliere, setSubFilterFiliere] = useState("");
  const [subFilterNiveau, setSubFilterNiveau] = useState("");

  useEffect(() => {
    const user = GSIStore.getCurrentUser();
    if (!user || user.role !== 'admin') {
      router.push("/login");
      return;
    }

    const unsubs = [
      GSIStore.subscribeUsers((us) => { setUsers(us); setSyncStatus('ready'); }),
      GSIStore.subscribeLessons({}, (ls) => setLessons(ls)),
      GSIStore.subscribeAssignments({}, (as) => setAssignments(as)),
      GSIStore.subscribeSubmissions(undefined, (ss) => setSubmissions(ss)),
      GSIStore.subscribeAnnouncements((anns) => setAnnouncements(anns)),
      GSIStore.subscribeLatestSchedule("", "", () => {
         // Generic fetch for all schedules
         const scheds = GSIStore.getCache<Record<string, any>>('schedules') || {};
         setSchedules(Object.values(scheds));
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

  const handleDeleteUser = async (id: string) => {
    if (confirm("Supprimer cet utilisateur ?")) {
      await GSIStore.deleteUser(id);
      toast.success("Demande de suppression envoyée.");
    }
  };

  const [selectedAnncFilieres, setSelectedAnncFilieres] = useState<string[]>([]);
  const [selectedAnncCampuses, setSelectedAnncCampuses] = useState<string[]>([]);

  const handleSendAnnouncement = async (e: any) => {
    e.preventDefault();
    const title = e.target.title.value;
    const message = e.target.message.value;
    const niveau = e.target.niveau.value;

    await GSIStore.addAnnouncement({
      id: Math.random().toString(36).substr(2, 9),
      title,
      message,
      date: new Date().toISOString(),
      author: "Administration",
      campus: selectedAnncCampuses,
      filiere: selectedAnncFilieres,
      niveau: niveau === "Tous" ? undefined : niveau
    });

    toast.success("Annonce diffusée aux profils ciblés !");
    e.target.reset();
    setSelectedAnncFilieres([]);
    setSelectedAnncCampuses([]);
    setActiveTab("dashboard");
  };

  const filteredUsers = users.filter(u =>
    (u.fullName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const menuItems = [
    { id: "dashboard", icon: ShieldCheck, label: t("dashboard"), color: "bg-indigo-600" },
    { id: "users", icon: Users, label: t("gestion_utilisateurs"), color: "bg-blue-600" },
    { id: "submissions", icon: FileText, label: "Devoirs Reçus", color: "bg-emerald-600" },
    { id: "communication", icon: Megaphone, label: t("communication"), color: "bg-orange-600" },
    { id: "academic", icon: GraduationCap, label: t("gestion_academique"), color: "bg-purple-600" },
    { id: "schedule", icon: RefreshCcw, label: "Emploi du temps", color: "bg-violet-600" },
    { id: "media", icon: BookOpen, label: "Médiathèque", color: "bg-sky-600" },
    { id: "stats", icon: BarChart3, label: t("stats_rapports"), color: "bg-pink-600" },
  ];

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-gray-50 pb-20">
      {/* Sync Status Banner */}
      <div className={cn(
        "px-6 py-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest transition-all",
        syncStatus === 'ready' ? "bg-emerald-500 text-white" :
        syncStatus === 'offline' ? "bg-orange-500 text-white" : "bg-indigo-600 text-white animate-pulse"
      )}>
        <div className="flex items-center gap-2">
           {syncStatus === 'ready' ? <CheckCircle2 size={12} /> :
            syncStatus === 'offline' ? <WifiOff size={12} /> : <RefreshCcw size={12} className="animate-spin" />}
           <span>{syncStatus === 'ready' ? "GSI Cloud : Connecté" : syncStatus === 'offline' ? "Mode Hors-ligne" : "Synchronisation..."}</span>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white p-6 rounded-b-[40px] shadow-sm mb-6">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-600 rounded-[22px] flex items-center justify-center text-white shadow-xl shadow-indigo-100/50 border border-indigo-50 rotate-[-3deg]">
              <ShieldCheck size={32} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight leading-none text-gray-900">Admin <span className="text-indigo-600">Portal</span></h1>
              <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">Nina GSI — Principal</p>
            </div>
          </div>
          <button
            onClick={() => {
              GSIStore.logout();
              toast.success("Déconnexion");
              router.push("/login");
            }}
            className="p-3 bg-gray-50 rounded-xl text-gray-400 hover:text-red-500 transition-colors active:scale-90"
          >
            <LogOut size={20} />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder={t("rechercher") + "..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 ring-indigo-500/20"
          />
        </div>
      </div>

      <div className="px-6 space-y-8 flex-1 pb-10">
        {activeTab === "dashboard" && (
          <>
            <div className="grid grid-cols-1 gap-4">
              <StatCard label="Étudiants Actifs" value={users.filter(u => u.role === 'student').length.toString()} change="+12% ce mois" color="text-blue-600" />
            </div>

            <div>
              <h2 className="text-lg font-bold mb-4">{t("tous")}</h2>
              <div className="grid grid-cols-2 gap-4">
                {menuItems.filter(i => i.id !== 'dashboard').map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className="bg-white p-5 rounded-[32px] shadow-sm border border-gray-100 flex flex-col items-center text-center gap-3 hover:shadow-md transition-all active:scale-95"
                  >
                    <div className={`${item.color} w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg`}>
                      <item.icon size={24} />
                    </div>
                    <span className="text-sm font-bold text-gray-700 leading-tight">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}


        {activeTab === "users" && (
          <div className="space-y-4">
            <PageHeader title={t("gestion_utilisateurs")} onBack={() => setActiveTab("dashboard")} />
            <div className="space-y-3">
              {filteredUsers.map((u, i) => (
                <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 shadow-sm hover:border-indigo-200 transition-all cursor-pointer group" onClick={() => setViewingStudent(u)}>
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center overflow-hidden font-bold">
                    {u.photo ? (
                      <img
                        src={GSIStore.getAbsoluteUrl(u.photo)}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = `https://api.dicebear.com/7.x/initials/svg?seed=${u.fullName}`;
                        }}
                      />
                    ) : u.fullName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-sm group-hover:text-indigo-600 transition-colors">{u.fullName}</h4>
                    <p className="text-[10px] text-gray-500">{u.role.toUpperCase()} • {u.filiere} • {u.niveau}</p>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => { setSelectedUser(u); setShowConvocationModal(true); }} className="text-orange-500 p-2 hover:bg-orange-50 rounded-xl"><Mail size={16} /></button>
                    <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 p-2 hover:bg-red-50 rounded-xl"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "communication" && (
          <div className="space-y-6">
            <PageHeader title={t("communication")} onBack={() => setActiveTab("dashboard")} />

            <form onSubmit={handleSendAnnouncement} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600">Nouvelle Annonce</h3>
                <input name="title" required className="w-full bg-gray-50 rounded-xl p-3 outline-none font-bold text-sm" placeholder="Titre de l'annonce" />
                <textarea name="message" required className="w-full bg-gray-50 rounded-xl p-3 outline-none min-h-[100px] text-sm" placeholder="Contenu du message..."></textarea>

                <div className="p-4 bg-gray-50 rounded-2xl space-y-4">
                   <p className="text-[10px] font-black uppercase text-gray-400">Ciblage de l'audience</p>

                   <div className="space-y-2">
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Campuses</p>
                      <div className="flex flex-wrap gap-2">
                        {CAMPUSES.map(c => (
                          <button type="button" key={c} onClick={() => selectedAnncCampuses.includes(c) ? setSelectedAnncCampuses(selectedAnncCampuses.filter(x => x !== c)) : setSelectedAnncCampuses([...selectedAnncCampuses, c])} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all", selectedAnncCampuses.includes(c) ? "bg-orange-500 text-white" : "bg-white text-gray-400 border border-gray-100")}>{c}</button>
                        ))}
                      </div>
                   </div>

                   <div className="space-y-2">
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Filières</p>
                      <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 bg-white rounded-xl border border-gray-100">
                        {FILIERES.map(f => (
                          <button type="button" key={f} onClick={() => selectedAnncFilieres.includes(f) ? setSelectedAnncFilieres(selectedAnncFilieres.filter(x => x !== f)) : setSelectedAnncFilieres([...selectedAnncFilieres, f])} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all mb-1", selectedAnncFilieres.includes(f) ? "bg-orange-500 text-white" : "bg-gray-50 text-gray-400 border border-gray-100")}>{f}</button>
                        ))}
                      </div>
                   </div>

                   <div className="space-y-2">
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Niveau</p>
                      <select name="niveau" className="w-full p-2 bg-white border border-gray-100 rounded-lg text-xs font-bold">
                         <option>Tous</option>
                         <option>L1</option><option>L2</option><option>L3</option><option>M1</option><option>M2</option>
                      </select>
                   </div>
                </div>

                <button type="submit" className="w-full bg-orange-500 text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-lg shadow-orange-100 active:scale-95 transition-all">Diffuser l'annonce</button>
            </form>

            <div className="space-y-3">
               <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 px-2">Historique des annonces</h3>
               {announcements.map((a, i) => (
                 <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
                    <div className="flex-1 pr-4">
                       <h4 className="font-bold text-xs uppercase mb-1">{a.title}</h4>
                       <p className="text-[10px] text-gray-500 line-clamp-2">{a.message}</p>
                       <p className="text-[8px] font-bold text-gray-400 mt-1">{new Date(a.date).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => {
                       if(confirm("Supprimer cette annonce ?")) {
                          GSIStore.deleteAnnouncement(a.id);
                          toast.success("Annonce supprimée");
                       }
                    }} className="p-2 text-red-500 bg-red-50 rounded-lg active:scale-95 transition-all">
                       <Trash2 size={16} />
                    </button>
                 </div>
               ))}
               {announcements.length === 0 && <p className="text-center py-10 text-[10px] font-bold text-gray-400 uppercase">Aucune annonce diffusée</p>}
            </div>
          </div>
        )}

        {activeTab === "academic" && (
          <div className="space-y-4">
            <PageHeader title="Gestion Académique" onBack={() => setActiveTab("dashboard")} />
            <div className="grid grid-cols-1 gap-4">
               <div className="bg-white p-5 rounded-3xl border border-gray-100">
                  <h3 className="font-bold mb-4 flex items-center gap-2"><BookOpen size={18} className="text-emerald-500" /> Leçons ({lessons.length})</h3>
                  <div className="space-y-3">
                    {lessons.map((l, i) => (
                      <div key={i} className="p-3 bg-gray-50 rounded-xl flex items-center justify-between shadow-sm">
                         <div className="flex flex-col">
                            <span className="text-xs font-black uppercase text-gray-800">{l.title}</span>
                            <span className="text-[9px] font-bold text-gray-400">{l.subject} • {l.niveau}</span>
                         </div>
                         <button onClick={() => { if(confirm("Supprimer ?")) GSIStore.deleteLesson(l.id); }} className="text-red-500 p-2"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
               </div>
               <div className="bg-white p-5 rounded-3xl border border-gray-100">
                  <h3 className="font-bold mb-4 flex items-center gap-2"><FileText size={18} className="text-orange-500" /> Devoirs ({assignments.length})</h3>
                  <div className="space-y-3">
                    {assignments.map((a, i) => (
                      <div key={i} className="p-3 bg-gray-50 rounded-xl flex items-center justify-between shadow-sm">
                         <div className="flex flex-col">
                            <span className="text-xs font-black uppercase text-gray-800">{a.title}</span>
                            <span className="text-[9px] font-bold text-gray-400">Deadline: {a.deadline}</span>
                         </div>
                         <button onClick={() => { if(confirm("Supprimer ?")) GSIStore.deleteAssignment(a.id); }} className="text-red-500 p-2"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === "schedule" && (
          <div className="space-y-6">
             <PageHeader title="Emploi du temps" onBack={() => setActiveTab("dashboard")} />

             <ScheduleEditor campuses={CAMPUSES} onSave={(s) => {
                GSIStore.addSchedule(s);
                toast.success("Emploi du temps mis à jour !");
                setActiveTab("dashboard");
             }} />

             <div className="space-y-3">
               <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 px-2">Emplois du temps actifs</h3>
               {schedules.map((s, i) => (
                 <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm">
                    <div className="flex-1">
                       <h4 className="font-bold text-xs uppercase mb-1">{s.campus} — {s.niveau}</h4>
                       <p className="text-[8px] font-bold text-gray-400">Mis à jour: {new Date(s.lastUpdated).toLocaleString()}</p>
                    </div>
                    <button onClick={async () => {
                       if(confirm("Supprimer cet emploi du temps ?")) {
                          const targetId = s._id || s.id;
                          await GSIStore.deleteSchedule(targetId);
                          toast.success("Supprimé");
                          // Refresh
                          const scheds = GSIStore.getCache<Record<string, any>>('schedules') || {};
                          delete scheds[`${s.campus}_${s.niveau}`];
                          setSchedules(Object.values(scheds));
                       }
                    }} className="p-2 text-red-500 bg-red-50 rounded-lg">
                       <Trash2 size={16} />
                    </button>
                 </div>
               ))}
               {schedules.length === 0 && <p className="text-center py-10 text-[10px] font-bold text-gray-400 uppercase">Aucun emploi du temps</p>}
             </div>
          </div>
        )}

        {activeTab === "submissions" && (
          <div className="space-y-4">
             <PageHeader title="Devoirs Reçus" onBack={() => setActiveTab("dashboard")} />

             {/* Submissions Filters */}
             <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm space-y-3">
                <p className="text-[10px] font-black uppercase text-gray-400">Filtrer par destination</p>
                <div className="grid grid-cols-2 gap-2">
                   <select
                     value={subFilterCampus}
                     onChange={(e) => setSubFilterCampus(e.target.value)}
                     className="p-3 bg-gray-50 rounded-xl text-[10px] font-bold outline-none"
                   >
                      <option value="">Tous les Campus</option>
                      {CAMPUSES.map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                   <select
                     value={subFilterNiveau}
                     onChange={(e) => setSubFilterNiveau(e.target.value)}
                     className="p-3 bg-gray-50 rounded-xl text-[10px] font-bold outline-none"
                   >
                      <option value="">Tous les Niveaux</option>
                      {["L1", "L2", "L3", "M1", "M2"].map(n => <option key={n} value={n}>{n}</option>)}
                   </select>
                </div>
                <select
                   value={subFilterFiliere}
                   onChange={(e) => setSubFilterFiliere(e.target.value)}
                   className="w-full p-3 bg-gray-50 rounded-xl text-[10px] font-bold outline-none"
                >
                   <option value="">Toutes les Filières</option>
                   {FILIERES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
             </div>

             <div className="space-y-3">
                {submissions
                .filter(s => {
                   const student = users.find(u => u.id === s.studentId);
                   if (subFilterCampus && student?.campus !== subFilterCampus) return false;
                   if (subFilterFiliere && student?.filiere !== subFilterFiliere) return false;
                   if (subFilterNiveau && student?.niveau !== subFilterNiveau) return false;
                   return true;
                })
                .map((s, i) => {
                   const assignment = assignments.find(a => a.id === s.assignmentId);
                   return (
                      <div key={i} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm space-y-4">
                         <div className="flex justify-between items-start">
                            <div>
                               <h4 className="font-black text-xs uppercase text-indigo-600 mb-1">{s.studentName}</h4>
                               <p className="text-[10px] font-bold text-gray-400 uppercase">{assignment?.title || "Devoir Inconnu"}</p>
                            </div>
                            <span className="text-[9px] font-black text-gray-300 uppercase">{new Date(s.date).toLocaleDateString()}</span>
                         </div>

                         <div className="flex gap-2">
                            <button
                               onClick={() => {
                                  if (s.file.startsWith('http') || s.file.startsWith('/') || s.file.startsWith('files/')) {
                                     GSIStore.openPackFile(s.id, s.file);
                                  } else {
                                     alert(`Travail écrit : \n\n${s.file}`);
                                  }
                               }}
                               className="flex-1 bg-gray-50 py-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2"
                            >
                               <FileText size={14} /> Voir le travail
                            </button>
                            <div className={cn(
                               "px-4 py-3 rounded-xl text-[10px] font-black uppercase flex-1 flex items-center justify-center",
                               s.score !== undefined ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-gray-50 text-gray-400"
                            )}>
                               {s.score !== undefined ? `Note: ${s.score}/20` : "Non noté"}
                            </div>
                         </div>
                         {s.feedback && (
                            <div className="p-3 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                               <p className="text-[8px] font-black uppercase text-gray-400 mb-1">Commentaire Prof :</p>
                               <p className="text-[10px] font-medium text-gray-600 italic">"{s.feedback}"</p>
                            </div>
                         )}
                      </div>
                   );
                })}
                {submissions.length === 0 && <p className="text-center py-20 text-[10px] font-bold text-gray-300 uppercase italic">Aucun devoir rendu trouvé</p>}
             </div>
          </div>
        )}

        {activeTab === "media" && (
          <div className="space-y-4">
            <PageHeader title="Médiathèque GSI" onBack={() => setActiveTab("dashboard")} />
            <div className="bg-white rounded-[32px] overflow-hidden border border-gray-100 shadow-sm h-[600px]">
               <iframe
                 src="https://groupegsi.mg/rtmggmg/embed/gallery?category=application"
                 width="100%"
                 height="100%"
                 frameBorder="0"
               ></iframe>
            </div>
          </div>
        )}

        {activeTab === "stats" && (
           <div className="space-y-4">
            <PageHeader title="Stats & Rapports" onBack={() => setActiveTab("dashboard")} />
            <div className="bg-indigo-600 p-8 rounded-[40px] text-white shadow-xl relative overflow-hidden">
               <TrendingUp className="absolute right-[-10px] top-[-10px] w-32 h-32 opacity-10" />
               <p className="text-xs font-bold uppercase opacity-60 mb-1">Croissance Annuelle</p>
               <h2 className="text-3xl font-black mb-4">+24.5%</h2>
               <div className="flex gap-2">
                  <button onClick={() => toast.success("Export PDF lancé pour tous les campus")} className="px-4 py-2 bg-white/20 rounded-xl text-[10px] font-bold active:scale-95 transition-all">PDF REPORT</button>
                  <button onClick={() => toast.success("Export Excel lancé (Global GSI)")} className="px-4 py-2 bg-white/20 rounded-xl text-[10px] font-bold active:scale-95 transition-all">EXCEL DATA</button>
               </div>
            </div>

          </div>
        )}
      </div>

      {/* Student Detail Modal */}
      {viewingStudent && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-md rounded-t-[40px] sm:rounded-[40px] overflow-hidden shadow-2xl relative animate-in slide-in-from-bottom-10 duration-300">
              <div className="bg-indigo-600 p-8 pt-12 text-white relative">
                 <button onClick={() => setViewingStudent(null)} className="absolute right-6 top-6 p-2 bg-white/10 rounded-2xl hover:bg-white/20 transition-colors">
                    <X size={20} />
                 </button>

                 <div className="flex flex-col items-center text-center">
                    <div className="w-24 h-24 rounded-[32px] border-4 border-white/20 overflow-hidden shadow-2xl bg-white/10 mb-4">
                       <img
                         src={GSIStore.getAbsoluteUrl(viewingStudent.photo) || `https://api.dicebear.com/7.x/initials/svg?seed=${viewingStudent.fullName}`}
                         className="w-full h-full object-cover"
                         onError={(e) => { e.currentTarget.src = `https://api.dicebear.com/7.x/initials/svg?seed=${viewingStudent.fullName}`; }}
                       />
                    </div>
                    <h2 className="text-2xl font-black uppercase tracking-tight">{viewingStudent.fullName}</h2>
                    <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mt-1">{viewingStudent.role}</p>
                 </div>
              </div>

              <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-3xl border border-gray-100">
                       <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Matricule</p>
                       <p className="text-sm font-black text-indigo-600">{viewingStudent.matricule || "N/A"}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-3xl border border-gray-100">
                       <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Campus</p>
                       <p className="text-sm font-black text-gray-800">{viewingStudent.campus || "N/A"}</p>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-3xl border border-gray-100">
                       <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                          <Mail size={18} />
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase">Email Contact</p>
                          <p className="text-xs font-bold text-gray-700">{viewingStudent.email}</p>
                       </div>
                    </div>

                    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-3xl border border-gray-100">
                       <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-purple-600 shadow-sm">
                          <GraduationCap size={18} />
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase">Cursus Académique</p>
                          <p className="text-xs font-bold text-gray-700">{viewingStudent.filiere} — {viewingStudent.niveau}</p>
                       </div>
                    </div>
                 </div>

                 {viewingStudent.role === 'student' && (
                   <div className="pt-4 border-t border-gray-100">
                      <button
                        onClick={() => {
                           setSelectedUser(viewingStudent);
                           setViewingStudent(null);
                           setShowConvocationModal(true);
                        }}
                        className="w-full bg-orange-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-orange-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                      >
                         <Mail size={18} />
                         Convoquer l'étudiant
                      </button>
                   </div>
                 )}
              </div>
              <div className="h-4 bg-gray-50"></div>
           </div>
        </div>
      )}

      {/* Convocation Modal */}
      {showConvocationModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl relative">
            <button onClick={() => setShowConvocationModal(false)} className="absolute right-6 top-6 text-gray-400"><X size={20} /></button>
            <h2 className="text-xl font-black mb-2">{t("convocation")}</h2>
            <p className="text-xs text-gray-500 mb-6 font-medium">Convoquer <span className="text-indigo-600 font-bold">{selectedUser.fullName}</span>.</p>
            <form onSubmit={async (e: any) => {
              e.preventDefault();
              GSIStore.addAnnouncement({
                id: Math.random().toString(36).substr(2, 9),
                title: `CONVOCATION OFFICIELLE`,
                message: `Vous êtes convoqué(e) le ${e.target.date.value} pour : ${e.target.motive.value}.`,
                date: new Date().toISOString(),
                author: "Direction GSI",
                type: 'convocation',
                targetUserId: selectedUser.id
              });
              toast.success("Convocation envoyée");
              setShowConvocationModal(false);
            }} className="space-y-4">
              <textarea name="motive" required className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none min-h-[100px]" placeholder="Motif..."></textarea>
              <input name="date" required type="datetime-local" className="w-full bg-gray-50 border-none rounded-2xl p-4 text-sm font-bold outline-none" />
              <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest active:scale-95">Envoyer</button>
            </form>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => router.push("/admincreat")}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-xl flex items-center justify-center active:scale-90 transition-all z-50"
      >
        <Plus size={28} />
      </button>
    </div>
  );
}

const StatCard = memo(({ label, value, change, color }: { label: string, value: string, change: string, color: string }) => {
  return (
    <div className="bg-white p-5 rounded-[32px] shadow-sm border border-gray-100">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-black ${color}`}>{value}</p>
      <p className="text-[10px] font-bold text-emerald-500 mt-1">{change}</p>
    </div>
  );
});

function ScheduleEditor({ campuses, onSave }: { campuses: string[], onSave: (s: any) => void }) {
  const [campus, setCampus] = useState(campuses[0]);
  const [niveau, setNiveau] = useState("L1");
  const [slots, setSlots] = useState<any[]>([]);

  const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

  const addSlot = () => {
    setSlots([...slots, { day: "Lundi", startTime: "08:00", endTime: "10:00", subject: "", room: "", instructor: "" }]);
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (!file) return;

     const reader = new FileReader();
     reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        // Smarter Excel Parsing
        const importedSlots = data.map((row: any) => {
           // Normalize keys to lowercase and remove spaces
           const normalizedRow: any = {};
           Object.keys(row).forEach(key => {
              normalizedRow[key.toLowerCase().replace(/\s/g, '')] = row[key];
           });

           let start = normalizedRow.debut || normalizedRow.start || "08:00";
           let end = normalizedRow.fin || normalizedRow.end || "10:00";

           // Handle "8h-10h" or "08:00-10:00" in a single "heure" or "time" column
           const timeRange = normalizedRow.heure || normalizedRow.time || normalizedRow.creneau;
           if (timeRange && typeof timeRange === 'string') {
              const parts = timeRange.split(/[-–—/]/);
              if (parts.length === 2) {
                 start = parts[0].trim().replace('h', ':').replace(/[^0-9:]/g, '');
                 end = parts[1].trim().replace('h', ':').replace(/[^0-9:]/g, '');
                 if (!start.includes(':')) start += ':00';
                 if (!end.includes(':')) end += ':00';
                 // Pad single digit hours
                 if (start.length === 4 && start.indexOf(':') === 1) start = '0' + start;
                 if (end.length === 4 && end.indexOf(':') === 1) end = '0' + end;
              }
           }

           let day = normalizedRow.jour || normalizedRow.day || "Lundi";
           // Robust day matching
           const dayLower = day.toLowerCase();
           if (dayLower.includes('lun')) day = "Lundi";
           else if (dayLower.includes('mar')) day = "Mardi";
           else if (dayLower.includes('mer')) day = "Mercredi";
           else if (dayLower.includes('jeu')) day = "Jeudi";
           else if (dayLower.includes('ven')) day = "Vendredi";
           else if (dayLower.includes('sam')) day = "Samedi";
           else if (dayLower.includes('dim')) day = "Dimanche";

           return {
              day: day,
              startTime: start,
              endTime: end,
              subject: normalizedRow.matiere || normalizedRow.subject || normalizedRow.cours || "",
              room: normalizedRow.salle || normalizedRow.room || normalizedRow.classe || "",
              instructor: normalizedRow.professeur || normalizedRow.instructor || normalizedRow.prof || ""
           };
        });

        setSlots([...slots, ...importedSlots]);
        toast.success(`${importedSlots.length} créneaux importés avec succès !`);
     };
     reader.readAsBinaryString(file);
  };

  return (
    <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-xl space-y-4">
       <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-bold">Configuration</h3>
          <div className="flex gap-2">
             <input
                type="file"
                id="excel-schedule"
                className="hidden"
                accept=".xlsx, .xls, .csv"
                onChange={handleExcelImport}
             />
             <button
                onClick={() => document.getElementById('excel-schedule')?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl text-[10px] font-black uppercase active:scale-95 transition-all"
             >
                <FileSpreadsheet size={14} />
                Import Excel
             </button>
          </div>
       </div>

       <div className="grid grid-cols-2 gap-2">
          <select value={campus} onChange={(e) => setCampus(e.target.value)} className="p-4 bg-gray-50 rounded-2xl font-bold text-xs border-none outline-none">
             {campuses.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={niveau} onChange={(e) => setNiveau(e.target.value)} className="p-4 bg-gray-50 rounded-2xl font-bold text-xs border-none outline-none">
             {["L1", "L2", "L3", "M1", "M2"].map(n => <option key={n}>{n}</option>)}
          </select>
       </div>

       <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
          {slots.map((slot, i) => (
            <div key={i} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 relative group animate-in slide-in-from-right-2">
               <button onClick={() => setSlots(slots.filter((_, idx) => idx !== i))} className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
               <div className="grid grid-cols-2 gap-2 mb-2">
                  <select value={slot.day} onChange={e => {
                    const n = [...slots]; n[i].day = e.target.value; setSlots(n);
                  }} className="p-2 bg-white rounded-lg text-[10px] font-bold">
                    {days.map(d => <option key={d}>{d}</option>)}
                  </select>
                  <div className="flex gap-1">
                     <input type="time" value={slot.startTime} onChange={e => { const n = [...slots]; n[i].startTime = e.target.value; setSlots(n); }} className="flex-1 p-2 bg-white rounded-lg text-[10px] font-bold" />
                     <input type="time" value={slot.endTime} onChange={e => { const n = [...slots]; n[i].endTime = e.target.value; setSlots(n); }} className="flex-1 p-2 bg-white rounded-lg text-[10px] font-bold" />
                  </div>
               </div>
               <input placeholder="Matière" value={slot.subject} onChange={e => { const n = [...slots]; n[i].subject = e.target.value; setSlots(n); }} className="w-full p-3 bg-white rounded-xl text-xs font-bold mb-2 outline-none" />
               <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Salle" value={slot.room} onChange={e => { const n = [...slots]; n[i].room = e.target.value; setSlots(n); }} className="p-3 bg-white rounded-xl text-[10px] font-bold outline-none" />
                  <input placeholder="Professeur" value={slot.instructor} onChange={e => { const n = [...slots]; n[i].instructor = e.target.value; setSlots(n); }} className="p-3 bg-white rounded-xl text-[10px] font-bold outline-none" />
               </div>
            </div>
          ))}
          {slots.length === 0 && <p className="text-center py-10 text-[10px] font-bold text-gray-300 uppercase italic">Aucun créneau ajouté</p>}
       </div>

       <button onClick={addSlot} className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-indigo-100 text-indigo-400 rounded-2xl text-[10px] font-black uppercase hover:bg-indigo-50 transition-all">
          <Plus size={16} /> Ajouter un créneau
       </button>

       <button
          onClick={() => onSave({ id: Math.random().toString(36).substr(2, 9), campus, niveau, lastUpdated: new Date().toISOString(), slots })}
          className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all"
       >
          Enregistrer le tableau
       </button>
    </div>
  );
}
