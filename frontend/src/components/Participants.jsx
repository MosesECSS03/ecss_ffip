import React, { Component, useContext } from 'react'
import { translations } from '../utils/translations'
import LanguageContext from '../contexts/LanguageContext'
import './Pages.css'
import axios from "axios"
import QRCode from 'qrcode'
import ParticipantForm from './ParticipantForm'
import SwipeView from './SwipeView'
import { io } from 'socket.io-client' // Uncommented import for socket.io-client

// If you need to use socket.io-client, import as needed below or in the relevant method/component.

const API_BASE_URL =
  window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://ecss-fft.azurewebsites.net';


class Participants extends Component {
  constructor(props) {
    super(props)
    
    this.state = {
      isLoading: true, // Add loading state
      formData: {
        participantDetails: {
          participantName: '',
          phoneNumber: '',
          gender: '',
          dateOfBirth: '',
          nationality: '',
          email: '',
          homeAddress: '',
          relationshipStatus: '',
          children: '',
          profession: '',
          educationLevel: '',
          ethnicGroup: '',
          religion: '',
          stateOfOrigin: '',
          experienceWithIT: '',
          comfortWithTechnology: ''
        },
        healthDeclaration: {
          questions: {
            healthQuestion1: '',
            healthQuestion2: '',
            healthQuestion3: '',
            healthQuestion4: ''
          }
        }
      },
      showForm: false, // Start with false to prevent flickering
      hasSubmitted: false,
      participants: [],
      qrCodeUrl: '',
      showQRCode: false,
      currentParticipantId: null,
      showTableQRCode: false,
      tableQRCodeUrl: '',
      tableQRParticipantId: null,
      showResults: false,
      selectedParticipantResults: null,
      showSwipeView: false,
      swipeParticipantData: null,
      submissionError: null,
      dataStatusMessage: '', // For showing save/load notifications
      isGeneratingQR: false, // Loading state for QR generation
      qrGenerationError: null, // Error state for QR generation
      isInitializing: true // Add initialization state
    }
    this.socket = null;
  }
  
  // Add method to save state to localStorage
  saveStateToLocalStorage = (isRetry = false) => {
    try {
      const stateToSave = {
        participants: this.state.participants,
        formData: this.state.formData,
        hasSubmitted: this.state.hasSubmitted,
        showForm: this.state.showForm,
        showSwipeView: this.state.showSwipeView,
        swipeParticipantData: this.state.swipeParticipantData,
        lastUpdated: Date.now()
      };
      
      // Test if localStorage is available and has space
      const testKey = 'test_storage_' + Date.now();
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      
      localStorage.setItem('participantsAppState', JSON.stringify(stateToSave));
      console.log('💾 State saved to localStorage:', stateToSave);
      
      // Show brief notification
      this.setState({ dataStatusMessage: '💾 Data saved' });
      setTimeout(() => {
        this.setState({ dataStatusMessage: '' });
      }, 2000);
    } catch (error) {
      console.error('❌ Error saving state to localStorage:', error);
      
      // If this is not a retry and we get a storage error, try to recover
      if (!isRetry && (error.name === 'QuotaExceededError' || error.message.includes('quota'))) {
        console.log('🔄 Storage quota exceeded, attempting cleanup and retry...');
        this.cleanUpLocalStorage();
        // Try one more time after cleanup
        this.saveStateToLocalStorage(true);
        return;
      }
      
      this.setState({ dataStatusMessage: '❌ Failed to save data' });
      setTimeout(() => {
        this.setState({ dataStatusMessage: '' });
      }, 3000);
    }
  }

  // Add method to load state from localStorage
  loadStateFromLocalStorage = () => {
    return new Promise((resolve) => {
      try {
        const savedState = localStorage.getItem('participantsAppState');
        if (savedState) {
          const parsedState = JSON.parse(savedState);
          
          // Check if the saved state is not too old (e.g., 24 hours)
          const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
          const age = Date.now() - (parsedState.lastUpdated || 0);
          
          if (age < maxAge) {
            console.log('🔄 Loading saved form data from localStorage');
            console.log('📝 Saved form data:', parsedState.formData);
            
            // Merge saved state with current state, being careful about structure
            const newState = {
              participants: parsedState.participants || [],
              formData: {
                ...this.state.formData,
                ...parsedState.formData,
                participantDetails: {
                  ...this.state.formData.participantDetails,
                  ...(parsedState.formData?.participantDetails || {})
                },
                healthDeclaration: {
                  ...this.state.formData.healthDeclaration,
                  ...(parsedState.formData?.healthDeclaration || {}),
                  questions: {
                    ...this.state.formData.healthDeclaration.questions,
                    ...(parsedState.formData?.healthDeclaration?.questions || {})
                  }
                }
              },
              hasSubmitted: parsedState.hasSubmitted || false,
              showForm: parsedState.showForm !== undefined ? parsedState.showForm : true,
              showSwipeView: parsedState.showSwipeView || false,
              swipeParticipantData: parsedState.swipeParticipantData || null
            };
            
            this.setState(newState, () => {
              console.log('✅ State restored successfully');
              console.log('� Restored form data:', this.state.formData.participantDetails);
              resolve(true); // Return true to indicate data was loaded
            });
            
            // Clear the notification after 3 seconds
            setTimeout(() => {
              this.setState({ dataStatusMessage: '' });
            }, 3000);
            
          } else {
            console.log('⏰ Saved state is too old, starting fresh');
            localStorage.removeItem('participantsAppState');
            resolve(false);
          }
        } else {
          console.log('📝 No saved state found, starting fresh');
          resolve(false);
        }
      } catch (error) {
        console.error('❌ Error loading state from localStorage:', error);
        
        // If there's a parsing error or corruption, attempt recovery
        if (error instanceof SyntaxError || error.message.includes('JSON')) {
          console.log('🔄 Detected corrupted data, cleaning up...');
          localStorage.removeItem('participantsAppState');
          this.setState({ dataStatusMessage: '❌ Previous data was corrupted, starting fresh' });
          setTimeout(() => {
            this.setState({ dataStatusMessage: '' });
          }, 3000);
        } else {
          // For other errors, just clear and notify
          localStorage.removeItem('participantsAppState');
          this.setState({ dataStatusMessage: '❌ Failed to restore previous data' });
          setTimeout(() => {
            this.setState({ dataStatusMessage: '' });
          }, 3000);
        }
        resolve(false);
      }
    });
  }

