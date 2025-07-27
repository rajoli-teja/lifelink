# LifeLink - Healthcare Donation Platform

##  BACKEND SETUP COMPLETE!

**The application now uses a proper Node.js + Express + MongoDB backend!**

###  Setup Instructions:

#### **Prerequisites:**
1. **Node.js** (v14 or higher) - [Download here](https://nodejs.org/)
2. **MongoDB** - [Download here](https://www.mongodb.com/try/download/community)

#### **Installation Steps:**

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start MongoDB:**
   ```bash
   # On Windows
   mongod

   # On Mac/Linux
   sudo systemctl start mongod
   ```

3. **Start the Server:**
   ```bash
   npm start
   # or for development with auto-restart:
   npm run dev
   ```

4. **Open Application:**
   - Server runs on: `http://localhost:3000`
   - Open `http://localhost:3000` in your browser

#### **Default Admin Account:**
- **Email:** `admin@lifelink.com`
- **Password:** `admin123`

---

LifeLink is a full-stack web application that connects donors, hospitals, and patients for efficient management of blood, organ, and medicine donations.

## Features

- User Authentication and Authorization
  - Multiple user types (Admin, Donor, Hospital, Patient)
  - Secure login and registration
  - Role-based access control

- Donation Management
  - Blood donation tracking
  - Organ donation management
  - Medicine donation handling
  - Real-time status updates

- Dashboard Analytics
  - System-wide statistics
  - User-specific donation history
  - Status tracking

## Tech Stack

- Frontend:
  - HTML5
  - CSS3
  - JavaScript (Vanilla)

- Backend:
  - Node.js
  - Express.js
  - MongoDB

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd lifelink
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following content:
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/lifelink
   JWT_SECRET=your_jwt_secret_key
   ```

4. Start MongoDB service

5. Run the application:
   ```bash
   npm start
   ```

## Default Admin Account

The system automatically creates a default admin account on first run:
- Email: admin@lifelink.com
- Password: admin123

## API Endpoints

### Users
- POST /api/users/register - Register new user
- POST /api/users/login - User login
- GET /api/users/profile - Get user profile
- PATCH /api/users/profile - Update user profile
- GET /api/users/all - Get all users (admin only)
- DELETE /api/users/:userId - Delete user (admin only)
- GET /api/users/stats - Get system statistics

### Donations
- POST /api/donations - Create new donation
- GET /api/donations - Get donations (filtered by user type)
- PATCH /api/donations/:id - Update donation status
- GET /api/donations/stats - Get donation statistics

## Security Features

- Password hashing using bcrypt
- JWT-based authentication
- Input validation and sanitization
- Role-based access control

## Project Structure

```
/
├── models/
│   ├── User.js
│   ├── Donation.js
│   └── Stats.js
├── routes/
│   ├── users.js
│   └── donations.js
├── public/
│   ├── js/
│   │   └── api.js
│   └── styles.css
├── *.html
├── server.js
├── package.json
└── .env
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request