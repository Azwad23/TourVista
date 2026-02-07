# 🌍 TourVista — Group Tour & Event Management Platform

A full-stack web application for managing group tours, treks, cycling trips, and outings. Built for the Bangladesh travel community with bKash/Nagad payments, AI chatbot support, and a comprehensive admin dashboard.

![Node.js](https://img.shields.io/badge/Node.js-v24-green?logo=node.js)
![MySQL](https://img.shields.io/badge/MySQL-8.0+-blue?logo=mysql&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-lightgrey?logo=express)
![License](https://img.shields.io/badge/License-MIT-yellow)

---

## ✨ Features

### 👤 User Features
- **Account Management** — Register/login with email, Google, or GitHub OAuth
- **Browse Events** — Filter by category, difficulty, search by name/destination
- **Event Registration** — Register and pay online via bKash or Nagad
- **Registration Tracking** — Real-time status: Pending → Approved / Rejected / Waitlisted
- **Wishlist** — Save favorite events for later
- **Profile Management** — Edit name, phone (+880 format), upload profile picture
- **AI Chatbot** — 24/7 intelligent assistant powered by Google Gemini AI
- **Notifications** — Stay updated on registration and event changes

### 🛡️ Admin Dashboard
- **Event Management** — Create, edit, delete events with itinerary builder
- **User Management** — View users, toggle active/inactive status
- **Registration Approvals** — Approve, reject, or waitlist registrations
- **Chatbot Conversations** — View all user chatbot interactions
- **Dashboard Analytics** — Overview of events, users, and registrations
- **Notification System** — Send announcements to users
- **Site Settings** — Configure platform settings

### 💰 Payment System
- **bKash Integration** — Tokenized checkout (sandbox + production ready)
- **Nagad Integration** — Redirect-based payment flow
- **Payment Simulation** — Local development testing mode with simulated gateway

### 🤖 AI Chatbot
- **Google Gemini AI** — Context-aware responses using live event data from the database
- **Multi-model Fallback** — Automatic failover across Gemini 2.5 Flash → 2.0 Flash → 2.0 Flash-Lite → 2.5 Flash-Lite
- **Smart Local Fallback** — Keyword-based responses when AI is unavailable (never shows errors)
- **Per-session Memory** — Maintains conversation history for contextual replies
- **Personalization** — Greets users by name when logged in

---

## 🏗️ Tech Stack

| Layer      | Technology                                              |
| ---------- | ------------------------------------------------------- |
| **Frontend** | Vanilla HTML, CSS, JavaScript, Font Awesome             |
| **Backend**  | Node.js, Express.js                                     |
| **Database** | MySQL 8.0+                                              |
| **Auth**     | JWT, bcryptjs, Passport.js (Google & GitHub OAuth)      |
| **Payments** | bKash Tokenized Checkout API, Nagad Payment Gateway API |
| **AI**       | Google Gemini API (`@google/generative-ai`)              |
| **Storage**  | Multer (file uploads for avatars & event images)        |

---

## 📁 Project Structure

```
TourProject/
├── backend/
│   ├── server.js              # Express app entry point
│   ├── package.json
│   ├── .env                   # Environment variables
│   ├── config/
│   │   ├── db.js              # MySQL connection pool
│   │   └── passport.js        # OAuth strategies
│   ├── middleware/
│   │   └── auth.js            # JWT authentication middleware
│   ├── routes/
│   │   ├── auth.js            # Register, login, OAuth
│   │   ├── events.js          # CRUD for events
│   │   ├── registrations.js   # Event registration & status
│   │   ├── payments.js        # bKash & Nagad payment flows
│   │   ├── users.js           # Profile, admin user management
│   │   ├── chatbot.js         # AI chatbot endpoints
│   │   ├── wishlist.js        # Wishlist management
│   │   └── oauth.js           # OAuth callback handlers
│   ├── services/
│   │   └── gemini.js          # Gemini AI chatbot service
│   └── uploads/               # Uploaded files (avatars, events)
├── frontend/
│   ├── index.html             # Landing page
│   ├── events.html            # Browse events
│   ├── event-detail.html      # Single event view
│   ├── my-events.html         # User's registrations
│   ├── login.html             # Login page
│   ├── register.html          # Registration page
│   ├── profile.html           # User profile
│   ├── settings.html          # User settings
│   ├── wishlist.html          # Saved events
│   ├── notifications.html     # User notifications
│   ├── help-center.html       # Help & guides
│   ├── contact.html           # Contact form
│   ├── faqs.html              # Frequently asked questions
│   ├── privacy-policy.html    # Privacy policy
│   ├── admin/                 # Admin dashboard pages
│   ├── css/style.css          # Global styles
│   └── js/
│       ├── api.js             # API client & auth helpers
│       ├── app.js             # Shared UI (header, nav, toast)
│       ├── chatbot.js         # Chatbot widget
│       ├── admin.js           # Admin dashboard logic
│       └── data.js            # Data utilities
└── database/
    ├── schema.sql             # Full database schema
    └── seed.js                # Sample data seeder
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **MySQL** 8.0 or higher
- **npm** (comes with Node.js)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/TourProject.git
cd TourProject
```

### 2. Set Up the Database

```bash
mysql -u root -p < database/schema.sql
```

### 3. Configure Environment

Create `backend/.env` (or edit the existing one):

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=tourvista

# JWT
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=7d

# Server
PORT=3000

# Payment simulation (set to true for local dev)
PAYMENT_SIMULATION=true

# Google Gemini AI (free key from https://aistudio.google.com/apikey)
GEMINI_API_KEY=your_gemini_api_key

# Google OAuth (from https://console.cloud.google.com/apis/credentials)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# GitHub OAuth (from https://github.com/settings/developers)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback

# bKash (sandbox credentials for testing)
BKASH_BASE_URL=https://tokenized.sandbox.bka.sh/v1.2.0-beta
BKASH_APP_KEY=your_bkash_app_key
BKASH_APP_SECRET=your_bkash_app_secret
BKASH_USERNAME=your_bkash_username
BKASH_PASSWORD=your_bkash_password
BKASH_CALLBACK_URL=http://localhost:3000/api/payments/bkash/callback

# Nagad (sandbox credentials for testing)
NAGAD_BASE_URL=http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs
NAGAD_MERCHANT_ID=your_merchant_id
NAGAD_MERCHANT_NUMBER=your_merchant_number
NAGAD_PG_PUBLIC_KEY=your_nagad_public_key
NAGAD_MERCHANT_PRIVATE_KEY=your_nagad_private_key
NAGAD_CALLBACK_URL=http://localhost:3000/api/payments/nagad/callback
```

### 4. Install Dependencies

```bash
cd backend
npm install
```

### 5. Seed Sample Data (Optional)

```bash
npm run seed
```

### 6. Start the Server

```bash
npm start
```

The app will be available at **http://localhost:3000**

---

## 📡 API Endpoints

### Authentication
| Method | Endpoint                   | Description          |
| ------ | -------------------------- | -------------------- |
| POST   | `/api/auth/register`       | Register new user    |
| POST   | `/api/auth/login`          | Login with email     |
| GET    | `/api/auth/me`             | Get current user     |
| GET    | `/api/auth/google`         | Google OAuth login   |
| GET    | `/api/auth/github`         | GitHub OAuth login   |

### Events
| Method | Endpoint                   | Description           |
| ------ | -------------------------- | --------------------- |
| GET    | `/api/events`              | List all events       |
| GET    | `/api/events/:id`          | Get event details     |
| POST   | `/api/events`              | Create event (admin)  |
| PUT    | `/api/events/:id`          | Update event (admin)  |
| DELETE | `/api/events/:id`          | Delete event (admin)  |

### Registrations
| Method | Endpoint                          | Description              |
| ------ | --------------------------------- | ------------------------ |
| POST   | `/api/registrations`              | Register for event       |
| GET    | `/api/registrations/my`           | User's registrations     |
| GET    | `/api/registrations/check/:eventId` | Check registration status |
| PUT    | `/api/registrations/:id/status`   | Update status (admin)    |

### Payments
| Method | Endpoint                          | Description            |
| ------ | --------------------------------- | ---------------------- |
| POST   | `/api/payments/initiate`          | Start payment flow     |
| GET    | `/api/payments/bkash/callback`    | bKash payment callback |
| GET    | `/api/payments/nagad/callback`    | Nagad payment callback |

### Users
| Method | Endpoint                        | Description              |
| ------ | ------------------------------- | ------------------------ |
| GET    | `/api/users`                    | List users (admin)       |
| PUT    | `/api/users/profile`            | Update own profile       |
| PUT    | `/api/users/change-password`    | Change password          |
| POST   | `/api/users/profile-picture`    | Upload profile picture   |

### Chatbot
| Method | Endpoint                        | Description              |
| ------ | ------------------------------- | ------------------------ |
| POST   | `/api/chatbot/message`          | Send message to AI       |
| GET    | `/api/chatbot/history`          | Get chat history         |
| GET    | `/api/chatbot/conversations`    | All conversations (admin)|

### Wishlist
| Method | Endpoint                        | Description              |
| ------ | ------------------------------- | ------------------------ |
| GET    | `/api/wishlist`                 | Get user wishlist        |
| POST   | `/api/wishlist/:eventId`        | Add to wishlist          |
| DELETE | `/api/wishlist/:eventId`        | Remove from wishlist     |

---

## 🔑 Default Accounts

After seeding the database:

| Role        | Email               | Password   |
| ----------- | ------------------- | ---------- |
| Admin       | admin@tourvista.com | password   |
| Participant | user@tourvista.com  | password   |

---

## 📱 Phone Number Format

Phone numbers must follow the Bangladesh format:
- Starts with `+880`
- Followed by **10 digits**
- Example: `+8801815505489`

---

## 🤝 Connect

- **Facebook:** [facebook.com/run.faster.1804](https://www.facebook.com/run.faster.1804)
- **Instagram:** [instagram.com/tafhimul.azwad](https://www.instagram.com/tafhimul.azwad)
- **LinkedIn:** [linkedin.com/in/tafhimul-azwad-922b06322](https://www.linkedin.com/in/tafhimul-azwad-922b06322)
- **Email:** tafhimulazwad@gmail.com

---

## 📄 License

This project is licensed under the MIT License.
