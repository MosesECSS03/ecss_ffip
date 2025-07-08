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
    const { participant, language, onClose } = this.props
    console.log('ParticipantDetails render', participant, language)
    const t = translations[language]
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
            {this.hasValue(participant.dateOfBirth) && (
              <div className="detail-item">
                <span className="detail-label">{t.age}:</span>
                <span className="detail-value">{this.calculateAge(participant.dateOfBirth)}</span>
              </div>
            )}
            {this.hasValue(participant.dateOfBirth) && (
              <div className="detail-item">
                <span className="detail-label">{t.dateOfBirth}:</span>
                <span className="detail-value">{new Date(participant.dateOfBirth).toLocaleDateString()}</span>
              </div>
            )}
            {this.hasValue(participant.phoneNumber) && (
              <div className="detail-item">
                <span className="detail-label">{t.phoneNumber}:</span>
                <span className="detail-value">{participant.phoneNumber}</span>
              </div>
            )}
            {this.hasValue(participant.gender) && (
              <div className="detail-item">
                <span className="detail-label">{t.gender}:</span>
                <span className="detail-value">{t[participant.gender.toLowerCase()] || participant.gender}</span>
              </div>
            )}
            {this.hasValue(participant.height) && (
              <div className="detail-item">
                <span className="detail-label">{t.height}:</span>
                <span className="detail-value">{participant.height} cm</span>
              </div>
            )}
            {this.hasValue(participant.weight) && (
              <div className="detail-item">
                <span className="detail-label">{t.weight}:</span>
                <span className="detail-value">{participant.weight} kg</span>
              </div>
            )}
            {this.hasValue(participant.bmi) && (
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
        {console.log('All Participant Data', participant)}
      </div>
    )
  }
}

export default ParticipantDetails
