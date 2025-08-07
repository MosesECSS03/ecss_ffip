const { MongoClient, ObjectId } = require('mongodb');

const uri = 'mongodb+srv://moseslee:Mlxy6695@ecss-course.hejib.mongodb.net/?retryWrites=true&w=majority&appName=ECSS-Course&connectTimeoutMS=60000&socketTimeoutMS=60000&serverSelectionTimeoutMS=60000&maxIdleTimeMS=60000';

class DatabaseConnectivity {
    constructor() {
        this.client = new MongoClient(uri, {
            maxPoolSize: 20,        // Increased for concurrent access
            minPoolSize: 5,         // Maintain minimum connections
            maxIdleTimeMS: 60000,
            serverSelectionTimeoutMS: 60000,
            socketTimeoutMS: 60000,
            connectTimeoutMS: 60000,
            heartbeatFrequencyMS: 10000,
            retryWrites: true,
            retryReads: true,
            readPreference: 'secondaryPreferred', // Distribute read load
            writeConcern: { w: 'majority', j: true } // Ensure data consistency
        });
        this.isConnected = false;
        this.connectionPromise = null;
        this.connectionLock = false; // Prevent connection race conditions
    }

    async initialize() {
        // If already connected, return immediately
        if (this.isConnected && this.client.topology && this.client.topology.isConnected()) {
            return;
        }

        // If connection is in progress, wait for it
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        // Start new connection with retry logic
        this.connectionPromise = this._connectWithRetry();
        return this.connectionPromise;
    }

    async _connectWithRetry() {
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                console.log(`Attempting database connection (attempt ${retryCount + 1}/${maxRetries})`);
                
                if (!this.isConnected) {
                    await this.client.connect();
                    // Test the connection
                    await this.client.db('admin').command({ ping: 1 });
                    this.isConnected = true;
                    console.log('Database connected successfully');
                }
                
                this.connectionPromise = null;
                return;
                
            } catch (error) {
                console.error(`Database connection attempt ${retryCount + 1} failed:`, error.message);
                retryCount++;
                this.isConnected = false;
                
                if (retryCount < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
                    console.log(`Retrying connection in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    this.connectionPromise = null;
                    throw new Error(`Failed to connect to database after ${maxRetries} attempts: ${error.message}`);
                }
            }
        }
    }

    async insertDocument(databaseName, collectionName, document) {
        let retryCount = 0;
        const maxRetries = 2;
        
        while (retryCount < maxRetries) {
            try {
                await this.initialize();
                const db = this.client.db(databaseName);
                const collection = db.collection(collectionName);
                
                const result = await collection.insertOne(document);
                
                return {
                    success: true,
                    insertedId: result.insertedId,
                    message: 'Document inserted successfully'
                };
            } catch (error) {
                console.error(`Error inserting document (attempt ${retryCount + 1}):`, error.message);
                retryCount++;
                
                if (this._isConnectionError(error) && retryCount < maxRetries) {
                    this.isConnected = false;
                    this.connectionPromise = null;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
                
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    }

    async getDocument(databaseName, collectionName, query) {
        let retryCount = 0;
        const maxRetries = 2;
        
        while (retryCount < maxRetries) {
            try {
                await this.initialize();
                const db = this.client.db(databaseName);
                const collection = db.collection(collectionName);
                
                const document = await collection.findOne(query);
                if (!document) {
                    return {
                        success: false,
                        message: 'No document found matching the query',
                        data: null
                    };
                }
                return {
                    success: true,
                    message: 'Document retrieved successfully',
                    data: document
                };
            } catch (error) {
                console.error(`Error getting document (attempt ${retryCount + 1}):`, error.message);
                retryCount++;
                
                if (this._isConnectionError(error) && retryCount < maxRetries) {
                    this.isConnected = false;
                    this.connectionPromise = null;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }
                
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    }

    _isConnectionError(error) {
        return error.name === 'MongoServerSelectionError' || 
               error.name === 'MongoNetworkTimeoutError' ||
               error.message.includes('timeout') ||
               error.message.includes('connection');
    }

    async findDocuments(databaseName, collectionName, query = {}) {
        try {
            await this.initialize();
            const db = this.client.db(databaseName);
            const collection = db.collection(collectionName);
            
            const documents = await collection.find(query).toArray();
            
            return {
                success: true,
                message: `Retrieved ${documents.length} documents successfully`,
                data: documents
            };
        } catch (error) {
            console.error('Error finding documents:', error);
            return {
                success: false,
                error: error.message,
                data: []
            };
        }
    }

    async updateDocument(databaseName, collectionName, query, update) {
        try {
            await this.initialize();
            const db = this.client.db(databaseName);
            const collection = db.collection(collectionName);
            const result = await collection.updateOne(query, update);
            if (result.modifiedCount === 1) {
                return {
                    success: true,
                    message: 'Document updated successfully',
                    data: result
                };
            } else if (result.matchedCount === 1) {
                return {
                    success: true,
                    message: 'No changes made to the document',
                    data: result
                };
            } else {
                return {
                    success: false,
                    message: 'No document found to update',
                    data: null
                };
            }
        } catch (error) {
            console.error('Error updating document:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async disconnect() {
        try {
            await this.client.close();
            this.isConnected = false;
            console.log('Database disconnected successfully');
        } catch (error) {
            console.error('Error disconnecting from database:', error);
            throw error;
        }
    }
}

module.exports = DatabaseConnectivity;