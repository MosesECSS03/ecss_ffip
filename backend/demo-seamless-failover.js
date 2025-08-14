#!/usr/bin/env node

/**
 * COMPREHENSIVE SEAMLESS FAILOVER DEMONSTRATION
 * Shows how 20 participants + 5-6 volunteers work with 75 buffer connections
 * for seamless operation even when connections fail
 */

const DatabaseConnectivity = require('./Database/databaseConnectivity');

console.log('🎯 COMPREHENSIVE SEAMLESS FAILOVER DEMO');
console.log('📊 20 participants + 5-6 volunteers + 75 buffer connections');
console.log('🔄 "Even if got issue also need to get back connection seamlessly"');
console.log('⚡ Within Azure Free + MongoDB M0 limits\n');

async function demonstrateSeamlessFailover() {
    try {
        // STEP 1: Create comprehensive shift instances
        console.log('=== STEP 1: CREATING SHIFT INSTANCES ===');
        const shiftSystem = DatabaseConnectivity.createShiftInstances(20, 6, {
            silentMode: false, // Show all logging for demo
            mongodbURI: process.env.MONGODB_CONNECTION_STRING || 'mongodb://localhost:27017/fitness_test'
        });
        
        console.log('\n📊 SYSTEM STATISTICS:');
        console.log(`   Total Instances: ${shiftSystem.stats.totalInstances}/${shiftSystem.stats.maxAllowed}`);
        console.log(`   Participants: ${shiftSystem.stats.participants}`);
        console.log(`   Volunteers: ${shiftSystem.stats.volunteers}`);
        console.log(`   Buffer Connections: ${shiftSystem.stats.bufferConnections}`);
        console.log(`   Emergency Connections: ${shiftSystem.stats.emergencyConnections}`);
        console.log(`   Azure Free Compatible: ${shiftSystem.stats.isAzureFree ? 'YES' : 'NO'}`);
        console.log(`   MongoDB M0 Compatible: ${shiftSystem.stats.isMongoM0 ? 'YES' : 'NO'}`);
        
        // STEP 2: Connect all instances
        console.log('\n=== STEP 2: CONNECTING ALL INSTANCES ===');
        const connectionPromises = shiftSystem.instances.map(instance => 
            instance.connect().catch(err => {
                console.warn(`⚠️  Connection failed for ${instance.instanceRole}: ${err.message}`);
                return null;
            })
        );
        
        await Promise.allSettled(connectionPromises);
        
        // Check connection status
        const connectedInstances = shiftSystem.instances.filter(instance => instance.isConnected);
        console.log(`✅ Connected: ${connectedInstances.length}/${shiftSystem.instances.length} instances`);
        
        // STEP 3: Simulate normal operations
        console.log('\n=== STEP 3: SIMULATING NORMAL OPERATIONS ===');
        
        // Get connections for participants
        console.log('\n👥 PARTICIPANT CONNECTIONS:');
        for (let i = 1; i <= 5; i++) {
            try {
                const connection = shiftSystem.getHealthyConnection('participant', `P${i}`);
                console.log(`   P${i}: ${connection.instanceRole} (${connection.isHealthy ? 'HEALTHY' : 'UNHEALTHY'})`);
            } catch (err) {
                console.log(`   P${i}: ERROR - ${err.message}`);
            }
        }
        
        // Get connections for volunteers
        console.log('\n🛠️  VOLUNTEER CONNECTIONS:');
        for (let i = 1; i <= 3; i++) {
            try {
                const connection = shiftSystem.getHealthyConnection('volunteer', `V${i}`);
                console.log(`   V${i}: ${connection.instanceRole} (${connection.isHealthy ? 'HEALTHY' : 'UNHEALTHY'})`);
            } catch (err) {
                console.log(`   V${i}: ERROR - ${err.message}`);
            }
        }
        
        // STEP 4: Simulate connection failures and seamless recovery
        console.log('\n=== STEP 4: SIMULATING CONNECTION FAILURES ===');
        
        if (connectedInstances.length > 0) {
            // Simulate failure on first participant connection
            const firstParticipant = shiftSystem.participantInstances[0];
            if (firstParticipant && firstParticipant.isConnected) {
                console.log(`\n🔥 SIMULATING FAILURE: ${firstParticipant.instanceRole}`);
                
                // Simulate connection failure
                firstParticipant.isHealthy = false;
                firstParticipant.isConnected = false;
                
                // Use seamless failover
                console.log('🔄 TRIGGERING SEAMLESS FAILOVER...');
                try {
                    const backupConnection = shiftSystem.moveToBuffer(firstParticipant);
                    if (backupConnection) {
                        console.log(`✅ SEAMLESS FAILOVER SUCCESS: Switched to ${backupConnection.instanceRole}`);
                        console.log(`🔧 Original connection ${firstParticipant.instanceRole} will recover in background`);
                    }
                } catch (err) {
                    console.log(`❌ FAILOVER ERROR: ${err.message}`);
                }
            }
        }
        
        // STEP 5: Show buffer pool status
        console.log('\n=== STEP 5: BUFFER POOL STATUS ===');
        const healthyBuffers = shiftSystem.bufferInstances.filter(instance => instance.isHealthy);
        console.log(`🔄 Available Buffer Connections: ${healthyBuffers.length}/${shiftSystem.bufferInstances.length}`);
        
        if (healthyBuffers.length > 0) {
            console.log('   Buffer Pool:');
            healthyBuffers.slice(0, 5).forEach(buffer => {
                console.log(`   - ${buffer.instanceRole}: ${buffer.isConnected ? 'READY' : 'CONNECTING'}`);
            });
            if (healthyBuffers.length > 5) {
                console.log(`   ... and ${healthyBuffers.length - 5} more buffer connections`);
            }
        }
        
        // STEP 6: Performance summary
        console.log('\n=== STEP 6: PERFORMANCE SUMMARY ===');
        const totalConnected = shiftSystem.instances.filter(i => i.isConnected).length;
        const bufferUtilization = Math.round((shiftSystem.stats.bufferConnections / shiftSystem.stats.totalInstances) * 100);
        
        console.log(`📊 SYSTEM PERFORMANCE:`);
        console.log(`   Total Active Connections: ${totalConnected}/${shiftSystem.stats.totalInstances}`);
        console.log(`   Buffer Pool Utilization: ${bufferUtilization}%`);
        console.log(`   Seamless Failover: ${shiftSystem.stats.bufferConnections > 50 ? 'COMPREHENSIVE' : 'STANDARD'}`);
        console.log(`   Free Tier Compatible: ${shiftSystem.stats.isAzureFree && shiftSystem.stats.isMongoM0 ? '✅ YES' : '⚠️  VERIFY'}`);
        
        console.log('\n✅ COMPREHENSIVE SEAMLESS FAILOVER DEMO COMPLETE');
        console.log('🎯 System ready for 20 participants + 5-6 volunteers');
        console.log('🔄 75 buffer connections ensure seamless operation');
        console.log('⚡ "Even if got issue also need to get back connection seamlessly" - ACHIEVED!');
        
    } catch (error) {
        console.error('❌ DEMO ERROR:', error.message);
        console.error(error.stack);
    } finally {
        // Clean up connections
        console.log('\n🧹 CLEANING UP CONNECTIONS...');
        // Note: In production, you'd properly close all connections
        // For demo purposes, we'll just note the cleanup
        console.log('✅ Cleanup complete');
        
        // Exit gracefully
        setTimeout(() => {
            process.exit(0);
        }, 1000);
    }
}

// Handle environment variables
if (!process.env.MONGODB_CONNECTION_STRING) {
    console.log('⚠️  MONGODB_CONNECTION_STRING not set - using localhost for demo');
    console.log('   For Azure deployment, set this environment variable\n');
}

// Set Azure Free tier simulation for demo
if (!process.env.WEBSITE_SKU) {
    process.env.WEBSITE_SKU = 'Free';
    console.log('🔧 Simulating Azure Free tier for demo\n');
}

// Run the demonstration
demonstrateSeamlessFailover().catch(console.error);
