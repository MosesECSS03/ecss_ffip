  import React, { Component } from 'react'
  import QRCode from 'qrcode'
  import axios from 'axios'
  import ParticipantDetails from './ParticipantDetails'
  import { translations } from '../../utils/translations'
  import '../Pages.css'


  const API_BASE_URL =
    window.location.hostname === 'localhost'
      ? 'http://localhost:3001'
      : 'https://ecss-fft.azurewebsites.net';


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

    componentDidMount = async() =>
    {
      await this.generateQR();
      const { participant } = this.props;
      console.log('Participant data:', participant);
      const participantId = participant?.id;
      
      console.log('Component mounted with participant ID:', participantId);
      
      // Use participantId for data retrieval here
      if (participantId) {
        // You can add your data retrieval logic here
        this.retrieveParticipantData(participantId);
      }
      
      document.addEventListener('keydown', this.handleKeyDown)
      
      // Listen for survey-updated event
    }

    componentWillUnmount() {
      document.removeEventListener('keydown', this.handleKeyDown)
      if (this.socket) {
        this.socket.disconnect();
      }
    }

    // Method to retrieve participant data using the ID
    retrieveParticipantData = async (participantId) => {
      try {
        console.log('Retrieving data for participant:', participantId);

        const response = await axios.post(`${API_BASE_URL}/participants`, {
          purpose: 'retrieveParticipant',
          participantID: participantId
        });
        
        if (response.data && response.data.success) {
          console.log('Retrieved participant data:', response.data.participant);
          // You can update state with the retrieved data if needed
          // this.setState({ updatedParticipant: response.data.participant });
        } else {
          console.warn('Failed to retrieve participant data:', response.data.message);
        }
        
      } catch (error) {
        console.error('Error retrieving participant data:', error);
        if (error.response) {
          console.error('Response error:', error.response.data);
        }
      }
    }

    // Check if participant has any station data
    hasStationData = () => {
      const { participant } = this.props
      return participant.stations && 
        Array.isArray(participant.stations) &&
        participant.stations.length > 0
    }

    // Check if participant has height and weight data
    hasHeightWeightData = () => {
      const { participant } = this.props
      console.log("Checking Height and Weight Data:", participant)
      return participant.height && participant.weight && 
            participant.height !== '' && participant.weight !== '' &&
            participant.height !== '-' && participant.weight !== '-'
    }

    // Get station summary from the stations array
    getStationSummary = () => {
      const { participant } = this.props
      if (!participant.stations || !Array.isArray(participant.stations)) {
        return { completed: [], incomplete: [] }
      }
      
      const completed = []
      const incomplete = []
      
      // Process each station in the stations array
      participant.stations.forEach(stationObj => {
        Object.entries(stationObj).forEach(([stationName, stationData]) => {
          // Check if station has meaningful data
          const hasData = Object.values(stationData).some(value => {
            if (!value || value === '' || value === '-') return false
            if (typeof value === 'string') {
              const trimmed = value.trim()
              if (trimmed === '0' || trimmed.match(/^\s*(cm|kg|secs)\s*$/)) return false
              return trimmed.length > 0
            }
            return true
          })
          
          if (hasData) {
            completed.push({ 
              name: stationName, 
              data: stationData,
              completedAt: new Date().toISOString() // Stations don't have timestamps, use current time
            })
          } else {
            incomplete.push({ 
              name: stationName, 
              data: stationData 
            })
          }
        })
      })
      
      return { completed, incomplete }
    }

    // Generate QR code
    generateQR = async () => {
      try {
        const { participant } = this.props
        console.log('Generating QR code for participant:', participant)
        const participantId = participant.id
        console.log('QR Code will use ID:', participantId)
        const qrString = participantId
        
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
      const hasStationData = this.hasStationData()
      const hasHeightWeight = this.hasHeightWeightData()
      console.log("Participant Height Weight Data:", hasHeightWeight)
      const { completed: completedStations } = this.getStationSummary()
      const t = translations[language || 'en']

      // Station name translations
      const stationNames = {
        heightWeight: language === 'en' ? 'Height & Weight' : '身高体重',
        sitStand: language === 'en' ? 'Sit & Stand' : '坐立测试',
        armBanding: language === 'en' ? 'Arm Banding' : '臂力测试',
        marching: language === 'en' ? 'Marching in Place' : '原地踏步',
        sitReach: language === 'en' ? 'Sit & Reach' : '坐位体前屈',
        backStretch: language === 'en' ? 'Back Stretch' : '背部伸展',
        speedWalking: language === 'en' ? 'Speed Walking' : '快速步行',
        handGrip: language === 'en' ? 'Hand Grip' : '握力测试'
      }

      return (
        <div 
          className="swipe-view-fullscreen"
          onTouchStart={this.handleTouchStart}
          onTouchMove={this.handleTouchMove}
          onTouchEnd={this.handleTouchEnd}
          style={{
            minHeight: '100vh',
            backgroundColor: '#f5f5f5',
            position: 'relative'
          }}
        >
          {/* Emergency fallback if no participant */}
          {!participant && (
            <div style={{
              padding: '60px 20px 20px',
              textAlign: 'center',
              backgroundColor: '#fff3cd',
              margin: '10px',
              borderRadius: '5px',
              border: '1px solid #ffeaa7'
            }}>
              <h2>⚠️ No Participant Data</h2>
              <p>Participant information is missing. Please try submitting the form again.</p>
              <button 
                onClick={onClose}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '5px',
                  fontSize: '16px'
                }}
              >
                Go Back
              </button>
            </div>
          )}

          {/* Content area */}
          <div className="swipe-view-content" style={{ paddingTop: '50px' }}>
              {currentView === 'details' && participant && (
                <div>
                  <ParticipantDetails 
                    participant={participant} 
                    language={language} 
                    onClose={onClose}
                  />
                  
                  {/* Height & Weight Section */}
                  {hasHeightWeight && (
                    <div className="station-results-section">
                      <h2 className="section-title">{language === 'en' ? 'Physical Measurements' : '身体测量'}</h2>
                      
                      <div className="station-cards">
                        <div className="station-card height-weight-card">
                          <div className="station-header">
                            <h3 className="station-title">{stationNames.heightWeight}</h3>
                          </div>
                          
                          <div className="measurement-details">
                            <div className="measurement-item">
                              <span className="measurement-label">{language === 'en' ? 'Height:' : '身高:'}</span>
                              <span className="measurement-value">{participant.height}</span>
                            </div>
                            <div className="measurement-item">
                              <span className="measurement-label">{language === 'en' ? 'Weight:' : '体重:'}</span>
                              <span className="measurement-value">{participant.weight}</span>
                            </div>
                            {participant.bmi && (
                              <div className="measurement-item">
                                <span className="measurement-label">BMI:</span>
                                <span className="measurement-value">{participant.bmi}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className="station-badge-large completed">
                            {language === 'en' ? 'COMPLETED' : '已完成'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Station Test Results Section */}
                  {hasStationData && completedStations.length > 0 && (
                    <div className="station-results-section">
                      <h2 className="section-title">
                        {language === 'en' ? 'Test Station Results' : '测试站结果'}
                      </h2>
                      
                      {/* Station Cards */}
                      <div className="station-cards">
                        {completedStations.map((station, index) => (
                          <div key={`${station.name}-${index}`} className="station-card">
                            <div className="station-header">
                              <h3 className="station-title">{stationNames[station.name] || station.name}</h3>
                            </div>
                            
                            {/* Display station data */}
                            <div className="station-data">
                              {Object.entries(station.data || {}).map(([key, value]) => {
                                // Skip empty or meaningless values
                                if (!value || value === '' || value === '-' || 
                                    (typeof value === 'string' && value.trim().match(/^\s*(cm|kg|secs)\s*$/))) {
                                  return null
                                }
                                
                                // Format the key name for display
                                const displayKey = key
                                  .replace(/([A-Z])/g, ' $1')
                                  .replace(/^./, str => str.toUpperCase())
                                  .replace('Score1', language === 'en' ? 'Score 1' : '分数 1')
                                  .replace('Score2', language === 'en' ? 'Score 2' : '分数 2')
                                  .replace('LeftRight', language === 'en' ? 'Side' : '边')
                                  .replace('Remarks', language === 'en' ? 'Notes' : '备注')
                                
                                return (
                                  <div key={key} className="data-item">
                                    <span className="data-label">{displayKey}:</span>
                                    <span className="data-value">{value}</span>
                                  </div>
                                )
                              })}
                            </div>
                            
                            <div className="station-badge-large completed">
                              {language === 'en' ? 'COMPLETED' : '已完成'}
                            </div>
                            
                            <div className="station-timestamp">
                              {language === 'en' ? 'Updated just now' : '刚刚更新'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                </div>
              )}

              {currentView === 'qr' && participant && (
                <>                
                  <>
                    {qrCodeUrl ? (
                      <img 
                        src={qrCodeUrl} 
                        alt="Participant QR Code" 
                        className="qr-code-image"
                        style={{
                          maxWidth: '250px',
                          width: '100%',
                          height: 'auto',
                          border: '2px solid #ddd',
                          borderRadius: '10px'
                        }}
                      />
                    ) : (
                      <div style={{
                        padding: '40px',
                        backgroundColor: '#f0f0f0',
                        borderRadius: '10px',
                        color: '#666'
                      }}>
                        <div>🔄 Generating QR Code...</div>
                        <div style={{ fontSize: '12px', marginTop: '10px' }}>
                          Please wait while we create your QR code
                        </div>
                      </div>
                    )}
                  </>
                  
                  <div className="qr-modal-description">
                    <p>{t.qrCodeDescription}</p>
                  </div>
                  
                  <div className="swipe-instructions">
                    <p className="swipe-instructions-text">{t.swipeInstructionsDetails}</p>
                  </div>
                </>
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
