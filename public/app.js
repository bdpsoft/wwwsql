class AuthApp {
    constructor() {
        this.apiBaseUrl = window.location.origin;
        this.currentView = 'email';
        this.userEmail = '';
        this.timer = null;
        this.sessionCheckInterval = null;
        
        this.init();
    }

    async init() {
        await this.checkSession();
        this.render();
        this.bindEvents();
        this.startSessionMonitor();
    }

    async checkSession() {
        try {
            const response = await fetch('/api/auth/session');
            const data = await response.json();
            
            if (data.authenticated) {
                this.currentView = 'dashboard';
                this.userEmail = data.user.email;
            }
        } catch (error) {
            console.error('Session check failed:', error);
        }
    }

    startSessionMonitor() {
        // Check session every 30 seconds
        this.sessionCheckInterval = setInterval(async () => {
            try {
                const response = await fetch('/api/auth/session');
                const data = await response.json();
                
                if (!data.authenticated && this.currentView === 'dashboard') {
                    // Session expired, redirect to login
                    this.showMessage('Session expired. Please login again.', 'error');
                    setTimeout(() => {
                        this.currentView = 'email';
                        this.userEmail = '';
                        this.render();
                    }, 2000);
                }
            } catch (error) {
                console.error('Session monitor error:', error);
            }
        }, 30000);
    }

    render() {
        const app = document.getElementById('app');
        
        switch (this.currentView) {
            case 'email':
                app.innerHTML = this.renderEmailView();
                break;
            case 'code':
                app.innerHTML = this.renderCodeView();
                break;
            case 'dashboard':
                app.innerHTML = this.renderDashboard();
                break;
            case 'link-sent':
                app.innerHTML = this.renderLinkSentView();
                break;
        }
    }

    renderEmailView() {
        return `
            <div class="card">
                <h1><i class="fas fa-lock"></i> Welcome</h1>
                <p class="subtitle">Enter your email to sign in to the system</p>
                
                <div id="message" class="message hidden"></div>
                
                <div class="form-group">
                    <label for="email"><i class="fas fa-envelope"></i> Email Address</label>
                    <input 
                        type="email" 
                        id="email" 
                        placeholder="your.email@example.com"
                        autocomplete="email"
                        autofocus
                    >
                </div>
                
                <button id="sendCodeBtn" onclick="app.sendCode()">
                    <i class="fas fa-key"></i>
                    <span id="btnText">Send Verification Code</span>
                    <span id="btnLoader" class="loader hidden"></span>
                </button>
                
                <button id="sendLinkBtn" class="button-secondary" onclick="app.sendLink()">
                    <i class="fas fa-paper-plane"></i>
                    <span id="linkBtnText">Send Magic Link</span>
                    <span id="linkBtnLoader" class="loader hidden"></span>
                </button>
                
                <div class="toggle-auth">
                    <p>Choose your preferred authentication method</p>
                </div>
            </div>
        `;
    }

    renderCodeView() {
        return `
            <div class="card">
                <h1><i class="fas fa-shield-alt"></i> Verify Identity</h1>
                <p class="subtitle">We sent a 6-digit code to <strong>${this.userEmail}</strong></p>
                
                <div id="message" class="message hidden"></div>
                
                <div class="form-group">
                    <label for="code"><i class="fas fa-code"></i> Verification Code</label>
                    <input 
                        type="text" 
                        id="code" 
                        placeholder="Enter 6-digit code"
                        maxlength="6"
                        inputmode="numeric"
                        pattern="[0-9]*"
                        autocomplete="one-time-code"
                        autofocus
                    >
                    <div class="form-hint">Enter the 6-digit code sent to your email</div>
                </div>
                
                <div id="timer" class="timer-container">
                    <div class="timer" id="countdown">10:00</div>
                    <div class="timer-label">Code expires in</div>
                </div>
                
                <button id="verifyBtn" onclick="app.verifyCode()">
                    <i class="fas fa-check-circle"></i>
                    <span id="btnText">Verify & Continue</span>
                    <span id="btnLoader" class="loader hidden"></span>
                </button>
                
                <button id="resendBtn" class="button-secondary" onclick="app.resendCode()" disabled>
                    <i class="fas fa-redo"></i>
                    <span id="resendText">Resend Code (60s)</span>
                    <span id="resendLoader" class="loader hidden"></span>
                </button>
                
                <div class="toggle-auth">
                    <a onclick="app.backToEmail()"><i class="fas fa-arrow-left"></i> Use different email</a>
                </div>
            </div>
        `;
    }

    renderLinkSentView() {
        return `
            <div class="card">
                <h1><i class="fas fa-paper-plane"></i> Check Your Inbox</h1>
                <p class="subtitle">We sent a magic login link to <strong>${this.userEmail}</strong></p>
                
                <div class="message info">
                    <i class="fas fa-envelope-open-text fa-3x" style="margin-bottom: 20px;"></i>
                    <h3>Magic Link Sent!</h3>
                    <p>Click the link in the email to securely sign in.</p>
                    <p>The link will expire in 10 minutes.</p>
                </div>
                
                <div class="timer-container">
                    <div class="timer" id="linkCountdown">10:00</div>
                    <div class="timer-label">Link expires in</div>
                </div>
                
                <button onclick="app.backToEmail()" class="button-secondary">
                    <i class="fas fa-arrow-left"></i> Use different email
                </button>
                
                <div class="toggle-auth">
                    <a onclick="app.resendLink()"><i class="fas fa-redo"></i> Resend magic link</a>
                </div>
            </div>
        `;
    }

    renderDashboard() {
        return `
            <div class="card dashboard">
                <h1><i class="fas fa-user-circle"></i> Dashboard</h1>
                <p class="subtitle">Welcome back, ${this.userEmail}</p>
                
                <div class="user-info">
                    <p><i class="fas fa-check-circle" style="color: #10b981;"></i> <strong>Status:</strong> Authenticated</p>
                    <p><i class="fas fa-envelope" style="color: #667eea;"></i> <strong>Email:</strong> ${this.userEmail}</p>
                    <p><i class="fas fa-clock" style="color: #f59e0b;"></i> <strong>Session:</strong> Active</p>
                </div>
                
                <div class="dashboard-actions">
                    <a href="/procedures" class="dashboard-card">
                        <i class="fas fa-database"></i>
                        <h3>Database Procedures</h3>
                        <p>Test and execute stored procedures with JSON validation</p>
                    </a>
                    
                    <a href="/api/system/status" target="_blank" class="dashboard-card">
                        <i class="fas fa-server"></i>
                        <h3>System Status</h3>
                        <p>Check API health, database connection, and configuration</p>
                    </a>
                    
                    <div class="dashboard-card" onclick="app.testConnection()">
                        <i class="fas fa-plug"></i>
                        <h3>Test Connection</h3>
                        <p>Test database connection and view configuration</p>
                    </div>
                    
                    <div class="dashboard-card" onclick="app.viewSessionInfo()">
                        <i class="fas fa-id-card"></i>
                        <h3>Session Info</h3>
                        <p>View current session details and expiration</p>
                    </div>
                </div>
                
                <button onclick="app.logout()" class="logout-btn">
                    <i class="fas fa-sign-out-alt"></i> Logout
                </button>
            </div>
        `;
    }

    bindEvents() {
        // Auto-focus email input
        if (this.currentView === 'email' && document.getElementById('email')) {
            document.getElementById('email').focus();
        }
        
        // Auto-focus code input
        if (this.currentView === 'code' && document.getElementById('code')) {
            document.getElementById('code').focus();
            
            // Auto-advance between code digits
            const codeInput = document.getElementById('code');
            codeInput.addEventListener('input', (e) => {
                if (e.target.value.length === 6) {
                    document.getElementById('verifyBtn').focus();
                }
            });
        }
        
        // Enter key support
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                if (this.currentView === 'email') {
                    this.sendCode();
                } else if (this.currentView === 'code') {
                    this.verifyCode();
                }
            }
        });
        
        // Start timers if needed
        if (this.currentView === 'code') {
            this.startCodeTimer();
            this.startResendTimer();
        } else if (this.currentView === 'link-sent') {
            this.startLinkTimer();
        }
    }

    showMessage(text, type = 'info', duration = 5000) {
        const messageDiv = document.getElementById('message');
        if (messageDiv) {
            messageDiv.innerHTML = `
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                ${text}
            `;
            messageDiv.className = `message ${type}`;
            messageDiv.classList.remove('hidden');
            
            if (type !== 'error' && duration > 0) {
                setTimeout(() => {
                    messageDiv.classList.add('hidden');
                }, duration);
            }
        } else {
            // Fallback to alert if message div not found
            alert(`${type.toUpperCase()}: ${text}`);
        }
    }

    showLoading(buttonId = 'sendCodeBtn') {
        const btn = document.getElementById(buttonId);
        const btnText = document.getElementById('btnText') || 
                       document.getElementById(`${buttonId.replace('Btn', '')}Text`);
        const loader = document.getElementById('btnLoader') || 
                      document.getElementById(`${buttonId.replace('Btn', '')}Loader`);
        
        if (btn) btn.disabled = true;
        if (btnText) btnText.classList.add('hidden');
        if (loader) loader.classList.remove('hidden');
    }

    hideLoading(buttonId = 'sendCodeBtn') {
        const btn = document.getElementById(buttonId);
        const btnText = document.getElementById('btnText') || 
                       document.getElementById(`${buttonId.replace('Btn', '')}Text`);
        const loader = document.getElementById('btnLoader') || 
                      document.getElementById(`${buttonId.replace('Btn', '')}Loader`);
        
        if (btn) btn.disabled = false;
        if (btnText) btnText.classList.remove('hidden');
        if (loader) loader.classList.add('hidden');
    }

    async sendCode() {
        const emailInput = document.getElementById('email');
        if (!emailInput) return;
        
        const email = emailInput.value.trim();
        
        if (!this.validateEmail(email)) {
            this.showMessage('Please enter a valid email address', 'error');
            emailInput.focus();
            return;
        }
        
        this.showLoading('sendCodeBtn');
        this.userEmail = email;
        
        try {
            const response = await fetch('/api/auth/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, useLink: false })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.currentView = 'code';
                this.render();
                this.bindEvents();
                this.showMessage('Verification code sent successfully!', 'success');
            } else {
                this.showMessage(data.error || 'Failed to send code', 'error');
            }
        } catch (error) {
            this.showMessage('Network error. Please check your connection.', 'error');
        } finally {
            this.hideLoading('sendCodeBtn');
        }
    }

    async sendLink() {
        const emailInput = document.getElementById('email');
        if (!emailInput) return;
        
        const email = emailInput.value.trim();
        
        if (!this.validateEmail(email)) {
            this.showMessage('Please enter a valid email address', 'error');
            emailInput.focus();
            return;
        }
        
        this.showLoading('sendLinkBtn');
        this.userEmail = email;
        
        try {
            const response = await fetch('/api/auth/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, useLink: true })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.currentView = 'link-sent';
                this.render();
                this.bindEvents();
            } else {
                this.showMessage(data.error || 'Failed to send link', 'error');
            }
        } catch (error) {
            this.showMessage('Network error. Please check your connection.', 'error');
        } finally {
            this.hideLoading('sendLinkBtn');
        }
    }

    async verifyCode() {
        const codeInput = document.getElementById('code');
        if (!codeInput) return;
        
        const code = codeInput.value.trim();
        
        if (code.length !== 6 || !/^\d+$/.test(code)) {
            this.showMessage('Please enter a valid 6-digit code', 'error');
            codeInput.focus();
            codeInput.select();
            return;
        }
        
        this.showLoading('verifyBtn');
        
        try {
            const response = await fetch('/api/auth/verify/code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: this.userEmail, code })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showMessage('Authentication successful! Redirecting...', 'success');
                
                // Small delay for user to see success message
                setTimeout(() => {
                    this.currentView = 'dashboard';
                    this.render();
                    this.bindEvents();
                }, 1500);
            } else {
                this.showMessage(data.error || 'Invalid code. Please try again.', 'error');
                codeInput.value = '';
                codeInput.focus();
            }
        } catch (error) {
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            this.hideLoading('verifyBtn');
        }
    }

    async resendCode() {
        const resendBtn = document.getElementById('resendBtn');
        if (resendBtn && resendBtn.disabled) return;
        
        this.showLoading('resendBtn');
        
        try {
            const response = await fetch('/api/auth/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: this.userEmail, useLink: false })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showMessage('New code sent to your email', 'success');
                this.startResendTimer();
                this.startCodeTimer();
                
                // Clear and refocus code input
                const codeInput = document.getElementById('code');
                if (codeInput) {
                    codeInput.value = '';
                    codeInput.focus();
                }
            } else {
                this.showMessage(data.error || 'Failed to resend code', 'error');
            }
        } catch (error) {
            this.showMessage('Network error. Please try again.', 'error');
        } finally {
            this.hideLoading('resendBtn');
        }
    }

    async resendLink() {
        try {
            const response = await fetch('/api/auth/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: this.userEmail, useLink: true })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showMessage('New magic link sent to your email', 'success');
                this.startLinkTimer();
            } else {
                this.showMessage(data.error || 'Failed to resend link', 'error');
            }
        } catch (error) {
            this.showMessage('Network error. Please try again.', 'error');
        }
    }

    async logout() {
        try {
            const response = await fetch('/api/auth/logout', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.showMessage('Logged out successfully', 'success');
                
                // Clear session monitor
                if (this.sessionCheckInterval) {
                    clearInterval(this.sessionCheckInterval);
                }
                
                // Small delay then redirect
                setTimeout(() => {
                    this.currentView = 'email';
                    this.userEmail = '';
                    this.render();
                    this.bindEvents();
                }, 1000);
            }
        } catch (error) {
            this.showMessage('Logout failed. Please try again.', 'error');
        }
    }

    backToEmail() {
        this.currentView = 'email';
        this.userEmail = '';
        this.render();
        this.bindEvents();
    }

    startResendTimer() {
        let timeLeft = 60;
        const resendBtn = document.getElementById('resendBtn');
        const resendText = document.getElementById('resendText');
        
        if (!resendBtn || !resendText) return;
        
        resendBtn.disabled = true;
        
        const timer = setInterval(() => {
            resendText.textContent = `Resend Code (${timeLeft}s)`;
            timeLeft--;
            
            if (timeLeft < 0) {
                clearInterval(timer);
                resendBtn.disabled = false;
                resendText.textContent = 'Resend Code';
                resendText.classList.remove('hidden');
            }
        }, 1000);
    }

    startCodeTimer() {
        let timeLeft = 600; // 10 minutes in seconds
        const timerDiv = document.getElementById('countdown');
        
        if (!timerDiv) return;
        
        const updateTimer = () => {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            timerDiv.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timerDiv.textContent = '00:00';
                timerDiv.style.color = '#ef4444';
                
                // Show expired message
                this.showMessage('Code has expired. Please request a new one.', 'error');
            }
            
            // Change color when less than 1 minute
            if (timeLeft <= 60) {
                timerDiv.style.color = '#f59e0b';
            }
            
            timeLeft--;
        };
        
        updateTimer();
        const timerInterval = setInterval(updateTimer, 1000);
    }

    startLinkTimer() {
        let timeLeft = 600; // 10 minutes in seconds
        const timerDiv = document.getElementById('linkCountdown');
        
        if (!timerDiv) return;
        
        const updateTimer = () => {
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            timerDiv.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                timerDiv.textContent = '00:00';
                timerDiv.style.color = '#ef4444';
                
                // Show expired message
                const messageDiv = document.querySelector('.message.info');
                if (messageDiv) {
                    messageDiv.innerHTML = `
                        <i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom: 20px; color: #ef4444;"></i>
                        <h3>Link Expired!</h3>
                        <p>The magic link has expired.</p>
                        <p>Please request a new one.</p>
                    `;
                    messageDiv.className = 'message error';
                }
            }
            
            // Change color when less than 1 minute
            if (timeLeft <= 60) {
                timerDiv.style.color = '#f59e0b';
            }
            
            timeLeft--;
        };
        
        updateTimer();
        const timerInterval = setInterval(updateTimer, 1000);
    }

    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    async testConnection() {
        try {
            const response = await fetch('/api/system/status');
            const data = await response.json();
            
            let message = `System Status: ${data.status}\n`;
            message += `Database: ${data.database}\n`;
            message += `Environment: ${data.environment}\n`;
            message += `Dev Mode: ${data.devMode ? 'ON' : 'OFF'}\n`;
            message += `Procedures: ${data.procedures} configured\n`;
            message += `Uptime: ${Math.floor(data.uptime / 60)} minutes`;
            
            alert(message);
        } catch (error) {
            this.showMessage('Failed to get system status', 'error');
        }
    }

    async viewSessionInfo() {
        try {
            const response = await fetch('/api/auth/session');
            const data = await response.json();
            
            if (data.authenticated) {
                let message = `Session Information:\n\n`;
                message += `Email: ${data.user.email}\n`;
                message += `Session ID: ${data.sessionId.substring(0, 8)}...\n`;
                message += `Authenticated: ${data.user.authenticatedAt || 'N/A'}\n`;
                message += `Method: ${data.user.via || 'verification code'}\n`;
                message += `Timestamp: ${data.timestamp}`;
                
                alert(message);
            } else {
                this.showMessage('No active session found', 'warning');
            }
        } catch (error) {
            this.showMessage('Failed to get session info', 'error');
        }
    }
}

// Initialize app
window.app = new AuthApp();