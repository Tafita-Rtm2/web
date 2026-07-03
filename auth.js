const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
    console.error('❌ JWT_SECRET manquant ou trop court (min 32 caractères) dans .env');
    console.error('   Génère-en un avec: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
    process.exit(1);
}

const BCRYPT_ROUNDS = 12;

// ==================== MOTS DE PASSE ====================
async function hashPassword(plain) {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function verifyPassword(plain, hash) {
    if (!hash || typeof hash !== 'string') return false;
    // Les anciens comptes ont encore un mot de passe en clair (avant migration).
    // On ne compare JAMAIS en clair ici : cette fonction attend un hash bcrypt.
    try {
        return await bcrypt.compare(plain, hash);
    } catch (e) {
        return false;
    }
}

function looksLikeBcryptHash(str) {
    return typeof str === 'string' && /^\$2[aby]\$\d{2}\$/.test(str);
}

// ==================== JWT ====================
function signToken(user) {
    return jwt.sign(
        {
            sub: user._id || user.id,
            role: user.role,
            email: user.email,
            campus: user.campus,
            filiere: user.filiere,
            niveau: user.niveau,
            matricule: user.matricule || null
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

// Extrait le token depuis le header Authorization, ou en fallback depuis ?token=
// (nécessaire pour les <img>/<a> vers /api/files/view/:id qui ne peuvent pas envoyer de header)
function extractToken(req) {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
        return header.slice(7);
    }
    if (req.query && req.query.token) {
        return req.query.token;
    }
    return null;
}

// Middleware : authentification obligatoire
function authRequired(req, res, next) {
    const token = extractToken(req);
    if (!token) {
        return res.status(401).json({ error: 'Authentification requise' });
    }
    try {
        req.user = verifyToken(token);
        next();
    } catch (e) {
        return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
}

// Middleware : authentification optionnelle (attache req.user si présent, sinon continue)
function authOptional(req, res, next) {
    const token = extractToken(req);
    if (token) {
        try {
            req.user = verifyToken(token);
        } catch (e) {
            // token invalide -> on continue sans req.user
        }
    }
    next();
}

// Middleware factory : restreint à certains rôles
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) return res.status(401).json({ error: 'Authentification requise' });
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Accès refusé pour votre rôle' });
        }
        next();
    };
}

module.exports = {
    hashPassword,
    verifyPassword,
    looksLikeBcryptHash,
    signToken,
    verifyToken,
    authRequired,
    authOptional,
    requireRole
};
