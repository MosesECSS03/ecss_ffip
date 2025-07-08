import React, { Component, useContext } from 'react'
import { translations } from '../utils/translations'
import LanguageContext from '../contexts/LanguageContext'
import './Pages.css'
import axios from "axios"
import QRCode from 'qrcode'
import ParticipantForm from './ParticipantForm'
import SwipeView from './SwipeView'
import { io } from 'socket.io-client'

const API_BASE_URL =
  window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://ecss-fft.azurewebsites.net';

console.log('🔧 API_BASE_URL configured as:', API_BASE_URL);
console.log('🌍 Current hostname:', window.location.hostname);

class Participants extends Component {
  constructor(props) {
    super(props)
    
    this.state = {
      formData: {
        participantDetails: {
          participantName: '',
          participantNric: '',
          gender: '',
          dateOfBirth: '',
          phoneNumber: ''
        },
        healthDeclaration: {
          questions: {
            healthQuestion1: '',
            healthQuestion2: '',
            healthQuestion3: '',
            healthQuestion4: ''
          }
        }
      },
      showForm: true,
      hasSubmitted: false,
      participants: [],
      qrCodeUrl: '',
      showQRCode: false,
      currentParticipantId: null,
      showTableQRCode: false,
      tableQRCodeUrl: '',
      tableQRParticipantId: null,
      showResults: false,
      selectedParticipantResults: null,
      showSwipeView: false,
      swipeParticipantData: null,
      submissionError: null
    }
  }

  componentDidMount() {
    // Add event listener for escape key
    document.addEventListener('keydown', this.handleEscapeKey);

    // Initialize socket.io for real-time updates
    this.initializeSocket();

    // Start with default state - no localStorage loading
    this.setState({ 
      participants: [],
      showForm: true,
      hasSubmitted: false
    });
  }

  componentWillUnmount() {
    // Remove event listener when component unmounts
    document.removeEventListener('keydown', this.handleEscapeKey);
    
    // Disconnect socket if it exists
    /*if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }*/
  }

  componentDidUpdate(prevProps, prevState) {
    // Re-establish socket connection if socket was lost
    if (!this.socket || this.socket.disconnected) {
      this.initializeSocket();
    }
    // No localStorage operations needed
  }

  // Extract socket initialization to a separate method to avoid duplication
  initializeSocket = () => {
    try {
      // Clean up existing socket if it exists
      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
      }

      console.log('Initializing socket connection to:', API_BASE_URL);
      this.socket = io(API_BASE_URL, {
        forceNew: true,
        transports: ['websocket', 'polling']
      });

      // Handle connection events
      this.socket.on('connect', () => {
        console.log('Socket connected successfully, ID:', this.socket.id);
      });

      this.socket.on('connect_error', (error) => {
        console.warn('Socket connection error:', error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
      });

      // Listen for participant-updated events
      this.socket.on('participant-updated', this.handleParticipantUpdate);
      
      // Add a test listener to verify socket is working
      this.socket.on('message', (data) => {
        console.log('Test message received:', data);
      });
    } catch (error) {
      console.error('Error initializing socket:', error);
      this.socket = null;
    }
  }

  // Extract participant update handler to avoid code duplication
  handleParticipantUpdate = (data) => {
    console.log('🔥 Socket event received - participant-updated:', data);
    if (data && data.participant) {
      console.log('📝 Updating participant data:', data.participant);
      
      this.setState((prevState) => {
        // Update participant in participants array
        const updatedParticipants = prevState.participants.map((p) => {
          const isMatch = p.id === data.participant.id || p._id === data.participant._id || 
                         p.id === data.participant._id || p._id === data.participant.id;
          if (isMatch) {
            console.log('✅ Found matching participant, updating:', p.id || p._id);
            return { ...p, ...data.participant };
          }
          return p;
        });
        
        // Update swipeParticipantData if it matches current participant
        let swipeParticipantData = prevState.swipeParticipantData;
        if (swipeParticipantData && 
            (swipeParticipantData.id === data.participant.id || 
             swipeParticipantData._id === data.participant._id ||
             swipeParticipantData.id === data.participant._id || 
             swipeParticipantData._id === data.participant.id)) {
          console.log('🔄 Updating swipe participant data');
          swipeParticipantData = { ...swipeParticipantData, ...data.participant };
        }
        
        return {
          participants: updatedParticipants,
          swipeParticipantData,
        };
      });
    } else {
      console.warn('⚠️ Invalid participant data received:', data);
    }
  }

