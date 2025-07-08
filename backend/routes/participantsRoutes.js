const express = require('express');
const router = express.Router();
const ParticipantsController = require('../Controllers/Participants/ParticipantsController');

router.post('/', async (req, res) => 
{
  const io = req.app.get('io'); // Get the Socket.IO instance
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
        io.emit('participant-added', {
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
  }
  catch (error) {
    console.error('Error in POST /participants:', error);
    res.json({ status: 'error', success: false, message: 'Internal server error' });
  }
});

module.exports = router;
