/**
 * 🎯 ENHANCED PARTICIPANTS CONTROLLER with 225 Buffer Connections
 * ===============================================================
 * 
 * ✅ 200 Standard Buffer + 25 Ultimate Fallback = 225 Total Buffer Connections
 * ✅ Drop-in replacement for your existing ParticipantsController
 * ✅ Same methods, enhanced with seamless failover protection
 */

const DatabaseConnectivity = require('./Database/databaseConnectivity');
const SeamlessFailoverWrapper = require('./Database/SeamlessFailoverWrapper');

class EnhancedParticipantsController {
    constructor() {
        // Your original database connection
        this.db = new DatabaseConnectivity();
        
        // Enhanced seamless failover system with 225 buffer connections
        this.seamlessDb = new SeamlessFailoverWrapper();
        this.seamlessDb.initializeSeamlessSystem(20, 6, 200, 25); // 200 buffer + 25 ultimate fallback
        
        // Track which system to use (seamless preferred, fallback to original)
        this.useSeamless = true;
    }

    /**
     * ADD PARTICIPANT with seamless failover protection
     */
    async addParticipant(req, res) {
        try {
            const participantData = req.body;
            
            // Generate unique ID if not provided
            if (!participantData.participantId) {
                participantData.participantId = `P${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            }

            let result;
            
            if (this.useSeamless) {
                // Try seamless system first (with 225 buffer connections)
                try {
                    const connection = await this.seamlessDb.getParticipantConnection(participantData.participantId);
                    result = await connection.insertDocument('UserDatabase', 'participants', participantData);
                    
                    if (result.success) {
                        console.log(`✅ SEAMLESS: Participant ${participantData.participantId} added successfully`);
                        return res.status(201).json({
                            success: true,
                            message: 'Participant registered successfully with seamless protection',
                            participantId: participantData.participantId,
                            insertedId: result.insertedId,
                            system: 'seamless_failover'
                        });
                    }
                } catch (seamlessError) {
                    console.warn(`⚠️ Seamless system unavailable: ${seamlessError.message}`);
                    console.log(`🔄 FALLING BACK to original database connection`);
                }
            }
            
            // Fallback to original system
            result = await this.db.insertDocument('UserDatabase', 'participants', participantData);
            
            if (result.success) {
                console.log(`✅ FALLBACK: Participant ${participantData.participantId} added successfully`);
                return res.status(201).json({
                    success: true,
                    message: 'Participant registered successfully',
                    participantId: participantData.participantId,
                    insertedId: result.insertedId,
                    system: 'original_fallback'
                });
            } else {
                throw new Error(result.error || 'Failed to add participant');
            }

        } catch (error) {
            console.error('❌ ADD PARTICIPANT ERROR:', error.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to register participant',
                error: error.message
            });
        }
    }

    /**
     * GET PARTICIPANT with seamless failover protection
     */
    async getParticipant(req, res) {
        try {
            const participantId = req.params.id;
            let result;

            if (this.useSeamless) {
                // Try seamless system first (with 225 buffer connections)
                try {
                    const connection = await this.seamlessDb.getParticipantConnection(participantId);
                    result = await connection.getDocument('UserDatabase', 'participants', { participantId });
                    
                    if (result.success && result.data) {
                        console.log(`✅ SEAMLESS: Participant ${participantId} retrieved successfully`);
                        return res.status(200).json({
                            success: true,
                            message: 'Participant found',
                            data: result.data,
                            system: 'seamless_failover'
                        });
                    }
                } catch (seamlessError) {
                    console.warn(`⚠️ Seamless system unavailable: ${seamlessError.message}`);
                    console.log(`🔄 FALLING BACK to original database connection`);
                }
            }

            // Fallback to original system
            result = await this.db.getDocument('UserDatabase', 'participants', { participantId });
            
            if (result.success && result.data) {
                console.log(`✅ FALLBACK: Participant ${participantId} retrieved successfully`);
                return res.status(200).json({
                    success: true,
                    message: 'Participant found',
                    data: result.data,
                    system: 'original_fallback'
                });
            } else {
                return res.status(404).json({
                    success: false,
                    message: 'Participant not found',
                    participantId
                });
            }

        } catch (error) {
            console.error('❌ GET PARTICIPANT ERROR:', error.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve participant',
                error: error.message
            });
        }
    }

    /**
     * UPDATE PARTICIPANT with seamless failover protection
     */
    async updateParticipant(req, res) {
        try {
            const participantId = req.params.id;
            const updateData = req.body;
            let result;

            if (this.useSeamless) {
                // Try seamless system first (with 225 buffer connections)
                try {
                    const connection = await this.seamlessDb.getParticipantConnection(participantId);
                    result = await connection.updateDocument(
                        'UserDatabase', 
                        'participants', 
                        { participantId }, 
                        { $set: updateData }
                    );
                    
                    if (result.success) {
                        console.log(`✅ SEAMLESS: Participant ${participantId} updated successfully`);
                        return res.status(200).json({
                            success: true,
                            message: 'Participant updated successfully with seamless protection',
                            participantId,
                            system: 'seamless_failover'
                        });
                    }
                } catch (seamlessError) {
                    console.warn(`⚠️ Seamless system unavailable: ${seamlessError.message}`);
                    console.log(`🔄 FALLING BACK to original database connection`);
                }
            }

            // Fallback to original system
            result = await this.db.updateDocument(
                'UserDatabase', 
                'participants', 
                { participantId }, 
                { $set: updateData }
            );
            
            if (result.success) {
                console.log(`✅ FALLBACK: Participant ${participantId} updated successfully`);
                return res.status(200).json({
                    success: true,
                    message: 'Participant updated successfully',
                    participantId,
                    system: 'original_fallback'
                });
            } else {
                throw new Error(result.error || 'Failed to update participant');
            }

        } catch (error) {
            console.error('❌ UPDATE PARTICIPANT ERROR:', error.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to update participant',
                error: error.message
            });
        }
    }

    /**
     * GET ALL PARTICIPANTS with seamless failover protection
     */
    async getAllParticipants(req, res) {
        try {
            let result;

            if (this.useSeamless) {
                // Try seamless system first (with 225 buffer connections)
                try {
                    const connection = await this.seamlessDb.getParticipantConnection('system_query');
                    result = await connection.findDocuments('UserDatabase', 'participants');
                    
                    if (result.success) {
                        console.log(`✅ SEAMLESS: Retrieved ${result.data.length} participants successfully`);
                        return res.status(200).json({
                            success: true,
                            message: `Found ${result.data.length} participants`,
                            data: result.data,
                            count: result.data.length,
                            system: 'seamless_failover'
                        });
                    }
                } catch (seamlessError) {
                    console.warn(`⚠️ Seamless system unavailable: ${seamlessError.message}`);
                    console.log(`🔄 FALLING BACK to original database connection`);
                }
            }

            // Fallback to original system
            result = await this.db.findDocuments('UserDatabase', 'participants');
            
            if (result.success) {
                console.log(`✅ FALLBACK: Retrieved ${result.data.length} participants successfully`);
                return res.status(200).json({
                    success: true,
                    message: `Found ${result.data.length} participants`,
                    data: result.data,
                    count: result.data.length,
                    system: 'original_fallback'
                });
            } else {
                throw new Error(result.error || 'Failed to retrieve participants');
            }

        } catch (error) {
            console.error('❌ GET ALL PARTICIPANTS ERROR:', error.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve participants',
                error: error.message
            });
        }
    }

    /**
     * GET SYSTEM STATUS - Monitor your 225 buffer connections
     */
    async getSystemStatus(req, res) {
        try {
            const originalDbStatus = this.db.getPerformanceInfo ? this.db.getPerformanceInfo() : { status: 'unknown' };
            const seamlessDbStatus = await this.seamlessDb.getSystemStatus();

            return res.status(200).json({
                success: true,
                message: 'System status retrieved successfully',
                status: {
                    original_database: originalDbStatus,
                    seamless_failover: seamlessDbStatus,
                    current_mode: this.useSeamless ? 'seamless_priority' : 'original_only',
                    buffer_summary: {
                        standard_buffer_connections: 200,
                        ultimate_fallback_connections: 25,
                        total_buffer_connections: 225,
                        emergency_connections: 5,
                        total_protection_layers: 4
                    }
                }
            });

        } catch (error) {
            console.error('❌ SYSTEM STATUS ERROR:', error.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve system status',
                error: error.message
            });
        }
    }
}

module.exports = EnhancedParticipantsController;
