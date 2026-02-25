const jwt = require('jsonwebtoken');
require('dotenv').config();
const token = jwt.sign({
  user_id: 1,
  user_type: 'finance',
  userType: 'finance',
  userId: 1,
  role: 'finance'
}, process.env.JWT_SECRET || 'qscrap_jwt_secret_2026_production_key', { expiresIn: '1h' });
console.log(token);
