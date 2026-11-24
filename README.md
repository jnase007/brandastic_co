# Brandastic PM

A modern project management app for digital marketing agencies with monthly client hour buckets. Inspired by Monday.com but simpler than Jira.

![Brandastic PM](https://via.placeholder.com/800x400?text=Brandastic+PM)

## Features

- 🔐 **Authentication**: Email/password and Google OAuth via Supabase Auth
- 👥 **Role-based Access**: Team members (full access) and clients (view-only)
- 📊 **Client Hour Buckets**: Track monthly hours (20-60h) per client with progress visualization
- 📋 **Kanban Boards**: Drag-and-drop task management
- ⏱️ **Time Tracking**: Start/stop timer with manual entry support
- 📎 **Attachments**: File uploads linked to tickets
- 💬 **Comments**: Real-time discussion on tickets
- 🔔 **Real-time Updates**: Live collaboration via Supabase Realtime
- 🎫 **Sequential Ticket IDs**: Auto-generated IDs like "ACME-123"
- 🌓 **Dark Mode**: Beautiful light and dark themes
- 📱 **Responsive**: Works on desktop, tablet, and mobile

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS
- **UI Components**: Radix UI, Framer Motion
- **Backend**: Supabase (Auth, PostgreSQL, Storage, Realtime)
- **Drag & Drop**: @hello-pangea/dnd
- **Date Handling**: date-fns

## Quick Start

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free tier works)

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd brandastic-pm
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **Settings > API** and copy your Project URL and anon key
3. Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Initialize the Database

1. Go to **SQL Editor** in your Supabase dashboard
2. Run the contents of `supabase/schema.sql` to create tables, triggers, and RLS policies
3. Run `supabase/storage.sql` to set up storage buckets

### 4. Enable Google OAuth (Optional)

1. Go to **Authentication > Providers > Google** in Supabase
2. Enable Google auth and add your OAuth credentials
3. Add `http://localhost:5173` to allowed redirect URLs

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) to see the app.

## Project Structure

```
brandastic-pm/
├── public/
│   └── favicon.svg
├── scripts/
│   └── import.js          # Jira import script
├── src/
│   ├── components/
│   │   ├── ui/            # Reusable UI components (shadcn-style)
│   │   ├── Navbar.jsx
│   │   ├── TicketCard.jsx
│   │   ├── TimeTracker.jsx
│   │   └── LoadingScreen.jsx
│   ├── contexts/
│   │   └── AuthContext.jsx
│   ├── hooks/
│   │   ├── useRealtime.js
│   │   └── useToast.js
│   ├── lib/
│   │   ├── supabase.js    # Supabase client & helpers
│   │   └── utils.js
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Boards.jsx
│   │   ├── BoardDetail.jsx
│   │   ├── TicketDetail.jsx
│   │   ├── ClientPortal.jsx
│   │   └── Settings.jsx
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── supabase/
│   ├── schema.sql         # Database schema
│   └── storage.sql        # Storage bucket config
├── package.json
├── tailwind.config.js
├── vite.config.js
└── README.md
```

## Database Schema

### Tables

| Table | Description |
|-------|-------------|
| `profiles` | User profiles extending Supabase auth |
| `clients` | Client organizations with monthly hour budgets |
| `boards` | Projects/boards per client |
| `tickets` | Individual tasks/tickets |
| `comments` | Comments on tickets |
| `time_entries` | Time tracking entries |
| `ticket_counters` | Sequential ID generation |

### Views

- `client_hours_summary` - Aggregated hours used/remaining per client

## Importing from Jira

Export your Jira issues as CSV or JSON, then run:

```bash
node scripts/import.js ./jira-export.csv <board-id> <client-id>
```

The script will:
- Parse CSV/JSON exports
- Map Jira status to todo/inprogress/done
- Map Jira priority to low/medium/high/urgent
- Import all issues as tickets

## Deployment to Netlify

