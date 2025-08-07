import { Component } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { LanguageProvider } from './contexts/LanguageContext'
import LanguageSelector from './components/LanguageSelector'
import Navigation from './components/Navigation'
import HomePage from './components/HomePage'
import Volunteers from './components/Volunteers'
import Participants from './components/Participants'
import MainTrainers from './components/MainTrainers'
import dataManager, { DATA_KEYS } from './utils/dataManager'
import './App.css'

class App extends Component {
  constructor(props) {
    super(props)
    this.state = {
      languageSelected: false
    }
  }

  componentDidMount() {
    // Test data manager on app start
    dataManager.test()
    
    // Debug info for mobile troubleshooting
    console.log('📱 Mobile Debug Info:', {
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        visualViewport: window.visualViewport ? {
          width: window.visualViewport.width,
          height: window.visualViewport.height
        } : null
      },
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        orientation: window.screen.orientation?.type || 'unknown'
      },
      localStorage: typeof Storage !== 'undefined',
      touch: 'ontouchstart' in window
    })
    
    // Check if language was already selected using new data manager
    const savedLanguage = dataManager.load(DATA_KEYS.LANGUAGE_PREFERENCE)
    if (savedLanguage) {
      this.setState({ languageSelected: true })
      console.log('🌐 Language already selected:', savedLanguage)
    }
    
    // Clean up expired data on app start
    dataManager.cleanup()
    
    // Log storage info for debugging
    const storageInfo = dataManager.getStorageInfo()
    console.log('💾 Storage info:', storageInfo)
  }

  handleLanguageSelected = () => {
    this.setState({ languageSelected: true })
  }

  render() {
    const { languageSelected } = this.state

    if (!languageSelected) {
      return (
        <LanguageProvider>
          <LanguageSelector onLanguageSelected={this.handleLanguageSelected} />
        </LanguageProvider>
      )
    }

    return (
      <LanguageProvider>
        <Router>
          <div className="App">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/volunteers" element={<><Navigation /><Volunteers /></>} />
              <Route path="/participants" element={<><Navigation /><Participants /></>} />
              <Route path="/trainers" element={<><Navigation /><MainTrainers /></>} />
            </Routes>
          </div>
        </Router>
      </LanguageProvider>
    )
  }
}

export default App
