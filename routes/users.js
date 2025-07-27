const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const passport = require('passport');
const User = require('../models/User');
const Stats = require('../models/Stats');

// Middleware to verify JWT token
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization').replace('Bearer ', '');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user) throw new Error();
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Please authenticate' });
    }
};

// Middleware to check if user is main admin (admin@lifelink.com)
const mainAdminAuth = async (req, res, next) => {
    try {
        if (req.user.email !== 'admin@lifelink.com') {
            throw new Error('Only main admin can perform this action');
        }
        next();
    } catch (error) {
        res.status(403).json({ error: error.message });
    }
};

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { type, name, email, phone, password, address, bloodGroup, dateOfBirth, gender } = req.body;

        console.log('Registration attempt:', { type, name, email, phone: phone ? 'provided' : 'missing' });

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            console.log('Registration failed: User already exists with email:', email);
            return res.status(400).json({
                success: false,
                error: 'Account already exists with this email address'
            });
        }

        // Validate required fields
        if (!type || !name || !email || !password || !phone) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: type, name, email, phone, password'
            });
        }

        // Validate email format
        const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Please enter a valid email address'
            });
        }

        // Validate phone format (10 digits)
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                success: false,
                error: 'Phone number must be exactly 10 digits'
            });
        }

        // Validate password strength
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 8 characters long'
            });
        }

        // Type-specific validations
        if (type === 'hospital' && !address) {
            return res.status(400).json({
                success: false,
                error: 'Address is required for hospital registration'
            });
        }

        if (type === 'donor' && !bloodGroup) {
            return res.status(400).json({
                success: false,
                error: 'Blood group is required for donor registration'
            });
        }

        if (type === 'donor' && !['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].includes(bloodGroup)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid blood group. Must be one of: A+, A-, B+, B-, AB+, AB-, O+, O-'
            });
        }

        // Create user data structure
        const userData = {
            email: email.toLowerCase(),
            password,
            type,
            status: 'active',
            profile: {
                name: name.trim(),
                phone: phone.trim(),
                ...(dateOfBirth && { dateOfBirth: new Date(dateOfBirth) }),
                ...(gender && { gender })
            },
            data: {} // Maintain for backward compatibility
        };

        // Add type-specific profile data
        if (type === 'hospital') {
            userData.profile.address = address.trim();
        }

        if (type === 'donor') {
            userData.profile.bloodGroup = bloodGroup;
        }

        // Set legacy data fields for backward compatibility
        if (type === 'patient') {
            userData.data = {
                'patient-name': name,
                'patient-email': email.toLowerCase(),
                'patient-phone': phone,
                'patient-password': password
            };
        } else if (type === 'hospital') {
            userData.data = {
                'hospital-name': name,
                'hospital-email': email.toLowerCase(),
                'hospital-phone': phone,
                'hospital-address': address,
                'hospital-password': password
            };
        } else if (type === 'donor') {
            userData.data = {
                'donor-name': name,
                'donor-email': email.toLowerCase(),
                'donor-phone': phone,
                'donor-blood-group': bloodGroup,
                'donor-password': password
            };
        } else if (type === 'admin') {
            userData.data = {
                'admin-name': name,
                'admin-email': email.toLowerCase(),
                'admin-password': password
            };
        }

        // Create and save user
        const user = new User(userData);
        await user.save();

        console.log('User created successfully:', {
            id: user._id,
            email: user.email,
            type: user.type,
            name: user.profile.name
        });

        // Update stats
        let stats = await Stats.findOne({});
        if (!stats) {
            stats = new Stats({
                totalUsers: 0,
                totalDonors: 0,
                totalHospitals: 0,
                totalPatients: 0,
                totalDonations: 0
            });
        }

        stats.totalUsers += 1;
        switch(user.type) {
            case 'donor':
                stats.totalDonors += 1;
                break;
            case 'hospital':
                stats.totalHospitals += 1;
                break;
            case 'patient':
                stats.totalPatients += 1;
                break;
            case 'admin':
                // Don't increment any specific counter for admin
                break;
        }
        await stats.save();

        // Generate JWT token
        const token = jwt.sign({
            userId: user._id,
            email: user.email,
            type: user.type,
            name: user.profile.name,
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
        }, process.env.JWT_SECRET);

        // Send success response
        res.status(201).json({
            success: true,
            message: 'Registration successful! Your account has been created.',
            user: {
                id: user._id,
                email: user.email,
                type: user.type,
                status: user.status,
                profile: user.profile,
                data: user.data, // For backward compatibility
                createdAt: user.createdAt,
                emailVerified: user.emailVerified
            },
            token
        });

    } catch (error) {
        console.error('Registration error:', error);

        // Handle specific MongoDB errors
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                error: 'An account with this email already exists'
            });
        }

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                error: messages.join('. ')
            });
        }

        res.status(500).json({
            success: false,
            error: 'Registration failed. Please try again.'
        });
    }
});

