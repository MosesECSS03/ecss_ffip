/**
 * MongoDB Compatibility Wrapper
 * Ensures your existing DatabaseConnectivity works with newer MongoDB drivers
 * by filtering out deprecated options
 */

const { MongoClient, ObjectId } = require('mongodb');

class MongoCompatibilityWrapper {
    static createClient(uri, options = {}) {
        // Filter out deprecated or unsupported options
        const compatibleOptions = { ...options };
        
        // Remove deprecated options that cause "option not supported" errors
        delete compatibleOptions.bufferMaxEntries;
        delete compatibleOptions.useUnifiedTopology; // Default in newer versions
        delete compatibleOptions.monitorCommands; // Deprecated
        
        // Ensure proper option names (some changed case)
        if (compatibleOptions.checkKeys !== undefined) {
            // checkKeys is deprecated, remove it
            delete compatibleOptions.checkKeys;
        }
        
        // Ensure localThresholdMS is reasonable (some drivers have limits)
        if (compatibleOptions.localThresholdMS !== undefined && compatibleOptions.localThresholdMS < 15) {
            compatibleOptions.localThresholdMS = 15; // Minimum allowed
        }
        
        return new MongoClient(uri, compatibleOptions);
    }
}

module.exports = MongoCompatibilityWrapper;
