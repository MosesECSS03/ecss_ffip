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
  }

  componentDidMount() {
    // Load saved state when component mounts
    this.loadStateFromLocalStorage();
  }

  componentWillUnmount() {
    // Save state immediately before component unmounts
    this.immediateSave();
    this.stopQRScanner()
  }

  stopQRScanner = () => {
    if (this.qrScanner) {
      this.qrScanner.destroy()
      this.qrScanner = null
    }
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
      dataStatusMessage: '🗑️ Saved data cleared successfully',
      selectedStation: '',
      formData: {},
      qrValue: '',
      qrScanned: false,
      stations: []
    });
    setTimeout(() => {
      this.setState({ dataStatusMessage: '' });
    }, 2000);
  }

  startQRScanner = () => {
    // Clean up any existing scanner
    if (this.qrScanner) {
      this.qrScanner.destroy()
      this.qrScanner = null
    }
    
    // Clear any previous camera errors
    this.setState({ cameraError: null })
    
    if (this.videoNode) {
      this.qrScanner = new QrScanner(
        this.videoNode,
        async result => {
          if (result && result.data && !this.state.qrScanned) {
            this.qrScanner.stop()
            try {
              const response = await axios.post(`${API_BASE_URL}/participants`, {
                "purpose": "retrieveParticipant",
                "participantID": result.data
              });
              console.log('QR Code scanned:', response.data)
              // Log participant details instead of just the code
              if (response.data && response.data.success && response.data.data) {
                const p = response.data.data;
                // Populate only relevant fields with participant data for the selected station
                const formData = {};
                const fields = stationFields[this.state.selectedStation] || [];
                fields.forEach(key => {
                  formData[key] = response.data.data[key] || '';
                });
                this.setState({
                  qrValue: result.data,
                  qrScanned: true,
                  cameraError: null,
                  formData
                });
              } else {
                // No participant found or error
                this.setState({
                  qrValue: result.data,
                  qrScanned: true,
                  cameraError: response.data.message || 'No participant found',
                  formData: {}
                });
              }
            } catch (err) {
              this.setState({
                qrValue: result.data,
                qrScanned: true,
                cameraError: 'Network or server error',
                formData: {}
              });
            }
          }
        },
        {
          onDecodeError: error => {
            // Only update error state if it's a significant error, not just scanning issues
            console.warn('QR Scanner decode error:', error.message)
          },
          highlightScanRegion: true,
          highlightCodeOutline: true
        }
      )
      this.qrScanner.start().catch(e => {
        console.error('QR Scanner start error:', e)
        this.setState({ cameraError: e.message || 'Camera access denied or not available' })
      })
    }
  }

  setVideoRef = (node) => {
    // Only update if the node actually changed
    if (node !== this.videoNode) {
      this.videoNode = node;
      // Debounce scanner start to avoid rapid re-init
      clearTimeout(this._qrScannerStartTimeout);
      if (node && this.state.selectedStation && !this.state.qrScanned) {
        this._qrScannerStartTimeout = setTimeout(() => {
          if (!this.qrScanner) {
            this.startQRScannerWithNode(node);
          }
        }, 200);
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
          if (result && result.data && !this.state.qrScanned) {
            this.qrScanner.stop();
            try {
              const response = await axios.post(`${API_BASE_URL}/participants`, {
                "purpose": "retrieveParticipant",
                "participantID": result.data
              });
              if (response.data && response.data.success && response.data.data) {
                const p = response.data.data;
                const formData = {};
                Object.keys(response.data.data).forEach(key => {
                  formData[key] = response.data.data[key];
                });
                this.setState({
                  qrValue: result.data,
                  qrScanned: true,
                  cameraError: null,
                  formData
                });
              } else {
                this.setState({
                  qrValue: result.data,
                  qrScanned: true,
                  cameraError: response.data.message || 'No participant found',
                  formData: {}
                });
              }
            } catch (err) {
              this.setState({
                qrValue: result.data,
                qrScanned: true,
                cameraError: 'Network or server error',
                formData: {}
              });
            }
          }
        },
        {
          onDecodeError: error => {
            console.warn('QR Scanner decode error:', error.message);
          },
          highlightScanRegion: true,
          highlightCodeOutline: true
        }
      );
      this.qrScanner.start().catch(e => {
        console.error('QR Scanner start error:', e);
        this.setState({ cameraError: e.message || 'Camera access denied or not available' });
      });
    }
  }

  componentDidUpdate(prevProps, prevState) {
    // Stop scanner when QR is scanned or station is deselected
    if ((this.state.qrScanned || !this.state.selectedStation) && this.qrScanner) {
      this.stopQRScanner();
    }
    // If switching to a new station and not scanned, start scanner if not already started
    if (
      this.videoNode &&
      this.state.selectedStation &&
      !this.state.qrScanned &&
      (prevState.selectedStation !== this.state.selectedStation || prevState.qrScanned !== this.state.qrScanned)
    ) {
      clearTimeout(this._qrScannerStartTimeout);
      this._qrScannerStartTimeout = setTimeout(() => {
        if (!this.qrScanner) {
          this.startQRScannerWithNode(this.videoNode);
        }
      }, 200);
    }
  }

  handleChange = (e) => {
    const newStation = e.target.value;
    // For any station, reset to QR scan screen
    this.setState({
      selectedStation: newStation,
      qrValue: '',
      qrScanned: false,
      cameraError: null,
      formData: {}
    }, () => {
      // Save state after station change
      this.debouncedSave();
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
        data: payload // ensure payload is sent as JSON string
      });
      if (response.data && response.data.success) {
        alert(language === 'en' ? 'Data submitted successfully!' : '数据提交成功！');
        this.setState({
          qrScanned: false,
          qrValue: '',
          formData: {},
          cameraError: null
        }, () => {
          // Save state immediately after successful submission
          this.immediateSave();
        });
      } else {
        alert(language === 'en' ? 'Failed to submit data.' : '提交数据失败。');
      }
    } catch (err) {
      alert(language === 'en' ? 'Network or server error.' : '网络或服务器错误。');
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
        {selectedStation && !qrScanned && (
          <div className="details-section" style={{ maxWidth: 700, minHeight: 700 }}>
            <div style={{ textAlign: 'center', marginBottom: 8, color: '#1976d2', fontWeight: 600 }}>
              {cameraError ? (
                <span style={{ color: '#d32f2f' }}>
                  {language === 'en' ? 'Camera Error: ' : '摄像头错误：'}{cameraError}
                </span>
              ) : (
                <span>
                  {language === 'en' ? 'Camera is active. Please hold QR code in front of the camera.' : '摄像头已开启，请将二维码对准摄像头'}
                </span>
              )}
            </div>
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
                    {language === 'en' ? 'Starting camera...' : '启动摄像头...'}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {selectedStation && qrScanned && (
          <div className="details-section">
            {/* Show completed stations */}
            {this.state.stations.length > 0 && (
              <div style={{ marginBottom: 16, color: '#1976d2', fontWeight: 600 }}>
                {language === 'en' ? 'Completed Stations:' : '已完成站点：'}
                <ul>
                  {this.state.stations.map((stationObj, idx) => {
                    const stationName = Object.keys(stationObj)[0];
                    return (
                      <li key={stationName}>
                        {t.stations[stationName] || stationName}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <div style={{ textAlign: 'center', marginBottom: 12, color: '#388e3c', fontWeight: 600 }}>
              {/* Always show participant info section as heightWeight, even for manual entry */}
              {(() => {
                const infoFields = ['name', 'age', 'gender', 'dateOfBirth', 'submittedAt', 'phoneNumber'];
                return (
                  <>
                    {infoFields.map(field => {
                      let value = formData[field] || '-';
                      // Fix: If value is an object (e.g., {date, time}), render as string
                      if (typeof value === 'object' && value !== null) {
                        if ('date' in value && 'time' in value) {
                          value = `${value.date} ${value.time}`;
                        } else {
                          value = JSON.stringify(value);
                        }
                      }
                      return (
                        <div key={field}>
                          {t[field] || field}: {value}
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
            <div className="detail-grid" style={{ maxWidth: 400 }}>
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
                    <div className="detail-item" key={field} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span className="detail-label" style={{ marginBottom: '0.5rem' }}>{language === 'en' ? 'Left/Right:' : '左/右：'}</span>
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
                    <div className="detail-item" key={field} style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span className="detail-label" style={{ marginBottom: '0.5rem' }}>{t.remarks || 'Remarks'}:</span>
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
                  <div className="detail-item" key={field} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="detail-label">{t[field] || field}:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
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
                            style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #ccc', minWidth: 100 }}
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
                            style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #ccc', minWidth: 100 }}
                          />
                        )}
                      </div>
                    </div>
                    {/* Show last value for this station/field if available */}
                    {lastValue && (
                      <div style={{ color: '#1976d2', fontSize: '0.95em', marginLeft: 8 }}>
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
                  padding: '0.75rem',
                  borderRadius: 8,
                  background: '#1976d2',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.10)'
                }}
                onClick={() => {
                  this.onEnter()
                }}
              >
                {language === 'en' ? 'Enter' : '提交'}
              </button>
            </div>
          </div>
        )}
        
        {/* Clear Saved Data Button */}
        <div style={{ marginTop: '20px', textAlign: 'center', width: '100%', maxWidth: 600 }}>
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
            🗑️ Clear Saved Data
          </button>
        </div>
      </div>
    )
  }
}

export default Volunteers;