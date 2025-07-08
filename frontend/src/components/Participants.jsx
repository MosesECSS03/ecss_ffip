import React, { Component, useContext } from 'react'
import { translations } from '../utils/translations'
import LanguageContext from '../contexts/LanguageContext'
import './Pages.css'
import axios from "axios"
import QRCode from 'qrcode'
import ParticipantForm from './ParticipantForm'
import SwipeView from './SwipeView'
import { io } from 'socket.io-client' // Uncommented import for socket.io-client

// If you need to use socket.io-client, import as needed below or in the relevant method/component.

const API_BASE_URL =
  window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://ecss-fft.azurewebsites.net';


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
    this.socket = null;
  }

  componentDidMount = async () => {
    // --- SOCKET.IO ---
    this.socket = io(API_BASE_URL);

    this.socket.on('participant-updated', () => {
      this.handleParticipantUpdate();
    });

    // Show form by default until we verify participant
    this.setState({
      showForm: true,
      hasSubmitted: false,
      showSwipeView: false,
      swipeParticipantData: null
    });
  }

  handleParticipantUpdate = async () => {
    let participantId = null;

    try {
      const saved = localStorage.getItem('participantId');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.participantId) {
          participantId = parsed.participantId;
        }
      }
    } catch (e) {
      console.warn('Failed to parse participantId from localStorage:', e);
    }

    if (participantId) {
      try {
        const response = await axios.post(`${API_BASE_URL}/participants`, {
          purpose: 'retrieveParticipant',
          participantID: participantId
        });

        console.log('🔄 Retrieved participant from backend:', response.data);

        if (response.data && response.data.success && response.data.data) {
          this.setState({
            participants: [response.data.data],
            showForm: false,
            hasSubmitted: true,
            showSwipeView: true,
            swipeParticipantData: response.data.data
          });
          return;
        }
      } catch (err) {
        console.error('Error retrieving participant from backend:', err);
      }
    }

    // If no participant or failed fetch, show form
    this.setState({
      showForm: true,
      hasSubmitted: false,
      showSwipeView: false,
      swipeParticipantData: null
    });
  }

  componentWillUnmount() {
    if (this.socket) {
      this.socket.disconnect()
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

  // Format date to dd/mm/yyyy
  formatDateToDDMMYYYY = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
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
        dateOfBirth: this.formatDateToDDMMYYYY(formData.participantDetails.dateOfBirth),
        phoneNumber: formData.participantDetails.phoneNumber,
        healthQuestions: formData.healthDeclaration,
        submittedAt: new Date().toISOString()
      }
      
      // Submit to backend first
      const backendResult = await this.submitToBackend(newParticipant)
      
      if (backendResult && backendResult.success) {
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
          // After successful submit, store only the latest participant ID in localStorage
          localStorage.setItem('participantId', JSON.stringify({ participantId: newParticipant.id }))
          // Show swipe view with the new participant after state is updated
          this.showSwipeView(newParticipant.id)
        })
      } else {
        // Stay on the form - don't proceed to next screen
        this.setState({ 
          submissionError: backendResult.error || 'Submission failed. Please try again.' 
        })
      }
    }
  }

  // Function to submit form data to backend
  submitToBackend = async (participantData) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/participants`, {"purpose": "new", participantData})
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

  // Ensure showSwipeView is an arrow function to preserve 'this' context
  showSwipeView = (participantId) => {
    const participant = this.state.participants.find(p => p.id === participantId)
    this.setState({
      showSwipeView: true,
      swipeParticipantData: participant
    })
  }

  // If loadStateFromLocalStorage is referenced anywhere, define it as a no-op to avoid errors
  loadStateFromLocalStorage = () => {}

  render() {
    const { language } = this.props
    const t = translations[language]
    const { formData, showForm, participants, showQRCode, qrCodeUrl, currentParticipantId, showTableQRCode, tableQRCodeUrl, tableQRParticipantId, showResults, selectedParticipantResults, showSwipeView, swipeParticipantData, submissionError } = this.state

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

/*
Retrieve participants from backend (example: retrieve all, or retrieve a specific one by ID)
    // this.retrieveParticipants() // For all participants
    // this.retrieveParticipant('PARTICIPANT_ID_HERE') // For a specific participant by ID
*/
