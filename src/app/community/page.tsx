"use client";

import { AppLayout } from "@/components/app-layout";
import { useLanguage } from "@/lib/i18n";
import { Send, Users, Sparkles, MessageSquare, Clock, X, Paperclip, Image as ImageIcon, File } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { GSIStore, ChatMessage, User } from "@/lib/store";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import ReactMarkdown from 'react-markdown';

export default function CommunityPage() {
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const u = GSIStore.getCurrentUser();
    setUser(u);

    const unsubMessages = GSIStore.subscribeMessages((ms) => {
      setMessages(ms);
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 100);
    });

    const unsubUsers = GSIStore.subscribeUsers((us) => setUsers(us));

    return () => {
      unsubMessages();
      unsubUsers();
    };
  }, []);

  const getUserPhoto = (msg: ChatMessage) => {
    const found = users.find(u => u.id === msg.senderId);
    const photo = found?.photo || msg.senderPhoto;
    return GSIStore.getMediaUrl(photo) || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.senderName}`;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input.trim();
    const reply = replyTo ? { senderName: replyTo.senderName, text: replyTo.text } : undefined;
    setInput("");
    setReplyTo(null);
    await GSIStore.sendMessage(text, reply);
  };

  if (!user) return null;

  return (
    <AppLayout>
      <div className="flex flex-col h-full bg-[#F8FAFC]">
        <div className="p-6 bg-white border-b border-gray-100 flex items-center justify-between">
           <div>
              <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">Communauté</h1>
              <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">{user.filiere} • {user.niveau}</p>
           </div>
           <div className="bg-indigo-50 px-3 py-1 rounded-full flex items-center gap-2">
              <Users size={12} className="text-indigo-600" />
              <span className="text-[10px] font-black text-indigo-600">En ligne</span>
           </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
           {messages.map((m, i) => (
             <div key={i} className={cn(
               "flex gap-3 animate-in fade-in slide-in-from-bottom-2",
               m.senderId === user.id ? "flex-row-reverse" : "flex-row"
             )}>
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-indigo-50 border-2 border-white shadow-sm flex-shrink-0 overflow-hidden flex items-center justify-center">
                   <img
                      src={getUserPhoto(m)}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e: any) => {
                        e.target.onerror = null;
                        e.target.src = `https://api.dicebear.com/7.x/initials/svg?seed=${m.senderName}`;
                      }}
                   />
                </div>

                <div className={cn(
                  "flex flex-col max-w-[75%]",
                  m.senderId === user.id ? "items-end" : "items-start"
                )}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                       {m.senderId !== user.id && (
                          <span className="text-[9px] font-black text-gray-400 uppercase">{m.senderName}</span>
                       )}
                       <span className="text-[7px] text-gray-300 font-bold">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div
                      onContextMenu={(e) => { e.preventDefault(); setReplyTo(m); }}
                      onClick={() => setReplyTo(m)}
                      className={cn(
                        "p-4 rounded-[24px] text-sm font-medium shadow-sm active:scale-[0.98] transition-transform overflow-hidden",
                        m.senderId === user.id
                          ? "bg-indigo-600 text-white rounded-tr-none shadow-indigo-100"
                          : "bg-white text-gray-800 rounded-tl-none border border-gray-100"
                      )}
                    >
                       {m.replyTo && (
                          <div className={cn(
                             "mb-2 p-2 rounded-xl text-[10px] border-l-4",
                             m.senderId === user.id ? "bg-white/10 border-white/30 text-white/80" : "bg-gray-50 border-indigo-500 text-gray-500"
                          )}>
                             <span className="font-black block uppercase tracking-tighter opacity-50">{m.replyTo.senderName}</span>
                             <p className="line-clamp-1">{m.replyTo.text}</p>
                          </div>
                       )}
                       {m.text.startsWith('📷 Photo:') ? (
                          <div className="space-y-2">
                             <img src={GSIStore.getMediaUrl(m.text.split(': ')[1])} alt="Chat attachment" className="rounded-xl max-w-full h-auto" />
                             <p className="text-[10px] opacity-70">Cliquer pour agrandir</p>
                          </div>
                       ) : m.text.startsWith('📄 Document:') ? (
                          <a href={GSIStore.getMediaUrl(m.text.split(': ')[1])} target="_blank" className="flex items-center gap-2 underline decoration-white/30">
                             <File size={16} /> Document joint
                          </a>
                       ) : (
                          <div className="prose prose-sm prose-invert max-w-none prose-p:my-0 prose-headings:text-sm prose-headings:my-1">
                             <ReactMarkdown>
                                {m.text}
                             </ReactMarkdown>
                          </div>
                       )}
                    </div>
                </div>
             </div>
           ))}
           {messages.length === 0 && (
             <div className="flex flex-col items-center justify-center h-full opacity-20">
                <MessageSquare size={48} className="mb-4" />
                <p className="text-xs font-black uppercase">Aucun message</p>
             </div>
           )}
        </div>

        <div className="p-4 bg-white border-t border-gray-100">
           {replyTo && (
             <div className="mb-2 p-3 bg-gray-50 rounded-2xl flex items-center justify-between border border-gray-100 animate-in slide-in-from-bottom-1">
                <div className="flex flex-col">
                   <span className="text-[8px] font-black text-indigo-600 uppercase">En réponse à {replyTo.senderName}</span>
                   <p className="text-[10px] text-gray-400 truncate max-w-[200px]">{replyTo.text}</p>
                </div>
                <button onClick={() => setReplyTo(null)} className="p-1 text-gray-400"><X size={14} /></button>
             </div>
           )}
           <form onSubmit={handleSend} className="flex gap-2 items-end">
              <div className="flex flex-col gap-2">
                 <button
                   type="button"
                   onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*,application/pdf';
                      input.onchange = async (e: any) => {
                         const file = e.target.files?.[0];
                         if (file) {
                            const url = await GSIStore.uploadFile(file, `chat/${user.id}_${Date.now()}`);
                            const fileType = file.type.startsWith('image/') ? '📷 Photo' : '📄 Document';
                            await GSIStore.sendMessage(`${fileType}: ${url}`);
                         }
                      };
                      input.click();
                   }}
                   className="p-3 bg-gray-50 text-gray-400 rounded-2xl active:scale-95 transition-all"
                 >
                    <Paperclip size={20} />
                 </button>
              </div>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Discutez avec votre promo..."
                className="flex-1 bg-gray-50 rounded-2xl px-5 py-4 text-sm font-medium outline-none focus:ring-2 ring-indigo-500/10 transition-all"
              />
              <button type="submit" disabled={!input.trim()} className="bg-indigo-600 text-white p-4 rounded-2xl shadow-lg shadow-indigo-100 active:scale-95 transition-all disabled:opacity-50">
                 <Send size={20} />
              </button>
           </form>
        </div>
      </div>
    </AppLayout>
  );
}
