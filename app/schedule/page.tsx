"use client";

import { AppLayout } from "@/components/app-layout";
import { useLanguage } from "@/lib/i18n";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Download, FileText, Clock, MapPin, User as UserIcon, Plus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { GSIStore, StructuredSchedule, ScheduleSlot, Reminder } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";

export default function SchedulePage() {
  const { t } = useLanguage();
  const [selectedDay, setSelectedDay] = useState("Lundi");
  const [schedule, setSchedule] = useState<StructuredSchedule | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');

  const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

  useEffect(() => {
    const user = GSIStore.getCurrentUser();
    if (!user) return;

    const unsubs = [
      GSIStore.subscribeLatestSchedule(user.campus, user.niveau, (s) => {
         if (schedule && JSON.stringify(s) !== JSON.stringify(schedule)) {
            toast.info("L'emploi du temps a été mis à jour par l'administration.");
         }
         setSchedule(s);
      }),
      GSIStore.subscribeReminders((rs) => setReminders(rs.filter(r => r.isAlarm)))
    ];

    return () => unsubs.forEach(u => u());
  }, [schedule]);

  const dailySlots = schedule?.slots?.filter(s => s.day === selectedDay) || [];

  const addPersonalProgram = () => {
     const title = prompt("Titre de votre session d'étude :");
     const time = prompt("Heure (HH:mm) :", "18:00");
     const subject = prompt("Matière :");
     if (title && time && subject) {
        GSIStore.addReminder({
           id: Math.random().toString(36).substr(2, 9),
           title,
           date: new Date().toISOString().split('T')[0],
           time,
           subject,
           completed: false,
           isAlarm: true
        });
        toast.success("Programme ajouté avec alarme !");
     }
  };

  const getFiliereColor = (subject: string) => {
     const hash = subject.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
     const colors = ["bg-indigo-600", "bg-emerald-600", "bg-orange-600", "bg-rose-600", "bg-violet-600", "bg-sky-600"];
     return colors[hash % colors.length];
  };

  return (
    <AppLayout>
      <div className="p-6 pb-24 bg-[#F8FAFC] min-h-full">
        <PageHeader title={t("planning")} />

        {/* Days Selector */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-hide">
           {days.map((day) => (
             <button
               key={day}
               onClick={() => setSelectedDay(day)}
               className={cn(
                 "px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap",
                 selectedDay === day
                   ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100 scale-105"
                   : "bg-white text-gray-400 border border-gray-100"
               )}
             >
               {day}
             </button>
           ))}
        </div>

        {/* View Mode Switch */}
        <div className="flex bg-white/50 p-1 rounded-2xl mb-6 border border-gray-100 self-center max-w-fit mx-auto">
           <button onClick={() => setViewMode('day')} className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", viewMode === 'day' ? "bg-white text-primary shadow-sm" : "text-gray-400")}>Jour</button>
           <button onClick={() => setViewMode('week')} className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", viewMode === 'week' ? "bg-white text-primary shadow-sm" : "text-gray-400")}>Semaine</button>
        </div>

        {/* Schedule Grid */}
        <div className="space-y-4 mb-12">
           {viewMode === 'day' ? (
              dailySlots.sort((a,b) => a.startTime.localeCompare(b.startTime)).map((slot, i) => (
                <div key={i} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex gap-6 relative overflow-hidden group hover:shadow-md transition-all">
                   <div className="flex flex-col items-center justify-center border-r border-gray-100 pr-6 min-w-[80px]">
                      <span className="text-sm font-black text-gray-900">{slot.startTime}</span>
                      <div className="w-0.5 h-4 bg-gray-100 my-1"></div>
                      <span className="text-[10px] font-bold text-gray-400">{slot.endTime}</span>
                   </div>

                   <div className="flex-1 py-1">
                      <h3 className="font-black text-sm text-gray-900 uppercase tracking-tight mb-3">{slot.subject}</h3>
                      <div className="flex flex-wrap gap-4">
                         <div className="flex items-center gap-1.5">
                            <MapPin size={12} className="text-gray-400" />
                            <span className="text-[10px] font-bold text-gray-500">{slot.room}</span>
                         </div>
                         <div className="flex items-center gap-1.5">
                            <UserIcon size={12} className="text-gray-400" />
                            <span className="text-[10px] font-bold text-gray-500">{slot.instructor}</span>
                         </div>
                      </div>
                   </div>

                   <div className={cn("absolute right-0 top-0 bottom-0 w-1.5 transition-opacity", getFiliereColor(slot.subject))}></div>
                </div>
              ))
           ) : (
              <div className="space-y-6">
                 {days.map(d => {
                    const slots = schedule?.slots?.filter(s => s.day === d) || [];
                    if (slots.length === 0) return null;
                    return (
                       <div key={d} className="space-y-2">
                          <h4 className="text-[10px] font-black uppercase text-gray-400 px-2 tracking-[0.2em]">{d}</h4>
                          {slots.sort((a,b) => a.startTime.localeCompare(b.startTime)).map((slot, i) => (
                             <div key={i} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                                <div>
                                   <p className="text-[11px] font-black uppercase text-gray-800">{slot.subject}</p>
                                   <p className="text-[9px] font-bold text-gray-400">{slot.startTime} — {slot.room}</p>
                                </div>
                                <div className={cn("w-2 h-2 rounded-full", getFiliereColor(slot.subject))}></div>
                             </div>
                          ))}
                       </div>
                    );
                 })}
              </div>
           )}

           {dailySlots.length === 0 && (
             <div className="flex flex-col items-center justify-center py-20 opacity-20">
                <CalendarIcon size={64} className="mb-4" />
                <p className="font-black uppercase text-xs tracking-widest">Aucun cours prévu</p>
             </div>
           )}
        </div>

        {/* --- PERSONAL PROGRAMS SECTION --- */}
        <div className="space-y-6 pt-6 border-t border-gray-200">
           <div className="flex justify-between items-center">
              <h3 className="text-xs font-black uppercase tracking-widest text-indigo-600">Mon Programme Personnel</h3>
              <button onClick={addPersonalProgram} className="p-2 bg-indigo-600 text-white rounded-xl active:scale-90 transition-all shadow-lg shadow-indigo-100">
                 <Plus size={20} />
              </button>
           </div>

           <div className="space-y-3">
              {reminders.map((r) => (
                 <div key={r.id} className="bg-indigo-50/50 p-5 rounded-[28px] border border-indigo-100 flex items-center gap-4 group animate-in slide-in-from-bottom-2">
                    <div className="w-12 h-12 bg-white rounded-2xl flex flex-col items-center justify-center shadow-sm text-indigo-600">
                       <Clock size={16} />
                       <span className="text-[8px] font-black mt-1">{r.time}</span>
                    </div>
                    <div className="flex-1">
                       <h4 className="text-xs font-black uppercase text-indigo-900">{r.subject}</h4>
                       <p className="text-[10px] font-bold text-indigo-400">{r.title}</p>
                    </div>
                    <button onClick={() => GSIStore.deleteReminder(r.id)} className="p-2 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity">
                       <Trash2 size={16} />
                    </button>
                 </div>
              ))}
              {reminders.length === 0 && (
                 <div className="p-8 border-2 border-dashed border-gray-100 rounded-[32px] text-center">
                    <p className="text-[10px] font-black text-gray-300 uppercase">Aucun programme personnel</p>
                 </div>
              )}
           </div>
        </div>

        {schedule && (
           <p className="text-center text-[8px] font-black text-gray-300 uppercase tracking-[0.2em] mt-12">
              Dernière mise à jour : {new Date(schedule.lastUpdated).toLocaleString()}
           </p>
        )}
      </div>
    </AppLayout>
  );
}
