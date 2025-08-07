import React, { Component } from 'react'
import LanguageContext from '../contexts/LanguageContext'
import { translations } from '../utils/translations'
import './Pages.css'
import QrScanner from 'qr-scanner'
import axios from "axios"

const stationFields = {
  heightWeight: ['height', 'weight'],
  sitStand: ['score1', 'remarks'],
  armBanding: ['score1', 'remarks'],
  marching: ['score1', 'remarks'],
  sitReach: ['leftRight', 'score1', 'score2'],
  backStretch: ['leftRight', 'score1', 'score2'],
  speedWalking: ['score1', 'score2', 'remarks'],
  handGrip: ['leftRight', 'score1', 'score2']
}

const API_BASE_URL =
  window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://ecss-fft.azurewebsites.net';

console.log('🔧 Volunteers API_BASE_URL configured as:', API_BASE_URL);

class Volunteers extends Component {
  static contextType = LanguageContext

  constructor(props) {
    super(props)
    this.state = {
      selectedStation: '',
      formData: {},
      qrValue: '',
      qrScanned: false,
      cameraError: null,
      dataStatusMessage: '' // For showing save/load notifications
    }
    this.qrScanner = null
    this.isProcessingQR = false // Flag to prevent multiple simultaneous QR processing
    this.scannerRetryCount = 0 // Track retry attempts
    this.maxRetryAttempts = 5 // Maximum retry attempts before giving up
    this.scanCooldown = false // Prevent rapid successive scans
    
    // Generate unique device ID for multi-device support
    this.deviceId = this.getOrCreateDeviceId()
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    console.log('🔧 Volunteer device initialized with ID:', this.deviceId, 'Session:', this.sessionId)
  }

