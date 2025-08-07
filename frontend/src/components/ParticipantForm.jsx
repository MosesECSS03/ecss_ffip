import React, { Component } from 'react'
import { translations } from '../utils/translations'
import './Pages.css'
import axios from 'axios';

const API_BASE_URL =
  window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://ecss-fft.azurewebsites.net'
    //ecss-fft.azurewebsites.net

class ParticipantForm extends Component {
  constructor(props) {
    super(props);
    this.participantNameRef = React.createRef();
  }

  componentDidMount() {
    console.log('🔍 ParticipantForm componentDidMount');
    console.log('🔍 ParticipantForm has restored data:', this.props.formData);
  }

  componentDidUpdate(prevProps) {
    // Only log when data is first restored, don't interfere with typing
    const prevHasData = prevProps.formData.participantDetails.participantName || 
                       prevProps.formData.participantDetails.phoneNumber;
    const currentHasData = this.props.formData.participantDetails.participantName || 
                          this.props.formData.participantDetails.phoneNumber;
    
    if (!prevHasData && currentHasData) {
      console.log('🔄 Data was restored to form');
    }
  }

  sendHealthSignal = async (question, answer) => {
    const { formData } = this.props;
    const name = formData?.participantDetails?.participantName || '';
    const phoneNumber = formData?.participantDetails?.phoneNumber || '';
    console.log('Sending health signal for question:', question, 'Answer:', answer, );
    try {
      await axios.post(`${API_BASE_URL}/participants`, {
        purpose: 'healthSignal',
        question,
        answer,
        name,
        phoneNumber
      });
    } catch (err) {
      // Optionally handle error
      console.error('Failed to send health signal:', err);
    }
  }

