"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "fr" | "en";

interface Translations {
  [key: string]: {
    fr: string;
    en: string;
  };
}

export const translations: Translations = {
  accueil: { fr: "Accueil", en: "Home" },
  planning: { fr: "Planning", en: "Schedule" },
  matieres: { fr: "Matières", en: "Subjects" },
  biblio: { fr: "Biblio", en: "Library" },
  community: { fr: "Communauté", en: "Community" },
  profil: { fr: "Profil", en: "Profile" },
  mon_profil: { fr: "Mon Profil", en: "My Profile" },
  reussites: { fr: "Réussites", en: "Achievements" },
  demandes: { fr: "Demandes", en: "Requests" },
  bonjour: { fr: "Bonjour", en: "Hello" },
  tasks_today: { fr: "tâches aujourd'hui", en: "tasks today" },
  votre_progression: { fr: "Votre progression", en: "Your progress" },
  cours_en_cours: { fr: "Cours en cours", en: "Current courses" },
  votre_emploi_du_temps: { fr: "Votre emploi du temps", en: "Your schedule" },
  ask_insight: { fr: "Agent Assistant", en: "Agent Assistant" },
  se_connecter: { fr: "Se connecter", en: "Login" },
  email: { fr: "Adresse Email", en: "Email Address" },
  password: { fr: "Mot de passe", en: "Password" },
  no_account: { fr: "Vous n'avez pas de compte ?", en: "Don't have an account?" },
  request_access: { fr: "Demander l'accès", en: "Request access" },
  services: { fr: "Services", en: "Services" },
  documents: { fr: "Documents", en: "Documents" },
  attestation: { fr: "Attestation", en: "Certificate" },
  releve_notes: { fr: "Relevé de notes", en: "Transcript" },
  certificat: { fr: "Certificat", en: "Certificate" },
  scolarite: { fr: "Scolarité", en: "Tuition" },
  examen: { fr: "Examen", en: "Exam" },
  divers: { fr: "Divers", en: "Other" },
  valide: { fr: "Validé", en: "Approved" },
  en_cours: { fr: "En cours", en: "In progress" },
  stages: { fr: "Stages", en: "Internships" },
  opportunites: { fr: "Opportunités", en: "Opportunities" },
  competences: { fr: "Compétences", en: "Skills" },
  semaine: { fr: "Semaine", en: "Week" },
  mois: { fr: "Mois", en: "Month" },
  en_cours_badge: { fr: "EN COURS", en: "ONGOING" },
  rechercher: { fr: "Rechercher", en: "Search" },
  tous: { fr: "Tous", en: "All" },
  favoris: { fr: "Favoris", en: "Favorites" },
  recents: { fr: "Récents", en: "Recent" },
  nom_complet: { fr: "Nom complet", en: "Full Name" },
  creer_compte: { fr: "Créer un compte", en: "Create an account" },
  deja_compte: { fr: "Déjà un compte ?", en: "Already have an account?" },
  filiere: { fr: "Filière", en: "Major" },
  niveau: { fr: "Niveau", en: "Level" },
  campus: { fr: "Campus", en: "Campus" },
  creer_mon_compte: { fr: "Créer mon compte", en: "Create my account" },
  admin_portal: { fr: "Portail Administrateur", en: "Administrator Portal" },
  prof_portal: { fr: "Portail Professeur", en: "Professor Portal" },
  enter_code: { fr: "Entrez le code d'accès", en: "Enter access code" },
  valider: { fr: "Valider", en: "Validate" },
  dashboard: { fr: "Tableau de Bord", en: "Dashboard" },
  gestion_utilisateurs: { fr: "Gestion des Utilisateurs", en: "User Management" },
  communication: { fr: "Communication", en: "Communication" },
  gestion_academique: { fr: "Gestion Académique", en: "Academic Management" },
  stats_rapports: { fr: "Stats & Rapports", en: "Stats & Reports" },
  publier_lecon: { fr: "Publier une leçon", en: "Publish a lesson" },
  publier_devoir: { fr: "Publier un devoir", en: "Publish an assignment" },
  gestion_notes: { fr: "Gestion des notes", en: "Grade Management" },
  suivi_etudiants: { fr: "Suivi des étudiants", en: "Student Tracking" },
  modifier_edt: { fr: "Modifier l'Emploi du Temps", en: "Modify Schedule" },
  titre: { fr: "Titre", en: "Title" },
  description: { fr: "Description", en: "Description" },
  fichiers: { fr: "Fichiers", en: "Files" },
  matiere: { fr: "Matière", en: "Subject" },
  date_limite: { fr: "Date limite", en: "Deadline" },
  soumettre: { fr: "Soumettre", en: "Submit" },
  success_today: { fr: "la réussite aujourd'hui", en: "success today" },
  gsi_insight_tagline: { fr: "Comprendre aujourd'hui, réussir demain.", en: "Understanding today, succeeding tomorrow." },
  gsi_mission: { fr: "L'application intelligente de GSI Internationale conçue pour accompagner chaque étudiant.", en: "The intelligent application of GSI Internationale designed to accompany every student." },
  convoquer: { fr: "Convoquer", en: "Summon" },
  convocation: { fr: "Convocation", en: "Summons" },
  import_excel: { fr: "Import Excel", en: "Excel Import" },
  moyenne_classe: { fr: "Moyenne de classe", en: "Class average" },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("fr");

  useEffect(() => {
    const saved = localStorage.getItem("app_lang") as Language;
    if (saved && (saved === "fr" || saved === "en")) {
      setLanguage(saved);
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("app_lang", lang);
  };

  const t = (key: string) => {
    return translations[key]?.[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
