/**
 * MongoDB M0 Connection Pool Diagnostic Test
 * For troubleshooting connection pool timeout issues with free tier clusters
 */

const { MongoClient } = require('mongodb');

// Your MongoDB connection string with M0-optimized timeouts
const uri = 'mongodb+srv://moseslee:Mlxy6695@ecss-course.hejib.mongodb.net/?retryWrites=true&w=majority&appName=ECSS-Course&maxIdleTimeoutMS=60000&serverSelectionTimeoutMS=15000&socketTimeoutMS=30000&connectTimeoutMS=20000';

// M0-specific connection options
const options = {
    serverSelectionTimeoutMS: 15000,      // Extended for M0 wake-up
    socketTimeoutMS: 30000,               // Long enough for M0 startup
    connectTimeoutMS: 20000,              // Generous connection timeout
    maxPoolSize: 3,                       // Keep pool small for M0
    minPoolSize: 1,                       // Ensure at least 1 connection
    maxIdleTimeMS: 60000,                 // Keep connections alive longer
    waitQueueTimeoutMS: 10000,            // Wait for pool connections
    heartbeatFrequencyMS: 8000,           // Less frequent heartbeats
    retryWrites: true,
    retryReads: true
};

async function testMongoDBM0Connection() {
    console.log('🔍 MongoDB M0 Connection Pool Diagnostic Test');
    console.log('===============================================');
    
    let client;
    
    try {
        console.log('⏳ Step 1: Creating MongoDB client with M0-optimized settings...');
        client = new MongoClient(uri, options);
        
        console.log('⏳ Step 2: Attempting connection (this may take 10-30 seconds for M0 wake-up)...');
        const startTime = Date.now();
        
        await client.connect();
        const connectionTime = Date.now() - startTime;
        
        console.log(`✅ Step 3: Connection successful! (${connectionTime}ms)`);
        
        console.log('⏳ Step 4: Testing database ping...');
        const admin = client.db().admin();
        const pingResult = await admin.ping();
        console.log('✅ Step 5: Database ping successful!', pingResult);
        
        console.log('⏳ Step 6: Testing collection access...');
        const db = client.db('UserDatabase');
        const collections = await db.listCollections().toArray();
        console.log(`✅ Step 7: Found ${collections.length} collections in UserDatabase`);
        
        // Test a simple operation
        console.log('⏳ Step 8: Testing simple query operation...');
        const testCollection = db.collection('participants');
        const testDoc = { _id: 'connection-test-' + Date.now(), test: true, timestamp: new Date() };
        
        const insertResult = await testCollection.insertOne(testDoc);
        console.log('✅ Step 9: Test document inserted successfully!', insertResult.insertedId);
        
        // Clean up test document
        await testCollection.deleteOne({ _id: testDoc._id });
        console.log('✅ Step 10: Test document cleaned up successfully!');
        
        console.log('\n🎉 M0 Connection Test: ALL TESTS PASSED!');
        console.log('✅ Your MongoDB M0 cluster is working correctly');
        console.log('✅ Connection pool is functioning properly');
        console.log('✅ Database operations are working');
        
        if (connectionTime > 5000) {
            console.log('\n💡 Performance Note:');
            console.log(`   Initial connection took ${connectionTime}ms (normal for M0 wake-up)`);
            console.log('   Subsequent connections should be much faster');
        }
        
    } catch (error) {
        console.error('\n❌ M0 Connection Test: FAILED');
        console.error('Error details:', error.message);
        
        if (error.message.includes('connection pool')) {
            console.log('\n🔧 Connection Pool Issue Detected:');
            console.log('   This is common with M0 clusters that have been sleeping');
            console.log('   Recommended solutions:');
            console.log('   1. Wait 30-60 seconds and try again');
            console.log('   2. Check MongoDB Atlas cluster status');
            console.log('   3. Verify cluster is not paused');
            console.log('   4. Consider increasing timeout values further');
        }
        
        if (error.message.includes('authentication failed')) {
            console.log('\n🔧 Authentication Issue Detected:');
            console.log('   1. Check username and password in connection string');
            console.log('   2. Verify database user permissions');
            console.log('   3. Check if user has read/write access to databases');
        }
        
        if (error.message.includes('connection') && error.message.includes('timeout')) {
            console.log('\n🔧 Connection Timeout Issue:');
            console.log('   M0 clusters can take 10-30 seconds to wake up');
            console.log('   Current timeouts: connection=20s, socket=30s, selection=15s');
            console.log('   If this persists, cluster might be having issues');
        }
        
    } finally {
        if (client) {
            console.log('\n⏳ Closing connection...');
            await client.close();
            console.log('✅ Connection closed cleanly');
        }
    }
}

// Run the test
testMongoDBM0Connection().catch(console.error);
