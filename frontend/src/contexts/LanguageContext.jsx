import { createContext, useContext, useState, useEffect } from 'react'

const LanguageContext = createContext()

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    // Initialize from localStorage or default to English
    const savedLanguage = localStorage.getItem('selectedLanguage')
    return savedLanguage || 'en'
  })

  const handleSetLanguage = (newLanguage) => {
    setLanguage(newLanguage)
    // Save to localStorage
    localStorage.setItem('selectedLanguage', newLanguage)
  }

  const toggleLanguage = () => {
    const newLanguage = language === 'en' ? 'zh' : 'en'
    handleSetLanguage(newLanguage)
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export default LanguageContext
