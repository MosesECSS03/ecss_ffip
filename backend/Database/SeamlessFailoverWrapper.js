/**
 * SEAMLESS FAILOVER WRAPPER for existing DatabaseConnectivity
 * Integrates seamless failover features with your existing code
 * WITHOUT modifying your original databaseConnectivity.js
 */

const DatabaseConnectivity = require('./databaseConnectivity');

class SeamlessFailoverWrapper {
    constructor() {
        this.shiftInstances = [];
        this.participantConnections = new Map(); // Track participant → instance mapping
        this.volunteerConnections = new Map();   // Track volunteer → instance mapping
        this.bufferPool = [];                    // Available standard buffer instances
        this.ultimateFallbackPool = [];          // Ultimate fallback instances
        this.emergencyPool = [];                 // Emergency backup instances
        this.failoverCount = 0;
        this.isInitialized = false;
        
        // Azure Free Tier detection
        this.isAzureFree = process.env.WEBSITE_SKU === 'Free' || 
                          process.env.APP_SERVICE_TIER === 'Free' || 
                          !process.env.WEBSITE_SKU;
        this.isMongoM0 = !process.env.MONGODB_TIER && !process.env.ATLAS_CLUSTER_TIER;
    }

    /**
     * INITIALIZE with your existing DatabaseConnectivity instances
     */
    async initializeSeamlessSystem(participantCount = 20, volunteerCount = 6, standardBuffer = 200, ultimateFallback = 25) {
        if (this.isInitialized) {
            return this.getSystemStatus();
        }

        try {
            console.log('🚀 INITIALIZING ENHANCED SEAMLESS FAILOVER with existing DatabaseConnectivity');
            console.log(`🎯 Target: ${participantCount} participants + ${volunteerCount} volunteers + ${standardBuffer} buffer + ${ultimateFallback} ultimate fallback`);

            const totalUsers = participantCount + volunteerCount;
            const totalBufferConnections = standardBuffer + ultimateFallback;
            const maxInstances = 100; // Azure Free limit
            const actualBufferConnections = Math.min(totalBufferConnections, maxInstances - totalUsers - 5);
            const actualStandardBuffer = Math.min(standardBuffer, actualBufferConnections);
            const actualUltimateFallback = actualBufferConnections - actualStandardBuffer;
            const emergencyConnections = maxInstances - totalUsers - actualBufferConnections;

            console.log(`📊 Creating ${totalUsers + actualBufferConnections + emergencyConnections} instances:`);
            console.log(`   - ${participantCount} participants`);
            console.log(`   - ${volunteerCount} volunteers`);
            console.log(`   - ${actualStandardBuffer} standard buffer connections`);
            console.log(`   - ${actualUltimateFallback} ultimate fallback connections`);
            console.log(`   - ${emergencyConnections} emergency connections`);

            // Create instances using your existing DatabaseConnectivity class
            this.shiftInstances = [];
            
            // Create participant instances
            for (let i = 0; i < participantCount; i++) {
                const instance = new DatabaseConnectivity({
                    instanceId: `participant_${i + 1}_${Date.now()}`,
                    maxPoolSize: 1,
                    minPoolSize: 1,
                    silentMode: true,
                    isolatedMode: true,
                    // Skip problematic MongoDB options to ensure compatibility
                    connectionCooldown: this.isAzureFree ? 100 : 25
                });
                instance.instanceType = 'participant';
                instance.instanceRole = `participant_${i + 1}`;
                this.shiftInstances.push(instance);
            }

            // Create volunteer instances
            for (let i = 0; i < volunteerCount; i++) {
                const instance = new DatabaseConnectivity({
                    instanceId: `volunteer_${i + 1}_${Date.now()}`,
                    maxPoolSize: 1,
                    minPoolSize: 1,
                    silentMode: true,
                    isolatedMode: true,
                    connectionCooldown: this.isAzureFree ? 100 : 25
                });
                instance.instanceType = 'volunteer';
                instance.instanceRole = `volunteer_${i + 1}`;
                this.shiftInstances.push(instance);
            }

            // Create standard buffer instances
            for (let i = 0; i < actualStandardBuffer; i++) {
                const instance = new DatabaseConnectivity({
                    instanceId: `buffer_${i + 1}_${Date.now()}`,
                    maxPoolSize: 1,
                    minPoolSize: 1,
                    silentMode: true,
                    isolatedMode: true,
                    connectionCooldown: this.isAzureFree ? 100 : 25
                });
                instance.instanceType = 'buffer';
                instance.instanceRole = `buffer_${i + 1}`;
                this.bufferPool.push(instance);
                this.shiftInstances.push(instance);
            }

            // Create ultimate fallback instances
            this.ultimateFallbackPool = [];
            for (let i = 0; i < actualUltimateFallback; i++) {
                const instance = new DatabaseConnectivity({
                    instanceId: `ultimate_${i + 1}_${Date.now()}`,
                    maxPoolSize: 1,
                    minPoolSize: 1,
                    silentMode: true,
                    isolatedMode: true,
                    connectionCooldown: this.isAzureFree ? 100 : 25
                });
                instance.instanceType = 'ultimate_fallback';
                instance.instanceRole = `ultimate_${i + 1}`;
                this.ultimateFallbackPool.push(instance);
                this.shiftInstances.push(instance);
            }

            // Create emergency instances
            for (let i = 0; i < emergencyConnections; i++) {
                const instance = new DatabaseConnectivity({
                    instanceId: `emergency_${i + 1}_${Date.now()}`,
                    maxPoolSize: 1,
                    minPoolSize: 1,
                    silentMode: true,
                    isolatedMode: true,
                    connectionCooldown: this.isAzureFree ? 100 : 25
                });
                instance.instanceType = 'emergency';
                instance.instanceRole = `emergency_${i + 1}`;
                this.emergencyPool.push(instance);
                this.shiftInstances.push(instance);
            }

            // Connect all instances
            console.log('🔌 CONNECTING ALL INSTANCES...');
            const connectionPromises = this.shiftInstances.map(instance => 
                instance.initialize().catch(err => {
                    console.warn(`⚠️  Failed to connect ${instance.instanceRole}: ${err.message}`);
                    return null;
                })
            );

            await Promise.allSettled(connectionPromises);

            const connectedCount = this.shiftInstances.filter(i => i.isConnected).length;
            console.log(`✅ CONNECTED: ${connectedCount}/${this.shiftInstances.length} instances`);

            this.isInitialized = true;
            console.log('🎯 SEAMLESS FAILOVER SYSTEM READY');
            console.log('💡 Use getParticipantConnection() and getVolunteerConnection() methods');

            return this.getSystemStatus();

        } catch (error) {
            console.error('❌ SEAMLESS SYSTEM INITIALIZATION FAILED:', error.message);
            throw error;
        }
    }

