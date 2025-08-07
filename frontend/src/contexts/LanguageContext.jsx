import { createContext, useContext, useState, useEffect } from 'react'
import dataManager, { DATA_KEYS } from '../utils/dataManager'

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
    // Initialize from persistent storage or default to English
    const savedLanguage = dataManager.load(DATA_KEYS.LANGUAGE_PREFERENCE)
    return savedLanguage || 'en'
  })

  const handleSetLanguage = (newLanguage) => {
    setLanguage(newLanguage)
    // Save to persistent storage
    dataManager.save(DATA_KEYS.LANGUAGE_PREFERENCE, newLanguage)
    console.log('🌐 Language preference saved:', newLanguage)
  }

  const toggleLanguage = () => {
    const newLanguage = language === 'en' ? 'zh' : 'en'
    handleSetLanguage(newLanguage)
  }

  // Initialize language on mount
  useEffect(() => {
    const savedLanguage = dataManager.load(DATA_KEYS.LANGUAGE_PREFERENCE)
    if (savedLanguage && savedLanguage !== language) {
      setLanguage(savedLanguage)
      console.log('🌐 Language preference restored:', savedLanguage)
    }
  }, [language])

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export default LanguageContext
