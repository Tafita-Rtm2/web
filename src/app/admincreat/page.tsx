"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, ShieldCheck, Mail, Lock, User as UserIcon, GraduationCap, MapPin, Briefcase } from "lucide-react";
import { GSIStore } from "@/lib/store";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { CAMPUSES, ALL_FILIERES, NIVEAUX } from "@/lib/constants";

export default function AdminCreatPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);

    const user = {
      id: Math.random().toString(36).substr(2, 9),
      fullName: formData.get("fullName") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      role: formData.get("role") as 'student' | 'professor' | 'admin',
      campus: formData.get("campus") as string,
      filiere: formData.get("filiere") as string,
      niveau: formData.get("niveau") as string,
      matricule: formData.get("matricule") as string,
      contact: formData.get("contact") as string,
    };

    try {
      const success = await GSIStore.addUser(user as any);
      if (success) {
        toast.success("Utilisateur créé avec succès");
        router.push("/admin/");
      } else {
        toast.error("Échec de la création");
      }
    } catch (err: any) {
      toast.error("Erreur: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-gray-50 p-6 pb-20">
      <PageHeader title="Créer un compte" onBack={() => router.push("/admin/")} />

      <form onSubmit={handleCreate} className="space-y-4 bg-white p-6 rounded-[32px] shadow-sm border border-gray-100">
        <div className="flex flex-col items-center mb-6">
           <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg mb-2">
              <UserPlus size={32} />
           </div>
           <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Enregistrement GSI Cloud</p>
        </div>

        <div className="space-y-4">
           <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input name="fullName" required className="w-full bg-gray-50 rounded-2xl py-4 pl-12 pr-4 outline-none text-sm font-bold" placeholder="Nom Complet" />
           </div>

           <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input name="email" type="email" required className="w-full bg-gray-50 rounded-2xl py-4 pl-12 pr-4 outline-none text-sm font-bold" placeholder="Email" />
           </div>

           <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input name="password" type="password" required className="w-full bg-gray-50 rounded-2xl py-4 pl-12 pr-4 outline-none text-sm font-bold" placeholder="Mot de passe" />
           </div>

           <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                 <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                 <select name="role" required className="w-full bg-gray-50 rounded-2xl py-4 pl-12 pr-4 outline-none text-xs font-bold appearance-none">
                    <option value="student">Étudiant</option>
                    <option value="professor">Professeur</option>
                    <option value="admin">Admin</option>
                 </select>
              </div>
              <div className="relative">
                 <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                 <select name="niveau" required className="w-full bg-gray-50 rounded-2xl py-4 pl-12 pr-4 outline-none text-xs font-bold appearance-none">
                    {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
                    <option value="N/A">N/A (Admin)</option>
                 </select>
              </div>
           </div>

           <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <select name="campus" required className="w-full bg-gray-50 rounded-2xl py-4 pl-12 pr-4 outline-none text-xs font-bold appearance-none">
                 {CAMPUSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
           </div>

           <div className="relative">
              <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <select name="filiere" required className="w-full bg-gray-50 rounded-2xl py-4 pl-12 pr-4 outline-none text-xs font-bold appearance-none">
                 {ALL_FILIERES.map(f => <option key={f} value={f}>{f}</option>)}
                 <option value="Administration">Administration</option>
              </select>
           </div>

           <input name="matricule" className="w-full bg-gray-50 rounded-2xl py-4 px-4 outline-none text-sm font-bold" placeholder="Matricule (Optionnel)" />
           <input name="contact" className="w-full bg-gray-50 rounded-2xl py-4 px-4 outline-none text-sm font-bold" placeholder="Téléphone (Optionnel)" />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-indigo-100 active:scale-95 transition-all disabled:opacity-50"
        >
          {loading ? "Création..." : "Enregistrer l'utilisateur"}
        </button>
      </form>
    </div>
  );
}
