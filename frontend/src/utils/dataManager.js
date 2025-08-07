/**
 * Centralized Data Persistence Manager
 * Provides consistent localStorage management across all components
 */

class DataManager {
  constructor() {
    this.maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    this.keyPrefix = 'ecss_ffip_';
  }

  /**
   * Save data to localStorage with automatic expiration
   * @param {string} key - Storage key (will be prefixed)
   * @param {object} data - Data to store
   * @param {number} maxAge - Optional custom expiration time in milliseconds
   */
  save(key, data, maxAge = this.maxAge) {
    try {
      const stateToSave = {
        data,
        lastUpdated: Date.now(),
        maxAge
      };

      // Test localStorage availability
      const testKey = `${this.keyPrefix}test_${Date.now()}`;
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);

      const storageKey = `${this.keyPrefix}${key}`;
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
      
      console.log(`💾 Data saved to localStorage [${key}]:`, data);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error saving data to localStorage [${key}]:`, error);
      
      // Handle quota exceeded error
      if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
        this.cleanup();
        // Retry once after cleanup
        try {
          const storageKey = `${this.keyPrefix}${key}`;
          localStorage.setItem(storageKey, JSON.stringify({
            data,
            lastUpdated: Date.now(),
            maxAge
          }));
          return { success: true };
        } catch (retryError) {
          return { success: false, error: 'Storage quota exceeded' };
        }
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Load data from localStorage with automatic expiration check
   * @param {string} key - Storage key (will be prefixed)
   * @returns {object|null} - Loaded data or null if not found/expired
   */
  load(key) {
    try {
      const storageKey = `${this.keyPrefix}${key}`;
      const savedState = localStorage.getItem(storageKey);
      
      if (!savedState) {
        console.log(`📝 No saved data found for [${key}]`);
        return null;
      }

      const parsedState = JSON.parse(savedState);
      const age = Date.now() - (parsedState.lastUpdated || 0);
      const maxAge = parsedState.maxAge || this.maxAge;

      if (age < maxAge) {
        console.log(`🔄 Loading saved data from localStorage [${key}]:`, parsedState.data);
        return parsedState.data;
      } else {
        console.log(`⏰ Saved data for [${key}] is too old, removing`);
        localStorage.removeItem(storageKey);
        return null;
      }
    } catch (error) {
      console.error(`❌ Error loading data from localStorage [${key}]:`, error);
      
      // Handle corrupted data
      if (error instanceof SyntaxError || error.message.includes('JSON')) {
        console.log(`🔄 Detected corrupted data for [${key}], cleaning up`);
        const storageKey = `${this.keyPrefix}${key}`;
        localStorage.removeItem(storageKey);
      }
      
      return null;
    }
  }

  /**
   * Remove specific data from localStorage
   * @param {string} key - Storage key (will be prefixed)
   */
  remove(key) {
    try {
      const storageKey = `${this.keyPrefix}${key}`;
      localStorage.removeItem(storageKey);
      console.log(`🗑️ Removed data for [${key}]`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error removing data [${key}]:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if data exists for a key
   * @param {string} key - Storage key (will be prefixed)
   * @returns {boolean}
   */
  exists(key) {
    const storageKey = `${this.keyPrefix}${key}`;
    return localStorage.getItem(storageKey) !== null;
  }

  /**
   * Get all keys managed by this data manager
   * @returns {array} - Array of keys (without prefix)
   */
  getAllKeys() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.keyPrefix)) {
        keys.push(key.substring(this.keyPrefix.length));
      }
    }
    return keys;
  }

  /**
   * Clean up expired or corrupted data
   */
  cleanup() {
    try {
      const keys = this.getAllKeys();
      let cleanedCount = 0;

      keys.forEach(key => {
        try {
          const data = this.load(key);
          if (data === null) {
            cleanedCount++;
          }
        } catch (error) {
          // Remove corrupted entries
          this.remove(key);
          cleanedCount++;
        }
      });

      console.log(`🧹 Cleaned up ${cleanedCount} expired/corrupted entries`);
      return { success: true, cleanedCount };
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clear all data managed by this data manager
   */
  clearAll() {
    try {
      const keys = this.getAllKeys();
      keys.forEach(key => this.remove(key));
      console.log(`🗑️ Cleared all data (${keys.length} entries)`);
      return { success: true, clearedCount: keys.length };
    } catch (error) {
      console.error('❌ Error clearing all data:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get storage information
   * @returns {object} - Storage usage information
   */
  getStorageInfo() {
    try {
      const keys = this.getAllKeys();
      let totalSize = 0;
      
      keys.forEach(key => {
        const storageKey = `${this.keyPrefix}${key}`;
        const data = localStorage.getItem(storageKey);
        if (data) {
          totalSize += data.length;
        }
      });

      return {
        keysCount: keys.length,
        totalSizeBytes: totalSize,
        totalSizeKB: Math.round(totalSize / 1024 * 100) / 100,
        keys: keys
      };
    } catch (error) {
      console.error('❌ Error getting storage info:', error);
      return { error: error.message };
    }
  }

  /**
   * Test localStorage functionality
   * @returns {object} - Test results
   */
  test() {
    try {
      const testKey = 'storage_test';
      const testData = { test: true, timestamp: Date.now() };
      
      // Test save
      const saveResult = this.save(testKey, testData);
      if (!saveResult.success) {
        return { success: false, error: 'Save test failed', details: saveResult };
      }

      // Test load
      const loadedData = this.load(testKey);
      if (!loadedData || loadedData.test !== true) {
        return { success: false, error: 'Load test failed' };
      }

      // Test remove
      const removeResult = this.remove(testKey);
      if (!removeResult.success) {
        return { success: false, error: 'Remove test failed', details: removeResult };
      }

      // Verify removal
      const afterRemove = this.load(testKey);
      if (afterRemove !== null) {
        return { success: false, error: 'Remove verification failed' };
      }

      console.log('✅ DataManager test passed');
      return { success: true, message: 'All tests passed' };
    } catch (error) {
      console.error('❌ DataManager test failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create and export singleton instance
const dataManager = new DataManager();

export default dataManager;

// Named exports for convenience
export const { save, load, remove, exists, cleanup, clearAll, getStorageInfo, test } = dataManager;

// Export specific data keys used across the application
export const DATA_KEYS = {
  PARTICIPANTS_STATE: 'participants_state',
  PARTICIPANTS_ID: 'participant_id',
  VOLUNTEERS_STATE: 'volunteers_state',
  LANGUAGE_PREFERENCE: 'language_preference',
  TRAINERS_STATE: 'trainers_state',
  FORM_AUTOSAVE: 'form_autosave'
};