    /**
     * GET SEAMLESS CONNECTION for participant
     */
    async getParticipantConnection(participantId) {
        await this.ensureInitialized();

        try {
            // Check if participant already has a connection
            if (this.participantConnections.has(participantId)) {
                const existingConnection = this.participantConnections.get(participantId);
                if (existingConnection.isConnected && existingConnection.isHealthy) {
                    return existingConnection;
                }
            }

            // Get healthy participant instance
            const participantInstances = this.shiftInstances.filter(
                instance => instance.instanceType === 'participant' && 
                           instance.isConnected && 
                           instance.isHealthy
            );

            let selectedConnection = null;

            if (participantInstances.length > 0) {
                // Use least loaded participant instance
                selectedConnection = participantInstances.reduce((best, current) => {
                    const bestLoad = best.performanceMetrics?.totalRequests || 0;
                    const currentLoad = current.performanceMetrics?.totalRequests || 0;
                    return currentLoad < bestLoad ? current : best;
                });
            } else {
                // SEAMLESS FAILOVER: Use buffer connection
                console.log(`🔄 SEAMLESS FAILOVER: No participant connections available for ${participantId}`);
                selectedConnection = await this.getBufferConnection();
                if (selectedConnection) {
                    console.log(`⚡ BUFFER ASSIGNED: ${participantId} → ${selectedConnection.instanceRole}`);
                }
            }

            if (!selectedConnection) {
                throw new Error(`No healthy connections available for participant ${participantId}`);
            }

            this.participantConnections.set(participantId, selectedConnection);
            console.log(`✅ PARTICIPANT CONNECTION: ${participantId} → ${selectedConnection.instanceRole}`);
            return selectedConnection;

        } catch (error) {
            console.error(`❌ PARTICIPANT CONNECTION FAILED: ${participantId}`, error.message);
            throw error;
        }
    }

