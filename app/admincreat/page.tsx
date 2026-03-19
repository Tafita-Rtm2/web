"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, Camera, ShieldCheck, Lock, User as UserIcon } from "lucide-react";
import { GSIStore, User } from "@/lib/store";
import { toast } from "sonner";
import { CAMPUSES, CAMPUS_FILIERES, NIVEAUX } from "@/lib/constants";

export default function AdminCreatePage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminAuth, setAdminAuth] = useState({ user: "", pass: "" });

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    campus: CAMPUSES[0],
    filiere: CAMPUS_FILIERES[CAMPUSES[0]][0],
    niveau: NIVEAUX[0],
    matricule: "",
    contact: "",
    photo: ""
  });

  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/web/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminAuth)
      });

      if (res.ok) {
        setIsAuthorized(true);
        toast.success("Accès autorisé");
      } else {
        toast.error("Identifiants administrateur incorrects");
      }
    } catch (e) {
      toast.error("Erreur de connexion au serveur");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Création du compte étudiant...");
    try {
      const newUser: User = {
        id: Math.random().toString(36).substr(2, 9),
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        role: 'student',
        campus: formData.campus,
        filiere: formData.filiere,
        niveau: formData.niveau,
        matricule: formData.matricule,
        contact: formData.contact,
        photo: formData.photo
      };

      const res = await fetch('/web/api/admin/create-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin: adminAuth, student: newUser })
      });

      if (res.ok) {
        toast.success("Compte créé avec succès !", { id: toastId });
        setFormData({
          fullName: "", email: "", password: "", confirmPassword: "",
          campus: CAMPUSES[0], filiere: CAMPUS_FILIERES[CAMPUSES[0]][0],
          niveau: NIVEAUX[0], matricule: "", contact: "", photo: ""
        });
        setPhotoPreview(null);
      } else {
        toast.error("Erreur lors de la création du compte.", { id: toastId });
      }
    } catch (error: any) {
      toast.error("Erreur: " + error.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
              <ShieldCheck size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Accès Admin</h1>
            <p className="text-gray-500 text-sm text-center mt-2">Veuillez entrer les identifiants pour créer un compte élève</p>
          </div>

          <form onSubmit={handleAdminAuth} className="space-y-4">
            <div className="relative">
              <UserIcon className="absolute left-4 top-4 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Nom d'utilisateur"
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 pl-12 outline-none focus:ring-2 ring-indigo-500/20"
                value={adminAuth.user}
                onChange={(e) => setAdminAuth({ ...adminAuth, user: e.target.value })}
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-4 text-gray-400" size={20} />
              <input
                type="password"
                placeholder="Mot de passe"
                className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 pl-12 outline-none focus:ring-2 ring-indigo-500/20"
                value={adminAuth.pass}
                onChange={(e) => setAdminAuth({ ...adminAuth, pass: e.target.value })}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {loading ? "Vérification..." : "Se connecter"}
            </button>
          </form>

          <button
            onClick={() => router.push("/login")}
            className="w-full mt-4 text-gray-400 text-sm font-medium hover:text-indigo-600 transition-colors"
          >
            Retour au login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen max-w-xl mx-auto bg-white p-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center">
          <button onClick={() => setIsAuthorized(false)} className="p-2 -ml-2 text-gray-400 hover:text-primary transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold ml-2">Créer un Elève</h1>
        </div>
        <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
          <ShieldCheck size={14} /> Mode Admin
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 pb-10">
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center border-2 border-dashed border-gray-300 overflow-hidden">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <Camera size={32} className="text-gray-400" />
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = async (e: any) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (re) => setPhotoPreview(re.target?.result as string);
                    reader.readAsDataURL(file);

                    const url = await GSIStore.uploadFile(file, `profiles/${file.name}`);
                    setFormData({...formData, photo: url});
                  }
                };
                input.click();
              }}
              className="absolute bottom-0 right-0 bg-primary text-white p-2 rounded-full shadow-lg active:scale-90 transition-transform"
            >
              <Sparkles size={16} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Nom Complet</label>
              <input
                type="text"
                required
                className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 ring-primary/20"
                placeholder="Ex: Jean Dupont"
                value={formData.fullName}
                onChange={(e) => setFormData({...formData, fullName: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
              <input
                type="email"
                required
                className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 ring-primary/20"
                placeholder="nom@student.gsi.com"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Matricule</label>
                <input
                  type="text"
                  required
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 ring-primary/20"
                  placeholder="123456"
                  value={formData.matricule}
                  onChange={(e) => setFormData({...formData, matricule: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Contact</label>
                <input
                  type="tel"
                  required
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 ring-primary/20"
                  placeholder="034 XX XXX XX"
                  value={formData.contact}
                  onChange={(e) => setFormData({...formData, contact: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Mot de passe</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 ring-primary/20"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Confirmation</label>
                <input
                  type="password"
                  required
                  className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 ring-primary/20"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Campus</label>
              <select
                className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 ring-primary/20 appearance-none"
                value={formData.campus}
                onChange={(e) => {
                  const newCampus = e.target.value;
                  setFormData({
                    ...formData,
                    campus: newCampus,
                    filiere: CAMPUS_FILIERES[newCampus][0]
                  });
                }}
              >
                {CAMPUSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Filière</label>
              <select
                className="w-full bg-gray-50 border-none rounded-2xl p-4 outline-none focus:ring-2 ring-primary/20 appearance-none"
                value={formData.filiere}
                onChange={(e) => setFormData({...formData, filiere: e.target.value})}
              >
                {CAMPUS_FILIERES[formData.campus].map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Niveau</label>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {NIVEAUX.map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setFormData({...formData, niveau: n})}
                    className={`px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                      formData.niveau === n
                      ? "bg-primary text-white shadow-lg shadow-primary/30"
                      : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white py-5 rounded-2xl font-bold shadow-lg shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all mt-6 disabled:opacity-50"
        >
          {loading ? "Création..." : "Enregistrer l'Etudiant"}
        </button>
      </form>
    </div>
  );
}
