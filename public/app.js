class AuthApp {
    constructor() {
        this.state = {
            view: "email",
            userEmail: "",
            sessionCheckInterval: null
        };

        this.api = {
            getSession: () => fetch('/api/auth/session').then(r => r.json()),
            initiate: (payload) => fetch('/api/auth/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(r => r.json()),
            verifyCode: (payload) => fetch('/api/auth/verify/code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(r => r.json()),
            logout: () => fetch('/api/auth/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }).then(r => r.json()),
            systemStatus: () => fetch('/api/system/status').then(r => r.json())
        };

        this.views = {
            email: () => `
                <div class="card">
                    <h1><i class="fas fa-lock"></i> Welcome</h1>
                    <p class="subtitle">Enter your email to sign in</p>
                    <div id="message" class="message hidden"></div>
                    <div class="form-group">
                        <label for="email"><i class="fas fa-envelope"></i> Email Address</label>
                        <input type="email" id="email" placeholder="your.email@example.com" autocomplete="email" autofocus>
                    </div>
                    <button id="sendCodeBtn" data-action="sendCode">
                        <i class="fas fa-key"></i>
                        <span id="sendCodeBtnText">Send Verification Code</span>
                        <span id="sendCodeBtnLoader" class="loader hidden"></span>
                    </button>
                    <button id="sendLinkBtn" data-action="sendLink">
                        <i class="fas fa-paper-plane"></i>
                        <span id="sendLinkBtnText">Send Magic Link</span>
                        <span id="sendLinkBtnLoader" class="loader hidden"></span>
                    </button>
                </div>
            `,
            code: () => `
                <div class="card">
                    <h1><i class="fas fa-shield-alt"></i> Verify Identity</h1>
                    <p class="subtitle">We sent a 6-digit code to <strong>${this.state.userEmail}</strong></p>
                    <div id="message" class="message hidden"></div>
                    <div class="form-group">
                        <label for="code"><i class="fas fa-code"></i> Verification Code</label>
                        <input type="text" id="code" maxlength="6" placeholder="Enter 6-digit code" inputmode="numeric">
                    </div>
                    <div class="timer-container">
                        <div class="timer" id="countdown">10:00</div>
                    </div>
                    <button id="verifyBtn" data-action="verifyCode">
                        <i class="fas fa-check-circle"></i>
                        <span id="verifyBtnText">Verify & Continue</span>
                        <span id="verifyBtnLoader" class="loader hidden"></span>
                    </button>
                    <button id="resendBtn" data-action="resendCode">
                        <i class="fas fa-redo"></i>
                        <span id="resendBtnText">Resend Code (60s)</span>
                        <span id="resendBtnLoader" class="loader hidden"></span>
                    </button>
                    <div class="toggle-auth">
                        <a href="#" data-action="backToEmail"><i class="fas fa-arrow-left"></i> Use different email</a>
                    </div>
                </div>
            `,
            dashboard: () => `
                <div class="card dashboard">
                    <h1><i class="fas fa-user-circle"></i> Dashboard</h1>
                    <p class="subtitle">Welcome, ${this.state.userEmail}</p>
                    <button data-action="logout"><i class="fas fa-sign-out-alt"></i> Logout</button>
                </div>
            `
        };

        this.init();
    }

    async init() {
        await this.checkSession();
        this.render();
        this.attachEventDelegation();
        this.startSessionMonitor(); // Sada je definisana ispod!
    }

    render() {
        const view = this.state.view;
        const renderer = this.views[view];
        const container = document.getElementById("app");
        if (container && typeof renderer === "function") {
            container.innerHTML = renderer();
        }
    }

    attachEventDelegation() {
        document.addEventListener("click", (e) => {
            const el = e.target.closest("[data-action]");
            if (!el) return;
            const action = el.dataset.action;
            if (typeof this[action] === "function") {
                e.preventDefault();
                this[action]();
            }
        });
    }

    startSessionMonitor() {
        // Čistimo stari interval ako postoji da ne bi došlo do curenja memorije
        if (this.state.sessionCheckInterval) clearInterval(this.state.sessionCheckInterval);

        this.state.sessionCheckInterval = setInterval(async () => {
            try {
                const data = await this.api.getSession();
                if (!data.authenticated && this.state.view === "dashboard") {
                    this.showMessage("Session expired. Please login again.", "error");
                    setTimeout(() => {
                        this.state.view = "email";
                        this.render();
                    }, 1500);
                }
            } catch (e) {
                console.warn("Monitor: Session check failed.");
            }
        }, 30000);
    }

    async checkSession() {
        try {
            const data = await this.api.getSession();
            if (data && data.authenticated) {
                this.state.view = "dashboard";
                this.state.userEmail = data.user.email;
            }
        } catch (e) {
            console.error("Initial session check failed");
        }
    }

    async sendCode() {
        const emailInput = document.getElementById("email");
        if (!emailInput) return;
        const email = emailInput.value.trim();
        
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return this.showMessage("Invalid email", "error");
        }

        this.showLoading("sendCodeBtn");
        this.state.userEmail = email;

        try {
            const data = await this.api.initiate({ email, useLink: false });
            this.hideLoading("sendCodeBtn");
            if (data.success) {
                this.state.view = "code";
                this.render();
            } else {
                this.showMessage(data.error || "Error sending code", "error");
            }
        } catch (e) {
            this.hideLoading("sendCodeBtn");
            this.showMessage("Network error", "error");
        }
    }

    async verifyCode() {
        const codeInput = document.getElementById("code");
        if (!codeInput) return;
        const code = codeInput.value.trim();

        this.showLoading("verifyBtn");
        try {
            const data = await this.api.verifyCode({ email: this.state.userEmail, code });
            this.hideLoading("verifyBtn");
            if (data.success) {
                this.state.view = "dashboard";
                this.render();
            } else {
                this.showMessage("Invalid code", "error");
            }
        } catch (e) {
            this.hideLoading("verifyBtn");
            this.showMessage("Verification failed", "error");
        }
    }

    async logout() {
        try {
            await this.api.logout();
            this.state.view = "email";
            this.state.userEmail = "";
            this.render();
        } catch (e) {
            location.reload(); // Sigurna opcija ako logout API ne uspe
        }
    }

    backToEmail() {
        this.state.view = "email";
        this.render();
    }

    showLoading(id) {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.disabled = true;
        document.getElementById(id + "Text")?.classList.add("hidden");
        document.getElementById(id + "Loader")?.classList.remove("hidden");
    }

    hideLoading(id) {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.disabled = false;
        document.getElementById(id + "Text")?.classList.remove("hidden");
        document.getElementById(id + "Loader")?.classList.add("hidden");
    }

    showMessage(text, type = "info") {
        const box = document.getElementById("message");
        if (!box) return alert(text);
        box.innerHTML = text;
        box.className = `message ${type}`;
        box.classList.remove("hidden");
        setTimeout(() => box.classList.add("hidden"), 3000);
    }
}

window.app = new AuthApp();