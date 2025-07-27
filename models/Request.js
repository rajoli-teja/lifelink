const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema({
    // Patient information
    patientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    patientName: String,
    patientEmail: String,
    patientPhone: String,
    
    // Request type and details
    type: {
        type: String,
        enum: ['blood', 'medicine', 'bed', 'doctor'],
        required: true
    },
    
    // Request details
    details: {
        // Blood request
        bloodType: {
            type: String,
            enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
        },
        bloodUnits: {
            type: Number,
            default: 1
        },
        
        // Medicine request
        medicineName: String,
        medicineType: {
            type: String,
            enum: ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops']
        },
        quantity: Number,
        
        // Bed request
        bedType: {
            type: String,
            enum: ['general', 'icu', 'emergency', 'maternity', 'pediatric']
        },
        duration: Number, // days
        
        // Doctor request
        doctorSpecialty: {
            type: String,
            enum: ['general', 'cardiology', 'neurology', 'orthopedic', 'pediatric', 'emergency']
        },
        appointmentDate: Date,
        
        // Common fields
        urgency: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium'
        },
        medicalHistory: String,
        additionalNotes: String
    },
    
    // Status and workflow
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'completed', 'cancelled'],
        default: 'pending'
    },
    
    // Hospital assignment
    hospitalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    hospitalName: String,
    
    // Fulfillment details
    fulfilledBy: {
        donationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Donation'
        },
        resourceId: String, // For beds, doctors, etc.
        assignedAt: Date
    },
    
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
requestSchema.pre('save', function(next) {
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

module.exports = mongoose.model('Request', requestSchema);
