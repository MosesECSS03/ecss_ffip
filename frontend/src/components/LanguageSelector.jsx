import { useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { translations } from '../utils/translations'
import './LanguageSelector.css'

function LanguageSelector({ onLanguageSelected }) {
  const { setLanguage } = useLanguage()
  const [selectedLang, setSelectedLang] = useState('en')

  const handleLanguageSelect = (lang) => {
    setSelectedLang(lang)
  }

  const handleContinue = () => {
    setLanguage(selectedLang)
    onLanguageSelected()
  }

  return (
    <div className="language-selector">
      <div className="language-selector-container">
        <div className="language-selector-content">
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
          
          <div className="language-options">
            <button
              className={`language-option ${selectedLang === 'en' ? 'selected' : ''}`}
              onClick={() => handleLanguageSelect('en')}
            >
              <div className="language-flag">🇺🇸</div>
              <div className="language-name">English</div>
            </button>
            
            <button
              className={`language-option ${selectedLang === 'zh' ? 'selected' : ''}`}
              onClick={() => handleLanguageSelect('zh')}
            >
              <div className="language-flag">🇨🇳</div>
              <div className="language-name">中文</div>
            </button>
          </div>
          
          <button className="continue-button" onClick={handleContinue}>
            {selectedLang === 'en' ? translations.en.continue : translations.zh.continue}
          </button>
        </div>
      </div>
    </div>
  )
}

export default LanguageSelector
