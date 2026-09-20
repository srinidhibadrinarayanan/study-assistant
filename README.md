# AI Study Assistant

A full-stack web app where students enter a topic and get an AI-generated explanation, study notes, a quiz, or a personalized study plan at their chosen difficulty. Chats are saved per user.

**Live demo:** https://study-assistant-rose.vercel.app
**Demo video:** PASTE_YOUR_VIDEO_LINK

## Features
- User registration and login (Supabase Auth)
- Four AI modes: Explain, Notes, Quiz (MCQs with answer key), Study Plan
- Difficulty selection: Beginner, Intermediate, Advanced
- Multiple saved conversations with a sidebar; delete any chat
- Chat history and generated content stored in a database
- Loading states, friendly error messages, and a Retry button
- Automatic retry and fallback model when the AI is busy
- Export any answer (notes, quiz, study plan) as a downloadable file
- Responsive layout with a slide-in sidebar on mobile
- API keys kept on the server in environment variables

## Tech Stack
- Next.js (App Router) and React
- Tailwind CSS with react-markdown for formatting AI answers
- Next.js API route as the backend
- Supabase (Auth and Postgres with row-level security)
- Google Gemini API
- Deployed on Vercel

## How It Works
1. The user logs in through Supabase Auth.
2. The frontend sends the topic, mode, and difficulty to `/api/chat`.
3. The backend builds a prompt for that mode and calls the Gemini API. The API key never reaches the browser.
4. The answer is shown and saved to the `messages` table, linked to a row in `conversations`.
5. Row-level security means each user can only see their own data.

## Run Locally
1. Clone the repo and install packages:
```
   git clone https://github.com/srinidhibadrinarayanan/study-assistant.git
   cd study-assistant
   npm install
```
2. Create a Supabase project and run this in its SQL Editor:
```sql
   create table conversations (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
     title text not null,
     created_at timestamptz not null default now()
   );
   create table messages (
     id uuid primary key default gen_random_uuid(),
     conversation_id uuid not null references conversations(id) on delete cascade,
     user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
     role text not null,
     mode text,
     level text,
     content text not null,
     created_at timestamptz not null default now()
   );
   alter table conversations enable row level security;
   alter table messages enable row level security;
   create policy "own conversations" on conversations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
   create policy "own messages" on messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```
3. Create a file named `.env.local` in the project root:
```
   GEMINI_API_KEY=your_gemini_key
   GEMINI_MODEL=gemini-3.6-flash
   GEMINI_FALLBACK_MODEL=gemini-2.5-flash
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_publishable_key
```
4. Start the app:
```
   npm run dev
```
   Open http://localhost:3000

## Screenshots
Add screenshots here.

## Author
Srinidhi
