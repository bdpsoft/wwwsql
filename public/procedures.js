class ProceduresApp {
    constructor() {
        this.procedures = {};
        this.currentProcedure = null;
        this.init();
    }

    async init() {
        await this.checkSession();
        await this.loadSystemStatus();
        await this.loadProcedures();
        this.renderProcedures();
        this.bindEvents();
    }

    async checkSession() {
        try {
            const response = await fetch('/api/auth/session');
            const data = await response.json();
            
            if (!data.authenticated) {
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Session check failed:', error);
            window.location.href = '/';
        }
    }

    async loadSystemStatus() {
        try {
            const response = await fetch('/api/system/status');
            const data = await response.json();
            
            const statusDiv = document.getElementById('systemStatus');
            
            let statusClass = 'status-good';
            let statusIcon = 'check-circle';
            let statusText = 'Connected';
            
            if (data.database === 'development_mode' || data.devMode) {
                statusClass = 'status-warn';
                statusIcon = 'exclamation-triangle';
                statusText = 'Development Mode';
            } else if (data.database !== 'connected') {
                statusClass = 'status-warn';
                statusIcon = 'exclamation-triangle';
                statusText = 'Database Issue';
            }
            
            statusDiv.innerHTML = `
                <div class="status-card ${statusClass}">
                    <div class="status-icon">
                        <i class="fas fa-${statusIcon}"></i>
                    </div>
                    <div class="status-details">
                        <h4>System Status</h4>
                        <p><strong>Database:</strong> ${data.database}</p>
                        <p><strong>Mode:</strong> ${data.devMode ? 'Development' : 'Production'}</p>
                        <p><strong>Procedures:</strong> ${data.procedures} configured</p>
                        <p><strong>Default Data:</strong> ${data.useDefaultData ? 'Enabled' : 'Disabled'}</p>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Failed to load system status:', error);
        }
    }

    async loadProcedures() {
        try {
            const response = await fetch('/api/procedures', {
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.procedures = data.procedures;
                
                // Update procedure select dropdown
                const select = document.getElementById('procedureSelect');
                select.innerHTML = '<option value="">Select a procedure...</option>';
                
                for (const [name, proc] of Object.entries(this.procedures)) {
                    const option = document.createElement('option');
                    option.value = name;
                    option.textContent = `${name} - ${proc.description}`;
                    select.appendChild(option);
                }
            } else {
                this.showMessage('Failed to load procedures', 'error');
            }
        } catch (error) {
            console.error('Failed to load procedures:', error);
            this.showMessage('Failed to load procedures. Please try again.', 'error');
        }
    }

    renderProcedures() {
        const container = document.getElementById('proceduresList');
        
        if (Object.keys(this.procedures).length === 0) {
            container.innerHTML = `
                <div class="message warning">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>No procedures available or failed to load.</p>
                    <p>Check your configuration or contact administrator.</p>
                </div>
            `;
            return;
        }
        
        let html = '<div class="procedures-grid">';
        
        for (const [name, proc] of Object.entries(this.procedures)) {
            html += `
                <div class="procedure-card">
                    <div class="procedure-header">
                        <h3><i class="fas fa-cogs"></i> ${name}</h3>
                        <span class="procedure-badge">
                            ${proc.schema ? 'Validated' : 'Basic'}
                        </span>
                    </div>
                    
                    <p class="procedure-description">${proc.description}</p>
                    
                    ${proc.schema ? `
                        <div class="procedure-schema">
                            <h4><i class="fas fa-code"></i> Parameters</h4>
                            <ul class="param-list">
                                ${Object.entries(proc.schema.properties || {}).map(([param, schema]) => `
                                    <li>
                                        <strong>${param}</strong> 
                                        <small>(${schema.type}${schema.enum ? `: [${schema.enum.join(', ')}]` : ''})</small>
                                        ${schema.description ? `<br><small>${schema.description}</small>` : ''}
                                        ${schema.default !== undefined ? `<br><small><i>Default: ${JSON.stringify(schema.default)}</i></small>` : ''}
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    <button onclick="proceduresApp.selectProcedure('${name}')" class="procedure-test-btn">
                        <i class="fas fa-play"></i> Test this procedure
                    </button>
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
    }

    selectProcedure(procedureName) {
        this.currentProcedure = procedureName;
        const select = document.getElementById('procedureSelect');
        select.value = procedureName;
        
        const procedure = this.procedures[procedureName];
        if (procedure && procedure.example) {
            document.getElementById('jsonInput').value = JSON.stringify(procedure.example, null, 2);
        } else {
            document.getElementById('jsonInput').value = '{}';
        }
        
        document.getElementById('jsonInput').focus();
        this.scrollToTestSection();
    }

    scrollToTestSection() {
        const testSection = document.querySelector('.test-controls');
        if (testSection) {
            testSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    async validateJson() {
        const procedureName = document.getElementById('procedureSelect').value;
        const jsonInput = document.getElementById('jsonInput');
        
        if (!procedureName) {
            this.showMessage('Please select a procedure first', 'error');
            return;
        }
        
        let jsonData;
        try {
            jsonData = jsonInput.value.trim() ? JSON.parse(jsonInput.value) : {};
        } catch (error) {
            this.showMessage('Invalid JSON: ' + error.message, 'error');
            jsonInput.focus();
            return;
        }
        
        this.showLoading('validateBtn');
        
        try {
            const response = await fetch(`/api/validate/${procedureName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ jsonData })
            });
            
            const data = await response.json();
            
            const resultDiv = document.getElementById('testResult');
            
            if (data.success) {
                resultDiv.className = 'test-result success';
                resultDiv.innerHTML = `
                    <h4><i class="fas fa-check-circle"></i> JSON Validation Successful</h4>
                    <p><strong>Procedure:</strong> ${data.procedure.name}</p>
                    <p>${data.procedure.description}</p>
                    <p>Input data is valid according to the schema.</p>
                    ${data.validation.appliedDefaults ? 
                        '<p><i class="fas fa-info-circle"></i> Default values were applied to missing properties.</p>' : ''}
                    <div class="result-meta">
                        <p><strong>Status:</strong> ${data.procedure.allowed ? 'Allowed' : 'Not Allowed'}</p>
                        <p><strong>Validation:</strong> Passed</p>
                    </div>
                `;
            } else {
                resultDiv.className = 'test-result error';
                
                let details = '';
                if (data.validation && data.validation.details) {
                    details = '<h5>Validation Errors:</h5><ul>';
                    data.validation.details.forEach(error => {
                        const prop = error.property === 'root' ? 'Root object' : error.property;
                        details += `<li><strong>${prop}</strong>: ${error.message}</li>`;
                    });
                    details += '</ul>';
                }
                
                resultDiv.innerHTML = `
                    <h4><i class="fas fa-exclamation-circle"></i> JSON Validation Failed</h4>
                    <p><strong>Error:</strong> ${data.validation.error}</p>
                    ${details}
                    <div class="result-meta">
                        <p><strong>Procedure:</strong> ${data.procedure.name}</p>
                        <p><strong>Status:</strong> ${data.procedure.allowed ? 'Allowed' : 'Not Allowed'}</p>
                    </div>
                `;
            }
            
            resultDiv.classList.remove('hidden');
            resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            
        } catch (error) {
            this.showMessage('Validation request failed: ' + error.message, 'error');
        } finally {
            this.hideLoading('validateBtn');
        }
    }

    async testProcedure() {
        const procedureName = document.getElementById('procedureSelect').value;
        const jsonInput = document.getElementById('jsonInput');
        
        if (!procedureName) {
            this.showMessage('Please select a procedure first', 'error');
            return;
        }
        
        let jsonData;
        try {
            jsonData = jsonInput.value.trim() ? JSON.parse(jsonInput.value) : {};
        } catch (error) {
            this.showMessage('Invalid JSON: ' + error.message, 'error');
            jsonInput.focus();
            return;
        }
        
        this.showLoading('testBtn');
        
        try {
            const response = await fetch(`/api/procedure/${procedureName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ jsonData })
            });
            
            const data = await response.json();
            
            this.displayTestResult(data, procedureName);
            
        } catch (error) {
            this.showMessage('Test request failed: ' + error.message, 'error');
        } finally {
            this.hideLoading('testBtn');
        }
    }

    displayTestResult(data, procedureName) {
        const resultDiv = document.getElementById('testResult');
        
        if (data.success) {
            resultDiv.className = 'test-result success';
            
            let dataPreview = '';
            if (data.data && data.data.length > 0) {
                const sampleData = data.data.slice(0, 3);
                dataPreview = `
                    <h5><i class="fas fa-table"></i> Result Data (${data.data.length} rows)</h5>
                    <div class="data-preview">
                        <pre>${JSON.stringify(sampleData, null, 2)}</pre>
                        ${data.data.length > 3 ? 
                            `<p style="text-align: center; color: #64748b; margin-top: 10px;">
                                <i class="fas fa-ellipsis-h"></i> ... and ${data.data.length - 3} more rows
                            </p>` : ''}
                    </div>
                `;
            } else {
                dataPreview = `
                    <div class="message info">
                        <i class="fas fa-info-circle"></i> No data returned from procedure.
                    </div>
                `;
            }
            
            const metadata = data.metadata || {};
            const validationStatus = metadata.validation?.response?.valid ? 'Passed' : 
                                   metadata.validation?.response?.warnings ? 'Warnings' : 'Not Validated';
            
            resultDiv.innerHTML = `
                <h4><i class="fas fa-check-circle"></i> Procedure Execution Successful</h4>
                
                <div class="result-meta">
                    <p><strong>Procedure:</strong> ${procedureName}</p>
                    <p><strong>Source:</strong> ${metadata.source || 'database'}</p>
                    <p><strong>Execution Time:</strong> ${metadata.executionTime || 0}ms</p>
                    <p><strong>Rows Returned:</strong> ${metadata.rowCount || 0}</p>
                    <p><strong>Validation:</strong> ${validationStatus}</p>
                    <p><strong>Timestamp:</strong> ${metadata.timestamp || new Date().toISOString()}</p>
                </div>
                
                ${dataPreview}
            `;
        } else {
            resultDiv.className = 'test-result error';
            
            let errorDetails = '';
            if (data.details) {
                if (Array.isArray(data.details)) {
                    errorDetails = '<h5>Error Details:</h5><ul>';
                    data.details.forEach(detail => {
                        errorDetails += `<li>${JSON.stringify(detail)}</li>`;
                    });
                    errorDetails += '</ul>';
                } else {
                    errorDetails = `<p><strong>Details:</strong> ${JSON.stringify(data.details)}</p>`;
                }
            }
            
            let validationInfo = '';
            if (data.validation) {
                validationInfo = `<p><strong>Failed at:</strong> ${data.validation.stage}</p>`;
            }
            
            resultDiv.innerHTML = `
                <h4><i class="fas fa-exclamation-circle"></i> Procedure Execution Failed</h4>
                <p><strong>Error:</strong> ${data.error}</p>
                ${data.technicalError ? 
                    `<p><small><strong>Technical:</strong> ${data.technicalError}</small></p>` : ''}
                ${data.code ? `<p><strong>Error Code:</strong> ${data.code}</p>` : ''}
                ${validationInfo}
                ${errorDetails}
            `;
        }
        
        resultDiv.classList.remove('hidden');
        resultDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    showMessage(text, type = 'info') {
        // Create temporary message element
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            ${text}
        `;
        
        // Insert at top of card
        const card = document.querySelector('.card');
        if (card) {
            card.insertBefore(messageDiv, card.firstChild);
            
            // Remove after 5 seconds
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    messageDiv.classList.add('hidden');
                    setTimeout(() => {
                        if (messageDiv.parentNode) {
                            messageDiv.parentNode.removeChild(messageDiv);
                        }
                    }, 300);
                }
            }, 5000);
        } else {
            alert(`${type.toUpperCase()}: ${text}`);
        }
    }

    showLoading(buttonId = 'testBtn') {
        const btn = document.getElementById(buttonId);
        const btnText = document.getElementById(`${buttonId}Text`);
        const loader = document.getElementById(`${buttonId}Loader`);
        
        if (btn) btn.disabled = true;
        if (btnText) btnText.classList.add('hidden');
        if (loader) loader.classList.remove('hidden');
    }

    hideLoading(buttonId = 'testBtn') {
        const btn = document.getElementById(buttonId);
        const btnText = document.getElementById(`${buttonId}Text`);
        const loader = document.getElementById(`${buttonId}Loader`);
        
        if (btn) btn.disabled = false;
        if (btnText) btnText.classList.remove('hidden');
        if (loader) loader.classList.add('hidden');
    }

    bindEvents() {
        const procedureSelect = document.getElementById('procedureSelect');
        const jsonInput = document.getElementById('jsonInput');
        
        if (procedureSelect) {
            procedureSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.selectProcedure(e.target.value);
                }
            });
        }
        
        if (jsonInput) {
            // Tab support for JSON editing
            jsonInput.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    const start = jsonInput.selectionStart;
                    const end = jsonInput.selectionEnd;
                    
                    // Insert 2 spaces
                    jsonInput.value = jsonInput.value.substring(0, start) + '  ' + jsonInput.value.substring(end);
                    jsonInput.selectionStart = jsonInput.selectionEnd = start + 2;
                }
            });
            
            // Auto-format JSON on Ctrl+Enter
            jsonInput.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                    e.preventDefault();
                    this.formatJson();
                }
            });
        }
        
        // Auto-validate JSON on blur
        jsonInput.addEventListener('blur', () => {
            if (jsonInput.value.trim()) {
                try {
                    JSON.parse(jsonInput.value);
                } catch (error) {
                    this.showMessage('Invalid JSON format', 'error');
                }
            }
        });
    }

    formatJson() {
        const jsonInput = document.getElementById('jsonInput');
        if (!jsonInput) return;
        
        try {
            const parsed = JSON.parse(jsonInput.value);
            jsonInput.value = JSON.stringify(parsed, null, 2);
            this.showMessage('JSON formatted successfully', 'success');
        } catch (error) {
            this.showMessage('Cannot format invalid JSON', 'error');
        }
    }
}

// Initialize procedures app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.proceduresApp = new ProceduresApp();
});