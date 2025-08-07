/**
 * Volunteers Component with Standardized Data Persistence
 * 
 * This demonstrates how to update Volunteers.jsx to follow the same
 * persistence pattern as the enhanced Participants component.
 */

import React, { Component } from 'react'
import { translations } from '../utils/translations'
import dataManager, { DATA_KEYS } from '../utils/dataManager'
import './Pages.css'

class VolunteersEnhanced extends Component {
  constructor(props) {
    super(props)
    
    this.state = {
      // Form data for volunteers
      formData: {
        volunteerName: '',
        phoneNumber: '',
        email: '',
        skills: '',
        availability: '',
        experience: '',
        motivation: ''
      },
      
      // View state
      showForm: false,
      showVolunteerDetails: false,
      hasSubmitted: false,
      
      // Data state
      volunteers: [],
      currentVolunteerId: null,
      
      // UI state
      isLoading: true,
      submissionError: null,
      statusMessage: ''
    }
    
    this.persistenceManager = this.createPersistenceManager()
  }

  /**
   * Create persistence manager for volunteers
   */
  createPersistenceManager() {
    return {
      saveState: () => {
        const stateToSave = {
          formData: this.state.formData,
          hasSubmitted: this.state.hasSubmitted,
          showForm: this.state.showForm,
          showVolunteerDetails: this.state.showVolunteerDetails,
          volunteers: this.state.volunteers,
          currentVolunteerId: this.state.currentVolunteerId
        }
        
        const result = dataManager.save(DATA_KEYS.VOLUNTEERS_STATE, stateToSave)
        
        if (result.success) {
          console.log('✅ Volunteers state saved')
          this.setState({ statusMessage: '💾 Data saved automatically' })
          this.clearStatusMessage()
        }
        
        return result
      },

      loadState: () => {
        const savedState = dataManager.load(DATA_KEYS.VOLUNTEERS_STATE)
        
        if (savedState) {
          this.setState({
            ...savedState,
            isLoading: false
          }, () => {
            console.log('✅ Volunteers state restored')
            this.setState({ statusMessage: '✅ Your data has been restored' })
            this.clearStatusMessage()
          })
          
          return true
        }
        
        return false
      },

      clearState: () => {
        return dataManager.remove(DATA_KEYS.VOLUNTEERS_STATE)
      }
    }
  }

  clearStatusMessage = () => {
    setTimeout(() => {
      this.setState({ statusMessage: '' })
    }, 3000)
  }

  /**
   * Lifecycle methods
   */
  async componentDidMount() {
    try {
      this.setState({ statusMessage: '🔄 Loading volunteers page...' })
      
      // Load saved state
      const hasLoadedState = this.persistenceManager.loadState()
      
      if (hasLoadedState && this.state.hasSubmitted && this.hasFilledFormData()) {
        // User has submitted, show details view
        console.log('📱 Volunteer has submitted, showing details')
        this.setState({ 
          showForm: false,
          showVolunteerDetails: true,
          statusMessage: '✅ Welcome back! Your volunteer registration is complete'
        })
      } else if (hasLoadedState && this.hasFilledFormData()) {
        // User has partial data, show form to continue
        console.log('📱 Volunteer has partial data, showing form')
        this.setState({ 
          showForm: true,
          showVolunteerDetails: false,
          statusMessage: '📝 Continue your volunteer registration'
        })
      } else {
        // Fresh start
        this.setState({ 
          showForm: true,
          showVolunteerDetails: false,
          statusMessage: 'Ready to register as a volunteer'
        })
      }
      
      this.setState({ isLoading: false })
      
    } catch (error) {
      console.error('❌ Error loading volunteers page:', error)
      this.setState({
        isLoading: false,
        submissionError: 'Failed to load page. Please refresh.',
        statusMessage: '❌ Loading failed'
      })
    }
  }

  componentWillUnmount() {
    // Save state before unmounting
    this.persistenceManager.saveState()
    console.log('💾 Volunteers component unmounted, data saved')
  }

  /**
   * Form handling
   */
  handleInputChange = (e) => {
    const { name, value } = e.target
    
    this.setState(prevState => ({
      formData: {
        ...prevState.formData,
        [name]: value
      }
    }), () => {
      // Auto-save form data
      this.persistenceManager.saveState()
    })
  }

  handleSubmit = async (e) => {
    e.preventDefault()
    
    const { formData } = this.state
    
    // Validate required fields
    const requiredFields = ['volunteerName', 'phoneNumber', 'email', 'skills']
    const missingFields = []
    
    requiredFields.forEach(field => {
      if (!formData[field] || !formData[field].trim()) {
        missingFields.push(field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()))
      }
    })
    
    if (missingFields.length > 0) {
      this.setState({ 
        submissionError: `Please fill in: ${missingFields.join(', ')}` 
      })
      return
    }