// Create new admin (only main admin can do this)
router.post('/create-admin', auth, mainAdminAuth, async (req, res) => {
    try {
        const { email, password, name } = req.body;

        console.log('Create admin request:', { email, name, hasPassword: !!password });

        // Validate required fields
        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: email, password, name'
            });
        }

        // Validate email format
        const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Please enter a valid email address'
            });
        }

        // Validate password length
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 8 characters long'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'User with this email already exists'
            });
        }

        // Create admin user with proper structure
        const adminUser = new User({
            email: email.toLowerCase(),
            password,
            type: 'admin',
            status: 'active',
            profile: {
                name: name.trim(),
                phone: '0000000000' // Default phone for admin
            },
            data: {
                'admin-name': name.trim(),
                'admin-email': email.toLowerCase(),
                'admin-password': password
            }
        });

        await adminUser.save();
        console.log('Admin user created:', adminUser.email);

        // Update stats
        let stats = await Stats.findOne({});
        if (!stats) {
            stats = new Stats({
                totalUsers: 0,
                totalDonors: 0,
                totalHospitals: 0,
                totalPatients: 0,
                totalDonations: 0
            });
        }
        stats.totalUsers += 1;
        await stats.save();

        res.status(201).json({
            success: true,
            message: 'Admin user created successfully',
            user: {
                id: adminUser._id,
                email: adminUser.email,
                type: adminUser.type,
                profile: adminUser.profile,
                data: adminUser.data,
                createdAt: adminUser.createdAt
            }
        });

    } catch (error) {
        console.error('Create admin error:', error);

        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                error: messages.join('. ')
            });
        }

        res.status(500).json({
            success: false,
            error: 'Failed to create admin user. Please try again.'
        });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password, type } = req.body;

        console.log('Login attempt:', { email, type, timestamp: new Date().toISOString() });

        // Validate required fields
        if (!email || !password || !type) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: email, password, type'
            });
        }

        // Find user by email and type
        const user = await User.findOne({
            email: email.toLowerCase(),
            type: type.toLowerCase()
        });

        if (!user) {
            console.log('Login failed: User not found:', email);
            return res.status(400).json({
                success: false,
                error: 'Invalid login credentials'
            });
        }

        // Check if account is locked
        if (user.isLocked()) {
            console.log('Login failed: Account locked:', email);
            return res.status(423).json({
                success: false,
                error: 'Account is temporarily locked due to too many failed login attempts. Please try again later.'
            });
        }

        // Check if account is deactivated
        if (user.status === 'deactivated') {
            console.log('Login failed: Account deactivated:', email);
            return res.status(403).json({
                success: false,
                error: 'Account has been deactivated. Please contact support.'
            });
        }

        // Verify password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            console.log('Login failed: Invalid password:', email);

            // Increment login attempts
            await user.incLoginAttempts();

            return res.status(400).json({
                success: false,
                error: 'Invalid login credentials'
            });
        }

        // Reset login attempts on successful login
        if (user.loginAttempts > 0) {
            await user.resetLoginAttempts();
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate JWT token
        const token = jwt.sign({
            userId: user._id,
            email: user.email,
            type: user.type,
            name: user.profile?.name || user.data[`${user.type}-name`] || user.data.name,
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
        }, process.env.JWT_SECRET);

        console.log('Login successful:', { email, type, userId: user._id });

        // Send success response
        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user._id,
                email: user.email,
                type: user.type,
                status: user.status,
                profile: user.profile,
                data: user.data, // For backward compatibility
                lastLogin: user.lastLogin,
                emailVerified: user.emailVerified,
                createdAt: user.createdAt
            },
            token
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed. Please try again.'
        });
    }
});

