Here’s a practical project brief you can hand to a new Codex task to rebuild this from the start in SvelteKit.

**Project Overview**

Build a SvelteKit dashboard for Queerlective’s CoLab member portal and admin tools.

CoLab is a shared community studio for artists, creators, and organizers. Members pay monthly dues and use the dashboard to manage studio participation. Admins use the dashboard to review projects, events, shifts, member activity, and community votes.

The app should deploy to Cloudflare Workers using the SvelteKit Cloudflare adapter. Data currently comes from Monday.com, with selected data being synced into Cloudflare D1 for faster reads and eventual migration away from Monday.

**Recommended Stack**

- SvelteKit
- `@sveltejs/adapter-cloudflare`
- Cloudflare Workers
- Cloudflare D1
- Cloudflare Email Service for magic-link login
- Monday GraphQL API
- TypeScript recommended
- Server-side SvelteKit routes for API/data access
- Svelte stores or load functions for session/member state

**Core Product Areas**

Member portal:
- Magic-link login
- Only allow login if email matches a member in Monday’s CoLab Members board
- Member dashboard overview
- View membership type
- Sign up for CoLab shifts
- View calendar
- Vote on community decisions
- View member activity summary
- View payment history
- View open Shopify orders, except for Retail Only Members
- View member resources and submit event link

Admin tools:
- Admin-only “view as member” tool
- Admin project management tab
- Review upcoming project/event records
- Filter by source, status, search
- Open full detail pages for projects/events
- Sync project/event records from Monday into D1
- Admin-only calendar visibility for private internal events

**Auth Requirements**

Use magic-link login, not Cloudflare Zero Trust.

Flow:
- Logged-out users see a splash/login page only.
- Dashboard shell should not show before authentication.
- User enters member email.
- Server checks Monday CoLab Members board for matching primary email or “Other Emails”.
- If match exists, create D1 magic login token.
- Send link using Cloudflare Email Service.
- Link verifies token, creates D1 session cookie.
- Session cookie is `HttpOnly`, `Secure`, `SameSite=Lax`.
- Non-admins can only view their own dashboard.
- Admins can use “view as member”.

D1 auth tables:
```sql
CREATE TABLE magic_login_tokens (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE magic_sessions (
  session_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  member_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Cloudflare Bindings**

Use these bindings:
- `DB`: D1 database
- `MONDAY_API_TOKEN`: Cloudflare Secrets Store secret binding
- `EMAIL`: Cloudflare Email Service binding
- `LOGIN_FROM_EMAIL`: environment variable
- `LOGIN_FROM_NAME`: environment variable

Important secret behavior:
- `MONDAY_API_TOKEN` may be either a classic string secret or a Secrets Store binding with `.get()`.
- Always support both:

```js
async function mondayToken(env) {
  const binding = env.MONDAY_API_TOKEN;
  if (typeof binding === "string") return binding;
  if (binding && typeof binding.get === "function") return binding.get();
  return "";
}
```

**Monday Boards And Columns**

CoLab Calendar board:
- Board ID: `8374554428`
- Parent items are months
- Subitems are shifts
- Shift date: `date0`
- Shift Member ID: `text_mm35f0vb`
- Shift Person: `text_mm4vxh9t`
- Coverage Status: `color_mkw122gj`

Shift rules:
- Weekdays: `6pm-8pm`
- Sundays: `2pm-4pm`
- Filled shifts should appear on calendar.
- Open shifts should appear in Available Shifts.
- On signup, update Monday:
  - `text_mm4vxh9t`: `First L. | member id`
  - `text_mm35f0vb`: member id
  - `color_mkw122gj`: Covered
- Also update D1 immediately.

CoLab Members board:
- Board ID: `8402413272`
- Preferred Name: `text_mm35brvq`
- Membership Type: `color_mkw1xfh2`
- Email: `email_mkmvg87g`
- Phone Number: `phone_mknqvkap`
- Business Name: `text_mkmv5bft`
- Website: `text_mkmv5n45`
- Social Media: `text_mkmvj6ks`
- Creative Ground Link: `text_mkq03vne`
- Artist Description: `long_text_mkmv2eh9`
- Artist Photo/Logo: `files_mkmv5d0k`
- Artist Profile Banner: `file_mkqx9xa3`
- Sign Up Date: `date_1_mkmvqa90`
- Member ID: `pulse_id_mm34sv67`
- Other Emails: `text_mm358g6e`

Membership logic:
- `Admin` membership type can see admin tools and view-as dropdown.
- `Retail Only Member` should not see:
  - Available shifts
  - Next shift info
  - Open Shopify orders
  - Community-led event submissions on calendar

Activity/Feedback Board:
- Board ID: `18408298018`
- Activity Type: `single_selectis1ajb9`
- Submit Date: `date_mm2mqnq2`
- Activity Description: `long_text3mhw34i5`
- Person: `text_mm34jrzj`
- Parse member id from Person text, example:
  - `Randall N. | Member ID: 12069306477`
- Do not use `tag_mm35xrcy`.
- Vote motions also live on this board when Activity Type is:
  - `Super Majority Vote`
  - `Consent Vote`
  - `Simple Majority Vote`
- Vote details use `long_text3mhw34i5`.

Vote Log board:
- Board ID: `18411164142`
- Vote response: `color_mm4vbrwr`
- Comment: `long_texta8lzlxn7`
- Question/motion: `text_mm4vp4ny`
- Person: item name should be `First L. | Member ID: memberid`
- Member ID alone: `text_mm4vff42`
- Vote ID: `text_mm4ve8bt`
- Only allow one vote per member per vote question.
- Check duplicates by member ID plus Vote ID, falling back to question text if needed.
- Consent votes auto-approve after 48 days unless someone votes `Don't Approve(With Comment)`.

