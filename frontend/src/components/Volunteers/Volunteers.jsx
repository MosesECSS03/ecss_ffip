import React, { Component } from 'react'
import LanguageContext from '../../contexts/LanguageContext'
import { translations } from '../../utils/translations'
import '../Pages.css'
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

class Volunteers extends Component {
  static contextType = LanguageContext

  /**
   * Constructor - Initialize component state and instance variables
   * Sets up initial state for station selection, form data, QR scanning, and error handling
   */
  constructor(props) {
    super(props)
    this.state = {
      selectedStation: '',        // Currently selected test station
      formData: {},              // Participant data and form inputs
      qrValue: '',               // Scanned QR code value
      qrScanned: false,          // Whether QR code has been successfully scanned
      cameraError: null,         // Camera/scanning error messages
      dataStatusMessage: ''      // Status messages for data operations
    }
    this.qrScanner = null        // QR scanner instance
    this.isProcessingQR = false  // Flag to prevent concurrent QR processing
    this.scannerRetryCount = 0   // Track scanner restart attempts
    this.maxRetryAttempts = 3    // Maximum retry attempts before giving up
  }

  /**
   * Component lifecycle - Called when component mounts
   * Loads any previously saved state from localStorage
   */
  componentDidMount() {
    this.loadStateFromLocalStorage();
  }

  /**
   * Component lifecycle - Called when component unmounts
   * Cleans up resources, saves state, and stops QR scanner
   */
  componentWillUnmount() {
    this.isProcessingQR = false;
    this.saveStateToLocalStorage();
    this.stopQRScanner();
    
    if (this._qrScannerStartTimeout) {
      clearTimeout(this._qrScannerStartTimeout);
    }
    
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
  }

  /**
   * Stop and cleanup QR scanner
   * Safely destroys the QR scanner instance and resets processing flags
   */
  stopQRScanner = () => {
    try {
      if (this.qrScanner) {
        this.qrScanner.stop();
        this.qrScanner.destroy();
        this.qrScanner = null;
      }
    } catch (e) {
      // Silently handle cleanup errors
    }
    
    this.isProcessingQR = false;
    this.setState({ cameraError: null });
  }

  /**
   * Save current component state to localStorage
   * Stores state with timestamp for freshness validation
   */
  saveStateToLocalStorage = () => {
    try {
      const stateToSave = {
        selectedStation: this.state.selectedStation,
        formData: this.state.formData,
        qrValue: this.state.qrValue,
        qrScanned: this.state.qrScanned,
        timestamp: Date.now()
      };
      localStorage.setItem('volunteersAppState', JSON.stringify(stateToSave));
    } catch (error) {
      console.error('Error saving state:', error);
    }
  }

