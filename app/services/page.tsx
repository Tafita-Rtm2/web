"use client";

import { AppLayout } from "@/components/app-layout";
import { FileText, CheckCircle, AlertCircle, Plus, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GSIStore, User } from "@/lib/store";
import Link from "next/link";

export default function ServicesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const init = async () => {
      const currentUser = GSIStore.getCurrentUser();
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);
    };
    init();
  }, [router]);

  const requests = [
    { id: "REQ-001", type: "Attestation de scolarité", status: "Validé", date: "12 Sept 2024", color: "text-green-500", bg: "bg-green-100" },
    { id: "REQ-002", type: "Relevé de notes (S2)", status: "En cours", date: "15 Sept 2024", color: "text-orange-500", bg: "bg-orange-100" },
  ];

  if (!user) return null;

  return (
    <AppLayout>
      <div className="p-6 pb-24">
        <div className="flex items-center gap-4 mb-8">
           <Link href="/profile" className="p-2 bg-gray-100 rounded-full text-gray-500">
              <ChevronLeft size={20} />
           </Link>
           <h1 className="text-2xl font-black text-gray-800">Services GSI</h1>
        </div>

        <section className="mb-10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-700">Demandes de documents</h2>
            <button
              onClick={() => alert("Nouvelle demande enregistrée. Notre équipe administrative vous contactera bientôt.")}
              className="bg-primary text-white p-2.5 rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-transform"
            >
              <Plus size={20} />
            </button>
          </div>
          <div className="space-y-3">
            {requests.map((req) => (
              <div key={req.id} className="bg-white p-5 rounded-[24px] border border-gray-100 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">{req.type}</h3>
                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{req.id} • {req.date}</p>
                  </div>
                </div>
                <div className={cn("px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider", req.bg, req.color)}>
                  {req.status}
                </div>
              </div>
            ))}
          </div>
        </section>


        <div className="bg-indigo-600 p-8 rounded-[32px] text-white shadow-xl shadow-indigo-100 flex flex-col gap-4 relative overflow-hidden">
          <div className="absolute right-[-20px] top-[-20px] w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-2.5 rounded-xl backdrop-blur-md">
               <AlertCircle size={24} />
            </div>
            <h4 className="font-bold text-lg">Besoin d'assistance ?</h4>
          </div>
          <p className="text-xs text-white/80 leading-relaxed font-medium">
             Notre service administratif est disponible du Lundi au Vendredi de 08h à 17h pour répondre à toutes vos questions.
          </p>
          <button className="bg-white text-indigo-600 py-3 rounded-2xl text-xs font-black shadow-lg shadow-black/5 active:scale-95 transition-transform uppercase tracking-widest mt-2">
             Contacter le support scolarité
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
