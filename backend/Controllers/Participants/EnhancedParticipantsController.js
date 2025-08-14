/**
 * ENHANCED PARTICIPANTS CONTROLLER with SEAMLESS FAILOVER
 * Example integration of comprehensive seamless failover system
 * For 20 participants + 5-6 volunteers with 75 buffer connections
 */

const DatabaseConnectivity = require('../../Database/databaseConnectivity');

class EnhancedParticipantsController {
    constructor() {
        // Initialize COMPREHENSIVE SEAMLESS FAILOVER system
        this.shiftSystem = null;
        this.isInitialized = false;
        this.participantConnections = new Map(); // Track individual participant connections
        this.volunteerConnections = new Map();   // Track individual volunteer connections
        this.failoverCount = 0;
    }

    /**
     * INITIALIZE SEAMLESS FAILOVER SYSTEM
     * Creates 20 participant + 6 volunteer + 75 buffer connections
     */
    async initializeSeamlessSystem() {
        if (this.isInitialized) {
            return this.shiftSystem;
        }

        try {
            console.log('🚀 INITIALIZING COMPREHENSIVE SEAMLESS FAILOVER SYSTEM');
            console.log('🎯 Target: 20 participants + 6 volunteers + 75 buffer connections');

            // Create the comprehensive shift instances
            this.shiftSystem = DatabaseConnectivity.createShiftInstances(20, 6, {
                silentMode: false, // Show initialization logging
                mongodbURI: process.env.MONGODB_CONNECTION_STRING
            });

            console.log('📊 SYSTEM STATS:');
            console.log(`   Total Instances: ${this.shiftSystem.stats.totalInstances}/${this.shiftSystem.stats.maxAllowed}`);
            console.log(`   Buffer Connections: ${this.shiftSystem.stats.bufferConnections}`);
            console.log(`   Emergency Connections: ${this.shiftSystem.stats.emergencyConnections}`);
            console.log(`   Azure Free Compatible: ${this.shiftSystem.stats.isAzureFree ? 'YES' : 'NO'}`);

            // Connect all instances
            console.log('🔌 CONNECTING ALL INSTANCES...');
            const connectionPromises = this.shiftSystem.instances.map(instance => 
                instance.connect().catch(err => {
                    console.warn(`⚠️  Failed to connect ${instance.instanceRole}: ${err.message}`);
                    return null;
                })
            );

            await Promise.allSettled(connectionPromises);

            const connectedCount = this.shiftSystem.instances.filter(i => i.isConnected).length;
            console.log(`✅ CONNECTED: ${connectedCount}/${this.shiftSystem.instances.length} instances`);

            this.isInitialized = true;
            return this.shiftSystem;

        } catch (error) {
            console.error('❌ SEAMLESS SYSTEM INITIALIZATION FAILED:', error.message);
            throw error;
        }
    }

    /**
     * GET SEAMLESS CONNECTION for participant
     */
    async getParticipantConnection(participantId) {
        await this.initializeSeamlessSystem();

        try {
            // Check if participant already has a connection
            if (this.participantConnections.has(participantId)) {
                const existingConnection = this.participantConnections.get(participantId);
                if (existingConnection.isHealthy && existingConnection.isConnected) {
                    return existingConnection;
                }
            }

            // Get healthy connection using seamless system
            const connection = this.shiftSystem.getHealthyConnection('participant', participantId);
            this.participantConnections.set(participantId, connection);

            console.log(`✅ PARTICIPANT CONNECTION: ${participantId} → ${connection.instanceRole}`);
            return connection;

        } catch (error) {
            console.error(`❌ PARTICIPANT CONNECTION FAILED: ${participantId}`, error.message);
            throw error;
        }
    }

