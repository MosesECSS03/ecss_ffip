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
        // Implement concurrent access protection
        const requestId = Date.now() + Math.random().toString(36);
        console.log(`[${requestId}] Starting participant retrieval for ID:`, participantID);
        
        let retryCount = 0;
        const maxRetries = 5; // Increased retries for concurrent access
        
        while (retryCount < maxRetries) {
            try {
                console.log(`[${requestId}] Retrieving participant (attempt ${retryCount + 1}/${maxRetries})`);
                
                // Add random delay to reduce collision probability
                if (retryCount > 0) {
                    const delay = Math.min(100 * Math.pow(2, retryCount) + Math.random() * 100, 2000);
                    console.log(`[${requestId}] Waiting ${delay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
                
                // Initialize the database connection with retry logic
                await this.dbConnection.initialize();

                // Ensure participantID is an ObjectId
                const { ObjectId } = require('mongodb');
                let query = {};
                try {
                    query = { _id: new ObjectId(participantID) };
                } catch (e) {
                    console.error(`[${requestId}] Invalid participant ID format:`, e);
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

                console.log(`[${requestId}] Participant retrieval result:`, result);

                if (result.success) {
                    console.log(`[${requestId}] Successfully retrieved participant`);
                    return {
                        success: true,
                        data: result.data,
                        message: 'Participant retrieved successfully',
                        requestId: requestId
                    };
                } else {
                    // If document not found, no need to retry
                    if (result.message && result.message.includes('No document found')) {
                        console.log(`[${requestId}] Participant not found, stopping retries`);
                        return {
                            success: false,
                            error: result.message || 'Participant not found'
                        };
                    }
                    
                    // For other errors, continue retrying
                    throw new Error(result.message || 'Failed to retrieve participant data');
                }
            } catch (error) {
                console.error(`[${requestId}] Error retrieving participant (attempt ${retryCount + 1}):`, error);
                retryCount++;
                
                // Check if it's a connection error that we should retry
                if (this._isRetryableError(error) && retryCount < maxRetries) {
                    console.log(`[${requestId}] Retryable error, will retry...`);
                    // Reset connection on error
                    this.dbConnection.isConnected = false;
                    this.dbConnection.connectionPromise = null;
                    continue;
                }
                
                // If max retries reached or non-retryable error
                console.error(`[${requestId}] Max retries reached or non-retryable error`);
                return {
                    success: false,
                    error: error.message,
                    requestId: requestId
                };
            }
        }
        
        console.error(`[${requestId}] Failed after ${maxRetries} attempts`);
        return {
            success: false,
            error: 'Failed to retrieve participant after multiple attempts',
            requestId: requestId
        };
    }

    // Helper method to check if error is retryable
    _isRetryableError(error) {
        return error.name === 'MongoServerSelectionError' || 
               error.name === 'MongoNetworkTimeoutError' ||
               error.message.includes('timeout') ||
               error.message.includes('connection') ||
               error.message.includes('ECONNRESET') ||
               error.message.includes('socket');
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
