import React, { Component } from 'react';
import QRCode from 'qrcode';
import axios from 'axios';
import ParticipantDetails from './ParticipantDetails';
import { translations } from '../../utils/translations';
import '../Pages.css';
import { io } from 'socket.io-client';


  const API_BASE_URL =
    window.location.hostname === 'localhost'
      ? 'http://localhost:3001'
      : 'https://ecss-fft.azurewebsites.net';


  class SwipeView extends Component {
    constructor(props) {
      super(props)
      this.state = {
        currentView: 'details', // Start with details view
        qrCodeUrl: '',
        touchStart: 0,
        touchEnd: 0,
        updatedParticipant: null,
        isGeneratingQR: true, // Track QR generation state
        showLoadingPopup: true // Show loading popup initially
      }
    }

  componentDidMount = async () => {
    const { participant } = this.props;
    console.log("🔄 SwipeView mounted with participant:", participant);
    const participantId = participant?.id;
    
    // Generate QR code in parallel (don't wait for it)
    this.generateQR(participantId); // Remove await here
    
    // Use participantId for data retrieval here
    if (participantId) {
      // You can add your data retrieval logic here
      this.retrieveParticipantData(participantId);
    }
    
    document.addEventListener('keydown', this.handleKeyDown);
      
      // --- SOCKET.IO ---
      this.socket = io(API_BASE_URL);

      // Listen for participant updates and refresh data live
      this.socket.on('participant-updated', (data) => {
        try {
          console.log("🔔 Socket event received", data);
          console.log("🔄 Triggering handleParticipantUpdate...");
          
          //6894da46a97f6e2e8660811e
          //6894da46a97f6e2e8660811e 
          console.log("Current participant ID:", participantId, typeof participantId);
          console.log("Event participant ID:", data.participantID, typeof data.participantID);
          console.log("Participant ID Matches:", participantId === data.participantID);
          
          // Update only if it matches current participant and user doesn't have form data
          if (participantId === data.participantID) {
            console.log("✅ Event matches current participant");
            this.handleParticipantUpdate(participantId);
            //this.retrieveParticipantData(participantId);
          } else {
            console.log("ℹ️ Event for different participant, ignoring update");
          }
        } catch (socketEventError) {
          console.error('❌ Error handling socket event:', socketEventError);
        }
      })
    }

    componentWillUnmount() {
      document.removeEventListener('keydown', this.handleKeyDown)
      if (this.socket) {
        this.socket.disconnect();
      }
    }

    // Handle component updates for automatic QR code generation
    componentDidUpdate(prevProps, prevState) {
      const { participant } = this.props;
      const prevParticipant = prevProps.participant;
      
      // Check if participant ID changed and we don't have a QR code yet
      if (participant?.id !== prevParticipant?.id && participant?.id) {
        console.log('🔄 Participant changed, auto-generating QR code for:', participant.id);
        this.setState({ 
          showLoadingPopup: true,
          isGeneratingQR: true,
          qrCodeUrl: '' 
        });
        this.generateQR(participant.id);
        return;
      }
      
      // For same participant ID: Check if QR generation failed or is missing
      if (participant?.id && participant.id === prevParticipant?.id) {
        // If QR generation finished but no QR code was produced (failed generation)
        if (prevState.isGeneratingQR && !this.state.isGeneratingQR && !this.state.qrCodeUrl) {
          console.log('🔄 QR generation failed, auto-retrying for participant:', participant.id);
          setTimeout(() => {
            this.setState({ 
              showLoadingPopup: true,
              isGeneratingQR: true 
            });
            this.generateQR(participant.id);
          }, 1000);
          return;
        }
        
        // If we have a participant but no QR code and not currently generating
        if (!this.state.qrCodeUrl && !this.state.isGeneratingQR) {
          console.log('🔄 Missing QR code, auto-generating for participant:', participant.id);
          this.setState({ 
            showLoadingPopup: true,
            isGeneratingQR: true 
          });
          this.generateQR(participant.id);
          return;
        }
      }
      
      // Handle updated participant data from socket events
      if (this.state.updatedParticipant && 
          this.state.updatedParticipant !== prevState.updatedParticipant &&
          this.state.updatedParticipant.id && 
          !this.state.qrCodeUrl && 
          !this.state.isGeneratingQR) {
        console.log('🔄 Updated participant data received, auto-generating QR for:', this.state.updatedParticipant.id);
        this.setState({ 
          showLoadingPopup: true,
          isGeneratingQR: true 
        });
        this.generateQR(this.state.updatedParticipant.id);
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
          console.log('okkkkk:', response.data.data);
          // You can update state with the retrieved data if needed
          this.setState({ updatedParticipant: response.data.data });
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

    // Helper method to get current participant data (updated or original)
    getCurrentParticipant = () => {
      const { updatedParticipant } = this.state;
      const { participant } = this.props;
      // Use updated data if available, otherwise fall back to props
      return updatedParticipant || participant;
    }

    // Helper method to get current participant ID
    getCurrentParticipantId = () => {
      const participant = this.getCurrentParticipant();
      return participant?.id;
    }

    // Check if user has filled form data (to avoid overriding their input)
    hasFilledFormData = () => {
      // This should return true if the user is currently filling out forms
      // For now, returning false to allow updates - you can customize this logic
      return false;
    }

    // Handle participant update from socket event
    handleParticipantUpdate = async (participantId) => {
      if (participantId) {
        console.log("🔄 Updating participant data from socket event");
        await this.retrieveParticipantData(participantId);
      }
    }

    // Check if participant has any station data
    hasStationData = () => {
      const participant = this.getCurrentParticipant()
      return participant.stations && 
        Array.isArray(participant.stations) &&
        participant.stations.length > 0
    }

    // Check if participant has height and weight data
    hasHeightWeightData = () => {
      const participant = this.getCurrentParticipant()
      console.log("Checking Height and Weight Data:", participant)
      return participant.height && participant.weight && 
            participant.height !== '' && participant.weight !== '' &&
            participant.height !== '-' && participant.weight !== '-'
    }

    // Get station summary from the stations array
    getStationSummary = () => {
      const participant = this.getCurrentParticipant()
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
    generateQR = async (participantId) => {
      try {
        console.log('🔄 Generating QR Code for participant ID:', participantId)
        
        // Check if participantId is valid
        if (!participantId) {
          console.error('❌ No participant ID provided for QR generation')
          this.setState({ 
            qrCodeUrl: '',
            isGeneratingQR: false,
            showLoadingPopup: false 
          })
          return
        }
        
        this.setState({ isGeneratingQR: true, showLoadingPopup: true })
        
        const qrString = String(participantId) // Ensure it's a string
        console.log('📝 QR String to encode:', qrString)
        
        const qrUrl = await QRCode.toDataURL(qrString, {
          width: 400,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        })
        
        console.log('✅ QR code generated successfully, length:', qrUrl.length)
        this.setState({ 
          qrCodeUrl: qrUrl,
          isGeneratingQR: false,
          showLoadingPopup: false // Hide loading popup when done
        }, () => {
          console.log('📱 QR code state updated - URL exists:', !!this.state.qrCodeUrl)
          console.log('📱 Is generating:', this.state.isGeneratingQR)
        })
      } catch (error) {
        console.error('❌ Error generating QR code:', error)
        this.setState({ 
          qrCodeUrl: '',
          isGeneratingQR: false,
          showLoadingPopup: false 
        })
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
      const { language, onClose } = this.props
      const { currentView, qrCodeUrl, isGeneratingQR } = this.state
      const participant = this.getCurrentParticipant()
      const hasStationData = this.hasStationData()
      const hasHeightWeight = this.hasHeightWeightData()
      
      // Debug logging
      console.log('🎨 SwipeView render - Current state:', {
        currentView,
        hasQrCodeUrl: !!qrCodeUrl,
        isGeneratingQR,
        participantId: participant?.id
      })
      
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
          <div className="swipe-view-content" style={{ paddingTop: '20px' }}>
              {currentView === 'details' && participant && (
                <div>
                  <ParticipantDetails 
                    participant={participant} 
                    language={language} 
                    onClose={onClose}
                  />
                </div>
              )}

              {currentView === 'qr' && participant && (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '20px',
                  backgroundColor: 'white',
                  margin: '10px',
                  borderRadius: '15px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                  <h2 style={{ 
                    color: '#28a745', 
                    marginBottom: '20px',
                    fontSize: '24px',
                    fontWeight: 'bold'
                  }}>
                    🎉 Registration Successful!
                  </h2>
                  
                  <p style={{ 
                    color: '#666', 
                    marginBottom: '30px',
                    fontSize: '16px'
                  }}>
                    {language === 'en' 
                      ? 'Present this QR code to the station master' 
                      : '向站长出示此二维码'
                    }
                  </p>
                  
                  {qrCodeUrl && !isGeneratingQR ? (
                    <div style={{ marginBottom: '20px' }}>
                      <img 
                        src={qrCodeUrl} 
                        alt="Participant QR Code" 
                        className="qr-code-image"
                        style={{
                          maxWidth: '300px',
                          width: '100%',
                          height: 'auto',
                          border: '3px solid #28a745',
                          borderRadius: '15px',
                          padding: '10px',
                          backgroundColor: 'white',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}
                      />
                      <div style={{
                        marginTop: '10px',
                        padding: '5px 15px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        borderRadius: '20px',
                        display: 'inline-block',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        ✅ READY
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      padding: '40px',
                      backgroundColor: '#f8f9fa',
                      borderRadius: '15px',
                      color: '#666',
                      marginBottom: '20px'
                    }}>
                      <div style={{ fontSize: '48px', marginBottom: '10px' }}>🔄</div>
                      <div style={{ fontSize: '18px', fontWeight: 'bold' }}>Creating Your QR Code</div>
                      <div style={{ fontSize: '14px', marginTop: '10px' }}>
                        {language === 'en' 
                          ? 'Preparing your unique participant identifier...' 
                          : '正在准备您的专属参与者标识...'
                        }
                      </div>
                    </div>
                  )}

                                    
                  {/* Station Progress Checklist */}
                  <div style={{
                    marginBottom: '15px',
                    padding: '15px',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    border: '1px solid #e9ecef'
                  }}>
                    <div style={{
                      fontSize: 'clamp(12px, 3.5vw, 14px)',
                      color: '#495057',
                      marginBottom: '12px',
                      fontWeight: '600',
                      textAlign: 'center'
                    }}>
                      {language === 'en' ? 'Station Progress Overview' : '测试站进度总览'}
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 'clamp(6px, 2vw, 10px)',
                      justifyContent: 'center',
                      alignItems: 'center',
                      maxWidth: '100%',
                      padding: '0 5px'
                    }}>
                      {/* Height & Weight */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        fontSize: 'clamp(10px, 2.5vw, 12px)',
                        color: hasHeightWeight ? '#28a745' : '#6c757d',
                        backgroundColor: hasHeightWeight ? '#e8f5e8' : '#f8f9fa',
                        padding: 'clamp(4px, 1.5vw, 6px) clamp(8px, 3vw, 12px)',
                        borderRadius: '15px',
                        border: `1px solid ${hasHeightWeight ? '#28a745' : '#dee2e6'}`,
                        minWidth: 'fit-content',
                        maxWidth: '100%',
                        textAlign: 'center'
                      }}>
                        <span style={{ marginRight: '6px', fontSize: 'clamp(12px, 3vw, 14px)' }}>
                          {hasHeightWeight ? '✅' : '⬜'}
                        </span>
                        <span style={{ 
                          whiteSpace: 'nowrap', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          maxWidth: '120px' 
                        }}>
                          {language === 'en' ? 'Height & Weight' : '身高体重'}
                        </span>
                      </div>
                      
                      {/* Station Tests */}
                      {Object.keys(stationNames).filter(key => key !== 'heightWeight').map((stationKey) => {
                        const isCompleted = completedStations.some(station => station.name === stationKey);
                        return (
                          <div key={stationKey} style={{
                            display: 'flex',
                            alignItems: 'center',
                            fontSize: 'clamp(10px, 2.5vw, 12px)',
                            color: isCompleted ? '#28a745' : '#6c757d',
                            backgroundColor: isCompleted ? '#e8f5e8' : '#f8f9fa',
                            padding: 'clamp(4px, 1.5vw, 6px) clamp(8px, 3vw, 12px)',
                            borderRadius: '15px',
                            border: `1px solid ${isCompleted ? '#28a745' : '#dee2e6'}`,
                            minWidth: 'fit-content',
                            maxWidth: '100%',
                            textAlign: 'center'
                          }}>
                            <span style={{ marginRight: '6px', fontSize: 'clamp(12px, 3vw, 14px)' }}>
                              {isCompleted ? '✅' : '⬜'}
                            </span>
                            <span style={{ 
                              whiteSpace: 'nowrap', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis',
                              maxWidth: '120px' 
                            }}>
                              {stationNames[stationKey]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  <div style={{ 
                    color: '#666', 
                    fontSize: '14px',
                    lineHeight: '1.5',
                    marginBottom: '20px'
                  }}>
                    <p>
                      {language === 'en' 
                        ? '📱 Station master will scan this QR code to access your participant information and record test results.'
                        : '📱 站长将扫描此二维码以访问您的参与者信息并记录测试结果。'
                      }
                    </p>
                  </div>
                  
                  <div style={{ 
                    color: '#888', 
                    fontSize: '12px',
                    fontStyle: 'italic'
                  }}>
                    {t.swipeInstructions}
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
            
            {/* Loading Popup for QR Generation */}
            {this.state.showLoadingPopup && (
              <div className="loading-popup-overlay">
                <div className="loading-popup">
                  <div className="loading-spinner"></div>
                  <div className="loading-text">
                    <h3>🔄 Creating Your QR Code</h3>
                    <p>Preparing your unique participant identifier...</p>
                  </div>
                </div>
              </div>
            )}
          </div>
      )
    }
  }

export default SwipeView
