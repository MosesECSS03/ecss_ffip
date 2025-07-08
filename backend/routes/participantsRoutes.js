const express = require('express');
const router = express.Router();
const ParticipantsController = require('../Controllers/Participants/ParticipantsController');

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
  }
  catch (error) {
    console.error('Error in POST /participants:', error);
    res.json({ status: 'error', success: false, message: 'Internal server error' });
  }
});

module.exports = router;