  // Generate or retrieve device ID for multi-device tracking
  getOrCreateDeviceId = () => {
    try {
      let deviceId = localStorage.getItem('volunteer_device_id')
      if (!deviceId) {
        // Create unique device ID combining timestamp, random, and browser info
        const timestamp = Date.now().toString(36)
        const random = Math.random().toString(36).substr(2, 9)
        const browserInfo = navigator.userAgent.replace(/[^a-zA-Z0-9]/g, '').substr(0, 8)
        deviceId = `vol_${timestamp}_${random}_${browserInfo}`
        localStorage.setItem('volunteer_device_id', deviceId)
      }
      return deviceId
    } catch (error) {
      // Fallback if localStorage fails
      return `vol_fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }

  componentDidMount() {
    // Load saved state when component mounts
    this.loadStateFromLocalStorage();
    
    // Log device initialization for debugging multi-device scenarios
    console.log(`📱 Volunteer component mounted on device [${this.deviceId}]`);
    
    // Add performance optimization for multiple devices
    this.initializePerformanceOptimizations();
  }

  componentWillUnmount() {
    // Clean up processing flags
    this.isProcessingQR = false;
    this.scanCooldown = false;
    
    // Save state immediately before component unmounts
    this.immediateSave();
    this.stopQRScanner()
    
    // Clear any pending timeouts
    if (this._qrScannerStartTimeout) {
      clearTimeout(this._qrScannerStartTimeout);
    }
    
    if (this._scanCooldownTimeout) {
      clearTimeout(this._scanCooldownTimeout);
    }
    
    // Remove global error handler
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
    
    console.log(`📱 Volunteer component unmounted on device [${this.deviceId}] session [${this.sessionId}]`);
  }

  // Handle unhandled promise rejections (camera errors, etc.)
  handleUnhandledRejection = (event) => {
    if (event.reason && (
      event.reason.message?.includes('camera') ||
      event.reason.message?.includes('getUserMedia') ||
      event.reason.message?.includes('QR') ||
      event.reason.name === 'NotAllowedError' ||
      event.reason.name === 'NotFoundError' ||
      event.reason.name === 'OverconstrainedError'
    )) {
      console.warn(`🛡️ Handled camera error globally for device [${this.deviceId}]:`, event.reason);
      event.preventDefault(); // Prevent the error from appearing in console
      
      // Auto-recover from camera errors
      this.handleCameraErrorRecovery(event.reason);
    }
  }

  // Handle camera error recovery
  handleCameraErrorRecovery = (error) => {
    console.log(`🔧 Attempting camera error recovery for device [${this.deviceId}]:`, error.message);
    
    // Stop current scanner
    this.stopQRScanner();
    
    // Reset retry count if it's a new type of error
    if (error.name === 'NotAllowedError') {
      this.setState({ cameraError: 'Camera permission denied. Please allow camera access.' });
      return; // Don't auto-retry permission errors
    }
    
    // Auto-restart scanner after a brief delay
    setTimeout(() => {
      if (!this.qrScanner && !this.isProcessingQR && this.videoNode && this.state.selectedStation) {
        console.log('🔄 Auto-recovering QR scanner after camera error');
        this.startQRScannerWithNode(this.videoNode);
      }
    }, 1000);
  }

  // Initialize performance optimizations for multi-device support
  initializePerformanceOptimizations = () => {
    // Optimize garbage collection for better performance with multiple cameras
    if (window.performance && window.performance.mark) {
      window.performance.mark('volunteer-component-start');
    }
    
    // Pre-warm the camera permissions to reduce startup time
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          console.log(`📹 Found ${videoDevices.length} camera(s) on device [${this.deviceId}]`);
          
          // Test camera access to prevent permission issues
          return navigator.mediaDevices.getUserMedia({ 
            video: { 
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            } 
          });
        })
        .then(stream => {
          // Immediately release the test stream
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
            console.log(`✅ Camera permissions verified for device [${this.deviceId}]`);
          }
        })
        .catch(err => {
          console.warn(`⚠️ Camera permission check failed on device [${this.deviceId}]:`, err.message);
        });
    }
    
    // Setup global error handler for unhandled camera errors
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  stopQRScanner = () => {
    try {
      if (this.qrScanner) {
        this.qrScanner.destroy()
        this.qrScanner = null
      }
    } catch (e) {
      console.warn(`Warning during scanner cleanup for device [${this.deviceId}]:`, e.message);
    }
    
    // Clear any pending timeouts
    if (this._scanCooldownTimeout) {
      clearTimeout(this._scanCooldownTimeout);
    }
    
    // Reset cooldown and processing flags
    this.scanCooldown = false;
    this.isProcessingQR = false;
    
    // Clear camera error when scanner stops
    this.setState({ cameraError: null });
    console.log(`📹 QR scanner stopped and cleaned up for device [${this.deviceId}]`);
  }

  // Data persistence methods
  saveStateToLocalStorage = (isRetry = false) => {
    try {
      const stateToSave = {
        selectedStation: this.state.selectedStation,
        formData: this.state.formData,
        qrValue: this.state.qrValue,
        qrScanned: this.state.qrScanned,
        lastUpdated: Date.now()
      };
      
      // Test if localStorage is available and has space
      const testKey = 'test_volunteers_storage_' + Date.now();
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      
      localStorage.setItem('volunteersAppState', JSON.stringify(stateToSave));
      console.log('💾 Volunteers state saved to localStorage:', stateToSave);
      
      // Show brief notification
      this.setState({ dataStatusMessage: '💾 Data saved' });
      setTimeout(() => {
        this.setState({ dataStatusMessage: '' });
      }, 2000);
    } catch (error) {
      console.error('❌ Error saving volunteers state to localStorage:', error);
      
      // If this is not a retry and we get a storage error, try to recover
      if (!isRetry && (error.name === 'QuotaExceededError' || error.message.includes('quota'))) {
        console.log('🔄 Storage quota exceeded, attempting cleanup and retry...');
        this.cleanUpLocalStorage();
        // Try one more time after cleanup
        this.saveStateToLocalStorage(true);
        return;
      }
      
      this.setState({ dataStatusMessage: '❌ Failed to save data' });
      setTimeout(() => {
        this.setState({ dataStatusMessage: '' });
      }, 3000);
    }
  }

  loadStateFromLocalStorage = () => {
    try {
      const savedState = localStorage.getItem('volunteersAppState');
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        
        // Check if the saved state is not too old (e.g., 24 hours)
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        const age = Date.now() - (parsedState.lastUpdated || 0);
        
        if (age < maxAge) {
          // Merge saved state with current state
          const newState = {
            selectedStation: parsedState.selectedStation || '',
            formData: parsedState.formData || {},
            qrValue: parsedState.qrValue || '',
            qrScanned: parsedState.qrScanned || false,
            stations: parsedState.stations || []
          };
          
          this.setState(newState);
          console.log('🔄 Volunteers state restored from localStorage:', newState);
          
          // Clear the notification after 3 seconds
          setTimeout(() => {
            this.setState({ dataStatusMessage: '' });
          }, 3000);
        } else {
          console.log('⏰ Saved volunteers state is too old, starting fresh');
          localStorage.removeItem('volunteersAppState');
        }
      } else {
        console.log('📝 No saved volunteers state found, starting fresh');
      }
    } catch (error) {
      console.error('❌ Error loading volunteers state from localStorage:', error);
      
      // If there's a parsing error or corruption, clean up
      if (error instanceof SyntaxError || error.message.includes('JSON')) {
        console.log('🔄 Detected corrupted volunteers data, cleaning up...');
        localStorage.removeItem('volunteersAppState');
        this.setState({ dataStatusMessage: '❌ Failed to restore previous data' });
        setTimeout(() => {
          this.setState({ dataStatusMessage: '' });
        }, 3000);
      }
    }
  }

  // Debounced save function to reduce localStorage writes
  debouncedSave = (() => {
    let timeoutId;
    const fn = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        this.saveStateToLocalStorage();
      }, 500); // Wait 500ms after last change
    };
    
    // Add cancel method for cleanup
    fn.cancel = () => {
      clearTimeout(timeoutId);
    };
    
    return fn;
  })()

  // Immediate save for critical operations
  immediateSave = () => {
    // Cancel any pending debounced save
    if (this.debouncedSave && this.debouncedSave.cancel) {
      this.debouncedSave.cancel();
    }
    // Save immediately
    this.saveStateToLocalStorage();
  }

  // Clean up corrupted localStorage data
  cleanUpLocalStorage = () => {
    try {
      const keysToClean = ['volunteersAppState'];
      keysToClean.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          console.log(`🧹 Cleaned up corrupted localStorage key: ${key}`);
        }
      });
    } catch (error) {
      console.error('❌ Error cleaning localStorage:', error);
    }
  }

    // Add method to clear saved state
  clearSavedState = () => {
    localStorage.removeItem('volunteersAppState');
    console.log('🗑️ Volunteers saved state cleared from localStorage');
    this.setState({ 
      dataStatusMessage: '🗑️ Saved data cleared successfully' 
    });
    setTimeout(() => {
      this.setState({ dataStatusMessage: '' });
    }, 2000);
  }

  // Handle volunteer session completion
  handleVolunteerDone = () => {
    const { language } = this.context;
    
    // Confirm with the volunteer
    const confirmMessage = language === 'en' 
      ? 'Are you sure you want to finish your volunteer session?' 
      : '您确定要结束志愿者会话吗？';
    
    if (window.confirm(confirmMessage)) {
      try {
        // Clear all volunteer data
        this.clearSavedState();
        
        // Show completion message
        const completeMessage = language === 'en' 
          ? 'Thank you for volunteering! Your session is complete.' 
          : '感谢您的志愿服务！您的会话已完成。';
        
        alert(completeMessage);
        
        // Navigate back to home page
        window.location.href = '/';
      } catch (error) {
        console.error('❌ Error finishing volunteer session:', error);
        const errorMessage = language === 'en' 
          ? 'Error finishing session. Please try again.' 
          : '完成会话时出错。请重试。';
        alert(errorMessage);
      }
    }
  }

  setVideoRef = (node) => {
    // Only update if the node actually changed
    if (node !== this.videoNode) {
      this.videoNode = node;
      
      // Clear any existing timeouts
      clearTimeout(this._qrScannerStartTimeout);
      
      if (node && this.state.selectedStation) {
        // Reduce timeout for faster startup on multiple devices
        this._qrScannerStartTimeout = setTimeout(() => {
          if (!this.qrScanner && !this.isProcessingQR) {
            console.log(`📹 Starting QR scanner on device [${this.deviceId}] for station: ${this.state.selectedStation}`);
            // Use the backend-connected scanner to retrieve participant data
            this.startQRScannerWithNode(node);
          }
        }, 100); // Reduced from 200ms to 100ms for faster response
      }
    }
  }

  startQRScannerWithNode = (videoNode) => {
    // Prevent concurrent scanner initialization
    if (this.isProcessingQR || this.scanCooldown) {
      console.log(`⏳ Scanner initialization blocked - processing: ${this.isProcessingQR}, cooldown: ${this.scanCooldown}`);
      return;
    }

    // Clean up any existing scanner
    if (this.qrScanner) {
      try {
        this.qrScanner.destroy();
      } catch (e) {
        console.warn('Error destroying existing scanner:', e.message);
      }
      this.qrScanner = null;
    }
    
    this.setState({ cameraError: null });
    console.log(`📹 Initializing QR scanner for device [${this.deviceId}] session [${this.sessionId}]`);
    
    if (videoNode) {
      this.qrScanner = new QrScanner(
        videoNode,
        async result => {
          // Implement scan cooldown to prevent rapid successive scans
          if (this.scanCooldown || !result || !result.data || this.isProcessingQR) {
            console.log(`⏭️ Scan skipped - cooldown: ${this.scanCooldown}, processing: ${this.isProcessingQR}`);
            return;
          }

          // Activate cooldown period
          this.scanCooldown = true;
          this._scanCooldownTimeout = setTimeout(() => {
            this.scanCooldown = false;
          }, 1000); // 1 second cooldown between scans

          // Set processing flag to prevent multiple simultaneous scans
          this.isProcessingQR = true;
          
          // Don't stop scanner immediately - let it continue for multi-device support
          
          // Generate unique scan ID for tracking across devices
          const scanId = `scan_${this.deviceId}_${this.sessionId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          console.log(`🔍 QR Scan started [${scanId}]:`, result.data);
          
          try {
            // Use AbortController for fast timeout handling
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // Increased timeout for multi-device scenarios
            
            // 🔍 ENHANCED REQUEST LOGGING FOR SPECIFIC QR CODE
            console.log(`🚀 STARTING REQUEST FOR QR: ${result.data}`);
            console.log(`🚀 Backend URL: ${API_BASE_URL}/participants`);
            console.log(`🚀 Request payload:`, {
              "purpose": "retrieveParticipant",
              "participantID": result.data
            });
            console.log(`🚀 Scan ID: ${scanId}`);
            
            const response = await axios.post(`${API_BASE_URL}/participants`, {
              "purpose": "retrieveParticipant",
              "participantID": result.data
            }, {
              signal: controller.signal,
              timeout: 8000,
              headers: {
                'Content-Type': 'application/json',
                'X-Scan-ID': scanId,
                'X-Device-ID': this.deviceId || 'unknown',
                'X-Session-ID': this.sessionId || 'unknown',
                'X-Multi-Device': 'true' // Flag for backend to handle concurrent requests
              }
            });
            
            clearTimeout(timeoutId);
            
            // 🔍 COMPREHENSIVE RESPONSE LOGGING
            console.log(`✅ QR Scan completed [${scanId}]:`, response.data?.success ? 'Success' : 'Failed');
            console.log(`📦 FULL RESPONSE for QR ${result.data}:`, response);
            console.log(`📦 Response status:`, response.status);
            console.log(`📦 Response headers:`, response.headers);
            console.log(`📦 Response data:`, JSON.stringify(response.data, null, 2));
            
            if (response.data) {
              console.log(`📋 response.data.success:`, response.data.success);
              console.log(`📋 response.data.data exists:`, !!response.data.data);
              console.log(`📋 response.data.message:`, response.data.message);
            }
            
            if (response.data && response.data.success && response.data.data) {
              console.log(`📋 Participant data retrieved for scan [${scanId}]:`, response.data.data);
              
              // Populate participant personal data
              const formData = {};
              Object.keys(response.data.data).forEach(key => {
                formData[key] = response.data.data[key];
              });
              
              // Check if participant has height and weight recorded
              const hasHeight = formData.height && formData.height !== '' && formData.height !== '-';
              const hasWeight = formData.weight && formData.weight !== '' && formData.weight !== '-';
              formData.hasHeightWeight = hasHeight && hasWeight;
              
              // Initialize empty form fields for the selected station
              if (this.state.selectedStation && stationFields[this.state.selectedStation]) {
                stationFields[this.state.selectedStation].forEach(field => {
                  if (formData[field] === undefined || formData[field] === null) {
                    formData[field] = '';
                  }
                });
              }
              
              // Stop scanner only after successful data retrieval for this device
              this.stopQRScanner();
              console.log(`📹 QR scanner stopped after successful scan [${scanId}]`);
              
              this.setState({
                qrValue: result.data,
                qrScanned: true,
                cameraError: null,
                formData
              }, () => {
                // Immediately save state after successful scan
                this.immediateSave();
                console.log(`💾 Data saved for scan [${scanId}]`);
              });
            } else {
              console.log(`❌ Invalid response structure for scan [${scanId}]:`, response.data);
              
              const { language } = this.context;
              const errorMessage = response.data?.message || (language === 'en' ? 'No participant found' : '找不到参与者');
              
              this.setState({
                qrValue: result.data,
                qrScanned: false,
                cameraError: errorMessage,
                formData: {}
              }, () => {
                // Don't stop scanner - let it continue for multi-device support
                // Auto-restart scanner after 2 seconds
                setTimeout(() => {
                  if (!this.isProcessingQR && this.videoNode && this.state.selectedStation) {
                    console.log(`🔄 Auto-restarting QR scanner after error [${scanId}]`);
                    // Scanner should already be running, just reset error state
                    this.setState({ cameraError: null });
                  }
                }, 2000);
              });
            }
          } catch (err) {
            // 🔍 COMPREHENSIVE ERROR LOGGING FOR QR SCAN
            console.error(`❌ QR Scan error [${scanId}] for QR: ${result.data}:`, err);
            console.error(`❌ Error details:`, {
              message: err.message,
              name: err.name,
              code: err.code,
              status: err.response?.status,
              statusText: err.response?.statusText,
              responseData: err.response?.data,
              stack: err.stack
            });
            
            // Enhanced error handling for multi-device scenarios
            let errorMessage = 'Network or server error';
            const { language } = this.context;
            
            if (err.name === 'AbortError') {
              errorMessage = language === 'en' ? 'Request timeout - check connection' : '请求超时 - 检查连接';
              console.error(`⏰ Request timed out for QR: ${result.data}`);
            } else if (err.code === 'ERR_NETWORK') {
              errorMessage = language === 'en' ? 'Network connection failed' : '网络连接失败';
              console.error(`🌐 Network error for QR: ${result.data}`);
            } else if (err.response?.status === 409) {
              // Handle concurrent request conflicts
              errorMessage = language === 'en' ? 'Participant being processed by another device' : '参与者正在被其他设备处理';
              console.log(`⚠️ Concurrent processing detected [${scanId}] - this is normal in multi-device environments`);
            } else if (err.response?.status === 429) {
              // Handle rate limiting
              errorMessage = language === 'en' ? 'Too many requests - please wait' : '请求过多 - 请稍等';
            }
            
            console.error(`❌ Final error classification [${scanId}]: ${errorMessage}`);
            
            this.setState({
              qrValue: result.data,
              qrScanned: false,
              cameraError: errorMessage,
              formData: {}
            }, () => {
              // Don't stop scanner - let it continue for multi-device support
              // Auto-clear error after 3 seconds
              setTimeout(() => {
                if (!this.isProcessingQR) {
                  this.setState({ cameraError: null });
                  console.log(`🔄 Auto-cleared error for continued scanning [${scanId}]`);
                }
              }, 3000);
            });
          } finally {
            // Always clear processing flag
            this.isProcessingQR = false;
          }
        },
        {
          onDecodeError: error => {
            // Safely handle decode errors - these are normal and shouldn't be logged excessively
            const errorMessage = error && error.message ? error.message : 'Unknown decode error';
            // Only log actual decode problems, not "no QR code found" messages
            if (!errorMessage.includes('No QR code found') && 
                !errorMessage.includes('Could not find') && 
                !errorMessage.includes('NotFoundException')) {
              console.warn(`QR Scanner decode error [${this.deviceId}]:`, errorMessage);
            }
          },
          highlightScanRegion: true,
          highlightCodeOutline: true,
          // Optimize for multi-device performance
          maxScansPerSecond: 5, // Reduced to prevent overwhelming the system
          preferredCamera: 'environment',
          // Enhanced scan region calculation for better multi-device performance
          calculateScanRegion: (video) => {
            const smallerDimension = Math.min(video.videoWidth, video.videoHeight);
            const scanRegionSize = Math.round(0.7 * smallerDimension); // Slightly larger scan area
            return {
              x: Math.round((video.videoWidth - scanRegionSize) / 2),
              y: Math.round((video.videoHeight - scanRegionSize) / 2),
              width: scanRegionSize,
              height: scanRegionSize,
            };
          }
        }
      );
      
      // Enhanced scanner startup with better error handling
      this.qrScanner.start()
        .then(() => {
          console.log(`✅ QR Scanner started successfully for device [${this.deviceId}]`);
          this.scannerRetryCount = 0; // Reset retry count on successful start
        })
        .catch(e => {
          console.error(`❌ QR Scanner start error for device [${this.deviceId}]:`, e);
          
          // Handle specific camera errors
          let userMessage = '';
          if (e.name === 'NotAllowedError') {
            userMessage = 'Camera permission denied. Please allow camera access and refresh the page.';
          } else if (e.name === 'NotFoundError') {
            userMessage = 'No camera found. Please ensure your device has a camera.';
          } else if (e.name === 'OverconstrainedError') {
            userMessage = 'Camera constraints not supported. Trying alternative settings...';
            // Retry with relaxed constraints
            this.retryWithRelaxedConstraints();
            return;
          } else {
            userMessage = `Camera error: ${e.message}`;
          }
          
          this.setState({ cameraError: userMessage });
          
          // Auto-retry with exponential backoff
          if (this.scannerRetryCount < this.maxRetryAttempts) {
            this.scannerRetryCount++;
            const retryDelay = Math.min(1000 * Math.pow(2, this.scannerRetryCount - 1), 10000); // Cap at 10 seconds
            console.log(`� Retrying scanner start in ${retryDelay}ms (attempt ${this.scannerRetryCount}/${this.maxRetryAttempts})`);
            
            setTimeout(() => {
              if (!this.qrScanner && this.videoNode && this.state.selectedStation) {
                this.startQRScannerWithNode(this.videoNode);
              }
            }, retryDelay);
          } else {
            console.error(`❌ Max retry attempts reached for device [${this.deviceId}]`);
            this.setState({ cameraError: 'Camera initialization failed after multiple attempts. Please refresh the page.' });
          }
        });
    }
  }

  // Retry scanner with relaxed camera constraints
  retryWithRelaxedConstraints = () => {
    console.log(`🔧 Retrying with relaxed camera constraints for device [${this.deviceId}]`);
    
    // Clean up current scanner
    if (this.qrScanner) {
      this.qrScanner.destroy();
      this.qrScanner = null;
    }
    
    setTimeout(() => {
      if (this.videoNode && this.state.selectedStation) {
        // The QrScanner library will automatically try different constraint combinations
        this.startQRScannerWithNode(this.videoNode);
      }
    }, 1000);
  }

  componentDidUpdate(prevProps, prevState) {
    // Stop scanner only when station is deselected
    if (!this.state.selectedStation && this.qrScanner) {
      this.stopQRScanner();
    }
    
    // If switching to a new station, start scanner if not already started
    if (
      this.videoNode &&
      this.state.selectedStation &&
      !this.isProcessingQR &&
      (prevState.selectedStation !== this.state.selectedStation)
    ) {
      clearTimeout(this._qrScannerStartTimeout);
      this._qrScannerStartTimeout = setTimeout(() => {
        if (!this.qrScanner && !this.isProcessingQR) {
          console.log(`🔄 Restarting QR scanner on device [${this.deviceId}] for station change`);
          // Use the backend-connected scanner to retrieve participant data
          this.startQRScannerWithNode(this.videoNode);
        }
      }, 100); // Fast restart for better user experience
    }
  }

  handleChange = (e) => {
    const newStation = e.target.value;
    
    console.log(`🔄 Station changed to [${newStation}] on device [${this.deviceId}]`);
    
    // Clear processing flag when changing stations
    this.isProcessingQR = false;
    
    // Preserve participant data but clear station-specific form fields
    this.setState(prevState => {
      const newFormData = { ...prevState.formData };
      
      // Clear previous station fields if we had a station selected
      if (prevState.selectedStation && stationFields[prevState.selectedStation]) {
        stationFields[prevState.selectedStation].forEach(field => {
          // Only clear station-specific fields, not participant info
          if (!['name', 'age', 'gender', 'dateOfBirth', 'phoneNumber', 'height', 'weight', 'bmi', 'stations', 'hasHeightWeight'].includes(field)) {
            delete newFormData[field];
          }
        });
      }
      
      // Initialize new station fields as empty for data entry
      if (newStation && stationFields[newStation]) {
        stationFields[newStation].forEach(field => {
          // Don't overwrite participant info or height/weight data
          if (!['name', 'age', 'gender', 'dateOfBirth', 'phoneNumber', 'height', 'weight', 'bmi', 'stations', 'hasHeightWeight'].includes(field)) {
            newFormData[field] = '';
          }
        });
        console.log(`🔧 Initialized form fields for new station [${newStation}]`);
      }
      
      return {
        selectedStation: newStation,
        // Only clear QR fields if no participant is loaded
        qrValue: newFormData.name ? prevState.qrValue : '',
        qrScanned: newFormData.name ? prevState.qrScanned : false,
        cameraError: null,
        formData: newFormData
      };
    }, () => {
      // Immediate save for faster state persistence across devices
      this.immediateSave();
      console.log(`💾 Station change saved for device [${this.deviceId}]`);
    });
  }

  handleLanguageToggle = () => {
    const { language, setLanguage } = this.context
    setLanguage(language === 'en' ? 'zh' : 'en')
  }

  handleInputChange = (e, field, unit = '') => {
    let val = e.target.value;
    if (unit) {
      // Remove any existing unit and trailing spaces
      val = val.replace(new RegExp(`\\s*${unit}$`), '');
      // Remove any non-numeric except dot
      val = val.replace(/[^0-9.]/g, '');
      if (val) val = `${val} ${unit}`;
    }
    this.setState(prevState => ({
      formData: {
        ...prevState.formData,
        [field]: val
      }
    }), () => {
      // Save state after form data change
      this.debouncedSave();
    });
  }

  handleInputBlur = (e, field, unit = '') => {
    let val = e.target.value;
    if (unit && val && !val.trim().endsWith(unit)) {
      // Remove any existing unit and trailing spaces
      val = val.replace(new RegExp(`\s*${unit}$`), '');
      // Remove any non-numeric except dot and space
      val = val.replace(/[^0-9.]/g, '');
      if (val) val = `${val} ${unit}`;
    }
    this.setState(prevState => ({
      formData: {
        ...prevState.formData,
        [field]: val
      }
    }), () => {
      // Save state after form data change
      this.debouncedSave();
    });
  }

  handleQRInput = (e) => {
    this.setState({ qrValue: e.target.value }, () => {
      // Save state after QR value change
      this.debouncedSave();
    })
  }

  handleQRSubmit = (e) => {
    e.preventDefault()
    if (this.state.qrValue.trim() !== '') {
      this.setState({ qrScanned: true }, () => {
        // Save state after QR scan
        this.immediateSave();
      })
      if (this.qrScanner) this.qrScanner.stop()
    }
  }

  onEnter = async () => {
    const { selectedStation, formData, qrValue } = this.state;
    const { language } = this.context;
    if (!qrValue) {
      alert(language === 'en' ? 'No QR code scanned.' : '未扫描二维码。');
      return;
    }
    
    // Check if height/weight is required but missing
    const requiresHeightWeight = selectedStation !== 'heightWeight';
    const hasHeightWeight = formData.hasHeightWeight;
    
    if (requiresHeightWeight && !hasHeightWeight) {
      alert(language === 'en' 
        ? 'Cannot proceed: This participant must complete height and weight measurements first.' 
        : '无法继续：该参与者必须先完成身高体重测量。');
      return;
    }
    
    // Helper to ensure value is in the format '{value} {unit}' for fields with units
    const getFieldWithUnit = (field, value) => {
      let unit = '';
      if (selectedStation === 'heightWeight') {
        if (field === 'height') unit = 'cm';
        if (field === 'weight') unit = 'kg';
      } else if (["sitReach", "backStretch"].includes(selectedStation) && field.startsWith('score')) {
        unit = 'cm';
      } else if (selectedStation === 'speedWalking' && field.startsWith('score')) {
        unit = 'secs';
      } else if (selectedStation === 'handGrip' && field.startsWith('score')) {
        unit = 'kg';
      }
      if (unit && value !== undefined && value !== null && value !== '') {
        // If value already ends with unit, return as is
        if (typeof value === 'string' && value.trim().endsWith(unit)) {
          return value.trim();
        }
        // Otherwise, append unit
        return `${value} ${unit}`;
      }
      return value;
    };

    let payload;
    if (selectedStation === 'heightWeight') {
      payload = {
        height: getFieldWithUnit('height', formData.height ?? ''),
        weight: getFieldWithUnit('weight', formData.weight ?? ''),
        bmi: formData.bmi ?? '',
        stations: []
      };
    } else {
      const fieldsToSend = {};
      stationFields[selectedStation].forEach(field => {
        // Always include the field, even if empty
        fieldsToSend[field] = getFieldWithUnit(field, formData[field] ?? '');
      });
      // Remove any previous entry for this station from participant's existing stations
      const existingStations = formData.stations || [];
      const filteredStations = existingStations.filter(s => !s[selectedStation]);
      const newStations = [...filteredStations, { [selectedStation]: fieldsToSend }];
      payload = { stations: newStations };
      // Update formData with new stations for UI purposes
      this.setState(prevState => ({
        formData: {
          ...prevState.formData,
          stations: newStations
        }
      }));
    }
    try {
      const response = await axios.post(`${API_BASE_URL}/participants`, {
        purpose: 'updateStationData',
        participantID: qrValue,
        data: payload
      }, {
        timeout: 10000, // 10 second timeout for data submission
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (response.data && response.data.success) {
        alert(language === 'en' ? 'Data submitted successfully!' : '数据提交成功！');
        
        // Clear processing flag and reset scanner state (same as "Scan Different Participant")
        this.isProcessingQR = false;
        
        // Stop any existing scanner
        this.stopQRScanner();
        
        // Reset state to allow new scan
        this.setState({ 
          qrScanned: false, 
          qrValue: '', 
          formData: {},  // Clear all form data including name
          cameraError: null
        }, () => {
          // Save state immediately after clearing
          this.immediateSave();
          
          // Restart scanner after state is cleared
          if (this.videoNode && this.state.selectedStation) {
            setTimeout(() => {
              if (!this.qrScanner && !this.isProcessingQR) {
                console.log('📹 Restarting QR scanner for new participant scan after data submission');
                this.startQRScannerWithNode(this.videoNode);
              }
            }, 200);
          }
        });
      } else {
        alert(language === 'en' ? 'Failed to submit data.' : '提交数据失败。');
      }
    } catch (err) {
      console.error('❌ Data submission error:', err);
      let errorMessage = language === 'en' ? 'Network or server error.' : '网络或服务器错误。';
      
      if (err.code === 'ERR_NETWORK') {
        errorMessage = language === 'en' 
          ? 'Network connection failed. Please check your internet connection and try again.' 
          : '网络连接失败。请检查您的互联网连接并重试。';
      } else if (err.response) {
        errorMessage = language === 'en' 
          ? `Server error (${err.response.status}). Please try again.` 
          : `服务器错误 (${err.response.status})。请重试。`;
      } else if (err.code === 'ECONNABORTED') {
        errorMessage = language === 'en' 
          ? 'Request timeout. Please check your connection and try again.' 
          : '请求超时。请检查您的连接并重试。';
      }
      
      alert(errorMessage);
    }
  }

  render() {
    const { selectedStation, formData, qrValue, qrScanned, cameraError, dataStatusMessage } = this.state
    const { language } = this.context
    const t = translations[language]
    const stationKeys = [
      'heightWeight',
      'sitStand',
      'armBanding',
      'marching',
      'sitReach',
      'backStretch',
      'speedWalking',
      'handGrip'
    ]
    return (
      <div className="page-container" style={{ minHeight: '100vh', width: '100vw', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start' }}>
        
        {/* Data Status Notification */}
        {dataStatusMessage && (
          <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: '#007bff',
            color: 'white',
            padding: '10px 15px',
            borderRadius: '5px',
            zIndex: 1000,
            fontSize: '14px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            {dataStatusMessage}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', width: '100%', maxWidth: 600 }}>
          <h1>{t.volunteersTitle}</h1>
        </div>
        <div className="details-section" style={{ width: '100%', maxWidth: 600 }}>
          <label htmlFor="station-select" className="dropdown-label" style={{ fontWeight: 600, fontSize: '1.1rem' }}>
            {t.testStation}:
          </label>
          <select id="station-select" value={selectedStation} onChange={this.handleChange} className="dropdown-select" style={{ marginBottom: '2rem', maxWidth: 320 }}>
            <option value="" disabled>{language === 'en' ? 'Select a station' : '选择测试站'}</option>
            {stationKeys.map(key => (
              <option key={key} value={key}>
                {t.stations[key]}
              </option>
            ))}
          </select>
        </div>
        {/* QR scanner for all stations */}
        {selectedStation && (
          <div className="details-section" style={{ maxWidth: 700, minHeight: formData.name ? 'auto' : 700 }}>
            
            {/* Show participant info prominently when loaded */}
            {formData.name && (
              <div style={{ 
                textAlign: 'center', 
                marginBottom: 16, 
                padding: '16px', 
                backgroundColor: '#e8f5e8', 
                border: '2px solid #28a745',
                borderRadius: '8px',
                color: '#155724'
              }}>
                <h3 style={{ margin: '0 0 12px 0', color: '#28a745' }}>
                  ✅ {language === 'en' ? 'Participant Loaded' : '参与者已加载'}
                </h3>
                <div style={{ fontSize: '1.1em', fontWeight: 600 }}>
                  {(() => {
                    const infoFields = ['name', 'age', 'gender', 'dateOfBirth', 'phoneNumber'];
                    return (
                      <>
                        {infoFields.map(field => {
                          let value = formData[field];
                          
                          // Skip fields that are empty or "-"
                          if (!value || value === '-') {
                            return null;
                          }
                          
                          // Fix: If value is an object (e.g., {date, time}), render as string
                          if (typeof value === 'object' && value !== null) {
                            if ('date' in value && 'time' in value) {
                              value = `${value.date} ${value.time}`;
                            } else {
                              value = JSON.stringify(value);
                            }
                          }
                          
                          // Capitalize gender values (Male/Female instead of male/female)
                          if (field === 'gender' && typeof value === 'string') {
                            value = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
                          }
                          
                          // Capitalize first letter of field label
                          const fieldLabel = t[field] || field;
                          const capitalizedLabel = fieldLabel.charAt(0).toUpperCase() + fieldLabel.slice(1);
                          
                          return (
                            <div key={field} style={{ marginBottom: '4px' }}>
                              {capitalizedLabel}: <strong>{value}</strong>
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
                </div>
                <button 
                  onClick={() => {
                    // Clear processing flag and reset scanner state
                    this.isProcessingQR = false;
                    
                    // Stop any existing scanner
                    this.stopQRScanner();
                    
                    // Reset state to allow new scan
                    this.setState({ 
                      qrScanned: false, 
                      qrValue: '', 
                      formData: {},  // Clear all form data including name
                      cameraError: null
                    }, () => {
                      // Restart scanner after state is cleared
                      if (this.videoNode && this.state.selectedStation) {
                        setTimeout(() => {
                          if (!this.qrScanner && !this.isProcessingQR) {
                            console.log('📹 Restarting QR scanner for new participant scan');
                            this.startQRScannerWithNode(this.videoNode);
                          }
                        }, 200);
                      }
                    });
                  }}
                  style={{
                    marginTop: '12px',
                    padding: '8px 16px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9em',
                    fontWeight: '600'
                  }}
                >
                  {language === 'en' ? '📹 Scan Different Participant' : '📹 扫描其他参与者'}
                </button>
              </div>
            )}
            
            {/* Show simple error status when scanning fails (auto-restart) */}
            {!formData.name && !qrScanned && cameraError && (
              <div style={{ 
                textAlign: 'center', 
                marginBottom: 16, 
                padding: '16px', 
                backgroundColor: '#fff3cd', 
                border: '2px solid #ffc107',
                borderRadius: '8px',
                color: '#856404'
              }}>
                <h3 style={{ margin: '0 0 8px 0', color: '#ffc107' }}>
                  ⚠️ {language === 'en' ? 'Scan Issue' : '扫描问题'}
                </h3>
                <div style={{ fontSize: '0.9em', marginBottom: '8px', color: '#856404' }}>
                  {cameraError}
                </div>
                <div style={{ fontSize: '0.8em', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <span>🔄</span>
                  <span>{language === 'en' ? 'Auto-restarting scanner...' : '自动重启扫描器...'}</span>
                </div>
              </div>
            )}
            
            {/* Only show camera status when no participant is loaded and no successful scan */}
            {!formData.name && !qrScanned && (
              <div style={{ textAlign: 'center', marginBottom: 8, color: '#1976d2', fontWeight: 600 }}>
                {cameraError && !this.isProcessingQR && !qrValue ? (
                  <span style={{ color: '#d32f2f' }}>
                    {language === 'en' ? 'Camera Error: ' : '摄像头错误：'}{cameraError}
                  </span>
                ) : cameraError ? (
                  <div style={{ color: '#ff9800' }}>
                    <div style={{ marginBottom: '4px' }}>
                      {language === 'en' ? '⚠️ Scan issue detected' : '⚠️ 检测到扫描问题'}
                    </div>
                    <div style={{ fontSize: '0.8em' }}>
                      {language === 'en' ? '🔄 Auto-restarting scanner...' : '🔄 自动重启扫描器...'}
                    </div>
                  </div>
                ) : (
                  <div>
                    <span>
                      {language === 'en' ? 'Camera is active. Please hold QR code in front of the camera.' : '摄像头已开启，请将二维码对准摄像头'}
                    </span>
                    {this.isProcessingQR && (
                      <div style={{ fontSize: '0.8em', color: '#ff9800', marginTop: '4px' }}>
                        {language === 'en' ? '⚡ Processing...' : '⚡ 处理中...'}
                      </div>
                    )}
                    {qrValue && !formData.name && (
                      <div style={{ fontSize: '0.9em', color: '#ff9800', marginTop: '8px' }}>
                        🔍 {language === 'en' ? `QR: ${qrValue} | Loading participant...` : `二维码: ${qrValue} | 加载参与者...`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* Hide camera when participant is loaded or scan is complete */}
            {!formData.name && !qrScanned && (
              <div id="qr-video-container" style={{ width: '100%', maxWidth: 640, minHeight: 480, margin: '0 auto', borderRadius: 18, background: '#000', border: '5px solid #1976d2', boxShadow: '0 4px 32px rgba(0,0,0,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <video
                  ref={this.setVideoRef}
                  style={{ width: '100%', height: 'auto', minHeight: 440, borderRadius: 18, background: '#222' }}
                  autoPlay
                  playsInline
                  muted
                />
                {/* Loading indicator */}
                {!this.qrScanner && (
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#fff', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                      {language === 'en' ? '🚀 Starting fast camera...' : '🚀 启动快速摄像头...'}
                    </div>
                    <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                      {language === 'en' ? 'Optimized for multiple devices' : '为多设备优化'}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Show form fields in the same position as camera when participant is loaded */}
            {(() => {
              // Debug logging for render conditions
              console.log(`🎨 Render Debug - formData.name: "${formData.name}"`);
              console.log(`🎨 Render Debug - selectedStation: "${selectedStation}"`);
              console.log(`🎨 Render Debug - Should show form: ${!!(formData.name && selectedStation)}`);
              
              return formData.name && selectedStation;
            })() && (
              <div style={{ width: '100%', maxWidth: 640, margin: '0 auto', padding: '20px', borderRadius: 18, background: '#f8f9fa', border: '2px solid #28a745', boxShadow: '0 4px 32px rgba(0,0,0,0.12)' }}>
                
                {/* Check if height/weight is required but missing */}
                {(() => {
                  const requiresHeightWeight = selectedStation !== 'heightWeight';
                  const hasHeightWeight = formData.hasHeightWeight;
                  
                  if (requiresHeightWeight && !hasHeightWeight) {
                    // Show blocking message for missing height/weight
                    const currentLanguage = this.context?.language || 'en';
                    return (
                      <div style={{ 
                        textAlign: 'center', 
                        padding: '20px', 
                        backgroundColor: '#fff3cd', 
                        border: '2px solid #ffc107',
                        borderRadius: '8px',
                        color: '#856404',
                        marginBottom: '16px'
                      }}>
                        <h3 style={{ margin: '0 0 12px 0', color: '#ffc107' }}>
                          ⚠️ {currentLanguage === 'en' ? 'Height & Weight Required' : '需要身高体重数据'}
                        </h3>
                        <p style={{ margin: '0 0 16px 0', fontSize: '1.1em' }}>
                          {currentLanguage === 'en' 
                            ? 'This participant must complete height and weight measurements before accessing other test stations.'
                            : '该参与者必须先完成身高体重测量才能进行其他测试站点。'}
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Show completed stations info */}
                {(() => {
                  // First check if participant has stations data at all
                  if (!formData.stations || !Array.isArray(formData.stations) || formData.stations.length === 0) {
                    return null; // No stations key or empty stations - participant hasn't completed any stations yet
                  }
                  
                  // Helper function to check if a station has meaningful completed data
                  const hasCompletedData = (stationObj) => {
                    const stationData = Object.values(stationObj)[0];
                    if (!stationData || typeof stationData !== 'object') return false;
                    
                    // Check if any field has meaningful non-empty data
                    return Object.values(stationData).some(val => {
                      if (!val || val === '' || val === '-' || val === 'null' || val === 'undefined') return false;
                      // For numeric fields, check if it's not just "0" or " cm", " kg", " secs"
                      if (typeof val === 'string') {
                        const trimmed = val.trim();
                        if (trimmed === '0' || trimmed === '0 cm' || trimmed === '0 kg' || trimmed === '0 secs') return false;
                        if (trimmed.match(/^\s*(cm|kg|secs)\s*$/)) return false; // Just unit without value
                        if (trimmed.length > 0) return true;
                      }
                      return val !== null && val !== undefined;
                    });
                  };
                  
                  // Use participant's stations data from formData, not local state
                  const participantStations = formData.stations || [];
                  const completedStations = participantStations.filter(hasCompletedData);
                  
                  return completedStations.length > 0 && (
                    <div style={{ marginBottom: 16, color: '#1976d2', fontWeight: 600, textAlign: 'center' }}>
                      {language === 'en' ? 'Completed Stations:' : '已完成站点：'}
                      <ul style={{ textAlign: 'left', display: 'inline-block' }}>
                        {completedStations.map((stationObj, idx) => {
                          const stationName = Object.keys(stationObj)[0];
                          return (
                            <li key={stationName}>
                              {t.stations[stationName] || stationName}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })()}

                {/* Station fields form */}
                {(() => {
                  const requiresHeightWeight = selectedStation !== 'heightWeight';
                  const hasHeightWeight = formData.hasHeightWeight;
                  const canProceed = !requiresHeightWeight || hasHeightWeight;
                  
                  if (!canProceed) {
                    // Don't show the form if height/weight is required but missing
                    return null;
                  }
                  
                  return (
                    <div className="detail-grid" style={{ maxWidth: '100%' }}>
                  {stationFields[selectedStation].map(field => {
                    // For sitReach, backStretch, handGrip stations with leftRight field
                    if (field === 'leftRight' && ['sitReach', 'backStretch', 'handGrip'].includes(selectedStation)) {
                      // Get context-specific labels for each station
                      const getContextLabel = (side) => {
                        const contexts = {
                          sitReach: language === 'en' ? 'Straight leg' : '直腿',
                          backStretch: language === 'en' ? 'Hand on top' : '上面的手',
                          handGrip: language === 'en' ? 'Hand' : '手'
                        };
                        const context = contexts[selectedStation] || '';
                        const sideLabel = side === 'left' ? 
                          (language === 'en' ? 'Left L' : '左L') : 
                          (language === 'en' ? 'Right R' : '右R');
                        return `${sideLabel} (${context})`;
                      };

                      return (
                        <div className="detail-item" key={field} style={{ flexDirection: 'column', alignItems: 'flex-start', marginBottom: '16px' }}>
                          <span className="detail-label" style={{ marginBottom: '0.5rem', fontWeight: 600 }}>{language === 'en' ? 'Left/Right:' : '左/右：'}</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'black' }}>
                              <input
                                type="checkbox"
                                checked={formData[field] === 'left'}
                                onChange={e => {
                                  if (e.target.checked) {
                                    this.handleInputChange({ target: { value: 'left' } }, field);
                                  } else {
                                    this.handleInputChange({ target: { value: '' } }, field);
                                  }
                                }}
                                style={{ marginRight: '0.5rem' }}
                              />
                              {getContextLabel('left')}
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'black' }}>
                              <input
                                type="checkbox"
                                checked={formData[field] === 'right'}
                                onChange={e => {
                                  if (e.target.checked) {
                                    this.handleInputChange({ target: { value: 'right' } }, field);
                                  } else {
                                    this.handleInputChange({ target: { value: '' } }, field);
                                  }
                                }}
                                style={{ marginRight: '0.5rem' }}
                              />
                              {getContextLabel('right')}
                            </label>
                          </div>
                        </div>
                      );
                    }
                    // Special handling for remarks field with context-specific labels
                    if (field === 'remarks' && ['sitReach', 'backStretch', 'handGrip'].includes(selectedStation)) {
                      const stationData = t.stationRemarks?.[selectedStation];
                      const leftLabel = stationData?.left || 'Left';
                      const rightLabel = stationData?.right || 'Right';
                      
                      return (
                        <div className="detail-item" key={field} style={{ flexDirection: 'column', alignItems: 'flex-start', marginBottom: '16px' }}>
                          <span className="detail-label" style={{ marginBottom: '0.5rem', fontWeight: 600 }}>{t.remarks || 'Remarks'}:</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'black' }}>
                              <input
                                type="checkbox"
                                checked={formData[field] === leftLabel}
                                onChange={e => {
                                  if (e.target.checked) {
                                    this.handleInputChange({ target: { value: leftLabel } }, field);
                                  } else {
                                    this.handleInputChange({ target: { value: '' } }, field);
                                  }
                                }}
                                style={{ marginRight: '0.5rem' }}
                              />
                              {leftLabel}
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', color: 'black' }}>
                              <input
                                type="checkbox"
                                checked={formData[field] === rightLabel}
                                onChange={e => {
                                  if (e.target.checked) {
                                    this.handleInputChange({ target: { value: rightLabel } }, field);
                                  } else {
                                    this.handleInputChange({ target: { value: '' } }, field);
                                  }
                                }}
                                style={{ marginRight: '0.5rem' }}
                              />
                              {rightLabel}
                            </label>
                          </div>
                        </div>
                      );
                    }
                    // Default rendering for other fields
                    // Determine unit for this field/station
                    let unit = '';
                    let placeholder = t[field] || field;
                    if (selectedStation === 'heightWeight') {
                      if (field === 'height') { unit = 'cm'; placeholder = `${t[field] || 'Height'}`; }
                      if (field === 'weight') { unit = 'kg'; placeholder = `${t[field] || 'Weight'}`; }
                    } else if (selectedStation === 'sitReach' && field.startsWith('score')) {
                      unit = 'cm'; placeholder = `${t[field] || field}`;
                    } else if (selectedStation === 'backStretch' && field.startsWith('score')) {
                      unit = 'cm'; placeholder = `${t[field] || field}`;
                    } else if (selectedStation === 'speedWalking' && field.startsWith('score')) {
                      unit = 'secs'; placeholder = `${t[field] || field}`;
                    } else if (selectedStation === 'handGrip' && field.startsWith('score')) {
                      unit = 'kg'; placeholder = `${t[field] || field}`;
                    }

                    // Find last value for this station/field from participant's data
                    let lastValue = '';
                    if (formData.stations && formData.stations.length > 0) {
                      const lastStationObj = formData.stations.find(s => s[selectedStation]);
                      if (lastStationObj && lastStationObj[selectedStation] && lastStationObj[selectedStation][field]) {
                        lastValue = lastStationObj[selectedStation][field];
                      }
                    }

                    return (
                      <div className="detail-item" key={field} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                          <span className="detail-label" style={{ fontWeight: 600, minWidth: '80px' }}>{t[field] || field}:</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                            {unit ? (
                              <input
                                className="detail-value"
                                type="text"
                                value={
                                  formData[field] !== undefined && formData[field] !== null && formData[field] !== ''
                                    ? formData[field]
                                    : ''
                                }
                                onChange={e => this.handleInputChange(e, field, unit)}
                                onBlur={e => this.handleInputBlur(e, field, unit)}
                                placeholder={placeholder.replace(/\s*\([^)]*\)$/, '')}
                                style={{ padding: '0.75rem', borderRadius: 8, border: '2px solid #ddd', flex: 1, fontSize: '1rem' }}
                              />
                            ) : (
                              <input
                                className="detail-value"
                                type="text"
                                value={formData[field] || ''}
                                onChange={e => {
                                  this.handleInputChange(e, field);
                                }}
                                placeholder={placeholder}
                                style={{ padding: '0.75rem', borderRadius: 8, border: '2px solid #ddd', flex: 1, fontSize: '1rem' }}
                              />
                            )}
                          </div>
                        </div>
                        {/* Show last value for this station/field if available */}
                        {lastValue && (
                          <div style={{ color: '#1976d2', fontSize: '0.9em', marginLeft: 8 }}>
                            Last: {lastValue}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <button
                    style={{
                      marginTop: 24,
                      width: '100%',
                      padding: '1rem',
                      borderRadius: 12,
                      background: '#1976d2',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '1.2rem',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                    onClick={() => {
                      this.onEnter()
                    }}
                  >
                    {language === 'en' ? 'Enter' : '提交'}
                  </button>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
        
        {/* Action Buttons */}
        <div style={{ marginTop: '20px', textAlign: 'center', width: '100%', maxWidth: 600, display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {/* Done Button - Finish volunteer session */}
          <button 
            onClick={this.handleVolunteerDone}
            style={{
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
            title="Finish volunteer session and return to home"
          >
            ✅ {language === 'en' ? 'Done - Finish Session' : '完成 - 结束会话'}
          </button>
          
          {/* Clear Saved Data Button */}
          <button 
            onClick={this.clearSavedState}
            style={{
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
            title="Clear all saved volunteer form data from browser storage"
          >
            🗑️ {language === 'en' ? 'Clear Saved Data' : '清除保存的数据'}
          </button>
        </div>
      </div>
    )
  }
}

export default Volunteers;