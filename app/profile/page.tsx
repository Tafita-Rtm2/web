"use client";

import { AppLayout } from "@/components/app-layout";
import { Settings, ChevronRight, FileCheck, Award, LogOut, QrCode, X, Camera, ShieldCheck, MapPin, GraduationCap, TrendingUp, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";
import { GSIStore, User } from "@/lib/store";
import { toast } from "sonner";

export default function ProfilePage() {
  const { t, language, setLanguage } = useLanguage();
  const router = useRouter();
  const [showQr, setShowQr] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    const currentUser = GSIStore.getCurrentUser();
    if (!currentUser) {
      router.push("/login");
    } else {
      setUser(currentUser);
    }
  }, [router]);

  const handleLogout = () => {
    GSIStore.logout();
    toast.success("Déconnexion réussie");
    router.push("/login");
  };

  if (!user) return null;

  return (
    <AppLayout>
      <div className="bg-primary pt-12 pb-24 px-6 rounded-b-[40px] relative">
        <div className="flex justify-between items-start mb-8">
          <h1 className="text-2xl font-bold text-white">{t("mon_profil")}</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={cn("p-2 rounded-lg text-white transition-colors", isEditing ? "bg-accent" : "bg-white/20")}
            >
              <Settings size={20} />
            </button>
            <button
              onClick={() => setShowQr(true)}
              className="bg-white/20 p-2 rounded-lg text-white"
            >
              <QrCode size={20} />
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div className="w-24 h-24 rounded-full border-4 border-white overflow-hidden shadow-lg bg-white/20 flex items-center justify-center">
              <img
                src={GSIStore.getAbsoluteUrl(user.photo) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.fullName}`}
                alt="Profile"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.fullName}`;
                }}
              />
            </div>
            {isEditing && (
              <>
                <input
                  id="photo-upload"
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file && user) {
                      const toastId = toast.loading("Mise à jour de la photo...");
                      setUploadProgress(0);
                      try {
                        setIsUploading(true);
                        const previewUrl = URL.createObjectURL(file);
                        setUser({ ...user, photo: previewUrl });

                        const url = await GSIStore.uploadFile(file, `profiles/${user.id}_${Date.now()}`, (p) => {
                          setUploadProgress(Math.round(p));
                        });

                        const updated = { ...user, photo: url };
                        await GSIStore.updateUser(updated);
                        setUser(updated);
                        toast.success("Photo mise à jour avec succès !", { id: toastId });
                      } catch (err: any) {
                        toast.error("Erreur: " + err.message, { id: toastId });
                        const original = GSIStore.getCurrentUser();
                        setUser(original);
                      } finally {
                        setIsUploading(false);
                        setUploadProgress(0);
                      }
                    }
                  }}
                />
                <button
                  onClick={() => document.getElementById('photo-upload')?.click()}
                  disabled={isUploading}
                  className="absolute bottom-0 right-0 bg-accent text-white p-2 rounded-full shadow-lg active:scale-95 transition-transform disabled:opacity-50"
                >
                  <Camera size={14} />
                </button>
              </>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                defaultValue={user.fullName}
                onBlur={async (e) => {
                  const updated = {...user, fullName: e.target.value};
                  await GSIStore.updateUser(updated);
                  setUser(updated);
                }}
                className="bg-white/20 border-none rounded-xl px-4 py-1 text-center font-bold text-white outline-none focus:ring-1 ring-white/50"
              />
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-white">{user.fullName}</h2>
              <p className="text-white/70 text-sm font-medium">{user.filiere} • {user.niveau} • {user.campus}</p>
            </>
          )}
        </div>
      </div>

      <div className="px-6 -mt-16 pb-32">
        <div className="bg-white rounded-[32px] p-6 shadow-xl mb-6 grid grid-cols-2 gap-4">
          <Link href="/performance" className="flex flex-col items-center p-4 bg-gray-50 rounded-2xl hover:bg-indigo-50 transition-colors active:scale-95">
            <Award className="text-primary mb-2" size={24} />
            <span className="text-[10px] font-black uppercase tracking-widest">{t("reussites")}</span>
          </Link>
          <Link href="/services" className="flex flex-col items-center p-4 bg-gray-50 rounded-2xl hover:bg-violet-50 transition-colors active:scale-95">
            <FileCheck className="text-accent mb-2" size={24} />
            <span className="text-[10px] font-black uppercase tracking-widest">{t("demandes")}</span>
          </Link>
        </div>

        <div className="space-y-2 mb-8">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 px-2 mb-4">Espace Personnel</h3>

          <Link href="/performance">
             <ProfileLink icon={TrendingUp} label="Mes Notes & Performance" color="text-indigo-500" />
          </Link>
          <Link href="/program">
             <ProfileLink icon={Clock} label="Mon Programme d'étude" color="text-emerald-500" />
          </Link>
          <Link href="/services">
            <ProfileLink icon={FileCheck} label="Documents Administratifs" color="text-orange-500" />
          </Link>

          <div className="bg-gradient-to-br from-indigo-600 to-violet-800 rounded-[40px] p-7 text-white mb-6 mt-6 shadow-xl relative overflow-hidden group">
              <div className="relative z-10">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-black text-lg uppercase tracking-tight">Espace Étudiant</h4>
                  <Award size={24} />
                </div>
                <p className="text-xs font-medium opacity-90 mb-4">Accédez à vos ressources pédagogiques et discutez avec vos camarades.</p>
                <Link href="/community" className="inline-block bg-white text-indigo-600 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform">
                  Accéder au Chat
                </Link>
              </div>
              <div className="absolute right-[-10px] bottom-[-10px] w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
          </div>

          <div className="p-6 bg-gray-50 rounded-[32px] border border-gray-100 mt-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 ml-2">Préférences Langue</h4>
            <div className="flex gap-3">
              <button
                onClick={() => setLanguage("fr")}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                  language === "fr" ? "bg-primary text-white" : "bg-white text-gray-500"
                )}
              >
                Français
              </button>
              <button
                onClick={() => setLanguage("en")}
                className={cn(
                  "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                  language === "en" ? "bg-primary text-white" : "bg-white text-gray-500"
                )}
              >
                English
              </button>
            </div>
          </div>
          <ProfileLink icon={Settings} label="Paramètres Avancés" color="text-gray-400" />
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-3 py-5 text-red-500 font-black uppercase tracking-widest bg-red-50 rounded-[28px] mb-12 active:scale-95 transition-all border border-red-100 shadow-sm"
        >
          <LogOut size={20} />
          <span>Déconnexion du compte</span>
        </button>
      </div>

      {showQr && (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[48px] w-full max-w-sm overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-300">
            {/* Header of the Card */}
            <div className="bg-primary p-8 text-white relative">
              <button
                onClick={() => setShowQr(false)}
                className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-2xl text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center p-2">
                   <img src="/logo.png" alt="GSI" className="w-full h-full object-contain" onError={(e) => (e.currentTarget.src = "https://groupegsi.mg/favicon.ico")} />
                </div>
                <div>
                   <h3 className="text-lg font-black uppercase tracking-tighter">Carte Étudiant</h3>
                   <p className="text-[10px] font-bold opacity-60 uppercase tracking-[0.2em]">Groupe GSI Internationale</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                 <div className="w-16 h-16 rounded-2xl border-2 border-white/30 overflow-hidden shadow-lg bg-white/10">
                    <img
                      src={GSIStore.getAbsoluteUrl(user.photo) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.fullName}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.fullName}`;
                      }}
                    />
                 </div>
                 <div>
                    <h4 className="font-black text-sm uppercase leading-none mb-1">{user.fullName}</h4>
                    <p className="text-[9px] font-black text-accent uppercase tracking-widest">{user.matricule || "MAT-PENDING"}</p>
                 </div>
              </div>
            </div>

            {/* QR Code Section */}
            <div className="p-10 flex flex-col items-center">
              <div className="relative group">
                <div className="absolute -inset-4 bg-primary/5 rounded-[40px] blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="bg-white p-6 rounded-[40px] shadow-[0_0_50px_rgba(63,81,181,0.1)] border border-gray-100 relative z-10">
                  <QRCodeCanvas
                    value={GSIStore.getStudentQrData(user)}
                    size={200}
                    level="H"
                    includeMargin={false}
                    imageSettings={{
                      src: "https://groupegsi.mg/favicon.ico",
                      x: undefined,
                      y: undefined,
                      height: 40,
                      width: 40,
                      excavate: true,
                    }}
                  />
                </div>
              </div>

              <div className="mt-8 w-full space-y-3">
                 <div className="flex items-center gap-3 text-[10px] font-bold text-gray-500 uppercase px-4 py-2 bg-gray-50 rounded-2xl">
                    <MapPin size={14} className="text-primary" />
                    <span>Campus: {user.campus}</span>
                 </div>
                 <div className="flex items-center gap-3 text-[10px] font-bold text-gray-500 uppercase px-4 py-2 bg-gray-50 rounded-2xl">
                    <GraduationCap size={14} className="text-primary" />
                    <span>{user.filiere} — {user.niveau}</span>
                 </div>
              </div>

              <div className="mt-8 flex items-center gap-2 text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-6 py-2 rounded-full border border-emerald-100">
                 <ShieldCheck size={12} />
                 <span>Identité Vérifiée par GSI Cloud</span>
              </div>

              <p className="mt-6 text-center text-[8px] text-gray-400 font-bold uppercase tracking-widest leading-loose max-w-[200px]">
                Présentez ce code pour la validation de présence ou l'accès aux services.
              </p>
            </div>

            <div className="h-2 bg-primary w-full"></div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function ProfileLink({ icon: Icon, label, color }: { icon: any, label: string, color: string }) {
  return (
    <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors rounded-2xl border border-transparent hover:border-gray-100 active:scale-[0.98]">
      <div className="flex items-center gap-4">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100", color)}>
          <Icon size={20} />
        </div>
        <span className="font-semibold text-gray-700">{label}</span>
      </div>
      <ChevronRight size={20} className="text-gray-400" />
    </button>
  );
}
