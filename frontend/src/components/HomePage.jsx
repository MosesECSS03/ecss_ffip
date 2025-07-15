import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { translations } from '../utils/translations'
import './HomePage.css'

function HomePage() {
  const { language } = useLanguage()
  const t = translations[language]

  // Password popup state
  const [showPopup, setShowPopup] = useState(false)
  const [popupTarget, setPopupTarget] = useState(null) // 'volunteers' or 'trainers'
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = window.location.assign ? null : undefined // fallback for react-router-dom v6+ if needed

  // Passwords (replace with env or secure method in production)
  const PASSWORDS = {
    volunteers: 'ecss_volunteer2046',
    trainers: 'ecss_trainer2046',
  }

  // Handle nav button click
  const handleProtectedClick = (target, e) => {
    if (target === 'participants') {
      // No password required for participants
      return
    }
    e.preventDefault()
    setPopupTarget(target)
    setShowPopup(true)
    setPassword('')
    setError('')
  }

  // Handle password submit
  const handlePasswordSubmit = (e) => {
    e.preventDefault()
    if (PASSWORDS[popupTarget] && password === PASSWORDS[popupTarget]) {
      setShowPopup(false)
      setError('')
      setPassword('')
      // Redirect to the correct page
      if (popupTarget === 'participants') {
        window.location.href = '/participants'
      } else if (popupTarget === 'volunteers') {
        window.location.href = '/volunteers'
      } else if (popupTarget === 'trainers') {
        window.location.href = '/trainers'
      }
    } else {
      setError('Incorrect password. Please try again.')
    }
  }

  return (
    <div className="homepage">
      <div className="homepage-container">
        <header className="homepage-header">
          <h1>{t.title}</h1>
          <p className="subtitle">{t.subtitle}</p>
        </header>
        
        <main className="homepage-content">
          <h2>{t.welcome}</h2>
          <p className="description">
            {t.description}
          </p>
          
          <div className={`navigation-buttons ${language === 'zh' ? 'chinese-layout' : ''}`}>
            <a href="/participants" className="nav-button participants-btn">
              <div className="button-icon">🏃</div>
              <h3>{t.participantsNav || 'Participants'}</h3>
              <p>{t.participantsDesc}</p>
            </a>

            <a href="/volunteers" className="nav-button volunteers-btn" onClick={e => handleProtectedClick('volunteers', e)}>
              <div className="button-icon">🤝</div>
              <h3>{t.volunteersNav || 'Volunteers'}</h3>
              <p>{t.volunteersDesc}</p>
            </a>

            {language !== 'zh' && (
              <a href="/trainers" className="nav-button trainers-btn" onClick={e => handleProtectedClick('trainers', e)}>
                <div className="button-icon">🔒</div>
                <h3>{t.trainersNav || 'Trainer Dash'}</h3>
                <p>{t.trainersDesc || 'Access trainer-only features'}</p>
              </a>
            )}
          </div>

          {/* Password Popup */}
          {showPopup && (
            <div
              className="password-popup-overlay"
              onClick={e => {
                // Only close if clicking the overlay, not the popup itself
                if (e.target.classList.contains('password-popup-overlay')) setShowPopup(false)
              }}
            >
              <div className="password-popup" onClick={e => e.stopPropagation()}>
                <button
                  className="popup-close-x"
                  aria-label="Close"
                  type="button"
                  onClick={() => setShowPopup(false)}
                >
                  &times;
                </button>
                <h3>{t.passwordPopupTitle}</h3>
                <form onSubmit={handlePasswordSubmit} autoComplete="off">
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder={t.passwordPopupPlaceholder}
                    autoFocus
                  />
                  <div className="popup-actions">
                    <button type="button" onClick={() => setShowPopup(false)}>{t.passwordPopupCancel}</button>
                    <button type="submit">{t.passwordPopupSubmit}</button>
                  </div>
                </form>
                {error && <div className="password-error">{t.passwordPopupError}</div>}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

export default HomePage

