// ====================================================================
// MATRICE DE PERMISSIONS PAR COLLECTION
// Remplace l'ancienne route générique /api/db/:collection qui était
// accessible à N'IMPORTE QUI sans authentification.
//
// Pour chaque collection :
//   read / write / delete : liste des rôles autorisés ('student','professor','admin')
//   ownerField : si présent, un 'student' peut aussi lire/écrire SES PROPRES
//                documents (data[ownerField] === req.user.sub), même s'il
//                n'est pas dans la liste read/write.
//   stripFields : champs toujours retirés de la réponse, quel que soit le rôle
//                 (ex: password ne doit JAMAIS ressortir par cette route).
// ====================================================================

const POLICY = {
    users: {
        read: ['admin', 'professor'],
        write: ['admin'],
        delete: ['admin'],
        ownerField: 'id',      // un élève peut lire/modifier SA propre fiche
        ownerClaim: 'sub',
        ownerWriteFields: ['fullName', 'photo', 'contact'], // champs qu'un élève peut modifier lui-même
        stripFields: ['password']
    },
    lessons: {
        read: ['student', 'professor', 'admin'],
        write: ['professor', 'admin'],
        delete: ['professor', 'admin']
    },
    assignments: {
        read: ['student', 'professor', 'admin'],
        write: ['professor', 'admin'],
        delete: ['professor', 'admin']
    },
    submissions: {
        read: ['professor', 'admin'],
        write: ['professor', 'admin'],
        delete: ['professor', 'admin'],
        ownerField: 'studentId',
        ownerClaim: 'sub',
        ownerWriteFields: ['file', 'date'] // un élève peut créer/modifier SA propre soumission
    },
    grades: {
        read: ['professor', 'admin'],
        write: ['professor', 'admin'],
        delete: ['admin'],
        ownerField: 'studentId',
        ownerClaim: 'sub'
    },
    announcements: {
        read: ['student', 'professor', 'admin'],
        write: ['professor', 'admin'],
        delete: ['professor', 'admin']
    },
    schedules: {
        read: ['student', 'professor', 'admin'],
        write: ['admin'],
        delete: ['admin']
    },
    messages: {
        read: ['student', 'professor', 'admin'],
        write: ['student', 'professor', 'admin'],
        delete: ['admin'],
        ownerField: 'senderId',
        ownerClaim: 'sub'
    },
    paiements: {
        read: ['admin'],
        write: ['admin'],
        delete: ['admin'],
        ownerField: 'matricule',  // un élève peut consulter SES propres paiements
        ownerClaim: 'matricule'
    },
    ecolage: {
        read: ['admin'],
        write: ['admin'],
        delete: ['admin'],
        ownerField: 'matricule', // un élève peut consulter SON propre statut de scolarité
        ownerClaim: 'matricule'
    },
    system_config: {
        read: ['admin'],
        write: ['admin'],
        delete: ['admin']
    }
};

// Toute collection non listée ici est refusée par défaut (whitelist stricte).
function getPolicy(collectionName) {
    return POLICY[collectionName] || null;
}

function stripFields(doc, fields) {
    if (!fields || !doc) return doc;
    const clone = { ...doc };
    fields.forEach(f => delete clone[f]);
    return clone;
}

module.exports = { POLICY, getPolicy, stripFields };
