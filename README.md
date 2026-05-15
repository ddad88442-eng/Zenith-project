# Zenith Task Manager — Full Stack

A polished SaaS-style productivity app with a Node.js/Express/MongoDB backend and animated frontend.

---

## 📁 Project Structure

```
project/
├── backend/          ← Node.js + Express + MongoDB API
│   ├── server.js
│   ├── package.json
│   ├── .env
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── utils/
│   ├── validations/
│   ├── uploads/      ← avatar images stored here
│   └── logs/
└── frontend/         ← HTML + CSS + JS (no build step)
    ├── index.html
    ├── style.css
    └── script.js
```

---

## ⚙️ Prerequisites

- **Node.js** v18+ — https://nodejs.org
- **MongoDB** running locally on port 27017
  - Install: https://www.mongodb.com/docs/manual/installation/
  - Or use MongoDB Atlas (update `MONGO_URI` in `.env`)

---

## 🚀 Quick Start

### 1. Start MongoDB

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Linux (systemd)
sudo systemctl start mongod

# Windows
net start MongoDB
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Configure environment

The `.env` file is already pre-configured for local development:

```env
PORT=8080
MONGO_URI=mongodb://127.0.0.1:27017/zenith
JWT_SECRET=supersecretkey_change_in_production
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

> ⚠️ Change `JWT_SECRET` to a long random string before deploying to production.

### 4. Start the backend

```bash
# Development mode (auto-restart on file changes)
npm run dev

# Production mode
npm start
```

You should see:
```
[INFO]: MongoDB Connected: 127.0.0.1
[INFO]: 🚀 Zenith API running on http://localhost:8080
```

### 5. Open the frontend

Open `frontend/index.html` directly in your browser. No build step needed.

> If you see CORS errors, make sure the backend is running on port 8080.

---

## 🔌 API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| GET  | `/api/auth/me` | Get current user |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/users/profile` | Get profile |
| PUT  | `/api/users/profile` | Update profile + avatar |

### Tasks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/tasks` | List tasks (filter, search, paginate) |
| POST   | `/api/tasks` | Create task |
| PUT    | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |
| PATCH  | `/api/tasks/:id/toggle` | Toggle complete |
| PATCH  | `/api/tasks/reorder` | Reorder (drag & drop) |

### Notes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/notes` | List notes |
| POST   | `/api/notes` | Create note |
| PUT    | `/api/notes/:id` | Update note |
| DELETE | `/api/notes/:id` | Delete note |

### Sessions (Focus Timer)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/sessions` | List recent sessions |
| POST | `/api/sessions` | Log completed session |
| GET  | `/api/sessions/stats` | Focus stats |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Full stats summary |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | API health check |

---

## 📦 API Response Format

All endpoints return:

```json
{
  "success": true,
  "message": "Operation successful",
  "data": {}
}
```

Errors return:
```json
{
  "success": false,
  "message": "Descriptive error message"
}
```

---

## 🔐 Authentication

All protected routes require a JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

The token is returned on login/register and stored automatically by the frontend in `localStorage`.

---

## 🖼️ Avatar Uploads

- Uploaded to `backend/uploads/`
- Served at `http://localhost:8080/uploads/<filename>`
- Max size: 2MB
- Allowed types: JPEG, PNG, GIF, WebP

---

## 🛡️ Security Features

- **Helmet** — HTTP security headers
- **CORS** — Cross-origin resource sharing
- **bcryptjs** — Password hashing (12 rounds)
- **JWT** — Stateless authentication (7-day expiry)
- **Rate limiting** — Auth: 20 req/15min, API: 200 req/min
- **express-validator** — Input validation on all routes
- **Centralized error handling** — No stack traces in production

---

## 🏗️ Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Set a strong `JWT_SECRET` (32+ random chars)
3. Update `MONGO_URI` to your production MongoDB URI
4. Update `FRONTEND_ORIGIN` to your domain
5. Serve frontend via nginx or a CDN
6. Use PM2 to manage the Node.js process:

```bash
npm install -g pm2
pm2 start server.js --name zenith
pm2 save
pm2 startup
```

---

## 🐛 Troubleshooting

**"Cannot connect to MongoDB"**
- Ensure MongoDB is running: `mongod --version`
- Check the URI in `.env`

**"CORS error" in browser**
- Ensure backend is running on port 8080
- In development, CORS is set to `*` (all origins)

**"Token expired"**
- Log out and log back in — the frontend handles this automatically

**Avatar not displaying**
- Check that `backend/uploads/` directory exists
- Ensure Helmet's `crossOriginResourcePolicy` is set to `cross-origin` (already configured)
