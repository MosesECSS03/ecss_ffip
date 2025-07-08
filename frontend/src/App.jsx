import { Component } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { LanguageProvider } from './contexts/LanguageContext'
import LanguageSelector from './components/LanguageSelector'
import Navigation from './components/Navigation'
import HomePage from './components/HomePage'
import Volunteers from './components/Volunteers'
import Participants from './components/Participants'
import MainTrainers from './components/MainTrainers'
import './App.css'

class App extends Component {
  constructor(props) {
    super(props)
    this.state = {
      languageSelected: false
    }
  }

  componentDidMount() {
    // Check if language has been selected before
    const hasSelectedLanguage = localStorage.getItem('languageSelected')
    if (hasSelectedLanguage === 'true') {
      this.setState({ languageSelected: true })
    }
  }

  handleLanguageSelected = () => {
    this.setState({ languageSelected: true })
    localStorage.setItem('languageSelected', 'true')
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
