"use client";

import { useState, useEffect } from "react";
import { Send, Sparkles, ChevronLeft, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { GSIStore, User } from "@/lib/store";
import { PageHeader } from "@/components/page-header";

export default function ChatPage() {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Bonjour ! Je suis Insight, votre assistant académique GSI. Comment puis-je vous aider aujourd'hui ?" },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const currentUser = GSIStore.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      setMessages([
        { role: "assistant", content: `Bonjour ${currentUser.fullName.split(' ')[0]} ! Je suis Insight, votre assistant académique GSI. Comment puis-je vous aider aujourd'hui ?` },
      ]);
    }
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userQuery = input.toLowerCase();
    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);

    // AI Heuristic Engine (Context-Aware)
    let responseText = "";

    try {
      if (userQuery.includes("bonjour") || userQuery.includes("salut") || userQuery.includes("hello")) {
        responseText = `Bonjour ${user?.fullName.split(' ')[0]} ! Heureuse de vous retrouver. Je suis prête à répondre à vos questions sur vos cours, vos notes ou votre planning.`;
      }
      else if (userQuery.includes("prochain") && (userQuery.includes("cours") || userQuery.includes("planning"))) {
        responseText = "Votre prochain cours est prévu aujourd'hui à 14h00. N'oubliez pas de consulter la section 'Planning' pour le détail de la salle.";
      }
      else if (userQuery.includes("cours") || userQuery.includes("leçon") || userQuery.includes("matière")) {
        const lessons = (await GSIStore.getLessons()).filter(l => l.niveau === user?.niveau);
        if (lessons.length > 0) {
          const latest = lessons[0];
          responseText = `Actuellement, vous avez ${lessons.length} supports de cours disponibles pour le niveau ${user?.niveau}. Le plus récent est "${latest.title}" en ${latest.subject}. Souhaitez-vous que je vous aide à trouver un document spécifique ?`;
        } else {
          responseText = `Je n'ai pas encore trouvé de nouveaux supports de cours pour votre niveau (${user?.niveau}). Je vous préviendrai dès qu'un professeur publiera du contenu !`;
        }
      }
      else if (userQuery.includes("devoir") || userQuery.includes("tâche") || userQuery.includes("exercice") || userQuery.includes("rendre")) {
        const assignments = (await GSIStore.getAssignments()).filter(a => a.niveau === user?.niveau);
        if (assignments.length > 0) {
          responseText = `Vous avez ${assignments.length} devoirs en attente. Le plus important est "${assignments[0].title}" à rendre pour le ${assignments[0].deadline}. Ne tardez pas trop !`;
        } else {
          responseText = "Tout est à jour ! Vous n'avez aucun devoir en attente pour le moment. Profitez-en pour réviser vos leçons dans la Bibliothèque.";
        }
      }
      else if (userQuery.includes("note") || userQuery.includes("moyenne") || userQuery.includes("résultat") || userQuery.includes("examen")) {
        const grades = (await GSIStore.getGrades()).filter(g => g.studentId === user?.id);
        if (grades.length > 0) {
          const avg = (grades.reduce((acc, g) => acc + g.score, 0) / grades.length).toFixed(2);
          const best = Math.max(...grades.map(g => g.score));
          responseText = `D'après vos derniers résultats, votre moyenne générale est de ${avg}/20. Votre meilleure performance est de ${best}/20. Continuez vos efforts !`;
        } else {
          responseText = "Vos notes ne sont pas encore enregistrées dans le système. Dès qu'un professeur aura validé vos copies, elles apparaîtront ici et dans votre Dashboard.";
        }
      }
      else if (userQuery.includes("campus") || userQuery.includes("gsi") || userQuery.includes("où")) {
        responseText = `Vous êtes rattaché au campus GSI ${user?.campus}. Pour rappel, GSI est présente à Antananarivo, Antsirabe, Bypass et Tamatave. Chaque campus offre les mêmes standards d'excellence !`;
      }
      else if (userQuery.includes("aide") || userQuery.includes("besoin") || userQuery.includes("comment")) {
        responseText = "Je peux vous aider à : \n1. Voir vos prochaines échéances (devoirs)\n2. Consulter vos dernières notes\n3. Vérifier vos supports de cours\n4. Vous renseigner sur votre campus\nQue puis-je faire pour vous ?";
      }
      else if (userQuery.includes("merci") || userQuery.includes("génial") || userQuery.includes("super")) {
        responseText = "C'est un plaisir de vous aider ! Je reste à votre disposition si vous avez d'autres questions. Bonne étude !";
      }
      else {
        responseText = "Désolée, je n'ai pas bien compris votre requête. Je suis Insight, votre assistant dédié. Posez-moi une question sur vos études, vos notes ou votre vie au campus GSI !";
      }
    } catch (err) {
      responseText = "Désolée, j'ai rencontré une petite difficulté technique pour accéder à vos données. Pouvez-vous reformuler ?";
    }

    // Simulate thinking time
    setTimeout(() => {
      setMessages([...newMessages, { role: "assistant", content: responseText }]);
      setIsTyping(false);
    }, 800 + Math.random() * 1000);
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-white shadow-xl overflow-hidden relative">
      {/* Header */}
      <PageHeader
        title="Ask Insight"
        subtitle="Assistant IA GSI"
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
            <div className={cn(
              "max-w-[85%] p-4 rounded-[24px] text-sm font-medium shadow-sm whitespace-pre-wrap",
              m.role === "user"
                ? "bg-primary text-white rounded-tr-none shadow-primary/20"
                : "bg-white text-gray-800 rounded-tl-none border border-gray-100"
            )}>
              {m.content}
            </div>
            <span className="text-[8px] text-gray-300 mt-1 px-2 uppercase font-black">
              {m.role === 'user' ? 'Vous' : 'Insight'}
            </span>
          </div>
        ))}
        {isTyping && (
          <div className="flex flex-col items-start animate-pulse">
            <div className="bg-white text-gray-400 p-4 rounded-[24px] rounded-tl-none border border-gray-100 text-xs font-bold italic">
               Insight réfléchit...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-gray-100 flex gap-2 items-center">
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
  );
}
