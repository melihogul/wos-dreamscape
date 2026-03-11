# Whiteout Survival Dreamscape Memory Event Tool 🔴📡

This tool is a fun and interactive broadcasting platform where users can share their screens, and viewers can interact by placing real-time colorful dots on the shared screen.

## 🌟 Features

- **Real-Time Screen Sharing:** Fast communication with instant room connection using Socket.io.
- **Interactive Viewer Participation:** Viewers joining the room can place real-time dots by clicking anywhere on the screen.
- **Secure Rooms:** A password can be set when creating a room. Viewers need the Room ID and password to join.
- **Database Integration:** Rooms are saved to the database using PostgreSQL and Prisma, and IP addresses are logged for security purposes.
- **Modern Interface:** Powered by Next.js 15+ and React 19 with a sleek UI infrastructure.

## 🚀 Technologies

- **Frontend:** Next.js, React, CSS
- **Backend & Real-Time Communication:** Next.js Custom Server (`server.ts`), Socket.io
- **Database & ORM:** PostgreSQL, Prisma

## 📦 Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/melihogul/wos-memories.git
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables (`.env`):
   Create a `.env` file and add your PostgreSQL URL:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/database_name?schema=public"
   ```
4. Generate the database schema:
   ```bash
   npx prisma db push
   npx prisma generate
   ```
5. Start the project:

   ```bash
   npm run dev
   ```

   > Due to the Socket.io integration, the project runs with a custom `server.ts` file.

6. You can use the application by visiting [http://localhost:3000](http://localhost:3000) in your browser.
