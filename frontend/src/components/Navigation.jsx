import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { translations } from '../utils/translations'
import './Navigation.css'

class NavigationClass extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      showPopup: false,
      popupTarget: null,
      password: '',
      error: '',
    };
    this.PASSWORDS = {
      volunteers: 'ecss_v2046',
      trainers: 'ecss_t2046',
    };
  }

  handleProtectedNav = (target, e) => {
    e.preventDefault();
    this.setState({
      popupTarget: target,
      showPopup: true,
      password: '',
      error: '',
    });
  };

  handlePasswordSubmit = (e, t) => {
    e.preventDefault();
    const { popupTarget, password } = this.state;
    if (this.PASSWORDS[popupTarget] && password === this.PASSWORDS[popupTarget]) {
      this.setState({ showPopup: false, error: '', password: '' });
      if (popupTarget === 'volunteers') {
        window.location.href = '/volunteers';
      } else if (popupTarget === 'trainers') {
        window.location.href = '/trainers';
      }
    } else {
      this.setState({ error: t.passwordPopupError || 'Incorrect password. Please try again.' });
    }
  };

  render() {
    const { location, language, toggleLanguage, t } = this.props;
    const { showPopup, password, error } = this.state;
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
            <a
              href="/volunteers"
              className={`nav-link ${location.pathname === '/volunteers' ? 'active' : ''}`}
              onClick={e => this.handleProtectedNav('volunteers', e)}
            >
              {t.volunteers}
            </a>
            {language !== 'zh' && (
              <a
                href="/trainers"
                className={`nav-link ${location.pathname === '/trainers' ? 'active' : ''}`}
                onClick={e => this.handleProtectedNav('trainers', e)}
              >
                {t.trainers}
              </a>
            )}
            <button className="language-toggle" onClick={toggleLanguage}>
              {language === 'en' ? '中文' : 'English'}
            </button>
          </div>
        </div>

        {/* Password Popup */}
        {showPopup && (
          <div
            className="password-popup-overlay"
            onClick={e => {
              if (e.target.classList.contains('password-popup-overlay')) this.setState({ showPopup: false });
            }}
          >
            <div className="password-popup" onClick={e => e.stopPropagation()}>
              <button
                className="popup-close-x"
                aria-label="Close"
                type="button"
                onClick={() => this.setState({ showPopup: false })}
              >
                &times;
              </button>
              <h3>{t.passwordPopupTitle || 'Enter Password'}</h3>
              <form onSubmit={e => this.handlePasswordSubmit(e, t)} autoComplete="off">
                <input
                  type="password"
                  value={password}
                  onChange={e => this.setState({ password: e.target.value })}
                  placeholder={t.passwordPopupPlaceholder || 'Password'}
                  autoFocus
                />
                <div className="popup-actions">
                  <button type="button" onClick={() => this.setState({ showPopup: false })}>{t.passwordPopupCancel || 'Cancel'}</button>
                  <button type="submit">{t.passwordPopupSubmit || 'Submit'}</button>
                </div>
              </form>
              {error && <div className="password-error">{error}</div>}
            </div>
          </div>
        )}
      </nav>
    );
  }
}

function Navigation(props) {
  const location = useLocation();
  const { language, toggleLanguage } = useLanguage();
  const t = translations[language];
  return <NavigationClass location={location} language={language} toggleLanguage={toggleLanguage} t={t} />;
}
export default Navigation;
