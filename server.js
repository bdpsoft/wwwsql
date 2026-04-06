const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet'); 
require('dotenv').config();

const { RedisStore } = require('connect-redis');
const Redis = require('ioredis');

const dbHelper = require('./helpers/db');
const authService = require('./services/authService');

const app = express();
const PORT = process.env.PORT || 3000;

// --- 1. Initialize Redis Client ---
// Assuming Redis connection details are in environment variables
const redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay; // Pokušavaj ponovo na svake 2 sekunde
    }
});

// Test Redis connection on startup
redisClient.ping()
    .then(() => {
        console.log('✅ Redis connection successful');
    })
    .catch(err => {
        console.error('❌ Redis connection failed. Ensure Redis is running and accessible.', err);
    });

// Spreči "Unhandled error event" koji ti ruši aplikaciju
redisClient.on('error', (err) => {
// Pristupamo opcijama direktno preko klijenta
    const host = redisClient.options.host;
    const port = redisClient.options.port;
    
    console.error(`❌ Redis klijent pokušava povezivanje na [${host}:${port}]`);
    console.error(`   Greška: ${err.message}`);
});

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- 2. Session configuration using RedisStore ---
// --- 2. Session configuration using RedisStore ---
app.use(session({
    // Pravilna instanca
    store: new RedisStore({ 
        client: redisClient,
        prefix: "sess:" // Dobra praksa da se lakše snađeš u Redis bazi
    }), 
    secret: process.env.SESSION_SECRET || 'neka-fallback-sifra', // Uvek imaj fallback
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: parseInt(process.env.SESSION_COOKIE_MAX_AGE) || 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax' // Promeni na 'lax' ako imaš problema sa redirect-om na localhostu
    }
}));
// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
});

// Test database connection on startup
dbHelper.testConnection().then(isConnected => {
    if (isConnected) {
        console.log('✅ Database connection successful');
    } else {
        console.log('❌ Database connection failed - check your .env configuration');
    }
});

// Authentication middleware
const requireAuth = (req, res, next) => {
    // Accessing session data remains the same
    if (req.session && req.session.user) {
        next();
    } else {
        res.status(401).json({ 
            error: 'Authentication required',
            code: 'AUTH_REQUIRED'
        });
    }
};

// ==================== ROUTES (No changes needed here) ====================

// 1. Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        service: 'Email Authentication API',
        version: '1.0.0'
    });
});

// 2. Initiate authentication (send code/link)
app.post('/api/auth/initiate', async (req, res) => {
    try {
        const { email, useLink } = req.body;
        
        if (!email || !email.includes('@')) {
            return res.status(400).json({ 
                error: 'Valid email is required',
                code: 'INVALID_EMAIL'
            });
        }

        // Additional email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                error: 'Invalid email format',
                code: 'INVALID_EMAIL_FORMAT'
            });
        }

        const result = await authService.initiateAuth(email, useLink === true);
        
        if (result.success) {
            res.json({
                success: true,
                message: result.message,
                expiresIn: result.expiresIn,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error || result.message,
                code: result.code || 'AUTH_INITIATION_FAILED'
            });
        }
    } catch (error) {
        console.error('Initiate auth error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR'
        });
    }
});

// 3. Verify 6-digit code
app.post('/api/auth/verify/code', async (req, res) => {
    try {
        const { email, code } = req.body;
        
        if (!email || !code) {
            return res.status(400).json({ 
                error: 'Email and code are required',
                code: 'MISSING_FIELDS'
            });
        }

        if (code.length !== 6 || !/^\d+$/.test(code)) {
            return res.status(400).json({ 
                error: 'Code must be 6 digits',
                code: 'INVALID_CODE_FORMAT'
            });
        }

        const result = await authService.verifyCode(email, code);
        
        if (result.success) {
            // Set user session
            req.session.user = { 
                email,
                authenticatedAt: new Date().toISOString()
            };
            req.session.save();
            
            res.json({ 
                success: true, 
                message: 'Authentication successful',
                user: { email },
                sessionId: req.sessionID,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
                code: 'VERIFICATION_FAILED'
            });
        }
    } catch (error) {
        console.error('Verify code error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR'
        });
    }
});

