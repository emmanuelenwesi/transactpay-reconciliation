const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key';

// 1. Verifies the user has a valid login token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extracts token after "Bearer"

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.merchant = user; // Attach decoded user info to request
    req.user = user;     // Alias for tests/routes using req.user
    next();              // Pass control to the next handler
  });
};

// 2. Verifies the user's role (e.g., Admin, Merchant, Auditor)
const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.merchant?.role || req.user?.role || 'Merchant Admin';
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions.' });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRole,
  authorizeRoles: authorizeRole, // Exported alias to prevent import errors across existing routes
  JWT_SECRET
};