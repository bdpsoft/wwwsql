# Email Authentication Application with SQL Server Integration

A complete Node.js application featuring email-based authentication (6-digit code or magic link) and SQL Server stored procedure execution with advanced JSON validation.

## 🌟 Features

- **Dual Authentication**: Choose between 6-digit code or magic link sent via email
- **SQL Server Integration**: Secure connection with stored procedure execution
- **JSON Schema Validation**: Advanced validation for procedure parameters and responses
- **Development Mode**: Work without database access using default data
- **Modern Frontend**: Responsive, mobile-friendly interface
- **Session Management**: Secure session-based authentication
- **Procedure Testing UI**: Built-in interface for testing procedures
- **Comprehensive Logging**: Detailed logs for debugging and monitoring

## 🛠 Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MS SQL Server
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Email**: Nodemailer with HTML templates
- **Validation**: AJV JSON Schema validation
- **Security**: bcrypt, express-session, CORS protection
- **Styling**: Custom CSS with gradients and animations

## 📋 Prerequisites

- Node.js (v14 or higher)
- MS SQL Server (2012 or higher)
- Email service (Gmail recommended for testing)
- Port 3000 available

## 🚀 Quick Start

### 1. Installation

```bash
# Clone or extract the project
cd email-auth-app

# Install dependencies
npm install

## Config
```bash

# Copy environment template
cp .env.example .env

# Edit .env with your settings
nano .env

3. Email Setup (Gmail)

    Enable 2-Step Verification in Google Account

    Generate App Password: https://myaccount.google.com/apppasswords

    Use the 16-character password as EMAIL_PASSWORD

4. Database Setup

Ensure your SQL Server:

    Is accessible from your application server

    Has a database named in .env

    User has execute permissions on procedures

    Procedures accept: (email NVARCHAR(255), jsonData NVARCHAR(MAX))

5. Running the Application
bash

# Development mode (with hot reload)
npm run dev

# Production mode
npm start

Visit: http://localhost:3000
🔧 Configuration Details
Environment Variables (.env)
env

# Database
DB_CONNECTION_STRING=Server=IP,1433;Database=Name;User Id=user;Password=pass;

# Email (Gmail Example)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@yourapp.com

# Security
SESSION_SECRET=your-secret-key-change-this

# App Settings
PORT=3000
FRONTEND_URL=http://localhost:3000
CODE_EXPIRY_MINUTES=10

# Development
DEV_MODE=false
USE_DEFAULT_DATA=false
VALIDATE_JSON=true
LOG_PROCEDURE_CALLS=true

Procedure Configuration

Edit config/procedures.json to:

    Add new procedures

    Define JSON schemas for validation

    Set default response data

    Control access permissions

📖 Usage Guide
1. Authentication Flow

    Enter Email: User enters email on homepage

    Choose Method: Select "Send Code" or "Send Magic Link"

    Verify: Enter 6-digit code or click email link

    Access Dashboard: Upon successful authentication

2. Testing Procedures

    Navigate to Procedures: Click "Database Procedures" in dashboard

    Select Procedure: Choose from available procedures

    Enter JSON: Provide input parameters (or use defaults)

    Validate/Execute: Test JSON or execute procedure

    View Results: See formatted response data

3. Development Mode

Set in .env:
env

DEV_MODE=true
USE_DEFAULT_DATA=true

Benefits:

    No database connection required

    Uses default data from configuration

    Perfect for development and testing

    Full validation still applies

🎯 API Reference
Authentication Endpoints
Method	Endpoint	Description
POST	/api/auth/initiate	Send auth code/link
POST	/api/auth/verify/code	Verify 6-digit code
GET	/api/auth/verify/link	Verify magic link
GET	/api/auth/session	Check session
POST	/api/auth/logout	Logout
Procedure Endpoints
Method	Endpoint	Description
POST	/api/procedure/:name	Execute procedure
GET	/api/procedures	List procedures
POST	/api/validate/:name	Validate JSON input
GET	/api/test/:name	Test procedure
System Endpoints
Method	Endpoint	Description
GET	/api/health	Health check
GET	/api/system/status	System status
🔐 Security Features

    Rate Limiting: Prevents email spam

    Session Security: HttpOnly, Secure cookies

    Input Validation: JSON schema validation

    SQL Injection Protection: Parameterized queries

    Email Verification: Rate-limited attempts

    CORS Protection: Configurable origins

🐛 Troubleshooting
Common Issues

    Database Connection Failed
    bash

    # Check SQL Server is running
    # Verify credentials in .env
    # Test port 1433 connectivity

    Emails Not Sending
    bash

    # Verify Gmail app password
    # Check spam folder
    # Review console logs

    Procedure Execution Errors
    bash

    # Check user permissions
    # Verify procedure exists
    # Validate JSON input format

Logs

The application logs to console with detailed information:

    Database connection status

    Email sending attempts

    Authentication events

    Procedure executions

    Validation errors


🚀 Deployment
Production Recommendations

    Environment Variables

        Set NODE_ENV=production

        Use strong SESSION_SECRET

        Configure production database

        Set up production email service

    Process Management
    bash

    # Using PM2
    npm install -g pm2
    pm2 start server.js --name email-auth
    pm2 save
    pm2 startup

    Reverse Proxy (Nginx)
    nginx

    server {
        listen 80;
        server_name yourdomain.com;
        
        location / {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }

Docker Deployment

Create Dockerfile:
dockerfile

FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]

Build and run:
bash

docker build -t email-auth-app .
docker run -p 3000:3000 --env-file .env email-auth-app

🔮 Future Enhancements

Planned features:

    Two-factor authentication

    Audit logging database

    API rate limiting

    Swagger/OpenAPI documentation

    User management interface

    Procedure versioning

    Response caching

    WebSocket notifications

🤝 Contributing

    Fork the repository

    Create feature branch

    Commit changes

    Push to branch

    Open Pull Request

📄 License

MIT License - see LICENSE file for details
🆘 Support

For issues:

    Check troubleshooting section

    Review console logs

    Verify environment variables

    Check database connectivity