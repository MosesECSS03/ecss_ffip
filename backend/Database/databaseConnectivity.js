const { MongoClient, ObjectId } = require('mongodb');

const uri = 'mongodb+srv://moseslee:Mlxy6695@ecss-course.hejib.mongodb.net/?retryWrites=true&w=majority&appName=ECSS-Course&connectTimeoutMS=30000&socketTimeoutMS=30000&serverSelectionTimeoutMS=30000&maxIdleTimeMS=30000';

class DatabaseConnectivity {
    constructor(options = {}) {
        this.client = new MongoClient(uri, {
            maxPoolSize: 10,        // Reduced pool size
            minPoolSize: 2,         // Reduced minimum connections
            maxIdleTimeMS: 30000,   // Reduced timeout values
            serverSelectionTimeoutMS: 30000,
            socketTimeoutMS: 30000,
            connectTimeoutMS: 30000,
            heartbeatFrequencyMS: 10000,
            retryWrites: true,
            retryReads: true,
            readPreference: 'primary', // Use primary for better reliability
            writeConcern: { w: 'majority', j: true } // Ensure data consistency
        });
        this.isConnected = false;
        this.connectionPromise = null;
        this.connectionLock = false; // Prevent connection race conditions
        this.silentMode = options.silentMode || false; // Option to suppress logs
        this.lastConnectionAttempt = 0;
        this.connectionCooldown = 10000; // 10 seconds cooldown between attempts
    }

    async initialize() {
        // Check cooldown period to avoid spam connections
        const now = Date.now();
        if (now - this.lastConnectionAttempt < this.connectionCooldown) {
            if (!this.silentMode) {
                console.log('Connection attempt blocked due to cooldown period');
            }
            return;
        }

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
        const maxRetries = 2; // Reduced retry attempts
        this.lastConnectionAttempt = Date.now();
        
        while (retryCount < maxRetries) {
            try {
                if (!this.silentMode) {
                    console.log(`Attempting database connection (attempt ${retryCount + 1}/${maxRetries})`);
                }
                
                if (!this.isConnected) {
                    await this.client.connect();
                    // Test the connection
                    await this.client.db('admin').command({ ping: 1 });
                    this.isConnected = true;
                    if (!this.silentMode) {
                        console.log('Database connected successfully');
                    }
                }
                
                this.connectionPromise = null;
                return;
                
            } catch (error) {
                if (!this.silentMode) {
                    console.error(`Database connection attempt ${retryCount + 1} failed:`, error.message);
                }
                retryCount++;
                this.isConnected = false;
                
                if (retryCount < maxRetries) {
                    const delay = Math.min(1000 * retryCount, 3000); // Reduced delay
                    if (!this.silentMode) {
                        console.log(`Retrying connection in ${delay}ms...`);
                    }
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    this.connectionPromise = null;
                    // In silent mode, don't throw errors, just log them
                    if (this.silentMode) {
                        console.warn(`Database connection failed after ${maxRetries} attempts. Operating in offline mode.`);
                        return;
                    }
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
                
                // If not connected and in silent mode, return gracefully
                if (!this.isConnected && this.silentMode) {
                    return {
                        success: false,
                        error: 'Database not available',
                        offline: true
                    };
                }
                
                const db = this.client.db(databaseName);
                const collection = db.collection(collectionName);
                
                const result = await collection.insertOne(document);
                
                return {
                    success: true,
                    insertedId: result.insertedId,
                    message: 'Document inserted successfully'
                };
            } catch (error) {
                if (!this.silentMode) {
                    console.error(`Error inserting document (attempt ${retryCount + 1}):`, error.message);
                }
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
                
                // If not connected and in silent mode, return gracefully
                if (!this.isConnected && this.silentMode) {
                    return {
                        success: false,
                        error: 'Database not available',
                        data: null,
                        offline: true
                    };
                }
                
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
                if (!this.silentMode) {
                    console.error(`Error getting document (attempt ${retryCount + 1}):`, error.message);
                }
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
            
            // If not connected and in silent mode, return gracefully
            if (!this.isConnected && this.silentMode) {
                return {
                    success: false,
                    error: 'Database not available',
                    data: [],
                    offline: true
                };
            }
            
            const db = this.client.db(databaseName);
            const collection = db.collection(collectionName);
            
            const documents = await collection.find(query).toArray();
            
            return {
                success: true,
                message: `Retrieved ${documents.length} documents successfully`,
                data: documents
            };
        } catch (error) {
            if (!this.silentMode) {
                console.error('Error finding documents:', error);
            }
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
            
            // If not connected and in silent mode, return gracefully
            if (!this.isConnected && this.silentMode) {
                return {
                    success: false,
                    error: 'Database not available',
                    offline: true
                };
            }
            
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
            if (!this.silentMode) {
                console.error('Error updating document:', error);
            }
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
            if (!this.silentMode) {
                console.log('Database disconnected successfully');
            }
        } catch (error) {
            if (!this.silentMode) {
                console.error('Error disconnecting from database:', error);
            }
            throw error;
        }
    }
}

module.exports = DatabaseConnectivity;