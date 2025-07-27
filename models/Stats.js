const mongoose = require('mongoose');

const statsSchema = new mongoose.Schema({
    totalUsers: {
        type: Number,
        default: 0
    },
    totalDonors: {
        type: Number,
        default: 0
    },
    totalHospitals: {
        type: Number,
        default: 0
    },
    totalPatients: {
        type: Number,
        default: 0
    },
    totalDonations: {
        type: Number,
        default: 0
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

// Update timestamp on save
statsSchema.pre('save', function(next) {
    this.lastUpdated = Date.now();
    next();
});

module.exports = mongoose.model('Stats', statsSchema);