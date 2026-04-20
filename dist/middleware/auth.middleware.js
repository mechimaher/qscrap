"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizeOperations = exports.requireRole = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const security_1 = require("../config/security");
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    let token;
    if (authHeader) {
        token = authHeader.split(' ')[1];
    }
    else if (req.query.token) {
        token = req.query.token;
    }
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }
    try {
        const payload = jsonwebtoken_1.default.verify(token, (0, security_1.getJwtSecret)());
        req.user = payload;
        next();
    }
    catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
};
exports.authenticate = authenticate;
const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user || req.user.userType !== role) {
            return res.status(403).json({ error: 'Access denied' });
        }
        next();
    };
};
exports.requireRole = requireRole;
const authorizeOperations = (req, res, next) => {
    if (!req.user || (req.user.userType !== 'operations' && req.user.userType !== 'admin' && req.user.userType !== 'staff')) {
        return res.status(403).json({ error: 'Operations access required' });
    }
    next();
};
exports.authorizeOperations = authorizeOperations;
