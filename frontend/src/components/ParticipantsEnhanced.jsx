/**
 * Enhanced Participants Component with Standardized Data Persistence
 * 
 * This demonstrates how to refactor the existing Participants.jsx to use
 * the new standardized persistence system for better consistency and reliability.
 */

import React, { Component } from 'react'
import { translations } from '../utils/translations'
import ParticipantForm from './ParticipantForm'
import SwipeView from './SwipeView'
import dataManager, { DATA_KEYS } from '../utils/dataManager'
import './Pages.css'
import axios from 'axios'
import { io } from 'socket.io-client'
import QRCode from 'qrcode'

const API_BASE_URL =
  window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://ecss-fft.azurewebsites.net'

class ParticipantsEnhanced extends Component {
  constructor(props) {
    super(props)
    
    this.state = {
      // Form and submission state
      formData: {
        participantDetails: {
          participantName: '',
          phoneNumber: '',
          gender: '',
          dateOfBirth: '',
          nationality: '',
          email: '',
          homeAddress: '',
          relationshipStatus: '',
          children: '',
          profession: '',
          educationLevel: '',
          ethnicGroup: '',
          religion: '',
          stateOfOrigin: '',
          experienceWithIT: '',
          comfortWithTechnology: ''
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
      
      // View state
      showForm: false,
      showSwipeView: false,
      hasSubmitted: false,
      
      // Data state
      participants: [],
      swipeParticipantData: null,
      currentParticipantId: null,
      
      // UI state
      isLoading: true,
      isInitializing: true,
      submissionError: null,
      statusMessage: '',
      
      // QR Code state
      showQRCode: false,
      showTableQRCode: false,
      qrCodeUrl: '',
      tableQRCodeUrl: '',
      tableQRParticipantId: null,
      isGeneratingQR: false,
      qrGenerationError: null
    }
    
    this.socket = null
    this.persistenceManager = this.createPersistenceManager()
  }

  /**
   * Create a standardized persistence manager for this component
   */
  createPersistenceManager() {
    return {
      // Save current state to persistence
      saveState: () => {
        const stateToSave = {
          formData: this.state.formData,
          hasSubmitted: this.state.hasSubmitted,
          showForm: this.state.showForm,
          showSwipeView: this.state.showSwipeView,
          swipeParticipantData: this.state.swipeParticipantData,
          participants: this.state.participants,
          currentParticipantId: this.state.currentParticipantId
        }
        
        const result = dataManager.save(DATA_KEYS.PARTICIPANTS_STATE, stateToSave)
        
        if (result.success) {
          this.setState({ statusMessage: '💾 Data saved automatically' })
          this.clearStatusMessage()
        } else {
          console.error('Failed to save participants state:', result.error)
          this.setState({ statusMessage: '❌ Auto-save failed' })
          this.clearStatusMessage()
        }
        
        return result
      },

      // Load state from persistence
      loadState: () => {
        const savedState = dataManager.load(DATA_KEYS.PARTICIPANTS_STATE)
        
        if (savedState) {
          // Merge saved state with current state
          const newState = {
            ...savedState,
            isLoading: false,
            isInitializing: false
          }
          
          this.setState(newState, () => {
            console.log('✅ Participants state restored from persistence')
            this.setState({ statusMessage: '✅ Your data has been restored' })
            this.clearStatusMessage()
          })
          
          return true
        }
        
        console.log('📝 No saved participants state found')
        return false
      },

      // Clear saved state
      clearState: () => {
        const result = dataManager.remove(DATA_KEYS.PARTICIPANTS_STATE)
        
        if (result.success) {
          console.log('🗑️ Participants state cleared from persistence')
          this.setState({ statusMessage: '🗑️ Data cleared successfully' })
          this.clearStatusMessage()
        }
        
        return result
      },

      // Save participant ID separately for quick access
      saveParticipantId: (participantId) => {
        return dataManager.save(DATA_KEYS.PARTICIPANTS_ID, { participantId })
      },

      // Load participant ID
      loadParticipantId: () => {
        const data = dataManager.load(DATA_KEYS.PARTICIPANTS_ID)
        return data ? data.participantId : null
      },

      // Clear participant ID
      clearParticipantId: () => {
        return dataManager.remove(DATA_KEYS.PARTICIPANTS_ID)
      }
    }
  }

  /**
   * Clear status message after delay
   */
  clearStatusMessage = () => {
    setTimeout(() => {
      this.setState({ statusMessage: '' })
    }, 3000)
  }

  /**
   * Component lifecycle methods
   */
  async componentDidMount() {
    try {
      this.setState({ 
        isLoading: true,
        statusMessage: '🔄 Initializing application...' 
      })

      // Test data persistence on component mount
      const testResult = dataManager.test()
      if (!testResult.success) {
        console.warn('⚠️ Data persistence test failed:', testResult.error)
        this.setState({ statusMessage: '⚠️ Data persistence may not work properly' })
      }

      // Load saved state
      const hasLoadedState = this.persistenceManager.loadState()
      
      if (hasLoadedState && this.state.hasSubmitted && this.hasFilledFormData()) {
        // User has submitted form, show swipe view
        console.log('📱 User has submitted, showing details view')
        this.setupSwipeViewFromFormData()
      } else if (hasLoadedState && this.hasFilledFormData()) {
        // User has form data but not submitted, show form
        console.log('📱 User has partial data, showing form to continue')
        this.setState({ 
          showForm: true, 
          showSwipeView: false,
          statusMessage: '📝 Continue where you left off' 
        })
      } else {
        // Check for existing participant from backend
        await this.checkForExistingParticipant()
      }

      // Initialize Socket.IO
      await this.initializeSocket()

      this.setState({ 
        isLoading: false,
        isInitializing: false 
      })

    } catch (error) {
      console.error('❌ Error in componentDidMount:', error)
      this.setState({ 
        submissionError: 'Failed to initialize. Please refresh the page.',
        isLoading: false,
        isInitializing: false,
        statusMessage: '❌ Initialization failed'
      })
    }
  }

  componentWillUnmount() {
    // Save state before unmounting
    this.persistenceManager.saveState()
    
    // Disconnect socket
    if (this.socket) {
      this.socket.disconnect()
    }
    
    console.log('💾 Participants component unmounted, data saved')
  }

  /**
   * Initialize Socket.IO connection
   */
  async initializeSocket() {
    try {
      this.socket = io(API_BASE_URL)

      this.socket.on('connect', () => {
        console.log('✅ Socket connected:', this.socket.id)
      })

      this.socket.on('disconnect', () => {
        console.log('❌ Socket disconnected')
      })

      this.socket.on('participant-updated', (data) => {
        console.log('🔔 Participant updated:', data)
        // Handle real-time updates
        this.handleParticipantUpdate(data)
      })

    } catch (error) {
      console.error('❌ Socket initialization failed:', error)
    }
  }

  /**
   * Check for existing participant in backend
   */
  async checkForExistingParticipant() {
    const participantId = this.persistenceManager.loadParticipantId()
    
    if (!participantId) {
      console.log('📝 No participant ID found, showing fresh form')
      this.setState({ 
        showForm: true, 
        showSwipeView: false,
        statusMessage: 'Ready to start registration' 
      })
      return
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/participants`, {
        purpose: 'retrieveParticipant',
        participantID: participantId
      })

      if (response.data?.success && response.data?.data) {
        console.log('✅ Found existing participant in backend')
        this.setState({
          participants: [response.data.data],
          showForm: false,
          showSwipeView: true,
          swipeParticipantData: response.data.data,
          hasSubmitted: true,
          currentParticipantId: participantId,
          statusMessage: '✅ Welcome back! Showing your details'
        })
        
        // Save the restored state
        this.persistenceManager.saveState()
      } else {
        console.log('📝 No participant found in backend, showing form')
        this.setState({ 
          showForm: true, 
          showSwipeView: false 
        })
      }
    } catch (error) {
      console.error('❌ Error checking for existing participant:', error)
      this.setState({ 
        showForm: true, 
        showSwipeView: false,
        statusMessage: 'Could not check previous registration, starting fresh' 
      })
    }
  }

  /**
   * Setup swipe view from current form data
   */
  setupSwipeViewFromFormData() {
    const participantData = {
      name: this.state.formData.participantDetails.participantName || 'Participant',
      age: this.calculateAge(this.state.formData.participantDetails.dateOfBirth),
      gender: this.state.formData.participantDetails.gender,
      dateOfBirth: this.state.formData.participantDetails.dateOfBirth,
      phoneNumber: this.state.formData.participantDetails.phoneNumber,
      submittedAt: new Date().toISOString(),
      id: this.persistenceManager.loadParticipantId() || Date.now().toString()
    }
    
    this.setState({ 
      showForm: false,
      showSwipeView: true,
      swipeParticipantData: participantData,
      statusMessage: '✅ Welcome back! Your registration is complete'
    })
  }

  /**
   * Form handling methods
   */
  handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    const nameParts = name.split('.')
    
    // Update state based on the input structure
    if (nameParts.length === 2) {
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
        // Auto-save form data
        this.persistenceManager.saveState()
      })
    } else if (nameParts.length === 3) {
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
        // Auto-save form data
        this.persistenceManager.saveState()
      })
    }
  }

  handleSubmit = async (e) => {
    e.preventDefault()
    
    const { formData } = this.state
    
    // Validate required fields
    const validationResult = this.validateForm(formData)
    if (!validationResult.isValid) {
      this.setState({ submissionError: validationResult.message })
      return
    }

    try {
      this.setState({ statusMessage: '📤 Submitting your registration...' })
      
      const participantData = this.buildParticipantData(formData)
      const result = await this.submitToBackend(participantData)

      if (result.success) {
        const participantId = result.data?._id || result.data?.id
        
        this.setState({
          hasSubmitted: true,
          showForm: false,
          participants: [result.data],
          currentParticipantId: participantId,
          submissionError: null,
          statusMessage: '✅ Registration successful!'
        })

        // Save participant ID for future reference
        if (participantId) {
          this.persistenceManager.saveParticipantId(participantId)
        }

        // Save complete state
        this.persistenceManager.saveState()

        // Show swipe view
        this.showSwipeView(participantId)
        
      } else {
        this.setState({ 
          submissionError: result.error || 'Submission failed. Please try again.',
          statusMessage: '❌ Registration failed'
        })
      }
    } catch (error) {
      console.error('❌ Submission error:', error)
      this.setState({ 
        submissionError: 'Network error. Please check your connection and try again.',
        statusMessage: '❌ Network error'
      })
    }
  }

  /**
   * Validation and utility methods
   */
  validateForm = (formData) => {
    const { participantDetails } = formData
    const requiredFields = ['participantName', 'phoneNumber', 'dateOfBirth', 'gender']
    const missingFields = []

    requiredFields.forEach(field => {
      if (!participantDetails[field] || !participantDetails[field].trim()) {
        missingFields.push(field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()))
      }
    })

    if (missingFields.length > 0) {
      return {
        isValid: false,
        message: `Please fill in the required fields: ${missingFields.join(', ')}`
      }
    }

    return { isValid: true }
  }

  buildParticipantData = (formData) => {
    return {
      id: this.state.participants.length + 1,
      name: formData.participantDetails.participantName.trim(),
      program: 'FFT Health Declaration',
      status: 'Registered',
      age: this.calculateAge(formData.participantDetails.dateOfBirth),
      gender: formData.participantDetails.gender,
      dateOfBirth: this.formatDateToDDMMYYYY(formData.participantDetails.dateOfBirth),
      phoneNumber: formData.participantDetails.phoneNumber,
      healthQuestions: formData.healthDeclaration,
      submittedAt: new Date().toISOString()
    }
  }

  submitToBackend = async (participantData) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/participants`, {
        purpose: "new", 
        participantData
      })
      
      if (response.data?.success) {
        return { 
          success: true, 
          data: response.data.data 
        }
      } else {
        return { 
          success: false, 
          error: response.data?.message || 'Unknown error' 
        }
      }
    } catch (error) {
      console.error('❌ Backend submission error:', error)
      return { 
        success: false, 
        error: error.message 
      }
    }
  }

  hasFilledFormData = () => {
    const { formData } = this.state
    
    // Check participant details
    const hasParticipantData = Object.values(formData.participantDetails).some(value => 
      value && value.toString().trim() !== ''
    )
    
    // Check health questions
    const hasHealthData = Object.values(formData.healthDeclaration.questions).some(value => 
      value && value.toString().trim() !== ''
    )
    
    return hasParticipantData || hasHealthData
  }

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

  formatDateToDDMMYYYY = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  /**
   * View management methods
   */
  showSwipeView = (participantId) => {
    const participant = this.state.participants.find(p => p.id === participantId) || 
                       this.state.swipeParticipantData
    
    this.setState({
      showSwipeView: true,
      swipeParticipantData: participant,
      showForm: false
    })
    
    // Save state
    this.persistenceManager.saveState()
  }

  closeSwipeView = () => {
    // Clear all data and return to home
    this.setState({
      showSwipeView: false,
      swipeParticipantData: null,
      showForm: true,
      hasSubmitted: false,
      participants: [],
      formData: {
        participantDetails: {
          participantName: '',
          phoneNumber: '',
          gender: '',
          dateOfBirth: '',
          nationality: '',
          email: '',
          homeAddress: '',
          relationshipStatus: '',
          children: '',
          profession: '',
          educationLevel: '',
          ethnicGroup: '',
          religion: '',
          stateOfOrigin: '',
          experienceWithIT: '',
          comfortWithTechnology: ''
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
    }, () => {
      // Clear all saved data
      this.persistenceManager.clearState()
      this.persistenceManager.clearParticipantId()
      
      // Navigate to home
      window.location.href = '/'
    })
  }

  /**
   * Event handlers
   */
  handleParticipantUpdate = (data) => {
    // Handle real-time participant updates
    console.log('🔄 Handling participant update:', data)
    
    const currentParticipantId = this.persistenceManager.loadParticipantId()
    
    if (currentParticipantId === data.participantID) {
      // Update is for current participant
      this.checkForExistingParticipant()
    }
  }

  /**
   * QR Code methods (simplified)
   */
  generateQRCode = async (participantId) => {
    // Implementation similar to original but with better error handling
    try {
      this.setState({ 
        isGeneratingQR: true,
        statusMessage: 'Generating QR code...' 
      })
      
      const qrCodeUrl = await QRCode.toDataURL(participantId.toString(), {
        width: 350,
        margin: 2,
        errorCorrectionLevel: 'H'
      })
      
      this.setState({ 
        qrCodeUrl,
        showQRCode: true,
        isGeneratingQR: false,
        statusMessage: 'QR code ready!'
      })
      
    } catch (error) {
      console.error('❌ QR code generation failed:', error)
      this.setState({
        isGeneratingQR: false,
        qrGenerationError: error.message,
        statusMessage: 'QR code generation failed'
      })
    }
  }

  closeQRCode = () => {
    this.setState({
      showQRCode: false,
      qrCodeUrl: '',
      isGeneratingQR: false,
      qrGenerationError: null
    })
  }

  /**
   * Render method
   */
  render() {
    const { language } = this.props
    const t = translations[language]
    const { 
      formData, 
      showForm, 
      showSwipeView, 
      swipeParticipantData, 
      submissionError, 
      isInitializing, 
      isLoading,
      statusMessage,
      showQRCode,
      qrCodeUrl,
      isGeneratingQR
    } = this.state

    // Show loading during initialization
    if (isInitializing || isLoading) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <h2>Loading...</h2>
          <div style={{ fontSize: '48px', margin: '20px 0', animation: 'spin 2s linear infinite' }}>🔄</div>
          <p>{statusMessage || 'Initializing application...'}</p>
        </div>
      )
    }

    // Show QR Code modal
    if (showQRCode || isGeneratingQR) {
      return (
        <div className="qr-modal-overlay" onClick={!isGeneratingQR ? this.closeQRCode : undefined}>
          <div onClick={(e) => e.stopPropagation()}>
            {!isGeneratingQR && (
              <button className="qr-modal-close" onClick={this.closeQRCode}>×</button>
            )}
            
            {isGeneratingQR ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <h2>Generating QR Code...</h2>
                <div style={{ fontSize: '48px', margin: '20px 0', animation: 'spin 2s linear infinite' }}>🔄</div>
              </div>
            ) : (
              <>
                <h2 className="qr-modal-title">Registration Complete! 🎉</h2>
                <div className="qr-code-container">
                  <img src={qrCodeUrl} alt="QR Code" className="qr-code-image" />
                </div>
                <p>Present this QR code to the station master</p>
              </>
            )}
          </div>
        </div>
      )
    }

    // Show swipe view for submitted participants
    if (showSwipeView && swipeParticipantData) {
      return (
        <SwipeView
          participant={swipeParticipantData}
          language={language}
          onClose={this.closeSwipeView}
        />
      )
    }

    // Show form
    return (
      <div>
        {/* Status message notification */}
        {statusMessage && (
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
            {statusMessage}
          </div>
        )}
        
        <ParticipantForm
          formData={formData}
          language={language}
          onInputChange={this.handleInputChange}
          onSubmit={this.handleSubmit}
          submissionError={submissionError}
        />
      </div>
    )
  }
}

export default ParticipantsEnhanced
