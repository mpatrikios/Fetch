# Fetch

## Prerequisites
- Python 3.13+
- Node.js 18+
- MongoDB connection string

## Environment Setup

Create a `.env` file in the project root with the following variables:

```
MONGODB_URL=<mongodb-connection-string>
AZURE_CONTENT_UNDERSTANDING_SUBSCRIPTION_KEY=<key>
AZURE_OPENAI_API_KEY=<key>
AZURE_OPENAI_BASE_URL=<url>
AZURE_OPENAI_EXPLANATION_BASE_URL=<url>
JWT_SECRET_KEY=<secret>
VITE_CALENDLY_INTAKE_URL=<url>
VITE_CALENDLY_FOLLOWUP_URL=<url>
```

## Quick Start

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Frontend
```bash
cd frontend
npm install
```

### Run Both Servers
```bash
cd frontend
npm run start
```

This starts both servers concurrently:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Testing

### Backend unit + API tests (no running server required)
```bash
cd backend
./venv/bin/python -m pytest tests/unit/ tests/api/ -v
```

### E2E tests (requires both servers running)
```bash
# In one terminal
cd frontend && npm run start

# In another terminal
cd frontend && npm run test:e2e
```

Set `E2E_EMAIL` and `E2E_PASSWORD` environment variables to enable auth and matching tests.
