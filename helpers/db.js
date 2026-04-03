const sql = require('mssql');
const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

class DatabaseHelper {
    constructor() {
        this.config = {
            server: process.env.DB_SERVER || 'VAŠA_JAVNA_IP',
            port: parseInt(process.env.DB_PORT) || 1433,
            database: process.env.DB_DATABASE || 'TvojaBaza',
            user: process.env.DB_USER || 'hosting_user',
            password: process.env.DB_PASSWORD || 'Lozinka!',
            options: {
                encrypt: false,
                trustServerCertificate: true
            },
            pool: {
                max: parseInt(process.env.DB_POOL_MAX) || 10,
                min: parseInt(process.env.DB_POOL_MIN) || 0,
                idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000
            }
        };

        // Initialize JSON schema validator
        this.ajv = new Ajv({ 
            allErrors: true,
            strict: false,
            coerceTypes: true,
            messages: true
        });
        addFormats(this.ajv);
        
        // Load procedure configuration
        this.loadProcedureConfig();
        
        // Development mode flags
        this.devMode = process.env.DEV_MODE === 'true';
        this.useDefaultData = process.env.USE_DEFAULT_DATA === 'true';
        this.validateJson = process.env.VALIDATE_JSON !== 'false';
        this.logProcedureCalls = process.env.LOG_PROCEDURE_CALLS === 'true';
        
        console.log(`🔧 DB Helper initialized`);
        console.log(`   ├─ Dev Mode: ${this.devMode}`);
        console.log(`   ├─ Use Default Data: ${this.useDefaultData}`);
        console.log(`   ├─ Validate JSON: ${this.validateJson}`);
        console.log(`   └─ Log Calls: ${this.logProcedureCalls}`);
    }

    loadProcedureConfig() {
        try {
            const configPath = path.join(__dirname, '../config/procedures.json');
            
            if (!fs.existsSync(configPath)) {
                console.warn('⚠️  procedures.json not found, creating default...');
                this.createDefaultProcedureConfig(configPath);
            }
            
            const configData = fs.readFileSync(configPath, 'utf8');
            this.procedureConfig = JSON.parse(configData);
            console.log(`✅ Loaded configuration for ${Object.keys(this.procedureConfig.procedures).length} procedures`);
        } catch (error) {
            console.error('❌ Failed to load procedure configuration:', error.message);
            this.procedureConfig = { procedures: {}, globalSettings: {} };
        }
    }

