const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const emailService = require('./emailService');

class AuthService {
    constructor() {
        this.pendingAuths = new Map();
        this.expiryMinutes = parseInt(process.env.CODE_EXPIRY_MINUTES) || 10;
        
        // Cleanup expired auths every minute
        setInterval(() => this.cleanupExpired(), 60000);
        
        console.log(`🔐 Auth Service initialized (code expiry: ${this.expiryMinutes} minutes)`);
    }

    generateSixDigitCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    async initiateAuth(email, useLink = false) {
        try {
            // Cleanup expired auths first
            this.cleanupExpired();
            
            // Validate email
            if (!this.validateEmail(email)) {
                return { 
                    success: false, 
                    error: 'Invalid email address',
                    code: 'INVALID_EMAIL'
                };
            }
            
            // Check rate limiting
            const rateLimit = this.checkRateLimit(email);
            if (!rateLimit.allowed) {
                return {
                    success: false,
                    error: 'Too many requests. Please try again later.',
                    code: 'RATE_LIMITED',
                    retryAfter: rateLimit.retryAfter
                };
            }
            
            // Check if email already has pending auth
            const existingAuth = this.pendingAuths.get(email);
            if (existingAuth && Date.now() < existingAuth.expiresAt) {
                const timeLeft = Math.ceil((existingAuth.expiresAt - Date.now()) / 1000);
                return { 
                    success: false, 
                    message: 'Authentication already pending. Check your email.',
                    code: 'AUTH_PENDING',
                    retryAfter: timeLeft
                };
            }

            if (useLink) {
                const token = uuidv4();
                const expiresAt = Date.now() + (this.expiryMinutes * 60 * 1000);
                
                this.pendingAuths.set(email, {
                    token: token,
                    type: 'link',
                    expiresAt: expiresAt,
                    createdAt: Date.now(),
                    attempts: 0
                });

                const emailResult = await emailService.sendAuthLink(email, token);
                
                if (emailResult.success) {
                    return {
                        success: true,
                        message: 'Login link sent to your email.',
                        expiresIn: this.expiryMinutes * 60,
                        method: 'link'
                    };
                } else {
                    this.pendingAuths.delete(email);
                    return { 
                        success: false, 
                        error: 'Failed to send email. Please try again.',
                        code: 'EMAIL_SEND_FAILED'
                    };
                }
            } else {
                const code = this.generateSixDigitCode();
                const expiresAt = Date.now() + (this.expiryMinutes * 60 * 1000);
                
                // Hash the code for storage
                const hashedCode = await bcrypt.hash(code, 10);
                
                this.pendingAuths.set(email, {
                    code: hashedCode,
                    type: 'code',
                    expiresAt: expiresAt,
                    attempts: 0,
                    maxAttempts: 5,
                    createdAt: Date.now()
                });

                const emailResult = await emailService.sendAuthCode(email, code);
                
                if (emailResult.success) {
                    return {
                        success: true,
                        message: 'Authentication code sent to your email.',
                        expiresIn: this.expiryMinutes * 60,
                        method: 'code'
                    };
                } else {
                    this.pendingAuths.delete(email);
                    return { 
                        success: false, 
                        error: 'Failed to send email. Please try again.',
                        code: 'EMAIL_SEND_FAILED'
                    };
                }
            }
        } catch (error) {
            console.error('Auth initiation error:', error);
            return { 
                success: false, 
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            };
        }
    }

