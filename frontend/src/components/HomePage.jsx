import React from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { translations } from '../utils/translations'
import './HomePage.css'

function HomePage() {
  const { language } = useLanguage()
  const t = translations[language]

  // Debug info for mobile
  console.log('📱 HomePage rendered:', {
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    language,
    translations: !!t,
    isMobile: window.innerWidth <= 768,
    userAgent: navigator.userAgent.substring(0, 50)
  })

  // Handle nav button click - use global password popup
  const handleProtectedClick = (target, e) => {
    if (target === 'participants') {
      // No password required for participants
      return
    }
    e.preventDefault()
    console.log('🔐 HomePage calling showPasswordPopup for:', target)
    // Use global password popup function
    if (window.showPasswordPopup) {
      window.showPasswordPopup(target)
    } else {
      console.error('🔐 window.showPasswordPopup not available')
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
                <h3>{t.trainersNav || 'Dashboard'}</h3>
                <p>{t.trainersDesc || 'Access participants results'}</p>
              </a>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default HomePage