  // Handle escape key press to close modals
  handleEscapeKey = (event) => {
    if (event.key === 'Escape') {
      const { showQRCode, showTableQRCode, showResults, showSwipeView } = this.state
      
      if (showQRCode) {
        this.closeQRCode()
      } else if (showTableQRCode) {
        this.closeTableQRCode()
      } else if (showResults) {
        this.closeResults()
      } else if (showSwipeView) {
        this.closeSwipeView()
      }
    }
  }

  // Generate QR code for participant ID
  generateQRCode = async (participantId) => {
    try {
      const qrCodeUrl = await QRCode.toDataURL(participantId)
      this.setState({ 
        qrCodeUrl,
        showQRCode: true,
        currentParticipantId: participantId
      })
    } catch (error) {
      console.error('Error generating QR code:', error)
    }
  }

  // Calculate age from date of birth
  calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return null
    const today = new Date()
    const birthDate = new Date(dateOfBirth)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    
    return age
  }

  handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    const nameParts = name.split('.')
    
    if (nameParts.length === 3) {
      // Handle nested structure like healthDeclaration.questions.healthQuestion1
      const [mainKey, subKey, fieldKey] = nameParts
      this.setState(prevState => ({
        formData: {
          ...prevState.formData,
          [mainKey]: {
            ...prevState.formData[mainKey],
            [subKey]: {
              ...prevState.formData[mainKey][subKey],
              [fieldKey]: type === 'checkbox' ? (checked ? value : '') : value
            }
          }
        }
      }))
    } else if (nameParts.length === 2) {
      // Handle two-level structure like participantDetails.participantName
      const [mainKey, subKey] = nameParts
      this.setState(prevState => ({
        formData: {
          ...prevState.formData,
          [mainKey]: {
            ...prevState.formData[mainKey],
            [subKey]: type === 'checkbox' ? checked : value
          }
        }
      }))
    } else {
      // Handle flat structure for backward compatibility
      this.setState(prevState => ({
        formData: {
          ...prevState.formData,
          [name]: type === 'checkbox' ? checked : value
        }
      }))
    }
  }

  handleSubmit = async (e) => {
    e.preventDefault()
    const { formData, participants } = this.state
    
    if (formData.participantDetails.participantName.trim() && 
        formData.participantDetails.participantNric.trim()) {
      const calculatedAge = this.calculateAge(formData.participantDetails.dateOfBirth)
      
      const newParticipant = {
        id: participants.length + 1,
        name: formData.participantDetails.participantName.trim(),
        program: 'FFT Health Declaration',
        status: 'Registered',
        nric: formData.participantDetails.participantNric,
        age: calculatedAge,
        gender: formData.participantDetails.gender,
        dateOfBirth: formData.participantDetails.dateOfBirth,
        phoneNumber: formData.participantDetails.phoneNumber,
        healthQuestions: formData.healthDeclaration,
        submittedAt: new Date().toISOString()
      }
      
      // Submit to backend first
      const backendResult = await this.submitToBackend(newParticipant)
      
      if (backendResult && backendResult.success) {
        console.log('Data successfully sent to backend')
        // Use the backend response ID for the participant
        if (backendResult.data && backendResult.data._id) {
          newParticipant.id = backendResult.data._id
        }
        
        // Only proceed if backend submission was successful
        const updatedParticipants = [...participants, newParticipant]
        
        this.setState(prevState => ({
          participants: updatedParticipants,
          submissionError: null,
          formData: {
            participantDetails: {
              participantName: '',
              participantNric: '',
              gender: '',
              dateOfBirth: '',
              phoneNumber: ''
            },
            healthDeclaration: {
              questions: {
                healthQuestion1: '',
                healthQuestion2: '',
                healthQuestion3: '',
                healthQuestion4: ''
              }
            }
          },
          showForm: false,
          hasSubmitted: true
        }), () => {
          // Show swipe view with the new participant after state is updated
          this.showSwipeView(newParticipant.id)
        })
      } else {
        console.log('Backend submission failed, staying on form')
        // Stay on the form - don't proceed to next screen
        this.setState({ 
          submissionError: backendResult.error || 'Submission failed. Please try again.' 
        })
      }
    }
  }

  showFormAgain = () => {
    this.setState({
      showForm: true,
      showQRCode: false,
      qrCodeUrl: '',
      currentParticipantId: null,
      showTableQRCode: false,
      tableQRCodeUrl: '',
      tableQRParticipantId: null,
      showResults: false,
      selectedParticipantResults: null,
      showSwipeView: false,
      swipeParticipantData: null,
      submissionError: null,
      formData: {
        participantDetails: {
          participantName: '',
          participantNric: '',
          gender: '',
          dateOfBirth: '',
          phoneNumber: ''
        },
        healthDeclaration: {
          questions: {
            healthQuestion1: '',
            healthQuestion2: '',
            healthQuestion3: '',
            healthQuestion4: ''
          }
        }
      }
    })
  }

  getStatusColor = (status) => {
    switch(status) {
      case 'Active': return '#4CAF50'
      case 'Completed': return '#2196F3'
      case 'Pending': return '#FF9800'
      default: return '#757575'
    }
  }

  getStatusText = (status) => {
    const { language } = this.props
    const t = translations[language]
    switch(status) {
      case 'Active': return t.active
      case 'Completed': return t.completed
      case 'Pending': return t.pending
      default: return status
    }
  }

  // Function to submit form data to backend
  submitToBackend = async (participantData) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/participants`, {"purpose": "new", participantData})
      console.log('Response from backend:', response.data)
      
      // Handle the backend response structure
      if (response.data && response.data.success) {
        return { 
          success: true, 
          data: response.data.data // Backend returns { success: true, data: {...} }
        }
      } else {
        return { 
          success: false, 
          error: response.data?.message || 'Unknown error' 
        }
      }
    } catch (error) {
      console.error('Error submitting participant data:', error)
      return { success: false, error: error.message }
    }
  }

  closeQRCode = () => {
    this.setState({ 
      showQRCode: false,
      qrCodeUrl: '',
      currentParticipantId: null,
      showForm: false,
      hasSubmitted: true
    })
  }

  // Generate QR code for existing participant in table
  showParticipantQRCode = async (participantId) => {
    try {
      const qrCodeUrl = await QRCode.toDataURL(participantId.toString())
      this.setState({ 
        showTableQRCode: true,
        tableQRCodeUrl: qrCodeUrl,
        tableQRParticipantId: participantId
      })
    } catch (error) {
      console.error('Error generating QR code for participant:', error)
    }
  }

  closeTableQRCode = () => {
    this.setState({ 
      showTableQRCode: false,
      tableQRCodeUrl: '',
      tableQRParticipantId: null
    })
  }

  // Show participant results (current and station results)
  showParticipantResults = async (participantId) => {
    try {
      // In a real implementation, you would fetch results from the backend
      // For now, we'll show mock data
      const mockResults = {
        participantId: participantId,
        currentResults: {
          bloodPressure: '120/80',
          heartRate: '75 bpm',
          weight: '65 kg',
          height: '170 cm',
          bmi: '22.5',
          lastUpdated: new Date().toLocaleString()
        },
        stationResults: [
          { station: 'Station 1 - Flexibility', score: '8/10', status: 'Completed', timestamp: '2025-01-08 10:30 AM' },
          { station: 'Station 2 - Strength', score: '7/10', status: 'Completed', timestamp: '2025-01-08 10:45 AM' },
          { station: 'Station 3 - Cardio', score: 'In Progress', status: 'In Progress', timestamp: '2025-01-08 11:00 AM' },
          { station: 'Station 4 - Balance', score: 'Pending', status: 'Pending', timestamp: '-' }
        ]
      }
      
      this.setState({ 
        showResults: true,
        selectedParticipantResults: mockResults
      })
    } catch (error) {
      console.error('Error fetching participant results:', error)
    }
  }

  closeResults = () => {
    this.setState({ 
      showResults: false,
      selectedParticipantResults: null
    })
  }

  // Show swipe view with participant details
  showSwipeView = (participantId) => {
    // Find the participant data
    const participant = this.state.participants.find(p => p.id === participantId)
    
    this.setState({
      showSwipeView: true,
      swipeParticipantData: participant
    })
  }

  // Close swipe view
  closeSwipeView = () => {
    this.setState({
      showSwipeView: false,
      swipeParticipantData: null
    })
  }

  // Clear all data (useful for testing or reset functionality)
  clearAllData = () => {
    this.setState({
      participants: [],
      showForm: true,
      hasSubmitted: false,
      showSwipeView: false,
      swipeParticipantData: null,
      submissionError: null
    });
    console.log('🗑️ Cleared all participant data');
  }

  // Manual refresh from backend (if needed)
  refreshFromBackend = async () => {
    try {
      // In a real implementation, you would fetch participants from backend
      console.log('🔄 Refreshing from backend...');
      // Reset to default state
      this.setState({
        participants: [],
        showForm: true,
        hasSubmitted: false
      });
    } catch (error) {
      console.error('Error refreshing from backend:', error);
    }
  }

  render() {
    const { language } = this.props
    const t = translations[language]
    const { formData, showForm, participants, showQRCode, qrCodeUrl, currentParticipantId, showTableQRCode, tableQRCodeUrl, tableQRParticipantId, showResults, selectedParticipantResults, showSwipeView, swipeParticipantData, submissionError } = this.state

    // Show Results modal
    if (showResults && selectedParticipantResults) {
      return (
        <div className="page-container senior-friendly-page">
            <div className="results-modal">
              <h2 className="results-modal-title">Participant Results</h2>
              
              <div className="results-section">
                <h3 className="results-section-title">Current Health Status</h3>
                <div className="results-grid">
                  <div className="result-item">
                    <span className="result-label">Blood Pressure:</span>
                    <span className="result-value">{selectedParticipantResults.currentResults.bloodPressure}</span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">Heart Rate:</span>
                    <span className="result-value">{selectedParticipantResults.currentResults.heartRate}</span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">Weight:</span>
                    <span className="result-value">{selectedParticipantResults.currentResults.weight}</span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">Height:</span>
                    <span className="result-value">{selectedParticipantResults.currentResults.height}</span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">BMI:</span>
                    <span className="result-value">{selectedParticipantResults.currentResults.bmi}</span>
                  </div>
                </div>
              </div>

              <div className="results-section">
                <h3 className="results-section-title">Station Results</h3>
                <div className="station-results-table">
                  <table className="results-table">
                    <thead>
                      <tr>
                        <th>Station</th>
                        <th>Score</th>
                        <th>Status</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedParticipantResults.stationResults.map((result, index) => (
                        <tr key={index}>
                          <td>{result.station}</td>
                          <td>{result.score}</td>
                          <td>
                            <span className={`status-badge ${result.status.toLowerCase().replace(' ', '-')}`}>
                              {result.status}
                            </span>
                          </td>
                          <td>{result.timestamp}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="results-modal-actions">
                <button onClick={this.closeResults} className="senior-submit-btn">
                  Close
                </button>
              </div>
            </div>
        </div>
      )
    }

    // Show QR Code modal for table participant
    if (showTableQRCode && tableQRCodeUrl) {
      return (
        <div className="qr-modal-overlay" onClick={this.closeTableQRCode}>
          <div onClick={(e) => e.stopPropagation()}>
            <button className="qr-modal-close" onClick={this.closeTableQRCode}>
              ×
            </button>
            <h2 className="qr-modal-title">Participant QR Code</h2>
            <p className="qr-modal-subtitle">Present this QR code to the station master</p>
            <div className="qr-code-container">
              <img src={tableQRCodeUrl} alt="QR Code" className="qr-code-image" />
            </div>
            <p className="qr-modal-description">
              Station master will scan this code need to key in.
            </p>
            <div className="qr-modal-actions">
              <button onClick={this.closeTableQRCode} className="senior-submit-btn">
                Close
              </button>
            </div>
          </div>
        </div>
      )
    }

    // Show QR Code modal if QR code is generated
    if (showQRCode && qrCodeUrl) {
      return (
        <div className="qr-modal-overlay" onClick={this.closeQRCode}>
          <div onClick={(e) => e.stopPropagation()}>
            <button className="qr-modal-close" onClick={this.closeQRCode}>
              ×
            </button>
            <h2 className="qr-modal-title">Registration Successful!</h2>
            <p className="qr-modal-subtitle">Present this QR code to the station master</p>
            <div className="qr-code-container">
              <img src={qrCodeUrl} alt="QR Code" className="qr-code-image" />
            </div>
            <p className="qr-modal-description">
              Station master will scan this code to record your fitness test results
            </p>
          </div>
        </div>
      )
    }

    if (showForm) {
      return (
        <ParticipantForm
          formData={formData}
          language={language}
          onInputChange={this.handleInputChange}
          onSubmit={this.handleSubmit}
          submissionError={submissionError}
        />
      )
    }

    // Show swipe view if enabled or if there are participants and not showing form
    if (showSwipeView && swipeParticipantData) {
      return (
        <SwipeView
          participant={swipeParticipantData}
          language={language}
          onClose={this.closeSwipeView}
        />
      )
    }

    // If no participants and not showing form, show form by default
    if (participants.length === 0 && !showForm) {
      return (
        <ParticipantForm
          formData={formData}
          language={language}
          onInputChange={this.handleInputChange}
          onSubmit={this.handleSubmit}
          submissionError={submissionError}
        />
      )
    }

    return (
      <div className="page-container senior-friendly-page">
        <div className="senior-results-wrapper">
          <h1 className="senior-title">{t.participantsTitle}</h1>
        </div>
      </div>
    )
  }
}

// Functional wrapper component for Fast Refresh compatibility
const ParticipantsWrapper = (props) => {
  const { language } = useContext(LanguageContext);
  return <Participants {...props} language={language} />;
};

export default ParticipantsWrapper;
