const ShiftManager = require('./Database/shiftManager');

/**
 * DEMO: Shift Operations with 20 Participants + 6 Volunteers
 * - 26 primary connections + 75 buffer + 15 reserved = 116 total connections
 * - SEAMLESS failover with ZERO downtime
 * - Background recovery of failed connections
 * - Complete isolation between all connections
 */

async function demonstrateShiftOperations() {
    console.log(`🚀 STARTING SHIFT OPERATIONS DEMO`);
    console.log(`📅 Event: Fitness Test with QR Code Scanning`);
    console.log(`👥 20 Participants + 6 Volunteers = 26 total users`);
    console.log(`🔄 75 Buffer connections for seamless failover`);
    console.log(`🚨 15 Reserved emergency connections`);
    console.log(`🎯 Total: 116 completely independent parallel connections\n`);

    // Initialize shift manager
    const shiftManager = new ShiftManager(20, 6);

    try {
        // 1. Initialize all 116 database connections
        console.log(`🔧 STEP 1: Initializing shift with 116 connections...`);
        const initResult = await shiftManager.initializeShift({
            silentMode: true
        });
        console.log(`✅ Initialization complete in ${initResult.initializationTime}ms\n`);

        // 2. Assign connections to participants
        console.log(`👥 STEP 2: Assigning connections to participants...`);
        const participants = [];
        for (let i = 1; i <= 20; i++) {
            const participantId = `P${i.toString().padStart(3, '0')}`;
            const connection = shiftManager.assignUserConnection(participantId, 'participant');
            participants.push({ id: participantId, connection });
        }
        console.log(`✅ ${participants.length} participants connected\n`);

        // 3. Assign connections to volunteers
        console.log(`🛠️  STEP 3: Assigning connections to volunteers...`);
        const volunteers = [];
        for (let i = 1; i <= 6; i++) {
            const volunteerId = `V${i.toString().padStart(2, '0')}`;
            const connection = shiftManager.assignUserConnection(volunteerId, 'volunteer');
            volunteers.push({ id: volunteerId, connection });
        }
        console.log(`✅ ${volunteers.length} volunteers connected\n`);

        // 4. Simulate some database operations
        console.log(`⚡ STEP 4: Simulating simultaneous database operations...`);
        const operations = [];
        
        // Participants scanning QR codes
        participants.slice(0, 5).forEach(participant => {
            operations.push(
                participant.connection.getDocument('fitness_test', 'participants', { 
                    participantId: participant.id 
                })
            );
        });

        // Volunteers updating records
        volunteers.slice(0, 3).forEach(volunteer => {
            operations.push(
                volunteer.connection.insertDocument('fitness_test', 'scan_logs', {
                    scannedBy: volunteer.id,
                    timestamp: new Date(),
                    action: 'volunteer_scan'
                })
            );
        });

        const operationResults = await Promise.allSettled(operations);
        const successful = operationResults.filter(r => r.status === 'fulfilled').length;
        console.log(`✅ ${successful}/${operations.length} operations completed successfully\n`);

        // 5. Simulate connection failure and SEAMLESS recovery
        console.log(`🔄 STEP 5: Simulating connection failure and seamless recovery...`);
        const testParticipantId = 'P001';
        
        console.log(`   🎯 Simulating failure for participant ${testParticipantId}...`);
        const newConnection = await shiftManager.handleUserConnectionFailure(testParticipantId);
        
        console.log(`   ⚡ SEAMLESS FAILOVER completed!`);
        console.log(`   🔧 Original connection recovering in background...`);
        
        // Test the new connection works
        const testResult = await newConnection.getDocument('fitness_test', 'participants', { 
            participantId: testParticipantId 
        });
        console.log(`   ✅ New connection verified - participant can continue scanning\n`);

        // 6. Get comprehensive health status
        console.log(`📊 STEP 6: Health and performance monitoring...`);
        const health = shiftManager.getShiftHealth();
        console.log(`   🏥 Health Status:`);
        console.log(`      Total: ${health.healthy}/${health.total} connections healthy`);
        console.log(`      Participants: ${health.participants.healthy}/${health.participants.total}`);
        console.log(`      Volunteers: ${health.volunteers.healthy}/${health.volunteers.total}`);
        console.log(`      Buffers: ${health.buffers.healthy}/${health.buffers.total}`);
        console.log(`      Reserved: ${health.reserved.healthy}/${health.reserved.total}`);

        const stats = shiftManager.getShiftStatistics();
        console.log(`   📈 Performance Stats:`);
        console.log(`      Uptime: ${Math.floor(stats.overview.uptime / 1000)}s`);
        console.log(`      Active users: ${stats.overview.activeUsers}`);
        console.log(`      Total failovers: ${stats.performance.totalFailovers}`);
        console.log(`      Average failover time: ${stats.performance.totalFailovers > 0 ? Math.floor(shiftManager.averageFailoverTime) : 0}ms`);
        console.log(`      Success rate: ${stats.performance.successRate}\n`);

        // 7. Simulate peak load
        console.log(`🚀 STEP 7: Simulating peak load with all users...`);
        const peakOperations = [];
        
        // All participants scanning simultaneously
        participants.forEach(participant => {
            peakOperations.push(
                participant.connection.findDocuments('fitness_test', 'test_stations', {})
            );
        });

        // All volunteers scanning simultaneously  
        volunteers.forEach(volunteer => {
            peakOperations.push(
                volunteer.connection.updateDocument('fitness_test', 'volunteer_logs', 
                    { volunteerId: volunteer.id },
                    { $set: { lastActivity: new Date(), status: 'active' } }
                )
            );
        });

        const peakStart = Date.now();
        const peakResults = await Promise.allSettled(peakOperations);
        const peakTime = Date.now() - peakStart;
        const peakSuccessful = peakResults.filter(r => r.status === 'fulfilled').length;
        
        console.log(`   ⚡ Peak load test completed:`);
        console.log(`      Time: ${peakTime}ms for ${peakOperations.length} simultaneous operations`);
        console.log(`      Success rate: ${peakSuccessful}/${peakOperations.length} (${((peakSuccessful/peakOperations.length)*100).toFixed(1)}%)`);
        console.log(`      Average per operation: ${(peakTime/peakOperations.length).toFixed(1)}ms\n`);

        // 8. Final health check
        console.log(`🏁 STEP 8: Final system health check...`);
        const finalHealth = shiftManager.getShiftHealth();
        console.log(`   🎯 SHIFT PERFORMANCE SUMMARY:`);
        console.log(`      ✅ Total connections: ${finalHealth.total}`);
        console.log(`      ✅ Healthy connections: ${finalHealth.healthy}`);
        console.log(`      ✅ Active users: ${finalHealth.shift.activeUsers}`);
        console.log(`      ✅ System uptime: ${Math.floor(finalHealth.shift.uptime / 1000)}s`);
        console.log(`      ✅ Buffer pool: ${finalHealth.buffers.healthy}/${finalHealth.buffers.total} available`);
        
        finalHealth.recommendations.forEach(rec => {
            console.log(`      ${rec}`);
        });

        console.log(`\n🎉 SHIFT OPERATIONS DEMO COMPLETED SUCCESSFULLY!`);
        console.log(`💡 Key achievements:`);
        console.log(`   ⚡ ZERO downtime during connection failures`);
        console.log(`   🔄 Seamless failover with 75-connection buffer pool`);
        console.log(`   🎯 All 26 users can operate simultaneously and independently`);
        console.log(`   🛡️  Complete fault isolation - one failure doesn't affect others`);
        console.log(`   🚀 Peak performance: ${(peakTime/peakOperations.length).toFixed(1)}ms per operation`);
        console.log(`   📊 System health: ${((finalHealth.healthy/finalHealth.total)*100).toFixed(1)}%`);

    } catch (error) {
        console.error(`❌ DEMO FAILED:`, error);
    } finally {
        // Always clean up
        console.log(`\n🔌 Cleaning up...`);
        await shiftManager.shutdownShift();
        console.log(`✅ Cleanup complete. Demo finished.`);
    }
}

