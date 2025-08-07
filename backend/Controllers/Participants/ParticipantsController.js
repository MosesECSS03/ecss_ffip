const DatabaseConnectivity = require('../../Database/databaseConnectivity');

class ParticipantsController {
    constructor() {
        this.dbConnection = new DatabaseConnectivity();
    }

    async addParticipant(participantData) {
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                console.log('Adding participant:', participantData, `(Attempt ${retryCount + 1})`);
                
                // Initialize the database connection with retry logic
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
                console.error(`Error adding participant (attempt ${retryCount + 1}):`, error);
                
                // Check if it's a database connection error that we can retry
                if (error.name === 'InvalidStateError' || error.message.includes('database connection is closing')) {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        console.log(`Retrying database operation in 1 second... (${retryCount}/${maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    }
                }
                
                return { 
                    success: false, 
                    error: `Database error after ${retryCount + 1} attempts: ${error.message}` 
                };
            }
        }
        
        return { 
            success: false, 
            error: `Failed to add participant after ${maxRetries} attempts` 
        };
    }

    async getParticipant(participantID) {
        try {
            console.log('Retrieving participant with ID:', participantID);
            // Initialize the database connection
            await this.dbConnection.initialize();

            // Ensure participantID is an ObjectId
            const { ObjectId } = require('mongodb');
            let query = {};
            try {
                query = { _id: new ObjectId(participantID) };
            } catch (e) {
                return {
                    success: false,
                    error: 'Invalid participant ID format'
                };
            }

            const result = await this.dbConnection.getDocument(
                'Fitness-Test', // database name
                'Participants', // collection name
                query
            );

            console.log('Participant retrieval result:', result);

            if (result.success) {
                return {
                    success: true,
                    data: result.data,
                    message: 'Participant retrieved successfully'
                };
            } else {
                return {
                    success: false,
                    error: result.message || 'Failed to retrieve participant data'
                };
            }
        } catch (error) {
            console.error('Error retrieving participant:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async updateStationData(participantID, data) {
        try {
            console.log('Updating station data for participant:', participantID, 'data:', data);
            await this.dbConnection.initialize();
            let query = {};
            // Always use MongoDB ObjectId for _id
            const { ObjectId } = require('mongodb');
            try {
                query = { _id: new ObjectId(participantID) };
            } catch (e) {
                return {
                    success: false,
                    error: 'Invalid participant ID format (should be a 24-character hex string)'
                };
            }
            // Build the update object: set the fields in data at the root level, but never update _id
            const { _id, ...dataWithoutId } = data;
            const update = { $set: { ...dataWithoutId } };
            const result = await this.dbConnection.updateDocument(
                'Fitness-Test',
                'Participants',
                query,
                update
            );
            if (result.success) {
                return {
                    success: true,
                    data: result.data,
                    message: 'Station data updated successfully'
                };
            } else {
                return {
                    success: false,
                    error: result.message || 'Failed to update station data'
                };
            }
        } catch (error) {
            console.error('Error updating station data:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getAllParticipants() {
        try {
            console.log('Retrieving all participants...');
            // Initialize the database connection
            await this.dbConnection.initialize();
            
            // Retrieve all participants from the collection
            const result = await this.dbConnection.findDocuments(
                'Fitness-Test', // database name
                'Participants', // collection name
                {} // empty filter to get all documents
            );

            if (result.success) {
                console.log(`Retrieved ${result.data.length} participants`);
                return { 
                    success: true, 
                    data: result.data,
                    message: `Retrieved ${result.data.length} participants successfully` 
                };
            } else {
                return { 
                    success: false, 
                    error: 'Failed to retrieve participants data' 
                };
            }
        } catch (error) {
            console.error('Error retrieving all participants:', error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

}

module.exports = ParticipantsController;
