// Fitness Test Database Setup - Isolated Connections for 500+ participants + 10 volunteers
const DatabaseConnectivity = require('./databaseConnectivity');

class FitnessTestDatabaseManager {
    constructor() {
        this.volunteerInstances = [];
        this.participantInstances = [];
        this.isInitialized = false;
    }

    // Initialize isolated database connections for fitness test
    async initializeFitnessTest() {
        console.log('🏃‍♂️ INITIALIZING FITNESS TEST DATABASE SYSTEM');
        console.log('📊 Target: 10 volunteers + 500+ participants with isolated connections');
        
        // Create 10 isolated instances for volunteers
        this.volunteerInstances = DatabaseConnectivity.createIsolatedInstances(10, {
            silentMode: true,
            connectionCooldown: 200
        });
        
        // Create isolated instances for participants (400 core + overflow handling)
        this.participantInstances = DatabaseConnectivity.createIsolatedInstances(400, {
            silentMode: true,
            connectionCooldown: 300
        });
        
        console.log('✅ Created isolated connections:');
        console.log(`   🎯 Volunteers: ${this.volunteerInstances.length} isolated instances`);
        console.log(`   👥 Participants: ${this.participantInstances.length} isolated instances`);
        console.log(`   📊 Total DB connections: ${this.volunteerInstances.length + this.participantInstances.length}`);
        
        // Initialize all connections
        await this.connectAllInstances();
        
        this.isInitialized = true;
        console.log('🚀 FITNESS TEST DATABASE SYSTEM READY!');
        return this.getSystemStatus();
    }

    // Connect all instances with fault tolerance
    async connectAllInstances() {
        console.log('🔗 Connecting all isolated instances...');
        
        const connectPromises = [
            ...this.volunteerInstances.map(instance => this.safeConnect(instance, 'volunteer')),
            ...this.participantInstances.map(instance => this.safeConnect(instance, 'participant'))
        ];
        
        const results = await Promise.allSettled(connectPromises);
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        console.log(`📊 Connection Results: ${successful} successful, ${failed} failed`);
        if (failed > 0) {
            console.warn(`⚠️  ${failed} connections failed - system will retry automatically`);
        }
    }

    // Safely connect an instance with error handling
    async safeConnect(instance, type) {
        try {
            await instance.initialize();
            return { success: true, instanceId: instance.instanceId, type };
        } catch (error) {
            console.warn(`⚠️  Failed to connect ${type} instance ${instance.instanceId}: ${error.message}`);
            return { success: false, instanceId: instance.instanceId, type, error: error.message };
        }
    }

    // Get a database instance for a specific volunteer
    getVolunteerConnection(volunteerIndex) {
        if (!this.isInitialized) {
            throw new Error('Fitness test system not initialized');
        }
        
        if (volunteerIndex < 0 || volunteerIndex >= this.volunteerInstances.length) {
            throw new Error(`Invalid volunteer index: ${volunteerIndex}. Available: 0-${this.volunteerInstances.length - 1}`);
        }
        
        return DatabaseConnectivity.getFaultTolerantInstance(this.volunteerInstances, volunteerIndex);
    }

    // Get a database instance for a specific participant
    getParticipantConnection(participantIndex) {
        if (!this.isInitialized) {
            throw new Error('Fitness test system not initialized');
        }
        
        // Handle overflow participants (beyond 400)
        if (participantIndex >= this.participantInstances.length) {
            // Use round-robin for overflow participants
            const fallbackIndex = participantIndex % this.participantInstances.length;
            console.log(`📋 Overflow participant ${participantIndex} using fallback connection ${fallbackIndex}`);
            return DatabaseConnectivity.getFaultTolerantInstance(this.participantInstances, fallbackIndex);
        }
        
        return DatabaseConnectivity.getFaultTolerantInstance(this.participantInstances, participantIndex);
    }

