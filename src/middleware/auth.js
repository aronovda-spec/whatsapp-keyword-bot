/**
 * Authentication Middleware
 * Protects admin endpoints from unauthorized access
 */

module.exports = function requireAuth(req, res, next) {
    // Get API key from query string or header
    const providedApiKey = req.query.token || req.headers['x-api-key'] || req.headers['authorization'];
    const expectedApiKey = process.env.ADMIN_API_KEY;

    // If no API key is configured, allow access (backward compatibility)
    if (!expectedApiKey) {
        console.warn('⚠️  ADMIN_API_KEY not set. Admin endpoints are unprotected!');
        return next();
    }

    // Check if API key matches
    if (providedApiKey === expectedApiKey) {
        // ✅ Authorized
        next();
    } else {
        // ❌ Unauthorized
        console.warn(`🚫 Unauthorized access attempt to ${req.path} from ${req.ip}`);
        res.status(401).json({ 
            error: 'Unauthorized',
            message: 'API key required. Set ADMIN_API_KEY in environment variables.'
        });
    }
};

