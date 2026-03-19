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
    const init = async () => {
      await GSIStore.ensureConfig();
      const initialUser = GSIStore.getCurrentUser();
      setUser(initialUser);
      setLoading(false);
    };
    init();

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

    const publicPaths = ["/login", "/admincreat"];
    const isPublicPath = publicPaths.includes(pathname);

    if (user && isPublicPath) {
      if (user.role === 'admin') router.replace("/admin/");
      else if (user.role === 'professor') router.replace("/professor/");
      else router.replace("/");
    } else if (!user && !isPublicPath) {
      // Pour le web, on s'assure de ne pas boucler ou sortir du contexte /web
      // pathname peut être /login ou /login/ avec trailingSlash
      if (pathname !== "/login" && pathname !== "/login/") {
        router.replace("/login/");
      }
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[100]">
        <div className="w-16 h-16 bg-primary rounded-[30%] flex items-center justify-center text-white mb-4 animate-pulse rotate-12">
          <Sparkles size={32} />
        </div>
        <h1 className="text-xl font-black text-primary">GSI Insight</h1>
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
