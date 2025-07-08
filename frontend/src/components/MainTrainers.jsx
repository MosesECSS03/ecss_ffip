import { useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { translations } from '../utils/translations'
import './Pages.css'

function MainTrainers() {
  const { language } = useLanguage()
  const t = translations[language]
  
  const [trainers] = useState([
    { 
      id: 1, 
      name: 'Dr. Jennifer Martinez', 
      specialty: 'Digital Technologies',
      experience: '15 years',
      certifications: ['AWS Certified', 'Google Cloud Professional', 'Microsoft Azure'],
      bio: 'Leading expert in cloud computing and digital transformation with extensive experience in training programs.'
    },
    { 
      id: 2, 
      name: 'Prof. Michael Brown', 
      specialty: 'Community Development',
      experience: '12 years',
      certifications: ['Community Leadership Certificate', 'Project Management Professional'],
      bio: 'Passionate about empowering communities through technology and education initiatives.'
    },
    { 
      id: 3, 
      name: 'Dr. Angela Foster', 
      specialty: 'Educational Psychology',
      experience: '10 years',
      certifications: ['PhD in Educational Psychology', 'Adult Learning Specialist'],
      bio: 'Specializes in creating effective learning environments for diverse age groups and backgrounds.'
    },
    { 
      id: 4, 
      name: 'Mark Stevens', 
      specialty: 'Technical Training',
      experience: '8 years',
      certifications: ['CompTIA Certified', 'Cisco Networking', 'Linux Professional'],
      bio: 'Hands-on technical trainer with expertise in hardware, networking, and system administration.'
    }
  ])

  return (
    <div className="page-container">
      <h1>{t.trainersTitle}</h1>
      
      <div className="trainers-grid">
        {trainers.map(trainer => (
          <div key={trainer.id} className="trainer-card">
            <div className="trainer-header">
              <h3>{trainer.name}</h3>
              <p className="specialty">{trainer.specialty}</p>
            </div>
            
            <div className="trainer-details">
              <div className="detail-item">
                <strong>{t.experience}:</strong> {trainer.experience}
              </div>
              
              <div className="detail-item">
                <strong>{t.certifications}:</strong>
                <ul className="certifications-list">
                  {trainer.certifications.map((cert, index) => (
                    <li key={index}>{cert}</li>
                  ))}
                </ul>
              </div>
              
              <div className="detail-item">
                <strong>{t.bio}:</strong>
                <p className="bio">{trainer.bio}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default MainTrainers
