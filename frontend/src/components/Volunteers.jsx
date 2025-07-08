import React, { Component } from 'react'
import LanguageContext from '../contexts/LanguageContext'
import { translations } from '../utils/translations'
import './Pages.css'

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
      selectedStation: 'heightWeight',
      formData: {},
      qrValue: ''
    }
  }

  handleChange = (e) => {
    this.setState({ selectedStation: e.target.value })
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

  render() {
    const { selectedStation, formData, qrValue } = this.state
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
      <div className="page-container">
        <button className="tab-button language-toggle" onClick={this.handleLanguageToggle} style={{ position: 'fixed', top: 24, right: 32, zIndex: 10 }}>
          {language === 'en' ? '中文' : 'English'}
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1>{t.volunteersTitle}</h1>
        </div>
        <div className="details-section" style={{ maxWidth: 400, marginBottom: 32 }}>
          <label className="dropdown-label" style={{ fontWeight: 600, fontSize: '1.1rem' }}>
            {language === 'en' ? 'Scan QR Code' : '扫描二维码'}:
          </label>
          <input
            type="text"
            value={qrValue}
            onChange={this.handleQRInput}
            placeholder={language === 'en' ? 'Enter or scan QR code...' : '输入或扫描二维码...'}
            style={{ marginBottom: 16, padding: '0.5rem', borderRadius: 6, border: '1px solid #ccc', minWidth: 200 }}
            autoFocus
          />
          <label htmlFor="station-select" className="dropdown-label" style={{ fontWeight: 600, fontSize: '1.1rem', marginTop: 16 }}>
            {t.testStation}:
          </label>
          <select id="station-select" value={selectedStation} onChange={this.handleChange} className="dropdown-select" style={{ marginBottom: '2rem', maxWidth: 320 }}>
            {stationKeys.map(key => (
              <option key={key} value={key}>
                {t.stations[key]}
              </option>
            ))}
          </select>
        </div>
        <div className="details-section">
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
      </div>
    )
  }
}

export default Volunteers
