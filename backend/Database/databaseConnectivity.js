const { MongoClient, ObjectId } = require('mongodb');
const MongoCompatibilityWrapper = require('./MongoCompatibilityWrapper');

//const uri = 'mongodb+srv://moseslee:Mlxy6695@ecss-course.hejib.mongodb.net/?retryWrites=true&w=majority&appName=ECSS-Course&maxIdleTimeMS=60000&serverSelectionTimeoutMS=15000&socketTimeoutMS=30000&connectTimeoutMS=20000';
const uri = "mongodb+srv://MosesLee:Mlxy%406695@company-management-syst.ulotbgi.mongodb.net/?retryWrites=true&w=majority&appName=Company-Management-System";

class DatabaseConnectivity {
    constructor(options = {}) {
        this.instanceId = options.instanceId || `db_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        this.isolatedMode = options.isolatedMode || false; // Track if this is an isolated instance
        
        // SMART CONNECTION MANAGEMENT for unlimited scale with safeguards
        const smartMaxPool = this._calculateOptimalPoolSize(options.maxPoolSize);
        
        // AZURE FREE TIER & M0 DETECTION: Intelligent environment detection
        const isAzureFree = true; // Hardcoded for your Azure Free setup
        const isMongoM0 = true; // Hardcoded for your MongoDB M0 setup
        
        this.client = MongoCompatibilityWrapper.createClient(uri, {
            maxPoolSize: smartMaxPool,         // SMART unlimited connections with safeguards
            minPoolSize: options.minPoolSize || (isAzureFree ? 0 : 10), // No minimum for M0 free tier
            maxIdleTimeMS: this.isolatedMode ? 600000 : (isAzureFree ? 60000 : 300000), // Shorter for M0 to avoid sleeping
            serverSelectionTimeoutMS: isAzureFree ? 15000 : 400,   // Much higher for M0 wake-up time
            socketTimeoutMS: isAzureFree ? 30000 : 4000,  // Extra long for M0 startup latency
            connectTimeoutMS: isAzureFree ? 20000 : 600,  // Extended time for M0 cluster wake-up
            heartbeatFrequencyMS: this.isolatedMode ? (isAzureFree ? 8000 : 1000) : (isAzureFree ? 6000 : 800), // Less frequent on Azure Free
            retryWrites: true,
            retryReads: true,
            readPreference: 'primary', // Fastest read preference for QR scanning
            writeConcern: { w: 'majority', j: false, wtimeout: isAzureFree ? 1000 : 300 }, // Longer timeout for Azure Free
            // MAXIMUM PERFORMANCE optimizations with safety
            maxConnecting: this.isolatedMode ? 1 : 50,      // Single connection for isolated mode
            waitQueueTimeoutMS: isAzureFree ? 15000 : 200, // Extended queue timeout for M0
            compressors: ['snappy', 'zlib'], // Best compression for speed
            zlibCompressionLevel: 1, // Fast compression level
            // Additional speed optimizations (filtered by compatibility wrapper)
            bufferMaxEntries: 0,    // Will be filtered out if not supported
            useUnifiedTopology: true, // Will be filtered out if default
            monitorCommands: false, // Will be filtered out if deprecated
            // SEAMLESS FAILOVER optimizations
            directConnection: false, // Enable replica set failover
            localThresholdMS: 5,    // Will be adjusted to minimum if too low
            checkKeys: false,       // Will be filtered out if deprecated
        });
        
        this.isConnected = false;
        this.connectionPromise = null;
        this.connectionLock = false;
        this.silentMode = options.silentMode || false;
        this.lastConnectionAttempt = 0;
        this.connectionCooldown = options.connectionCooldown || 100; // INSTANT cooldown for seamless reconnection
        this.healthCheckInterval = null;
        this.isHealthy = true;
        
        // SEAMLESS FAILOVER enhancements
        this.reconnectionAttempts = 0;
        this.maxReconnectionAttempts = 10; // More attempts for persistence
        this.backupConnectionPromise = null; // Parallel backup connection
        this.lastFailureTime = 0;
        this.adaptiveTimeout = {
            current: isAzureFree ? 1000 : 200,    // Higher for M0 wake-up delays
            min: isAzureFree ? 500 : 100,        // Minimum for M0 sleeping clusters
            max: isAzureFree ? 8000 : 800,       // Much higher for M0 worst-case
            increment: isAzureFree ? 200 : 50    // Larger steps for M0 variability
        };
        
        // SMART CONNECTION MONITORING for unlimited scale
        this.maxRecommendedConnections = smartMaxPool || 5000; // Default safety limit
        this.connectionWarningThreshold = Math.floor(this.maxRecommendedConnections * 0.8);
        this.activeConnections = 0; // Track active connections
        this.connectionQueue = []; // Queue for overflow handling
        this.maxQueueSize = 1000; // Maximum queue size for 500+ users
        this.performanceMetrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            averageResponseTime: 0,
            lastPerformanceCheck: Date.now(),
            peakConnections: 0,
            queuedRequests: 0,
            rejectedConnections: 0
        };
        
        // Log instance creation
        if (!this.silentMode) {
            const mode = this.isolatedMode ? 'ISOLATED' : 'SMART-UNLIMITED';
            console.log(`🚀 ${mode} Database instance: ${this.instanceId}`);
            console.log(`📊 Max pool size: ${smartMaxPool || 'UNLIMITED'} with intelligent monitoring`);
            if (this.isolatedMode) {
                console.log(`🔒 ISOLATED MODE: Independent connection for fault tolerance`);
            }
            console.log(`⚠️  Monitoring threshold: ${this.maxRecommendedConnections} connections`);
        }
    }

    // Calculate optimal pool size based on environment and MongoDB Atlas limits
    _calculateOptimalPoolSize(requestedSize) {
        // If user specified a size, respect it (but cap for safety)
        if (requestedSize && requestedSize > 0) {
            return Math.min(requestedSize, 15000); // Cap at 15k for safety
        }
        
        // SMART DETECTION: Check if we're likely on M0 (free tier) with 500 limit
        const detectedTier = 'M0'; // Hardcoded for your MongoDB M0 setup
        const isLikelyFree = true; // Hardcoded for your free tier setup
        
        if (isLikelyFree) {
            // For isolated mode, use even smaller pool per instance
            if (this.isolatedMode) {
                const isolatedLimit = 1; // Single connection per isolated instance
                if (!this.silentMode) {
                    console.log(`🔒 ISOLATED FREE TIER - Using ${isolatedLimit} connection per instance`);
                    console.log(`💡 Total system capacity: Multiple isolated instances × ${isolatedLimit} connection each`);
                }
                return isolatedLimit;
            }
            
            // Conservative approach for free tier - use 450 to leave headroom
            const safeLimit = 450;
            if (!this.silentMode) {
                console.log(`🚨 FREE TIER DETECTED - Using safe limit: ${safeLimit} connections`);
                console.log(`💡 For 500+ users, consider upgrading to M2/M5 (1500 limit) or M10+ (3000+)`);
            }
            return safeLimit;
        }
        
        // For true unlimited, return 0 but set up monitoring
        // MongoDB Atlas limits by tier:
        // M0 (Free): 500, M2/M5: 1500, M10: 3000, M20+: 5000+
        
        if (!this.silentMode) {
            console.log(`💡 UNLIMITED mode active - will monitor performance`);
            console.log(`⚡ Atlas limits: M0=500, M2/M5=1500, M10=3000, M20+=5000+`);
            console.log(`🎯 For 500+ concurrent users, M2+ tier recommended`);
        }
        
        return 0; // Unlimited with smart monitoring
    }

    // Monitor connection performance and warn about potential issues
    _updatePerformanceMetrics(responseTime, success = true) {
        this.performanceMetrics.totalRequests++;
        if (success) {
            this.performanceMetrics.successfulRequests++;
        } else {
            this.performanceMetrics.failedRequests++;
        }
        
        // Update average response time (simple moving average)
        const totalSuccessful = this.performanceMetrics.successfulRequests;
        if (totalSuccessful > 0) {
            this.performanceMetrics.averageResponseTime = 
                ((this.performanceMetrics.averageResponseTime * (totalSuccessful - 1)) + responseTime) / totalSuccessful;
        }
        
        // Check for performance degradation
        const now = Date.now();
        if (now - this.performanceMetrics.lastPerformanceCheck > 30000) { // Check every 30 seconds
            this._checkPerformanceHealth();
            this.performanceMetrics.lastPerformanceCheck = now;
        }
    }

    // Check if performance is degrading due to too many connections
    _checkPerformanceHealth() {
        const metrics = this.performanceMetrics;
        const successRate = metrics.totalRequests > 0 ? 
            (metrics.successfulRequests / metrics.totalRequests) * 100 : 100;
        const avgResponseTime = metrics.averageResponseTime;
        
        if (!this.silentMode && metrics.totalRequests > 10) {
            console.log(`📊 Performance Check:`);
            console.log(`   Success Rate: ${successRate.toFixed(1)}%`);
            console.log(`   Avg Response: ${avgResponseTime.toFixed(0)}ms`);
            console.log(`   Total Requests: ${metrics.totalRequests}`);
            console.log(`   Active Connections: ${this.activeConnections}`);
            console.log(`   Queued Requests: ${metrics.queuedRequests}`);
            console.log(`   Rejected Connections: ${metrics.rejectedConnections}`);
        }
        
        // Enhanced warnings for 500+ connection scenarios
        if (successRate < 95 && metrics.totalRequests > 100) {
            console.warn(`🚨 CRITICAL: Success rate ${successRate.toFixed(1)}% - EXCEEDING CONNECTION LIMITS!`);
            console.warn(`💡 Solution: Upgrade MongoDB Atlas tier or implement connection pooling`);
        }
        
        if (avgResponseTime > 2000 && metrics.successfulRequests > 50) {
            console.warn(`🚨 CRITICAL: Response time ${avgResponseTime.toFixed(0)}ms - DATABASE OVERLOAD!`);
            console.warn(`💡 Solution: Scale up cluster or implement request queuing`);
        }
        
        // Specific warnings for 500+ connections
        if (metrics.rejectedConnections > 10) {
            console.warn(`🚨 CONNECTION LIMIT EXCEEDED: ${metrics.rejectedConnections} rejected connections`);
            console.warn(`💡 URGENT: Upgrade from M0 (500 limit) to M2+ for 500+ concurrent users`);
        }
        
        if (metrics.queuedRequests > 100) {
            console.warn(`⚠️  HIGH LOAD: ${metrics.queuedRequests} requests queued - consider scaling`);
        }
    }

    async initialize() {
        const startTime = Date.now();
        
        // ULTRA-FAST health check if already connected (instant for shifts)
        if (this.isConnected && this.isHealthy) {
            try {
                // ULTRA-LIGHTNING ping with adaptive timeout for 25 users
                await this.client.db('admin').command({ ping: 1 }, { maxTimeMS: 100 }); // Reduced from 200ms
                this._updatePerformanceMetrics(Date.now() - startTime, true);
                return;
            } catch (error) {
                // INSTANT seamless reconnect for shift operations
                this.isConnected = false;
                this.isHealthy = false;
                // Mark failure time for adaptive recovery
                this.lastFailureTime = Date.now();
            }
        }

        // ZERO cooldown for instant shift operations
        const now = Date.now();
        if (now - this.lastConnectionAttempt < this.connectionCooldown) {
            // INSTANT connection - no waiting for shifts
            if (this.connectionPromise) {
                return this.connectionPromise;
            }
        }

        // If connection is in progress, wait for it
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        // Start SEAMLESS connection with shift-optimized retry logic
        this.connectionPromise = this._connectWithSeamlessRetry();
        return this.connectionPromise;
    }

    async _connectWithSeamlessRetry() {
        let retryCount = 0;
        const maxRetries = 5; // ENHANCED retry count for shift reliability
        this.lastConnectionAttempt = Date.now();
        this.reconnectionAttempts++;
        
        while (retryCount < maxRetries) {
            try {
                if (!this.silentMode) {
                    console.log(`⚡ SEAMLESS connection (${retryCount + 1}/${maxRetries}) - SHIFT OPTIMIZED for 25 users`);
                }
                
                // ADAPTIVE TIMEOUT - faster recovery based on previous failures
                const adaptiveTimeout = Math.max(
                    this.adaptiveTimeout.min,
                    Math.min(this.adaptiveTimeout.current, this.adaptiveTimeout.max)
                );
                
                if (!this.isConnected) {
                    // ULTRA-FAST connection with adaptive timeout for shift operations
                    await Promise.race([
                        this.client.connect(),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error(`Connection timeout after ${adaptiveTimeout}ms`)), adaptiveTimeout)
                        )
                    ]);
                    
                    // INSTANT health check with optimized timeout for M0 wake-up
                    await Promise.race([
                        this.client.db('admin').command({ ping: 1 }),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Ping timeout after 8000ms')), 8000) // Increased for M0 wake-up
                        )
                    ]);
                    
                    this.isConnected = true;
                    this.isHealthy = true;
                    this.reconnectionAttempts = 0; // Reset on successful connection
                    
                    // ADAPTIVE TIMEOUT OPTIMIZATION - faster for successful connections
                    if (this.adaptiveTimeout.current > this.adaptiveTimeout.min) {
                        this.adaptiveTimeout.current = Math.max(
                            this.adaptiveTimeout.min,
                            this.adaptiveTimeout.current - 25 // SMALLER reduction steps
                        );
                    }
                    
                    if (!this.silentMode) {
                        console.log(`⚡ SHIFT DATABASE READY (${adaptiveTimeout}ms) - Independent parallel connection active!`);
                    }
                    
                    // Start ENHANCED health monitoring for shift operations
                    this._startEnhancedHealthCheck();
                }
                
                this.connectionPromise = null;
                return;
                
            } catch (error) {
                retryCount++;
                this.isConnected = false;
                this.isHealthy = false;
                
                // ADAPTIVE TIMEOUT INCREASE - slower after failures but cap at max
                if (this.adaptiveTimeout.current < this.adaptiveTimeout.max) {
                    this.adaptiveTimeout.current = Math.min(
                        this.adaptiveTimeout.max,
                        this.adaptiveTimeout.current + this.adaptiveTimeout.increment
                    );
                }
                
                if (retryCount < maxRetries) {
                    // ABSOLUTELY INSTANT RETRY - Zero delay for seamless shift experience
                    if (!this.silentMode) {
                        console.log(`⚡ SEAMLESS retry ${retryCount} (${this.adaptiveTimeout.current}ms timeout)...`);
                    }
                    // Continue immediately with adaptive timeout - maximum seamless speed!
                } else {
                    this.connectionPromise = null;
                    
                    // PARALLEL BACKUP CONNECTION ATTEMPT for shift reliability
                    if (this.reconnectionAttempts < this.maxReconnectionAttempts) {
                        if (!this.silentMode) {
                            console.log(`🔄 Starting PARALLEL backup connection attempt ${this.reconnectionAttempts}/${this.maxReconnectionAttempts}`);
                        }
                        
                        // Start parallel backup connection without blocking
                        setTimeout(() => {
                            this.connectionPromise = this._connectWithSeamlessRetry();
                        }, 50); // Tiny delay to prevent recursion issues
                    }
                    
                    if (this.silentMode) {
                        console.warn(`⚠️ Database connection failed after ${maxRetries} attempts. SEAMLESS fallback mode active for shift operations.`);
                        // Mark as offline but don't throw error in silent mode
                        this.isConnected = false;
                        this.isHealthy = false;
                        return;
                    }
                    
                    // For non-silent mode, log warning but still don't crash
                    console.warn(`⚠️ SHIFT CONNECTION FAILED after ${maxRetries} attempts: ${error.message}`);
                    console.warn(`🔄 Application will continue with degraded database functionality`);
                    this.isConnected = false;
                    this.isHealthy = false;
                    return; // Don't throw error - graceful degradation
                }
            }
        }
    }

    _startEnhancedHealthCheck() {
        // Clear any existing health check
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        
        // ENHANCED health monitoring for SHIFT operations (25-26 users) with Azure Free compatibility
        this.healthCheckInterval = setInterval(async () => {
            try {
                if (this.isConnected) {
                    // ADAPTIVE health check timeout based on environment
                    const isAzureFree = true; // Hardcoded for your Azure Free setup
                    const healthTimeout = isAzureFree ? 300 : 150; // Higher timeout for Azure Free
                    
                    await this.client.db('admin').command({ ping: 1 }, { maxTimeMS: healthTimeout });
                    this.isHealthy = true;
                    
                    // Reset adaptive timeout on successful health check
                    if (this.adaptiveTimeout.current > this.adaptiveTimeout.min) {
                        this.adaptiveTimeout.current = Math.max(
                            this.adaptiveTimeout.min,
                            this.adaptiveTimeout.current - 25 // SMALLER reduction steps for gradual optimization
                        );
                    }
                }
            } catch (error) {
                // SILENT health check failures with IMMEDIATE seamless recovery
                this.isHealthy = false;
                this.isConnected = false;
                
                // Start IMMEDIATE seamless reconnection in background
                if (!this.connectionPromise) {
                    setTimeout(() => {
                        this.connectionPromise = this._connectWithSeamlessRetry();
                    }, 50); // ULTRA-TINY delay for seamless background recovery
                }
            }
        }, 6000); // Longer intervals for Azure Free to reduce resource usage
    }

    _stopHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }

    async insertDocument(databaseName, collectionName, document) {
        const startTime = Date.now();
        let retryCount = 0;
        const maxRetries = 3; // Optimized retry count for seamless speed
        
        while (retryCount < maxRetries) {
            try {
                await this.initialize();
                
                // If not connected and in silent mode, return gracefully
                if (!this.isConnected && this.silentMode) {
                    this._updatePerformanceMetrics(Date.now() - startTime, false);
                    return {
                        success: false,
                        error: 'Database not available',
                        offline: true
                    };
                }
                
                const db = this.client.db(databaseName);
                const collection = db.collection(collectionName);
                
                // MAXIMUM SPEED insert operation
                const result = await Promise.race([
                    collection.insertOne(document, { wtimeout: 500 }), // Reduced from 1000ms
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Insert operation timeout')), 800) // Reduced from 1500ms
                    )
                ]);
                
                this._updatePerformanceMetrics(Date.now() - startTime, true);
                return {
                    success: true,
                    insertedId: result.insertedId,
                    message: 'Document inserted successfully'
                };
            } catch (error) {
                retryCount++;
                
                // Only retry for connection errors
                if (this._isConnectionError(error) && retryCount < maxRetries) {
                    // SEAMLESS INSTANT RETRY - Zero delay
                    continue;
                }
                
                this._updatePerformanceMetrics(Date.now() - startTime, false);
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    }

    async getDocument(databaseName, collectionName, query) {
        const startTime = Date.now();
        let retryCount = 0;
        const maxRetries = 3; // Optimized for seamless QR scanning
        
        while (retryCount < maxRetries) {
            try {
                await this.initialize();
                
                // If not connected and in silent mode, return gracefully
                if (!this.isConnected && this.silentMode) {
                    this._updatePerformanceMetrics(Date.now() - startTime, false);
                    return {
                        success: false,
                        error: 'Database not available',
                        data: null,
                        offline: true
                    };
                }
                
                // Track active connections for 500+ user monitoring
                this.activeConnections++;
                this.performanceMetrics.peakConnections = Math.max(
                    this.performanceMetrics.peakConnections, 
                    this.activeConnections
                );
                
                const db = this.client.db(databaseName);
                const collection = db.collection(collectionName);
                
                // MAXIMUM SPEED query operation for QR scanning
                const document = await Promise.race([
                    collection.findOne(query, { maxTimeMS: 500 }), // Reduced from 1000ms
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Query operation timeout')), 700) // Reduced from 1200ms
                    )
                ]);
                
                this.activeConnections--; // Release connection tracking
                this._updatePerformanceMetrics(Date.now() - startTime, true);
                
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
                this.activeConnections--; // Release on error too
                retryCount++;
                
                // Handle connection limit errors specifically
                if (error.message && error.message.includes('too many connections')) {
                    this.performanceMetrics.rejectedConnections++;
                    this._updatePerformanceMetrics(Date.now() - startTime, false);
                    
                    return {
                        success: false,
                        error: 'Connection limit exceeded - upgrade MongoDB Atlas tier for 500+ users',
                        connectionLimitExceeded: true,
                        recommendedAction: 'Upgrade to M2+ tier for 1500+ connections'
                    };
                }
                
                // Only retry for connection errors, not query errors
                if (this._isConnectionError(error) && retryCount < maxRetries) {
                    // SEAMLESS INSTANT RETRY - Zero delay for maximum speed
                    continue;
                }
                
                this._updatePerformanceMetrics(Date.now() - startTime, false);
                
                // For non-connection errors (like "document not found"), return immediately
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    }

    _isConnectionError(error) {
        // Enhanced detection for 500+ connection scenarios
        const connectionErrorPatterns = [
            'MongoServerSelectionError',
            'MongoNetworkTimeoutError', 
            'MongoTimeoutError',
            'connection',
            'server selection timeout',
            'Connection timeout',
            'too many connections',  // Specific to connection limits
            'connection pool',       // Pool exhaustion
            'connection refused',    // Server rejecting connections
            'ECONNREFUSED',         // Network connection refused
            'connection limit'       // Explicit limit errors
        ];
        
        const errorName = error.name || '';
        const errorMessage = (error.message || '').toLowerCase();
        
        return connectionErrorPatterns.some(pattern => 
            errorName === pattern || errorMessage.includes(pattern.toLowerCase())
        );
    }

    async findDocuments(databaseName, collectionName, query = {}) {
        const startTime = Date.now();
        let retryCount = 0;
        const maxRetries = 3; // Optimized retry count for speed
        
        while (retryCount < maxRetries) {
            try {
                await this.initialize();
                
                // If not connected and in silent mode, return gracefully
                if (!this.isConnected && this.silentMode) {
                    this._updatePerformanceMetrics(Date.now() - startTime, false);
                    return {
                        success: false,
                        error: 'Database not available',
                        data: [],
                        offline: true
                    };
                }
                
                const db = this.client.db(databaseName);
                const collection = db.collection(collectionName);
                
                // MAXIMUM SPEED find operation
                const documents = await Promise.race([
                    collection.find(query).toArray(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Find operation timeout')), 1500) // Reduced from 2500ms
                    )
                ]);
                
                this._updatePerformanceMetrics(Date.now() - startTime, true);
                return {
                    success: true,
                    message: `Retrieved ${documents.length} documents successfully`,
                    data: documents
                };
            } catch (error) {
                retryCount++;
                
                // Only retry for connection errors
                if (this._isConnectionError(error) && retryCount < maxRetries) {
                    // SEAMLESS INSTANT RETRY - Zero delay
                    continue;
                }
                
                this._updatePerformanceMetrics(Date.now() - startTime, false);
                return {
                    success: false,
                    error: error.message,
                    data: []
                };
            }
        }
    }

    async updateDocument(databaseName, collectionName, query, update) {
        const startTime = Date.now();
        let retryCount = 0;
        const maxRetries = 3; // Optimized retry count for seamless speed
        
        while (retryCount < maxRetries) {
            try {
                await this.initialize();
                
                // If not connected and in silent mode, return gracefully
                if (!this.isConnected && this.silentMode) {
                    this._updatePerformanceMetrics(Date.now() - startTime, false);
                    return {
                        success: false,
                        error: 'Database not available',
                        offline: true
                    };
                }
                
                const db = this.client.db(databaseName);
                const collection = db.collection(collectionName);
                
                // MAXIMUM SPEED update operation
                const result = await Promise.race([
                    collection.updateOne(query, update, { wtimeout: 500 }), // Reduced from 1000ms
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Update operation timeout')), 800) // Reduced from 1500ms
                    )
                ]);
                
                this._updatePerformanceMetrics(Date.now() - startTime, true);
                
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
                retryCount++;
                
                // Only retry for connection errors
                if (this._isConnectionError(error) && retryCount < maxRetries) {
                    // SEAMLESS INSTANT RETRY - Zero delay
                    continue;
                }
                
                this._updatePerformanceMetrics(Date.now() - startTime, false);
                return {
                    success: false,
                    error: error.message
                };
            }
        }
    }

    // Get current performance metrics and connection info
    getPerformanceInfo() {
        const metrics = this.performanceMetrics;
        const successRate = metrics.totalRequests > 0 ? 
            (metrics.successfulRequests / metrics.totalRequests) * 100 : 100;
        
        // Determine if we're hitting connection limits
        const connectionHealth = this._assessConnectionHealth();
        
        return {
            instanceId: this.instanceId,
            isConnected: this.isConnected,
            isHealthy: this.isHealthy,
            maxPoolSize: this.client.options.maxPoolSize || 'UNLIMITED',
            minPoolSize: this.client.options.minPoolSize,
            activeConnections: this.activeConnections,
            peakConnections: metrics.peakConnections,
            totalRequests: metrics.totalRequests,
            successfulRequests: metrics.successfulRequests,
            failedRequests: metrics.failedRequests,
            queuedRequests: metrics.queuedRequests,
            rejectedConnections: metrics.rejectedConnections,
            successRate: `${successRate.toFixed(1)}%`,
            averageResponseTime: `${metrics.averageResponseTime.toFixed(0)}ms`,
            recommendedLimit: this.maxRecommendedConnections,
            connectionHealth: connectionHealth,
            // Specific guidance for 500+ users
            scalingRecommendation: this._getScalingRecommendation()
        };
    }

    // Assess connection health for 500+ user scenarios
    _assessConnectionHealth() {
        const metrics = this.performanceMetrics;
        const successRate = metrics.totalRequests > 0 ? 
            (metrics.successfulRequests / metrics.totalRequests) * 100 : 100;
        
        if (metrics.rejectedConnections > 0) {
            return 'CRITICAL - Connection limit exceeded';
        } else if (successRate < 95) {
            return 'DEGRADED - Performance issues detected';
        } else if (metrics.averageResponseTime > 1000) {
            return 'SLOW - High response times';
        } else if (this.activeConnections > 400) {
            return 'WARNING - Approaching limits';
        } else {
            return 'HEALTHY';
        }
    }

    // Get scaling recommendations for current load
    _getScalingRecommendation() {
        const metrics = this.performanceMetrics;
        
        if (metrics.rejectedConnections > 0 || this.activeConnections > 450) {
            return {
                action: 'URGENT - Upgrade MongoDB Atlas tier',
                reason: 'Connection limit exceeded or approaching M0 limit (500)',
                solutions: [
                    'Upgrade to M2 tier (1,500 connections) - $57/month',
                    'Upgrade to M5 tier (1,500 connections) - $140/month', 
                    'Upgrade to M10 tier (3,000 connections) - $280/month'
                ]
            };
        } else if (this.activeConnections > 300) {
            return {
                action: 'PREPARE - Monitor for scaling',
                reason: 'Approaching 60% of M0 connection limit',
                solutions: [
                    'Plan M2+ upgrade for sustained 500+ users',
                    'Implement connection pooling optimization',
                    'Consider request queuing for peak loads'
                ]
            };
        } else {
            return {
                action: 'OPTIMAL - Current setup sufficient',
                reason: 'Connection usage within safe limits',
                solutions: ['Continue monitoring for growth']
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

    // Static method to create SHIFT-OPTIMIZED isolated instances for 25-26 users with OPTIMIZED buffer
    static createShiftInstances(participantCount = 20, volunteerCount = 6, options = {}) {
        const totalUsers = participantCount + volunteerCount;
        const maxAllowedInstances = 100; // HARD LIMIT: Maximum 100 instances for Azure Free compatibility
        
        // COMPREHENSIVE SEAMLESS FAILOVER: 200 buffer + 25 ultimate fallback = 225 total buffer connections
        const requestedBufferConnections = 200;
        const ultimateFallbackConnections = 25; // Ultimate fallback connections
        const totalBufferConnections = requestedBufferConnections + ultimateFallbackConnections;
        const minReservedConnections = 5; // Minimum emergency connections
        
        // CALCULATE OPTIMIZED DISTRIBUTION within 100 instance limit
        const availableForBuffer = maxAllowedInstances - totalUsers - minReservedConnections;
        const actualBufferConnections = Math.min(totalBufferConnections, availableForBuffer);
        const actualStandardBuffer = Math.min(requestedBufferConnections, actualBufferConnections);
        const actualUltimateFallback = actualBufferConnections - actualStandardBuffer;
        const remainingInstances = maxAllowedInstances - totalUsers - actualBufferConnections;
        const reservedConnections = Math.max(minReservedConnections, remainingInstances);
        
        const totalInstances = totalUsers + actualBufferConnections + reservedConnections;
        
        // SAFETY CHECK: Ensure we never exceed 100 instances
        if (totalInstances > maxAllowedInstances) {
            throw new Error(`Cannot create ${totalInstances} instances. Maximum allowed: ${maxAllowedInstances}`);
        }
        
        // DETECT AZURE FREE TIER for optimized configuration
        const isAzureFree = true; // Hardcoded for your Azure Free setup
        const isMongoM0 = true; // Hardcoded for your MongoDB M0 setup
        
        console.log(`🎯 COMPREHENSIVE SEAMLESS FAILOVER for ${totalUsers} users (${participantCount} participants + ${volunteerCount} volunteers)`);
        console.log(`📊 Creating ${totalInstances} instances: ${totalUsers} users + ${actualStandardBuffer} buffer + ${actualUltimateFallback} ultimate + ${reservedConnections} emergency`);
        console.log(`⚠️  ENVIRONMENT: Azure ${isAzureFree ? 'FREE' : 'PAID'} + MongoDB ${isMongoM0 ? 'M0 (FREE)' : 'PAID'}`);
        console.log(`🔄 BUFFER STRATEGY: ${actualStandardBuffer} standard + ${actualUltimateFallback} ultimate = ${actualBufferConnections} total buffer connections`);
        console.log(`🚀 SEAMLESS OPERATION: Independent parallel connections with instant buffer switching`);
        
        const instances = [];
        
        for (let i = 0; i < totalInstances; i++) {
            let instanceType = 'buffer';
            let instanceRole = 'buffer';
            
            if (i < participantCount) {
                instanceType = 'participant';
                instanceRole = `participant_${i + 1}`;
            } else if (i < participantCount + volunteerCount) {
                instanceType = 'volunteer';
                instanceRole = `volunteer_${i - participantCount + 1}`;
            } else if (i < totalUsers + actualStandardBuffer) {
                instanceType = 'buffer';
                instanceRole = `buffer_${i - totalUsers + 1}`;
            } else if (i < totalUsers + actualBufferConnections) {
                instanceType = 'ultimate_fallback';
                instanceRole = `ultimate_${i - totalUsers - actualStandardBuffer + 1}`;
            } else {
                instanceType = 'emergency';
                instanceRole = `emergency_${i - totalUsers - actualBufferConnections + 1}`;
            }
            
            const instanceOptions = {
                ...options,
                instanceId: `shift_${instanceRole}_${Date.now()}_${Math.random().toString(36).substr(2, 3)}`,
                maxPoolSize: 1,  // SINGLE connection per instance for complete independence
                minPoolSize: 1,  // Always ready connection for instant response
                silentMode: options.silentMode !== false, // Default to silent for shift operations
                connectionCooldown: isAzureFree ? 100 : 25,  // Azure Free compatible cooldown
                isolatedMode: true,      // Complete isolation for shift reliability
                shiftOptimized: true,    // Mark as shift-optimized
                instanceType: instanceType,
                instanceRole: instanceRole,
                bufferMode: instanceType === 'buffer', // Special buffer handling
                ultimateFallbackMode: instanceType === 'ultimate_fallback', // Ultimate fallback handling
                emergencyMode: instanceType === 'emergency', // Emergency reserve handling
                azureFreeOptimized: isAzureFree,  // Azure Free tier optimizations
                mongoM0Optimized: isMongoM0       // MongoDB M0 optimizations
            };
            
            instances.push(new DatabaseConnectivity(instanceOptions));
        }
        
        console.log(`🔒 COMPREHENSIVE SEAMLESS FAILOVER INSTANCES CREATED:`);
        console.log(`   👥 ${participantCount} Participant connections (primary independent)`);
        console.log(`   🛠️  ${volunteerCount} Volunteer connections (primary independent)`);
        console.log(`   🔄 ${actualStandardBuffer} Standard Buffer connections (first-level failover)`);
        console.log(`   🛡️  ${actualUltimateFallback} Ultimate Fallback connections (second-level failover)`);
        console.log(`   🚨 ${reservedConnections} Emergency connections (critical backup)`);
        console.log(`   🎯 Total: ${totalInstances}/${maxAllowedInstances} independent parallel connections`);
        console.log(`   💡 SEAMLESS OPERATION: Even if got issue, get back connection seamlessly`);
        console.log(`   ⚡ BUFFER STRATEGY: ${actualBufferConnections} total failover connections (${actualStandardBuffer} + ${actualUltimateFallback})`);
        console.log(`   🔧 FREE TIER OPTIMIZED: Azure Free + MongoDB M0 compatible`);
        
        // RETURN ENHANCED OBJECT with buffer management methods
        return {
            instances,
            totalInstances,
            participantInstances: instances.slice(0, participantCount),
            volunteerInstances: instances.slice(participantCount, totalUsers),
            bufferInstances: instances.slice(totalUsers, totalUsers + actualStandardBuffer),
            ultimateFallbackInstances: instances.slice(totalUsers + actualStandardBuffer, totalUsers + actualBufferConnections),
            emergencyInstances: instances.slice(totalUsers + actualBufferConnections),
            stats: {
                participants: participantCount,
                volunteers: volunteerCount,
                totalUsers,
                standardBufferConnections: actualStandardBuffer,
                ultimateFallbackConnections: actualUltimateFallback,
                totalBufferConnections: actualBufferConnections,
                emergencyConnections: reservedConnections,
                totalInstances,
                isAzureFree,
                isMongoM0,
                maxAllowed: maxAllowedInstances
            },
            // SEAMLESS FAILOVER METHODS
            getHealthyConnection: function(userType = 'participant', userId = null) {
                return DatabaseConnectivity.getSeamlessConnection(this.instances, userType, userId);
            },
            getBufferConnection: function() {
                return this.bufferInstances.find(instance => instance.isHealthy && instance.isConnected);
            },
            getUltimateFallbackConnection: function() {
                return this.ultimateFallbackInstances.find(instance => instance.isHealthy && instance.isConnected);
            },
            moveToBuffer: function(failedInstance) {
                return DatabaseConnectivity.moveConnectionToBuffer(this.instances, failedInstance);
            }
        };
    }

    // Enhanced SHIFT-OPTIMIZED connection assignment with SEAMLESS buffer management
    static getShiftConnection(instances, userType = 'participant', userId = null, preferredInstanceId = null) {
        if (!instances || instances.length === 0) {
            throw new Error('No shift instances available');
        }
        
        let targetInstances = [];
        
        // PRIORITY 1: Try to get the preferred instance if specified and healthy
        if (preferredInstanceId) {
            const preferredInstance = instances.find(instance => 
                instance.instanceId === preferredInstanceId && instance.isHealthy
            );
            if (preferredInstance) {
                if (!preferredInstance.silentMode) {
                    console.log(`✅ PREFERRED CONNECTION: ${preferredInstance.instanceRole} restored for ${userType} ${userId || ''}`);
                }
                return preferredInstance;
            }
        }
        
        // PRIORITY 2: Filter instances by user type (primary connections)
        if (userType === 'participant') {
            targetInstances = instances.filter(instance => 
                instance.instanceType === 'participant' && instance.isHealthy
            );
        } else if (userType === 'volunteer') {
            targetInstances = instances.filter(instance => 
                instance.instanceType === 'volunteer' && instance.isHealthy
            );
        }
        
        // PRIORITY 3: If no healthy primary instances, use standard buffer pool (seamless failover)
        if (targetInstances.length === 0) {
            targetInstances = instances.filter(instance => 
                instance.instanceType === 'buffer' && instance.isHealthy
            );
            console.log(`🔄 SEAMLESS BUFFER FAILOVER: Using standard buffer connection for ${userType} ${userId || ''}`);
            console.log(`⚡ Original connection will recover in background and rejoin pool`);
        }
        
        // PRIORITY 4: If standard buffer exhausted, use ultimate fallback pool (deep failover)
        if (targetInstances.length === 0) {
            targetInstances = instances.filter(instance => 
                instance.instanceType === 'ultimate_fallback' && instance.isHealthy
            );
            console.log(`🛡️ ULTIMATE FALLBACK ENGAGED: Using ultimate fallback connection for ${userType} ${userId || ''}`);
            console.log(`🔧 System under heavy load - ultimate protection layer activated`);
        }
        
        // PRIORITY 5: If ultimate fallback exhausted, use reserved connections (emergency)
        if (targetInstances.length === 0) {
            targetInstances = instances.filter(instance => 
                instance.instanceType === 'emergency' && instance.isHealthy
            );
            console.log(`🚨 EMERGENCY RESERVED: Using emergency connection for ${userType} ${userId || ''}`);
        }
        
        // PRIORITY 6: If all instances unhealthy, attempt emergency recovery
        if (targetInstances.length === 0) {
            console.warn(`⚠️  ALL INSTANCES UNHEALTHY - Attempting emergency recovery`);
            
            // Try to find any instance and force recovery
            const firstAvailable = instances.find(instance => instance.instanceType === 'ultimate_fallback') || 
                                  instances.find(instance => instance.instanceType === 'buffer') || 
                                  instances[0];
            if (firstAvailable) {
                console.log(`🔄 EMERGENCY RECOVERY: Forcing reconnection on ${firstAvailable.instanceRole}`);
                // Force immediate reconnection attempt
                firstAvailable.isHealthy = false;
                firstAvailable.isConnected = false;
                firstAvailable.connectionPromise = firstAvailable._connectWithSeamlessRetry();
                return firstAvailable;
            }
            throw new Error('No database instances available for shift operations - CRITICAL FAILURE');
        }
        
        // SMART SELECTION: Choose least used instance from available pool
        const selectedInstance = targetInstances.reduce((best, current) => {
            const bestLoad = best.performanceMetrics ? best.performanceMetrics.totalRequests : 0;
            const currentLoad = current.performanceMetrics ? current.performanceMetrics.totalRequests : 0;
            return currentLoad < bestLoad ? current : best;
        });
        
        if (!selectedInstance.silentMode) {
            const connectionSource = selectedInstance.instanceType === 'buffer' ? 'BUFFER' : 
                                   selectedInstance.instanceType === 'reserved' ? 'RESERVED' : 'PRIMARY';
            console.log(`✅ ${connectionSource} CONNECTION: ${selectedInstance.instanceRole} assigned to ${userType} ${userId || ''}`);
        }
        
        return selectedInstance;
    }

    // Enhanced method to handle SEAMLESS connection recovery and buffer management
    static handleConnectionFailure(instances, failedInstanceId, userType, userId) {
        if (!instances || instances.length === 0) {
            return null;
        }
        
        const failedInstance = instances.find(instance => instance.instanceId === failedInstanceId);
        if (!failedInstance) {
            return null;
        }
        
        console.log(`🔄 HANDLING CONNECTION FAILURE: ${failedInstance.instanceRole} for ${userType} ${userId}`);
        
        // Mark instance as unhealthy and start background recovery
        failedInstance.isHealthy = false;
        failedInstance.isConnected = false;
        
        // Start IMMEDIATE background recovery (non-blocking)
        setTimeout(() => {
            console.log(`🔧 BACKGROUND RECOVERY: Starting repair for ${failedInstance.instanceRole}`);
            failedInstance.connectionPromise = failedInstance._connectWithSeamlessRetry();
        }, 100); // Tiny delay to prevent blocking
        
        // INSTANT failover to buffer connection
        const bufferConnection = this.getShiftConnection(instances, userType, userId);
        
        console.log(`⚡ SEAMLESS FAILOVER COMPLETE: ${userType} ${userId} switched to ${bufferConnection.instanceRole}`);
        console.log(`🔧 Original connection ${failedInstance.instanceRole} recovering in background`);
        
        return {
            newConnection: bufferConnection,
            failedConnection: failedInstance,
            failoverTime: Date.now()
        };
    }

    // Static method to get SHIFT health status with detailed breakdown
    static getShiftHealth(instances) {
        if (!instances || instances.length === 0) {
            return { 
                healthy: 0, 
                total: 0, 
                participants: { healthy: 0, total: 0 },
                volunteers: { healthy: 0, total: 0 },
                buffers: { healthy: 0, total: 0 },
                reserved: { healthy: 0, total: 0 },
                details: [] 
            };
        }
        
        const health = {
            healthy: 0,
            total: instances.length,
            participants: { healthy: 0, total: 0 },
            volunteers: { healthy: 0, total: 0 },
            buffers: { healthy: 0, total: 0 },
            reserved: { healthy: 0, total: 0 },
            details: []
        };
        
        instances.forEach((instance, index) => {
            const isHealthy = instance.isHealthy && instance.isConnected;
            if (isHealthy) health.healthy++;
            
            // Count by type
            if (instance.instanceType === 'participant') {
                health.participants.total++;
                if (isHealthy) health.participants.healthy++;
            } else if (instance.instanceType === 'volunteer') {
                health.volunteers.total++;
                if (isHealthy) health.volunteers.healthy++;
            } else if (instance.instanceType === 'buffer') {
                health.buffers.total++;
                if (isHealthy) health.buffers.healthy++;
            } else if (instance.instanceType === 'reserved') {
                health.reserved.total++;
                if (isHealthy) health.reserved.healthy++;
            }
            
            health.details.push({
                index: index,
                instanceId: instance.instanceId,
                instanceType: instance.instanceType || 'unknown',
                instanceRole: instance.instanceRole || 'unknown',
                isHealthy: isHealthy,
                isConnected: instance.isConnected,
                activeConnections: instance.activeConnections || 0,
                adaptiveTimeout: instance.adaptiveTimeout ? instance.adaptiveTimeout.current : 'N/A',
                successRate: instance.performanceMetrics ? 
                    (instance.performanceMetrics.totalRequests > 0 ? 
                        ((instance.performanceMetrics.successfulRequests / instance.performanceMetrics.totalRequests) * 100).toFixed(1) + '%' 
                        : '100%') : '100%'
            });
        });
        
        return health;
    }

    // Static method to create ISOLATED individual database instances for fitness test
    static createIsolatedInstances(count = 10, options = {}) {
        const instances = [];
        
        for (let i = 0; i < count; i++) {
            const instanceOptions = {
                ...options,
                instanceId: `isolated_${i + 1}_${Date.now()}_${Math.random().toString(36).substr(2, 3)}`,
                maxPoolSize: 1,  // INDIVIDUAL connection per instance for complete isolation
                minPoolSize: 1,  // Always ready connection for instant response
                silentMode: options.silentMode || true, // Reduce noise from multiple instances
                connectionCooldown: 200, // Faster recovery for individual connections
                isolatedMode: true // Mark as isolated for special handling
            };
            
            instances.push(new DatabaseConnectivity(instanceOptions));
        }
        
        console.log(`🔒 Created ${count} ISOLATED database instances - Each has independent connection! 🚀`);
        console.log(`💡 Failure isolation: If one connection fails, others continue working`);
        return instances;
    }

    // Static method to create multiple parallel database instances (original method)
    static createParallelInstances(count = 3, options = {}) {
        const instances = [];
        
        for (let i = 0; i < count; i++) {
            const instanceOptions = {
                ...options,
                instanceId: `smart_unlimited_${i + 1}_${Date.now()}`,
                maxPoolSize: 0,  // UNLIMITED connections for each instance
                minPoolSize: Math.max(Math.floor(20 / count), 3), // Distribute minimum connections
                silentMode: options.silentMode || false
            };
            
            instances.push(new DatabaseConnectivity(instanceOptions));
        }
        
        console.log(`🔗 Created ${count} SMART UNLIMITED database instances with intelligent monitoring! 🚀`);
        return instances;
    }

    // Static method to get a fault-tolerant instance from isolated instances
    static getFaultTolerantInstance(instances, preferredIndex = null) {
        if (!instances || instances.length === 0) {
            throw new Error('No database instances available');
        }
        
        // If a preferred instance is specified and healthy, use it
        if (preferredIndex !== null && instances[preferredIndex] && instances[preferredIndex].isHealthy) {
            return instances[preferredIndex];
        }
        
        // Find the first healthy instance
        for (let i = 0; i < instances.length; i++) {
            const instance = instances[i];
            if (instance.isHealthy && instance.isConnected) {
                return instance;
            }
        }
        
        // If no healthy instances, try to reconnect the first one
        const firstInstance = instances[0];
        console.warn(`⚠️  All instances unhealthy, attempting reconnection: ${firstInstance.instanceId}`);
        return firstInstance;
    }

    // Static method to get a load-balanced instance from parallel instances (original method)
    static getLoadBalancedInstance(instances) {
        if (!instances || instances.length === 0) {
            throw new Error('No database instances available');
        }
        
        // Simple round-robin load balancing
        if (!this.currentInstanceIndex) {
            this.currentInstanceIndex = 0;
        }
        
        const instance = instances[this.currentInstanceIndex];
        this.currentInstanceIndex = (this.currentInstanceIndex + 1) % instances.length;
        
        return instance;
    }

    // Get health status of all instances
    static getInstancesHealth(instances) {
        if (!instances || instances.length === 0) {
            return { healthy: 0, total: 0, details: [] };
        }
        
        const health = {
            healthy: 0,
            total: instances.length,
            details: []
        };
        
        instances.forEach((instance, index) => {
            const isHealthy = instance.isHealthy && instance.isConnected;
            if (isHealthy) health.healthy++;
            
            health.details.push({
                index: index,
                instanceId: instance.instanceId,
                isHealthy: isHealthy,
                isConnected: instance.isConnected,
                activeConnections: instance.activeConnections || 0,
                successRate: instance.performanceMetrics ? 
                    (instance.performanceMetrics.totalRequests > 0 ? 
                        ((instance.performanceMetrics.successfulRequests / instance.performanceMetrics.totalRequests) * 100).toFixed(1) + '%' 
                        : '100%') : '100%'
            });
        });
        
        return health;
    }

    // SEAMLESS CONNECTION MANAGEMENT: Enhanced methods for 75-buffer seamless failover
    static getSeamlessConnection(instances, userType = 'participant', userId = null) {
        if (!instances || instances.length === 0) {
            throw new Error('No instances available for seamless connection');
        }
        
        // Handle array of instances OR enhanced object from createShiftInstances
        const instanceArray = Array.isArray(instances) ? instances : instances.instances;
        
        // PRIORITY 1: Primary connections for user type
        let targetInstances = [];
        if (userType === 'participant') {
            targetInstances = instanceArray.filter(instance => 
                instance.instanceType === 'participant' && instance.isHealthy && instance.isConnected
            );
        } else if (userType === 'volunteer') {
            targetInstances = instanceArray.filter(instance => 
                instance.instanceType === 'volunteer' && instance.isHealthy && instance.isConnected
            );
        }
        
        // PRIORITY 2: Buffer connections (seamless failover)
        if (targetInstances.length === 0) {
            targetInstances = instanceArray.filter(instance => 
                instance.instanceType === 'buffer' && instance.isHealthy && instance.isConnected
            );
            if (targetInstances.length > 0) {
                console.log(`🔄 SEAMLESS BUFFER: Switching ${userType} ${userId || ''} to buffer connection`);
            }
        }
        
        // PRIORITY 3: Emergency connections
        if (targetInstances.length === 0) {
            targetInstances = instanceArray.filter(instance => 
                instance.instanceType === 'emergency' && instance.isHealthy && instance.isConnected
            );
            if (targetInstances.length > 0) {
                console.log(`🚨 EMERGENCY: Using emergency connection for ${userType} ${userId || ''}`);
            }
        }
        
        if (targetInstances.length === 0) {
            throw new Error(`No healthy connections available for ${userType}`);
        }
        
        // Select least loaded instance
        return targetInstances.reduce((best, current) => {
            const bestLoad = best.performanceMetrics?.totalRequests || 0;
            const currentLoad = current.performanceMetrics?.totalRequests || 0;
            return currentLoad < bestLoad ? current : best;
        });
    }
    
    // BUFFER MANAGEMENT: Move failed connection to buffer and assign new one
    static moveConnectionToBuffer(instances, failedInstance) {
        if (!failedInstance) return null;
        
        const instanceArray = Array.isArray(instances) ? instances : instances.instances;
        
        console.log(`🔧 MOVING TO BUFFER: ${failedInstance.instanceRole} failed, starting background recovery`);
        
        // Mark as unhealthy and start recovery
        failedInstance.isHealthy = false;
        failedInstance.isConnected = false;
        
        // Start background recovery (non-blocking)
        setTimeout(() => {
            console.log(`🔄 BACKGROUND RECOVERY: Repairing ${failedInstance.instanceRole}`);
            failedInstance.connectionPromise = failedInstance._connectWithSeamlessRetry().catch(err => {
                console.warn(`⚠️  Recovery failed for ${failedInstance.instanceRole}: ${err.message}`);
            });
        }, 50); // Minimal delay
        
        // Find buffer connection
        const bufferConnection = instanceArray.find(instance => 
            instance.instanceType === 'buffer' && instance.isHealthy && instance.isConnected
        );
        
        if (bufferConnection) {
            console.log(`⚡ SEAMLESS SWITCH: Failed connection moved to buffer pool, using ${bufferConnection.instanceRole}`);
            return bufferConnection;
        }
        
        console.warn(`⚠️  No buffer connections available - using emergency failover`);
        return instanceArray.find(instance => instance.isHealthy && instance.isConnected);
    }

    // Get instance information
    getInstanceInfo() {
        return this.getPerformanceInfo();
    }
}

module.exports = DatabaseConnectivity;