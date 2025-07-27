const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const Donation = require('../models/Donation');
const Request = require('../models/Request');
// const HospitalInventory = require('../models/HospitalInventory'); // Unused model
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

// Create new donation
router.post('/', auth, async (req, res) => {
    try {
        if (req.user.type !== 'donor') {
            throw new Error('Only donors can create donations');
        }

        // Get donor information from user profile
        const donor = await User.findById(req.user._id);
        
        // Extract contact details from form or use profile data as fallback
        const { type, details } = req.body;
        
        // Use form contact details if provided, otherwise fallback to user profile
        const donorEmail = details?.contactDetails && details?.contactPreference === 'email' ? 
            details.contactDetails : 
            (donor.email || donor.profile?.email || donor.data?.email);
            
        const donorPhone = details?.contactDetails && (details?.contactPreference === 'phone' || details?.contactPreference === 'sms') ? 
            details.contactDetails : 
            (donor.profile?.phone || donor.data?.phone || donor.data?.[donor.type + '-phone']);
        
        const donation = new Donation({
            donorId: req.user._id,
            donorName: donor.profile?.name || donor.data?.[donor.type + '-name'] || donor.displayName || 'Unknown Donor',
            donorEmail: donorEmail || 'No Email',
            donorPhone: donorPhone || 'No Phone',
            type,
            details,
            status: 'pending'
        });

        await donation.save();

        // Update stats
        const stats = await Stats.findOne({});
        stats.totalDonations += 1;
        await stats.save();

        res.status(201).json(donation);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all donations (filtered by user type)
router.get('/', auth, async (req, res) => {
    try {
        let query = {};
        
        // Temporarily show all donations for debugging
        console.log('Debug - User type:', req.user.type, 'User ID:', req.user._id);
        
        switch (req.user.type) {
            case 'donor':
                query.donorId = req.user._id;
                console.log('Debug - Donor query:', query);
                break;
            case 'hospital':
                // Hospitals should see:
                // 1. Pending donations that they haven't rejected
                // 2. Their approved donations (for history)
                // 3. Their rejected donations (for history)
                query.$or = [
                    {
                        status: 'pending',
                        'rejectedByHospitals.hospitalId': { $ne: req.user._id }
                    },  // Available for action (not rejected by this hospital)
                    {
                        status: 'approved',
                        hospitalId: req.user._id
                    },  // Their approved donations (for history)
                    {
                        status: 'rejected',
                        hospitalId: req.user._id
                    },  // Their rejected donations (for history)
                    {
                        'rejectedByHospitals.hospitalId': req.user._id
                    }  // Donations they rejected (tracked in array)
                ];
                console.log('Debug - Hospital query:', JSON.stringify(query, null, 2));
                break;
            case 'patient':
                query.patientId = req.user._id;
                console.log('Debug - Patient query:', query);
                break;
            case 'admin':
                // Admin can see all donations
                console.log('Debug - Admin sees all');
                break;
            default:
                throw new Error('Invalid user type');
        }

        const donations = await Donation.find(query)
            .populate('donorId', 'data.name')
            .populate('hospitalId', 'data.name')
            .populate('patientId', 'data.name');

        console.log('Debug - Found donations:', donations.length);
        console.log('Debug - Sample donation:', donations[0] ? {
            id: donations[0]._id,
            donorId: donations[0].donorId,
            status: donations[0].status,
            type: donations[0].type
        } : 'No donations found');

        res.json(donations);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Update donation status
router.patch('/:id', auth, async (req, res) => {
    try {
        const donation = await Donation.findById(req.params.id);
        if (!donation) {
            throw new Error('Donation not found');
        }

        // Verify authorization based on user type and action
        if (req.user.type === 'hospital') {
            if (!['approved', 'rejected', 'completed'].includes(req.body.status)) {
                throw new Error('Invalid status update');
            }

            if (req.body.status === 'approved') {
                // Approval: Set global status and assign to hospital
                donation.status = 'approved';
                donation.hospitalId = req.user._id;
                donation.hospitalName = req.user.profile?.name || req.user.data[req.user.type + '-name'];
                donation.approvedBy = req.user._id;
            } else if (req.body.status === 'rejected') {
                // Rejection: Only add to rejectedByHospitals array, keep status as pending for other hospitals
                const existingRejection = donation.rejectedByHospitals.find(
                    r => r.hospitalId.toString() === req.user._id.toString()
                );

                if (!existingRejection) {
                    donation.rejectedByHospitals.push({
                        hospitalId: req.user._id,
                        hospitalName: req.user.profile?.name || req.user.data[req.user.type + '-name'],
                        rejectionReason: req.body.rejectionReason || 'No reason provided',
                        rejectedAt: new Date()
                    });
                }
                
                // Don't change global status - keep it as 'pending' for other hospitals
            } else if (req.body.status === 'completed') {
                donation.status = 'completed';
            }
        } else if (req.user.type === 'donor') {
            if (donation.donorId.toString() !== req.user._id.toString() ||
                !['cancelled'].includes(req.body.status)) {
                throw new Error('Not authorized');
            }
            donation.status = req.body.status;
        } else if (req.user.type !== 'admin') {
            throw new Error('Not authorized');
        }

        if (req.body.patientId) {
            donation.patientId = req.body.patientId;
        }

        await donation.save();
        res.json(donation);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get donation statistics
router.get('/stats', auth, async (req, res) => {
    try {
        const stats = {
            total: await Donation.countDocuments(),
            pending: await Donation.countDocuments({ status: 'pending' }),
            approved: await Donation.countDocuments({ status: 'approved' }),
            completed: await Donation.countDocuments({ status: 'completed' }),
            cancelled: await Donation.countDocuments({ status: 'cancelled' }),
            byType: {
                blood: await Donation.countDocuments({ type: 'blood' }),
                medicine: await Donation.countDocuments({ type: 'medicine' })
            }
        };

        if (req.user.type === 'donor') {
            stats.myDonations = await Donation.countDocuments({ donorId: req.user._id });
        } else if (req.user.type === 'hospital') {
            stats.myApprovals = await Donation.countDocuments({ hospitalId: req.user._id });
        }

        res.json(stats);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete donation (donor can delete their own, admin can delete any)
router.delete('/:id', auth, async (req, res) => {
    try {
        const donation = await Donation.findById(req.params.id);
        if (!donation) {
            return res.status(404).json({
                success: false,
                error: 'Donation not found'
            });
        }

        // Check authorization
        if (req.user.type === 'donor') {
            // Donor can only delete their own donations
            if (donation.donorId.toString() !== req.user._id.toString()) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only delete your own donations'
                });
            }
        } else if (req.user.type === 'admin') {
            // Admin can delete any donation
        } else {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to delete donations'
            });
        }

        // Delete the donation
        await Donation.findByIdAndDelete(req.params.id);

        console.log(`Donation ${req.params.id} deleted by ${req.user.type}: ${req.user.email}`);

        res.json({
            success: true,
            message: 'Donation deleted successfully',
            deletedId: req.params.id
        });

    } catch (error) {
        console.error('Delete donation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete donation'
        });
    }
});

module.exports = router;