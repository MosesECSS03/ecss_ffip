import { Component } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { LanguageProvider } from './contexts/LanguageContext'
import LanguageContext from './contexts/LanguageContext'
import { translations } from './utils/translations'
import LanguageSelector from './components/LanguageSelector'
import Navigation from './components/Navigation'
import HomePage from './components/HomePage'
import Volunteers from './components/Volunteers/Volunteers'
import Participants from './components/Participants'
import MainTrainers from './components/MainTrainers'
import dataManager, { DATA_KEYS } from './utils/dataManager'
import './App.css'
import './components/HomePage.css' // Import HomePage.css for popup styles

// Password popup component as a class component
class PasswordPopup extends Component {
  static contextType = LanguageContext

  constructor(props) {
    super(props)
    
    // Passwords (replace with env or secure method in production)
    this.PASSWORDS = {
      volunteers: 'ecss_v2046',
      trainers: 'ecss_t2046',
    }
  }

  // Handle password submit
  handlePasswordSubmit = (e) => {
    e.preventDefault()
    const { popupTarget, password, setShowPopup, setError, setPassword } = this.props
    
    if (this.PASSWORDS[popupTarget] && password === this.PASSWORDS[popupTarget]) {
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

  render() {
    const { showPopup, setShowPopup, password, setPassword, error } = this.props
    
    console.log('🔐 PasswordPopup render - showPopup:', showPopup)
    
    if (!showPopup) return null

    const { language } = this.context
    const t = translations[language]

    console.log('🔐 PasswordPopup rendering with language:', language, 'translations:', !!t)

    return (
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
          <form onSubmit={this.handlePasswordSubmit} autoComplete="off">
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
    )
  }
}

class App extends Component {
  constructor(props) {
    super(props)
    this.state = {
      languageSelected: false,
      // Password popup state - moved to App level
      showPopup: false,
      popupTarget: null, // 'volunteers' or 'trainers'
      password: '',
      error: ''
    }
  }

  componentDidMount() {
    // Test data manager on app start
    dataManager.test()
    
    // Check if language was already selected using new data manager
    const savedLanguage = dataManager.load(DATA_KEYS.LANGUAGE_PREFERENCE)
    if (savedLanguage) {
      this.setState({ languageSelected: true })
    }
    
    // Clean up expired data on app start
    dataManager.cleanup()

    // Global password popup handler - can be called from any component
    window.showPasswordPopup = (target) => {
      this.setState({
        popupTarget: target,
        showPopup: true,
        password: '',
        error: ''
      })
    }
  }

  handleLanguageSelected = () => {
    this.setState({ languageSelected: true })
  }

  // State setters for password popup
  setShowPopup = (showPopup) => {
    this.setState({ showPopup })
  }

  setPopupTarget = (popupTarget) => {
    this.setState({ popupTarget })
  }

  setPassword = (password) => {
    this.setState({ password })
  }

  setError = (error) => {
    this.setState({ error })
  }

  render() {
    const { languageSelected, showPopup, popupTarget, password, error } = this.state

    console.log('🔐 App render - state:', { languageSelected, showPopup, popupTarget, password, error })

    if (!languageSelected) {
      return (
        <LanguageProvider>
          <LanguageSelector onLanguageSelected={this.handleLanguageSelected} />
          <PasswordPopup 
            showPopup={showPopup}
            setShowPopup={this.setShowPopup}
            popupTarget={popupTarget}
            setPopupTarget={this.setPopupTarget}
            password={password}
            setPassword={this.setPassword}
            error={error}
            setError={this.setError}
          />
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
            
            {/* Global password popup */}
            <PasswordPopup 
              showPopup={showPopup}
              setShowPopup={this.setShowPopup}
              popupTarget={popupTarget}
              setPopupTarget={this.setPopupTarget}
              password={password}
              setPassword={this.setPassword}
              error={error}
              setError={this.setError}
            />
          </div>
        </Router>
      </LanguageProvider>
    )
  }
}

export default App
