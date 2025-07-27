const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
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

// Create new request (patients only)
router.post('/', auth, async (req, res) => {
    try {
        if (req.user.type !== 'patient') {
            return res.status(403).json({
                success: false,
                error: 'Only patients can create requests'
            });
        }

        const { type, details } = req.body;
        
        // Get patient information
        const patient = await User.findById(req.user._id);
        
        const request = new Request({
            patientId: req.user._id,
            patientName: patient.profile?.name || patient.data[patient.type + '-name'],
            patientEmail: patient.email,
            patientPhone: patient.profile?.phone || patient.data[patient.type + '-phone'],
            type,
            details,
            status: 'pending'
        });

        await request.save();
        console.log(`New ${type} request created by ${request.patientName}`);

        // Update stats
        let stats = await Stats.findOne({});
        if (!stats) {
            stats = new Stats({
                totalUsers: 0,
                totalDonors: 0,
                totalHospitals: 0,
                totalPatients: 0,
                totalDonations: 0,
                totalRequests: 0
            });
        }
        stats.totalRequests = (stats.totalRequests || 0) + 1;
        await stats.save();

        // Notify all hospitals about new request
        const hospitals = await User.find({ type: 'hospital' });
        console.log(`Notifying ${hospitals.length} hospitals about new request`);

        res.status(201).json({
            success: true,
            message: 'Request created successfully! All hospitals have been notified.',
            request: {
                id: request._id,
                type: request.type,
                details: request.details,
                status: request.status,
                patientName: request.patientName,
                createdAt: request.createdAt
            }
        });
    } catch (error) {
        console.error('Create request error:', error);
        res.status(400).json({
            success: false,
            error: error.message || 'Failed to create request'
        });
    }
});