Shopify Transaction Tracker:
- Board ID: `18410480642`
- Amount: `numeric_mm2fgrdz`
- Details: `text_mm2fb4c7`
- Email: `text_mm2f5770`
- Fulfillment Status: `color_mm4wf14k`
- Order Date: `pulse_log_mm4jc9jv`

Payment history:
- Show only transactions where Details contains `CoLab Membership Subscription`.
- Match by member email.

Open orders:
- Show to everyone except Retail Only Members.
- Show only orders where fulfillment status is `Unfulfilled`.
- Do not show `CoLab Membership Subscription`.
- Show item name, details, order date, status pill.
- Include fulfillment link:
  - `https://admin.shopify.com/store/queerlective/orders`

Project/Event Management Board:
- Board ID: `8390893779`
- Owner: `person`
- Strategic Goal: `dropdown_mm0smk1`
- Category: `color_mm0srja3`
- Priority: `color_mm0sh4fe`
- Event Start Date: `date_mkns6cak`
- Event End Date: `date_mm171v9p`
- Status: `status`
- Location: `dropdown_mknqezw8`
- Posters: `file_mknscbex`
- Files/Link: `file_mkpbye8s`
- Registration: `link_mkppdhq5`
- Post Event Survey: `link_mkpp7m53`
- Event Description: `text_mm2vbpn3`
- Google Calendar Event: `integration_mm17v8nx`
- Space Reservation: `color_mm2vwpkb`
- Include Monday updates.

Calendar visibility:
- Admins can see all project/event board records.
- Non-admin CoLab members can see only project board events where Location contains:
  - `Board Room`
  - `CoLab`
  - `Community Room`
  - `Gym`

Community Led Event Submissions:
- Board ID: `8052311890`
- Poster: `upload_file_Mjj7BNI5`
- Links: `link_mm345aqv`
- Project Lead/Organizer: `short_text_Mjj7ibQU`
- Project Lead Email: `email_mkp6jep`
- Additional Organizers: `short_text_Mjj7sypL`
- Project Description: `long_text_Mjj74ax2`
- Tool Equipment Requests: `long_text_Mjj7yY69`
- Requested Support Amount: `number_Mjj7dbxa`
- Details of Use of Support Funds: `long_text_mkmt1fs8`
- Requested Event Date: `date_Mjj7b71V`
- Canva Link: `link_mkn89n3g`
- Additional Info: `long_text_1_Mjj7QGiT`
- Space Requested: `multi_selectgtgkuzvw`
- Process Status: `status_mkmxzk3x`
- Item ID: `pulse_id_mm2twrhw`
- Creation Log: `pulse_log_mm4wyjyr`

Community-led event rules:
- Appear on calendars for all members.
- Link organizer email to CoLab Members if there is a match.
- Calendar should reflect pending/approved status.
- Community-led submissions follow consent vote process.
- Only show submissions for vote if submitted within the past 7 days.
- Only show for vote if Space Requested contains `Queerlective's CoLab Space`.
- Include submit event link:
  - `https://wkf.ms/4aSHDGu`

**D1 Migration Plan**

Start with these D1 tables:

