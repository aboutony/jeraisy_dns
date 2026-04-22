# Jeraisy DNS Backend

Node.js/Express API server for Jeraisy DNS platform.

## Setup

1. Install dependencies: `npm install`
2. Create `.env` file with database URL
3. Run: `npm start`

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string from Supabase
- `PORT`: Server port (default 3000)
- `JWT_SECRET`: For authentication (to be added later)