    /**
     * GET SEAMLESS CONNECTION for volunteer
     */
    async getVolunteerConnection(volunteerId) {
        await this.ensureInitialized();

        try {
            // Check if volunteer already has a connection
            if (this.volunteerConnections.has(volunteerId)) {
                const existingConnection = this.volunteerConnections.get(volunteerId);
                if (existingConnection.isConnected && existingConnection.isHealthy) {
                    return existingConnection;
                }
            }

            // Get healthy volunteer instance
            const volunteerInstances = this.shiftInstances.filter(
                instance => instance.instanceType === 'volunteer' && 
                           instance.isConnected && 
                           instance.isHealthy
            );

            let selectedConnection = null;

            if (volunteerInstances.length > 0) {
                // Use least loaded volunteer instance
                selectedConnection = volunteerInstances.reduce((best, current) => {
                    const bestLoad = best.performanceMetrics?.totalRequests || 0;
                    const currentLoad = current.performanceMetrics?.totalRequests || 0;
                    return currentLoad < bestLoad ? current : best;
                });
            } else {
                // SEAMLESS FAILOVER: Use buffer connection
                console.log(`🔄 SEAMLESS FAILOVER: No volunteer connections available for ${volunteerId}`);
                selectedConnection = await this.getBufferConnection();
                if (selectedConnection) {
                    console.log(`⚡ BUFFER ASSIGNED: ${volunteerId} → ${selectedConnection.instanceRole}`);
                }
            }

            if (!selectedConnection) {
                throw new Error(`No healthy connections available for volunteer ${volunteerId}`);
            }

            this.volunteerConnections.set(volunteerId, selectedConnection);
            console.log(`✅ VOLUNTEER CONNECTION: ${volunteerId} → ${selectedConnection.instanceRole}`);
            return selectedConnection;

        } catch (error) {
            console.error(`❌ VOLUNTEER CONNECTION FAILED: ${volunteerId}`, error.message);
            throw error;
        }
    }

    /**
     * GET BUFFER CONNECTION for seamless failover
     */
    async getBufferConnection() {
        // PRIORITY 1: Try standard buffer pool first
        const availableBuffers = this.bufferPool.filter(
            instance => instance.isConnected && instance.isHealthy
        );

        if (availableBuffers.length > 0) {
            // Return least loaded standard buffer
            return availableBuffers.reduce((best, current) => {
                const bestLoad = best.performanceMetrics?.totalRequests || 0;
                const currentLoad = current.performanceMetrics?.totalRequests || 0;
                return currentLoad < bestLoad ? current : best;
            });
        }

        // PRIORITY 2: Try ultimate fallback pool if standard buffers exhausted
        const availableUltimateFallback = this.ultimateFallbackPool.filter(
            instance => instance.isConnected && instance.isHealthy
        );

        if (availableUltimateFallback.length > 0) {
            console.log('🛡️ ULTIMATE FALLBACK ENGAGED - Using ultimate protection layer');
            return availableUltimateFallback.reduce((best, current) => {
                const bestLoad = best.performanceMetrics?.totalRequests || 0;
                const currentLoad = current.performanceMetrics?.totalRequests || 0;
                return currentLoad < bestLoad ? current : best;
            });
        }

        // PRIORITY 3: If both buffer tiers exhausted, try emergency pool
        const availableEmergency = this.emergencyPool.filter(
            instance => instance.isConnected && instance.isHealthy
        );

        if (availableEmergency.length > 0) {
            console.log('🚨 EMERGENCY CONNECTION ACTIVATED - Last resort protection');
            return availableEmergency[0];
        }

        console.warn('❌ ALL BUFFER TIERS EXHAUSTED - No healthy connections available');
        return null;
    }

    /**
     * MOVE FAILED CONNECTION to buffer pool
     */
    async moveToBuffer(failedInstance, userId = null, userType = 'participant') {
        if (!failedInstance) return null;

        console.log(`🔧 MOVING TO BUFFER: ${failedInstance.instanceRole} failed for ${userType} ${userId}`);

        // Mark as unhealthy and start background recovery
        failedInstance.isHealthy = false;
        failedInstance.isConnected = false;

        // Start background recovery (non-blocking)
        setTimeout(() => {
            console.log(`🔄 BACKGROUND RECOVERY: Repairing ${failedInstance.instanceRole}`);
            failedInstance.initialize().catch(err => {
                console.warn(`⚠️  Recovery failed for ${failedInstance.instanceRole}: ${err.message}`);
            });
        }, 100); // Minimal delay

        // Get buffer connection
        const bufferConnection = await this.getBufferConnection();

        if (bufferConnection) {
            this.failoverCount++;
            console.log(`⚡ SEAMLESS FAILOVER ${this.failoverCount}: ${userType} ${userId} switched to ${bufferConnection.instanceRole}`);
            
            // Update connection mapping
            if (userType === 'participant' && userId) {
                this.participantConnections.set(userId, bufferConnection);
            } else if (userType === 'volunteer' && userId) {
                this.volunteerConnections.set(userId, bufferConnection);
            }
            
            return bufferConnection;
        }

        console.warn(`⚠️  No buffer connections available for ${userType} ${userId}`);
        return null;
    }

