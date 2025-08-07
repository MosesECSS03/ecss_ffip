import React, { Component } from 'react'
import QRCode from 'qrcode'
import ParticipantDetails from './ParticipantDetails'
import { translations } from '../utils/translations'
import './Pages.css';

class SwipeView extends Component {
  constructor(props) {
    super(props)
    this.state = {
      currentView: 'details',
      qrCodeUrl: '',
      touchStart: 0,
      touchEnd: 0
    }
  }

  componentDidMount() {
    this.generateQR();
    document.addEventListener('keydown', this.handleKeyDown)
    // Listen for survey-updated event

  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.handleKeyDown)
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  // Check if participant has any station results
  hasStationResults = () => {
    const { participant } = this.props
    return participant.stationResults && 
      Object.keys(participant.stationResults).length > 0 &&
      Object.values(participant.stationResults).some(result => result.status === 'completed')
  }

  // Get completed and incomplete stations
  getStationSummary = () => {
    const { participant } = this.props
    if (!participant.stationResults) return { completed: [], incomplete: [] }
    
    const completed = []
    const incomplete = []
    
    Object.entries(participant.stationResults).forEach(([stationName, result]) => {
      if (result.status === 'completed') {
        completed.push({ name: stationName, ...result })
      } else {
        incomplete.push({ name: stationName, ...result })
      }
    })
    
    return { completed, incomplete }
  }

  // Generate QR code
  generateQR = async () => {
    try {
      const { participant } = this.props
      const participantId = participant.id || participant._id || participant.participant_id
      const qrString = participantId ? participantId.toString() : participant.name || 'Unknown'
      
      const qrUrl = await QRCode.toDataURL(qrString, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
      this.setState({ qrCodeUrl: qrUrl })
    } catch (error) {
      console.error('Error generating QR code:', error)
    }
  }

  // Handle keyboard events
  handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft') {
      this.setState({ currentView: 'details' })
    } else if (e.key === 'ArrowRight') {
      this.setState({ currentView: 'qr' })
    }
  }

  handleTouchStart = (e) => {
    this.setState({ touchStart: e.targetTouches[0].clientX })
  }

  handleTouchMove = (e) => {
    this.setState({ touchEnd: e.targetTouches[0].clientX })
  }

  handleTouchEnd = () => {
    const { touchStart, touchEnd, currentView } = this.state
    if (!touchStart || !touchEnd) return

    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > 50
    const isRightSwipe = distance < -50

    if (isLeftSwipe && currentView === 'details') {
      this.setState({ currentView: 'qr' })
    } else if (isRightSwipe && currentView === 'qr') {
      this.setState({ currentView: 'details' })
    }
  }

  toggleView = () => {
    const { currentView } = this.state
    this.setState({ 
      currentView: currentView === 'details' ? 'qr' : 'details' 
    })
  }

  setCurrentView = (view) => {
    this.setState({ currentView: view })
  }

  render() {
    const { participant, language, onClose } = this.props
    const { currentView, qrCodeUrl } = this.state
    const hasResults = this.hasStationResults()
    const t = translations[language || 'en']

    return (
      <div 
        className="swipe-view-fullscreen"
        onTouchStart={this.handleTouchStart}
        onTouchMove={this.handleTouchMove}
        onTouchEnd={this.handleTouchEnd}
      >

        {/* Content area */}
        <div className="swipe-view-content">
            {currentView === 'details' && (
              <div>
                <ParticipantDetails 
                  participant={participant} 
                  language={language} 
                  onClose={onClose}
                />
                {console.log('Raw Participant Data', participant)}
                {/* Station Results Section within Details */}
                {hasResults && (
                  <div className="station-results-section">
                    <h2 className="section-title">{t.stationResults}</h2>
                    
                    {/* Station Cards */}
                    <div className="station-cards">
                      {Object.entries(participant.stationResults || {}).map(([stationName, result]) => (
                        <div key={stationName} className="station-card">
                          <div className="station-header">
                            <h3 className="station-title">{stationName}</h3>
                          </div>
                          
                          {result.score && (
                            <div className="station-score-large">{result.score}/10</div>
                          )}
                          
                          <div className={`station-badge-large ${result.status}`}>
                            {result.status.toUpperCase()}
                          </div>
                          
                          {result.completedAt && (
                            <div className="station-timestamp">
                              {new Date(result.completedAt).toLocaleDateString()} {new Date(result.completedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentView === 'qr' && (
              <div className="qr-code-view">
                <h2 className="qr-modal-title">{t.presentQRCode}</h2>
                <p className="qr-modal-subtitle">{t.qrCodeSubtitle}</p>
                
                <div className="qr-code-container">
                  {qrCodeUrl && (
                    <img 
                      src={qrCodeUrl} 
                      alt="Participant QR Code" 
                      className="qr-code-image"
                    />
                  )}
                </div>
                
                <div className="qr-modal-description">
                  <p>{t.qrCodeDescription}</p>
                </div>
                
                <div className="swipe-instructions">
                  <p className="swipe-instructions-text">{t.swipeInstructionsDetails}</p>
                </div>
              </div>
            )}

            {currentView === 'stations' && (
              <div className="station-results-view">
                <h2 className="station-results-title">{t.stationResults}</h2>
                
                {/* Detailed Station Results */}
                <div className="station-details">
                  <div className="station-results-grid">
                    {Object.entries(participant.stationResults || {}).map(([stationName, result]) => (
                      <div key={stationName} className="station-result-card">
                        <div className="station-name">{stationName}</div>
                        {result.score && (
                          <div className="station-score">{result.score}/10</div>
                        )}
                        <div className={`station-status ${result.status}`}>
                          {result.status.toUpperCase()}
                        </div>
                        {result.completedAt && (
                          <div className="station-time">
                            {new Date(result.completedAt).toLocaleDateString()} {new Date(result.completedAt).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
    )
  }
}

export default SwipeView
