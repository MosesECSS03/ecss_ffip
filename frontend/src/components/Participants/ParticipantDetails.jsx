import React, { Component } from 'react'
import { translations } from '../../utils/translations'
import '../Pages.css'
import io from 'socket.io-client'
import dataManager from '../../utils/dataManager'

const API_BASE_URL =
  window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://ecss-fft.azurewebsites.net';

class ParticipantDetails extends Component {
  constructor(props) {
    super(props)
    this.state = {
      liveHeight: props.participant?.height || '',
      liveWeight: props.participant?.weight || '',
      liveBMI: props.participant?.bmi || ''
    }
    this.socket = null
  }
  
  componentWillUnmount() {
    if (this.socket) {
      this.socket.disconnect()
    }
  }

  hasValue = (value) => {
    const result = value && value.toString().trim() !== '' && value !== 'Pending' && value !== '-'
    console.log('🔍 hasValue check:', { value, result })
    return result
  }

  // Support both ISO and DD/MM/YYYY date formats
  parseDate = (dateString) => {
    if (!dateString) return null;
    // Try ISO first
    let d = new Date(dateString);
    if (!isNaN(d.getTime())) return d;
    // Try DD/MM/YYYY
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const [dd, mm, yyyy] = parts;
      const parsed = new Date(`${yyyy}-${mm}-${dd}`);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return null;
  }

