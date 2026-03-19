export const CAMPUSES = [
  "Antananarivo (Analakely)",
  "Tamatave",
  "Antsirabe",
  "Bypass"
];

export const CAMPUS_FILIERES: Record<string, string[]> = {
  "Antananarivo (Analakely)": [
    "Tourisme, Voyage & Hôtellerie",
    "Communication, Multimedia & Journalisme",
    "Informatique, Electronique & Robotique",
    "Gestion Management des Affaires (Finance & Compta)",
    "Gestion Management des Affaires (Marketing Digital)",
    "Paramédicaux (Sage-femme)",
    "Paramédicaux (Infirmier)"
  ],
  "Tamatave": [
    "Management et Organisation des Affaires",
    "Droit et Relations Internationales",
    "Tourisme, Voyage et Hôtellerie",
    "Technologies Informatiques, Électroniques et Télécommunications",
    "Communication, Multimédia et Journalisme"
  ],
  "Antsirabe": [
    "Informatique & Conception Web",
    "Gestion & Management RH",
    "Droit & Relations Internationales",
    "Tourisme, Voyage & Hôtellerie"
  ],
  "Bypass": [
    "Paramédicaux (Sage-femme)",
    "Paramédicaux (Infirmier)",
    "Aide Soignant"
  ]
};

export const ALL_FILIERES = Array.from(new Set(Object.values(CAMPUS_FILIERES).flat())).sort();
export const NIVEAUX = ["L1", "L2", "L3", "M1", "M2"];