// Get user profile
router.get('/profile', auth, async (req, res) => {
    res.json(req.user);
});

// Update user profile
router.patch('/profile', auth, async (req, res) => {
    try {
        const updates = Object.keys(req.body);
        updates.forEach(update => req.user[update] = req.body[update]);
        await req.user.save();
        res.json(req.user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Create new admin (main admin only)
router.post('/create-admin', auth, async (req, res) => {
    try {
        // Only main admin can create new admins
        if (req.user.email !== 'admin@lifelink.com') {
            return res.status(403).json({
                success: false,
                error: 'Only main admin can create new admin accounts'
            });
        }

        const { name, email, password } = req.body;

        console.log('Admin creation attempt by:', req.user.email);
        console.log('New admin data:', { name, email });

        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, email, password'
            });
        }

        // Validate email format
        const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Please enter a valid email address'
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'Account already exists with this email address'
            });
        }

        // Create new admin user
        const newAdmin = new User({
            email: email.toLowerCase(),
            password: password,
            type: 'admin',
            status: 'active',
            profile: {
                name: name.trim(),
                phone: '0000000000', // Default phone for admin
                role: 'Administrator'
            },
            data: {
                'admin-name': name.trim(),
                'admin-email': email.toLowerCase(),
                'admin-password': password
            }
        });

        await newAdmin.save();

        console.log('New admin created successfully:', newAdmin.email);

        res.status(201).json({
            success: true,
            message: 'Admin account created successfully',
            admin: {
                id: newAdmin._id,
                email: newAdmin.email,
                name: newAdmin.profile.name,
                type: newAdmin.type,
                createdAt: newAdmin.createdAt
            }
        });

    } catch (error) {
        console.error('Create admin error:', error);
        res.status(500).json({
            success: false,
            error: 'Server error while creating admin account'
        });
    }
});

