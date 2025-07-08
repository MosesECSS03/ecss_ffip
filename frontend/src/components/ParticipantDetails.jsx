import React, { Component } from 'react'
import { translations } from '../utils/translations'
import './Pages.css'

class ParticipantDetails extends Component {
  hasValue = (value) => {
    return value && value.toString().trim() !== '' && value !== 'Pending' && value !== '-'
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

  render() {
    console.log('ParticipantDetails this.props:', this.props)
    const { participant, language, onClose } = this.props
    console.log('ParticipantDetails render', participant, language)
    
    // Handle case where props might not be available yet
    if (!participant) {
      console.log('ParticipantDetails: Missing participant prop', this.props)
      return <div>Loading participant details...</div>
    }
    
    // Provide default language if not available
    const currentLanguage = language || 'en'
    const t = translations[currentLanguage] || translations['en'] || {}
    
    // Provide fallback values for common translation keys
    const fallbackT = {
      personalInformation: 'Personal Information',
      nric: 'NRIC',
      age: 'Age',
      dateOfBirth: 'Date of Birth',
      phoneNumber: 'Phone Number',
      gender: 'Gender',
      height: 'Height',
      weight: 'Weight',
      bmi: 'BMI',
      swipeInstructions: 'Swipe left/right to navigate',
      male: 'Male',
      female: 'Female',
      ...t
    }
    return (
      <div className="participant-details-view">
        <h2 className="participant-name">{participant.name}</h2>
        {/* Personal Information */}
        <div className="details-section">
          <h3 className="details-section-title">{fallbackT.personalInformation}</h3>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">{fallbackT.nric}:</span>
              <span className="detail-value">{participant.nric}</span>
            </div>
            {this.hasValue(participant.dateOfBirth) && (
              <div className="detail-item">
                <span className="detail-label">{fallbackT.age}:</span>
                <span className="detail-value">{this.calculateAge(participant.dateOfBirth)}</span>
              </div>
            )}
            {this.hasValue(participant.dateOfBirth) && (
              <div className="detail-item">
                <span className="detail-label">{fallbackT.dateOfBirth}:</span>
                <span className="detail-value">{new Date(participant.dateOfBirth).toLocaleDateString()}</span>
              </div>
            )}
            {this.hasValue(participant.phoneNumber) && (
              <div className="detail-item">
                <span className="detail-label">{fallbackT.phoneNumber}:</span>
                <span className="detail-value">{participant.phoneNumber}</span>
              </div>
            )}
            {this.hasValue(participant.gender) && (
              <div className="detail-item">
                <span className="detail-label">{fallbackT.gender}:</span>
                <span className="detail-value">{fallbackT[participant.gender.toLowerCase()] || participant.gender}</span>
              </div>
            )}
            {this.hasValue(participant.height) && (
              <div className="detail-item">
                <span className="detail-label">{fallbackT.height}:</span>
                <span className="detail-value">{participant.height} cm</span>
              </div>
            )}
            {this.hasValue(participant.weight) && (
              <div className="detail-item">
                <span className="detail-label">{fallbackT.weight}:</span>
                <span className="detail-value">{participant.weight} kg</span>
              </div>
            )}
            {this.hasValue(participant.bmi) && (
              <div className="detail-item">
                <span className="detail-label">{fallbackT.bmi}:</span>
                <span className="detail-value">{participant.bmi}</span>
              </div>
            )}
          </div>
        </div>
        <div className="swipe-instructions">
          <p className="swipe-instructions-text">{fallbackT.swipeInstructions}</p>
        </div>
      </div>
    )
  }
}

export default ParticipantDetails
