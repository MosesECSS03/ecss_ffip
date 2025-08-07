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
      stations: [], // <-- add stations array to state
      dataStatusMessage: '' // For showing save/load notifications
    }
    this.qrScanner = null
    this.isProcessingQR = false // Flag to prevent multiple simultaneous QR processing
    
    // Generate unique device ID for multi-device support
    this.deviceId = this.getOrCreateDeviceId()
    console.log('🔧 Volunteer device initialized with ID:', this.deviceId)
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
    
    // Save state immediately before component unmounts
    this.immediateSave();
    this.stopQRScanner()
    
    // Clear any pending timeouts
    if (this._qrScannerStartTimeout) {
      clearTimeout(this._qrScannerStartTimeout);
    }
    
    console.log(`📱 Volunteer component unmounted on device [${this.deviceId}]`);
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
        })
        .catch(err => {
          console.warn(`⚠️ Could not enumerate cameras on device [${this.deviceId}]:`, err.message);
        });
    }
  }

  stopQRScanner = () => {
    if (this.qrScanner) {
      this.qrScanner.destroy()
      this.qrScanner = null
    }
    // Clear camera error when scanner stops
    this.setState({ cameraError: null });
  }

  // Data persistence methods
  saveStateToLocalStorage = (isRetry = false) => {
    try {
      const stateToSave = {
        selectedStation: this.state.selectedStation,
        formData: this.state.formData,
        qrValue: this.state.qrValue,
        qrScanned: this.state.qrScanned,
        stations: this.state.stations,
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
    // Clean up any existing scanner
    if (this.qrScanner) {
      this.qrScanner.destroy();
      this.qrScanner = null;
    }
    this.setState({ cameraError: null });
    
    if (videoNode) {
      this.qrScanner = new QrScanner(
        videoNode,
        async result => {
          if (result && result.data && !this.isProcessingQR) {
            // Set processing flag to prevent multiple simultaneous scans
            this.isProcessingQR = true;
            
            // Stop scanner immediately to prevent multiple scans
            if (this.qrScanner) {
              this.qrScanner.stop();
            }
            
            // Generate unique scan ID for tracking
            const scanId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            console.log(`🔍 QR Scan started [${scanId}]:`, result.data);
            
            try {
              // Use AbortController for fast timeout handling
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000); // Increased timeout
              
              const response = await axios.post(`${API_BASE_URL}/participants`, {
                "purpose": "retrieveParticipant",
                "participantID": result.data
              }, {
                signal: controller.signal,
                timeout: 5000,
                headers: {
                  'Content-Type': 'application/json',
                  'X-Scan-ID': scanId,
                  'X-Device-ID': this.deviceId || 'unknown'
                }
              });
              
              clearTimeout(timeoutId);
              console.log(`✅ QR Scan completed [${scanId}]:`, response.data?.success ? 'Success' : 'Failed');
              console.log(`📋 Full response for scan [${scanId}]:`, response.data);
              
              if (response.data && response.data.success && response.data.data) {
                console.log(`📋 Participant data retrieved for scan [${scanId}]:`, response.data.data);
                // Populate ALL participant data
                const formData = {};
                Object.keys(response.data.data).forEach(key => {
                  formData[key] = response.data.data[key];
                });
                
                // Check if participant has height and weight recorded for non-heightWeight stations
                const hasHeight = formData.height && formData.height !== '' && formData.height !== '-';
                const hasWeight = formData.weight && formData.weight !== '' && formData.weight !== '-';
                
                // Store height/weight status in formData for later use in form validation
                formData.hasHeightWeight = hasHeight && hasWeight;
                
                // Stop and hide QR scanner after successful participant data retrieval
                this.stopQRScanner();
                console.log(`📹 QR scanner stopped after successful scan [${scanId}]`);
                
                this.setState({
                  qrValue: result.data,
                  qrScanned: true,
                  cameraError: null, // Clear any previous errors
                  formData
                }, () => {
                  // Immediately save state after successful scan
                  this.immediateSave();
                  console.log(`💾 Data saved for scan [${scanId}]`);
                });
              } else {
                console.log(`❌ Invalid response structure for scan [${scanId}]:`, response.data);
                // Stop scanner even on invalid response
                this.stopQRScanner();
                console.log(`📹 QR scanner stopped after invalid response [${scanId}]`);
                
                this.setState({
                  qrValue: result.data,
                  qrScanned: true,
                  cameraError: response.data?.message || 'No participant found',
                  formData: {}
                });
              }
            } catch (err) {
              console.error(`❌ QR Scan error [${scanId}]:`, err.message);
              console.error(`❌ Full error details for scan [${scanId}]:`, err);
              
              // Check if we have response data even with an error (e.g., timeout after successful response)
              if (err.response && err.response.data && err.response.data.success && err.response.data.data) {
                console.log(`✅ Data retrieved despite error for scan [${scanId}]:`, err.response.data.data);
                // Populate participant data even if there was a network hiccup
                const formData = {};
                Object.keys(err.response.data.data).forEach(key => {
                  formData[key] = err.response.data.data[key];
                });
                
                // Stop and hide QR scanner after successful participant data retrieval
                this.stopQRScanner();
                console.log(`📹 QR scanner stopped after successful scan despite error [${scanId}]`);
                
                this.setState({
                  qrValue: result.data,
                  qrScanned: true,
                  cameraError: null, // Clear error since we got the data
                  formData
                }, () => {
                  this.immediateSave();
                  console.log(`💾 Data saved despite error for scan [${scanId}]`);
                });
                return; // Exit early since we handled the data
              }
              
              // Only show error if we truly didn't get any participant data
              let errorMessage = 'Network or server error';
              if (err.name === 'AbortError') {
                errorMessage = 'Request timeout - check connection';
              } else if (err.code === 'ERR_NETWORK') {
                errorMessage = 'Network connection failed - check backend server';
              } else if (err.response) {
                errorMessage = `Server error: ${err.response.status}`;
              }
              
              // Stop scanner on error too
              this.stopQRScanner();
              console.log(`📹 QR scanner stopped after error [${scanId}]`);
              
              this.setState({
                qrValue: result.data,
                qrScanned: true,
                cameraError: errorMessage,
                formData: {}
              });
            } finally {
              // Always clear processing flag
              this.isProcessingQR = false;
            }
          }
        },
        {
          onDecodeError: error => {
            // Safely handle decode errors with proper error checking
            const errorMessage = error && error.message ? error.message : 'Unknown decode error';
            console.log('🔍 QR Scanner decode attempt:', errorMessage);
            // Only suppress the most common "no QR code found" messages
            if (!errorMessage.includes('No QR code found') && !errorMessage.includes('Could not find')) {
              console.warn('QR Scanner decode error:', errorMessage);
            }
          },
          highlightScanRegion: true,
          highlightCodeOutline: true,
          // Optimize for speed and multiple device support
          maxScansPerSecond: 10, // Increase scan rate
          preferredCamera: 'environment', // Use rear camera
          calculateScanRegion: (video) => {
            // Optimize scan region for faster processing
            const smallerDimension = Math.min(video.videoWidth, video.videoHeight);
            const scanRegionSize = Math.round(0.6 * smallerDimension);
            return {
              x: Math.round((video.videoWidth - scanRegionSize) / 2),
              y: Math.round((video.videoHeight - scanRegionSize) / 2),
              width: scanRegionSize,
              height: scanRegionSize,
            };
          }
        }
      );
      
      this.qrScanner.start().catch(e => {
        console.error('QR Scanner start error:', e);
        this.setState({ cameraError: e.message || 'Camera access denied or not available' });
      });
    }
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
    
    // For any station, allow QR scanner to keep running with optimized state update
    this.setState({
      selectedStation: newStation,
      qrValue: '',
      qrScanned: false,
      cameraError: null,
      formData: {}
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
    const { selectedStation, formData, qrValue, stations } = this.state;
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
      // Remove any previous entry for this station
      const filteredStations = stations.filter(s => !s[selectedStation]);
      const newStations = [...filteredStations, { [selectedStation]: fieldsToSend }];
      payload = { stations: newStations };
      this.setState({ stations: newStations });
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
        // Only clear form data, preserve participant info and QR scanner state
        const preservedFormData = {
          name: formData.name,
          age: formData.age,
          gender: formData.gender,
          dateOfBirth: formData.dateOfBirth,
          phoneNumber: formData.phoneNumber,
          height: formData.height,
          weight: formData.weight,
          bmi: formData.bmi,
          stations: formData.stations
        };
        
        this.setState({
          formData: preservedFormData,
          cameraError: null
        }, () => {
          // Save state immediately after successful submission
          this.immediateSave();
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
            
            {/* Only show camera status when no participant is loaded and no successful scan */}
            {!formData.name && !qrScanned && (
              <div style={{ textAlign: 'center', marginBottom: 8, color: '#1976d2', fontWeight: 600 }}>
                {cameraError && !this.isProcessingQR && !qrValue ? (
                  <span style={{ color: '#d32f2f' }}>
                    {language === 'en' ? 'Camera Error: ' : '摄像头错误：'}{cameraError}
                  </span>
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
            {formData.name && selectedStation && (
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

                    // Find last value for this station/field
                    let lastValue = '';
                    if (this.state.stations && this.state.stations.length > 0) {
                      const lastStationObj = this.state.stations.find(s => s[selectedStation]);
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