    /**
     * GET SEAMLESS CONNECTION for volunteer
     */
    async getVolunteerConnection(volunteerId) {
        await this.initializeSeamlessSystem();

        try {
            // Check if volunteer already has a connection
            if (this.volunteerConnections.has(volunteerId)) {
                const existingConnection = this.volunteerConnections.get(volunteerId);
                if (existingConnection.isHealthy && existingConnection.isConnected) {
                    return existingConnection;
                }
            }

            // Get healthy connection using seamless system
            const connection = this.shiftSystem.getHealthyConnection('volunteer', volunteerId);
            this.volunteerConnections.set(volunteerId, connection);

            console.log(`✅ VOLUNTEER CONNECTION: ${volunteerId} → ${connection.instanceRole}`);
            return connection;

        } catch (error) {
            console.error(`❌ VOLUNTEER CONNECTION FAILED: ${volunteerId}`, error.message);
            throw error;
        }
    }

    /**
     * ADD PARTICIPANT with SEAMLESS FAILOVER
     */
    async addParticipant(participantData, participantId = null) {
        const id = participantId || `P${Date.now()}`;
        let attemptCount = 0;
        const maxAttempts = 3;

        while (attemptCount < maxAttempts) {
            try {
                attemptCount++;
                console.log(`🔄 ADD PARTICIPANT ATTEMPT ${attemptCount}: ${id}`);

                // Get seamless connection
                const connection = await this.getParticipantConnection(id);

                // Create participant with timestamp
                const now = new Date();
                const newParticipant = {
                    ...participantData,
                    participantId: id,
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
                    connectionInfo: {
                        instanceRole: connection.instanceRole,
                        instanceId: connection.instanceId
                    }
                };

                // Insert with seamless connection
                const result = await connection.insertDocument('participants', newParticipant);
                
                console.log(`✅ PARTICIPANT ADDED: ${id} via ${connection.instanceRole}`);
                return result;

            } catch (error) {
                console.warn(`⚠️  ATTEMPT ${attemptCount} FAILED for ${id}: ${error.message}`);

                if (attemptCount < maxAttempts) {
                    // SEAMLESS FAILOVER: Move to buffer and retry
                    console.log(`🔄 TRIGGERING SEAMLESS FAILOVER for ${id}...`);
                    
                    const currentConnection = this.participantConnections.get(id);
                    if (currentConnection) {
                        const bufferConnection = this.shiftSystem.moveToBuffer(currentConnection);
                        if (bufferConnection) {
                            this.participantConnections.set(id, bufferConnection);
                            this.failoverCount++;
                            console.log(`⚡ SEAMLESS FAILOVER ${this.failoverCount}: ${id} switched to ${bufferConnection.instanceRole}`);
                        }
                    }

                    // Brief delay before retry
                    await new Promise(resolve => setTimeout(resolve, 100));
                } else {
                    console.error(`❌ ALL ATTEMPTS FAILED for ${id}: ${error.message}`);
                    throw error;
                }
            }
        }
    }

    /**
     * GET PARTICIPANT with SEAMLESS RECOVERY
     */
    async getParticipant(participantId, searchCriteria = null) {
        try {
            const connection = await this.getParticipantConnection(participantId);
            
            const query = searchCriteria || { participantId: participantId };
            const participant = await connection.findDocument('participants', query);
            
            console.log(`✅ PARTICIPANT RETRIEVED: ${participantId} via ${connection.instanceRole}`);
            return participant;

        } catch (error) {
            console.warn(`⚠️  GET PARTICIPANT FAILED: ${participantId}, attempting seamless recovery...`);
            
            // SEAMLESS RECOVERY: Try buffer connection
            try {
                const bufferConnection = this.shiftSystem.getBufferConnection();
                if (bufferConnection) {
                    const query = searchCriteria || { participantId: participantId };
                    const participant = await bufferConnection.findDocument('participants', query);
                    
                    this.participantConnections.set(participantId, bufferConnection);
                    console.log(`⚡ SEAMLESS RECOVERY: ${participantId} retrieved via ${bufferConnection.instanceRole}`);
                    return participant;
                }
            } catch (recoveryError) {
                console.error(`❌ SEAMLESS RECOVERY FAILED: ${participantId}`, recoveryError.message);
            }
            
            throw error;
        }
    }