// Get all requests (filtered by user type)
router.get('/', auth, async (req, res) => {
    try {
        let query = {};
        
        console.log('Debug - User type:', req.user.type, 'User ID:', req.user._id);
        
        switch (req.user.type) {
            case 'patient':
                query.patientId = req.user._id;
                console.log('Debug - Patient query:', query);
                break;
            case 'hospital':
                // Hospitals can see:
                // 1. Pending requests that they haven't rejected
                // 2. Their approved requests (for history)
                // 3. Their rejected requests (for history)
                query = {
                    $or: [
                        {
                            status: 'pending',
                            'rejectedByHospitals.hospitalId': { $ne: req.user._id }
                        },  // Available for action (not rejected by this hospital)
                        {
                            status: 'approved',
                            hospitalId: req.user._id
                        },  // Their approved requests (for history)
                        {
                            status: 'rejected',
                            hospitalId: req.user._id
                        },  // Their rejected requests (for history)
                        {
                            'rejectedByHospitals.hospitalId': req.user._id
                        }  // Requests they rejected (tracked in array)
                    ]
                };
                console.log('Debug - Hospital query:', JSON.stringify(query, null, 2));
                break;
            case 'admin':
                // Admin can see all requests
                console.log('Debug - Admin sees all');
                break;
            default:
                return res.status(403).json({ error: 'Not authorized to view requests' });
        }

        const requests = await Request.find(query)
            .populate('patientId', 'profile.name email')
            .populate('hospitalId', 'profile.name email')
            .sort({ createdAt: -1 });

        console.log('Debug - Found requests:', requests.length);
        console.log('Debug - Sample request:', requests[0] ? {
            id: requests[0]._id,
            patientId: requests[0].patientId,
            status: requests[0].status,
            type: requests[0].type
        } : 'No requests found');

        res.json({
            success: true,
            requests
        });
    } catch (error) {
        console.error('Get requests error:', error);
        res.status(400).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Update request status (hospitals and admins only)
router.patch('/:id', auth, async (req, res) => {
    try {
        if (!['hospital', 'admin'].includes(req.user.type)) {
            return res.status(403).json({
                success: false,
                error: 'Only hospitals and admins can update request status'
            });
        }

        const request = await Request.findById(req.params.id);
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Request not found'
            });
        }

        const { status, rejectionReason } = req.body;
        
        // Validate status
        if (!['approved', 'rejected', 'completed'].includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status. Must be approved, rejected, or completed'
            });
        }

        // Update request based on status
        if (status === 'approved') {
            // Approval: Set global status and assign to hospital
            request.status = 'approved';
            request.hospitalId = req.user._id;
            request.hospitalName = req.user.profile?.name || req.user.data[req.user.type + '-name'];
            request.approvedBy = req.user._id;
        } else if (status === 'rejected') {
            // Rejection: Only add to rejectedByHospitals array, keep status as pending for other hospitals
            const existingRejection = request.rejectedByHospitals.find(
                r => r.hospitalId.toString() === req.user._id.toString()
            );

            if (!existingRejection) {
                request.rejectedByHospitals.push({
                    hospitalId: req.user._id,
                    hospitalName: req.user.profile?.name || req.user.data[req.user.type + '-name'],
                    rejectionReason: rejectionReason || 'No reason provided',
                    rejectedAt: new Date()
                });
            }
            
            // Don't change global status - keep it as 'pending' for other hospitals
        } else {
            // Other statuses (completed, etc.)
            request.status = status;
            request.hospitalId = req.user._id;
            request.hospitalName = req.user.profile?.name || req.user.data[req.user.type + '-name'];
            request.approvedBy = req.user._id;
        }

        await request.save();
        
        console.log(`Request ${request._id} ${status} by ${request.hospitalName}`);

        res.json({
            success: true,
            message: `Request ${status} successfully`,
            request: {
                id: request._id,
                status: request.status,
                hospitalName: request.hospitalName,
                updatedAt: request.updatedAt
            }
        });
    } catch (error) {
        console.error('Update request error:', error);
        res.status(400).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Get request statistics
router.get('/stats', auth, async (req, res) => {
    try {
        const stats = {
            total: await Request.countDocuments(),
            pending: await Request.countDocuments({ status: 'pending' }),
            approved: await Request.countDocuments({ status: 'approved' }),
            rejected: await Request.countDocuments({ status: 'rejected' }),
            completed: await Request.countDocuments({ status: 'completed' }),
            byType: {
                blood: await Request.countDocuments({ type: 'blood' }),
                medicine: await Request.countDocuments({ type: 'medicine' }),
                bed: await Request.countDocuments({ type: 'bed' }),
                doctor: await Request.countDocuments({ type: 'doctor' })
            }
        };

        if (req.user.type === 'patient') {
            stats.myRequests = await Request.countDocuments({ patientId: req.user._id });
        } else if (req.user.type === 'hospital') {
            stats.myApprovals = await Request.countDocuments({ hospitalId: req.user._id });
        }

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Get request stats error:', error);
        res.status(400).json({ 
            success: false,
            error: error.message 
        });
    }
});

// Delete request (patient can delete their own, admin can delete any)
router.delete('/:id', auth, async (req, res) => {
    try {
        const request = await Request.findById(req.params.id);
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Request not found'
            });
        }

        // Check authorization
        if (req.user.type === 'patient') {
            // Patient can only delete their own requests
            if (request.patientId.toString() !== req.user._id.toString()) {
                return res.status(403).json({
                    success: false,
                    error: 'You can only delete your own requests'
                });
            }
        } else if (req.user.type === 'admin') {
            // Admin can delete any request
        } else {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to delete requests'
            });
        }

        // Delete the request
        await Request.findByIdAndDelete(req.params.id);

        console.log(`Request ${req.params.id} deleted by ${req.user.type}: ${req.user.email}`);

        res.json({
            success: true,
            message: 'Request deleted successfully',
            deletedId: req.params.id
        });

    } catch (error) {
        console.error('Delete request error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete request'
        });
    }
});

module.exports = router;
