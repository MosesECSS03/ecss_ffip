const express = require('express');
const router = express.Router();
const ParticipantsController = require('../Controller/Participants/ParticipantsController');
const { sendOneSignalNotification } = require('../utils/onesignal');

router.post('/', async (req, res) => 
{
  const io = req.app.get('io'); // Get the Socket.IO instance
  console.log('🔗 Socket.IO instance:', io);
  console.log('Received POST request on /participants with body:', req.body);  
  try{
    if(req.body.purpose === 'new') 
    {   
      var participantData = req.body.participantData;
            
      var controller = new ParticipantsController();
      const result = await controller.addParticipant(participantData);

      console.log('New participant added:', result);

      
      // Emit real-time update to connected clients
      if (io && result.success) {
        io.emit('participant-updated', {
          message: 'New participant registered',
          participant: result.data,
        });
      }
      
      if (result.success) {
        res.status(201).json({
          status: 'success',
          success: true,
          message: 'Participant registered successfully',
          data: result.data
        });
      } else {
        res.status(500).json({
          status: 'error',
          success: false,
          message: result.error || 'Failed to register participant'
        });
      }
    }
    else if(req.body.purpose === 'retrieveParticipant') 
    {   
      var participantID = req.body.participantID;
      console.log('🔍 Retrieving participant with ID:', participantID);

      var controller = new ParticipantsController();
      const result = await controller.getParticipant(participantID);

      console.log(':', result);
      
      if (result.success) {
        return res.status(201).json({
          status: 'success',
          success: true,
          message: 'Participant registered successfully',
          data: result.data
        });
      } else {
        return res.status(500).json({
          status: 'error',
          success: false,
          message: result.error || 'Failed to register participant'
        });
      }
    }
    else if(req.body.purpose === 'updateStationData') 
    {   
      // Update station data for the participant
      const participantID = req.body.participantID;
      const data = req.body.data;
      
      console.log('🔍 Updating station data - participantID:', participantID, 'data:', data);
      
      // Calculate BMI if height and weight are present
      let bmi = null;
      if (data.height && data.weight) {
        const heightMeters = parseFloat(data.height) / 100;
        const weightKg = parseFloat(data.weight);
        if (heightMeters > 0 && weightKg > 0) {
          bmi = (weightKg / (heightMeters * heightMeters)).toFixed(2);
          data.bmi = bmi;
        }
      }
      
      const controller = new ParticipantsController();
      const result = await controller.updateStationData(participantID, data);
      console.log('Station data update result:', result);
      if (result.success) {
        console.log('Station data updated successfully:', result.data);
        
        // Emit real-time update to connected clients
              // Update the socket emission section with proper error handling
        if (io) {
          console.log('🔄 Emitting participant-updated event for:', participantID);
          
          try {
            io.emit('participant-updated', {
              message: 'Station data updated',
              participant: result.data,
              participantID: participantID
            });
            console.log('✅ Socket event emitted successfully');
          } catch (socketError) {
            console.error('❌ Error emitting socket event:', socketError);
            console.error('❌ Socket error details:', {
              participantID,
              errorMessage: socketError.message,
              errorStack: socketError.stack
            });
          }
        } else {
          console.warn('⚠️ Socket.IO instance not available');
          console.warn('⚠️ Available app settings:', Object.keys(req.app.settings || {}));
        }
        
        return res.status(200).json({
          status: 'success',
          success: true,
          message: 'Station data updated successfully',
          data: result.data
        });
      } else {
        return res.status(500).json({
          status: 'error',
          success: false,
          message: result.error || 'Failed to update station data'
        });
      }
    }
    else if(req.body.purpose === 'retrieveAllParticipants')
    {
      console.log('Retrieving all participants...');
      
      var controller = new ParticipantsController();
      const result = await controller.getAllParticipants();

      console.log('All participants retrieved:', result);
      
      if (result.success) {
        return res.status(200).json({
          status: 'success',
          success: true,
          message: 'All participants retrieved successfully',
          data: result.data,
          count: result.data ? result.data.length : 0
        });
      } else {
        return res.status(500).json({
          status: 'error',
          success: false,
          message: result.error || 'Failed to retrieve participants'
        });
      }
    } 
    else if(req.body.purpose === 'healthSignal') {
        try {
          console.log('Sending health signal for question:', req.body.question, 'Answer:', req.body.answer);
          await sendOneSignalNotification({
            title: 'Health Signal Alert',
            message: `Name: ${req.body.name}\nPhone: ${req.body.phoneNumber}\nQuestion: ${req.body.question}\nAnswer: ${req.body.answer}`,
            playerIds: [
              "0e935d7b-34f1-445d-94bd-9ef985ea8386",
              "4200638f-086a-434b-99a4-19779b192b8a",
              "7d368e7d-3306-4cba-beee-ed7339f60953"
            ]
          });
          console.log("Smart OneSignal notification sent successfully");
          
          return res.status(200).json({
            status: 'success',
            success: true,
            message: 'Health signal notification sent successfully'
          });
      } catch (error) {
        console.error("Failed to send OneSignal notification:", error);
        return res.status(500).json({
          status: 'error',
          success: false,
          message: 'Failed to send health signal notification'
        });
      }
    } else {
      return res.status(400).json({
        status: 'error',
        success: false,
        message: 'Invalid purpose specified'
      });
    }
  }
  catch (error) {
    console.error('Error in POST /participants:', error);
    return res.status(500).json({ 
      status: 'error', 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// QR Scanner Optimized Routes
// ===========================

// GET participant by ID (optimized for QR scanner)
router.get('/:id', async (req, res) => {
  try {
    const participantId = req.params.id;
    const scanId = req.headers['x-scan-id'];
    const deviceId = req.headers['x-device-id'];
    
    // Log scan attempt for analytics
    console.log(`🔍 QR Scan attempt: ${participantId} from device ${deviceId} (scan: ${scanId})`);
    
    var controller = new ParticipantsController();
    const result = await controller.getParticipantById(participantId);
    
    if (result.success && result.data) {
      console.log(`✅ QR Scan successful for participant: ${participantId}`);
      
      res.json({
        success: true,
        data: result.data,
        scanId: scanId,
        timestamp: Date.now(),
        message: 'Participant data retrieved successfully'
      });
    } else {
      console.log(`❌ QR Scan failed - participant not found: ${participantId}`);
      
      res.status(404).json({
        success: false,
        error: 'Participant not found',
        participantId: participantId,
        scanId: scanId,
        timestamp: Date.now()
      });
    }
  } catch (error) {
    console.error('❌ QR Scanner API error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
});

// Process participant action (check-in, check-out, etc.)
router.post('/action', async (req, res) => {
  const io = req.app.get('io'); // Get the Socket.IO instance
  
  try {
    const { participantId, action, stationId, deviceId, timestamp } = req.body;
    
    console.log(`🎯 Processing QR action: ${action} for participant ${participantId} at station ${stationId}`);
    
    // Validate required fields
    if (!participantId || !action) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: participantId and action'
      });
    }
    
    // Create action record
    const actionRecord = {
      participantId: participantId.toString(),
      action,
      stationId: stationId || 'default',
      deviceId: deviceId || 'unknown',
      timestamp: timestamp || Date.now(),
      id: `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    var controller = new ParticipantsController();
    
    // First, verify participant exists
    const participantResult = await controller.getParticipantById(participantId);
    if (!participantResult.success) {
      return res.status(404).json({
        success: false,
        error: 'Participant not found',
        participantId: participantId
      });
    }
    
    // Record the action in database
    const actionResult = await controller.addParticipantAction(actionRecord);
    
    if (actionResult.success) {
      // Update participant status
      const updateData = {
        lastAction: action,
        lastActionTime: Date.now(),
        currentStation: stationId || 'default',
        status: action === 'check-in' ? 'checked-in' : 
                action === 'check-out' ? 'checked-out' : 'active'
      };
      
      await controller.updateParticipantStatus(participantId, updateData);
      
      // Emit real-time update to connected clients
      if (io) {
        io.emit('participant-action', {
          participantId,
          action,
          stationId,
          timestamp: actionRecord.timestamp,
          participantData: participantResult.data
        });
      }
      
      console.log(`✅ QR Action completed: ${action} for participant ${participantId}`);
      
      res.json({
        success: true,
        action: actionRecord,
        participant: participantResult.data,
        message: `${action} completed successfully`,
        timestamp: Date.now()
      });
    } else {
      throw new Error(actionResult.error || 'Failed to record action');
    }
  } catch (error) {
    console.error('❌ QR Action processing error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: Date.now()
    });
  }
});

// Get scan statistics (optional - for analytics)
router.get('/stats/scans', async (req, res) => {
  try {
    const { deviceId, stationId, timeRange } = req.query;
    
    // This would query your actions collection for statistics
    // Implementation depends on your data structure
    const stats = {
      totalScans: 0,
      successfulScans: 0,
      failedScans: 0,
      averageResponseTime: 0,
      deviceId,
      stationId,
      timeRange: timeRange || '24h',
      timestamp: Date.now()
    };
    
    res.json({
      success: true,
      stats,
      message: 'Scan statistics retrieved'
    });
  } catch (error) {
    console.error('❌ Stats retrieval error:', error);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;