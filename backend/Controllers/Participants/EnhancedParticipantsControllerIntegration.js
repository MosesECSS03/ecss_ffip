/**
 * INTEGRATION EXAMPLE: How to add seamless failover to your existing ParticipantsController
 * This shows how to enhance your current code without breaking it
 */

const SeamlessFailoverWrapper = require('../Database/SeamlessFailoverWrapper');

class EnhancedParticipantsControllerIntegration {
    constructor() {
        // Initialize seamless failover wrapper
        this.seamlessSystem = new SeamlessFailoverWrapper();
        
        // Keep your original database connection as backup
        this.dbConnection = null; // Your original DatabaseConnectivity instance
    }

    /**
     * INITIALIZE SEAMLESS SYSTEM (call this once at startup)
     */
    async initializeSeamlessFailover() {
        try {
            console.log('🚀 INITIALIZING SEAMLESS FAILOVER INTEGRATION');
            await this.seamlessSystem.initializeSeamlessSystem(20, 6);
            
            const status = this.seamlessSystem.getSystemStatus();
            console.log('✅ SEAMLESS FAILOVER READY:');
            console.log(`   - Connected Instances: ${status.connectedInstances}/${status.totalInstances}`);
            console.log(`   - Buffer Connections: ${status.bufferConnections}/${status.totalBufferPool}`);
            console.log(`   - Emergency Connections: ${status.emergencyConnections}/${status.totalEmergencyPool}`);
            console.log(`   - Azure Free Compatible: ${status.isAzureFree}`);
            
            return status;
        } catch (error) {
            console.error('❌ SEAMLESS FAILOVER INITIALIZATION FAILED:', error.message);
            throw error;
        }
    }

    /**
     * ENHANCED ADD PARTICIPANT (replaces your existing method)
     */
    async addParticipant(participantData) {
        try {
            // Use seamless system first
            const result = await this.seamlessSystem.addParticipant(participantData);
            return result;
            
        } catch (error) {
            console.warn('⚠️  Seamless system failed, falling back to original method');
            
            // Fallback to your original implementation
            return await this.addParticipantOriginal(participantData);
        }
    }

    /**
     * ENHANCED GET PARTICIPANT (replaces your existing method)
     */
    async getParticipant(participantId, searchCriteria = null) {
        try {
            // Use seamless system first
            const result = await this.seamlessSystem.getParticipant(participantId, searchCriteria);
            return result;
            
        } catch (error) {
            console.warn('⚠️  Seamless system failed, falling back to original method');
            
            // Fallback to your original implementation
            return await this.getParticipantOriginal(participantId, searchCriteria);
        }
    }

    /**
     * ENHANCED UPDATE PARTICIPANT (replaces your existing method)
     */
    async updateParticipant(participantId, updateData) {
        try {
            // Use seamless system first
            const result = await this.seamlessSystem.updateParticipant(participantId, updateData);
            return result;
            
        } catch (error) {
            console.warn('⚠️  Seamless system failed, falling back to original method');
            
            // Fallback to your original implementation
            return await this.updateParticipantOriginal(participantId, updateData);
        }
    }

    /**
     * GET VOLUNTEER CONNECTION (new method for volunteers)
     */
    async getVolunteerConnection(volunteerId) {
        try {
            return await this.seamlessSystem.getVolunteerConnection(volunteerId);
        } catch (error) {
            console.error(`❌ VOLUNTEER CONNECTION FAILED: ${volunteerId}`, error.message);
            throw error;
        }
    }

    /**
     * VOLUNTEER DATABASE OPERATIONS (new methods)
     */
    async addVolunteer(volunteerData, volunteerId = null) {
        const id = volunteerId || `V${Date.now()}`;
        
        try {
            const connection = await this.getVolunteerConnection(id);
            
            const now = new Date();
            const newVolunteer = {
                ...volunteerData,
                volunteerId: id,
                submittedAt: {
                    date: now.toLocaleDateString('en-GB', { timeZone: 'Asia/Singapore' }),
                    time: now.toLocaleTimeString('en-GB', { 
                        timeZone: 'Asia/Singapore',
                        hour12: false, 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    })
                },
                status: 'active',
                role: 'volunteer'
            };

            const result = await connection.insertDocument('fitness_test', 'volunteers', newVolunteer);
            
            if (result.success) {
                console.log(`✅ VOLUNTEER ADDED: ${id} via ${connection.instanceRole}`);
            }
            
            return result;
            
        } catch (error) {
            console.error(`❌ ADD VOLUNTEER FAILED: ${id}`, error.message);
            throw error;
        }
    }

