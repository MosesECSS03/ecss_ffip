/**
 * SIMPLE INTEGRATION GUIDE: Add seamless failover to YOUR existing ParticipantsController
 * 
 * STEP 1: Add these lines to the top of your existing ParticipantsController.js
 * STEP 2: Replace your constructor
 * STEP 3: Replace your addParticipant method
 * STEP 4: Keep all your other existing methods unchanged
 */

// ===== STEP 1: ADD TO TOP OF YOUR FILE =====
const SeamlessFailoverWrapper = require('../Database/SeamlessFailoverWrapper');

class ParticipantsController {
    // ===== STEP 2: REPLACE YOUR CONSTRUCTOR =====
    constructor() {
        // Keep your original database connection
        this.dbConnection = new DatabaseConnectivity();
        
        // Add seamless failover wrapper
        this.seamlessSystem = new SeamlessFailoverWrapper();
        this.seamlessInitialized = false;
    }

    // ===== NEW METHOD: Initialize seamless system once =====
    async initializeSeamlessSystem() {
        if (!this.seamlessInitialized) {
            try {
                await this.seamlessSystem.initializeSeamlessSystem(20, 6);
                this.seamlessInitialized = true;
                console.log('✅ Seamless failover system ready');
            } catch (error) {
                console.warn('⚠️  Seamless system failed, will use original methods');
            }
        }
    }

    // ===== STEP 3: REPLACE YOUR addParticipant METHOD =====
    async addParticipant(participantData) {
        // Try seamless system first
        try {
            await this.initializeSeamlessSystem();
            if (this.seamlessInitialized) {
                console.log('🔄 Using seamless failover system');
                return await this.seamlessSystem.addParticipant(participantData);
            }
        } catch (error) {
            console.warn('⚠️  Seamless system failed, falling back to original method');
        }

        // Fallback to your original implementation
        console.log('🔄 Using original database method');
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                console.log('Adding participant:', participantData, `(Attempt ${retryCount + 1})`);
                
                // Initialize the database connection with retry logic
                await this.dbConnection.initialize();
                
                // Create new participant entry with metadata
                const now = new Date();
                const newParticipant = {
                    ...participantData,
                    submittedAt: {
                        date: now.toLocaleDateString('en-GB', { timeZone: 'Asia/Singapore' }), // dd/mm/yyyy format in GMT+8
                        time: now.toLocaleTimeString('en-GB', { 
                            timeZone: 'Asia/Singapore',
                            hour12: false, 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        }) // 24-hour format hh:mm in GMT+8
                    },
                    status: 'pending',
                    isCurrentParticipant: false
                };

                // Insert the document
                const result = await this.dbConnection.insertDocument('fitness_test', 'participants', newParticipant);
                
                if (result.success) {
                    console.log('✅ Participant added successfully:', result.insertedId);
                    return result;
                }
                
                throw new Error(result.error || 'Insert failed');
                
            } catch (error) {
                retryCount++;
                console.error(`❌ Attempt ${retryCount} failed:`, error.message);
                
                if (retryCount >= maxRetries) {
                    throw error;
                }
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }

    // ===== KEEP ALL YOUR OTHER EXISTING METHODS UNCHANGED =====
    // Your existing methods like getParticipant, updateParticipant, etc. stay exactly the same
    
    // ===== OPTIONAL: Add these new methods for enhanced functionality =====
    
    async getParticipantWithSeamless(participantId) {
        // Try seamless system first
        try {
            await this.initializeSeamlessSystem();
            if (this.seamlessInitialized) {
                return await this.seamlessSystem.getParticipant(participantId);
            }
        } catch (error) {
            console.warn('⚠️  Seamless system failed, using original method');
        }

        // Fallback to your original getParticipant method
        return await this.getParticipant(participantId);
    }

    async updateParticipantWithSeamless(participantId, updateData) {
        // Try seamless system first
        try {
            await this.initializeSeamlessSystem();
            if (this.seamlessInitialized) {
                return await this.seamlessSystem.updateParticipant(participantId, updateData);
            }
        } catch (error) {
            console.warn('⚠️  Seamless system failed, using original method');
        }

        // Fallback to your original updateParticipant method
        return await this.updateParticipant(participantId, updateData);
    }

    // Get system status
    getSeamlessStatus() {
        if (this.seamlessInitialized) {
            return this.seamlessSystem.getSystemStatus();
        }
        return { status: 'not_initialized', message: 'Using original database methods only' };
    }

    // Cleanup method
    async cleanup() {
        if (this.seamlessSystem) {
            await this.seamlessSystem.cleanup();
        }
        if (this.dbConnection) {
            await this.dbConnection.disconnect();
        }
    }
}

// ===== USAGE EXAMPLE =====
/*
const controller = new ParticipantsController();

// This will automatically try seamless system, fallback to original if needed
const result = await controller.addParticipant({
    name: 'John Doe',
    age: 25,
    email: 'john@example.com'
});

// Check system status
const status = controller.getSeamlessStatus();
console.log('System status:', status);

// Enhanced methods (optional)
const participant = await controller.getParticipantWithSeamless('P001');
const updateResult = await controller.updateParticipantWithSeamless('P001', { age: 26 });
*/

module.exports = ParticipantsController;
