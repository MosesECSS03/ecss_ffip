const express = require('express');
const router = express.Router();
const ParticipantsController = require('../Controllers/Participants/ParticipantsController');
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

      var controller = new ParticipantsController();
      const result = await controller.getParticipant(participantID);

      console.log('Participant retrieved:', result);
      
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
        
        res.status(200).json({
          status: 'success',
          success: true,
          message: 'Station data updated successfully',
          data: result.data
        })
      } else {
        res.status(500).json({
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
        res.status(200).json({
          status: 'success',
          success: true,
          message: 'All participants retrieved successfully',
          data: result.data,
          count: result.data ? result.data.length : 0
        });
      } else {
        res.status(500).json({
          status: 'error',
          success: false,
          message: result.error || 'Failed to retrieve participants'
        });
      }
    } 
    else if(req.query.purpose === 'healthSignal') {
        try {
          await sendOneSignalNotification({
            title: 'Health Signal Alert',
            message: `Name: ${req.body.name}\nPhone: ${req.body.phoneNumber}\nQuestion: ${req.body.question}\nAnswer: ${req.body.answer}`,
            web_url: 'https://purple-desert-0c35a1000.2.azurestaticapps.net/',
          data: {
            name: req.body.name,
            phoneNumber: req.body.phoneNumber,
            question: req.body.question,
            answer: req.body.answer
          }
          });
          console.log("Smart OneSignal notification sent successfully");
      } catch (error) {
        console.error("Failed to send OneSignal notification:", error);
        // Continue with the response even if notification fails
      }

    }
  }
  catch (error) {
    console.error('Error in POST /participants:', error);
    res.json({ status: 'error', success: false, message: 'Internal server error' });
  }
});

// GET route for retrieving all participants
router.post('/', async (req, res) => {
  console.log('Received GET request on /participants - retrieving all participants');
  
  try {
    var controller = new ParticipantsController();
    const result = await controller.getAllParticipants();

    console.log('All participants retrieved via GET:', result);
    
    if (result.success) {
      res.status(200).json(result.data);
    } else {
      res.status(500).json({
        status: 'error',
        success: false,
        message: result.error || 'Failed to retrieve participants'
      });
    }
  } catch (error) {
    console.error('Error in GET /participants:', error);
    res.status(500).json({ 
      status: 'error', 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

module.exports = router;
