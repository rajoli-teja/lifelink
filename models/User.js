const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    password: {
        type: String,
        required: function() { return !this.googleId; }, // Password not required for Google auth
        minlength: [8, 'Password must be at least 8 characters long']
    },
    // Google OAuth fields
    googleId: {
        type: String,
        unique: true,
        sparse: true // Allows null values and maintains uniqueness for non-null values
    },
    type: {
        type: String,
        enum: {
            values: ['admin', 'donor', 'hospital', 'patient'],
            message: 'User type must be admin, donor, hospital, or patient'
        },
        required: [true, 'User type is required']
    },
    status: {
        type: String,
        enum: ['active', 'deactivated', 'pending'],
        default: 'active'
    },
    // Profile data specific to user type
    profile: {
        name: {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            minlength: [2, 'Name must be at least 2 characters long']
        },
        phone: {
            type: String,
            required: [true, 'Phone number is required'],
            match: [/^[0-9]{10}$/, 'Phone number must be 10 digits']
        },
        // Hospital specific fields
        address: {
            type: String,
            required: function() { return this.type === 'hospital'; }
        },
        // Donor specific fields
        bloodGroup: {
            type: String,
            enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
            required: function() { return this.type === 'donor'; }
        },
        // Additional profile fields
        dateOfBirth: Date,
        gender: {
            type: String,
            enum: ['male', 'female', 'other']
        },
        emergencyContact: {
            name: String,
            phone: String,
            relationship: String
        }
    },

    // Legacy data structure for backward compatibility
    data: {
        // Patient specific fields
        'patient-name': String,
        'patient-email': String,
        'patient-phone': String,
        'patient-password': String,

        // Hospital specific fields
        'hospital-name': String,
        'hospital-email': String,
        'hospital-phone': String,
        'hospital-address': String,
        'hospital-password': String,

        // Donor specific fields
        'donor-name': String,
        'donor-email': String,
        'donor-phone': String,
        'donor-blood-group': String,
        'donor-password': String,

        // Admin specific fields
        'admin-name': String,
        'admin-email': String,
        'admin-password': String,

        // Legacy fields
        name: String,
        phone: String,
        address: String,
        bloodType: String,
        bloodGroup: String
    },
    // Authentication and security
    lastLogin: {
        type: Date
    },
    loginAttempts: {
        type: Number,
        default: 0
    },
    accountLocked: {
        type: Boolean,
        default: false
    },
    lockUntil: Date,

    // Email verification
    emailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: String,

    // Password reset
    passwordResetToken: String,
    passwordResetExpires: Date,

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    // Schema options
    timestamps: true, // Automatically manage createdAt and updatedAt
    toJSON: {
        transform: function(doc, ret) {
            // Remove sensitive fields when converting to JSON
            delete ret.password;
            delete ret.passwordResetToken;
            delete ret.emailVerificationToken;
            return ret;
        }
    }
});

// Pre-save middleware
userSchema.pre('save', function(next) {
    // Update timestamp
    this.updatedAt = new Date();

    // Populate profile data from legacy data structure for backward compatibility
    if (this.data && !this.profile.name) {
        const typePrefix = this.type + '-';
        this.profile.name = this.data[typePrefix + 'name'] || this.data.name;
        this.profile.phone = this.data[typePrefix + 'phone'] || this.data.phone;

        if (this.type === 'hospital') {
            this.profile.address = this.data[typePrefix + 'address'] || this.data.address;
        }
        if (this.type === 'donor') {
            this.profile.bloodGroup = this.data[typePrefix + 'blood-group'] || this.data.bloodGroup;
        }
    }

    next();
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    // Skip password hashing for Google auth users or if password hasn't changed
    if (this.googleId && !this.password) return next();
    if (!this.isModified('password')) return next();

    try {
        // Hash the password
        this.password = await bcrypt.hash(this.password, 12);

        // Clear password reset fields if password is being changed
        this.passwordResetToken = undefined;
        this.passwordResetExpires = undefined;

        next();
    } catch (error) {
        next(error);
    }
});

// Instance methods
userSchema.methods.comparePassword = async function(candidatePassword) {
    // Google auth users might not have a password
    if (this.googleId && !this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
};

// Check if account is locked
userSchema.methods.isLocked = function() {
    return !!(this.accountLocked && this.lockUntil && this.lockUntil > Date.now());
};

// Increment login attempts
userSchema.methods.incLoginAttempts = function() {
    // If we have a previous lock that has expired, restart at 1
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $unset: { lockUntil: 1 },
            $set: { loginAttempts: 1 }
        });
    }

    const updates = { $inc: { loginAttempts: 1 } };

    // Lock account after 5 failed attempts for 2 hours
    if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
        updates.$set = {
            accountLocked: true,
            lockUntil: Date.now() + 2 * 60 * 60 * 1000 // 2 hours
        };
    }

    return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = function() {
    return this.updateOne({
        $unset: { loginAttempts: 1, lockUntil: 1 },
        $set: { accountLocked: false, lastLogin: new Date() }
    });
};

module.exports = mongoose.model('User', userSchema);