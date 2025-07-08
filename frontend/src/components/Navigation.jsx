import { Link, useLocation } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { translations } from '../utils/translations'
import './Navigation.css'

function Navigation() {
  const location = useLocation()
  const { language, toggleLanguage } = useLanguage()
  const t = translations[language]

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-brand">
          <h2>{t.title}</h2>
        </div>
        
        <div className="nav-links">
          <Link 
            to="/" 
            className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
          >
            {t.home}
          </Link>
          <Link 
            to="/participants" 
            className={`nav-link ${location.pathname === '/participants' ? 'active' : ''}`}
          >
            {t.participants}
          </Link>
          <Link 
            to="/volunteers" 
            className={`nav-link ${location.pathname === '/volunteers' ? 'active' : ''}`}
          >
            {t.volunteers}
          </Link>
          {language !== 'zh' && (
            <Link 
              to="/trainers" 
              className={`nav-link ${location.pathname === '/trainers' ? 'active' : ''}`}
            >
              {t.trainers}
            </Link>
          )}
          <button className="language-toggle" onClick={toggleLanguage}>
            {language === 'en' ? '中文' : 'English'}
          </button>
        </div>
      </div>
    </nav>
  )
}

export default Navigation
