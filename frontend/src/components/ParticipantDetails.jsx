import React from 'react'
import { translations } from '../utils/translations'
import './Pages.css'

const ParticipantDetails = ({ participant, language, onClose }) => {
  const t = translations[language]

  // Helper function to check if a value is not blank/empty
  const hasValue = (value) => {
    return value && value.toString().trim() !== '' && value !== 'Pending' && value !== '-'
  }

  // Calculate age from date of birth
  const calculateAge = (dateOfBirth) => {
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

  return (
    <div className="participant-details-view">
      <h2 className="participant-name">{participant.name}</h2>
      
      {/* Personal Information */}
      <div className="details-section">
        <h3 className="details-section-title">{t.personalInformation}</h3>
        <div className="detail-grid">
          <div className="detail-item">
            <span className="detail-label">{t.nric}:</span>
            <span className="detail-value">{participant.nric}</span>
          </div>
          {hasValue(participant.dateOfBirth) && (
            <div className="detail-item">
              <span className="detail-label">{t.age}:</span>
              <span className="detail-value">{calculateAge(participant.dateOfBirth)}</span>
            </div>
          )}
          {hasValue(participant.dateOfBirth) && (
            <div className="detail-item">
              <span className="detail-label">{t.dateOfBirth}:</span>
              <span className="detail-value">{new Date(participant.dateOfBirth).toLocaleDateString()}</span>
            </div>
          )}
          {hasValue(participant.phoneNumber) && (
            <div className="detail-item">
              <span className="detail-label">{t.phoneNumber}:</span>
              <span className="detail-value">{participant.phoneNumber}</span>
            </div>
          )}
          {hasValue(participant.gender) && (
            <div className="detail-item">
              <span className="detail-label">{t.gender}:</span>
              <span className="detail-value">{t[participant.gender.toLowerCase()] || participant.gender}</span>
            </div>
          )}
          {hasValue(participant.height) && (
            <div className="detail-item">
              <span className="detail-label">{t.height}:</span>
              <span className="detail-value">{participant.height} cm</span>
            </div>
          )}
          {hasValue(participant.weight) && (
            <div className="detail-item">
              <span className="detail-label">{t.weight}:</span>
              <span className="detail-value">{participant.weight} kg</span>
            </div>
          )}
          {hasValue(participant.bmi) && (
            <div className="detail-item">
              <span className="detail-label">{t.bmi}:</span>
              <span className="detail-value">{participant.bmi}</span>
            </div>
          )}
        </div>
      </div>

      <div className="swipe-instructions">
        <p className="swipe-instructions-text">{t.swipeInstructions}</p>
      </div>
    </div>
  )
}

export default ParticipantDetails