### Via Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Build and deploy
npm run build
netlify deploy --prod
```

### Via Git Integration

1. Push your code to GitHub/GitLab
2. Connect your repo in Netlify dashboard
3. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
4. Add environment variables in Netlify:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

### Netlify Configuration

Create `netlify.toml` in the project root:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key for client-side |
| `SUPABASE_SERVICE_ROLE_KEY` | (Server-side only) For admin operations |

## Customization

### Branding Colors

Edit `tailwind.config.js` to change brand colors:

```js
colors: {
  brand: {
    coral: "#FF6B6B",   // Primary accent
    teal: "#4ECDC4",    // Secondary accent
    navy: "#1A1A2E",    // Dark backgrounds
    gold: "#FFD93D",    // Highlights
    purple: "#6C5CE7",  // Alternative accent
  }
}
```

### Fonts

The app uses:
- **Syne** - Display headings
- **DM Sans** - Body text
- **JetBrains Mono** - Code/ticket IDs

Update `index.html` to change fonts.

## Company Announcements

The page at `/announcements` lists birthdays, work anniversaries, and company holidays for the next 30 days.

Run `supabase/announcements.sql` once in the Supabase SQL editor. It adds birthday, start date, and an announce flag to `labor_rates`, and creates `company_holidays`.

Run `supabase/holidays-recurring.sql` once after that. It lets each company holiday repeat every year. Safe to run again.

## QuickBooks receivables refresh

The billing page reads receivables from a private snapshot. Subscriptions are separate and still come only from `BILLING_SUBSCRIPTIONS_JSON`. Nothing here deletes that variable or `BILLING_CLIENTS_JSON`. `BILLING_CLIENTS_JSON` remains the fallback when no QuickBooks snapshot has been saved.

The snapshot and the rotating refresh token are stored in Supabase, which this app already uses. They are not stored in Vercel Blob or an env var. Two new tables (`qbo_billing_store` and `qbo_oauth_state`) are created by `supabase/qbo-billing-store.sql`. Row level security is on and the browser roles have no access. The server uses the service role key and encrypts tokens and snapshots with AES-256-GCM before writing them. Production data uses the `production` row. Preview and local development can use only the `sandbox` row and the Intuit sandbox API, even if production credentials exist in the same database.

There is no schedule. An allowlisted person opens `/billing` and chooses Refresh from QuickBooks.

### What to set up

1. In the Supabase SQL editor, run `supabase/qbo-billing-store.sql` once. It only adds the two tables above.
2. Create an app at the Intuit developer site. Add the accounting scope. Under Keys and credentials, copy the client id and client secret. Use the development keys for a sandbox company. Use production keys only after Intuit has enabled production for that app, and only in the Vercel production environment.
3. Register redirect URIs on that Intuit app, exactly:
   - Production: `https://brandastic.co/api/qbo/callback`
   - Sandbox / preview: `https://<preview-host>/api/qbo/callback`
   - Local: `http://localhost:5173/api/qbo/callback`
4. Create a 32-byte encryption key locally with `openssl rand -base64 32`. Do not commit it.
5. Set these environment variable names. Do not prefix the secrets with `VITE_`. Put the live Intuit keys and the live encryption key on production only. Put the sandbox Intuit keys on preview if you want to connect a sandbox company there.
   - `QBO_CLIENT_ID`
   - `QBO_CLIENT_SECRET`
   - `QBO_REDIRECT_URI`
   - `QBO_TOKEN_ENCRYPTION_KEY`
   - `QBO_ENVIRONMENT` optional. Set the value to `sandbox` to force the sandbox API in production. Preview and local always use the sandbox API.
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_URL` or the existing `VITE_SUPABASE_URL`
   - `BILLING_ALLOWED_EMAILS` (already required; exactly two login emails)
6. Redeploy so the functions can see the new variables. Open `/billing` as one of the two allowlisted people, choose Reconnect, approve the Intuit company, then choose Refresh from QuickBooks.

A disconnected company or an expired refresh token stays on the last snapshot, or on `BILLING_CLIENTS_JSON` if no snapshot has been saved. The page shows Reconnect. Days since last payment are calculated when the page is read, from the stored payment date.

A customer is treated as recurring when invoices fall in at least three of the last twelve months. Everyone else with an open balance is listed as non-recurring or not-yet-due. The refresh looks back five years for the last payment. Subscriptions are not part of this refresh.

## License

MIT License - feel free to use for your own projects!

## Support

For questions or issues, please open a GitHub issue.

---

Built with ❤️ for digital marketing agencies
