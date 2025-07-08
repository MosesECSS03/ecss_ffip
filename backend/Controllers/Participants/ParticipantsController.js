const DatabaseConnectivity = require('../../Database/databaseConnectivity');

class ParticipantsController {
    constructor() {
        this.dbConnection = new DatabaseConnectivity();
    }

    async addParticipant(participantData) {
        try {
            console.log('Adding participant:', participantData);
            // Initialize the database connection
            await this.dbConnection.initialize();
            
            // Create new participant entry with metadata
            const now = new Date();
            const newParticipant = {
                ...participantData,
                submittedAt: {
                    date: now.toLocaleDateString('en-GB'), // dd/mm/yyyy format
                    time: now.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' }) // 24-hour format hh:mm
                }
            };

            delete newParticipant.id; // Ensure _id is not included if it exists in participantData
            
            const result = await this.dbConnection.insertDocument(
                'Fitness-Test', // database name
                'Participants', // collection name
                newParticipant
            );

            if (result.success) {
                return { 
                    success: true, 
                    data: {
                        ...newParticipant,
                    },
                    message: 'Participant added successfully' 
                };
            } else {
                return { 
                    success: false, 
                    error: 'Failed to save participant data' 
                };
            }
        } catch (error) {
            console.error('Error adding participant:', error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }
}

module.exports = ParticipantsController;