    /**
     * SEAMLESS DATABASE OPERATIONS with automatic failover
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

                // Insert using your existing method
                const result = await connection.insertDocument('fitness_test', 'participants', newParticipant);
                
                if (result.success) {
                    console.log(`✅ PARTICIPANT ADDED: ${id} via ${connection.instanceRole}`);
                    return result;
                } else {
                    throw new Error(result.error || 'Insert failed');
                }

            } catch (error) {
                console.warn(`⚠️  ATTEMPT ${attemptCount} FAILED for ${id}: ${error.message}`);

                if (attemptCount < maxAttempts) {
                    // SEAMLESS FAILOVER: Move to buffer and retry
                    console.log(`🔄 TRIGGERING SEAMLESS FAILOVER for ${id}...`);
                    
                    const currentConnection = this.participantConnections.get(id);
                    if (currentConnection) {
                        await this.moveToBuffer(currentConnection, id, 'participant');
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
     * GET PARTICIPANT with seamless recovery
     */
    async getParticipant(participantId, searchCriteria = null) {
        try {
            const connection = await this.getParticipantConnection(participantId);
            
            const query = searchCriteria || { participantId: participantId };
            const result = await connection.getDocument('fitness_test', 'participants', query);
            
            if (result.success) {
                console.log(`✅ PARTICIPANT RETRIEVED: ${participantId} via ${connection.instanceRole}`);
                return result;
            } else {
                throw new Error(result.error || 'Get failed');
            }

        } catch (error) {
            console.warn(`⚠️  GET PARTICIPANT FAILED: ${participantId}, attempting seamless recovery...`);
            
            // SEAMLESS RECOVERY: Try buffer connection
            try {
                const bufferConnection = await this.getBufferConnection();
                if (bufferConnection) {
                    const query = searchCriteria || { participantId: participantId };
                    const result = await bufferConnection.getDocument('fitness_test', 'participants', query);
                    
                    this.participantConnections.set(participantId, bufferConnection);
                    console.log(`⚡ SEAMLESS RECOVERY: ${participantId} retrieved via ${bufferConnection.instanceRole}`);
                    return result;
                }
            } catch (recoveryError) {
                console.error(`❌ SEAMLESS RECOVERY FAILED: ${participantId}`, recoveryError.message);
            }
            
            throw error;
        }
    }

    /**
     * UPDATE PARTICIPANT with seamless operation
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
                'fitness_test', 
                'participants',
                { participantId: participantId }, 
                { $set: updateInfo }
            );
            
            if (result.success) {
                console.log(`✅ PARTICIPANT UPDATED: ${participantId} via ${connection.instanceRole}`);
                return result;
            } else {
                throw new Error(result.error || 'Update failed');
            }

        } catch (error) {
            console.warn(`⚠️  UPDATE FAILED: ${participantId}, attempting seamless failover...`);
            
            // SEAMLESS FAILOVER for update operation
            const currentConnection = this.participantConnections.get(participantId);
            if (currentConnection) {
                const bufferConnection = await this.moveToBuffer(currentConnection, participantId, 'participant');
                if (bufferConnection) {
                    try {
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
                            'fitness_test', 
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
     * Ensure system is initialized
     */
    async ensureInitialized() {
        if (!this.isInitialized) {
            await this.initializeSeamlessSystem();
        }
    }

    /**
     * GET SYSTEM STATUS
     */
    getSystemStatus() {
        if (!this.isInitialized) {
            return { status: 'not_initialized' };
        }

        const connectedInstances = this.shiftInstances.filter(i => i.isConnected);
        const healthyBuffers = this.bufferPool.filter(i => i.isHealthy);
        const healthyEmergency = this.emergencyPool.filter(i => i.isHealthy);
        
        return {
            status: 'operational',
            totalInstances: this.shiftInstances.length,
            connectedInstances: connectedInstances.length,
            bufferConnections: healthyBuffers.length,
            totalBufferPool: this.bufferPool.length,
            emergencyConnections: healthyEmergency.length,
            totalEmergencyPool: this.emergencyPool.length,
            failoverCount: this.failoverCount,
            activeParticipants: this.participantConnections.size,
            activeVolunteers: this.volunteerConnections.size,
            isAzureFree: this.isAzureFree,
            isMongoM0: this.isMongoM0,
            seamlessOperation: healthyBuffers.length > 50 ? 'COMPREHENSIVE' : 'STANDARD'
        };
    }

    /**
     * CLEANUP CONNECTIONS
     */
    async cleanup() {
        if (this.shiftInstances.length > 0) {
            console.log('🧹 CLEANING UP SEAMLESS CONNECTIONS...');
            
            const closePromises = this.shiftInstances.map(instance => 
                instance.disconnect().catch(err => 
                    console.warn(`⚠️  Failed to close ${instance.instanceRole}: ${err.message}`)
                )
            );
            
            await Promise.allSettled(closePromises);
            console.log('✅ SEAMLESS CLEANUP COMPLETE');
        }
    }
}

module.exports = SeamlessFailoverWrapper;
