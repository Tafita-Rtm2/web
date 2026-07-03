# GSI Formation — App `/apk` — Version FUSIONNÉE et sécurisée (v5)

## Nouveau : un seul serveur, une seule appli cPanel
Avant, il fallait déployer DEUX applis Node.js séparées (le site `/apk` + le backend `/secure-api`).
Ça causait des soucis de ressources/CORS/synchronisation sur l'hébergement mutualisé.

**Maintenant, tout est fusionné dans un seul `server.js`** :
- Sert le site statique exporté (`out/`) sur `https://groupegsi.mg/apk/`
- Sert l'API sécurisée (JWT, RBAC, MySQL direct) sur `https://groupegsi.mg/apk/api/`
- Une seule appli Node.js à créer dans cPanel, un seul `npm install`, un seul `.env`, un seul redémarrage.
- Comme le site et l'API sont sur la **même origine**, plus aucun souci de CORS.

## Ce que contient ce projet
- `src/` — le frontend Next.js (export statique), avec tous les correctifs de sécurité déjà appliqués
  (JWT, plus de mot de passe stocké côté client, `/admincreat` verrouillée, chat IA via proxy serveur)
- `server.js` — le serveur unique (site + API)
- `database.js`, `auth.js`, `policy.js` — la logique backend (MySQL direct, JWT/bcrypt, permissions par rôle)
- `.env.example` — toutes les variables nécessaires (aucun secret réel dedans)
- `.gitignore` — empêche `.env`, `node_modules`, `out/` d'être commités

## Déploiement (une seule appli Node.js dans cPanel)

1. **Setup Node.js App** → Create Application
   - Application root : là où tu mets ces fichiers (ex. `domains/groupegsi.mg/apk`)
   - Application URL : `groupegsi.mg` avec sous-chemin `apk` (ou adapte selon ton besoin)
   - Application startup file : `server.js`

2. Upload tous les fichiers de ce projet à la racine du dossier (`domains/groupegsi.mg/apk`).
   **Important : le dossier `out/` doit aussi être présent** — génère-le avec `npm run build` en local
   (ou sur ta machine) puis upload-le, car cPanel ne fait pas `npm run build` tout seul.

3. Crée le fichier `.env` réel (copie `.env.example`, remplis les vraies valeurs : `DB_PASSWORD`,
   `JWT_SECRET`, `SETUP_TOKEN`).

4. **Run NPM Install** dans l'interface cPanel (installe express, bcrypt, jsonwebtoken, mysql2, etc.)

5. **Restart**.

6. Teste :
   - `https://groupegsi.mg/apk/` → le site doit s'afficher
   - `https://groupegsi.mg/apk/api/health` → doit répondre `{"status":"ok",...}`

7. Crée ton admin (sans terminal, via `curl` ou Termux) :
   ```bash
   curl -X POST https://groupegsi.mg/apk/api/setup/run \
     -H "Content-Type: application/json" \
     -d '{"token":"TON_SETUP_TOKEN","action":"create-admin","fullName":"Ton Nom","email":"admin@groupegsi.mg","password":"MotDePasseTresSolide123!"}'

   curl -X POST https://groupegsi.mg/apk/api/setup/run \
     -H "Content-Type: application/json" \
     -d '{"token":"TON_SETUP_TOKEN","action":"migrate-passwords"}'
   ```

8. **Supprime `SETUP_TOKEN` du `.env`** et redémarre — la route se désactive automatiquement (404) sans lui.

9. Une fois tout testé : coupe l'ancienne appli `secure-api` (si tu l'avais créée séparément) ET
   `https://groupegsi.mg/rtmggmg/api` dans cPanel — plus rien ne les utilise.

## Sécurité (rappel)
- Mots de passe : bcrypt, jamais renvoyés en clair (même au login)
- JWT obligatoire sur toutes les routes de données/fichiers
- RBAC par collection (`policy.js`) : un élève ne voit que ses propres données
- `/admincreat` verrouillée (session admin obligatoire, revérifiée côté serveur)
- Clé OpenAI jamais envoyée au navigateur (proxy `/apk/api/ai/chat`)
- PDF/fichiers : `/apk/api/files/view|download/:id` exige un JWT valide
