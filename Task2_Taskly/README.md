# Taskly - Project Management Tool (CodeAlpha Task)

A collaborative Trello/Asana style tool: group projects, kanban boards, task assignment, comments inside tasks, notifications and real-time updates with WebSockets.

**Stack:** HTML, CSS, JavaScript, Node.js, Express, MongoDB (Mongoose), Socket.io, JWT auth

## Features
- Register / login (JWT, bcrypt)
- Create group projects, invite and remove members
- Kanban board with drag and drop (To do, In progress, In review, Done)
- Task cards with assignee, priority, label, due date and description
- Comments inside every task
- Notifications (assigned, commented, moved, invited)
- Real-time updates for everyone on a project (Socket.io)

## Run locally
1. Install Node.js and MongoDB
2. Copy `.env.example` to `.env` and set `JWT_SECRET`
3. `npm install`
4. `npm run dev`
5. Open http://localhost:5001

Demo data is created on first start. Log in with `ayesha_k@demo.com` / `password123`, or register a new account (new users automatically join the demo projects).