  // Add method to clear saved state
  clearSavedState = () => {
    localStorage.removeItem('participantsAppState');
    console.log('🗑️ Saved state cleared from localStorage');
    this.setState({ 
      dataStatusMessage: '🗑️ Saved data cleared successfully' 
    });
    setTimeout(() => {
      this.setState({ dataStatusMessage: '' });
    }, 2000);
  }

  // Test function to force save current state
  testSave = () => {
    console.log('🧪 Test Save - Current form data:', this.state.formData.participantDetails);
    this.saveStateToLocalStorage();
    console.log('🧪 Check localStorage after save:', localStorage.getItem('participantsAppState'));
  }

  // Test function to manually load data
  testLoad = async () => {
    console.log('🧪 Test Load - Starting manual load...');
    const loaded = await this.loadStateFromLocalStorage();
    console.log('🧪 Load result:', loaded);
    console.log('🧪 Form data after load:', this.state.formData.participantDetails);
  }

  // Test function to manually trigger save and reload
  testDataPersistence = () => {
    console.log('🧪 Testing data persistence...');
    console.log('🧪 Current form data:', this.state.formData);
    console.log('🧪 Current localStorage content:', localStorage.getItem('participantsAppState'));
    this.immediateSave();
    
    // Also test loading
    setTimeout(() => {
      const saved = localStorage.getItem('participantsAppState');
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('🧪 Saved data in localStorage:', parsed.formData);
      }
    }, 100);
    