    async getVolunteer(volunteerId) {
        try {
            const connection = await this.getVolunteerConnection(volunteerId);
            const result = await connection.getDocument('fitness_test', 'volunteers', { volunteerId });
            
            if (result.success) {
                console.log(`✅ VOLUNTEER RETRIEVED: ${volunteerId} via ${connection.instanceRole}`);
            }
            
            return result;
            
        } catch (error) {
            console.error(`❌ GET VOLUNTEER FAILED: ${volunteerId}`, error.message);
            throw error;
        }
    }

    /**
     * GET SYSTEM STATUS AND HEALTH
     */
    getSeamlessStatus() {
        return this.seamlessSystem.getSystemStatus();
    }

    /**
     * YOUR ORIGINAL METHODS (keep as fallback)
     * Copy your existing methods here and rename them with "Original" suffix
     */
    async addParticipantOriginal(participantData) {
        // Your original addParticipant implementation
        // This serves as a fallback if seamless system fails
        
        console.log('🔄 USING ORIGINAL DATABASE METHOD (FALLBACK)');
        
        // Initialize your original database connection if not done
        if (!this.dbConnection) {
            const DatabaseConnectivity = require('../Database/databaseConnectivity');
            this.dbConnection = new DatabaseConnectivity();
        }
        
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                console.log('Adding participant (original method):', participantData, `(Attempt ${retryCount + 1})`);
                
                await this.dbConnection.initialize();
                
                const now = new Date();
                const newParticipant = {
                    ...participantData,
                    submittedAt: {
                        date: now.toLocaleDateString('en-GB', { timeZone: 'Asia/Singapore' }),
                        time: now.toLocaleTimeString('en-GB', { 
                            timeZone: 'Asia/Singapore',
                            hour12: false, 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        })
                    },
                    status: 'pending',
                    isCurrentParticipant: false
                };

                const result = await this.dbConnection.insertDocument('fitness_test', 'participants', newParticipant);
                
                if (result.success) {
                    console.log('✅ Participant added successfully (original method):', result.insertedId);
                    return result;
                }
                
                throw new Error(result.error || 'Insert failed');
                
            } catch (error) {
                retryCount++;
                console.error(`❌ Attempt ${retryCount} failed:`, error.message);
                
                if (retryCount >= maxRetries) {
                    throw error;
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    async getParticipantOriginal(participantId, searchCriteria = null) {
        // Your original getParticipant implementation
        if (!this.dbConnection) {
            const DatabaseConnectivity = require('../Database/databaseConnectivity');
            this.dbConnection = new DatabaseConnectivity();
        }
        
        try {
            await this.dbConnection.initialize();
            
            const query = searchCriteria || { participantId };
            const result = await this.dbConnection.getDocument('fitness_test', 'participants', query);
            
            console.log('✅ Participant retrieved (original method)');
            return result;
            
        } catch (error) {
            console.error('❌ Get participant failed (original method):', error.message);
            throw error;
        }
    }

    async updateParticipantOriginal(participantId, updateData) {
        // Your original updateParticipant implementation
        if (!this.dbConnection) {
            const DatabaseConnectivity = require('../Database/databaseConnectivity');
            this.dbConnection = new DatabaseConnectivity();
        }
        
        try {
            await this.dbConnection.initialize();
            
            const result = await this.dbConnection.updateDocument(
                'fitness_test', 
                'participants',
                { participantId }, 
                { $set: updateData }
            );
            
            console.log('✅ Participant updated (original method)');
            return result;
            
        } catch (error) {
            console.error('❌ Update participant failed (original method):', error.message);
            throw error;
        }
    }

    /**
     * CLEANUP METHOD
     */
    async cleanup() {
        await this.seamlessSystem.cleanup();
        
        if (this.dbConnection) {
            await this.dbConnection.disconnect();
        }
    }
}

module.exports = EnhancedParticipantsControllerIntegration;