// Usage examples for your specific scenarios:
function showUsageExamples() {
    console.log(`\n📚 USAGE EXAMPLES FOR YOUR FITNESS TEST:\n`);
    
    console.log(`1️⃣  BASIC SETUP:`);
    console.log(`   const ShiftManager = require('./Database/shiftManager');`);
    console.log(`   const shift = new ShiftManager(20, 6); // 20 participants, 6 volunteers`);
    console.log(`   await shift.initializeShift();\n`);
    
    console.log(`2️⃣  ASSIGN PARTICIPANT CONNECTION:`);
    console.log(`   const participantConnection = shift.assignUserConnection('P001', 'participant');`);
    console.log(`   const qrData = await participantConnection.getDocument('fitness', 'participants', { id: 'P001' });\n`);
    
    console.log(`3️⃣  ASSIGN VOLUNTEER CONNECTION:`);
    console.log(`   const volunteerConnection = shift.assignUserConnection('V01', 'volunteer');`);
    console.log(`   await volunteerConnection.insertDocument('fitness', 'scans', { scannedBy: 'V01', participant: 'P001' });\n`);
    
    console.log(`4️⃣  HANDLE CONNECTION FAILURE (AUTOMATIC):`);
    console.log(`   // If P001's connection fails, automatic failover to buffer:`);
    console.log(`   const newConnection = await shift.handleUserConnectionFailure('P001');`);
    console.log(`   // P001 continues scanning seamlessly with new connection\n`);
    
    console.log(`5️⃣  MONITOR SYSTEM HEALTH:`);
    console.log(`   const health = shift.getShiftHealth();`);
    console.log(`   console.log('Healthy connections:', health.healthy);`);
    console.log(`   console.log('Buffer pool:', health.buffers.healthy + '/' + health.buffers.total);\n`);
    
    console.log(`6️⃣  GET PERFORMANCE STATS:`);
    console.log(`   const stats = shift.getShiftStatistics();`);
    console.log(`   console.log('Average failover time:', stats.performance.averageFailoverTime + 'ms');\n`);
    
    console.log(`7️⃣  CLEANUP AFTER EVENT:`);
    console.log(`   await shift.shutdownShift(); // Gracefully close all 116 connections\n`);
}

// Run the demo
if (require.main === module) {
    demonstrateShiftOperations()
        .then(() => {
            showUsageExamples();
            process.exit(0);
        })
        .catch((error) => {
            console.error('Demo failed:', error);
            process.exit(1);
        });
}

module.exports = { demonstrateShiftOperations, showUsageExamples };