  calculateAge = (dateOfBirth) => {
    const birthDate = this.parseDate(dateOfBirth);
    if (!birthDate) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  renderStationResults = (stations) => {
    if (!stations || !Array.isArray(stations) || stations.length === 0) {
      return (
        <div className="no-stations">
          <p>No fitness test results available</p>
        </div>
      )
    }

    // Define the fixed order of stations
    const stationOrder = [
      'sitStand',
      'armBanding', 
      'marching',
      'sitReach',
      'backStretch',
      'speedWalking',
      'handGrip'
    ];

    const { participant } = this.props
    const age = this.calculateAge(participant.dateOfBirth)
    const gender = participant.gender

    return stations.map((station, index) => {
      return (
        <div key={index} className="station-result">
          {/* Sort station entries according to the defined order */}
          {Object.entries(station)
            .sort(([stationNameA], [stationNameB]) => {
              const indexA = stationOrder.indexOf(stationNameA);
              const indexB = stationOrder.indexOf(stationNameB);
              
              // If both stations are in the order array, sort by their position
              if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB;
              }
              
              // If only one is in the order array, prioritize it
              if (indexA !== -1) return -1;
              if (indexB !== -1) return 1;
              
              // If neither is in the order array, maintain alphabetical order
              return stationNameA.localeCompare(stationNameB);
            })
            .map(([stationName, stationData]) => {
              // Get the higher score between score1 and score2
              const higherScore = this.getHigherScore(stationData)
              const fitnessResult = age && gender && higherScore ? 
                this.calculateFitnessScore(stationName, higherScore, age, gender) : { category: 'Not Assessed', range: '' }
              
              return (
                <div key={stationName} className="station-item">
                  <h5 className="station-name">{this.formatStationName(stationName)}</h5>
                  <div className="station-details">
                    {/* Sort station data entries for consistent display */}
                    {Object.entries(stationData)
                      .sort(([keyA], [keyB]) => {
                        // Define order for station data keys
                        const keyOrder = ['score1', 'score2', 'remarks', 'result', 'time', 'leftRight', 'height', 'weight'];
                        const indexA = keyOrder.indexOf(keyA);
                        const indexB = keyOrder.indexOf(keyB);
                        
                        if (indexA !== -1 && indexB !== -1) {
                          return indexA - indexB;
                        }
                        if (indexA !== -1) return -1;
                        if (indexB !== -1) return 1;
                        return keyA.localeCompare(keyB);
                      })
                      .map(([key, value]) => (
                        <div key={key} className="station-detail">
                          <span className="station-label">{this.formatStationKey(key)}:</span>
                          <span className="station-value">{value}</span>
                        </div>
                      ))}
                    <div className="station-detail">
                      <span className="station-label">{this.formatStationKey('result')}:</span>
                      <span className={`station-value result-score ${fitnessResult.category ? fitnessResult.category.toLowerCase().replace(/\s+/g, '-') : 'not-assessed'}`}>
                        {fitnessResult.range ? `${fitnessResult.category}` : fitnessResult.category}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      )
    })
  }

  formatStationName = (stationName) => {
    // Get current language and translations
    const currentLanguage = this.props.language || 'en'
    const t = translations[currentLanguage] || translations['en'] || {}
    
    // Check if the station name exists in translations.stations
    if (t.stations && t.stations[stationName]) {
      return t.stations[stationName]
    }
    
    // Fallback: Map station names to exact display names
    const stationNameMap = {
      'sitStand': '30秒坐立測試',
      'armBanding': '30秒手臂屈伸', 
      'onTheSpotMarching': '2分鐘原地踏步',
      'sitReach': '坐姿前彎測試',
      'backStretching': '背部伸展測試',
      'speedWalking': '2.44米快走測試',
      'handGrip': '握力測試',
      'handGriping': '握力測試', // Alternative key name
      'handGripTest': '握力測試'
    };
    
    return stationNameMap[stationName] || stationName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  formatStationKey = (key) => {
    // Get current language and translations
    const currentLanguage = this.props.language || 'en'
    const t = translations[currentLanguage] || translations['en'] || {}
    
    // Check if the key exists in translations
    if (t[key]) {
      return t[key]
    }
    
    // Fallback: Format keys like 'score1' to 'Score 1'
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/(\d+)/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim()
  }

  // Fitness scoring calculation based on the PDF tables
  calculateFitnessScore = (stationName, score, age, gender) => {
    console.log(`Calculating fitness score for ${stationName} with score ${score} (${typeof score}), age ${age}, gender ${gender}`)
    // Fitness scoring tables based on the PDF with English categories as ranges
    // Using numeric age ranges for more robust logic
    const scoringTables = {
      // Female scoring table
      female: {
        sitStand: [
          { 
            ageMin: 65, ageMax: 69,
            veryWeak: [-999, 13], 
            weak: [13, 14], 
            normal: [15, 16], 
            good: [17, 18], 
            veryGood: [18, 999] 
          },
          { 
            ageMin: 70, ageMax: 74,
            veryWeak: [-999, 12], 
            weak: [12, 13], 
            normal: [14, 15], 
            good: [16, 17], 
            veryGood: [17, 999] 
          },
          { 
            ageMin: 75, ageMax: 79,
            veryWeak: [-999, 11], 
            weak: [11, 12], 
            normal: [13, 14], 
            good: [15, 16], 
            veryGood: [16, 999] 
          },
          { 
            ageMin: 80, ageMax: 84,
            veryWeak: [-999, 10], 
            weak: [10, 11], 
            normal: [12, 13], 
            good: [14, 15], 
            veryGood: [15, 999] 
          },
          { 
            ageMin: 85, ageMax: 89,
            veryWeak: [-999, 8], 
            weak: [8, 9], 
            normal: [10, 11], 
            good: [12, 13], 
            veryGood: [13, 999] 
          },
          { 
            ageMin: 90, ageMax: 999,
            veryWeak: [-999, 8], 
            weak: [8, 8], 
            normal: [9, 10], 
            good: [11, 12], 
            veryGood: [12, 999] 
          }
        ],
        armBending: [
          { 
            ageMin: 65, ageMax: 69,
            veryWeak: [-999, 16], 
            weak: [16, 18], 
            normal: [19, 20], 
            good: [21, 22], 
            veryGood: [22, 999] 
          },
          { 
            ageMin: 70, ageMax: 74,
            veryWeak: [-999, 15], 
            weak: [15, 17], 
            normal: [18, 19], 
            good: [20, 21], 
            veryGood: [21, 999] 
          },
          { 
            ageMin: 75, ageMax: 79,
            veryWeak: [-999, 15], 
            weak: [15, 16], 
            normal: [17, 18], 
            good: [19, 20], 
            veryGood: [20, 999] 
          },
          { 
            ageMin: 80, ageMax: 84,
            veryWeak: [-999, 13], 
            weak: [13, 15], 
            normal: [16, 17], 
            good: [18, 19], 
            veryGood: [19, 999] 
          },
          { 
            ageMin: 85, ageMax: 89,
            veryWeak: [-999, 13], 
            weak: [13, 14], 
            normal: [15, 16], 
            good: [17, 18], 
            veryGood: [18, 999] 
          },
          { 
            ageMin: 90, ageMax: 999,
            veryWeak: [-999, 10], 
            weak: [10, 13], 
            normal: [14, 15], 
            good: [16, 17], 
            veryGood: [17, 999] 
          }
        ],
        sitReach: [
          { 
            ageMin: 65, ageMax: 69,
            veryWeak: [-999, 0], 
            weak: [0, 3], 
            normal: [4, 8], 
            good: [9, 13], 
            veryGood: [13, 999] 
          },
          { 
            ageMin: 70, ageMax: 74,
            veryWeak: [-999, 0], 
            weak: [0, 2], 
            normal: [3, 7], 
            good: [8, 12], 
            veryGood: [12, 999] 
          },
          { 
            ageMin: 75, ageMax: 79,
            veryWeak: [-999, 0], 
            weak: [0, 2], 
            normal: [3, 6], 
            good: [7, 10], 
            veryGood: [10, 999] 
          },
          { 
            ageMin: 80, ageMax: 84,
            veryWeak: [-999, 0], 
            weak: [0, 1], 
            normal: [2, 4], 
            good: [5, 8], 
            veryGood: [8, 999] 
          },
          { 
            ageMin: 85, ageMax: 89,
            veryWeak: [-999, -1.5], 
            weak: [-1.5, 0], 
            normal: [1, 3], 
            good: [4, 6], 
            veryGood: [6, 999] 
          },
          { 
            ageMin: 90, ageMax: 999,
            veryWeak: [-999, -1.8], 
            weak: [-1.8, -1], 
            normal: [-1, 1], 
            good: [2, 4], 
            veryGood: [4, 999] 
          }
        ],
        backStretching: [
          { 
            ageMin: 65, ageMax: 69,
            veryWeak: [-999, -8], 
            weak: [-8, -5], 
            normal: [-4, -1], 
            good: [0, 3], 
            veryGood: [3, 999] 
          },
          { 
            ageMin: 70, ageMax: 74,
            veryWeak: [-999, -11], 
            weak: [-11, -7], 
            normal: [-6, -2], 
            good: [-1, 3], 
            veryGood: [3, 999] 
          },
          { 
            ageMin: 75, ageMax: 79,
            veryWeak: [-999, -15], 
            weak: [-15, -12], 
            normal: [-11, -5], 
            good: [-4, 2], 
            veryGood: [2, 999] 
          },
          { 
            ageMin: 80, ageMax: 84,
            veryWeak: [-999, -17], 
            weak: [-17, -12], 
            normal: [-11, -6], 
            good: [-5, 1], 
            veryGood: [1, 999] 
          },
          { 
            ageMin: 85, ageMax: 89,
            veryWeak: [-999, -20], 
            weak: [-20, -13.4], 
            normal: [-13.3, -8.3], 
            good: [-8.2, 0.8], 
            veryGood: [0.8, 999] 
          },
          { 
            ageMin: 90, ageMax: 999,
            veryWeak: [-999, -20], 
            weak: [-20, -16], 
            normal: [-15, -8], 
            good: [-7, 0], 
            veryGood: [0, 999] 
          }
        ],
        handGrip: [
          { 
            ageMin: 65, ageMax: 69,
            veryWeak: [-999, 18.1], 
            weak: [18.1, 22.5], 
            normal: [22.6, 27.2], 
            good: [27.3, 31.9], 
            veryGood: [31.9, 999] 
          },
          { 
            ageMin: 70, ageMax: 74,
            veryWeak: [-999, 17.7], 
            weak: [17.7, 22.1], 
            normal: [22.2, 26.8], 
            good: [26.9, 31.5], 
            veryGood: [31.5, 999] 
          },
          { 
            ageMin: 75, ageMax: 79,
            veryWeak: [-999, 17.2], 
            weak: [17.2, 21.6], 
            normal: [21.7, 26.3], 
            good: [26.4, 31], 
            veryGood: [31, 999] 
          },
          { 
            ageMin: 80, ageMax: 84,
            veryWeak: [-999, 15.4], 
            weak: [15.4, 19], 
            normal: [19.1, 23.1], 
            good: [23.2, 27.2], 
            veryGood: [27.2, 999] 
          },
          { 
            ageMin: 85, ageMax: 89,
            veryWeak: [-999, 14.7], 
            weak: [14.7, 17.3], 
            normal: [17.4, 21.4], 
            good: [21.5, 24.5], 
            veryGood: [24.5, 999] 
          },
          { 
            ageMin: 90, ageMax: 999,
            veryWeak: [-999, 14.7], 
            weak: [14.7, 17.3], 
            normal: [17.4, 21.4], 
            good: [21.5, 24.5], 
            veryGood: [24.5, 999] 
          }
        ],
        speedWalking: [
          { 
            ageMin: 65, ageMax: 69,
            veryWeak: [7.7, 999], 
            weak: [7.0, 7.7], 
            normal: [6.3, 7.1], 
            good: [5.7, 6.4], 
            veryGood: [-999, 5.7] 
          },
          { 
            ageMin: 70, ageMax: 74,
            veryWeak: [8.7, 999], 
            weak: [8.0, 8.7], 
            normal: [7.0, 7.9], 
            good: [6.0, 6.9], 
            veryGood: [-999, 6.0] 
          },
          { 
            ageMin: 75, ageMax: 79,
            veryWeak: [10.0, 999], 
            weak: [9.2, 10.9], 
            normal: [8.0, 9.1], 
            good: [6.8, 7.9], 
            veryGood: [-999, 6.8] 
          },
          { 
            ageMin: 80, ageMax: 84,
            veryWeak: [11.1, 999], 
            weak: [10.2, 11.1], 
            normal: [8.9, 10.1], 
            good: [7.6, 8.8], 
            veryGood: [-999, 7.6] 
          },
          { 
            ageMin: 85, ageMax: 89,
            veryWeak: [12.5, 999], 
            weak: [11.2, 12.5], 
            normal: [9.7, 11.1], 
            good: [8.2, 9.6], 
            veryGood: [-999, 8.2] 
          },
          { 
            ageMin: 90, ageMax: 999,
            veryWeak: [14.6, 999], 
            weak: [12.8, 14.6], 
            normal: [10.9, 12.7], 
            good: [9.0, 10.8], 
            veryGood: [-999, 9.0] 
          }
        ],
        marching: [
          { 
            ageMin: 65, ageMax: 69,
            veryWeak: [-999, 76], 
            weak: [76, 85], 
            normal: [86, 95], 
            good: [96, 105], 
            veryGood: [105, 999] 
          },
          { 
            ageMin: 70, ageMax: 74,
            veryWeak: [-999, 69], 
            weak: [69, 79], 
            normal: [80, 90], 
            good: [91, 101], 
            veryGood: [101, 999] 
          },
          { 
            ageMin: 75, ageMax: 79,
            veryWeak: [-999, 62], 
            weak: [62, 73], 
            normal: [74, 85], 
            good: [86, 97], 
            veryGood: [97, 999] 
          },
          { 
            ageMin: 80, ageMax: 84,
            veryWeak: [-999, 51], 
            weak: [51, 64], 
            normal: [65, 78], 
            good: [79, 92], 
            veryGood: [92, 999] 
          },
          { 
            ageMin: 85, ageMax: 89,
            veryWeak: [-999, 42], 
            weak: [42, 57], 
            normal: [58, 73], 
            good: [74, 90], 
            veryGood: [90, 999] 
          },
          { 
            ageMin: 90, ageMax: 999,
            veryWeak: [-999, 31], 
            weak: [31, 47], 
            normal: [48, 64], 
            good: [65, 82], 
            veryGood: [82, 999] 
          }
        ]
      },
      // Male scoring table
      male: {
        sitStand: [
          { 
            ageMin: 65, ageMax: 69,
            veryWeak: [-999, 16], 
            weak: [16, 17], 
            normal: [18, 19], 
            good: [20, 21], 
            veryGood: [21, 999] 
          },
          { 
            ageMin: 70, ageMax: 74,
            veryWeak: [-999, 13], 
            weak: [13, 14], 
            normal: [15, 16], 
            good: [17, 18], 
            veryGood: [18, 999] 
          },
          { 
            ageMin: 75, ageMax: 79,
            veryWeak: [-999, 11], 
            weak: [11, 12], 
            normal: [13, 14], 
            good: [15, 16], 
            veryGood: [16, 999] 
          },
          { 
            ageMin: 80, ageMax: 84,
            veryWeak: [-999, 10], 
            weak: [10, 11], 
            normal: [12, 13], 
            good: [14, 15], 
            veryGood: [15, 999] 
          },
          { 
            ageMin: 85, ageMax: 89,
            veryWeak: [-999, 10], 
            weak: [10, 11], 
            normal: [12, 13], 
            good: [14, 15], 
            veryGood: [15, 999] 
          },
          { 
            ageMin: 90, ageMax: 999,
            veryWeak: [-999, 9], 
            weak: [9, 10], 
            normal: [11, 12], 
            good: [13, 14], 
            veryGood: [14, 999] 
          }
        ],
        armBending: [
          { 
            ageMin: 65, ageMax: 69,
            veryWeak: [-999, 17], 
            weak: [17, 19], 
            normal: [20, 22], 
            good: [23, 25], 
            veryGood: [25, 999] 
          },
          { 
            ageMin: 70, ageMax: 74,
            veryWeak: [-999, 16], 
            weak: [16, 18], 
            normal: [19, 21], 
            good: [22, 24], 
            veryGood: [24, 999] 
          },
          { 
            ageMin: 75, ageMax: 79,
            veryWeak: [-999, 15], 
            weak: [15, 16], 
            normal: [17, 19], 
            good: [20, 22], 
            veryGood: [22, 999] 
          },
          { 
            ageMin: 80, ageMax: 84,
            veryWeak: [-999, 14], 
            weak: [14, 15], 
            normal: [16, 18], 
            good: [19, 999], 
            veryGood: [19, 999] 
          },
          { 
            ageMin: 85, ageMax: 89,
            veryWeak: [-999, 12], 
            weak: [12, 13], 
            normal: [14, 15], 
            good: [16, 17], 
            veryGood: [17, 999] 
          },
          { 
            ageMin: 90, ageMax: 999,
            veryWeak: [-999, 11], 
            weak: [12, 13], 
            normal: [14, 15], 
            good: [16, 17], 
            veryGood: [17, 999] 
          }
        ],
        sitReach: [
          { 
            ageMin: 65, ageMax: 69,
            veryWeak: [-999, -3], 
            weak: [-3, 0], 
            normal: [1, 3], 
            good: [4, 8], 
            veryGood: [8, 999] 
          },
          { 
            ageMin: 70, ageMax: 74,
            veryWeak: [-999, -4], 
            weak: [-4, 0], 
            normal: [1, 4], 
            good: [5, 9], 
            veryGood: [9, 999] 
          },
          { 
            ageMin: 75, ageMax: 79,
            veryWeak: [-999, -5], 
            weak: [-5, 0], 
            normal: [1, 3], 
            good: [4, 7], 
            veryGood: [7, 999] 
          },
          { 
            ageMin: 80, ageMax: 84,
            veryWeak: [-999, -8.5], 
            weak: [-8.5, -5], 
            normal: [-4, -0.5], 
            good: [0, 5], 
            veryGood: [5, 999] 
          },
          { 
            ageMin: 85, ageMax: 89,
            veryWeak: [-999, -10], 
            weak: [-10, -7], 
            normal: [-6, -4], 
            good: [-3, 1], 
            veryGood: [3, 999] 
          },
          { 
            ageMin: 90, ageMax: 999,
            veryWeak: [-999, -12], 
            weak: [-12, -7], 
            normal: [-6, -2], 
            good: [-1, 2], 
            veryGood: [2, 999] 
          }
        ],
        backStretching: [
          { 
            ageMin: 65, ageMax: 69,
            veryWeak: [-999, -18], 
            weak: [-18, -13], 
            normal: [-12, -8], 
            good: [-7, -1], 
            veryGood: [1, 999] 
          },
          { 
            ageMin: 70, ageMax: 74,
            veryWeak: [-999, -20], 
            weak: [-20, -14], 
            normal: [-13, -7], 
            good: [-6, 0], 
            veryGood: [0, 999] 
          },
          { 
            ageMin: 75, ageMax: 79,
            veryWeak: [-999, -23], 
            weak: [-23, -16], 
            normal: [-15, -8], 
            good: [-7, 0], 
            veryGood: [0, 999] 
          },
          { 
            ageMin: 80, ageMax: 84,
            veryWeak: [-999, -25], 
            weak: [-25, -18], 
            normal: [-17, -11], 
            good: [-10, -4], 
            veryGood: [4, 999] 
          },
          { 
            ageMin: 85, ageMax: 89,
            veryWeak: [-999, -26], 
            weak: [-26, -19], 
            normal: [-18, -12], 
            good: [-11, -4], 
            veryGood: [4, 999] 
          },
          { 
            ageMin: 90, ageMax: 999,
            veryWeak: [-999, -26.5], 
            weak: [-26.5, -19.5], 
            normal: [-19.4, -12.4], 
            good: [-12.3, -7], 
            veryGood: [7, 999] 
          }
        ],
        handGrip: [
          { 
            ageMin: 65, ageMax: 69,
            veryWeak: [-999, 30.7], 
            weak: [30.7, 36.6], 
            normal: [36.7, 42.6], 
            good: [42.7, 48.5], 
            veryGood: [48.5, 999] 
          },
          { 
            ageMin: 70, ageMax: 74,
            veryWeak: [-999, 30.2], 
            weak: [30.2, 36.1], 
            normal: [36.2, 42], 
            good: [43, 48], 
            veryGood: [48, 999] 
          },
          { 
            ageMin: 75, ageMax: 79,
            veryWeak: [-999, 28.2], 
            weak: [28.2, 33.4], 
            normal: [33.5, 38.7], 
            good: [38.8, 44], 
            veryGood: [44, 999] 
          },
          { 
            ageMin: 80, ageMax: 84,
            veryWeak: [-999, 21.3], 
            weak: [21.3, 25.9], 
            normal: [26, 30.6], 
            good: [30.7, 35.1], 
            veryGood: [35.1, 999] 
          },
          { 
            ageMin: 85, ageMax: 89,
            veryWeak: [-999, 21.3], 
            weak: [21.3, 25.9], 
            normal: [26, 30.6], 
            good: [30.7, 35.1], 
            veryGood: [35.1, 999] 
          },
          { 
            ageMin: 90, ageMax: 999,
            veryWeak: [-999, 21.3], 
            weak: [21.3, 25.9], 
            normal: [26, 30.6], 
            good: [30.7, 35.1], 
            veryGood: [35.1, 999] 
          }
        ],
        speedWalking: [
          { 
            ageMin: 65, ageMax: 69,
            veryWeak: [7.2, 999], 
            weak: [6.6, 7.2], 
            normal: [5.9, 6.5], 
            good: [5.2, 5.8], 
            veryGood: [-999, 5.2] 
          },
          { 
            ageMin: 70, ageMax: 74,
            veryWeak: [8.0, 999], 
            weak: [7.24, 8.0], 
            normal: [6.47, 7.23], 
            good: [5.7, 6.46], 
            veryGood: [-999, 5.7] 
          },
          { 
            ageMin: 75, ageMax: 79,
            veryWeak: [9.0, 999], 
            weak: [8.07, 9.0], 
            normal: [7.13, 8.06], 
            good: [6.2, 7.12], 
            veryGood: [-999, 6.2] 
          },
          { 
            ageMin: 80, ageMax: 84,
            veryWeak: [10.4, 999], 
            weak: [9.24, 10.4], 
            normal: [8.07, 9.23], 
            good: [6.9, 8.06], 
            veryGood: [-999, 6.9] 
          },
          { 
            ageMin: 85, ageMax: 89,
            veryWeak: [11.6, 999], 
            weak: [10.27, 11.6], 
            normal: [9.13, 10.26], 
            good: [7.6, 9.12], 
            veryGood: [-999, 7.6] 
          },
          { 
            ageMin: 90, ageMax: 999,
            veryWeak: [14.0, 999], 
            weak: [12.27, 14.0], 
            normal: [10.53, 12.26], 
            good: [8.8, 10.52], 
            veryGood: [-999, 8.8] 
          }
        ],
        marching: [
          { 
            ageMin: 65, ageMax: 69,
            veryWeak: [-999, 82], 
            weak: [82, 91], 
            normal: [92, 101], 
            good: [102, 109], 
            veryGood: [109, 999] 
          },
          { 
            ageMin: 70, ageMax: 74,
            veryWeak: [-999, 76], 
            weak: [76, 85], 
            normal: [86, 95], 
            good: [96, 104], 
            veryGood: [104, 999] 
          },
          { 
            ageMin: 75, ageMax: 79,
            veryWeak: [-999, 67], 
            weak: [67, 77], 
            normal: [78, 88], 
            good: [89, 99], 
            veryGood: [99, 999] 
          },
          { 
            ageMin: 80, ageMax: 84,
            veryWeak: [-999, 59], 
            weak: [59, 71], 
            normal: [72, 84], 
            good: [85, 97], 
            veryGood: [97, 999] 
          },
          { 
            ageMin: 85, ageMax: 89,
            veryWeak: [-999, 54], 
            weak: [54, 67], 
            normal: [68, 81], 
            good: [82, 94], 
            veryGood: [94, 999] 
          },
          { 
            ageMin: 90, ageMax: 999,
            veryWeak: [-999, 47], 
            weak: [47, 62], 
            normal: [63, 78], 
            good: [79, 93], 
            veryGood: [93, 999] 
          }
        ]
      }
    }

    // Find appropriate age range and scoring table
    const genderKey = gender?.toLowerCase()
    
    // Convert stationName to match scoring table keys
    let stationKey = stationName
    if (stationName === 'onTheSpotMarching' || stationName === 'marching') {
      stationKey = 'marching'
    } else if (stationName === 'armBanding') {
      stationKey = 'armBending'
    } else if (stationName === 'handGriping' || stationName === 'handGripTest') {
      stationKey = 'handGrip'
    } else if (stationName === 'sitReach') {
      stationKey = 'sitReach'
    } else if (stationName === 'backStretching') {
      stationKey = 'backStretching'
    } else if (stationName === 'speedWalking') {
      stationKey = 'speedWalking'
    }

    // Check if we have valid inputs
    if (age < 65 || !genderKey || !scoringTables[genderKey] || !scoringTables[genderKey][stationKey]) {
      return { category: 'Not Assessed', range: '' }
    }

    // Find the appropriate age range in the scoring table
    const stationRanges = scoringTables[genderKey][stationKey]
    let ageRangeData = null
    
    for (const range of stationRanges) {
      if (age >= range.ageMin && age <= range.ageMax) {
        ageRangeData = range
        break
      }
    }

    if (!ageRangeData) {
      return { category: 'Not Assessed', range: '' }
    }

    const numScore = parseFloat(score)

    if (isNaN(numScore)) return { category: 'Not Assessed', range: '' }

    // Check which range the score falls into
    for (const [category, range] of Object.entries(ageRangeData)) {
      // Skip the ageMin and ageMax properties
      if (category === 'ageMin' || category === 'ageMax') continue
      
      if (numScore >= range[0] && numScore <= range[1]) {
        // Format the category name and add the range
        const categoryName = category.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()
        let rangeText
        if (range[0] === -999) {
          rangeText = `≤${range[1]}`
        } else if (range[1] === 999) {
          rangeText = `${range[0]}+`
        } else {
          rangeText = `${range[0]}-${range[1]}`
        }
        return { category: categoryName, range: rangeText }
      }
    }

    return { category: 'Not Assessed', range: '' }
  }

  // Helper function to get the higher score between score1 and score2
  getHigherScore = (stationData) => {
    const score1 = parseFloat(stationData.score1) || 0
    const score2 = parseFloat(stationData.score2) || 0
    
    // Return the higher score, or null if both are 0 or invalid
    if (score1 === 0 && score2 === 0) return null
    return Math.max(score1, score2)
  }

  // Comprehensive data clearing method
  clearAllAppData = () => {
    // Ask for confirmation before clearing all data
    const confirmMessage = 'Are you sure you want to clear all app data and restart? This will:\n\n' +
      '• Clear all saved participant information\n' +
      '• Clear all form data and offline storage\n' +
      '• Reset language preferences\n' +
      '• Clear mobile/tablet device cache\n' +
      '• Remove all app data from device storage\n' +
      '• Return to the participant form page\n\n' +
      'This action cannot be undone and will affect all data stored on this device.';
    
    if (!window.confirm(confirmMessage)) {
      return; // User cancelled
    }

    try {
      console.log('🗑️ Starting comprehensive data clearing...');

      // Show loading message to user
      const originalButton = document.querySelector('.done-button');
      if (originalButton) {
        originalButton.textContent = 'Clearing Data...';
        originalButton.disabled = true;
      }

      // 1. Use the app's data manager to clear all managed data
      try {
        const clearResult = dataManager.clearAll();
        console.log('🗑️ DataManager clearAll result:', clearResult);
      } catch (dmError) {
        console.warn('⚠️ DataManager clearAll failed:', dmError);
      }

      // 2. Clear all localStorage entries (including our app-specific ones)
      localStorage.clear();
      
      // 3. Clear sessionStorage
      sessionStorage.clear();
      
      // 4. Clear any potential data from the DataManager system (backup)
      // This covers the app's sophisticated data management keys
      const appKeys = [
        'ecss_ffip_participants_state',
        'ecss_ffip_participant_id', 
        'ecss_ffip_volunteers_state',
        'ecss_ffip_language_preference',
        'ecss_ffip_trainers_state',
        'ecss_ffip_form_autosave',
        'participantsAppState',
        'volunteersAppState',
        'participantId',
        // Additional mobile/tablet specific keys
        'ecss_ffip_current_participant',
        'ecss_ffip_selected_participant',
        'ecss_ffip_participant_data',
        'ecss_ffip_offline_data',
        'ecss_ffip_sync_queue',
        'ecss_ffip_cache_timestamp',
        'ecss_ffip_device_id',
        'ecss_ffip_session_data',
        'ecss_ffip_temp_data',
        'ecss_ffip_form_state',
        'ecss_ffip_navigation_state',
        'ecss_ffip_app_version',
        'participant_form_data',
        'current_participant_id',
        'selected_participant',
        'app_state',
        'form_autosave',
        'device_preferences',
        'offline_queue'
      ];
      
      // Clear each key individually as backup
      appKeys.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      
      // 4a. Enhanced mobile/tablet storage clearing
      // Clear any keys that might be dynamically generated with participant IDs
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.includes('ecss_ffip') || 
          key.includes('participant') || 
          key.includes('volunteer') || 
          key.includes('trainer') ||
          key.includes('form_data') ||
          key.includes('app_state') ||
          key.includes('device_') ||
          key.includes('offline_')
        )) {
          localStorage.removeItem(key);
          // Adjust index since we removed an item
          i--;
        }
      }
      
      // Same for sessionStorage
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (
          key.includes('ecss_ffip') || 
          key.includes('participant') || 
          key.includes('volunteer') || 
          key.includes('trainer') ||
          key.includes('form_data') ||
          key.includes('app_state') ||
          key.includes('device_') ||
          key.includes('offline_')
        )) {
          sessionStorage.removeItem(key);
          // Adjust index since we removed an item
          i--;
        }
      }
      
      // 5. Clear any cache or temporary data (enhanced for mobile/tablet)
      if ('caches' in window) {
        caches.keys().then(names => {
          console.log('🗑️ Clearing caches:', names);
          names.forEach(name => {
            caches.delete(name).then(success => {
              console.log(`🗑️ Cache ${name} cleared:`, success);
            });
          });
        }).catch(error => {
          console.warn('⚠️ Cache clearing failed:', error);
        });
      }
      
      // 6. Enhanced IndexedDB clearing for mobile/tablet devices
      if ('indexedDB' in window) {
        // More comprehensive database names for mobile apps
        const dbNames = [
          'ecss_ffip', 
          'app_data', 
          'user_data',
          'participant_data',
          'offline_data',
          'sync_data',
          'cache_data',
          'form_data',
          'device_data',
          'keyval-store', // Common key-value store name
          'workbox-precache', // Service worker cache
          'workbox-runtime', // Runtime cache
          'pwa-cache' // PWA cache
        ];
        
        dbNames.forEach(dbName => {
          try {
            const deleteReq = indexedDB.deleteDatabase(dbName);
            deleteReq.onsuccess = () => console.log(`🗑️ Cleared IndexedDB: ${dbName}`);
            deleteReq.onerror = () => console.log(`⚠️ Could not clear IndexedDB: ${dbName}`);
            deleteReq.onblocked = () => console.log(`⚠️ IndexedDB delete blocked: ${dbName}`);
          } catch (e) {
            console.warn(`⚠️ IndexedDB deletion failed for ${dbName}:`, e);
          }
        });
      }
      
      // 6a. Clear any BroadcastChannel data (used for cross-tab communication)
      try {
        if ('BroadcastChannel' in window) {
          // Clear any app-specific broadcast channels
          const channelNames = ['ecss_ffip_sync', 'participant_updates', 'app_updates'];
          channelNames.forEach(channelName => {
            try {
              const channel = new BroadcastChannel(channelName);
              channel.postMessage({ type: 'CLEAR_DATA' });
              channel.close();
            } catch (e) {
              console.warn(`⚠️ BroadcastChannel ${channelName} clearing failed:`, e);
            }
          });
        }
      } catch (e) {
        console.warn('⚠️ BroadcastChannel clearing failed:', e);
      }
      
      // 7. Clear any potential WebSQL data (legacy browsers)
      if ('openDatabase' in window) {
        try {
          const db = window.openDatabase('', '', '', '');
          db.transaction(tx => {
            tx.executeSql('DROP TABLE IF EXISTS data');
          });
        } catch (e) {
          // Silently fail if WebSQL not supported
        }
      }
      
      // 8. Mobile/Tablet specific clearing mechanisms
      
      // 8a. Clear Service Worker data and force update
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          console.log('🗑️ Clearing service workers:', registrations.length);
          registrations.forEach(registration => {
            registration.unregister().then(success => {
              console.log('🗑️ Service worker unregistered:', success);
            });
          });
        }).catch(error => {
          console.warn('⚠️ Service worker clearing failed:', error);
        });
      }
      
      // 8b. Clear any persistent notifications
      if ('Notification' in window && 'getNotifications' in Notification) {
        Notification.getNotifications().then(notifications => {
          notifications.forEach(notification => {
            notification.close();
          });
        }).catch(error => {
          console.warn('⚠️ Notification clearing failed:', error);
        });
      }
      
      // 8c. Clear any background sync registrations
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        navigator.serviceWorker.ready.then(registration => {
          // Note: There's no direct way to clear background sync registrations
          // They will naturally expire or can be handled by the service worker
          console.log('🗑️ Background sync registrations handled by service worker');
        }).catch(error => {
          console.warn('⚠️ Background sync clearing failed:', error);
        });
      }
      
      // 8d. Clear any Web Push subscriptions
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        navigator.serviceWorker.ready.then(registration => {
          return registration.pushManager.getSubscription();
        }).then(subscription => {
          if (subscription) {
            return subscription.unsubscribe();
          }
        }).then(success => {
          if (success) {
            console.log('🗑️ Push subscription unsubscribed');
          }
        }).catch(error => {
          console.warn('⚠️ Push subscription clearing failed:', error);
        });
      }
      
      // 8e. Force clear any in-memory app state
      try {
        // Reset any global app state variables
        if (window.appState) {
          window.appState = null;
        }
        if (window.participantData) {
          window.participantData = null;
        }
        if (window.formData) {
          window.formData = null;
        }
        // Clear any React component state that might persist
        if (window.React && window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) {
          // Force React to re-render from scratch
          console.log('🗑️ Forcing React state cleanup');
        }
      } catch (e) {
        console.warn('⚠️ In-memory state clearing failed:', e);
      }
      
      // 8f. Clear any device-specific storage (Cordova/PhoneGap apps)
      try {
        if (window.cordova && window.cordova.file) {
          // For Cordova/PhoneGap apps, clear local file storage
          console.log('🗑️ Cordova environment detected, clearing file storage');
          // Note: This would require specific Cordova file plugin implementation
        }
      } catch (e) {
        console.warn('⚠️ Cordova storage clearing failed:', e);
      }
      
      console.log('✅ All app data cleared successfully (enhanced for mobile/tablet)');
      
      // 9. Clear language preference to force language selection on restart
      localStorage.removeItem('ecss_ffip_language_preference');
      localStorage.removeItem('selectedLanguage');
      localStorage.removeItem('language');
      
      // 10. Redirect to root to start the full navigation flow
      // This forces: Language Selection → Home → Participants → Form
      console.log('🔄 Redirecting to language selection to start fresh navigation flow');
      window.location.replace("/");
      
    } catch (error) {
      console.error('❌ Error during data clearing:', error);
      
      // Enhanced fallback for mobile devices
      const isMobile = navigator.userAgent.match(/Mobile|Tablet|Android|iPhone|iPad/i);
      if (isMobile) {
        alert('Data clearing completed. The app will now restart.\n\nNote: If you still see old data, please close and reopen your browser/app.');
      } else {
        alert('Data clearing completed with some issues. The app will now restart.');
      }
      
      // Clear language preference to force language selection
      localStorage.removeItem('ecss_ffip_language_preference');
      localStorage.removeItem('selectedLanguage');
      localStorage.removeItem('language');
      
      // Redirect to root for full navigation flow
      console.log('🔄 Error fallback: Redirecting to language selection');
      window.location.replace("/");
    }
  }

  render() {
    console.log('ParticipantDetails this.props:', this.props)
    const { participant, language, onClose } = this.props
    console.log('ParticipantDetails render', participant, language)
    
    // Debug logging for height, weight, BMI
    console.log('🔍 Debug participant data:', {
      height: participant?.height,
      weight: participant?.weight,
      bmi: participant?.bmi,
      liveHeight: this.state.liveHeight,
      liveWeight: this.state.liveWeight,
      liveBMI: this.state.liveBMI
    })
    
    // Debug the entire participant object structure
    console.log('🔍 Complete participant object:', participant)
    console.log('🔍 Participant keys:', Object.keys(participant || {}))
    
    // Handle case where props might not be available yet
    if (!participant) {
      console.log('ParticipantDetails: Missing participant prop', this.props)
      return <div>Loading participant details...</div>
    }
    
    // Provide default language if not available
    const currentLanguage = language || 'en'
    const t = translations[currentLanguage] || translations['en'] || {}
    
    // Provide fallback values for common translation keys
    const fallbackT = {
      personalInformation: 'Personal Information',
      stationResults: 'Station Results',
      age: 'Age',
      dateOfBirth: 'Date of Birth',
      phoneNumber: 'Phone Number',
      gender: 'Gender',
      height: 'Height',
      weight: 'Weight',
      bmi: 'BMI',
      swipeInstructions: 'Swipe left/right to navigate',
      male: 'Male',
      female: 'Female',
      ...t
    }
    return (
      <div className="participant-details-view">
        <h2 className="participant-name">{participant.name}</h2>
        {/* Personal Information */}
        <div className="details-section">
          <h3 className="details-section-title">{fallbackT.personalInformation}</h3>
          <div className="personal-info-cards">
            {this.hasValue(participant.dateOfBirth) && (
              <div className="personal-info-card">
                <span className="personal-info-label">{fallbackT.age}</span>
                <span className="personal-info-value">{this.calculateAge(participant.dateOfBirth)}</span>
              </div>
            )}
            {this.hasValue(participant.dateOfBirth) && (
              <div className="personal-info-card">
                <span className="personal-info-label">{fallbackT.dateOfBirth}</span>
                <span className="personal-info-value">{
                  (() => {
                    const d = this.parseDate(participant.dateOfBirth);
                    return d ? d.toLocaleDateString() : participant.dateOfBirth;
                  })()
                }</span>
              </div>
            )}
            {this.hasValue(participant.phoneNumber) && (
              <div className="personal-info-card">
                <span className="personal-info-label">{fallbackT.phoneNumber}</span>
                <span className="personal-info-value">{participant.phoneNumber}</span>
              </div>
            )}
            {this.hasValue(participant.gender) && (
              <div className="personal-info-card">
                <span className="personal-info-label">{fallbackT.gender}</span>
                <span className="personal-info-value">{fallbackT[participant.gender.toLowerCase()] || participant.gender}</span>
              </div>
            )}
            {/* Live Height Field - Always show if data exists */}
            {(participant.height || this.state.liveHeight) && (
              <div className="personal-info-card">
                <span className="personal-info-label">{fallbackT.height || 'Height'}</span>
                <span className="personal-info-value">
                  {this.state.liveHeight || participant.height}
                </span>
              </div>
            )}
            {/* Live Weight Field - Always show if data exists */}
            {(participant.weight || this.state.liveWeight) && (
              <div className="personal-info-card">
                <span className="personal-info-label">{fallbackT.weight || 'Weight'}</span>
                <span className="personal-info-value">
                  {this.state.liveWeight || participant.weight}
                </span>
              </div>
            )}
            {/* Live BMI Field - Always show if data exists */}
            {(participant.bmi || this.state.liveBMI) && (
              <div className="personal-info-card">
                <span className="personal-info-label">{fallbackT.bmi || 'BMI'}</span>
                <span className="personal-info-value">
                  {this.state.liveBMI || participant.bmi}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Fitness Test Results */}
        <div className="details-section">
          <h3 className="details-section-title">{fallbackT.stationResults}</h3>
          <div className="stations-container">
            {this.renderStationResults(participant.stations)}
          </div>
        </div>

        <div className="swipe-instructions">
          <p className="swipe-instructions-text">{fallbackT.swipeInstructions}</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: 24 }}>
          <button
            type="button"
            className="done-button"
            style={{ 
              padding: '10px 32px', 
              fontSize: 16, 
              borderRadius: 8, 
              background: '#dc3545', 
              color: '#fff', 
              border: 'none', 
              cursor: 'pointer'
            }}
            onClick={() => { 
              // Comprehensive data clearing with confirmation
              this.clearAllAppData();
            }}
          >
            🗑️ Clear All & Exit
          </button>
        </div>
      </div>
    )
  }
}

export default ParticipantDetails
