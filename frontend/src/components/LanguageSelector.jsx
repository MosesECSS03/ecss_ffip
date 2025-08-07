import { useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { translations } from '../utils/translations'
import './LanguageSelector.css'

function LanguageSelector({ onLanguageSelected }) {
  const { setLanguage } = useLanguage()
  const [selectedLang, setSelectedLang] = useState('en')

  const handleLanguageSelect = (lang) => {
    setSelectedLang(lang)
    console.log('📱 Language selected:', lang)
  }

  const handleContinue = () => {
    console.log('📱 Continue clicked with language:', selectedLang)
    setLanguage(selectedLang)
    onLanguageSelected()
  }

  // Debug info for mobile
  console.log('📱 LanguageSelector rendered:', {
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    isMobile: window.innerWidth <= 768,
    userAgent: navigator.userAgent.substring(0, 50)
  })

  return (
    <div className="language-selector" style={{
      // Force visibility on mobile
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      backgroundColor: 'rgb(102, 126, 234)'
    }}>
      <div className="language-selector-container">
        <div className="language-selector-content" style={{
          // Additional mobile styling
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '20px',
          padding: '2rem',
          margin: '1rem',
          maxWidth: '500px',
          width: '100%'
        }}>
          <h1 className="language-title">
            {translations.en.selectLanguage}
            <br/>
            {translations.zh.selectLanguage}
          </h1>
          <p className="language-subtitle">
            {translations.en.chooseLanguage}
            <br/>
            {translations.zh.chooseLanguage}
          </p>
          
          {/* Mobile debug info */}
          <div style={{
            fontSize: '12px',
            color: '#666',
            margin: '10px 0',
            padding: '10px',
            backgroundColor: '#f8f9fa',
            borderRadius: '5px',
            border: '1px solid #dee2e6'
          }}>
            Mobile Debug: {window.innerWidth}x{window.innerHeight} | Touch: {'ontouchstart' in window ? 'Yes' : 'No'}
          </div>
          
          <div className="language-options">
            <button
              className={`language-option ${selectedLang === 'en' ? 'selected' : ''}`}
              onClick={() => handleLanguageSelect('en')}
              style={{
                minHeight: '44px',
                minWidth: '120px',
                touchAction: 'manipulation'
              }}
            >
              <div className="language-flag">🇺🇸</div>
              <div className="language-name">English</div>
            </button>
            
            <button
              className={`language-option ${selectedLang === 'zh' ? 'selected' : ''}`}
              onClick={() => handleLanguageSelect('zh')}
              style={{
                minHeight: '44px',
                minWidth: '120px',
                touchAction: 'manipulation'
              }}
            >
              <div className="language-flag">🇨🇳</div>
              <div className="language-name">中文</div>
            </button>
          </div>
          
          <button 
            className="continue-button" 
            onClick={handleContinue}
            style={{
              minHeight: '48px',
              padding: '1rem 2rem',
              fontSize: '1.1rem',
              touchAction: 'manipulation',
              backgroundColor: 'rgb(102, 126, 234)',
              color: 'white',
              border: 'none',
              borderRadius: '50px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            {selectedLang === 'en' ? translations.en.continue : translations.zh.continue}
          </button>
        </div>
      </div>
    </div>
  )
}

export default LanguageSelector
