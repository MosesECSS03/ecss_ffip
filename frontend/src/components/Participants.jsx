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
      submissionError: null,
      dataStatusMessage: '' // For showing save/load notifications
    }
    this.socket = null;
  }
  
  // Add method to save state to localStorage
  saveStateToLocalStorage = () => {
    try {
      const stateToSave = {
        participants: this.state.participants,
        selectedLanguage: this.state.selectedLanguage,
        currentStep: this.state.currentStep,
        formData: this.state.formData,
        currentParticipantIndex: this.state.currentParticipantIndex,
        lastUpdated: Date.now()
      };
      localStorage.setItem('participantsAppState', JSON.stringify(stateToSave));
      console.log('💾 State saved to localStorage');
      
      // Show brief notification
      this.setState({ dataStatusMessage: '💾 Data saved' });
      setTimeout(() => {
        this.setState({ dataStatusMessage: '' });
      }, 2000);
    } catch (error) {
      console.error('❌ Error saving state to localStorage:', error);
      this.setState({ dataStatusMessage: '❌ Failed to save data' });
      setTimeout(() => {
        this.setState({ dataStatusMessage: '' });
      }, 3000);
    }
  }

  // Add method to load state from localStorage
  loadStateFromLocalStorage = () => {
    try {
      const savedState = localStorage.getItem('participantsAppState');
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        
        // Check if the saved state is not too old (e.g., 24 hours)
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        const age = Date.now() - (parsedState.lastUpdated || 0);
        
        if (age < maxAge) {
          this.setState({
            participants: parsedState.participants || [],
            selectedLanguage: parsedState.selectedLanguage || 'english',
            currentStep: parsedState.currentStep || 1,
            formData: parsedState.formData || {},
            currentParticipantIndex: parsedState.currentParticipantIndex || 0,
            dataStatusMessage: '🔄 Data restored from previous session'
          });
          console.log('🔄 State restored from localStorage');
          
          // Clear the notification after 3 seconds
          setTimeout(() => {
            this.setState({ dataStatusMessage: '' });
          }, 3000);
        } else {
          console.log('⏰ Saved state is too old, starting fresh');
          localStorage.removeItem('participantsAppState');
        }
      }
    } catch (error) {
      console.error('❌ Error loading state from localStorage:', error);
      // If there's an error, clear the corrupted data
      localStorage.removeItem('participantsAppState');
      this.setState({ dataStatusMessage: '❌ Failed to restore previous data' });
      setTimeout(() => {
        this.setState({ dataStatusMessage: '' });
      }, 3000);
    }
  }

  // Add method to clear saved state
  clearSavedState = () => {
    localStorage.removeItem('participantsAppState');
    console.log('🗑️ Saved state cleared from localStorage');
    this.setState({ 
      dataStatusMessage: '🗑️ Saved data cleared successfully' 
    });
    setTimeout(() => {
      this.setState({ dataStatusMessage: '' });
    }, 2000);
  }

  componentDidMount = async () => {
    try {
      console.log('🔌 Connecting to Socket.IO at:', API_BASE_URL);
      
      // Load saved state first
      this.loadStateFromLocalStorage();
      
      // --- SOCKET.IO ---
      this.socket = io(API_BASE_URL);

      // Add connection event listeners for debugging
      this.socket.on('connect', () => {
        console.log('✅ Socket connected to server with ID:', this.socket.id);
      });

      this.socket.on('disconnect', () => {
        console.log('❌ Socket disconnected from server');
      });

      this.socket.on('connect_error', (error) => {
        console.error('🚫 Socket connection error:', error);
      });

      // Listen for participant updates and refresh data live
      this.socket.on('participant-updated', (data) => {
        try {
          console.log("🔔 Socket event received", data);
          console.log("🔄 Triggering handleParticipantUpdate...");
          
          // Check if this event is for the current participant to avoid unnecessary updates
          const currentParticipantId = this.getCurrentParticipantId();
          console.log("Current participant ID:", currentParticipantId);
          console.log("Event participant ID:", data.participantID);
          
          // Update regardless, but log if it's for the current participant
          if (currentParticipantId === data.participantID) {
            console.log("✅ Event matches current participant - updating UI");
          } else {
            console.log("ℹ️ Event for different participant, but updating anyway");
          }
          
          // Call handleParticipantUpdate - this will refresh the data from backend
          this.handleParticipantUpdate();
        } catch (socketEventError) {
          console.error('❌ Error handling socket event:', socketEventError);
        }
      });

      // Initial load of participant data
      await this.handleParticipantUpdate();
      
    } catch (mountError) {
      console.error('❌ Error in componentDidMount:', mountError);
      // Set error state to show user-friendly message
      this.setState({ 
        submissionError: 'Failed to initialize connection. Please refresh the page.' 
      });
    }
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
            swipeParticipantData: response.data.data,
            submissionError: null
          }, () => {
            // Save state after successful participant update
            this.saveStateToLocalStorage();
          });
          return;
        }
      } catch (err) {
        console.error('Error retrieving participant from backend:', err);
        // Clear any existing error when retrieval fails
        this.setState({ submissionError: 'Failed to retrieve participant. Please try again.' });
      }
    }

    // If no participant or failed fetch, show form
    this.setState({
      showForm: true,
      hasSubmitted: false,
      showSwipeView: false,
      swipeParticipantData: null,
      submissionError: null
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
      if (!participantId) {
        console.error('No participant ID provided for QR code generation');
        return;
      }
      
      console.log('Generating QR code for participant ID:', participantId);
      
      const qrCodeUrl = await QRCode.toDataURL(participantId.toString(), {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });
      
      this.setState({ 
        qrCodeUrl,
        showQRCode: true,
        currentParticipantId: participantId
      });
      
      console.log('QR code generated successfully');
    } catch (error) {
      console.error('Error generating QR code:', error);
      this.setState({
        submissionError: 'Failed to generate QR code. Please try again.'
      });
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
      }), () => {
        // Save state after input change
        this.saveStateToLocalStorage();
      })
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
      }), () => {
        // Save state after input change
        this.saveStateToLocalStorage();
      })
    } else {
      // Handle flat structure for backward compatibility
      this.setState(prevState => ({
        formData: {
          ...prevState.formData,
          [name]: type === 'checkbox' ? checked : value
        }
      }), () => {
        // Save state after input change
        this.saveStateToLocalStorage();
      })
    }
  }

  handleSubmit = async (e) => {
    e.preventDefault();
    const { formData, participants } = this.state;

    if (formData.participantDetails.participantName.trim() && 
        formData.participantDetails.participantNric.trim()) {
      const calculatedAge = this.calculateAge(formData.participantDetails.dateOfBirth);

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
      };

      // Submit to backend first
      const backendResult = await this.submitToBackend(newParticipant);

      if (backendResult && backendResult.success) {
        // Use the backend response ID for the participant
        let backendId = backendResult.data && (backendResult.data._id || backendResult.data.id);
        if (backendId) {
          newParticipant.id = backendId;
        }
        // Only proceed if backend submission was successful
        const updatedParticipants = [...participants, newParticipant];

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
          // After successful submit, store only the backend _id as participantId in localStorage
          if (backendId) {
            localStorage.setItem('participantId', JSON.stringify({ participantId: backendId }));
            console.log('Stored participantId in localStorage:', backendId);
          }
          // Save complete state to localStorage
          this.saveStateToLocalStorage();
          // Show swipe view with the new participant after state is updated
          this.showSwipeView(newParticipant.id);
        });
      } else {
        // Stay on the form - don't proceed to next screen
        this.setState({ 
          submissionError: backendResult.error || 'Submission failed. Please try again.' 
        });
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

  // Add the missing getCurrentParticipantId method
  getCurrentParticipantId = () => {
    try {
      const saved = localStorage.getItem('participantId');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.participantId;
      }
    } catch (e) {
      console.warn('Failed to parse participantId from localStorage:', e);
    }
    return null;
  }

  // Add missing QR code close methods
  closeQRCode = () => {
    this.setState({
      showQRCode: false,
      qrCodeUrl: '',
      currentParticipantId: null
    });
  }

  closeTableQRCode = () => {
    this.setState({
      showTableQRCode: false,
      tableQRCodeUrl: '',
      tableQRParticipantId: null
    });
  }

  // Add missing close swipe view method
  closeSwipeView = () => {
    this.setState({
      showSwipeView: false,
      swipeParticipantData: null
    });
  }

  // Generate QR code for table participant
  generateTableQRCode = async (participantId) => {
    try {
      if (!participantId) {
        console.error('No participant ID provided for table QR code generation');
        return;
      }
      
      console.log('Generating table QR code for participant ID:', participantId);
      
      const qrCodeUrl = await QRCode.toDataURL(participantId.toString(), {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });
      
      this.setState({
        tableQRCodeUrl: qrCodeUrl,
        showTableQRCode: true,
        tableQRParticipantId: participantId
      });
      
      console.log('Table QR code generated successfully');
    } catch (error) {
      console.error('Error generating table QR code:', error);
      this.setState({
        submissionError: 'Failed to generate QR code. Please try again.'
      });
    }
  }

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
        <div>
          {/* Data Status Notification */}
          {this.state.dataStatusMessage && (
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
              {this.state.dataStatusMessage}
            </div>
          )}
          
          <ParticipantForm
            formData={formData}
            language={language}
            onInputChange={this.handleInputChange}
            onSubmit={this.handleSubmit}
            submissionError={submissionError}
          />
          
          {/* Clear Saved Data Button */}
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
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
              title="Clear all saved form data from browser storage"
            >
              🗑️ Clear Saved Data
            </button>
          </div>
        </div>
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
        <div>
          {/* Data Status Notification */}
          {this.state.dataStatusMessage && (
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
              {this.state.dataStatusMessage}
            </div>
          )}
          
          <ParticipantForm
            formData={formData}
            language={language}
            onInputChange={this.handleInputChange}
            onSubmit={this.handleSubmit}
            submissionError={submissionError}
          />
          
          {/* Clear Saved Data Button */}
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
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
              title="Clear all saved form data from browser storage"
            >
              🗑️ Clear Saved Data
            </button>
          </div>
        </div>
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
