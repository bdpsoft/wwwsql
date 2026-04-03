const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
    constructor() {
        this.transporter = null;
        this.initializeTransporter();
    }

    initializeTransporter() {
        try {
            this.transporter = nodemailer.createTransport({
                host: process.env.EMAIL_HOST || 'smtp.gmail.com',
                port: parseInt(process.env.EMAIL_PORT) || 587,
                secure: process.env.EMAIL_SECURE === 'true',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASSWORD
                },
                tls: {
                    rejectUnauthorized: false
                }
            });

            // Verify connection configuration
            this.transporter.verify((error, success) => {
                if (error) {
                    console.error('❌ Email transporter verification failed:', error.message);
                    console.log('   → Make sure EMAIL_USER and EMAIL_PASSWORD are set correctly in .env');
                    console.log('   → For Gmail, use an App Password: https://myaccount.google.com/apppasswords');
                } else {
                    console.log('✅ Email transporter ready');
                    console.log(`   ├─ Host: ${process.env.EMAIL_HOST}`);
                    console.log(`   ├─ Port: ${process.env.EMAIL_PORT}`);
                    console.log(`   └─ User: ${process.env.EMAIL_USER}`);
                }
            });
        } catch (error) {
            console.error('❌ Failed to initialize email transporter:', error.message);
            this.transporter = null;
        }
    }

    async sendAuthCode(email, code) {
        if (!this.transporter) {
            console.error('Email transporter not initialized');
            return { success: false, error: 'Email service not configured' };
        }

        try {
            const expiryMinutes = parseInt(process.env.CODE_EXPIRY_MINUTES) || 10;
            const appName = process.env.APP_NAME || 'Our Application';
            
            const mailOptions = {
                from: `"${appName}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
                to: email,
                subject: `Your ${appName} Authentication Code`,
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Authentication Code</title>
                        <style>
                            body {
                                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                line-height: 1.6;
                                color: #333;
                                max-width: 600px;
                                margin: 0 auto;
                                padding: 20px;
                            }
                            .header {
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                color: white;
                                padding: 30px;
                                text-align: center;
                                border-radius: 10px 10px 0 0;
                            }
                            .content {
                                background: #f8f9fa;
                                padding: 30px;
                                border-radius: 0 0 10px 10px;
                            }
                            .code-container {
                                background: white;
                                padding: 25px;
                                text-align: center;
                                border-radius: 8px;
                                margin: 25px 0;
                                border: 2px dashed #dee2e6;
                            }
                            .code {
                                font-size: 42px;
                                font-weight: bold;
                                letter-spacing: 10px;
                                color: #333;
                                font-family: monospace;
                            }
                            .expiry-note {
                                color: #6c757d;
                                font-size: 14px;
                                margin-top: 10px;
                            }
                            .footer {
                                margin-top: 30px;
                                padding-top: 20px;
                                border-top: 1px solid #dee2e6;
                                color: #6c757d;
                                font-size: 12px;
                                text-align: center;
                            }
                            .button {
                                display: inline-block;
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                color: white;
                                padding: 12px 30px;
                                text-decoration: none;
                                border-radius: 5px;
                                font-weight: bold;
                                margin: 20px 0;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h1>🔐 Your Authentication Code</h1>
                        </div>
                        
                        <div class="content">
                            <p>Hello,</p>
                            
                            <p>You requested an authentication code for your account at <strong>${appName}</strong>.</p>
                            
                            <div class="code-container">
                                <div class="code">${code}</div>
                                <div class="expiry-note">
                                    This code will expire in ${expiryMinutes} minutes
                                </div>
                            </div>
                            
                            <p>Enter this code on the verification page to complete your login.</p>
                            
                            <p>If you didn't request this code, please ignore this email. Your account remains secure.</p>
                            
                            <div class="footer">
                                <p>This is an automated message from ${appName}. Please do not reply to this email.</p>
                                <p>© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `,
                text: `
                    Your ${appName} Authentication Code
                    
                    Hello,
                    
                    You requested an authentication code for your account at ${appName}.
                    
                    Your code is: ${code}
                    
                    This code will expire in ${expiryMinutes} minutes.
                    
                    Enter this code on the verification page to complete your login.
                    
                    If you didn't request this code, please ignore this email. Your account remains secure.
                    
                    ---
                    This is an automated message from ${appName}. Please do not reply to this email.
                    © ${new Date().getFullYear()} ${appName}. All rights reserved.
                `
            };

            const info = await this.transporter.sendMail(mailOptions);
            
            if (process.env.LOG_PROCEDURE_CALLS === 'true') {
                console.log(`📧 Auth code email sent to ${email}`);
                console.log(`   ├─ Message ID: ${info.messageId}`);
                console.log(`   └─ Code: ${code}`);
            }
            
            return { 
                success: true, 
                messageId: info.messageId,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Email sending failed:', error.message);
            
            // Provide helpful error messages
            let errorMessage = 'Failed to send email';
            if (error.code === 'EAUTH') {
                errorMessage = 'Email authentication failed. Check your EMAIL_USER and EMAIL_PASSWORD in .env';
            } else if (error.code === 'ECONNECTION') {
                errorMessage = 'Cannot connect to email server. Check EMAIL_HOST and EMAIL_PORT in .env';
            }
            
            return { 
                success: false, 
                error: errorMessage,
                technicalError: error.message
            };
        }
    }

    async sendAuthLink(email, token) {
        if (!this.transporter) {
            console.error('Email transporter not initialized');
            return { success: false, error: 'Email service not configured' };
        }

        try {
            const expiryMinutes = parseInt(process.env.CODE_EXPIRY_MINUTES) || 10;
            const appName = process.env.APP_NAME || 'Our Application';
            const authLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/api/auth/verify/link?email=${encodeURIComponent(email)}&token=${token}`;
            
            const mailOptions = {
                from: `"${appName}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
                to: email,
                subject: `Your ${appName} Login Link`,
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Login Link</title>
                        <style>
                            body {
                                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                line-height: 1.6;
                                color: #333;
                                max-width: 600px;
                                margin: 0 auto;
                                padding: 20px;
                            }
                            .header {
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                color: white;
                                padding: 30px;
                                text-align: center;
                                border-radius: 10px 10px 0 0;
                            }
                            .content {
                                background: #f8f9fa;
                                padding: 30px;
                                border-radius: 0 0 10px 10px;
                            }
                            .button-container {
                                text-align: center;
                                margin: 30px 0;
                            }
                            .button {
                                display: inline-block;
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                color: white;
                                padding: 15px 40px;
                                text-decoration: none;
                                border-radius: 8px;
                                font-size: 18px;
                                font-weight: bold;
                                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                                transition: transform 0.2s, box-shadow 0.2s;
                            }
                            .button:hover {
                                transform: translateY(-2px);
                                box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
                            }
                            .link-container {
                                background: white;
                                padding: 20px;
                                border-radius: 8px;
                                margin: 20px 0;
                                word-break: break-all;
                                font-family: monospace;
                                font-size: 14px;
                                border: 1px dashed #dee2e6;
                            }
                            .expiry-note {
                                color: #6c757d;
                                font-size: 14px;
                                margin-top: 10px;
                                text-align: center;
                            }
                            .footer {
                                margin-top: 30px;
                                padding-top: 20px;
                                border-top: 1px solid #dee2e6;
                                color: #6c757d;
                                font-size: 12px;
                                text-align: center;
                            }
                            .security-note {
                                background: #fff3cd;
                                border: 1px solid #ffeaa7;
                                color: #856404;
                                padding: 15px;
                                border-radius: 5px;
                                margin: 20px 0;
                                font-size: 14px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            <h1>🔗 Your Login Link</h1>
                        </div>
                        
                        <div class="content">
                            <p>Hello,</p>
                            
                            <p>You requested a login link for your account at <strong>${appName}</strong>.</p>
                            
                            <div class="button-container">
                                <a href="${authLink}" class="button">
                                    Click to Login
                                </a>
                            </div>
                            
                            <div class="expiry-note">
                                This link will expire in ${expiryMinutes} minutes
                            </div>
                            
                            <p>Or copy and paste this link into your browser:</p>
                            
                            <div class="link-container">
                                ${authLink}
                            </div>
                            
                            <div class="security-note">
                                <strong>⚠️ Security Notice:</strong> If you didn't request this login link, please ignore this email. 
                                Your account remains secure and no action is required.
                            </div>
                            
                            <div class="footer">
                                <p>This is an automated message from ${appName}. Please do not reply to this email.</p>
                                <p>© ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `,
                text: `
                    Your ${appName} Login Link
                    
                    Hello,
                    
                    You requested a login link for your account at ${appName}.
                    
                    Click the link below to log in:
                    ${authLink}
                    
                    This link will expire in ${expiryMinutes} minutes.
                    
                    If you didn't request this login link, please ignore this email. 
                    Your account remains secure and no action is required.
                    
                    ---
                    This is an automated message from ${appName}. Please do not reply to this email.
                    © ${new Date().getFullYear()} ${appName}. All rights reserved.
                `
            };

            const info = await this.transporter.sendMail(mailOptions);
            
            if (process.env.LOG_PROCEDURE_CALLS === 'true') {
                console.log(`📧 Login link email sent to ${email}`);
                console.log(`   ├─ Message ID: ${info.messageId}`);
                console.log(`   └─ Link: ${authLink.substring(0, 50)}...`);
            }
            
            return { 
                success: true, 
                messageId: info.messageId,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Email sending failed:', error.message);
            
            let errorMessage = 'Failed to send email';
            if (error.code === 'EAUTH') {
                errorMessage = 'Email authentication failed. Check your email credentials in .env';
            }
            
            return { 
                success: false, 
                error: errorMessage,
                technicalError: error.message
            };
        }
    }

    async sendEmail(to, subject, html, text) {
        if (!this.transporter) {
            return { success: false, error: 'Email service not configured' };
        }

        try {
            const mailOptions = {
                from: `"${process.env.APP_NAME || 'Our Application'}" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
                to: to,
                subject: subject,
                html: html,
                text: text
            };

            const info = await this.transporter.sendMail(mailOptions);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('Email sending failed:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = new EmailService();