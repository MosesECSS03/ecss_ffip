/**
 * DEMO: Using SeamlessFailoverWrapper with YOUR EXISTING databaseConnectivity.js
 * This demonstrates how to add seamless failover to your current code
 * WITHOUT changing your existing databaseConnectivity.js file
 */

const SeamlessFailoverWrapper = require('./Database/SeamlessFailoverWrapper');

async function demonstrateWithYourExistingCode() {
    try {
        console.log('🎯 SEAMLESS FAILOVER DEMO with YOUR EXISTING DatabaseConnectivity');
        console.log('📝 Uses your current databaseConnectivity.js without any modifications');
        console.log('🔄 Adds 20 participants + 6 volunteers + 75 buffer connections\n');

        // Initialize seamless system using your existing DatabaseConnectivity class
        const seamlessSystem = new SeamlessFailoverWrapper();
        
        console.log('🚀 INITIALIZING SEAMLESS SYSTEM...');
        await seamlessSystem.initializeSeamlessSystem(20, 6);
        
        // Show system status
        const status = seamlessSystem.getSystemStatus();
        console.log('\n📊 SYSTEM STATUS:');
        console.log(`   Status: ${status.status}`);
        console.log(`   Total Instances: ${status.totalInstances}`);
        console.log(`   Connected: ${status.connectedInstances}`);
        console.log(`   Buffer Connections: ${status.bufferConnections}/${status.totalBufferPool}`);
        console.log(`   Emergency Connections: ${status.emergencyConnections}/${status.totalEmergencyPool}`);
        console.log(`   Azure Free Compatible: ${status.isAzureFree}`);
        console.log(`   MongoDB M0 Compatible: ${status.isMongoM0}`);
        console.log(`   Seamless Operation: ${status.seamlessOperation}`);

        // DEMO 1: Add participants with seamless failover
        console.log('\n=== DEMO 1: ADD PARTICIPANTS WITH SEAMLESS FAILOVER ===');
        
        const participantData = {
            name: 'John Doe',
            age: 25,
            email: 'john.doe@example.com',
            fitnessLevel: 'intermediate',
            testType: 'cardiovascular'
        };

        try {
            const result = await seamlessSystem.addParticipant(participantData, 'P001');
            console.log('✅ PARTICIPANT ADDED SUCCESSFULLY:', result.success ? 'YES' : 'NO');
            if (result.insertedId) {
                console.log(`   Inserted ID: ${result.insertedId}`);
            }
        } catch (error) {
            console.log('❌ ADD PARTICIPANT ERROR:', error.message);
        }

        // DEMO 2: Get participant with seamless recovery
        console.log('\n=== DEMO 2: GET PARTICIPANT WITH SEAMLESS RECOVERY ===');
        
        try {
            const result = await seamlessSystem.getParticipant('P001');
            console.log('✅ PARTICIPANT RETRIEVED:', result.success ? 'YES' : 'NO');
            if (result.data) {
                console.log(`   Name: ${result.data.name}`);
                console.log(`   Email: ${result.data.email}`);
            }
        } catch (error) {
            console.log('❌ GET PARTICIPANT ERROR:', error.message);
        }

        // DEMO 3: Update participant with seamless operation
        console.log('\n=== DEMO 3: UPDATE PARTICIPANT WITH SEAMLESS OPERATION ===');
        
        const updateData = {
            fitnessLevel: 'advanced',
            lastTest: new Date(),
            notes: 'Completed cardiovascular assessment'
        };

        try {
            const result = await seamlessSystem.updateParticipant('P001', updateData);
            console.log('✅ PARTICIPANT UPDATED:', result.success ? 'YES' : 'NO');
            if (result.data) {
                console.log(`   Modified Count: ${result.data.modifiedCount}`);
            }
        } catch (error) {
            console.log('❌ UPDATE PARTICIPANT ERROR:', error.message);
        }

        // DEMO 4: Add volunteer
        console.log('\n=== DEMO 4: ADD VOLUNTEER ===');
        
        const volunteerData = {
            name: 'Jane Smith',
            role: 'fitness_instructor',
            email: 'jane.smith@example.com',
            specialization: 'cardiovascular_training',
            certification: 'ACSM_CPT'
        };

        try {
            const connection = await seamlessSystem.getVolunteerConnection('V001');
            console.log('✅ VOLUNTEER CONNECTION OBTAINED:', connection.instanceRole);
            
            // Use your existing database methods
            const result = await connection.insertDocument('fitness_test', 'volunteers', {
                ...volunteerData,
                volunteerId: 'V001',
                submittedAt: new Date()
            });
            
            console.log('✅ VOLUNTEER ADDED:', result.success ? 'YES' : 'NO');
            if (result.insertedId) {
                console.log(`   Inserted ID: ${result.insertedId}`);
            }
        } catch (error) {
            console.log('❌ ADD VOLUNTEER ERROR:', error.message);
        }

        // DEMO 5: Simulate connection failure and seamless recovery
        console.log('\n=== DEMO 5: SIMULATE CONNECTION FAILURE ===');
        
        try {
            // Get a participant connection
            const participantConnection = await seamlessSystem.getParticipantConnection('P002');
            console.log(`📍 Original Connection: ${participantConnection.instanceRole}`);
            
            // Simulate connection failure
            console.log('🔥 SIMULATING CONNECTION FAILURE...');
            participantConnection.isHealthy = false;
            participantConnection.isConnected = false;
            
            // Trigger seamless failover
            const backupConnection = await seamlessSystem.moveToBuffer(participantConnection, 'P002', 'participant');
            if (backupConnection) {
                console.log(`⚡ SEAMLESS FAILOVER: Switched to ${backupConnection.instanceRole}`);
                console.log('🔧 Original connection will recover in background');
            }
            
        } catch (error) {
            console.log('❌ FAILOVER SIMULATION ERROR:', error.message);
        }

        // DEMO 6: Show buffer pool status
        console.log('\n=== DEMO 6: BUFFER POOL STATUS ===');
        
        const finalStatus = seamlessSystem.getSystemStatus();
        console.log(`🔄 Available Buffer Connections: ${finalStatus.bufferConnections}/${finalStatus.totalBufferPool}`);
        console.log(`🚨 Emergency Connections: ${finalStatus.emergencyConnections}/${finalStatus.totalEmergencyPool}`);
        console.log(`📊 Total Failovers: ${finalStatus.failoverCount}`);
        console.log(`👥 Active Participants: ${finalStatus.activeParticipants}`);
        console.log(`🛠️  Active Volunteers: ${finalStatus.activeVolunteers}`);

        console.log('\n✅ SEAMLESS FAILOVER DEMO COMPLETE');
        console.log('🎯 Your existing DatabaseConnectivity class is enhanced with:');
        console.log('   - 20 participant connections');
        console.log('   - 6 volunteer connections');
        console.log('   - 75 buffer connections for seamless failover');
        console.log('   - Automatic recovery and background healing');
        console.log('   - Azure Free + MongoDB M0 compatibility');
        
        // Cleanup
        await seamlessSystem.cleanup();
        
    } catch (error) {
        console.error('❌ DEMO ERROR:', error.message);
        console.error(error.stack);
    }
}

// Run the demonstration
console.log('🔄 Starting demonstration with YOUR existing DatabaseConnectivity...\n');
demonstrateWithYourExistingCode().catch(console.error);
