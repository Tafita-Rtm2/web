"use client";

import { useState, useEffect } from "react";
import {
  GraduationCap,
  Calendar,
  BookOpen,
  FileText,
  BarChart3,
  Users,
  Search,
  CalendarDays,
  LogOut,
  Megaphone,
  ChevronRight,
  Plus,
  Upload,
  Save,
  CheckCircle,
  Clock,
  RefreshCw,
  FileSpreadsheet,
  Trash2,
  Zap,
  Wifi,
  WifiOff,
  CheckCircle2
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { GSIStore, User, Lesson, Assignment, Grade, Announcement, Submission } from "@/lib/store";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { cn } from "@/lib/utils";
import { CAMPUSES, ALL_FILIERES as FILIERES, NIVEAUX, CAMPUS_FILIERES } from "@/lib/constants";
import * as XLSX from 'xlsx';

export default function ProfessorPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [students, setStudents] = useState<User[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'ready' | 'offline' | 'syncing'>('syncing');

  // Filters for submissions
  const [subFilterCampus, setSubFilterCampus] = useState("");
  const [subFilterFiliere, setSubFilterFiliere] = useState("");
  const [subFilterNiveau, setSubFilterNiveau] = useState("");

  useEffect(() => {
    const user = GSIStore.getCurrentUser();
    if (!user || user.role !== 'professor') {
      window.location.href = "/apk/login/";
      return;
    }

    const unsubs = [
      GSIStore.subscribeUsers((us) => { setStudents(us.filter(u => u.role === 'student')); setSyncStatus('ready'); }),
      GSIStore.subscribeLessons({}, (ls) => setLessons(ls)),
      GSIStore.subscribeAssignments({}, (as) => setAssignments(as)),
      GSIStore.subscribeSubmissions(undefined, (ss) => setSubmissions(ss)),
      GSIStore.subscribeAnnouncements((as) => setAnnouncements(as))
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

  const [selectedFiliere, setSelectedFiliere] = useState<string>("");
  const [selectedCampus, setSelectedCampus] = useState<string>("");

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
      author: "Professeur",
      campus: [selectedCampus],
      filiere: [selectedFiliere],
      niveau: niveau === "Tous" ? undefined : niveau
    });

    toast.success("Annonce envoyée à votre promo !");
    e.target.reset();
    setActiveTab("dashboard");
  };

  const handlePublishLesson = async (e: any) => {
    e.preventDefault();
    if (!selectedFiliere || !selectedCampus) {
      toast.error("Filière et campus obligatoires.");
      return;
    }

    const form = e.target;
    const filesInput = form.elements.namedItem('files') as HTMLInputElement;
    const files = filesInput?.files;
    const title = form.title.value;
    const tempId = Math.random().toString(36).substr(2, 9);

    setIsUploading(true);
    setActiveTab("dashboard");
    const toastId = toast.loading("Publication lancée...");

    (async () => {
      try {
        let fileUrls: string[] = [];
        if (files && files.length > 0) {
          fileUrls = await Promise.all(Array.from(files).map(f => GSIStore.uploadFile(f, `lessons/${tempId}_${f.name}`, setUploadProgress)));
        }

        await GSIStore.addLesson({
          id: tempId,
          title,
          description: form.description.value,
          subject: form.subject.value,
          niveau: form.niveau.value,
          filiere: [selectedFiliere],
          campus: [selectedCampus],
          date: new Date().toISOString(),
          files: fileUrls
        });
        toast.success(`Leçon "${title}" prête !`, { id: toastId });
      } catch (err: any) {
        toast.error("Erreur Cloud : " + err.message, { id: toastId });
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    })();
  };

  const handlePublishAssignment = async (e: any) => {
    e.preventDefault();
    const form = e.target;
    const filesInput = form.elements.namedItem('files') as HTMLInputElement;
    const files = filesInput?.files;
    const title = form.title.value;
    const tempId = Math.random().toString(36).substr(2, 9);

    setIsUploading(true);
    setActiveTab("dashboard");
    const toastId = toast.loading("Publication du devoir...");

    (async () => {
       try {
          let fileUrls: string[] = [];
          if (files && files.length > 0) {
            fileUrls = await Promise.all(Array.from(files).map(f => GSIStore.uploadFile(f, `assignments/${tempId}_${f.name}`, setUploadProgress)));
          }

          await GSIStore.addAssignment({
            id: tempId,
            title,
            description: form.description.value,
            subject: form.subject.value,
            niveau: form.niveau.value,
            filiere: [selectedFiliere],
            campus: [selectedCampus],
            deadline: form.deadline.value,
            timeLimit: "23:59",
            maxScore: 20,
            files: fileUrls
          });
          toast.success(`Devoir "${title}" disponible.`, { id: toastId });
       } catch (err: any) {
          toast.error(err.message, { id: toastId });
       } finally {
          setIsUploading(false);
          setUploadProgress(0);
       }
    })();
  };

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-[#F8FAFC] pb-20">
      {/* Quick Setup for publishing */}
      {(!selectedCampus || !selectedFiliere) && activeTab === "dashboard" && (
         <div className="bg-orange-50 p-4 border-b border-orange-100 flex items-center gap-3 animate-pulse">
            <Zap size={18} className="text-orange-500" />
            <p className="text-[10px] font-bold text-orange-700 uppercase tracking-tight">Veuillez sélectionner votre campus et matière pour commencer</p>
         </div>
      )}

      {/* Sync Status Banner */}
      <div className={cn(
        "px-6 py-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest",
        syncStatus === 'ready' ? "bg-emerald-500 text-white" :
        syncStatus === 'offline' ? "bg-orange-500 text-white" : "bg-violet-600 text-white animate-pulse"
      )}>
        <div className="flex items-center gap-2">
           {isUploading ? <RefreshCw size={12} className="animate-spin" /> : syncStatus === 'ready' ? <CheckCircle2 size={12} /> : <WifiOff size={12} />}
           <span>{isUploading ? `Envoi en cours ${Math.round(uploadProgress)}%` : syncStatus === 'ready' ? "GSI Cloud : Connecté" : "Hors-ligne"}</span>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white p-6 rounded-b-[40px] shadow-sm mb-6 border-b border-violet-100">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-violet-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
              <GraduationCap size={28} />
            </div>
            <div>
              <h1 className="text-xl font-bold">Prof Portal</h1>
              <p className="text-[10px] text-gray-400 font-black uppercase">GSI Internationale</p>
            </div>
          </div>
          <button
            onClick={() => {
              GSIStore.logout();
              toast.success("Déconnexion");
              window.location.href = "/apk/login/";
            }}
            className="p-3 bg-gray-50 rounded-xl text-gray-400 active:scale-90"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      <div className="px-6 space-y-8 flex-1 pb-10">
        {activeTab === "dashboard" && (
          <>
            {/* Section Selection */}
            <div className="bg-white p-6 rounded-[32px] border border-violet-100 shadow-sm space-y-4">
               <h3 className="text-[10px] font-black uppercase tracking-widest text-violet-600">Configuration de Section</h3>

               <div className="space-y-2">
                  <p className="text-[9px] font-bold text-gray-400 uppercase ml-2">Sélectionner le Campus</p>
                  <div className="grid grid-cols-2 gap-2">
                     {CAMPUSES.map(c => (
                       <button key={c} onClick={() => { setSelectedCampus(c); setSelectedFiliere(""); }} className={cn("p-2 rounded-xl text-[10px] font-bold transition-all", selectedCampus === c ? "bg-violet-600 text-white shadow-lg shadow-violet-100" : "bg-gray-50 text-gray-400 border border-gray-100")}>{c}</button>
                     ))}
                  </div>
               </div>

               {selectedCampus && (
                  <div className="space-y-2 animate-in slide-in-from-top-2">
                     <p className="text-[9px] font-bold text-gray-400 uppercase ml-2">Sélectionner la Filière ({selectedCampus})</p>
                     <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-2 bg-gray-50 rounded-2xl border border-gray-100">
                        {(CAMPUS_FILIERES[selectedCampus] || []).map(f => (
                          <button key={f} onClick={() => setSelectedFiliere(f)} className={cn("px-3 py-2 rounded-lg text-[9px] font-bold transition-all", selectedFiliere === f ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100" : "bg-white text-gray-400 border border-gray-100")}>{f}</button>
                        ))}
                     </div>
                  </div>
               )}
            </div>

            <div className="grid grid-cols-2 gap-4">
            {[{id: "lessons", icon: BookOpen, label: "Publier Leçon", color: "bg-emerald-500"},
              {id: "assignments", icon: FileText, label: "Publier Devoir", color: "bg-orange-500"},
              {id: "submissions", icon: CheckCircle, label: "Devoirs Reçus", color: "bg-blue-500"},
              {id: "grades", icon: BarChart3, label: "Notes", color: "bg-pink-500"},
              {id: "schedule", icon: CalendarDays, label: "Mon Planning", color: "bg-violet-600"},
              {id: "announcements", icon: Megaphone, label: "Annonce", color: "bg-orange-600"},
              {id: "media", icon: BookOpen, label: "Médiathèque", color: "bg-emerald-600"},
              {id: "students", icon: Users, label: "Étudiants", color: "bg-indigo-500"}].map(item => (
              <button key={item.id} onClick={() => {
                 if ((item.id === "lessons" || item.id === "assignments" || item.id === "announcements" || item.id === "students" || item.id === "grades" || item.id === "schedule") && (!selectedCampus || !selectedFiliere)) {
                    return toast.error("Veuillez d'abord sélectionner un campus et une filière.");
                 }
                 setActiveTab(item.id);
              }} className="bg-white p-5 rounded-[32px] shadow-sm border border-gray-100 flex flex-col items-center gap-3 active:scale-95">
                <div className={`${item.color} w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-black/5`}><item.icon size={24} /></div>
                <span className="text-[10px] font-black uppercase tracking-tight">{item.label}</span>
              </button>
            ))}
          </div>
          </>
        )}

        {(activeTab === "lessons" || activeTab === "assignments") && (
          <div className="space-y-6">
            <PageHeader title={activeTab === 'lessons' ? "Publier Leçon" : "Publier Devoir"} onBack={() => setActiveTab("dashboard")} />
            <form onSubmit={activeTab === 'lessons' ? handlePublishLesson : handlePublishAssignment} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-xl space-y-4">
                <div className="p-4 bg-violet-50 rounded-2xl border border-violet-100">
                   <p className="text-[10px] font-black uppercase text-violet-400 mb-1">Cible</p>
                   <p className="text-xs font-bold text-violet-700">{selectedCampus} • {selectedFiliere}</p>
                </div>
                <input name="subject" required className="w-full bg-gray-50 rounded-2xl p-4 text-sm font-bold outline-none" placeholder="Matière (ex: Mathématiques)" />
                <input name="title" required className="w-full bg-gray-50 rounded-2xl p-4 text-sm font-bold outline-none" placeholder="Titre du document" />
                <textarea name="description" required className="w-full bg-gray-50 rounded-2xl p-4 text-sm font-bold outline-none min-h-[100px]" placeholder="Description ou instructions..."></textarea>

                <div className="flex gap-2">
                   <select name="niveau" className="flex-1 p-4 bg-gray-50 rounded-2xl font-bold text-xs">
                      {NIVEAUX.map(n => <option key={n}>{n}</option>)}
                   </select>
                   {activeTab === 'assignments' && (
                     <input name="deadline" type="date" required className="flex-1 p-4 bg-gray-50 rounded-2xl font-bold text-xs" />
                   )}
                </div>

                <input name="files" type="file" multiple className="w-full p-2 text-[10px]" />

                <button type="submit" disabled={isUploading} className="w-full bg-violet-600 text-white py-5 rounded-2xl font-black uppercase shadow-lg active:scale-95">Publier Maintenant</button>
            </form>

            <div className="space-y-3 mt-8">
               <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 px-2">
                 {activeTab === 'lessons' ? "Archives Leçons" : "Archives Devoirs"}
               </h3>
               {(activeTab === 'lessons' ? lessons : assignments)
               .filter(item => item.campus.includes(selectedCampus) && item.filiere.includes(selectedFiliere))
               .map((item: any, i) => (
                 <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between shadow-sm group">
                    <div className="flex-1 pr-4">
                       <h4 className="font-bold text-[11px] uppercase mb-1 group-hover:text-violet-600 transition-colors">{item.title}</h4>
                       <p className="text-[9px] text-gray-400 font-bold uppercase">{item.subject} • {item.niveau}</p>
                    </div>
                    <button
                      onClick={async () => {
                        if(confirm("Supprimer cet élément ?")) {
                          if (activeTab === 'lessons') await GSIStore.deleteLesson(item.id);
                          else await GSIStore.deleteAssignment(item.id);
                          toast.success("Supprimé");
                        }
                      }}
                      className="p-2 text-red-400 hover:text-red-600 bg-red-50 rounded-xl transition-all active:scale-90"
                    >
                       <Trash2 size={16} />
                    </button>
                 </div>
               ))}
               {(activeTab === 'lessons' ? lessons : assignments).length === 0 && (
                 <p className="text-center py-10 text-[10px] font-bold text-gray-300 uppercase italic">Aucun contenu publié</p>
               )}
            </div>
          </div>
        )}

        {activeTab === "schedule" && (
           <div className="space-y-6">
              <PageHeader title="Mon Emploi du Temps" onBack={() => setActiveTab("dashboard")} />
              <div className="bg-white p-6 rounded-[32px] border border-violet-100 shadow-xl space-y-4">
                 <div className="p-4 bg-violet-50 rounded-2xl border border-violet-100 mb-2">
                    <p className="text-[10px] font-black uppercase text-violet-400 mb-1">Target Section</p>
                    <p className="text-xs font-bold text-violet-700">{selectedCampus} • {selectedFiliere}</p>
                 </div>
                 <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-bold">Import planning</h3>
                    <button
                       onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = '.xlsx, .xls, .csv';
                          input.onchange = (e: any) => {
                             const file = e.target.files[0];
                             if (!file) return;
                             const reader = new FileReader();
                             reader.onload = (evt) => {
                                const bstr = evt.target?.result;
                                const wb = XLSX.read(bstr, { type: 'binary' });
                                const wsname = wb.SheetNames[0];
                                const ws = wb.Sheets[wsname];
                                const data = XLSX.utils.sheet_to_json(ws);

                                toast.success(`${data.length} créneaux détectés. Enregistrement en cours...`);

                                // Professors use their selected campus/filiere
                                const targetNiveau = prompt("Pour quel niveau (ex: L1) ?", "L1");

                                if (targetNiveau) {
                                   const formatTime = (t: any) => {
                                      if (t === undefined || t === null || t === "") return null;
                                      if (typeof t === 'number') {
                                         const totalSeconds = Math.round(t * 86400);
                                         const h = Math.floor(totalSeconds / 3600);
                                         const m = Math.floor((totalSeconds % 3600) / 60);
                                         return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                                      }
                                      let s = String(t).toLowerCase().trim();
                                      if (s.includes('h')) s = s.replace('h', ':');
                                      if (!s.includes(':')) {
                                         if (s.length > 0 && s.length <= 2) s += ':00';
                                         else if (s.length === 4 && !isNaN(Number(s))) s = s.substring(0, 2) + ':' + s.substring(2);
                                      }
                                      const parts = s.split(':');
                                      const hh = parts[0].padStart(2, '0');
                                      const mm = (parts[1] || '00').padEnd(2, '0').substring(0, 2);
                                      return `${hh}:${mm}`;
                                   };

                                   const slots = data.map((row: any) => {
                                      const normalizedRow: any = {};
                                      Object.keys(row).forEach(key => {
                                         normalizedRow[key.toLowerCase().replace(/\s/g, '')] = row[key];
                                      });

                                      let start = formatTime(normalizedRow.debut || normalizedRow.start) || "08:00";
                                      let end = formatTime(normalizedRow.fin || normalizedRow.end) || "10:00";

                                      const timeRange = normalizedRow.heure || normalizedRow.time || normalizedRow.creneau;
                                      if (timeRange) {
                                         const parts = String(timeRange).split(/[-–—/]/);
                                         if (parts.length === 2) {
                                            const s = formatTime(parts[0]);
                                            const e = formatTime(parts[1]);
                                            if (s) start = s;
                                            if (e) end = e;
                                         }
                                      }

                                      let day = normalizedRow.jour || normalizedRow.day || "Lundi";
                                      const dayLower = day.toLowerCase();
                                      if (dayLower.includes('lun')) day = "Lundi";
                                      else if (dayLower.includes('mar')) day = "Mardi";
                                      else if (dayLower.includes('mer')) day = "Mercredi";
                                      else if (dayLower.includes('jeu')) day = "Jeudi";
                                      else if (dayLower.includes('ven')) day = "Vendredi";
                                      else if (dayLower.includes('sam')) day = "Samedi";

                                      return {
                                         day,
                                         startTime: start,
                                         endTime: end,
                                         subject: normalizedRow.matiere || normalizedRow.subject || "Cours",
                                         room: normalizedRow.salle || normalizedRow.room || "-",
                                         instructor: GSIStore.getCurrentUser()?.fullName || "-"
                                      };
                                   });

                                   GSIStore.addSchedule({
                                      id: Math.random().toString(36).substr(2,9),
                                      campus: selectedCampus,
                                      niveau: targetNiveau,
                                      lastUpdated: new Date().toISOString(),
                                      slots
                                   });
                                   toast.success("Planning mis à jour !");
                                }
                             };
                             reader.readAsBinaryString(file);
                          };
                          input.click();
                       }}
                       className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl text-[10px] font-black uppercase active:scale-95 transition-all"
                    >
                       <FileSpreadsheet size={14} />
                       Import Excel
                    </button>
                 </div>
                 <p className="text-[10px] text-gray-400 font-medium leading-relaxed italic">
                    Astuce: Importez un fichier Excel avec les colonnes "Jour", "Debut", "Fin", "Matiere", "Salle" pour mettre à jour l'emploi du temps des étudiants.
                 </p>
              </div>
           </div>
        )}

        {activeTab === "grades" && (
          <div className="space-y-4">
             <PageHeader title="Saisie des Notes" onBack={() => setActiveTab("dashboard")} />
             <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-xl space-y-4">
                <div className="p-4 bg-pink-50 rounded-2xl border border-pink-100 mb-2">
                   <p className="text-[10px] font-black uppercase text-pink-400 mb-1">Classe Actuelle</p>
                   <p className="text-xs font-bold text-pink-700">{selectedCampus} • {selectedFiliere}</p>
                </div>
                <div className="flex justify-between items-center mb-2">
                   <h3 className="text-sm font-bold">Grille de saisie</h3>
                   <button
                     onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = '.xlsx, .xls, .csv';
                        input.onchange = (e: any) => {
                           const file = e.target.files[0];
                           if (!file) return;
                           const reader = new FileReader();
                           reader.onload = (evt) => {
                              const bstr = evt.target?.result;
                              const wb = XLSX.read(bstr, { type: 'binary' });
                              const wsname = wb.SheetNames[0];
                              const ws = wb.Sheets[wsname];
                              const data = XLSX.utils.sheet_to_json(ws);

                              let count = 0;
                              data.forEach((row: any) => {
                                 // Try to find student by name or matricule in the row
                                 const name = row.Nom || row.Name || row.Student || row.Etudiant;
                                 const matricule = row.Matricule || row.ID;
                                 const note = row.Note || row.Grade || row.Score;
                                 const subject = row.Matiere || row.Subject;

                                 const student = students.find(s =>
                                    (name && s.fullName.toLowerCase().includes(name.toString().toLowerCase())) ||
                                    (matricule && s.matricule === matricule.toString())
                                 );

                                 if (student && note !== undefined) {
                                    const el = document.getElementById(`grade-${student.id}`) as HTMLInputElement;
                                    if (el) el.value = note.toString();
                                    if (subject) {
                                       const subEl = document.getElementById('grade-subject') as HTMLInputElement;
                                       if (subEl) subEl.value = subject.toString();
                                    }
                                    count++;
                                 }
                              });
                              toast.success(`${count} notes importées avec succès !`);
                           };
                           reader.readAsBinaryString(file);
                        };
                        input.click();
                     }}
                     className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 active:scale-95 transition-all"
                   >
                      <FileSpreadsheet size={14} />
                      Import Excel
                   </button>
                </div>
                <input id="grade-subject" className="w-full bg-gray-50 rounded-2xl p-4 text-sm font-bold" placeholder="Matière de l'examen" />
                <div className="max-h-60 overflow-y-auto space-y-2">
                   {students
                   .filter(s => s.campus === selectedCampus && s.filiere === selectedFiliere)
                   .map(s => (
                     <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <span className="text-xs font-bold">{s.fullName}</span>
                        <input id={`grade-${s.id}`} type="number" className="w-12 p-2 rounded-lg text-center font-bold" placeholder="-" max="20" />
                     </div>
                   ))}
                </div>
                <button
                  onClick={async () => {
                    const subject = (document.getElementById('grade-subject') as HTMLInputElement).value;
                    if(!subject) return toast.error("Matière requise");
                    const toastId = toast.loading("Enregistrement...");
                    for(const s of students) {
                      const score = (document.getElementById(`grade-${s.id}`) as HTMLInputElement).value;
                      if(score) {
                        await GSIStore.addGrade({
                          id: Math.random().toString(36).substr(2,9),
                          studentId: s.id,
                          studentName: s.fullName,
                          subject,
                          score: parseFloat(score),
                          maxScore: 20,
                          date: new Date().toISOString().split('T')[0],
                          niveau: s.niveau,
                          filiere: s.filiere
                        });
                      }
                    }
                    toast.success("Notes publiées !", { id: toastId });
                    setActiveTab("dashboard");
                  }}
                  className="w-full bg-pink-500 text-white py-4 rounded-xl font-bold active:scale-95"
                >
                  Valider la classe
                </button>
             </div>
          </div>
        )}

        {activeTab === "announcements" && (
          <div className="space-y-6">
            <PageHeader title="Envoyer une Annonce" onBack={() => setActiveTab("dashboard")} />
            <form onSubmit={handleSendAnnouncement} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-xl space-y-4">
                <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                   <p className="text-[10px] font-black uppercase text-orange-400 mb-1">Cible</p>
                   <p className="text-xs font-bold text-orange-700">{selectedCampus} • {selectedFiliere}</p>
                </div>
                <input name="title" required className="w-full bg-gray-50 rounded-2xl p-4 text-sm font-bold outline-none" placeholder="Titre de l'annonce" />
                <textarea name="message" required className="w-full bg-gray-50 rounded-2xl p-4 text-sm font-bold outline-none min-h-[100px]" placeholder="Votre message aux étudiants..."></textarea>

                <select name="niveau" className="w-full p-4 bg-gray-50 rounded-2xl font-bold text-xs">
                   <option>Tous</option>
                   {NIVEAUX.map(n => <option key={n}>{n}</option>)}
                </select>

                <button type="submit" className="w-full bg-orange-600 text-white py-5 rounded-2xl font-black uppercase shadow-lg active:scale-95">Envoyer aux Étudiants</button>
            </form>
          </div>
        )}

        {activeTab === "media" && (
          <div className="space-y-4">
            <PageHeader title="Médiathèque" onBack={() => setActiveTab("dashboard")} />
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

        {activeTab === "students" && (
          <div className="space-y-4">
            <PageHeader title={`Étudiants ${selectedCampus}`} onBack={() => setActiveTab("dashboard")} />
            <p className="text-[10px] font-bold text-gray-400 uppercase ml-2">{selectedFiliere}</p>
            {students
            .filter(s => s.campus === selectedCampus && s.filiere === selectedFiliere)
            .map((s, i) => (
              <div key={i} className="bg-white p-4 rounded-3xl border border-gray-100 flex items-center gap-4 shadow-sm">
                 <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center font-bold text-indigo-600 overflow-hidden">
                    {s.photo ? (
                      <img
                        src={GSIStore.getMediaUrl(s.photo)}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = `https://api.dicebear.com/7.x/initials/svg?seed=${s.fullName}`;
                        }}
                      />
                    ) : s.fullName.charAt(0)}
                 </div>
                 <div className="flex-1"><h4 className="font-bold text-sm">{s.fullName}</h4><p className="text-[10px] text-gray-400 font-bold uppercase">{s.filiere} • {s.niveau}</p></div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "submissions" && (
          <div className="space-y-4">
             <PageHeader title="Devoirs Reçus" onBack={() => setActiveTab("dashboard")} />

             {/* Active Section Filter */}
             <div className="bg-white p-4 rounded-3xl border border-violet-100 shadow-sm flex items-center justify-between">
                <div>
                   <p className="text-[8px] font-black uppercase text-gray-400">Filtrage Actif</p>
                   <p className="text-[10px] font-bold text-violet-600 uppercase">{selectedCampus} • {selectedFiliere}</p>
                </div>
                <select
                   value={subFilterNiveau}
                   onChange={(e) => setSubFilterNiveau(e.target.value)}
                   className="p-2 bg-gray-50 rounded-xl text-[10px] font-bold outline-none border border-gray-100"
                >
                   <option value="">Tous Niveaux</option>
                   {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
             </div>

             <div className="space-y-3">
                {submissions
                .filter(s => {
                   // Filter by active section
                   const campus = s.campus || students.find(u => u.id === s.studentId)?.campus;
                   const filiere = s.filiere || students.find(u => u.id === s.studentId)?.filiere;
                   const niveau = s.niveau || students.find(u => u.id === s.studentId)?.niveau;

                   if (campus !== selectedCampus) return false;
                   if (filiere !== selectedFiliere) return false;
                   if (subFilterNiveau && niveau !== subFilterNiveau) return false;
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
                               onClick={() => GSIStore.openPackFile(s.id, s.file)}
                               className="flex-1 bg-gray-50 py-3 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2"
                            >
                               <FileText size={14} /> Voir le travail
                            </button>
                            <button
                               onClick={() => {
                                  const score = prompt("Note (sur 20) :", s.score?.toString() || "");
                                  if (score !== null && score !== "") {
                                     const num = parseFloat(score);
                                     if (isNaN(num)) return toast.error("Note invalide");

                                     const feedback = prompt("Commentaire pour l'élève :", s.feedback || "");
                                     GSIStore.updateSubmission({ ...s, score: num, feedback: feedback || undefined });
                                     toast.success("Note et commentaire envoyés !");
                                  }
                               }}
                               className={cn(
                                  "px-4 py-3 rounded-xl text-[10px] font-black uppercase flex-1 transition-all",
                                  s.score !== undefined ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                               )}
                            >
                               {s.score !== undefined ? `Note: ${s.score}/20` : "Noter"}
                            </button>
                         </div>
                         {s.feedback && (
                            <div className="p-3 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                               <p className="text-[8px] font-black uppercase text-gray-400 mb-1">Votre commentaire :</p>
                               <p className="text-[10px] font-medium text-gray-600 italic">"{s.feedback}"</p>
                            </div>
                         )}
                      </div>
                   );
                })}
                {submissions.length === 0 && <p className="text-center py-20 text-[10px] font-bold text-gray-300 uppercase italic">Aucun devoir rendu pour le moment</p>}
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
