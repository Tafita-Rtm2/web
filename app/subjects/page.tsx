"use client";

import { AppLayout } from "@/components/app-layout";
import { useLanguage } from "@/lib/i18n";
import { Search, BookOpen, FileText, Video, Award, ChevronRight, Play, Download, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { useState, useEffect, memo } from "react";
import { GSIStore, Lesson, Assignment } from "@/lib/store";
import { toast } from "sonner";

export default function SubjectsPage() {
  const { t } = useLanguage();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<string | null>(null);

  useEffect(() => {
    const user = GSIStore.getCurrentUser();
    if (!user) return;

    const unsubLessons = GSIStore.subscribeLessons({ niveau: user.niveau }, (all) => {
      const filtered = all.filter(l => (l.filiere.includes(user.filiere) || l.filiere.length === 0));
      setLessons(filtered);

      const subjectNames = Array.from(new Set(filtered.map(l => l.subject)));
      const mapped = subjectNames.map((name, i) => {
        const count = filtered.filter(l => l.subject === name).length;
        return {
          id: i,
          title: name,
          progress: 0,
          icon: "📖",
          color: "bg-indigo-500",
          items: count
        };
      });
      setSubjects(mapped);
    });

    const unsubAssignments = GSIStore.subscribeAssignments({ niveau: user.niveau }, (all) => {
      const filtered = all.filter(a => (a.filiere.includes(user.filiere) || a.filiere.length === 0));
      setAssignments(filtered);
    });

    return () => {
      unsubLessons();
      unsubAssignments();
    };
  }, []);

  const subjectLessons = lessons.filter(l => l.subject === selectedSubject);
  const subjectAssignments = assignments.filter(a => a.subject === selectedSubject);

  return (
    <AppLayout>
      <div className="p-6 pb-24 bg-[#F8FAFC] min-h-full">
        <PageHeader
          title={selectedSubject || t("matieres")}
          onBack={selectedSubject ? () => setSelectedSubject(null) : undefined}
        />

        {!selectedSubject ? (
          <>
            <div className="relative mb-8">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Rechercher une matière..."
                className="w-full bg-white border border-gray-100 rounded-2xl py-4 pl-12 pr-4 outline-none text-sm shadow-sm focus:ring-2 ring-indigo-500/10 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              {subjects.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedSubject(s.title)}
                  className="bg-white p-5 rounded-[32px] shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-2xl text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                    {s.icon}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-black text-gray-900 text-sm uppercase tracking-tight">{s.title}</h4>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">{s.items} Ressources</p>
                  </div>
                  <ChevronRight size={20} className="text-gray-300" />
                </div>
              ))}
              {subjects.length === 0 && (
                <div className="text-center py-20 opacity-20">
                   <BookOpen size={48} className="mx-auto mb-4" />
                   <p className="text-xs font-black uppercase">Aucune matière trouvée</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
             {/* Section Leçons */}
             <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-4 ml-2">Leçons & Supports</h3>
                <div className="space-y-3">
                   {subjectLessons.map(l => (
                     <div key={l.id} className="bg-white p-4 rounded-[28px] border border-gray-100 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                           <FileText size={20} />
                        </div>
                        <div className="flex-1">
                           <h4 className="font-bold text-xs uppercase tracking-tight">{l.title}</h4>
                           <p className="text-[10px] text-gray-400 font-medium">{new Date(l.date).toLocaleDateString()}</p>
                        </div>
                        <div className="flex gap-2">
                           <button
                             onClick={() => l.files?.[0] && GSIStore.downloadPackFile(l.files[0], l.title, l.id)}
                             className={cn("p-3 rounded-xl transition-all", GSIStore.isDownloaded(l.id) ? "bg-emerald-100 text-emerald-600" : "bg-gray-50 text-gray-400")}
                           >
                              <Download size={16} />
                           </button>
                           <button
                             onClick={() => l.files?.[0] && GSIStore.openPackFile(l.id, l.files[0])}
                             className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100"
                           >
                              <Play size={16} />
                           </button>
                        </div>
                     </div>
                   ))}
                   {subjectLessons.length === 0 && <p className="text-[10px] font-bold text-gray-300 uppercase ml-4">Pas de leçons</p>}
                </div>
             </div>

             {/* Section Devoirs */}
             <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-4 ml-2">Devoirs à rendre</h3>
                <div className="space-y-3">
                   {subjectAssignments.map(a => (
                     <div key={a.id} className="bg-white p-5 rounded-[32px] border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                           <span className="bg-orange-50 text-orange-600 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">Échéance : {a.deadline}</span>
                           <Award size={16} className="text-orange-400" />
                        </div>
                        <h4 className="font-black text-xs uppercase tracking-tight mb-4">{a.title}</h4>
                        <div className="flex gap-2">
                           {a.files?.[0] && (
                             <button
                               onClick={() => GSIStore.openPackFile(a.id, a.files![0])}
                               className="flex-1 py-3 bg-gray-50 text-gray-600 rounded-xl text-[9px] font-black uppercase tracking-widest"
                             >
                               Consulter
                             </button>
                           )}
                           <button
                              disabled={isSubmitting === a.id}
                              onClick={() => {
                                 const input = document.createElement('input');
                                 input.type = 'file';
                                 input.onchange = async (e: any) => {
                                    const file = e.target.files[0];
                                    if(!file) return;

                                    const user = GSIStore.getCurrentUser();
                                    if(!user) return toast.error("Veuillez vous reconnecter.");

                                    setIsSubmitting(a.id);
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
                                    } finally {
                                       setIsSubmitting(null);
                                    }
                                 };
                                 input.click();
                              }}
                              className={cn(
                                "flex-1 py-3 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:animate-pulse",
                                isSubmitting === a.id && "bg-indigo-400"
                              )}
                           >
                              {isSubmitting === a.id ? "Envoi..." : "Déposer"}
                           </button>
                        </div>
                     </div>
                   ))}
                   {subjectAssignments.length === 0 && <p className="text-[10px] font-bold text-gray-300 uppercase ml-4">Pas de devoirs</p>}
                </div>
             </div>

             {/* Section Vidéos */}
             <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 mb-4 ml-2">Cours Vidéo</h3>
                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-white p-4 rounded-[32px] border border-gray-100 shadow-sm opacity-40">
                      <div className="aspect-video bg-gray-100 rounded-2xl mb-3 flex items-center justify-center">
                         <Video size={24} className="text-gray-300" />
                      </div>
                      <p className="text-[10px] font-black uppercase text-center">Bientôt disponible</p>
                   </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
