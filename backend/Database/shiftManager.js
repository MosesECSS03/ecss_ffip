const DatabaseConnectivity = require('./databaseConnectivity');

/**
 * SHIFT MANAGER - Complete shift operation management for 20 participants + 6 volunteers
 * Features:
 * - 26 primary connections (20 participants + 6 volunteers)
 * - 75 MASSIVE buffer connections for seamless failover
 * - 15 reserved emergency connections
 * - Total: 116 completely independent parallel connections
 * - ZERO downtime failover with background recovery
 */
class ShiftManager {
    constructor(participantCount = 20, volunteerCount = 6) {
        this.participantCount = participantCount;
        this.volunteerCount = volunteerCount;
        this.totalUsers = participantCount + volunteerCount;
        
        // Connection tracking
        this.instances = null;
        this.userConnections = new Map(); // userId -> {connection, instanceId, userType}
        this.connectionHistory = new Map(); // Track connection failures and recoveries
        this.failoverLog = []; // Log all failover events
        
        // Performance monitoring
        this.shiftStartTime = null;
        this.totalFailovers = 0;
        this.totalRecoveries = 0;
        this.averageFailoverTime = 0;
        
        console.log(`🎯 SHIFT MANAGER initialized for ${this.totalUsers} users`);
        console.log(`   👥 ${participantCount} Participants`);
        console.log(`   🛠️  ${volunteerCount} Volunteers`);
        console.log(`   🔄 75 Buffer connections for seamless failover`);
        console.log(`   🚨 15 Reserved emergency connections`);
    }

