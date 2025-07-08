import React, { Component, createRef } from 'react'
import LanguageContext from '../contexts/LanguageContext'
import { translations } from '../utils/translations'
import './Pages.css'
import QrScanner from 'qr-scanner'
import axios from "axios"

const stationFields = {
  heightWeight: ['height', 'weight'],
  sitStand: ['sitStandCount'],
  armBanding: ['armBandingCount'],
  marching: ['marchingCount'],
  sitReach: ['sitReachScore'],
  backStretch: ['backStretchScore'],
  speedWalking: ['speedWalkingTime'],
  handGrip: ['handGripScore']
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
      cameraError: null
    }
    this.videoRef = createRef()
    this.qrScanner = null
  }

  componentWillUnmount() {
    if (this.qrScanner) {
      this.qrScanner.destroy()
      this.qrScanner = null
    }
  }

  startQRScanner = () => {
    if (this.qrScanner) {
      this.qrScanner.destroy()
      this.qrScanner = null
    }
    if (this.videoRef.current) {
      this.qrScanner = new QrScanner(
        this.videoRef.current,
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
                console.log('Participant:', {
                  name: p.name,
                  age: p.age,
                  gender: p.gender,
                  dateOfBirth: p.dateOfBirth,
                  testDate: p.submittedAt?.date,
                  phone: p.phone
                });
                // Populate fields with participant data
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
            if (!this.state.cameraError) {
              this.setState({ cameraError: error.message || 'Camera error' })
            }
          },
          highlightScanRegion: true,
          highlightCodeOutline: true
        }
      )
      this.qrScanner.start().catch(e => {
        this.setState({ cameraError: e.message || 'Camera error' })
      })
    }
  }

  componentDidUpdate(prevProps, prevState) {
    // Always start QR scanner when:
    // 1. Station is selected and QR not scanned
    // 2. Station changed OR qrScanned state changed
    // 3. Switching from heightWeight to any other station
    if (
      this.state.selectedStation &&
      !this.state.qrScanned &&
      (prevState.selectedStation !== this.state.selectedStation || 
       prevState.qrScanned !== this.state.qrScanned ||
       (prevState.selectedStation === 'heightWeight' && this.state.selectedStation !== 'heightWeight'))
    ) {
      this.startQRScanner()
    }
    if (this.state.qrScanned && this.qrScanner) {
      this.qrScanner.stop()
    }
  }

  handleChange = (e) => {
    const newStation = e.target.value;
    // Always reset to QR scan screen when changing stations
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
    const { selectedStation } = this.state;
    // For all stations except heightWeight, reset to QR scan screen on value change
    if (selectedStation && selectedStation !== 'heightWeight') {
      this.setState({
        qrScanned: false,
        qrValue: '',
        formData: {},
        cameraError: null
      });
    } else {
      // For heightWeight, just update the form data
      this.setState({
        formData: {
          ...this.state.formData,
          [field]: e.target.value
        }
      });
    }
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
    const { selectedStation, formData, qrValue } = this.state;
    const { language } = this.context;
    if (!qrValue) {
      alert(language === 'en' ? 'No QR code scanned.' : '未扫描二维码。');
      return;
    }
    // Only send the fields for the selected station, but include all existing keys as well
    const fieldsToSend = { ...formData };
    stationFields[selectedStation].forEach(field => {
      fieldsToSend[field] = formData[field];
    });
    try {
      const response = await axios.post(`${API_BASE_URL}/participants`, {
        purpose: 'updateStationData',
        participantID: qrValue,
        station: selectedStation,
        data: fieldsToSend
      });
      if (response.data && response.data.success) {
        alert(language === 'en' ? 'Data submitted successfully!' : '数据提交成功！');
        // For all stations except heightWeight, reset to QR scan screen for next participant
        if (selectedStation !== 'heightWeight') {
          this.setState({
            qrScanned: false,
            qrValue: '',
            formData: {},
            cameraError: null
          });
        } else {
          // For heightWeight, just clear the form fields
          this.setState({
            formData: {},
            cameraError: null
          });
        }
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
        {selectedStation && !qrScanned && (
          <div className="details-section" style={{ maxWidth: 700, minHeight: 700 }}>
            <label className="dropdown-label" style={{ fontWeight: 600, fontSize: '1.1rem' }}>
              {language === 'en' ? 'Scan QR Code' : '扫描二维码'}:
            </label>
            <div style={{ textAlign: 'center', marginBottom: 8, color: '#1976d2', fontWeight: 600 }}>
              {language === 'en' ? 'Camera is active. Please hold QR code in front of the camera.' : '摄像头已开启，请将二维码对准摄像头'}
            </div>
            <div id="qr-video-container" style={{ width: '100%', maxWidth: 640, minHeight: 480, margin: '0 auto', borderRadius: 18, background: '#000', border: '5px solid #1976d2', boxShadow: '0 4px 32px rgba(0,0,0,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <video ref={this.videoRef} style={{ width: '100%', height: 'auto', minHeight: 440, borderRadius: 18, background: '#222' }} muted playsInline />
              {/* Fallback if video is not visible */}
              <noscript>
                <div style={{ color: 'red', position: 'absolute', top: '50%', left: 0, right: 0, textAlign: 'center', fontWeight: 700 }}>
                  {language === 'en' ? 'Camera video not available.' : '摄像头画面不可用'}
                </div>
              </noscript>
            </div>
          </div>
        )}
        {selectedStation && qrScanned && (
          <div className="details-section">
            <div style={{ textAlign: 'center', marginBottom: 12, color: '#388e3c', fontWeight: 600 }}>
              {formData && formData.name ? (
                <>
                  {language === 'en' ? 'Participant:' : '参与者：'}<br />
                  {t.name || 'Name'}: {formData.name || '-'}<br />
                  {t.age || 'Age'}: {formData.age || '-'}<br />
                  {t.gender || 'Gender'}: {formData.gender || '-'}<br />
                  {t.dateOfBirth || 'Date of Birth'}: {formData.dateOfBirth || '-'}<br />
                  {language === 'en' ? 'Test Date' : '测试日期'}: {formData.submittedAt?.date || '-'}<br />
                  {t.phoneNumber || 'Phone'}: {formData.phoneNumber || '-'}
                </>
              ) : cameraError ? (
                <>
                  {cameraError}
                </>
              ) : (
                <>
                  {language === 'en' ? 'Scanned QR Code:' : '已扫描二维码：'} {qrValue}
                </>
              )}
            </div>
            <div className="detail-grid" style={{ maxWidth: 400 }}>
              {stationFields[selectedStation].map(field => (
                <div className="detail-item" key={field}>
                  <span className="detail-label">{t[field] || field}:</span>
                  <input
                    className="detail-value"
                    type="number"
                    value={formData[field] || ''}
                    onChange={e => this.handleInputChange(e, field)}
                    style={{ marginLeft: 8, padding: '0.5rem', borderRadius: 6, border: '1px solid #ccc', minWidth: 100 }}
                  />
                </div>
              ))}
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
