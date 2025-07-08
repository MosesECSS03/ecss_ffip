import React, { Component } from 'react'
import LanguageContext from '../contexts/LanguageContext'
import { translations } from '../utils/translations'
import './Pages.css'
import QrScanner from 'qr-scanner'
import axios from "axios"

const stationFields = {
  heightWeight: ['height', 'weight'],
  sitStand: ['score1', 'remarks', 'sitStandResult'],
  armBanding: ['score1', 'remarks', 'armBandingResult'],
  marching: ['score1', 'remarks', 'marchingResult'],
  sitReach: ['leftRight', 'score1', 'score2', 'sitReachResult'],
  backStretch: ['leftRight', 'score1', 'score2', 'backStretchResult'],
  speedWalking: ['score1', 'score2', 'remarks', 'speedWalkingResult'],
  handGrip: ['leftRight', 'score1', 'score2', 'handGripResult']
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
      stations: [] // <-- add stations array to state
    }
    this.qrScanner = null
  }

  componentWillUnmount() {
    this.stopQRScanner()
  }

  stopQRScanner = () => {
    if (this.qrScanner) {
      this.qrScanner.destroy()
      this.qrScanner = null
    }
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
    });
  }

  handleLanguageToggle = () => {
    const { language, setLanguage } = this.context
    setLanguage(language === 'en' ? 'zh' : 'en')
  }

  handleInputChange = (e, field) => {
    // Only update the formData, do not touch qrScanned or other state
    this.setState(prevState => ({
      formData: {
        ...prevState.formData,
        [field]: e.target.value
      }
    }));
  }

  handleQRInput = (e) => {
    this.setState({ qrValue: e.target.value })
  }

  handleQRSubmit = (e) => {
    e.preventDefault()
    if (this.state.qrValue.trim() !== '') {
      this.setState({ qrScanned: true })
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
    let payload;
    if (selectedStation === 'heightWeight') {
      // For heightWeight, send as { heightWeight: { ...fields }, stations: [] }
      const fieldsToSend = {};
      stationFields[selectedStation].forEach(field => {
        fieldsToSend[field] = formData[field];
      });
      payload = { heightWeight: fieldsToSend, stations: [] };
    } else {
      // For other stations, add/update the station in stations array and send all completed so far
      const fieldsToSend = {};
      stationFields[selectedStation].forEach(field => {
        fieldsToSend[field] = formData[field];
      });
      // Remove any previous entry for this station
      const filteredStations = stations.filter(s => !s[selectedStation]);
      const newStations = [...filteredStations, { [selectedStation]: fieldsToSend }];
      payload = { stations: newStations };
      // Update state with new stations array
      this.setState({ stations: newStations });
    }
    try {
      const response = await axios.post(`${API_BASE_URL}/participants`, {
        purpose: 'updateStationData',
        participantID: qrValue,
        data: payload
      });
      if (response.data && response.data.success) {
        alert(language === 'en' ? 'Data submitted successfully!' : '数据提交成功！');
        this.setState({
          qrScanned: false,
          qrValue: '',
          formData: {},
          cameraError: null
        });
      } else {
        alert(language === 'en' ? 'Failed to submit data.' : '提交数据失败。');
      }
    } catch (err) {
      alert(language === 'en' ? 'Network or server error.' : '网络或服务器错误。');
    }
  }

  render() {
    const { selectedStation, formData, qrValue, qrScanned, cameraError } = this.state
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
                    {infoFields.map(field => (
                      <div key={field}>
                        {t[field] || field}: {formData[field] || '-'}
                      </div>
                    ))}
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
                return (
                  <div className="detail-item" key={field}>
                    <span className="detail-label">{t[field] || field}:</span>
                    <input
                      className="detail-value"
                      type={field === 'remarks' ? 'text' : 'number'}
                      value={formData[field] || ''}
                      onChange={e => this.handleInputChange(e, field)}
                      style={{ marginLeft: 8, padding: '0.5rem', borderRadius: 6, border: '1px solid #ccc', minWidth: 100 }}
                    />
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
      </div>
    )
  }
}

export default Volunteers;
