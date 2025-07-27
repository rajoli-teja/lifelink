require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'file://'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '/')));

// Initialize Passport
app.use(passport.initialize());

// Request logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Configure Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/api/users/auth/google/callback',
    scope: ['profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Check if user already exists
        const User = require('./models/User');
        let user = await User.findOne({ email: profile.emails[0].value });
        
        if (user) {
            // User exists, update Google ID if not set
            if (!user.googleId) {
                user.googleId = profile.id;
                await user.save();
            }
            user.isNewUser = false;
            return done(null, user);
        }
        
        // New user - return profile data for completion
        const newUserData = {
            email: profile.emails[0].value,
            name: profile.displayName,
            googleId: profile.id,
            isNewUser: true
        };
        
        return done(null, newUserData);
    } catch (error) {
        return done(error, null);
    }
}));

console.log('Attempting to connect to MongoDB Atlas...');
console.log('Connection string:', process.env.MONGODB_URI ? 'Loaded from .env' : 'NOT FOUND');

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log(' Successfully connected to MongoDB Atlas');
    console.log('Database:', mongoose.connection.db.databaseName);
})
.catch(err => {
    console.error(' MongoDB Connection Error:', err.message);
    console.error('Full error:', err);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.use('/api/users', require('./routes/users'));
app.use('/api/donations', require('./routes/donations'));
app.use('/api/requests', require('./routes/requests'));

const User = require('./models/User');
User.findOne({ email: 'admin@lifelink.com' })
    .then(admin => {
        if (!admin) {
            console.log('Creating default admin user...');
            const adminData = {
                email: 'admin@lifelink.com',
                password: 'admin123',
                type: 'admin',
                status: 'active',
                profile: {
                    name: 'System Admin',
                    phone: '1234567890'
                },
                data: {
                    'admin-name': 'System Admin',
                    'admin-email': 'admin@lifelink.com',
                    'admin-password': 'admin123'
                }
            };
            
            return User.create(adminData).then(() => {
                console.log('Default admin created: admin@lifelink.com / admin123');
            });
        } else {
            console.log('Default admin already exists');
        }
    })
    .catch(err => console.error('Error creating admin:', err));

app.use((err, req, res, next) => {
    console.error(' Server Error:', err.message);
    console.error('Stack trace:', err.stack);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});













