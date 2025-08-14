const DatabaseConnectivity = require('./Database/databaseConnectivity');

async function loadTest() {
    console.log('🚀 Starting load test for 50 simultaneous connections...');
    
    const promises = [];
    const startTime = Date.now();
    
    // Create 50 simultaneous database operations
    for (let i = 0; i < 50; i++) {
        const db = new DatabaseConnectivity({ silentMode: true });
        
        promises.push(
            db.insertDocument('testDB', 'loadTest', {
                userId: i,
                timestamp: new Date(),
                data: `Test data for user ${i}`
            }).then(result => ({
                userId: i,
                success: result.success,
                duration: Date.now() - startTime
            }))
        );
    }
    
    try {
        const results = await Promise.all(promises);
        const endTime = Date.now();
        const totalDuration = endTime - startTime;
        
        const successful = results.filter(r => r.success).length;
        const failed = results.length - successful;
        
        console.log('\n📊 Load Test Results:');
        console.log(`✅ Successful operations: ${successful}/50`);
        console.log(`❌ Failed operations: ${failed}/50`);
        console.log(`⏱️  Total time: ${totalDuration}ms`);
        console.log(`⚡ Average per operation: ${(totalDuration / 50).toFixed(2)}ms`);
        
        if (successful === 50) {
            console.log('🎉 SUCCESS: Your database can handle 50 simultaneous connections!');
        } else {
            console.log('⚠️  Some operations failed - check your configuration');
        }
        
    } catch (error) {
        console.error('❌ Load test failed:', error.message);
    }
}

// Run the test
loadTest();
