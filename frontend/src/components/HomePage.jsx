import { Link } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { translations } from '../utils/translations'
import './HomePage.css'

function HomePage() {
  const { language } = useLanguage()
  const t = translations[language]

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
            <Link to="/participants" className="nav-button participants-btn">
              <div className="button-icon">�</div>
              <h3>{t.participants}</h3>
              <p>{t.participantsDesc}</p>
            </Link>
            
            <Link to="/volunteers" className="nav-button volunteers-btn">
              <div className="button-icon">�</div>
              <h3>{t.volunteers}</h3>
              <p>{t.volunteersDesc}</p>
            </Link>
            
            {language !== 'zh' && (
              <Link to="/trainers" className="nav-button trainers-btn">
                <div className="button-icon">🎓</div>
                <h3>{t.trainers}</h3>
                <p>{t.trainersDesc}</p>
              </Link>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default HomePage