  /**
   * Load previously saved state from localStorage
   * Only loads state if it's less than 24 hours old
   */
  loadStateFromLocalStorage = () => {
    try {
      const savedState = localStorage.getItem('volunteersAppState');
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        
        // Only load if saved within last 24 hours
        const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
        if (parsedState.timestamp && parsedState.timestamp > twentyFourHoursAgo) {
          this.setState({
            selectedStation: parsedState.selectedStation || '',
            formData: parsedState.formData || {},
            qrValue: parsedState.qrValue || '',
            qrScanned: parsedState.qrScanned || false
          });
        }
      }
    } catch (error) {
      console.error('Error loading state:', error);
      // Clean up corrupted data
      localStorage.removeItem('volunteersAppState');
    }
  }

  /**
   * Debounced save function to reduce localStorage write frequency
   * Waits 500ms after last change before saving to avoid excessive writes
   */
  debouncedSave = (() => {
    let timeoutId;
    return () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => this.saveStateToLocalStorage(), 500);
    };
  })()

  /**
   * Clear all saved state from localStorage
   * Shows confirmation message to user
   */
  clearSavedState = () => {
    localStorage.removeItem('volunteersAppState');
    this.setState({ 
      dataStatusMessage: '🗑️ Saved data cleared successfully' 
    });
    setTimeout(() => {
      this.setState({ dataStatusMessage: '' });
    }, 2000);
  }

  /**
   * Handle volunteer session completion
   * Confirms with user before saving state and navigating to home
   */
  handleVolunteerDone = () => {
    const { language } = this.context;
    const confirmMessage = language === 'en' 
      ? 'Are you sure you want to finish your volunteer session?' 
      : '您确定要结束志愿者会话吗？';
    
    if (window.confirm(confirmMessage)) {
      try {
        this.saveStateToLocalStorage();
        window.location.href = '/';
      } catch (error) {
        console.error('Error finishing volunteer session:', error);
      }
    }
  }

  /**
   * Set video element reference for QR scanner
   * Updates video node reference and starts scanner when station is selected
   * @param {HTMLVideoElement} node - Video element for camera display
   */
  setVideoRef = (node) => {
    if (node !== this.videoNode) {
      this.videoNode = node;
      clearTimeout(this._qrScannerStartTimeout);
      
      if (node && this.state.selectedStation) {
        this._qrScannerStartTimeout = setTimeout(() => {
          this.startQRScannerWithNode(node);
        }, 100);
      }
    }
  }

  /**
   * Initialize and start QR scanner with given video node
   * Sets up QR code detection, participant data retrieval, and error handling
   * @param {HTMLVideoElement} videoNode - Video element for camera display
   */
  startQRScannerWithNode = (videoNode) => {
    if (this.isProcessingQR) return;

    // Clean up existing scanner
    if (this.qrScanner) {
      this.qrScanner.destroy();
      this.qrScanner = null;
    }
    
    this.setState({ cameraError: null });
    
    if (videoNode) {
      this.qrScanner = new QrScanner(
        videoNode,
        async result => {
          if (this.isProcessingQR) return;
          this.isProcessingQR = true;
          
          // Clear any existing timeout
          if (this.loadingTimeout) {
            clearTimeout(this.loadingTimeout);
          }
          
          // Set a timeout to clear loading state if it gets stuck
          this.loadingTimeout = setTimeout(() => {
            console.warn('⚠️ QR loading timeout, resetting state');
            this.setState({
              qrValue: '',
              qrScanned: false,
              cameraError: 'Loading timeout - please try scanning again',
              formData: {}
            });
            this.isProcessingQR = false;
          }, 15000); // 15 second timeout
          
          try {
            const participantID = result.data;
            const response = await axios.post(`${API_BASE_URL}/participants`, {
              purpose: 'retrieveParticipant',
              participantID: participantID
            }, { timeout: 10000 });

            console.log('QR code scanned:', participantID, response.data);
            

            if (response.data && response.data.success && response.data.data) {
              const participant = response.data.data;
              console.log('📋 Participant data from backend:', participant);
              console.log('📋 Participant name:', participant.name);
              console.log('📋 Participant keys:', Object.keys(participant));
              
              this.setState({
                qrValue: participantID,
                qrScanned: true,
                formData: {
                  name: participant.name || '',
                  age: participant.age || '',
                  gender: participant.gender || '',
                  dateOfBirth: participant.dateOfBirth || '',
                  phoneNumber: participant.phoneNumber || '',
                  height: participant.height || '',
                  weight: participant.weight || '',
                  bmi: participant.bmi || '',
                  stations: participant.stations || [],
                  hasHeightWeight: !!(participant.height && participant.weight)
                }
              }, () => {
                console.log('📋 FormData updated after QR scan:', this.state.formData);
                console.log('📋 FormData name after update:', this.state.formData.name);
              });
              this.stopQRScanner();
            } else {
              console.warn('❌ Invalid response structure:', response.data);
              this.setState({
                qrValue: result.data,
                qrScanned: false,
                cameraError: 'Invalid participant data received',
                formData: {}
              });
            }
          } catch (err) {
            console.error('QR processing error:', err);
            this.setState({
              qrValue: result.data,
              qrScanned: false,
              cameraError: 'Failed to load participant data',
              formData: {}
            });
          } finally {
            // Clear the loading timeout
            if (this.loadingTimeout) {
              clearTimeout(this.loadingTimeout);
              this.loadingTimeout = null;
            }
            this.isProcessingQR = false;
          }
        },
        {
          onDecodeError: () => {
            // Ignore decode errors - they're normal when no QR code is visible
          },
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 5,
          preferredCamera: 'environment'
        }
      );
      
      this.qrScanner.start()
        .then(() => {
          this.scannerRetryCount = 0;
        })
        .catch(e => {
          let userMessage = '';
          if (e.name === 'NotAllowedError') {
            userMessage = 'Camera permission denied. Please allow camera access and refresh the page.';
          } else if (e.name === 'NotFoundError') {
            userMessage = 'No camera found. Please ensure a camera is connected.';
          } else {
            userMessage = 'Camera initialization failed. Please refresh the page.';
          }
          
          this.setState({ cameraError: userMessage });
          
          // Auto-retry
          if (this.scannerRetryCount < this.maxRetryAttempts) {
            this.scannerRetryCount++;
            setTimeout(() => {
              if (!this.qrScanner && this.videoNode && this.state.selectedStation) {
                this.startQRScannerWithNode(this.videoNode);
              }
            }, 2000);
          }
        });
    }
  }

  /**
   * Component lifecycle - Called when component updates
   * Manages QR scanner state based on station selection changes
   * @param {Object} prevProps - Previous component props
   * @param {Object} prevState - Previous component state
   */
  componentDidUpdate(prevProps, prevState) {
    if (!this.state.selectedStation && this.qrScanner) {
      this.stopQRScanner();
    }
    
    if (
      this.videoNode &&
      this.state.selectedStation &&
      !this.isProcessingQR &&
      (prevState.selectedStation !== this.state.selectedStation)
    ) {
      clearTimeout(this._qrScannerStartTimeout);
      this._qrScannerStartTimeout = setTimeout(() => {
        if (!this.qrScanner && !this.isProcessingQR) {
          this.startQRScannerWithNode(this.videoNode);
        }
      }, 100);
    }
  }

  /**
   * Handle station selection change
   * Resets form to QR scanner state when station changes
   * @param {Event} e - Select change event
   */
  handleChange = (e) => {
    const newStation = e.target.value;
    this.isProcessingQR = false;
    
    // Stop existing QR scanner
    this.stopQRScanner();
    
    // Reset to QR scanner state
    this.setState({
      selectedStation: newStation,
      qrValue: '',
      qrScanned: false,
      cameraError: null,
      formData: {}
    }, () => {
      this.debouncedSave();
      
      // Restart QR scanner if station is selected and video node is available
      if (newStation && this.videoNode) {
        setTimeout(() => {
          if (!this.qrScanner && !this.isProcessingQR) {
            this.startQRScannerWithNode(this.videoNode);
          }
        }, 200);
      }
    });
  }

  /**
   * Handle form input changes with optional unit formatting
   * Formats numeric inputs with appropriate units (cm, kg, secs)
   * @param {Event} e - Input change event
   * @param {string} field - Form field name
   * @param {string} unit - Optional unit to append (cm, kg, secs)
   */
  handleInputChange = (e, field, unit = '') => {
    let val = e.target.value;
    if (unit) {
      val = val.replace(new RegExp(`\\s*${unit}$`), '');
      val = val.replace(/[^0-9.]/g, '');
      if (val) val = `${val} ${unit}`;
    }
    this.setState(prevState => ({
      formData: {
        ...prevState.formData,
        [field]: val
      }
    }), () => {
      this.debouncedSave();
    });
  }

  /**
   * Handle form input blur events with unit validation
   * Ensures proper unit formatting when user leaves input field
   * @param {Event} e - Input blur event
   * @param {string} field - Form field name
   * @param {string} unit - Optional unit to append (cm, kg, secs)
   */
  handleInputBlur = (e, field, unit = '') => {
    let val = e.target.value;
    if (unit && val && !val.trim().endsWith(unit)) {
      val = val.replace(new RegExp(`\\s*${unit}$`), '');
      val = val.replace(/[^0-9.]/g, '');
      if (val) val = `${val} ${unit}`;
    }
    this.setState(prevState => ({
      formData: {
        ...prevState.formData,
        [field]: val
      }
    }), () => {
      this.debouncedSave();
    });
  }

  /**
   * Submit form data to backend
   * Validates requirements, formats data with units, and sends to server
   * Handles both height/weight station and other test stations differently
   */
  onEnter = async () => {
    const { selectedStation, formData, qrValue } = this.state;
    const { language } = this.context;
    
    // Validate QR code is scanned
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
    
    /**
     * Helper function to ensure value has proper unit formatting
     * @param {string} field - Field name
     * @param {any} value - Field value
     * @returns {string} - Formatted value with unit
     */
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
        if (typeof value === 'string' && value.trim().endsWith(unit)) {
          return value.trim();
        }
        return `${value} ${unit}`;
      }
      return value;
    };

    // Prepare payload based on station type
    let payload;
    if (selectedStation === 'heightWeight') {
      // Height/weight station - update participant's basic measurements
      payload = {
        height: getFieldWithUnit('height', formData.height ?? ''),
        weight: getFieldWithUnit('weight', formData.weight ?? ''),
        bmi: formData.bmi ?? '',
        stations: []
      };
    } else {
      // Other test stations - add to stations array
      const fieldsToSend = {};
      stationFields[selectedStation].forEach(field => {
        fieldsToSend[field] = getFieldWithUnit(field, formData[field] ?? '');
      });
      
      const existingStations = formData.stations || [];
      const filteredStations = existingStations.filter(s => !s[selectedStation]);
      const newStations = [...filteredStations, { [selectedStation]: fieldsToSend }];
      payload = { stations: newStations };
      
      // Update local state with new stations
      this.setState(prevState => ({
        formData: {
          ...prevState.formData,
          stations: newStations
        }
      }));
    }
    
    // Submit data to backend
    try {
      const response = await axios.post(`${API_BASE_URL}/participants`, {
        purpose: 'updateStationData',
        participantID: qrValue,
        data: payload
      }, {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.data && response.data.success) {
        alert(language === 'en' ? 'Data submitted successfully!' : '数据提交成功！');
        
        // Reset to QR scanner state after successful submission
        this.isProcessingQR = false;
        this.stopQRScanner();
        
        this.setState({
          qrValue: '',
          qrScanned: false,
          cameraError: null,
          formData: {}
        }, () => {
          this.saveStateToLocalStorage();
          
          // Restart QR scanner if station is selected and video node is available
          if (this.state.selectedStation && this.videoNode) {
            setTimeout(() => {
              if (!this.qrScanner && !this.isProcessingQR) {
                this.startQRScannerWithNode(this.videoNode);
              }
            }, 200);
          }
        });
      } else {
        alert(language === 'en' ? 'Failed to submit data.' : '提交数据失败。');
      }
    } catch (err) {
      console.error('Data submission error:', err);
      let errorMessage = language === 'en' ? 'Network or server error.' : '网络或服务器错误。';
      
      // Provide specific error messages based on error type
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

  /**
   * Render the Volunteers component
   * Displays station selection, QR scanner, participant info, and form fields
   * Handles responsive layout and multi-language support
   * @returns {JSX.Element} - Component JSX
   */
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
      <div className="page-container" style={{ 
        minHeight: '100vh', 
        width: '100vw', 
        background: '#fff', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'flex-start',
        padding: window.innerWidth <= 480 ? '10px' : '20px',
        boxSizing: 'border-box'
      }}>
        
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

        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '2rem', 
          width: '100%', 
          maxWidth: 600,
          padding: window.innerWidth <= 480 ? '0 10px' : '0'
        }}>
          <h1 style={{
            fontSize: window.innerWidth <= 480 ? '1.5rem' : window.innerWidth <= 768 ? '1.8rem' : '2rem',
            margin: 0,
            textAlign: 'center',
            width: '100%'
          }}>
            {t.volunteersTitle}
          </h1>
        </div>
        
        <div className="details-section" style={{ 
          width: '100%', 
          maxWidth: 600,
          padding: window.innerWidth <= 480 ? '0 10px' : '0'
        }}>
          <label htmlFor="station-select" className="dropdown-label" style={{ 
            fontWeight: 600, 
            fontSize: window.innerWidth <= 480 ? '1rem' : '1.1rem',
            display: 'block',
            marginBottom: '8px'
          }}>
            {t.testStation}:
          </label>
          <select 
            id="station-select" 
            value={selectedStation} 
            onChange={this.handleChange} 
            className="dropdown-select" 
            style={{ 
              marginBottom: '2rem', 
              width: '100%',
              maxWidth: window.innerWidth <= 480 ? '100%' : 320,
              padding: window.innerWidth <= 480 ? '12px' : '10px',
              fontSize: window.innerWidth <= 480 ? '16px' : '14px',
              borderRadius: '8px',
              border: '2px solid #ddd',
              boxSizing: 'border-box'
            }}
          >
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
          <div className="details-section" style={{ 
            width: '100%',
            maxWidth: 700, 
            minHeight: formData.name ? 'auto' : (window.innerWidth <= 480 ? 500 : 700),
            padding: window.innerWidth <= 480 ? '0 10px' : '0'
          }}>
            
            {/* Show participant info when loaded */}
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
                  {['name', 'age', 'gender', 'dateOfBirth', 'phoneNumber'].map(field => {
                    let value = formData[field];
                    
                    if (!value || value === '-') return null;
                    
                    if (typeof value === 'object' && value !== null) {
                      if ('date' in value && 'time' in value) {
                        value = `${value.date} ${value.time}`;
                      } else {
                        value = JSON.stringify(value);
                      }
                    }
                    
                    if (field === 'gender' && typeof value === 'string') {
                      value = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
                    }
                    
                    const fieldLabel = t[field] || field;
                    const capitalizedLabel = fieldLabel.charAt(0).toUpperCase() + fieldLabel.slice(1);
                    
                    return (
                      <div key={field} style={{ marginBottom: '4px' }}>
                        {capitalizedLabel}: <strong>{value}</strong>
                      </div>
                    );
                  })}
                </div>
                <button 
                  onClick={() => {
                    // Stop QR processing and scanner
                    this.isProcessingQR = false;
                    this.stopQRScanner();
                    
                    // Completely clear all participant data and reset to QR scanner state
                    this.setState({ 
                      qrScanned: false, 
                      qrValue: '', 
                      formData: {},
                      cameraError: null,
                      dataStatusMessage: ''
                    }, () => {
                      // Save the cleared state to localStorage
                      this.saveStateToLocalStorage();
                      
                      // Restart QR scanner if station is selected and video node is available
                      if (this.videoNode && this.state.selectedStation) {
                        setTimeout(() => {
                          if (!this.qrScanner && !this.isProcessingQR) {
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
                  {language === 'en' ? '📹 Scan New Participant' : '📹 扫描新参与者'}
                </button>
              </div>
            )}
            
            {/* Removed scan issue display - simplified UI */}
            
            {/* Camera status when no participant is loaded */}
            {!formData.name && !qrScanned && (
              <div style={{ textAlign: 'center', marginBottom: 8, color: '#1976d2', fontWeight: 600 }}>
                {cameraError ? (
                  <div style={{ color: '#ff9800' }}>
                    <div style={{ marginBottom: '4px' }}>
                      {language === 'en' ? '⚠️ Scan issue detected' : '⚠️ 检测到扫描问题'}
                    </div>
                    {this.scannerRetryCount < this.maxRetryAttempts && (
                      <div style={{ fontSize: '0.8em' }}>
                        {language === 'en' ? '🔄 Auto-restarting scanner...' : '🔄 自动重启扫描器...'}
                      </div>
                    )}
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
                  </div>
                )}
              </div>
            )}
            
            {/* Camera view */}
            {!formData.name && !qrScanned && (
              <div id="qr-video-container" style={{ width: '100%', maxWidth: 640, minHeight: 480, margin: '0 auto', borderRadius: 18, background: '#000', border: '5px solid #1976d2', boxShadow: '0 4px 32px rgba(0,0,0,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <video
                  ref={this.setVideoRef}
                  style={{ width: '100%', height: 'auto', minHeight: 440, borderRadius: 18, background: '#222' }}
                  autoPlay
                  playsInline
                  muted
                />
                {!this.qrScanner && (
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#fff', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                      {language === 'en' ? '🚀 Starting camera...' : '🚀 启动摄像头...'}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Form fields when participant is loaded */}
            {formData.name && selectedStation && (
              <div style={{ 
                width: '100%', 
                maxWidth: 640, 
                margin: '0 auto', 
                padding: window.innerWidth <= 480 ? '16px' : '20px', 
                borderRadius: 18, 
                background: '#f8f9fa', 
                border: '2px solid #28a745', 
                boxShadow: '0 4px 32px rgba(0,0,0,0.12)',
                boxSizing: 'border-box'
              }}>
                
                {/* Check if height/weight is required but missing */}
                {(() => {
                  const requiresHeightWeight = selectedStation !== 'heightWeight';
                  const hasHeightWeight = formData.hasHeightWeight;
                  
                  if (requiresHeightWeight && !hasHeightWeight) {
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
                          ⚠️ {language === 'en' ? 'Height & Weight Required' : '需要身高体重数据'}
                        </h3>
                        <p style={{ margin: '0 0 16px 0', fontSize: '1.1em' }}>
                          {language === 'en' 
                            ? 'This participant must complete height and weight measurements before accessing other test stations.'
                            : '该参与者必须先完成身高体重测量才能进行其他测试站点。'}
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Show completed stations */}
                {(() => {
                  if (!formData.stations || !Array.isArray(formData.stations) || formData.stations.length === 0) {
                    return null;
                  }
                  
                  const hasCompletedData = (stationObj) => {
                    const stationData = Object.values(stationObj)[0];
                    if (!stationData || typeof stationData !== 'object') return false;
                    
                    return Object.values(stationData).some(val => {
                      if (!val || val === '' || val === '-' || val === 'null' || val === 'undefined') return false;
                      if (typeof val === 'string') {
                        const trimmed = val.trim();
                        if (trimmed === '0' || trimmed === '0 cm' || trimmed === '0 kg' || trimmed === '0 secs') return false;
                        if (trimmed.match(/^\s*(cm|kg|secs)\s*$/)) return false;
                        if (trimmed.length > 0) return true;
                      }
                      return val !== null && val !== undefined;
                    });
                  };
                  
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
                  
                  if (!canProceed) return null;
                  
                  return (
                    <div className="detail-grid" style={{ maxWidth: '100%' }}>
                      {stationFields[selectedStation].map(field => {
                        // Handle leftRight field for specific stations
                        if (field === 'leftRight' && ['sitReach', 'backStretch', 'handGrip'].includes(selectedStation)) {
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
                            <div className="detail-item" key={field} style={{ 
                              flexDirection: 'column', 
                              alignItems: 'flex-start', 
                              marginBottom: '16px',
                              width: '100%'
                            }}>
                              <span className="detail-label" style={{ 
                                marginBottom: '0.5rem', 
                                fontWeight: 600,
                                fontSize: window.innerWidth <= 480 ? '0.9rem' : '1rem'
                              }}>
                                {language === 'en' ? 'Left/Right:' : '左/右：'}
                              </span>
                              <div style={{ 
                                display: 'flex', 
                                flexDirection: window.innerWidth <= 480 ? 'column' : 'row',
                                gap: window.innerWidth <= 480 ? '0.3rem' : '0.5rem',
                                width: '100%'
                              }}>
                                <label style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  cursor: 'pointer', 
                                  color: 'black',
                                  flex: window.innerWidth <= 480 ? 'none' : 1,
                                  fontSize: window.innerWidth <= 480 ? '0.9rem' : '1rem',
                                  padding: window.innerWidth <= 480 ? '8px 0' : '0',
                                  minHeight: '44px'
                                }}>
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
                                    style={{ 
                                      marginRight: '0.5rem',
                                      minWidth: '16px',
                                      minHeight: '16px'
                                    }}
                                  />
                                  {getContextLabel('left')}
                                </label>
                                <label style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  cursor: 'pointer', 
                                  color: 'black',
                                  flex: window.innerWidth <= 480 ? 'none' : 1,
                                  fontSize: window.innerWidth <= 480 ? '0.9rem' : '1rem',
                                  padding: window.innerWidth <= 480 ? '8px 0' : '0',
                                  minHeight: '44px'
                                }}>
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
                                    style={{ 
                                      marginRight: '0.5rem',
                                      minWidth: '16px',
                                      minHeight: '16px'
                                    }}
                                  />
                                  {getContextLabel('right')}
                                </label>
                              </div>
                            </div>
                          );
                        }
                        
                        // Handle remarks field for specific stations
                        if (field === 'remarks' && ['sitReach', 'backStretch', 'handGrip'].includes(selectedStation)) {
                          const stationData = t.stationRemarks?.[selectedStation];
                          const leftLabel = stationData?.left || 'Left';
                          const rightLabel = stationData?.right || 'Right';
                          
                          return (
                            <div className="detail-item" key={field} style={{ 
                              flexDirection: 'column', 
                              alignItems: 'flex-start', 
                              marginBottom: '16px',
                              width: '100%'
                            }}>
                              <span className="detail-label" style={{ 
                                marginBottom: '0.5rem', 
                                fontWeight: 600,
                                fontSize: window.innerWidth <= 480 ? '0.9rem' : '1rem'
                              }}>
                                {t.remarks || 'Remarks'}:
                              </span>
                              <div style={{ 
                                display: 'flex', 
                                flexDirection: window.innerWidth <= 480 ? 'column' : 'row',
                                gap: window.innerWidth <= 480 ? '0.3rem' : '0.5rem',
                                width: '100%'
                              }}>
                                <label style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  cursor: 'pointer', 
                                  color: 'black',
                                  flex: window.innerWidth <= 480 ? 'none' : 1,
                                  fontSize: window.innerWidth <= 480 ? '0.9rem' : '1rem',
                                  padding: window.innerWidth <= 480 ? '8px 0' : '0',
                                  minHeight: '44px'
                                }}>
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
                                    style={{ 
                                      marginRight: '0.5rem',
                                      minWidth: '16px',
                                      minHeight: '16px'
                                    }}
                                  />
                                  {leftLabel}
                                </label>
                                <label style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  cursor: 'pointer', 
                                  color: 'black',
                                  flex: window.innerWidth <= 480 ? 'none' : 1,
                                  fontSize: window.innerWidth <= 480 ? '0.9rem' : '1rem',
                                  padding: window.innerWidth <= 480 ? '8px 0' : '0',
                                  minHeight: '44px'
                                }}>
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
                                    style={{ 
                                      marginRight: '0.5rem',
                                      minWidth: '16px',
                                      minHeight: '16px'
                                    }}
                                  />
                                  {rightLabel}
                                </label>
                              </div>
                            </div>
                          );
                        }
                        
                        // Default field rendering
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
                        if (formData.stations && formData.stations.length > 0) {
                          const lastStationObj = formData.stations.find(s => s[selectedStation]);
                          if (lastStationObj && lastStationObj[selectedStation] && lastStationObj[selectedStation][field]) {
                            lastValue = lastStationObj[selectedStation][field];
                          }
                        }

                        return (
                          <div className="detail-item" key={field} style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'flex-start', 
                            gap: 8, 
                            marginBottom: '16px',
                            width: '100%'
                          }}>
                            <div style={{ 
                              display: 'flex', 
                              flexDirection: window.innerWidth <= 768 ? 'column' : 'row',
                              alignItems: window.innerWidth <= 768 ? 'flex-start' : 'center',
                              gap: window.innerWidth <= 768 ? 4 : 8, 
                              width: '100%' 
                            }}>
                              <span className="detail-label" style={{ 
                                fontWeight: 600, 
                                minWidth: window.innerWidth <= 768 ? 'auto' : '120px',
                                fontSize: window.innerWidth <= 480 ? '0.9rem' : '1rem',
                                marginBottom: window.innerWidth <= 768 ? '4px' : '0'
                              }}>
                                {t[field] || field}:
                              </span>
                              <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 4, 
                                flex: 1,
                                width: '100%'
                              }}>
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
                                    style={{ 
                                      padding: window.innerWidth <= 480 ? '0.6rem' : '0.75rem', 
                                      borderRadius: 8, 
                                      border: '2px solid #ddd', 
                                      flex: 1, 
                                      fontSize: window.innerWidth <= 480 ? '0.9rem' : '1rem',
                                      minHeight: '44px',
                                      width: '100%',
                                      boxSizing: 'border-box'
                                    }}
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
                                    style={{ 
                                      padding: window.innerWidth <= 480 ? '0.6rem' : '0.75rem', 
                                      borderRadius: 8, 
                                      border: '2px solid #ddd', 
                                      flex: 1, 
                                      fontSize: window.innerWidth <= 480 ? '0.9rem' : '1rem',
                                      minHeight: '44px',
                                      width: '100%',
                                      boxSizing: 'border-box'
                                    }}
                                  />
                                )}
                              </div>
                            </div>
                            {lastValue && (
                              <div style={{ 
                                color: '#1976d2', 
                                fontSize: window.innerWidth <= 480 ? '0.8em' : '0.9em', 
                                marginLeft: window.innerWidth <= 768 ? 0 : 8,
                                width: '100%'
                              }}>
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
                          padding: window.innerWidth <= 480 ? '0.8rem' : '1rem',
                          borderRadius: 12,
                          background: '#1976d2',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: window.innerWidth <= 480 ? '1.1rem' : '1.2rem',
                          border: 'none',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          minHeight: '48px',
                          boxSizing: 'border-box'
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
        <div style={{ 
          marginTop: '20px', 
          textAlign: 'center', 
          width: '100%', 
          maxWidth: 600, 
          display: 'flex', 
          gap: window.innerWidth <= 480 ? '8px' : '10px', 
          justifyContent: 'center', 
          flexWrap: 'wrap',
          padding: window.innerWidth <= 480 ? '0 10px' : '0'
        }}>
          <button 
            onClick={this.handleVolunteerDone}
            style={{
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              padding: window.innerWidth <= 480 ? '10px 16px' : '12px 24px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: window.innerWidth <= 480 ? '14px' : '16px',
              fontWeight: '600',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              minHeight: '44px',
              flex: window.innerWidth <= 480 ? '1' : 'none'
            }}
            title="Finish volunteer session and return to home"
          >
            ✅ {language === 'en' ? 'Done - Finish Session' : '完成 - 结束会话'}
          </button>
          
          <button 
            onClick={this.clearSavedState}
            style={{
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              padding: window.innerWidth <= 480 ? '6px 12px' : '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: window.innerWidth <= 480 ? '11px' : '12px',
              minHeight: '44px',
              flex: window.innerWidth <= 480 ? '1' : 'none'
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

export default Volunteers