  render() {
    const { formData, language, onInputChange, onSubmit, submissionError } = this.props;
    const t = translations[language];

    // Debug: Check if form data contains values
    const hasRestoredData = formData.participantDetails.participantName || 
                           formData.participantDetails.phoneNumber || 
                           formData.participantDetails.dateOfBirth ||
                           formData.participantDetails.gender;
    
    if (hasRestoredData) {
      console.log('🔍 ParticipantForm has restored data:', formData.participantDetails);
    }

    // Determine if health declaration section should be disabled
    const isHealthSectionDisabled =
      !formData.participantDetails.participantName ||
      !formData.participantDetails.dateOfBirth ||
      !formData.participantDetails.phoneNumber ||
      !formData.participantDetails.gender;

    return (
      <div className="page-container senior-friendly-page">
        <div className="senior-form-wrapper">
          <h1 className="senior-title">{t.participantsTitle}</h1>
          <div className="senior-form-container">
            <h2 className="senior-form-title">{t.participantForm}</h2>
            <p className="senior-form-description">{t.fillForm}</p>
            {/* Error Message Display */}
            {submissionError && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                <span className="error-text">{submissionError}</span>
              </div>
            )}
            
            
            
            <form onSubmit={onSubmit} className="senior-form">
              {/* Personal Information */}
              <div className="form-section">
                <h3 className="section-title">Personal Information</h3>
                <div className="senior-form-group">
                  <label htmlFor="participantName" className="senior-label">
                    {t.participantName} <span className="required-senior">*</span>
                  </label>
                  <input
                    ref={this.participantNameRef}
                    type="text"
                    id="participantName"
                    name="participantDetails.participantName"
                    value={formData.participantDetails.participantName || ''}
                    onChange={onInputChange}
                    required
                    placeholder={t.participantName}
                    className="senior-input"
                    style={formData.participantDetails.participantName ? {
                      backgroundColor: '#f8f9fa',
                      borderColor: '#28a745'
                    } : {}}
                  />
                </div>
                <div className="senior-form-group">
                  <label htmlFor="dateOfBirth" className="senior-label">
                    {t.dateOfBirth} <span className="required-senior">*</span>
                  </label>
                  <input
                    type="date"
                    id="dateOfBirth"
                    name="participantDetails.dateOfBirth"
                    value={formData.participantDetails.dateOfBirth || ''}
                    onChange={onInputChange}
                    required
                    className="senior-input"
                    style={formData.participantDetails.dateOfBirth ? {
                      backgroundColor: '#f8f9fa',
                      borderColor: '#28a745'
                    } : {}}
                  />
                </div>
                <div className="senior-form-group">
                  <label htmlFor="phoneNumber" className="senior-label">
                    {t.contactNumber} <span className="required-senior">*</span>
                  </label>
                                    <input
                    type="tel"
                    id="participantMobile"
                    name="participantDetails.phoneNumber"
                    value={formData.participantDetails.phoneNumber || ''}
                    onChange={onInputChange}
                    required
                    placeholder={t.phoneNumber}
                    className="senior-input"
                    style={formData.participantDetails.phoneNumber ? {
                      backgroundColor: '#f8f9fa',
                      borderColor: '#28a745'
                    } : {}}
                  />
                </div>
                <div className="senior-form-group">
                  <label htmlFor="gender" className="senior-label">
                    {t.gender} <span className="required-senior">*</span>
                  </label>
                  <select
                    id="gender"
                    name="participantDetails.gender"
                    value={formData.participantDetails.gender || ''}
                    onChange={onInputChange}
                    required
                    className="senior-select"
                    style={formData.participantDetails.gender ? {
                      backgroundColor: '#f8f9fa',
                      borderColor: '#28a745'
                    } : {}}
                  >
                    <option value="">{t.gender}</option>
                    <option value="male">{t.male}</option>
                    <option value="female">{t.female}</option>
                  </select>
                </div>
              </div>
              {/* Health Declaration */}
              <div className="form-section" style={isHealthSectionDisabled ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
                <h3 className="section-title">{t.healthDeclaration}</h3>
                {Object.keys(formData.healthDeclaration.questions).map((questionKey, index) => (
                  <div key={index} className="senior-form-group health-question-row">
                    <div className="health-question-content">
                      <span className="health-question-text">{t[questionKey]}</span>
                      <div className="checkbox-row">
                        <label className="checkbox-label-inline">
                          <input
                            type="checkbox"
                            name={`healthDeclaration.questions.${questionKey}`}
                            value="yes"
                            checked={formData.healthDeclaration.questions[questionKey] === 'yes'}
                            onChange={e => {
                              if (isHealthSectionDisabled) return;
                              onInputChange(e);
                              if (e.target.checked) {
                                this.sendHealthSignal(t[questionKey], "yes");
                              }
                            }}
                            className="checkbox-input-inline"
                            disabled={isHealthSectionDisabled}
                          />
                          <span className="checkbox-text-inline">{t.yes}</span>
                        </label>
                        <label className="checkbox-label-inline">
                          <input
                            type="checkbox"
                            name={`healthDeclaration.questions.${questionKey}`}
                            value="no"
                            checked={formData.healthDeclaration.questions[questionKey] === 'no'}
                            onChange={isHealthSectionDisabled ? undefined : onInputChange}
                            className="checkbox-input-inline"
                            disabled={isHealthSectionDisabled}
                          />
                          <span className="checkbox-text-inline">{t.no}</span>
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Programme Indemnity */}
              <div className="form-section">
                <h3 className="section-title">{t.programmeIndemnity}</h3>
                <div className="indemnity-statements">
                  <div className="indemnity-statement">
                    <span className="statement-number">1.</span>
                    <span className="statement-text">{t.indemnityStatement1}</span>
                  </div>
                  <div className="indemnity-statement">
                    <span className="statement-number">2.</span>
                    <span className="statement-text">{t.indemnityStatement2}</span>
                  </div>
                  <div className="indemnity-statement">
                    <span className="statement-number">3.</span>
                    <span className="statement-text">{t.indemnityStatement3}</span>
                  </div>
                </div>
              </div>
              
              <div className="senior-form-actions">
                <button type="submit" className="senior-submit-btn">
                  {t.submit}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }
}

export default ParticipantForm