    try {
      this.setState({ statusMessage: '📤 Submitting volunteer registration...' })
      
      // Simulate submission (replace with actual API call)
      const volunteerId = Date.now().toString()
      const volunteerData = {
        id: volunteerId,
        ...formData,
        submittedAt: new Date().toISOString(),
        status: 'Registered'
      }

      // Add to volunteers list
      this.setState(prevState => ({
        volunteers: [...prevState.volunteers, volunteerData],
        currentVolunteerId: volunteerId,
        hasSubmitted: true,
        showForm: false,
        showVolunteerDetails: true,
        submissionError: null,
        statusMessage: '✅ Volunteer registration successful!'
      }), () => {
        // Save state after successful submission
        this.persistenceManager.saveState()
      })
      
    } catch (error) {
      console.error('❌ Volunteer submission error:', error)
      this.setState({
        submissionError: 'Submission failed. Please try again.',
        statusMessage: '❌ Registration failed'
      })
    }
  }

  /**
   * Utility methods
   */
  hasFilledFormData = () => {
    const { formData } = this.state
    return Object.values(formData).some(value => 
      value && value.toString().trim() !== ''
    )
  }

  resetForm = () => {
    this.setState({
      formData: {
        volunteerName: '',
        phoneNumber: '',
        email: '',
        skills: '',
        availability: '',
        experience: '',
        motivation: ''
      },
      showForm: true,
      showVolunteerDetails: false,
      hasSubmitted: false,
      volunteers: [],
      currentVolunteerId: null,
      submissionError: null
    }, () => {
      // Clear saved data
      this.persistenceManager.clearState()
      this.setState({ statusMessage: '🗑️ Form reset successfully' })
      this.clearStatusMessage()
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
      showVolunteerDetails,
      submissionError,
      isLoading,
      statusMessage,
      volunteers,
      currentVolunteerId
    } = this.state

    // Loading state
    if (isLoading) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <h2>Loading Volunteers...</h2>
          <div style={{ fontSize: '48px', margin: '20px 0' }}>🔄</div>
          <p>{statusMessage}</p>
        </div>
      )
    }

    // Show volunteer details (after submission)
    if (showVolunteerDetails && currentVolunteerId) {
      const currentVolunteer = volunteers.find(v => v.id === currentVolunteerId)
      
      return (
        <div className="volunteer-details-container">
          {/* Status message */}
          {statusMessage && (
            <div className="status-message" style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              backgroundColor: '#28a745',
              color: 'white',
              padding: '10px 15px',
              borderRadius: '5px',
              zIndex: 1000
            }}>
              {statusMessage}
            </div>
          )}
          
          <div className="volunteer-card">
            <h2>🎉 Volunteer Registration Complete!</h2>
            
            {currentVolunteer && (
              <div className="volunteer-info">
                <h3>Your Details:</h3>
                <p><strong>Name:</strong> {currentVolunteer.volunteerName}</p>
                <p><strong>Phone:</strong> {currentVolunteer.phoneNumber}</p>
                <p><strong>Email:</strong> {currentVolunteer.email}</p>
                <p><strong>Skills:</strong> {currentVolunteer.skills}</p>
                {currentVolunteer.availability && (
                  <p><strong>Availability:</strong> {currentVolunteer.availability}</p>
                )}
                {currentVolunteer.experience && (
                  <p><strong>Experience:</strong> {currentVolunteer.experience}</p>
                )}
                {currentVolunteer.motivation && (
                  <p><strong>Motivation:</strong> {currentVolunteer.motivation}</p>
                )}
                <p><strong>Registered:</strong> {new Date(currentVolunteer.submittedAt).toLocaleDateString()}</p>
              </div>
            )}
            
            <div className="volunteer-actions">
              <button 
                onClick={() => window.location.href = '/'}
                className="btn-primary"
              >
                Return to Home
              </button>
              
              <button 
                onClick={this.resetForm}
                className="btn-secondary"
                style={{ marginLeft: '10px' }}
              >
                Register Another Volunteer
              </button>
            </div>
          </div>
        </div>
      )
    }

    // Show form
    return (
      <div className="volunteers-container">
        {/* Status message */}
        {statusMessage && (
          <div className="status-message" style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: '#007bff',
            color: 'white',
            padding: '10px 15px',
            borderRadius: '5px',
            zIndex: 1000
          }}>
            {statusMessage}
          </div>
        )}
        
        <div className="form-container">
          <h2>{t?.volunteer_registration || 'Volunteer Registration'}</h2>
          
          {submissionError && (
            <div className="error-message" style={{
              backgroundColor: '#f8d7da',
              color: '#721c24',
              padding: '10px',
              borderRadius: '5px',
              marginBottom: '20px'
            }}>
              {submissionError}
            </div>
          )}
          
          <form onSubmit={this.handleSubmit}>
            <div className="form-group">
              <label htmlFor="volunteerName">Name *</label>
              <input
                type="text"
                id="volunteerName"
                name="volunteerName"
                value={formData.volunteerName}
                onChange={this.handleInputChange}
                required
                placeholder="Enter your full name"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="phoneNumber">Phone Number *</label>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={this.handleInputChange}
                required
                placeholder="Enter your phone number"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={this.handleInputChange}
                required
                placeholder="Enter your email address"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="skills">Skills *</label>
              <textarea
                id="skills"
                name="skills"
                value={formData.skills}
                onChange={this.handleInputChange}
                required
                placeholder="Describe your relevant skills..."
                rows="3"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="availability">Availability</label>
              <input
                type="text"
                id="availability"
                name="availability"
                value={formData.availability}
                onChange={this.handleInputChange}
                placeholder="When are you available? (e.g., weekends, evenings)"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="experience">Previous Experience</label>
              <textarea
                id="experience"
                name="experience"
                value={formData.experience}
                onChange={this.handleInputChange}
                placeholder="Describe any relevant volunteer or professional experience..."
                rows="3"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="motivation">Motivation</label>
              <textarea
                id="motivation"
                name="motivation"
                value={formData.motivation}
                onChange={this.handleInputChange}
                placeholder="Why do you want to volunteer with us?"
                rows="3"
              />
            </div>
            
            <div className="form-actions">
              <button type="submit" className="btn-primary">
                Register as Volunteer
              </button>
              
              <button 
                type="button" 
                onClick={() => window.location.href = '/'}
                className="btn-secondary"
                style={{ marginLeft: '10px' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }
}

export default VolunteersEnhanced
