"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Sparkles, ChevronLeft, X, Copy, Check, Image as ImageIcon, Loader2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { GSIStore, User } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import { toast } from "sonner";
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  image?: string | null;
}

export default function ChatPage() {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const currentUser = GSIStore.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = GSIStore.subscribeAiMessages((msgs) => {
      if (!msgs || msgs.length === 0) {
        const name = (user.fullName || "Étudiant").split(' ')[0];
        const welcome: ChatMessage = {
          role: "assistant",
          content: `Bonjour ${name} ! Je suis votre Agent Assistant GSI pour le campus de ${user.campus || "GSI"} (${user.filiere || "Études"}). Je suis là pour vous accompagner personnellement dans votre réussite académique et répondre à toutes vos questions comme un véritable conseiller dévoué. Comment puis-je vous assister aujourd'hui ?`
        };
        // Set welcome message locally first, don't persist automatically to avoid loops
        setMessages([welcome]);
      } else {
        setMessages(msgs);
      }
    });
    return unsub;
  }, [user]);

  const handleSend = async () => {
    if ((!input.trim() && !attachedImage) || isTyping) return;

    const userMessage = input;
    const currentImage = attachedImage;

    const newMessages = [...messages, {
      role: "user" as const,
      content: userMessage,
      image: currentImage
    }];

    GSIStore.setAiMessages(newMessages);
    setInput("");
    setAttachedImage(null);
    setIsTyping(true);

    try {
      // Build context-aware system prompt
      const campus = user?.campus || "Antananarivo";
      const subject = user?.filiere || "Général";

      // Fetch relevant academic context
      const lessons = (await GSIStore.getLessons()).filter(l => l.niveau === user?.niveau).slice(0, 3);
      const assignments = (await GSIStore.getAssignments()).filter(a => a.niveau === user?.niveau).slice(0, 3);
      const grades = (await GSIStore.getGrades()).filter(g => g.studentId === user?.id);

      const contextText = `
        TON IDENTITÉ ET RÔLE:
        Tu es l'Agent Assistant Officiel du Groupe GSI.
        Tu n'es pas une simple IA, tu es un conseiller humain et chaleureux.

        CONTEXTE DE L'ÉTUDIANT À QUI TU PARLES:
        Nom: ${user?.fullName || "Anonyme"}
        Campus: ${campus}
        Filière: ${subject}
        Niveau: ${user?.niveau || "N/A"}
        Moyenne actuelle: ${Array.isArray(grades) && grades.length > 0 ? (grades.reduce((a,b)=>a+(b.score||0),0)/grades.length).toFixed(2)+"/20" : "N/A"}
        Cours récents: ${Array.isArray(lessons) ? lessons.map(l => l?.title).filter(Boolean).join(', ') : "Aucun"}
        Devoirs à faire: ${Array.isArray(assignments) ? assignments.map(a => (a?.title || "Devoir") + " (DL: " + (a?.deadline || "N/A") + ")").join(', ') : "Aucun"}
      `;

      // L'appel au modèle IA passe désormais par le backend : la clé API
      // n'est jamais présente dans le navigateur (voir /api/ai/chat côté serveur).
      const responseText = await GSIStore.callAI({
        campus,
        subject,
        contextText,
        history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        userMessage,
        imageDataUrl: currentImage
      });

      GSIStore.setAiMessages([...newMessages, { role: "assistant", content: responseText || "Je n'ai pas pu générer de réponse." }]);

    } catch (err: any) {
      toast.error(err.message);
      GSIStore.setAiMessages([...newMessages, { role: "assistant", content: "Désolée, j'ai une difficulté technique. Vérifiez votre connexion ou réessayez plus tard." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-white shadow-xl overflow-hidden relative">
      {/* Header */}
      <PageHeader
        title="Agent Assistant"
        subtitle="GSI Agent Assistant"
        className="p-6 bg-primary text-white mb-0"
        rightElement={
          <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md">
            <Sparkles size={20} />
          </div>
        }
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
        {messages.map((m, i) => (
          <div key={i} className={cn(
            "flex flex-col animate-in fade-in slide-in-from-bottom-2",
            m.role === "user" ? "items-end" : "items-start"
          )}>
            {m.image && (
              <div className="mb-2 max-w-[70%] rounded-2xl overflow-hidden shadow-md border-4 border-white">
                <img src={m.image} alt="User upload" className="w-full h-auto" />
              </div>
            )}
            <div className={cn(
              "max-w-[90%] p-4 rounded-[24px] text-sm font-medium shadow-sm relative group",
              m.role === "user"
                ? "bg-primary text-white rounded-tr-none shadow-primary/20"
                : "bg-white text-gray-800 rounded-tl-none border border-gray-100"
            )}>
              {m.role === 'assistant' ? (
                 <div className="prose prose-sm prose-indigo max-w-none">
                    <ReactMarkdown
                       components={{
                          code({ node, className, children, ...props }) {
                             const match = /language-(\w+)/.exec(className || '');
                             const codeContent = String(children).replace(/\n$/, '');
                             return (
                                <div className="relative my-4 group/code">
                                   <div className="bg-gray-900 text-gray-100 p-4 rounded-xl font-mono text-xs overflow-x-auto">
                                      {children}
                                   </div>
                                   <button
                                      onClick={() => {
                                         navigator.clipboard.writeText(codeContent);
                                         toast.success("Code copié !");
                                      }}
                                      className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white opacity-0 group-hover/code:opacity-100 transition-opacity"
                                   >
                                      <Copy size={14} />
                                   </button>
                                </div>
                             )
                          },
                          table({ children }) {
                             return <div className="overflow-x-auto my-4"><table className="w-full border-collapse border border-gray-200 text-xs">{children}</table></div>
                          },
                          th({ children }) {
                             return <th className="border border-gray-200 p-2 bg-gray-50 font-black uppercase">{children}</th>
                          },
                          td({ children }) {
                             return <td className="border border-gray-200 p-2">{children}</td>
                          }
                       }}
                    >
                       {m.content}
                    </ReactMarkdown>
                 </div>
              ) : m.content}
            </div>
            <span className="text-[8px] text-gray-300 mt-1 px-2 uppercase font-black">
              {m.role === 'user' ? 'Étudiant' : 'Agent Assistant GSI'}
            </span>
          </div>
        ))}
        {isTyping && (
          <div className="flex flex-col items-start animate-pulse">
            <div className="bg-white text-gray-400 p-4 rounded-[24px] rounded-tl-none border border-gray-100 text-xs font-bold italic">
               L'agent assistant réfléchit...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-gray-100 space-y-3">
        {attachedImage && (
           <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-2xl animate-in zoom-in">
              <div className="w-12 h-12 rounded-xl overflow-hidden border border-gray-200">
                 <img src={attachedImage} className="w-full h-full object-cover" />
              </div>
              <p className="text-[10px] font-bold text-gray-400 flex-1">Image prête pour analyse</p>
              <button onClick={() => setAttachedImage(null)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-full">
                 <X size={16} />
              </button>
           </div>
        )}

        <div className="flex gap-2 items-center">
        <input
           type="file"
           ref={fileInputRef}
           onChange={handleImageUpload}
           accept="image/*"
           className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-4 bg-gray-100 text-gray-500 rounded-2xl hover:bg-gray-200 transition-all active:scale-90"
        >
          <ImageIcon size={20} />
        </button>

        <div className="flex-1 relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Posez votre question..."
            className="w-full bg-gray-100 rounded-2xl px-5 py-4 outline-none text-sm font-medium focus:ring-2 ring-primary/20 transition-all"
          />
          {input && (
             <button onClick={() => setInput("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
               <X size={16} />
             </button>
          )}
        </div>
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="bg-primary text-white p-4 rounded-2xl shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
        >
          <Send size={20} />
        </button>
        </div>
      </div>
    </div>
  );
}