`colab_shifts`
```sql
CREATE TABLE colab_shifts (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL DEFAULT '',
  parent_id TEXT NOT NULL DEFAULT '',
  month TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  date_label TEXT NOT NULL DEFAULT '',
  date_value TEXT NOT NULL DEFAULT '',
  time_label TEXT NOT NULL DEFAULT '',
  member_id TEXT NOT NULL DEFAULT '',
  person TEXT NOT NULL DEFAULT '',
  covered_by TEXT NOT NULL DEFAULT '',
  coverage_status TEXT NOT NULL DEFAULT 'Open',
  is_covered INTEGER NOT NULL DEFAULT 0,
  tags_json TEXT NOT NULL DEFAULT '[]',
  synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

`project_event_records`
```sql
CREATE TABLE project_event_records (
  id TEXT NOT NULL,
  source TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  date_value TEXT NOT NULL DEFAULT '',
  end_date_value TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  admin_only INTEGER NOT NULL DEFAULT 0,
  record_json TEXT NOT NULL,
  synced_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (source, id)
);
```

Use JSON storage for full normalized project/event records at first. This keeps the sync flexible while the admin tool is still evolving.

**Important API Routes To Build**

Session/auth:
- `GET /api/session`
- `POST /api/auth/request`
- `GET /api/auth/verify`
- `GET /api/auth/logout`

Member:
- `GET /api/members`
- `GET /api/member`

Dashboard:
- `GET /api/shifts`
- `POST /api/shifts/signup`
- `GET /api/events`
- `GET /api/activity`
- `GET /api/votes`
- `POST /api/votes`
- `GET /api/payments`
- `GET /api/orders`

Admin:
- `GET /api/admin/projects`
- `GET /api/admin/projects/detail`
- `POST /api/admin/sync/shifts`
- `POST /api/admin/sync/projects`

**SvelteKit Route Structure**

Suggested file layout:

```text
src/
  lib/
    server/
      monday.ts
      auth.ts
      members.ts
      shifts.ts
      events.ts
      votes.ts
      payments.ts
      orders.ts
      d1.ts
    components/
      DashboardShell.svelte
      LoginSplash.svelte
      Calendar.svelte
      ShiftList.svelte
      VoteList.svelte
      ActivitySummary.svelte
      PaymentHistory.svelte
      OpenOrders.svelte
      ProjectCard.svelte
      ResourceGrid.svelte
    stores/
      session.ts
  routes/
    +layout.server.ts
    +layout.svelte
    +page.server.ts
    +page.svelte
    admin/
      projects/
        +page.server.ts
        +page.svelte
        [source]/
          [id]/
            +page.server.ts
            +page.svelte
    api/
      session/+server.ts
      auth/request/+server.ts
      auth/verify/+server.ts
      auth/logout/+server.ts
      shifts/+server.ts
      shifts/signup/+server.ts
      events/+server.ts
      activity/+server.ts
      votes/+server.ts
      payments/+server.ts
      orders/+server.ts
      admin/projects/+server.ts
      admin/projects/detail/+server.ts
      admin/sync/shifts/+server.ts
      admin/sync/projects/+server.ts
```

**UI Requirements**

- First screen should be splash/login when logged out.
- Do not show empty dashboard structure before auth/data load.
- Dashboard should feel like a practical operations portal, not a marketing page.
- Calendar should look like a monthly calendar.
- Available shifts full width.
- Calendar full width.
- Announcements/votes full width.
- Activity log full width.
- Slightly colorful, but still clean and usable.
- Use colored pills for:
  - Fulfillment status
  - Vote response
  - Activity types
  - Project statuses/categories/priorities
- Calendar events should be clickable and open details where available.
- Project previews should include thumbnail if poster/file image exists.

**Member Resources**

Resources section:
- `CoLab Inventory`: `https://queerlective.com/pages/colab-inventory`
- `CoLab Guidelines`: `https://docs.google.com/document/d/1y2HjvNbVYdjXcpQjcL64vohjYI5RhZtB-X6oLXYqPr8/edit?usp=sharing`
- Questions text:
  - `Reach out to Randall@queerlective.com or awheeler@queerlective.com.`
- Submit event:
  - `https://wkf.ms/4aSHDGu`

**Visual Asset**

Use this CoLab studio banner:
- Existing file in current project likely should become:
  - `/public/assets/colab-studio-banner.jpg`
- Original source:
  - `/Users/randallnielsen/Downloads/IMG_0041.JPG`

**Deployment**

Use Cloudflare Workers, not static-only hosting.

Install:
```bash
npm create svelte@latest queerlective-dashboard-sveltekit
npm install
npm install -D @sveltejs/adapter-cloudflare wrangler
```

Use Cloudflare adapter in `svelte.config.js`.

Wrangler needs:
- D1 binding
- Email binding
- Secrets Store binding for Monday token
- Assets/output handled by SvelteKit Cloudflare adapter

**High-Level Build Goal**

The first SvelteKit milestone should recreate the current app feature-for-feature, but with proper Svelte components and server load functions:

1. Magic-link splash login
2. Member dashboard overview
3. D1-backed shifts
4. Monthly Svelte calendar with filled shifts and events
5. Community votes
6. Activity summary
7. Payment history
8. Open Shopify orders
9. Admin project management
10. D1 sync for shifts and project/event records

Once that parity is stable, the next phase can begin moving more Monday data into D1 and adding admin write/edit tools.