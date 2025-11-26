# Invy - Invoice Management System

Automated invoice processing system that monitors Gmail accounts for PDF invoices, validates them using AI, and provides a centralized dashboard for tracking.

## Features

- 🔐 Multi-user authentication (Email/Password + Google OAuth)
- 📧 Automatic Gmail monitoring for invoice PDFs
- 📁 Organized Google Drive storage
- 🤖 AI-powered invoice validation via n8n
- 📊 Real-time dashboard with invoice tracking
- 🔄 Background job processing (every 5 minutes)
- 👥 Multiple Gmail account support per user

## Tech Stack

**Backend:**
- Node.js + Express
- Supabase (Database & Auth)
- Gmail API + Google Drive API
- JWT Authentication
- node-cron (Background Jobs)

**Frontend:**
- React
- Material-UI
- Axios
- React Router

**External Services:**
- Supabase
- Gmail API
- Google Drive API
- n8n Webhook

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm
- Supabase account
- Google Cloud Project (OAuth credentials)
- n8n webhook URL

### Backend Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   cd invy
   npm install
   ```

3. Create `.env` file with:
   ```
   PORT=3001
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   JWT_SECRET=your_jwt_secret
   WEBHOOK_URL=your_n8n_webhook_url
   EMAIL_USER=your_gmail@gmail.com
   EMAIL_APP_PASSWORD=your_app_password
   ```

4. Add `credentials.json` from Google Cloud Console

5. Start server:
   ```bash
   npm start
   ```

### Frontend Setup

1. Navigate to frontend:
   ```bash
   cd invy-frontend
   npm install
   ```

2. Create `.env` file with:
   ```
   REACT_APP_API_URL=http://localhost:3001
   ```

3. Start development server:
   ```bash
   npm start
   ```

## Project Structure

```
invy/
├── server.js                 # Entry point
├── src/
│   ├── app.js               # Express setup
│   ├── config/              # Configuration
│   ├── controllers/         # Request handlers
│   ├── middleware/          # Auth & logging
│   ├── routes/              # API routes
│   ├── services/            # Business logic
│   ├── jobs/                # Background tasks
│   └── utils/               # Helper functions
├── data/                    # Processed email history
└── credentials.json         # Google OAuth (not in Git)

invy-frontend/
├── src/
│   ├── components/          # React components
│   ├── services/            # API services
│   └── hooks/               # Custom hooks
└── public/
```

## License

Private project - All rights reserved

## Contact

Naman - [Your Email]