// 4. Verify login link
app.get('/api/auth/verify/link', async (req, res) => {
    try {
        const { email, token } = req.query;
        
        if (!email || !token) {
            return res.status(400).json({ 
                error: 'Email and token are required',
                code: 'MISSING_PARAMETERS'
            });
        }

        const result = await authService.verifyToken(email, token);
        
        if (result.success) {
            // Set user session
            req.session.user = { 
                email,
                authenticatedAt: new Date().toISOString(),
                via: 'magic_link'
            };
            req.session.save();
            
            // Redirect to frontend dashboard
            res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`);
        } else {
            res.status(400).json({
                success: false,
                error: result.error,
                code: 'LINK_VERIFICATION_FAILED'
            });
        }
    } catch (error) {
        console.error('Verify link error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR'
        });
    }
});

// 5. Call stored procedure (protected route)
app.post('/api/procedure/:procedureName', requireAuth, async (req, res) => {
    try {
        const { procedureName } = req.params;
        const { jsonData } = req.body;
        const email = req.session.user.email;

        // Check email domain if configured
        if (!dbHelper.validateEmailDomain(email)) {
            return res.status(403).json({
                success: false,
                error: 'Email domain not allowed',
                code: 'DOMAIN_NOT_ALLOWED'
            });
        }

        const result = await dbHelper.callProcedure(procedureName, email, jsonData || {});
        
        if (result.success) {
            res.json({
                success: true,
                data: result.data,
                metadata: result.metadata || {},
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error,
                details: result.details,
                code: 'PROCEDURE_EXECUTION_FAILED',
                validation: result.validation
            });
        }
    } catch (error) {
        console.error('Procedure call error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR'
        });
    }
});

// 6. Get available procedures
app.get('/api/procedures', requireAuth, (req, res) => {
    try {
        const procedures = dbHelper.getAvailableProcedures();
        res.json({
            success: true,
            procedures: procedures,
            metadata: {
                total: Object.keys(procedures).length,
                devMode: process.env.DEV_MODE === 'true',
                useDefaultData: process.env.USE_DEFAULT_DATA === 'true',
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Failed to get procedures:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR'
        });
    }
});

// 7. Validate JSON against procedure schema
app.post('/api/validate/:procedureName', requireAuth, (req, res) => {
    try {
        const { procedureName } = req.params;
        const { jsonData } = req.body;
        
        const procedureCheck = dbHelper.isProcedureAllowed(procedureName);
        if (!procedureCheck.allowed) {
            return res.status(404).json({
                success: false,
                error: procedureCheck.error,
                code: 'PROCEDURE_NOT_FOUND'
            });
        }
        
        const validation = dbHelper.validateJsonData(procedureName, jsonData);
        
        res.json({
            success: validation.valid,
            validation: validation,
            procedure: {
                name: procedureName,
                description: procedureCheck.procedure.description,
                allowed: procedureCheck.procedure.allowed
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Validation error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR'
        });
    }
});

// 8. Test endpoint with default data
app.get('/api/test/:procedureName', requireAuth, async (req, res) => {
    try {
        const { procedureName } = req.params;
        const email = req.session.user.email;
        
        const procedure = dbHelper.getProcedureInfo(procedureName);
        if (!procedure) {
            return res.status(404).json({ 
                error: 'Procedure not found',
                code: 'PROCEDURE_NOT_FOUND'
            });
        }
        
        // Use example JSON from schema defaults
        const exampleJson = {};
        if (procedure.jsonSchema && procedure.jsonSchema.properties) {
            for (const [prop, schema] of Object.entries(procedure.jsonSchema.properties)) {
                if (schema.default !== undefined) {
                    exampleJson[prop] = schema.default;
                }
            }
        }
        
        const result = await dbHelper.callProcedure(procedureName, email, exampleJson);
        
        res.json({
            success: result.success,
            data: result.data,
            metadata: {
                ...result.metadata,
                testMode: true,
                inputExample: exampleJson,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Test error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            code: 'INTERNAL_SERVER_ERROR'
        });
    }
});

// 9. Get system status
app.get('/api/system/status', (req, res) => {
    res.json({
        status: 'operational',
        database: dbHelper.devMode ? 'development_mode' : 'connected',
        environment: process.env.NODE_ENV || 'development',
        devMode: process.env.DEV_MODE === 'true',
        useDefaultData: process.env.USE_DEFAULT_DATA === 'true',
        validateJson: process.env.VALIDATE_JSON === 'true',
        procedures: Object.keys(dbHelper.procedureConfig?.procedures || {}).length,
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 10. Check session
app.get('/api/auth/session', (req, res) => {
    if (req.session.user) {
        res.json({ 
            authenticated: true, 
            user: req.session.user,
            sessionId: req.sessionID,
            timestamp: new Date().toISOString()
        });
    } else {
        res.json({ 
            authenticated: false,
            timestamp: new Date().toISOString()
        });
    }
});

// 11. Logout
app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).json({ 
                error: 'Failed to logout',
                code: 'LOGOUT_FAILED'
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Logged out successfully',
            timestamp: new Date().toISOString()
        });
    });
});

// 12. Serve frontend pages
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/procedures', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'procedures.html'));
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message,
        code: 'UNHANDLED_ERROR'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        path: req.path,
        method: req.method,
        code: 'ENDPOINT_NOT_FOUND'
    });
});

// Start server
const server = app.listen(PORT, () => {
    console.log(`
    🚀 Server is running!
    ════════════════════════════════════
    📍 Local: http://localhost:${PORT}
    🌐 Environment: ${process.env.NODE_ENV || 'development'}
    🔧 Dev Mode: ${process.env.DEV_MODE === 'true'}
    💾 Default Data: ${process.env.USE_DEFAULT_DATA === 'true'}
    ════════════════════════════════════
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});
