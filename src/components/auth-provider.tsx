"use client";

import { useState, useEffect, createContext, useContext } from "react";
import { useRouter, usePathname } from "next/navigation";
import { GSIStore, User } from "@/lib/store";
import { Sparkles } from "lucide-react";

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Hydrate state from store on mount (client-side only)
    const initialUser = GSIStore.getCurrentUser();
    setUser(initialUser);
    setLoading(false);

    // Store Listener (Handles all session updates)
    const unsubscribeStore = GSIStore.subscribe((newUser) => {
      setUser(newUser);
      setLoading(false);
    });

    // Final safety to avoid stuck loading
    const timer = setTimeout(() => setLoading(false), 1500);

    return () => {
      unsubscribeStore();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    // Utilisation de slashes de fin pour éviter les redirections inutiles avec basePath et trailingSlash: true
    const publicPaths = ["/login/", "/admincreat/"];
    // On normalise le pathname pour la comparaison (Next.js peut ajouter le slash automatiquement)
    const safePath = pathname || "/";
    const normalizedPath = safePath.endsWith('/') ? safePath : `${safePath}/`;
    const isPublicPath = publicPaths.includes(normalizedPath);

    if (user && isPublicPath) {
      if (user.role === 'admin') router.replace("/admin/");
      else if (user.role === 'professor') router.replace("/professor/");
      else router.replace("/");
    } else if (!user && !isPublicPath) {
      router.replace("/login/");
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[100]">
        <div className="w-16 h-16 bg-primary rounded-[30%] flex items-center justify-center text-white mb-4 animate-pulse rotate-12">
          <Sparkles size={32} />
        </div>
        <h1 className="text-xl font-black text-primary">GSI</h1>
        <p className="text-xs text-gray-400 mt-2 animate-bounce">Initialisation du Pack GSI...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
