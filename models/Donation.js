const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
    // Donor information
    donorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    donorName: String,
    donorEmail: String,
    donorPhone: String,

    // Donation type and details
    type: {
        type: String,
        enum: ['blood', 'medicine'],
        required: true
    },

    // Enhanced details structure
    details: {
        // Blood donation
        bloodType: {
            type: String,
            enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
        },
        bloodUnits: {
            type: Number,
            default: 1
        },
        weight: Number,
        healthStatus: String,
        lastDonationDate: String,
        medications: String,

        // Medicine donation
        medicineName: String,
        medicineType: {
            type: String,
            enum: ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops']
        },
        quantity: Number,
        expiryDate: Date,

        // Common fields
        availability: String,
        contactPreference: String,
        contactDetails: String,
        address: String,
        urgency: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium'
        },
        notes: String
    },

    // Status and workflow
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'completed', 'expired'],
        default: 'pending'
    },

    // Hospital assignment
    hospitalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    hospitalName: String,

    // Patient assignment (when approved)
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    patientName: String,

    // Additional tracking
    rejectionReason: String,
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // Hospital-specific rejections
    rejectedByHospitals: [{
        hospitalId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        hospitalName: String,
        rejectionReason: String,
        rejectedAt: {
            type: Date,
            default: Date.now
        }
    }],

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    approvedAt: Date,
    completedAt: Date
});

// Update timestamp on save
donationSchema.pre('save', function(next) {
    this.updatedAt = Date.now();

    // Set status-specific timestamps
    if (this.isModified('status')) {
        if (this.status === 'approved' && !this.approvedAt) {
            this.approvedAt = new Date();
        }
        if (this.status === 'completed' && !this.completedAt) {
            this.completedAt = new Date();
        }
    }

    next();
});

module.exports = mongoose.model('Donation', donationSchema);