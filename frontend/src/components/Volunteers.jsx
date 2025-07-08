import React, { Component, createRef } from 'react'
import LanguageContext from '../contexts/LanguageContext'
import { translations } from '../utils/translations'
import './Pages.css'
import QrScanner from 'qr-scanner'

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
        result => {
          if (result && result.data && !this.state.qrScanned) {
            this.setState({ qrValue: result.data, qrScanned: true, cameraError: null })
            this.qrScanner.stop()
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
    if (
      this.state.selectedStation &&
      !this.state.qrScanned &&
      (prevState.selectedStation !== this.state.selectedStation || prevState.qrScanned !== this.state.qrScanned)
    ) {
      this.startQRScanner()
    }
    if (this.state.qrScanned && this.qrScanner) {
      this.qrScanner.stop()
    }
  }

  handleChange = (e) => {
    this.setState({ selectedStation: e.target.value, qrValue: '', qrScanned: false, cameraError: null })
  }

  handleLanguageToggle = () => {
    const { language, setLanguage } = this.context
    setLanguage(language === 'en' ? 'zh' : 'en')
  }

  handleInputChange = (e, field) => {
    this.setState({
      formData: {
        ...this.state.formData,
        [field]: e.target.value
      }
    })
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
      <div className="page-container" style={{ minHeight: '100vh', width: '100vw', background: '#f7f8fa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start' }}>
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
              {language === 'en' ? 'Scanned QR Code:' : '已扫描二维码：'} {qrValue}
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
            </div>
          </div>
        )}
      </div>
    )
  }
}

export default Volunteers;