// Admin: Get all users
router.get('/all', auth, async (req, res) => {
    try {
        if (req.user.type !== 'admin') {
            throw new Error('Not authorized');
        }
        const users = await User.find({});
        res.json(users);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Admin: Delete user (only main admin can delete other admins)
router.delete('/:userId', auth, async (req, res) => {
    try {
        if (req.user.type !== 'admin') {
            throw new Error('Not authorized');
        }

        const userToDelete = await User.findById(req.params.userId);
        if (!userToDelete) {
            throw new Error('User not found');
        }

        // Only main admin can delete other admins
        if (userToDelete.type === 'admin' && req.user.email !== 'admin@lifelink.com') {
            throw new Error('Only main admin can delete admin users');
        }

        // Prevent main admin from being deleted
        if (userToDelete.email === 'admin@lifelink.com') {
            throw new Error('Main admin cannot be deleted');
        }

        await User.findByIdAndDelete(req.params.userId);

        // Update stats
        const stats = await Stats.findOne({});
        stats.totalUsers -= 1;
        switch(userToDelete.type) {
            case 'donor':
                stats.totalDonors -= 1;
                break;
            case 'hospital':
                stats.totalHospitals -= 1;
                break;
            case 'patient':
                stats.totalPatients -= 1;
                break;
        }
        await stats.save();

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get system stats
router.get('/stats', async (req, res) => {
    try {
        const stats = await Stats.findOne({});
        res.json(stats);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Google OAuth Routes

// Route to initiate Google OAuth
router.get('/auth/google', passport.authenticate('google', { 
    scope: ['profile', 'email'],
    prompt: 'select_account' // Forces account selection each time
}));

// Google OAuth callback route
router.get('/auth/google/callback', 
    passport.authenticate('google', { session: false, failureRedirect: '/login.html?error=google-auth-failed' }),
    (req, res) => {
        try {
            console.log('Google OAuth callback - user data:', req.user);
            const isNewUser = req.user.isNewUser || false;
            console.log('Is new user:', isNewUser);
            
            if (isNewUser) {
                // New user - redirect to completion page
                console.log('Redirecting new user to completion page');
                res.redirect(`/google-signup-complete.html?email=${encodeURIComponent(req.user.email)}&name=${encodeURIComponent(req.user.name)}&googleId=${req.user.googleId}`);
            } else {
                // Existing user - generate token and redirect to dashboard
                const token = jwt.sign({
                    userId: req.user._id,
                    email: req.user.email,
                    type: req.user.type,
                    name: req.user.profile?.name || req.user.data[`${req.user.type}-name`] || req.user.data.name,
                    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
                }, process.env.JWT_SECRET);

                // Redirect to frontend with token for existing users
                const userName = req.user.profile?.name || req.user.data?.[`${req.user.type}-name`] || req.user.name || 'User';
                console.log('Google login - user data:', req.user);
                console.log('Google login - extracted name:', userName);
                res.redirect(`/login-success.html?token=${token}&userType=${req.user.type}&userId=${req.user._id}&userName=${encodeURIComponent(userName)}`);
            }
        } catch (error) {
            console.error('Google auth callback error:', error);
            res.redirect('/login.html?error=server-error');
        }
    }
);

// Temporary: Delete Google users (for testing)
router.get('/cleanup-google-users', async (req, res) => {
    try {
        const result = await User.deleteMany({ googleId: { $exists: true } });
        res.json({ 
            success: true, 
            message: `Deleted ${result.deletedCount} Google users` 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Complete Google signup with additional details
router.post('/complete-google-signup', async (req, res) => {
    try {
        const { email, name, googleId, type, phone, address, bloodGroup } = req.body;
        
        // Validate required fields
        if (!email || !name || !googleId || !type || !phone) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields'
            });
        }
        
        // Validate phone format
        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(phone)) {
            return res.status(400).json({
                success: false,
                error: 'Phone number must be exactly 10 digits'
            });
        }
        
        // Type-specific validations
        if (type === 'hospital' && !address) {
            return res.status(400).json({
                success: false,
                error: 'Address is required for hospital registration'
            });
        }
        
        if (type === 'donor' && !bloodGroup) {
            return res.status(400).json({
                success: false,
                error: 'Blood group is required for donor registration'
            });
        }
        
        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'User already exists with this email'
            });
        }
        
        // Create user data structure
        const userData = {
            email: email.toLowerCase(),
            googleId,
            type,
            status: 'active',
            profile: {
                name: name.trim(),
                phone: phone.trim()
            },
            data: {},
            emailVerified: true
        };
        
        // Add type-specific profile data
        if (type === 'hospital') {
            userData.profile.address = address.trim();
        }
        
        if (type === 'donor') {
            userData.profile.bloodGroup = bloodGroup;
        }
        
        // Set legacy data fields for backward compatibility
        if (type === 'patient') {
            userData.data = {
                'patient-name': name,
                'patient-email': email.toLowerCase(),
                'patient-phone': phone
            };
        } else if (type === 'hospital') {
            userData.data = {
                'hospital-name': name,
                'hospital-email': email.toLowerCase(),
                'hospital-phone': phone,
                'hospital-address': address
            };
        } else if (type === 'donor') {
            userData.data = {
                'donor-name': name,
                'donor-email': email.toLowerCase(),
                'donor-phone': phone,
                'donor-blood-group': bloodGroup
            };
        }
        
        // Create and save user
        const user = new User(userData);
        await user.save();
        
        // Update stats
        let stats = await Stats.findOne({});
        if (!stats) {
            stats = new Stats({
                totalUsers: 0,
                totalDonors: 0,
                totalHospitals: 0,
                totalPatients: 0,
                totalDonations: 0
            });
        }
        
        stats.totalUsers += 1;
        switch(user.type) {
            case 'donor':
                stats.totalDonors += 1;
                break;
            case 'hospital':
                stats.totalHospitals += 1;
                break;
            case 'patient':
                stats.totalPatients += 1;
                break;
        }
        await stats.save();
        
        res.json({
            success: true,
            message: 'Google signup completed successfully'
        });
        
    } catch (error) {
        console.error('Complete Google signup error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to complete registration. Please try again.'
        });
    }
});

module.exports = router;