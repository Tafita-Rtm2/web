"use client";

import { AppLayout } from "@/components/app-layout";
import { useState, useEffect } from "react";
import { Clock, Plus, Trash2, Bell, ChevronLeft, Calendar as CalendarIcon, Save, X, BookOpen, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { GSIStore, Reminder } from "@/lib/store";

export default function ProgramPage() {
  const router = useRouter();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);

  useEffect(() => {
    const unsub = GSIStore.subscribeReminders((rs) => {
      setReminders(rs.sort((a,b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)));
    });
    return () => unsub();
  }, []);

  const handleSave = async (e: any) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const r: Reminder = {
      id: editingReminder?.id || Math.random().toString(36).substr(2, 9),
      title: formData.get('title') as string,
      date: formData.get('date') as string,
      time: formData.get('time') as string,
      subject: formData.get('subject') as string,
      notes: formData.get('notes') as string,
      completed: editingReminder?.completed || false,
      isAlarm: true
    };

    if (editingReminder) {
      await GSIStore.updateReminder(r);
      toast.success("Rappel mis à jour !");
    } else {
      await GSIStore.addReminder(r);
      toast.success("Programme d'étude enregistré !");
    }

    setShowAdd(false);
    setEditingReminder(null);
  };

  const toggleComplete = async (r: Reminder) => {
    await GSIStore.updateReminder({ ...r, completed: !r.completed });
  };

  const deleteReminder = async (id: string) => {
    await GSIStore.deleteReminder(id);
    toast.info("Session supprimée.");
  };

  return (
    <AppLayout>
      <div className="p-6 pb-24 bg-[#F8FAFC] min-h-full">
        <PageHeader title="Plan de Révision" />

        <div className="bg-gradient-to-br from-indigo-600 to-violet-800 rounded-[40px] p-8 text-white mb-8 shadow-xl relative overflow-hidden">
           <div className="relative z-10">
              <h2 className="text-xl font-black mb-2 tracking-tight uppercase">Rappels Alarme</h2>
              <p className="text-[10px] text-indigo-100 font-bold leading-relaxed mb-6 opacity-80 uppercase tracking-widest">
                 Configurez vos sessions d'étude. Votre téléphone sonnera le moment venu pour vous notifier de réviser.
              </p>
              <button
                onClick={() => { setEditingReminder(null); setShowAdd(true); }}
                className="bg-white text-indigo-600 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center gap-2"
              >
                <Plus size={14} /> Nouvelle Session
              </button>
           </div>
           <Bell className="absolute right-[-20px] top-[-20px] w-40 h-40 opacity-10 rotate-12" />
        </div>

        <div className="space-y-4">
           {reminders.map(r => (
             <div key={r.id} className={cn(
               "bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex items-center gap-4 transition-all",
               r.completed && "opacity-50 grayscale"
             )}>
                <button onClick={() => toggleComplete(r)} className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center transition-all",
                  r.completed ? "bg-emerald-500 text-white" : "bg-indigo-50 text-indigo-600"
                )}>
                   {r.completed ? <Save size={20} /> : <Clock size={20} />}
                </button>

                <div className="flex-1" onClick={() => { setEditingReminder(r); setShowAdd(true); }}>
                   <h4 className="font-black text-xs uppercase tracking-tight text-gray-900">{r.subject}</h4>
                   <p className="text-[10px] font-bold text-gray-400 mb-1">{r.title}</p>
                   <div className="flex items-center gap-3">
                      <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{new Date(r.date).toLocaleDateString()} • {r.time}</span>
                   </div>
                </div>

                <button onClick={() => deleteReminder(r.id)} className="text-gray-300 hover:text-red-500 p-2 transition-colors">
                   <Trash2 size={18} />
                </button>
             </div>
           ))}

           {reminders.length === 0 && (
             <div className="flex flex-col items-center justify-center py-20 opacity-20 text-center">
                <AlertCircle size={64} className="mb-4" />
                <p className="font-black uppercase text-xs tracking-widest">Aucun rappel actif</p>
                <p className="text-[10px] mt-2 max-w-[200px]">Ajoutez vos matières à réviser pour ne rien oublier.</p>
             </div>
           )}
        </div>
      </div>

      {showAdd && (
         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-sm rounded-[40px] p-8 shadow-2xl animate-in zoom-in-95">
               <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-black uppercase tracking-tight">{editingReminder ? 'Modifier' : 'Ajouter'} Session</h3>
                  <button onClick={() => setShowAdd(false)} className="text-gray-400"><X size={24} /></button>
               </div>

               <form onSubmit={handleSave} className="space-y-4">
                  <div className="space-y-2">
                     <p className="text-[9px] font-black text-gray-400 uppercase ml-2">Matière & Détails</p>
                     <input name="subject" defaultValue={editingReminder?.subject} required className="w-full bg-gray-50 border-none rounded-2xl p-4 text-xs font-bold outline-none" placeholder="Ex: Mathématiques" />
                     <input name="title" defaultValue={editingReminder?.title} required className="w-full bg-gray-50 border-none rounded-2xl p-4 text-xs font-bold outline-none" placeholder="Ex: Révision Chapitre 4" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <p className="text-[9px] font-black text-gray-400 uppercase ml-2">Date</p>
                        <input name="date" type="date" defaultValue={editingReminder?.date} required className="w-full bg-gray-50 border-none rounded-2xl p-4 text-[10px] font-bold outline-none" />
                     </div>
                     <div className="space-y-2">
                        <p className="text-[9px] font-black text-gray-400 uppercase ml-2">Heure Alarme</p>
                        <input name="time" type="time" defaultValue={editingReminder?.time} required className="w-full bg-gray-50 border-none rounded-2xl p-4 text-[10px] font-bold outline-none" />
                     </div>
                  </div>

                  <div className="space-y-2">
                     <p className="text-[9px] font-black text-gray-400 uppercase ml-2">Notes (facultatif)</p>
                     <textarea name="notes" defaultValue={editingReminder?.notes} className="w-full bg-gray-50 border-none rounded-2xl p-4 text-xs font-bold outline-none min-h-[80px]" placeholder="Pages à lire, exercices..."></textarea>
                  </div>

                  <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-100 active:scale-95 transition-all mt-4">
                     {editingReminder ? 'Mettre à jour' : 'Lancer le rappel'}
                  </button>
               </form>
            </div>
         </div>
      )}
    </AppLayout>
  );
}