    // Initialize the shift with all database connections
    async initializeShift(options = {}) {
        console.log(`🚀 INITIALIZING SHIFT with ${this.totalUsers} users...`);
        this.shiftStartTime = Date.now();
        
        try {
            // Create ALL shift instances (26 primary + 75 buffer + 15 reserved = 116 total)
            this.instances = DatabaseConnectivity.createShiftInstances(
                this.participantCount, 
                this.volunteerCount, 
                {
                    ...options,
                    silentMode: true // Keep quiet during shift operations
                }
            );

            // Initialize all connections in parallel for MAXIMUM speed
            console.log(`⚡ Starting parallel initialization of ${this.instances.length} connections...`);
            
            const initPromises = this.instances.map(async (instance, index) => {
                try {
                    await instance.initialize();
                    return { index, success: true, instanceId: instance.instanceId };
                } catch (error) {
                    return { index, success: false, instanceId: instance.instanceId, error: error.message };
                }
            });

            const results = await Promise.allSettled(initPromises);
            
            let successCount = 0;
            let failCount = 0;
            
            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value.success) {
                    successCount++;
                } else {
                    failCount++;
                    console.warn(`⚠️  Instance ${index} failed to initialize: ${result.value?.error || 'Unknown error'}`);
                }
            });

            const initTime = Date.now() - this.shiftStartTime;
            console.log(`✅ SHIFT INITIALIZATION COMPLETE:`);
            console.log(`   ⚡ Time: ${initTime}ms`);
            console.log(`   ✅ Success: ${successCount}/${this.instances.length} connections`);
            console.log(`   ❌ Failed: ${failCount}/${this.instances.length} connections`);
            console.log(`   🎯 Ready for ${this.totalUsers} simultaneous users!`);

            // If we have at least 50% connections, we're good to go
            if (successCount >= this.instances.length * 0.5) {
                console.log(`🎯 SHIFT READY: ${successCount} healthy connections available`);
                return {
                    success: true,
                    healthyConnections: successCount,
                    totalConnections: this.instances.length,
                    initializationTime: initTime
                };
            } else {
                throw new Error(`Insufficient healthy connections: ${successCount}/${this.instances.length}`);
            }

        } catch (error) {
            console.error(`❌ SHIFT INITIALIZATION FAILED:`, error);
            throw error;
        }
    }

    // Assign a connection to a user (participant or volunteer)
    assignUserConnection(userId, userType = 'participant') {
        if (!this.instances) {
            throw new Error('Shift not initialized. Call initializeShift() first.');
        }

        try {
            // Check if user already has a connection
            if (this.userConnections.has(userId)) {
                const existing = this.userConnections.get(userId);
                console.log(`♻️  User ${userId} already has connection: ${existing.instanceId}`);
                return existing.connection;
            }

            // Get optimal connection for this user
            const connection = DatabaseConnectivity.getShiftConnection(
                this.instances, 
                userType, 
                userId
            );

            // Track the assignment
            this.userConnections.set(userId, {
                connection: connection,
                instanceId: connection.instanceId,
                userType: userType,
                assignedAt: Date.now(),
                failoverCount: 0
            });

            console.log(`✅ User ${userId} (${userType}) assigned to ${connection.instanceRole}`);
            return connection;

        } catch (error) {
            console.error(`❌ Failed to assign connection to user ${userId}:`, error);
            throw error;
        }
    }

    // Handle connection failure with SEAMLESS failover
    async handleUserConnectionFailure(userId) {
        if (!this.userConnections.has(userId)) {
            throw new Error(`User ${userId} not found in connection tracking`);
        }

        const userInfo = this.userConnections.get(userId);
        const failureTime = Date.now();
        
        console.log(`🔄 HANDLING CONNECTION FAILURE for user ${userId}`);

        try {
            // Perform SEAMLESS failover
            const failoverResult = DatabaseConnectivity.handleConnectionFailure(
                this.instances,
                userInfo.instanceId,
                userInfo.userType,
                userId
            );

            if (failoverResult) {
                // Update user's connection to the new buffer connection
                this.userConnections.set(userId, {
                    ...userInfo,
                    connection: failoverResult.newConnection,
                    instanceId: failoverResult.newConnection.instanceId,
                    failoverCount: userInfo.failoverCount + 1,
                    lastFailoverAt: failureTime
                });

                // Log the failover event
                const failoverTime = Date.now() - failureTime;
                this.failoverLog.push({
                    userId: userId,
                    userType: userInfo.userType,
                    oldInstanceId: userInfo.instanceId,
                    newInstanceId: failoverResult.newConnection.instanceId,
                    failoverTime: failoverTime,
                    timestamp: failureTime
                });

                this.totalFailovers++;
                this.averageFailoverTime = ((this.averageFailoverTime * (this.totalFailovers - 1)) + failoverTime) / this.totalFailovers;

                console.log(`⚡ SEAMLESS FAILOVER COMPLETE for user ${userId}:`);
                console.log(`   🔄 Time: ${failoverTime}ms (Average: ${this.averageFailoverTime.toFixed(0)}ms)`);
                console.log(`   📊 Total failovers: ${this.totalFailovers}`);

                return failoverResult.newConnection;
            } else {
                throw new Error('Failover failed - no healthy connections available');
            }

        } catch (error) {
            console.error(`❌ FAILOVER FAILED for user ${userId}:`, error);
            throw error;
        }
    }

    // Get comprehensive shift health status
    getShiftHealth() {
        if (!this.instances) {
            return { error: 'Shift not initialized' };
        }

        const health = DatabaseConnectivity.getShiftHealth(this.instances);
        const uptime = this.shiftStartTime ? Date.now() - this.shiftStartTime : 0;

        return {
            ...health,
            shift: {
                uptime: uptime,
                totalUsers: this.totalUsers,
                activeUsers: this.userConnections.size,
                totalFailovers: this.totalFailovers,
                totalRecoveries: this.totalRecoveries,
                averageFailoverTime: this.averageFailoverTime
            },
            recommendations: this._getHealthRecommendations(health)
        };
    }

    // Get detailed shift statistics
    getShiftStatistics() {
        const health = this.getShiftHealth();
        
        return {
            overview: {
                totalConnections: this.instances ? this.instances.length : 0,
                healthyConnections: health.healthy,
                activeUsers: this.userConnections.size,
                uptime: health.shift.uptime
            },
            performance: {
                totalFailovers: this.totalFailovers,
                averageFailoverTime: this.averageFailoverTime,
                successRate: this.totalFailovers > 0 ? 
                    ((this.totalRecoveries / this.totalFailovers) * 100).toFixed(1) + '%' : '100%'
            },
            connectionBreakdown: {
                participants: health.participants,
                volunteers: health.volunteers,
                buffers: health.buffers,
                reserved: health.reserved
            },
            recentFailovers: this.failoverLog.slice(-10) // Last 10 failovers
        };
    }

    // Private method to get health recommendations
    _getHealthRecommendations(health) {
        const recommendations = [];

        if (health.healthy < health.total * 0.8) {
            recommendations.push('⚠️ Less than 80% connections healthy - monitor closely');
        }

        if (health.buffers.healthy < health.buffers.total * 0.5) {
            recommendations.push('🚨 Buffer pool depleted - critical situation');
        }

        if (this.totalFailovers > this.totalUsers) {
            recommendations.push('📊 High failover rate - investigate network issues');
        }

        if (this.averageFailoverTime > 500) {
            recommendations.push('⚡ Slow failover times - optimize connection settings');
        }

        if (recommendations.length === 0) {
            recommendations.push('✅ All systems optimal - shift running smoothly');
        }

        return recommendations;
    }

    // Gracefully shutdown the shift
    async shutdownShift() {
        console.log(`🔌 SHUTTING DOWN SHIFT...`);
        
        if (this.instances) {
            const shutdownPromises = this.instances.map(async (instance) => {
                try {
                    await instance.disconnect();
                    return { success: true, instanceId: instance.instanceId };
                } catch (error) {
                    return { success: false, instanceId: instance.instanceId, error: error.message };
                }
            });

            const results = await Promise.allSettled(shutdownPromises);
            let successCount = 0;
            
            results.forEach((result) => {
                if (result.status === 'fulfilled' && result.value.success) {
                    successCount++;
                }
            });

            console.log(`✅ SHIFT SHUTDOWN COMPLETE: ${successCount}/${this.instances.length} connections closed`);
        }

        // Clear tracking
        this.userConnections.clear();
        this.instances = null;

        const totalUptime = this.shiftStartTime ? Date.now() - this.shiftStartTime : 0;
        console.log(`📊 SHIFT SUMMARY:`);
        console.log(`   ⏱️  Total uptime: ${Math.floor(totalUptime / 1000)}s`);
        console.log(`   👥 Users served: ${this.userConnections.size}`);
        console.log(`   🔄 Total failovers: ${this.totalFailovers}`);
        console.log(`   ⚡ Average failover time: ${this.averageFailoverTime.toFixed(0)}ms`);
    }
}

module.exports = ShiftManager;
