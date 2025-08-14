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
                        date: now.toLocaleDateString('en-GB', { timeZone: 'Asia/Singapore' }), // dd/mm/yyyy format in GMT+8
                        time: now.toLocaleTimeString('en-GB', { 
                            timeZone: 'Asia/Singapore',
                            hour12: false, 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        }) // 24-hour format hh:mm in GMT+8
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

    async getParticipant(participantID)
     {
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

    // QR Scanner Optimized Methods
    // ============================

    async getParticipantById(participantId) {
        try {
            console.log(`🔍 Getting participant by ID: ${participantId}`);
            
            // Initialize the database connection
            await this.dbConnection.initialize();
            
            // Query by the participant's form ID (not MongoDB _id)
            const result = await this.dbConnection.getDocument(
                'Fitness-Test', // database name
                'Participants', // collection name
                { id: participantId.toString() } // Search by form ID
            );

            if (result.success && result.data) {
                console.log(`✅ Found participant: ${result.data.name} (ID: ${participantId})`);
                return { 
                    success: true, 
                    data: result.data,
                    message: 'Participant retrieved successfully' 
                };
            } else {
                console.log(`❌ Participant not found: ${participantId}`);
                return { 
                    success: false, 
                    error: 'Participant not found',
                    participantId: participantId
                };
            }
        } catch (error) {
            console.error(`❌ Error getting participant ${participantId}:`, error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    async addParticipantAction(actionData) {
        try {
            console.log(`📝 Recording action: ${actionData.action} for participant ${actionData.participantId}`);
            
            // Initialize the database connection
            await this.dbConnection.initialize();
            
            // Add timestamp and validation
            const actionRecord = {
                ...actionData,
                recordedAt: new Date().toISOString(),
                status: 'completed'
            };
            
            const result = await this.dbConnection.insertDocument(
                'Fitness-Test', // database name
                'ParticipantActions', // collection name for tracking actions
                actionRecord
            );

            if (result.success) {
                console.log(`✅ Action recorded successfully: ${actionData.action}`);
                return { 
                    success: true, 
                    data: actionRecord,
                    insertedId: result.insertedId,
                    message: 'Action recorded successfully' 
                };
            } else {
                return { 
                    success: false, 
                    error: 'Failed to record participant action' 
                };
            }
        } catch (error) {
            console.error('❌ Error recording participant action:', error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    async updateParticipantStatus(participantId, updateData) {
        try {
            console.log(`🔄 Updating participant status: ${participantId}`);
            
            // Initialize the database connection
            await this.dbConnection.initialize();
            
            // Add update timestamp
            const updatePayload = {
                ...updateData,
                lastUpdated: new Date().toISOString()
            };
            
            const result = await this.dbConnection.updateDocument(
                'Fitness-Test', // database name
                'Participants', // collection name
                { id: participantId.toString() }, // Query by form ID
                { $set: updatePayload } // Update operation
            );

            if (result.success) {
                console.log(`✅ Participant status updated: ${participantId}`);
                return { 
                    success: true, 
                    data: result.data,
                    message: 'Participant status updated successfully' 
                };
            } else {
                return { 
                    success: false, 
                    error: result.message || 'Failed to update participant status' 
                };
            }
        } catch (error) {
            console.error(`❌ Error updating participant status ${participantId}:`, error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    async getParticipantActions(participantId, limit = 10) {
        try {
            console.log(`📊 Getting actions for participant: ${participantId}`);
            
            // Initialize the database connection
            await this.dbConnection.initialize();
            
            const result = await this.dbConnection.findDocuments(
                'Fitness-Test', // database name
                'ParticipantActions', // collection name
                { participantId: participantId.toString() } // Query by participant ID
            );

            if (result.success) {
                // Sort by timestamp (newest first) and limit results
                const sortedActions = result.data
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .slice(0, limit);

                console.log(`✅ Retrieved ${sortedActions.length} actions for participant ${participantId}`);
                return { 
                    success: true, 
                    data: sortedActions,
                    count: sortedActions.length,
                    message: 'Participant actions retrieved successfully' 
                };
            } else {
                return { 
                    success: false, 
                    error: 'Failed to retrieve participant actions' 
                };
            }
        } catch (error) {
            console.error(`❌ Error getting actions for participant ${participantId}:`, error);
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

}

module.exports = ParticipantsController;