    /**
     * UPDATE PARTICIPANT with SEAMLESS OPERATION
     */
    async updateParticipant(participantId, updateData) {
        try {
            const connection = await this.getParticipantConnection(participantId);
            
            const updateInfo = {
                ...updateData,
                lastUpdated: {
                    date: new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Singapore' }),
                    time: new Date().toLocaleTimeString('en-GB', { 
                        timeZone: 'Asia/Singapore',
                        hour12: false, 
                        hour: '2-digit', 
                        minute: '2-digit' 
                    })
                }
            };

            const result = await connection.updateDocument(
                'participants', 
                { participantId: participantId }, 
                { $set: updateInfo }
            );
            
            console.log(`✅ PARTICIPANT UPDATED: ${participantId} via ${connection.instanceRole}`);
            return result;

        } catch (error) {
            console.warn(`⚠️  UPDATE FAILED: ${participantId}, attempting seamless failover...`);
            
            // SEAMLESS FAILOVER for update operation
            const currentConnection = this.participantConnections.get(participantId);
            if (currentConnection) {
                const bufferConnection = this.shiftSystem.moveToBuffer(currentConnection);
                if (bufferConnection) {
                    try {
                        this.participantConnections.set(participantId, bufferConnection);
                        
                        const updateInfo = {
                            ...updateData,
                            lastUpdated: {
                                date: new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Singapore' }),
                                time: new Date().toLocaleTimeString('en-GB', { 
                                    timeZone: 'Asia/Singapore',
                                    hour12: false, 
                                    hour: '2-digit', 
                                    minute: '2-digit' 
                                })
                            }
                        };

                        const result = await bufferConnection.updateDocument(
                            'participants', 
                            { participantId: participantId }, 
                            { $set: updateInfo }
                        );
                        
                        console.log(`⚡ SEAMLESS UPDATE: ${participantId} via ${bufferConnection.instanceRole}`);
                        return result;
                        
                    } catch (bufferError) {
                        console.error(`❌ BUFFER UPDATE FAILED: ${participantId}`, bufferError.message);
                        throw bufferError;
                    }
                }
            }
            
            throw error;
        }
    }

    /**
     * GET SYSTEM STATUS
     */
    getSystemStatus() {
        if (!this.isInitialized || !this.shiftSystem) {
            return { status: 'not_initialized' };
        }

        const connectedInstances = this.shiftSystem.instances.filter(i => i.isConnected);
        const healthyBuffers = this.shiftSystem.bufferInstances.filter(i => i.isHealthy);
        
        return {
            status: 'operational',
            totalInstances: this.shiftSystem.stats.totalInstances,
            connectedInstances: connectedInstances.length,
            bufferConnections: healthyBuffers.length,
            totalBufferPool: this.shiftSystem.stats.bufferConnections,
            failoverCount: this.failoverCount,
            activeParticipants: this.participantConnections.size,
            activeVolunteers: this.volunteerConnections.size,
            isAzureFree: this.shiftSystem.stats.isAzureFree,
            isMongoM0: this.shiftSystem.stats.isMongoM0,
            seamlessOperation: healthyBuffers.length > 50 ? 'COMPREHENSIVE' : 'STANDARD'
        };
    }

    /**
     * CLEANUP CONNECTIONS
     */
    async cleanup() {
        if (this.shiftSystem && this.shiftSystem.instances) {
            console.log('🧹 CLEANING UP SEAMLESS CONNECTIONS...');
            
            const closePromises = this.shiftSystem.instances.map(instance => 
                instance.close().catch(err => 
                    console.warn(`⚠️  Failed to close ${instance.instanceRole}: ${err.message}`)
                )
            );
            
            await Promise.allSettled(closePromises);
            console.log('✅ SEAMLESS CLEANUP COMPLETE');
        }
    }
}

module.exports = EnhancedParticipantsController;