    async verifyCode(email, code) {
        try {
            const authData = this.pendingAuths.get(email);
            
            if (!authData) {
                return { 
                    success: false, 
                    error: 'No authentication pending for this email. Please request a new code.',
                    code: 'NO_PENDING_AUTH'
                };
            }

            if (Date.now() > authData.expiresAt) {
                this.pendingAuths.delete(email);
                return { 
                    success: false, 
                    error: 'Code has expired. Please request a new one.',
                    code: 'CODE_EXPIRED'
                };
            }

            if (authData.attempts >= authData.maxAttempts) {
                this.pendingAuths.delete(email);
                return { 
                    success: false, 
                    error: 'Too many attempts. Please request a new code.',
                    code: 'TOO_MANY_ATTEMPTS'
                };
            }

            authData.attempts++;

            const isValid = await bcrypt.compare(code, authData.code);
            
            if (isValid) {
                this.pendingAuths.delete(email);
                return { 
                    success: true, 
                    message: 'Authentication successful',
                    code: 'AUTH_SUCCESS'
                };
            } else {
                const remainingAttempts = authData.maxAttempts - authData.attempts;
                let errorMessage = 'Invalid code.';
                
                if (remainingAttempts > 0) {
                    errorMessage += ` ${remainingAttempts} attempt(s) remaining.`;
                } else {
                    errorMessage += ' No attempts remaining.';
                }
                
                return { 
                    success: false, 
                    error: errorMessage,
                    code: 'INVALID_CODE',
                    remainingAttempts: remainingAttempts
                };
            }
        } catch (error) {
            console.error('Code verification error:', error);
            return { 
                success: false, 
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            };
        }
    }

    async verifyToken(email, token) {
        try {
            const authData = this.pendingAuths.get(email);
            
            if (!authData) {
                return { 
                    success: false, 
                    error: 'No authentication pending for this email.',
                    code: 'NO_PENDING_AUTH'
                };
            }

            if (Date.now() > authData.expiresAt) {
                this.pendingAuths.delete(email);
                return { 
                    success: false, 
                    error: 'Link has expired. Please request a new one.',
                    code: 'LINK_EXPIRED'
                };
            }

            if (authData.token === token) {
                this.pendingAuths.delete(email);
                return { 
                    success: true, 
                    message: 'Authentication successful',
                    code: 'AUTH_SUCCESS'
                };
            } else {
                return { 
                    success: false, 
                    error: 'Invalid or expired link',
                    code: 'INVALID_TOKEN'
                };
            }
        } catch (error) {
            console.error('Token verification error:', error);
            return { 
                success: false, 
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            };
        }
    }

    checkRateLimit(email) {
        // Simple rate limiting: max 5 requests per 10 minutes
        const now = Date.now();
        const tenMinutesAgo = now - (10 * 60 * 1000);
        
        // Count requests in last 10 minutes
        let requestCount = 0;
        let lastRequestTime = 0;
        
        for (const [storedEmail, authData] of this.pendingAuths.entries()) {
            if (storedEmail === email && authData.createdAt > tenMinutesAgo) {
                requestCount++;
                if (authData.createdAt > lastRequestTime) {
                    lastRequestTime = authData.createdAt;
                }
            }
        }
        
        if (requestCount >= 5) {
            const nextAllowedTime = lastRequestTime + (10 * 60 * 1000);
            const retryAfter = Math.ceil((nextAllowedTime - now) / 1000);
            
            return {
                allowed: false,
                retryAfter: retryAfter,
                message: `Rate limit exceeded. Try again in ${Math.ceil(retryAfter / 60)} minutes.`
            };
        }
        
        return { allowed: true };
    }

    cleanupExpired() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [email, authData] of this.pendingAuths.entries()) {
            if (now > authData.expiresAt) {
                this.pendingAuths.delete(email);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0 && process.env.LOG_PROCEDURE_CALLS === 'true') {
            console.log(`🧹 Cleaned up ${cleanedCount} expired authentication attempts`);
        }
    }

    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    getPendingAuth(email) {
        const authData = this.pendingAuths.get(email);
        if (!authData || Date.now() > authData.expiresAt) {
            return null;
        }
        return authData;
    }

    getStats() {
        return {
            totalPending: this.pendingAuths.size,
            expiryMinutes: this.expiryMinutes
        };
    }
}

module.exports = new AuthService();