    createDefaultProcedureConfig(configPath) {
        const defaultConfig = {
            procedures: {
                GetUserProfile: {
                    description: "Vraća korisnički profil - primer procedure",
                    allowed: true,
                    jsonSchema: {
                        type: "object",
                        properties: {
                            includeSettings: {
                                type: "boolean",
                                default: false
                            }
                        },
                        additionalProperties: false
                    },
                    defaultData: [
                        {
                            id: 1,
                            email: "demo@example.com",
                            firstName: "Demo",
                            lastName: "Korisnik",
                            createdAt: new Date().toISOString()
                        }
                    ],
                    responseSchema: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                id: { type: "integer" },
                                email: { type: "string", format: "email" },
                                firstName: { type: "string" },
                                lastName: { type: "string" },
                                createdAt: { type: "string", format: "date-time" }
                            }
                        }
                    }
                }
            },
            globalSettings: {
                maxJsonSize: 1048576,
                defaultResponseLimit: 1000,
                allowedEmailDomains: [],
                logLevel: "info",
                cacheDuration: 300
            }
        };

        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
        this.procedureConfig = defaultConfig;
    }

    getProcedureInfo(procedureName) {
        return this.procedureConfig.procedures[procedureName] || null;
    }

    isProcedureAllowed(procedureName) {
        const procedure = this.getProcedureInfo(procedureName);
        
        if (!procedure) {
            return {
                allowed: false,
                error: `Procedure '${procedureName}' not found in configuration`
            };
        }
        
        if (!procedure.allowed) {
            return {
                allowed: false,
                error: `Procedure '${procedureName}' is not allowed`
            };
        }
        
        return { allowed: true, procedure };
    }

    validateJsonData(procedureName, jsonData) {
        const procedure = this.getProcedureInfo(procedureName);
        
        if (!procedure || !procedure.jsonSchema || !this.validateJson) {
            return { valid: true, data: jsonData };
        }
        
        try {
            // Parse if string, otherwise use as-is
            let dataToValidate;
            if (typeof jsonData === 'string') {
                try {
                    dataToValidate = JSON.parse(jsonData);
                } catch (parseError) {
                    return {
                        valid: false,
                        error: `Invalid JSON string: ${parseError.message}`
                    };
                }
            } else if (typeof jsonData === 'object' && jsonData !== null) {
                dataToValidate = jsonData;
            } else {
                dataToValidate = {};
            }

            const validate = this.ajv.compile(procedure.jsonSchema);
            const isValid = validate(dataToValidate);
            
            if (!isValid) {
                return {
                    valid: false,
                    error: 'JSON validation failed',
                    details: validate.errors.map(err => ({
                        property: err.instancePath || 'root',
                        message: err.message,
                        params: err.params,
                        schemaPath: err.schemaPath
                    }))
                };
            }
            
            // Apply defaults for missing properties
            const dataWithDefaults = this.applyDefaults(dataToValidate, procedure.jsonSchema);
            
            return {
                valid: true,
                data: dataWithDefaults,
                appliedDefaults: dataToValidate !== dataWithDefaults
            };
            
        } catch (error) {
            return {
                valid: false,
                error: `JSON validation error: ${error.message}`
            };
        }
    }

    applyDefaults(data, schema) {
        if (!schema.properties || typeof data !== 'object' || data === null) {
            return data;
        }
        
        const result = Array.isArray(data) ? [...data] : { ...data };
        
        for (const [property, propSchema] of Object.entries(schema.properties)) {
            if (result[property] === undefined && propSchema.default !== undefined) {
                result[property] = propSchema.default;
            }
        }
        
        return result;
    }

    validateResponseData(procedureName, data) {
        const procedure = this.getProcedureInfo(procedureName);
        
        if (!procedure || !procedure.responseSchema || !this.validateJson) {
            return { valid: true };
        }
        
        try {
            const validate = this.ajv.compile(procedure.responseSchema);
            const isValid = validate(data);
            
            if (!isValid) {
                console.warn(`⚠️ Response validation failed for ${procedureName}:`);
                validate.errors.forEach(err => {
                    console.warn(`   - ${err.instancePath}: ${err.message}`);
                });
                
                return {
                    valid: false,
                    warnings: validate.errors.map(err => ({
                        property: err.instancePath || 'root',
                        message: err.message,
                        schemaPath: err.schemaPath
                    }))
                };
            }
            
            return { valid: true };
        } catch (error) {
            console.warn(`⚠️ Response validation error for ${procedureName}:`, error.message);
            return { 
                valid: false, 
                error: `Response validation failed: ${error.message}` 
            };
        }
    }

    async callProcedure(procedureName, email, jsonData) {
        const startTime = Date.now();
        
        // Log the call
        if (this.logProcedureCalls) {
            console.log(`📞 Procedure call started: ${procedureName} for ${email}`);
        }
        
        // 1. Check if procedure exists and is allowed
        const procedureCheck = this.isProcedureAllowed(procedureName);
        if (!procedureCheck.allowed) {
            const errorResult = {
                success: false,
                error: procedureCheck.error,
                validation: { stage: 'procedure_check', failed: true },
                executionTime: Date.now() - startTime
            };
            
            if (this.logProcedureCalls) {
                console.log(`❌ Procedure check failed: ${procedureCheck.error}`);
            }
            
            return errorResult;
        }
        
        // 2. Validate JSON input
        const jsonValidation = this.validateJsonData(procedureName, jsonData);
        if (!jsonValidation.valid) {
            const errorResult = {
                success: false,
                error: 'Invalid input data',
                details: jsonValidation.details || jsonValidation.error,
                validation: { stage: 'input_validation', failed: true },
                executionTime: Date.now() - startTime
            };
            
            if (this.logProcedureCalls) {
                console.log(`❌ Input validation failed:`, jsonValidation.error);
            }
            
            return errorResult;
        }
        
        // 3. Check if we should return default data (development mode)
        if (this.useDefaultData) {
            console.log(`🔄 Using default data for ${procedureName} (USE_DEFAULT_DATA=true)`);
            
            const procedure = procedureCheck.procedure;
            const responseValidation = this.validateResponseData(procedureName, procedure.defaultData);
            
            const result = {
                success: true,
                data: procedure.defaultData,
                metadata: {
                    source: 'default_data',
                    procedure: procedureName,
                    description: procedure.description,
                    timestamp: new Date().toISOString(),
                    executionTime: Date.now() - startTime,
                    validation: {
                        input: { 
                            valid: true, 
                            appliedDefaults: jsonValidation.appliedDefaults || false 
                        },
                        response: responseValidation
                    }
                }
            };
            
            if (this.logProcedureCalls) {
                console.log(`✅ Procedure ${procedureName} completed with default data (${result.data.length} rows)`);
            }
            
            return result;
        }
        
        // 4. Actually call the database (production mode)
        let pool;
        try {
            if (!this.devMode) {
                pool = await sql.connect(this.config);
            } else {
                // In dev mode without default data, simulate delay
                await new Promise(resolve => setTimeout(resolve, 100));
                console.log(`🔧 DEV MODE: Simulating database call for ${procedureName}`);
            }
            
            const finalJsonData = typeof jsonValidation.data === 'object' 
                ? JSON.stringify(jsonValidation.data)
                : jsonValidation.data;
            
            let result;
            
            if (!this.devMode) {
                const request = pool.request();
                request.input('email', sql.NVarChar(255), email);
                request.input('jsonData', sql.NVarChar(sql.MAX), finalJsonData);
                
                result = await request.execute(procedureName);
            } else {
                // In dev mode, return empty result set
                result = { recordset: [] };
            }
            
            // 5. Validate response data
            const responseData = result.recordset || [];
            const responseValidation = this.validateResponseData(procedureName, responseData);
            
            // 6. Prepare result
            const executionTime = Date.now() - startTime;
            const successResult = {
                success: true,
                data: responseData,
                metadata: {
                    source: this.devMode ? 'simulated_database' : 'database',
                    procedure: procedureName,
                    executionTime: executionTime,
                    timestamp: new Date().toISOString(),
                    rowCount: responseData.length,
                    validation: {
                        input: { 
                            valid: true, 
                            appliedDefaults: jsonValidation.appliedDefaults || false 
                        },
                        response: responseValidation
                    }
                }
            };
            
            // 7. Log success
            if (this.logProcedureCalls) {
                console.log(`✅ Procedure ${procedureName} executed successfully`);
                console.log(`   ├─ Execution time: ${executionTime}ms`);
                console.log(`   ├─ Rows returned: ${responseData.length}`);
                console.log(`   └─ Source: ${successResult.metadata.source}`);
            }
            
            return successResult;
            
        } catch (error) {
            const executionTime = Date.now() - startTime;
            console.error(`❌ Database error in ${procedureName}:`, error.message);
            
            // Check if it's a permission error
            const errorMessage = error.message.toLowerCase();
            let userMessage = 'Database error occurred';
            let errorCode = 'DATABASE_ERROR';
            
            if (errorMessage.includes('permission') || errorMessage.includes('execute')) {
                userMessage = 'You do not have permission to execute this procedure';
                errorCode = 'PERMISSION_DENIED';
            } else if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
                userMessage = 'Requested procedure does not exist';
                errorCode = 'PROCEDURE_NOT_FOUND';
            } else if (errorMessage.includes('timeout') || errorMessage.includes('time out')) {
                userMessage = 'Database request timed out';
                errorCode = 'TIMEOUT_ERROR';
            } else if (errorMessage.includes('login') || errorMessage.includes('authentication')) {
                userMessage = 'Database authentication failed';
                errorCode = 'DB_AUTH_FAILED';
            }
            
            const errorResult = {
                success: false,
                error: userMessage,
                technicalError: this.devMode ? error.message : undefined,
                code: errorCode,
                validation: { stage: 'execution', failed: true },
                executionTime: executionTime
            };
            
            if (this.logProcedureCalls) {
                console.log(`❌ Procedure ${procedureName} failed: ${userMessage}`);
            }
            
            return errorResult;
        } finally {
            // Close connection if it was opened
            if (pool && !this.devMode) {
                try {
                    await pool.close();
                } catch (closeError) {
                    console.warn('⚠️ Failed to close database pool:', closeError.message);
                }
            }
        }
    }

    async testConnection() {
        if (this.devMode) {
            console.log('🔧 DEV MODE: Simulating database connection test');
            return true;
        }
        
        try {
            const pool = await sql.connect(this.config);
            const result = await pool.request().query('SELECT @@VERSION as version');
            await pool.close();
            
            const versionInfo = result.recordset[0].version;
            const serverName = versionInfo.split('\n')[0];
            
            console.log('✅ Database connection successful');
            console.log(`📊 Server: ${serverName.substring(0, 100)}...`);
            return true;
        } catch (error) {
            console.error('❌ Connection test failed:', error.message);
            
            // Provide helpful error messages
            if (error.message.includes('getaddrinfo')) {
                console.error('   → Check if the server IP/name is correct');
            } else if (error.message.includes('Login failed')) {
                console.error('   → Check username and password in .env file');
            } else if (error.message.includes('port')) {
                console.error('   → Check if port 1433 is open and SQL Server is running');
            }
            
            return false;
        }
    }

    getAvailableProcedures() {
        const procedures = this.procedureConfig.procedures;
        const available = {};
        
        for (const [name, config] of Object.entries(procedures)) {
            if (config.allowed) {
                available[name] = {
                    description: config.description,
                    schema: config.jsonSchema,
                    example: config.defaultData?.[0] || {},
                    hasDefaultData: !!config.defaultData,
                    responseSchema: config.responseSchema
                };
            }
        }
        
        return available;
    }

    validateEmailDomain(email) {
        const domains = this.procedureConfig.globalSettings?.allowedEmailDomains || [];
        if (domains.length === 0) return true;
        
        const domain = email.split('@')[1];
        return domains.includes(domain);
    }
}

module.exports = new DatabaseHelper();