    // Get system health status
    getSystemStatus() {
        if (!this.isInitialized) {
            return { initialized: false };
        }
        
        const volunteerHealth = DatabaseConnectivity.getInstancesHealth(this.volunteerInstances);
        const participantHealth = DatabaseConnectivity.getInstancesHealth(this.participantInstances);
        
        return {
            initialized: true,
            volunteers: {
                total: volunteerHealth.total,
                healthy: volunteerHealth.healthy,
                healthPercentage: ((volunteerHealth.healthy / volunteerHealth.total) * 100).toFixed(1) + '%'
            },
            participants: {
                total: participantHealth.total,
                healthy: participantHealth.healthy,
                healthPercentage: ((participantHealth.healthy / participantHealth.total) * 100).toFixed(1) + '%'
            },
            overall: {
                totalConnections: volunteerHealth.total + participantHealth.total,
                healthyConnections: volunteerHealth.healthy + participantHealth.healthy,
                overallHealth: (((volunteerHealth.healthy + participantHealth.healthy) / 
                               (volunteerHealth.total + participantHealth.total)) * 100).toFixed(1) + '%'
            }
        };
    }

    // Monitor system health during fitness test
    startHealthMonitoring(intervalMs = 30000) {
        console.log('📊 Starting health monitoring...');
        
        this.healthMonitorInterval = setInterval(() => {
            const status = this.getSystemStatus();
            console.log(`🏥 Health Check - Overall: ${status.overall.overallHealth} ` +
                       `(${status.overall.healthyConnections}/${status.overall.totalConnections} healthy)`);
            
            if (parseFloat(status.overall.overallHealth) < 90) {
                console.warn(`⚠️  System health below 90% - consider intervention`);
            }
        }, intervalMs);
        
        return this.healthMonitorInterval;
    }

    // Stop health monitoring
    stopHealthMonitoring() {
        if (this.healthMonitorInterval) {
            clearInterval(this.healthMonitorInterval);
            this.healthMonitorInterval = null;
            console.log('🛑 Health monitoring stopped');
        }
    }

    // Graceful shutdown
    async shutdown() {
        console.log('🛑 Shutting down fitness test database system...');
        
        this.stopHealthMonitoring();
        
        const disconnectPromises = [
            ...this.volunteerInstances.map(instance => instance.disconnect()),
            ...this.participantInstances.map(instance => instance.disconnect())
        ];
        
        await Promise.allSettled(disconnectPromises);
        
        this.volunteerInstances = [];
        this.participantInstances = [];
        this.isInitialized = false;
        
        console.log('✅ Fitness test database system shutdown complete');
    }
}

module.exports = FitnessTestDatabaseManager;

// Example usage for fitness test
if (require.main === module) {
    async function runFitnessTestExample() {
        const testManager = new FitnessTestDatabaseManager();
        
        try {
            // Initialize the system
            const status = await testManager.initializeFitnessTest();
            console.log('📊 Initial Status:', JSON.stringify(status, null, 2));
            
            // Start health monitoring
            testManager.startHealthMonitoring(15000); // Check every 15 seconds
            
            // Example: Volunteer 0 scanning participant 25
            const volunteerDb = testManager.getVolunteerConnection(0);
            const participantDb = testManager.getParticipantConnection(25);
            
            console.log('🎯 Volunteer 0 connection:', volunteerDb.instanceId);
            console.log('👤 Participant 25 connection:', participantDb.instanceId);
            
            // Simulate QR scanning operation
            const scanResult = await volunteerDb.getDocument('fitness_test', 'participants', { 
                participantId: 25 
            });
            console.log('📱 QR Scan Result:', scanResult.success ? 'SUCCESS' : 'FAILED');
            
            // Monitor for 1 minute then shutdown
            setTimeout(async () => {
                await testManager.shutdown();
                process.exit(0);
            }, 60000);
            
        } catch (error) {
            console.error('❌ Fitness test setup failed:', error);
            process.exit(1);
        }
    }
    
    runFitnessTestExample();
}
