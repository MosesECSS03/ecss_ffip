const { MongoClient, ObjectId } = require('mongodb');

const uri = 'mongodb+srv://moseslee:Mlxy6695@ecss-course.hejib.mongodb.net/?retryWrites=true&w=majority&appName=ECSS-Course';

class DatabaseConnectivity {
    constructor(options = {}) {
        this.client = new MongoClient(uri, {
            maxPoolSize: 5,         // Smaller pool for better resource management
            minPoolSize: 1,         // Minimal connections
            maxIdleTimeMS: 60000,   // Longer idle time for persistent connections
            serverSelectionTimeoutMS: 5000,  // Faster server selection
            socketTimeoutMS: 45000, // Reasonable socket timeout
            connectTimeoutMS: 10000, // Faster connection timeout
            heartbeatFrequencyMS: 10000,
            retryWrites: true,
            retryReads: true,
            readPreference: 'primaryPreferred', // More flexible read preference
            writeConcern: { w: 'majority', j: true, wtimeout: 5000 } // Add write timeout
        });
        this.isConnected = false;
        this.connectionPromise = null;
        this.connectionLock = false; // Prevent connection race conditions
        this.silentMode = options.silentMode || false; // Option to suppress logs
        this.lastConnectionAttempt = 0;
        this.connectionCooldown = 5000; // Reduced to 5 seconds cooldown
        this.healthCheckInterval = null;
        this.isHealthy = true;
    }

    async initialize() {
        // Quick health check if already connected
        if (this.isConnected && this.isHealthy) {
            try {
                // Quick ping to verify connection health
                await this.client.db('admin').command({ ping: 1 }, { maxTimeMS: 2000 });
                return;
            } catch (error) {
                console.warn('Connection health check failed, reconnecting...');
                this.isConnected = false;
                this.isHealthy = false;
            }
        }

        // Check cooldown period to avoid spam connections
        const now = Date.now();
        if (now - this.lastConnectionAttempt < this.connectionCooldown) {
            if (!this.silentMode) {
                console.log('Connection attempt blocked due to cooldown period');
            }
            throw new Error('Connection cooldown active - please wait before retrying');
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
        const maxRetries = 3; // Increased retry attempts
        this.lastConnectionAttempt = Date.now();
        
        while (retryCount < maxRetries) {
            try {
                if (!this.silentMode) {
                    console.log(`🔄 Attempting database connection (${retryCount + 1}/${maxRetries})`);
                }
                
                if (!this.isConnected) {
                    // Use Promise.race to add our own timeout
                    await Promise.race([
                        this.client.connect(),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Connection timeout after 8 seconds')), 8000)
                        )
                    ]);
                    
                    // Quick health check with timeout
                    await Promise.race([
                        this.client.db('admin').command({ ping: 1 }),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Ping timeout after 3 seconds')), 3000)
                        )
                    ]);
                    
                    this.isConnected = true;
                    this.isHealthy = true;
                    if (!this.silentMode) {
                        console.log('✅ Database connected successfully');
                    }
                    
                    // Start health monitoring
                    this._startHealthCheck();
                }
                
                this.connectionPromise = null;
                return;
                
            } catch (error) {
                if (!this.silentMode) {
                    console.error(`❌ Database connection attempt ${retryCount + 1} failed:`, error.message);
                }
                retryCount++;
                this.isConnected = false;
                this.isHealthy = false;
                
                if (retryCount < maxRetries) {
                    const delay = Math.min(1000 * retryCount, 2000); // Reduced max delay
                    if (!this.silentMode) {
                        console.log(`⏳ Retrying connection in ${delay}ms...`);
                    }
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    this.connectionPromise = null;
                    if (this.silentMode) {
                        console.warn(`Database connection failed after ${maxRetries} attempts. Operating in offline mode.`);
                        return;
                    }
                    throw new Error(`Failed to connect to database after ${maxRetries} attempts: ${error.message}`);
                }
            }
        }
    }

    _startHealthCheck() {
        // Clear any existing health check
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        
        // Start periodic health monitoring
        this.healthCheckInterval = setInterval(async () => {
            try {
                if (this.isConnected) {
                    await this.client.db('admin').command({ ping: 1 }, { maxTimeMS: 2000 });
                    this.isHealthy = true;
                }
            } catch (error) {
                console.warn('💓 Database health check failed:', error.message);
                this.isHealthy = false;
                this.isConnected = false;
            }
        }, 30000); // Check every 30 seconds
    }

    _stopHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
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
                
                // Add timeout to insert operation
                const result = await Promise.race([
                    collection.insertOne(document, { wtimeout: 5000 }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Insert operation timeout')), 8000)
                    )
                ]);
                
                return {
                    success: true,
                    insertedId: result.insertedId,
                    message: 'Document inserted successfully'
                };
            } catch (error) {
                if (!this.silentMode) {
                    console.error(`💾 Error inserting document (attempt ${retryCount + 1}):`, error.message);
                }
                retryCount++;
                
                if (this._isConnectionError(error) && retryCount < maxRetries) {
                    this.isConnected = false;
                    this.isHealthy = false;
                    this.connectionPromise = null;
                    await new Promise(resolve => setTimeout(resolve, 500));
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
                
                // Add timeout to query operation
                const document = await Promise.race([
                    collection.findOne(query, { maxTimeMS: 5000 }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Query operation timeout')), 8000)
                    )
                ]);
                
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
                    console.error(`🔍 Error getting document (attempt ${retryCount + 1}):`, error.message);
                }
                retryCount++;
                
                if (this._isConnectionError(error) && retryCount < maxRetries) {
                    this.isConnected = false;
                    this.isHealthy = false;
                    this.connectionPromise = null;
                    await new Promise(resolve => setTimeout(resolve, 500));
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
            
            // Add timeout to update operation
            const result = await Promise.race([
                collection.updateOne(query, update, { wtimeout: 5000 }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Update operation timeout')), 8000)
                )
            ]);
            
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
                console.error('📝 Error updating document:', error.message);
            }
            return {
                success: false,
                error: error.message
            };
        }
    }

    async disconnect() {
        try {
            this._stopHealthCheck();
            await this.client.close();
            this.isConnected = false;
            this.isHealthy = false;
            this.connectionPromise = null;
            if (!this.silentMode) {
                console.log('🔌 Database disconnected successfully');
            }
        } catch (error) {
            if (!this.silentMode) {
                console.error('❌ Error disconnecting from database:', error);
            }
            throw error;
        }
    }
}

module.exports = DatabaseConnectivity;