    this.setState({ dataStatusMessage: '🧪 Test save completed - check console logs' });
    setTimeout(() => {
      this.setState({ dataStatusMessage: '' });
    }, 3000);
  }

  componentDidMount = async () => {
    try {
      console.log('🔌 Connecting to Socket.IO at:', API_BASE_URL);
      
      // Mobile browser check
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      console.log('📱 Mobile device detected:', isMobile);
      
      // Debug: Check what's in localStorage before loading
      const rawData = localStorage.getItem('participantsAppState');
      console.log('🔍 Raw localStorage data:', rawData);
      console.log('🔍 localStorage length:', rawData ? rawData.length : 'null');
      
      // Test localStorage availability on mobile
      try {
        const testKey = 'mobile_test_' + Date.now();
        localStorage.setItem(testKey, 'test');
        const testValue = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);
        console.log('✅ localStorage test successful:', testValue === 'test');
      } catch (storageError) {
        console.error('❌ localStorage test failed:', storageError);
      }
      
      // Add beforeunload listener to save data when user leaves/refreshes
      window.addEventListener('beforeunload', this.handleBeforeUnload);
      
      // Set loading state at the beginning
      this.setState({ 
        isLoading: true,
        dataStatusMessage: '🔄 Initializing...' 
      });
      
      // Load saved state first - this will restore form data if it exists
      const loaded = await this.loadStateFromLocalStorage();
      
      if (loaded) {
        console.log('✅ Data loaded successfully');
        
        // Determine the appropriate initial view based on loaded data
        console.log('🔍 Checking loaded state - hasSubmitted:', this.state.hasSubmitted, 'hasFormData:', this.hasFilledFormData());
        
        if (this.state.hasSubmitted && this.hasFilledFormData()) {
          console.log('📱 User has submitted form, showing details view');
          // User has submitted, don't show form by default
          this.setState({ 
            showForm: false,
            isLoading: false,
            dataStatusMessage: '✅ Welcome back! Your details are saved.' 
          });
        } else if (this.hasFilledFormData()) {
          console.log('📱 User has form data but not submitted, showing form');
          // User has partial data, show form to continue
          this.setState({ 
            showForm: true,
            isLoading: false,
            dataStatusMessage: '📝 Continue filling your form' 
          });
        } else {
          console.log('📱 No relevant data, showing fresh form');
          this.setState({ 
            showForm: true,
            isLoading: false 
          });
        }
        
      } else {
        console.log('ℹ️ No data was loaded or data was expired');
        // No saved data, show fresh form
        this.setState({ 
          showForm: true,
          isLoading: false 
        });
      }
      
      // --- SOCKET.IO ---
      this.socket = io(API_BASE_URL);

      // Add connection event listeners for debugging
      this.socket.on('connect', () => {
        console.log('✅ Socket connected to server with ID:', this.socket.id);
      });

      this.socket.on('disconnect', () => {
        console.log('❌ Socket disconnected from server');
      });

      this.socket.on('connect_error', (error) => {
        console.error('🚫 Socket connection error:', error);
      });

      // Listen for participant updates and refresh data live
      this.socket.on('participant-updated', (data) => {
        try {
          console.log("🔔 Socket event received", data);
          console.log("🔄 Triggering handleParticipantUpdate...");
          
          // Check if this event is for the current participant to avoid unnecessary updates
          const currentParticipantId = this.getCurrentParticipantId();
          console.log("Current participant ID:", currentParticipantId);
          console.log("Event participant ID:", data.participantID);
          
          // Update only if it matches current participant and user doesn't have form data
          if (currentParticipantId === data.participantID) {
            console.log("✅ Event matches current participant");
            
            // Don't override form data if user is currently filling it
            if (!this.hasFilledFormData()) {
              console.log("🔄 No form data, updating from socket event");
              this.handleParticipantUpdate();
            } else {
              console.log("📝 User has form data, not updating from socket event");
            }
          } else {
            console.log("ℹ️ Event for different participant, ignoring update");
          }
        } catch (socketEventError) {
          console.error('❌ Error handling socket event:', socketEventError);
        }
      });

      // Only check for existing participant if user hasn't filled out form data
      const hasFormData = this.hasFilledFormData();
      console.log('📝 Has form data filled:', hasFormData);
      
      if (!hasFormData && !loaded) {
        // Only attempt to load participant data if no form data exists and nothing was loaded
        await this.handleParticipantUpdate();
      } else {
        console.log('📝 Form data exists, keeping form visible for completion');
        // Ensure form stays visible with the saved data
        this.setState({
          showForm: true,
          hasSubmitted: false,
          showSwipeView: false,
          isLoading: false,
          isInitializing: false
        });
      }
      
      // Complete initialization and clear status message
      this.setState({ 
        isLoading: false,
        isInitializing: false 
      });
      
      // Clear the status message after a few seconds
      setTimeout(() => {
        this.setState({ dataStatusMessage: '' });
      }, 3000);
      
    } catch (mountError) {
      console.error('❌ Error in componentDidMount:', mountError);
      // Set error state to show user-friendly message
      this.setState({ 
        submissionError: 'Failed to initialize connection. Please refresh the page.',
        isLoading: false,
        isInitializing: false
      });
    }
  }

  handleParticipantUpdate = async () => {
    // Prevent multiple simultaneous updates
    if (this.isUpdatingParticipants) {
      console.log('Participant update already in progress, skipping...');
      return;
    }
    
    this.isUpdatingParticipants = true;
    let participantId = null;

    try {
      const saved = localStorage.getItem('participantId');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.participantId) {
          participantId = parsed.participantId;
        }
      }
    } catch (e) {
      console.warn('Failed to parse participantId from localStorage:', e);
    }

    if (participantId) {
      try {
        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        const response = await axios.post(`${API_BASE_URL}/participants`, {
          purpose: 'retrieveParticipant',
          participantID: participantId
        }, {
          signal: controller.signal,
          timeout: 15000
        });

        clearTimeout(timeoutId);
        console.log('🔄 Retrieved participant from backend:', response.data);

        if (response.data && response.data.success && response.data.data) {
          // User has successfully submitted before, show swipe view
          this.setState({
            participants: [response.data.data],
            showForm: false,
            hasSubmitted: true,
            showSwipeView: true,
            swipeParticipantData: response.data.data,
            submissionError: null,
            isInitializing: false
          }, () => {
            // Immediately save state after successful participant retrieval
            this.immediateSave();
          });
          this.isUpdatingParticipants = false;
          return;
        }
      } catch (err) {
        console.error('Error retrieving participant from backend:', err);
        
        // Handle specific error types but don't override form state
        if (err.name === 'AbortError') {
          console.log('Request timeout - participant may not exist yet');
        } else if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
          console.log('Connection timeout - will show form');
        } else {
          console.log('Failed to retrieve participant - will show form');
        }
      }
    }

    // Check if user has form data filled - if so, keep the form visible
    const hasFormData = this.hasFilledFormData();
    
    if (hasFormData) {
      console.log('📝 User has filled form data, keeping form visible');
      this.setState({
        showForm: true,
        hasSubmitted: false,
        showSwipeView: false,
        swipeParticipantData: null,
        submissionError: null,
        isInitializing: false
      });
    } else {
      console.log('📝 No form data or participant found, showing fresh form');
      // Only reset to fresh form if no data exists
      this.setState({
        showForm: true,
        hasSubmitted: false,
        showSwipeView: false,
        swipeParticipantData: null,
        submissionError: null,
        isInitializing: false
      });
    }
    
    // Clean up the update flag
    this.isUpdatingParticipants = false;
  }

  componentWillUnmount() {
    try {
      // Cancel any pending debounced saves first
      if (this.debouncedSave && this.debouncedSave.cancel) {
        this.debouncedSave.cancel();
      }
      
      // Remove beforeunload listener
      window.removeEventListener('beforeunload', this.handleBeforeUnload);
      
      // Immediately save state before component unmounts
      this.immediateSave();
      console.log('💾 Data saved immediately before component unmount');
    } catch (error) {
      console.error('❌ Failed to save data on unmount:', error);
    }
    
    // Disconnect socket
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  // Save data when user is about to leave/refresh the page
  handleBeforeUnload = (event) => {
    console.log('📤 Page unloading, saving data...');
    this.saveStateToLocalStorage();
    // Note: Can't show custom messages in modern browsers, but data will be saved
  }
  
  // Generate QR code for participant ID - Enhanced for concurrent access
  generateQRCode = async (participantId) => {
    // Prevent multiple simultaneous QR generations
    if (this.state.isGeneratingQR) {
      console.log('QR generation already in progress, skipping...');
      return;
    }

    try {
      if (!participantId) {
        console.error('No participant ID provided for QR code generation');
        this.setState({ 
          qrGenerationError: 'No participant ID available for QR code generation' 
        });
        return;
      }
      
      console.log('Generating QR code for participant ID:', participantId);
      
      // Set loading state
      this.setState({ 
        isGeneratingQR: true, 
        qrGenerationError: null,
        dataStatusMessage: 'Generating QR code...'
      });
      
      // Create a resilient QR code with error correction for scanning reliability
      const qrDataPayload = {
        id: participantId.toString(),
        timestamp: Date.now(),
        checksum: this.generateChecksum(participantId.toString())
      };
      
      const qrPromise = QRCode.toDataURL(JSON.stringify(qrDataPayload), {
        width: 350,         // Optimized size for scanning
        margin: 2,          // Adequate margin for camera recognition
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'H' // High error correction for better scanning in poor conditions
      });
      
      // Add timeout to prevent hanging but increased for reliability
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('QR code generation timeout')), 15000)
      );
      
      const qrCodeUrl = await Promise.race([qrPromise, timeoutPromise]);
      
      // Validate QR code was generated properly
      if (!qrCodeUrl || !qrCodeUrl.startsWith('data:image')) {
        throw new Error('Invalid QR code generated');
      }
      
      this.setState({ 
        qrCodeUrl,
        showQRCode: true,
        currentParticipantId: participantId,
        isGeneratingQR: false,
        qrGenerationError: null,
        dataStatusMessage: 'QR code ready for scanning!'
      });
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        this.setState({ dataStatusMessage: '' });
      }, 3000);
      
      console.log('QR code generated successfully with high reliability settings');
    } catch (error) {
      console.error('Error generating QR code:', error);
      
      // Attempt fallback QR generation with simpler data
      try {
        console.log('Attempting fallback QR generation...');
        const fallbackQR = await QRCode.toDataURL(participantId.toString(), {
          width: 300,
          margin: 1,
          errorCorrectionLevel: 'M'
        });
        
        this.setState({
          qrCodeUrl: fallbackQR,
          showQRCode: true,
          currentParticipantId: participantId,
          isGeneratingQR: false,
          qrGenerationError: null,
          dataStatusMessage: 'QR code generated (fallback mode)'
        });
        
        setTimeout(() => {
          this.setState({ dataStatusMessage: '' });
        }, 3000);
        
      } catch (fallbackError) {
        console.error('Fallback QR generation also failed:', fallbackError);
        this.setState({
          isGeneratingQR: false,
          qrGenerationError: error.message || 'Failed to generate QR code',
          submissionError: 'Failed to generate QR code. Please try again.',
          dataStatusMessage: 'QR code generation failed'
        });
        
        // Clear error message after 5 seconds
        setTimeout(() => {
          this.setState({ dataStatusMessage: '', qrGenerationError: null });
        }, 5000);
      }
    }
  }

  // Helper method to generate checksum for QR data validation
  generateChecksum = (data) => {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Calculate age from date of birth
  calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return null
    const today = new Date()
    const birthDate = new Date(dateOfBirth)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    
    return age
  }

  // Format date to dd/mm/yyyy
  formatDateToDDMMYYYY = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  // Debounced save function to reduce localStorage writes
  debouncedSave = (() => {
    let timeoutId;
    const fn = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        this.saveStateToLocalStorage();
      }, 500); // Wait 500ms after last change
    };
    
    // Add cancel method for cleanup
    fn.cancel = () => {
      clearTimeout(timeoutId);
    };
    
    return fn;
  })()

  // Clean up corrupted localStorage data
  cleanUpLocalStorage = () => {
    try {
      const keysToClean = ['participants_state', 'participantId'];
      keysToClean.forEach(key => {
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          console.log(`🧹 Cleaned up corrupted localStorage key: ${key}`);
        }
      });
    } catch (error) {
      console.error('❌ Error cleaning localStorage:', error);
    }
  }

  // Recovery function for localStorage issues
  recoverFromStorageError = () => {
    try {
      console.log('🔄 Attempting to recover from storage error...');
      this.cleanUpLocalStorage();
      
      // Reset to a clean state
      this.setState({
        participants: [],
        formData: {
          participantDetails: {
            participantName: '',
            phoneNumber: '',
            gender: '',
            dateOfBirth: '',
            nationality: '',
            email: '',
            homeAddress: '',
            relationshipStatus: '',
            children: '',
            profession: '',
            educationLevel: '',
            ethnicGroup: '',
            religion: '',
            stateOfOrigin: '',
            experienceWithIT: '',
            comfortWithTechnology: ''
          },
          healthDeclaration: {
            questions: {
              healthQuestion1: '',
              healthQuestion2: '',
              healthQuestion3: '',
              healthQuestion4: ''
            }
          }
        },
        hasSubmitted: false,
        showForm: true,
        showSwipeView: false,
        swipeParticipantData: null,
        dataStatusMessage: '🔄 Data recovered - starting fresh'
      }, () => {
        // Clear the recovery message after a few seconds
        setTimeout(() => {
          this.setState({ dataStatusMessage: '' });
        }, 3000);
      });
      
      return true;
    } catch (error) {
      console.error('❌ Failed to recover from storage error:', error);
      return false;
    }
  }

  // Immediate save for critical operations
  immediateSave = () => {
    // Cancel any pending debounced save
    if (this.debouncedSave && this.debouncedSave.cancel) {
      this.debouncedSave.cancel();
    }
    // Save immediately
    this.saveStateToLocalStorage();
  }

  handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    console.log('📝 Input changed:', name, '=', value);
    const nameParts = name.split('.')
    
    // Determine if we should save immediately (for first few characters or important fields)
    const shouldSaveImmediately = value.length <= 3 || 
                                  name.includes('participantName') || 
                                  name.includes('phoneNumber');
    
    if (nameParts.length === 3) {
      // Handle nested structure like healthDeclaration.questions.healthQuestion1
      const [mainKey, subKey, fieldKey] = nameParts
      this.setState(prevState => ({
        formData: {
          ...prevState.formData,
          [mainKey]: {
            ...prevState.formData[mainKey],
            [subKey]: {
              ...prevState.formData[mainKey][subKey],
              [fieldKey]: type === 'checkbox' ? (checked ? value : '') : value
            }
          }
        }
      }), () => {
        console.log('📋 State updated, form data now:', this.state.formData.participantDetails);
      })
      
      // Save immediately or use debounced save
      if (shouldSaveImmediately) {
        console.log('💾 Immediate save triggered');
        this.saveStateToLocalStorage();
      } else {
        this.debouncedSave();
      }
    } else if (nameParts.length === 2) {
      // Handle two-level structure like participantDetails.participantName
      const [mainKey, subKey] = nameParts
      this.setState(prevState => ({
        formData: {
          ...prevState.formData,
          [mainKey]: {
            ...prevState.formData[mainKey],
            [subKey]: type === 'checkbox' ? checked : value
          }
        }
      }), () => {
        console.log('📋 State updated, form data now:', this.state.formData.participantDetails);
      })
      
      // Save immediately or use debounced save
      if (shouldSaveImmediately) {
        console.log('💾 Immediate save triggered');
        this.saveStateToLocalStorage();
      } else {
        this.debouncedSave();
      }
    } else {
      // Handle flat structure for backward compatibility
      this.setState(prevState => ({
        formData: {
          ...prevState.formData,
          [name]: type === 'checkbox' ? checked : value
        }
      }), () => {
        console.log('📋 State updated, form data now:', this.state.formData);
      })
      
      // Save immediately or use debounced save
      if (shouldSaveImmediately) {
        console.log('💾 Immediate save triggered');
        this.saveStateToLocalStorage();
      } else {
        this.debouncedSave();
      }
    }
  }

  handleSubmit = async (e) => {
    e.preventDefault();
    const { formData, participants } = this.state;

    if (formData.participantDetails.participantName.trim() && 
        formData.participantDetails.phoneNumber.trim()) {
      const calculatedAge = this.calculateAge(formData.participantDetails.dateOfBirth);

      const newParticipant = {
        id: participants.length + 1,
        name: formData.participantDetails.participantName.trim(),
        program: 'FFT Health Declaration',
        status: 'Registered',
        age: calculatedAge,
        gender: formData.participantDetails.gender,
        dateOfBirth: this.formatDateToDDMMYYYY(formData.participantDetails.dateOfBirth),
        phoneNumber: formData.participantDetails.phoneNumber,
        healthQuestions: formData.healthDeclaration,
        submittedAt: new Date().toISOString()
      };

      // Submit to backend first
      const backendResult = await this.submitToBackend(newParticipant);

      if (backendResult && backendResult.success) {
        // Use the backend response ID for the participant
        let backendId = backendResult.data && (backendResult.data._id || backendResult.data.id);
        if (backendId) {
          newParticipant.id = backendId;
        }
        // Only proceed if backend submission was successful
        const updatedParticipants = [...participants, newParticipant];

        this.setState(prevState => ({
          participants: updatedParticipants,
          submissionError: null,
          formData: {
            participantDetails: {
              participantName: '',
              phoneNumber: '',
              gender: '',
              dateOfBirth: '',
              nationality: '',
              email: '',
              homeAddress: '',
              relationshipStatus: '',
              children: '',
              profession: '',
              educationLevel: '',
              ethnicGroup: '',
              religion: '',
              stateOfOrigin: '',
              experienceWithIT: '',
              comfortWithTechnology: ''
            },
            healthDeclaration: {
              questions: {
                healthQuestion1: '',
                healthQuestion2: '',
                healthQuestion3: '',
                healthQuestion4: ''
              }
            }
          },
          showForm: false,
          hasSubmitted: true
        }), () => {
          // After successful submit, store only the backend _id as participantId in localStorage
          if (backendId) {
            localStorage.setItem('participantId', JSON.stringify({ participantId: backendId }));
            console.log('Stored participantId in localStorage:', backendId);
          }
          // Immediately save complete state to localStorage after form submission
          this.immediateSave();
          // Show swipe view with the new participant after state is updated
          this.showSwipeView(newParticipant.id);
        });
      } else {
        // Stay on the form - don't proceed to next screen
        this.setState({ 
          submissionError: backendResult.error || 'Submission failed. Please try again.' 
        });
      }
    }
  }

  // Function to submit form data to backend
  submitToBackend = async (participantData) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/participants`, {"purpose": "new", participantData})
      // Handle the backend response structure
      if (response.data && response.data.success) {
        return { 
          success: true, 
          data: response.data.data // Backend returns { success: true, data: {...} }
        }
      } else {
        return { 
          success: false, 
          error: response.data?.message || 'Unknown error' 
        }
      }
    } catch (error) {
      console.error('Error submitting participant data:', error)
      return { success: false, error: error.message }
    }
  }

  // Ensure showSwipeView is an arrow function to preserve 'this' context
  showSwipeView = (participantId) => {
    const participant = this.state.participants.find(p => p.id === participantId)
    this.setState({
      showSwipeView: true,
      swipeParticipantData: participant
    })
  }

  // Check if user has filled out form data
  hasFilledFormData = () => {
    const { formData } = this.state;
    
    // Check if any participant details are filled
    const hasParticipantData = Object.values(formData.participantDetails).some(value => 
      value && value.toString().trim() !== ''
    );
    
    // Check if any health questions are answered
    const hasHealthData = Object.values(formData.healthDeclaration.questions).some(value => 
      value && value.toString().trim() !== ''
    );
    
    return hasParticipantData || hasHealthData;
  }

  // Add the missing getCurrentParticipantId method
  getCurrentParticipantId = () => {
    try {
      const saved = localStorage.getItem('participantId');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed?.participantId;
      }
    } catch (e) {
      console.warn('Failed to parse participantId from localStorage:', e);
    }
    return null;
  }

  // Optimized QR code button handler with debouncing
  handleQRCodeClick = (participantId) => {
    // Prevent rapid clicks
    if (this.lastQRClickTime && Date.now() - this.lastQRClickTime < 1000) {
      console.log('QR button clicked too quickly, ignoring...');
      return;
    }
    
    this.lastQRClickTime = Date.now();
    this.generateQRCode(participantId);
  }

  // Optimized table QR code button handler with debouncing
  handleTableQRCodeClick = (participantId) => {
    // Prevent rapid clicks
    if (this.lastTableQRClickTime && Date.now() - this.lastTableQRClickTime < 1000) {
      console.log('Table QR button clicked too quickly, ignoring...');
      return;
    }
    
    this.lastTableQRClickTime = Date.now();
    this.generateTableQRCode(participantId);
  }

  // Enhanced QR code close with refresh capability
  closeQRCode = () => {
    this.setState({
      showQRCode: false,
      qrCodeUrl: '',
      currentParticipantId: null,
      isGeneratingQR: false,
      qrGenerationError: null
    });
  }

  // Add QR code refresh method
  refreshQRCode = async () => {
    const currentId = this.state.currentParticipantId;
    if (!currentId) {
      console.error('No participant ID available for QR refresh');
      return;
    }
    
    // Clear current QR and regenerate
    this.setState({ 
      qrCodeUrl: '', 
      qrGenerationError: null,
      dataStatusMessage: 'Refreshing QR code...' 
    });
    
    await this.generateQRCode(currentId);
  }

  // QR code health check
  validateQRCode = (qrCodeUrl) => {
    if (!qrCodeUrl) return false;
    if (!qrCodeUrl.startsWith('data:image')) return false;
    if (qrCodeUrl.length < 100) return false; // Too small to be valid
    return true;
  }

  closeTableQRCode = () => {
    this.setState({
      showTableQRCode: false,
      tableQRCodeUrl: '',
      tableQRParticipantId: null
    });
  }

  // Add missing close swipe view method
  closeSwipeView = () => {
    // Clear all participant data and navigation state
    this.setState({
      showSwipeView: false,
      swipeParticipantData: null,
      showForm: true,
      hasSubmitted: false,
      participants: []
    });
    
    // Navigate back to HomePage
    window.location.href = '/';
  }

  // Generate QR code for table participant - Optimized for performance
  generateTableQRCode = async (participantId) => {
    // Prevent multiple simultaneous QR generations
    if (this.state.isGeneratingQR) {
      console.log('QR generation already in progress, skipping...');
      return;
    }

    try {
      if (!participantId) {
        console.error('No participant ID provided for table QR code generation');
        this.setState({ 
          qrGenerationError: 'No participant ID available for table QR code generation' 
        });
        return;
      }
      
      console.log('Generating table QR code for participant ID:', participantId);
      
      // Set loading state
      this.setState({ 
        isGeneratingQR: true, 
        qrGenerationError: null,
        dataStatusMessage: 'Generating table QR code...'
      });
      
      // Use a timeout to prevent hanging
      const qrPromise = QRCode.toDataURL(participantId.toString(), {
        width: 300, // Reduced size for better performance
        margin: 1,  // Reduced margin
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'L' // Lower correction level for faster generation
      });
      
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Table QR code generation timeout')), 10000)
      );
      
      const qrCodeUrl = await Promise.race([qrPromise, timeoutPromise]);
      
      this.setState({
        tableQRCodeUrl: qrCodeUrl,
        showTableQRCode: true,
        tableQRParticipantId: participantId,
        isGeneratingQR: false,
        qrGenerationError: null,
        dataStatusMessage: 'Table QR code generated successfully!'
      });
      
      // Clear success message after 2 seconds
      setTimeout(() => {
        this.setState({ dataStatusMessage: '' });
      }, 2000);
      
      console.log('Table QR code generated successfully');
    } catch (error) {
      console.error('Error generating table QR code:', error);
      this.setState({
        isGeneratingQR: false,
        qrGenerationError: error.message || 'Failed to generate table QR code',
        submissionError: 'Failed to generate QR code. Please try again.',
        dataStatusMessage: 'Table QR code generation failed'
      });
      
      // Clear error message after 3 seconds
      setTimeout(() => {
        this.setState({ dataStatusMessage: '', qrGenerationError: null });
      }, 3000);
    }
  }

  render() {
    const { language } = this.props
    const t = translations[language]
    const { formData, showForm, participants, showQRCode, qrCodeUrl, currentParticipantId, showTableQRCode, tableQRCodeUrl, tableQRParticipantId, showResults, selectedParticipantResults, showSwipeView, swipeParticipantData, submissionError, isInitializing, isLoading } = this.state

    // Debug logging for render decisions
    console.log('🔍 Render Decision Debug:', {
      hasSubmitted: this.state.hasSubmitted,
      hasFilledFormData: this.hasFilledFormData(),
      showForm: showForm,
      showSwipeView: showSwipeView,
      swipeParticipantData: !!swipeParticipantData,
      isInitializing: isInitializing,
      isLoading: isLoading
    });

    // Show loading during initialization or data loading to prevent flickering
    if (isInitializing || isLoading) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <h2>Loading...</h2>
          <div style={{ fontSize: '48px', margin: '20px 0', animation: 'spin 2s linear infinite' }}>🔄</div>
          <p>{isLoading ? 'Loading saved data...' : 'Initializing application...'}</p>
        </div>
      )
    }

    // Show QR Code modal for table participant
    if (showTableQRCode && tableQRCodeUrl) {
      return (
        <div className="qr-modal-overlay" onClick={this.closeTableQRCode}>
          <div onClick={(e) => e.stopPropagation()}>
            <button className="qr-modal-close" onClick={this.closeTableQRCode}>
              ×
            </button>
            <h2 className="qr-modal-title">Participant QR Code</h2>
            <p className="qr-modal-subtitle">Present this QR code to the station master</p>
            <div className="qr-code-container">
              <img src={tableQRCodeUrl} alt="QR Code" className="qr-code-image" />
            </div>
            <p className="qr-modal-description">
              Station master will scan this code need to key in.
            </p>
            <div className="qr-modal-actions">
              <button onClick={this.closeTableQRCode} className="senior-submit-btn">
                Close
              </button>
            </div>
          </div>
        </div>
      )
    }

    // Show QR Code modal if QR code is generated or being generated - Enhanced for reliability
    if (showQRCode || this.state.isGeneratingQR) {
      return (
        <div className="qr-modal-overlay" onClick={!this.state.isGeneratingQR ? this.closeQRCode : undefined}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
            {!this.state.isGeneratingQR && (
              <button className="qr-modal-close" onClick={this.closeQRCode}>
                ×
              </button>
            )}
            
            {this.state.isGeneratingQR ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <h2 className="qr-modal-title">Generating QR Code...</h2>
                <div style={{ fontSize: '48px', margin: '20px 0', animation: 'spin 2s linear infinite' }}>🔄</div>
                <p className="qr-modal-subtitle">Please wait while we generate your QR code</p>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
                  Enhanced for multi-device scanning
                </p>
              </div>
            ) : this.state.qrGenerationError ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <h2 className="qr-modal-title">QR Code Generation Failed</h2>
                <p style={{ color: '#dc3545', margin: '20px 0' }}>{this.state.qrGenerationError}</p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button 
                    onClick={() => this.generateQRCode(currentParticipantId)}
                    style={{
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    Try Again
                  </button>
                  <button 
                    onClick={this.closeQRCode}
                    style={{
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : qrCodeUrl && this.validateQRCode(qrCodeUrl) ? (
              <>
                <h2 className="qr-modal-title">Registration Successful! 🎉</h2>
                <p className="qr-modal-subtitle">Present this QR code to the station master</p>
                <div className="qr-code-container" style={{ position: 'relative' }}>
                  <img 
                    src={qrCodeUrl} 
                    alt="QR Code" 
                    className="qr-code-image"
                    style={{ 
                      maxWidth: '100%', 
                      height: 'auto',
                      border: '2px solid #28a745',
                      borderRadius: '8px'
                    }}
                    onError={() => {
                      console.error('QR code image failed to load');
                      this.setState({ qrGenerationError: 'QR code corrupted. Please refresh.' });
                    }}
                  />
                  
                  {/* Refresh button */}
                  <button
                    onClick={this.refreshQRCode}
                    style={{
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '30px',
                      height: '30px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                    title="Refresh QR Code"
                  >
                    🔄
                  </button>
                  
                  {/* QR Status indicator */}
                  <div style={{
                    position: 'absolute',
                    bottom: '5px',
                    right: '5px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '10px',
                    fontWeight: 'bold'
                  }}>
                    READY
                  </div>
                </div>
                <p className="qr-modal-description">
                  ✅ Multi-device scanning enabled<br/>
                  🔄 Auto-refresh if corrupted<br/>
                  📱 Station master will scan this code to record your fitness test results
                </p>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '15px' }}>
                  If QR code appears black or unresponsive, click the refresh button (🔄) above
                </p>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <h2 className="qr-modal-title">QR Code Corrupted</h2>
                <p style={{ color: '#dc3545', margin: '20px 0' }}>The QR code appears to be corrupted or invalid.</p>
                <button 
                  onClick={this.refreshQRCode}
                  style={{
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  Generate New QR Code
                </button>
              </div>
            )}
          </div>
        </div>
      )
    }

    // Priority 1: Show swipe view if participant has completed registration
    if (showSwipeView && swipeParticipantData) {
      return (
        <SwipeView
          participant={swipeParticipantData}
          language={language}
          onClose={this.closeSwipeView}
        />
      )
    }

    // Priority 2: If user has submitted form, show the swipe view automatically
    if (this.state.hasSubmitted && this.hasFilledFormData()) {
      // Create participant data from current form data for swipe view
      const participantData = {
        name: formData.participantDetails.participantName || 'Participant',
        age: this.calculateAge(formData.participantDetails.dateOfBirth),
        gender: formData.participantDetails.gender,
        dateOfBirth: formData.participantDetails.dateOfBirth,
        phoneNumber: formData.participantDetails.phoneNumber,
        height: formData.participantDetails.height,
        weight: formData.participantDetails.weight,
        submittedAt: new Date().toISOString(),
        id: this.getCurrentParticipantId() || Date.now().toString()
      };
      
      return (
        <SwipeView
          participant={participantData}
          language={language}
          onClose={() => {
            // Allow user to go back to form to edit
            this.setState({ 
              hasSubmitted: false,
              showForm: true 
            });
          }}
        />
      )
    }

    // Priority 3: Show form if explicitly requested, if user has form data but not submitted
    if (showForm || (this.hasFilledFormData() && !this.state.hasSubmitted)) {
      return (
        <div>
          {/* Data Status Notification */}
          {this.state.dataStatusMessage && (
            <div style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              backgroundColor: '#007bff',
              color: 'white',
              padding: '10px 15px',
              borderRadius: '5px',
              zIndex: 1000,
              fontSize: '14px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
            }}>
              {this.state.dataStatusMessage}
            </div>
          )}
          
          <ParticipantForm
            formData={formData}
            language={language}
            onInputChange={this.handleInputChange}
            onSubmit={this.handleSubmit}
            submissionError={submissionError}
          />
          
          {/* Clear Saved Data Button */}
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button 
              onClick={this.clearSavedState}
              style={{
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
              title="Clear all saved form data from browser storage"
            >
              🗑️ Clear Saved Data
            </button>
          </div>
        </div>
      )
    }

    // Priority 3: Show loading state while checking for existing participant
    if (this.isUpdatingParticipants) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <h2>Loading...</h2>
          <div style={{ fontSize: '48px', margin: '20px 0', animation: 'spin 2s linear infinite' }}>🔄</div>
          <p>Checking for existing registration...</p>
        </div>
      )
    }

    // Default: Check if user has submitted but we don't have swipe data yet
    if (this.state.hasSubmitted && this.hasFilledFormData()) {
      // Create participant data from current form data for swipe view
      const participantData = {
        name: formData.participantDetails.participantName || 'Participant',
        age: this.calculateAge(formData.participantDetails.dateOfBirth),
        gender: formData.participantDetails.gender,
        dateOfBirth: formData.participantDetails.dateOfBirth,
        phoneNumber: formData.participantDetails.phoneNumber,
        height: formData.participantDetails.height,
        weight: formData.participantDetails.weight,
        submittedAt: new Date().toISOString(),
        id: this.getCurrentParticipantId() || Date.now().toString()
      };
      
      return (
        <SwipeView
          participant={participantData}
          language={language}
          onClose={() => {
            // Allow user to go back to form to edit
            this.setState({ 
              hasSubmitted: false,
              showForm: true 
            });
          }}
        />
      )
    }

    // Final default: Show fresh form for new users
    return (
      <div>
        {/* Data Status Notification */}
        {this.state.dataStatusMessage && (
          <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: '#007bff',
            color: 'white',
            padding: '10px 15px',
            borderRadius: '5px',
            zIndex: 1000,
            fontSize: '14px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            {this.state.dataStatusMessage}
          </div>
        )}
        
        <ParticipantForm
          formData={formData}
          language={language}
          onInputChange={this.handleInputChange}
          onSubmit={this.handleSubmit}
          submissionError={submissionError}
        />
        
        {/* Clear Saved Data Button */}
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button 
            onClick={this.clearSavedState}
            style={{
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              marginRight: '10px'
            }}
            title="Clear all saved form data from browser storage"
          >
            🗑️ Clear Saved Data
          </button>
          
          <button 
            onClick={this.testDataPersistence}
            style={{
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
            title="Test data persistence functionality"
          >
            🧪 Test Persistence
          </button>
        </div>
      </div>
    )
  }
}

// Functional wrapper component for Fast Refresh compatibility
const ParticipantsWrapper = (props) => {
  const { language } = useContext(LanguageContext);
  return <Participants {...props} language={language} />;
};

export default ParticipantsWrapper;

/*
Retrieve participants from backend (example: retrieve all, or retrieve a specific one by ID)
    // this.retrieveParticipants() // For all participants
    // this.retrieveParticipant('PARTICIPANT_ID_HERE') // For a specific participant by ID
*/
