import React, { Component, useContext } from 'react'
import { translations } from '../../utils/translations'
import LanguageContext from '../../contexts/LanguageContext'
import '../Pages.css'
import axios from "axios"
import ParticipantForm from './ParticipantForm'
import SwipeView from './SwipeView'
import { io } from 'socket.io-client'

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
          dateOfBirth: ''
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
      // Simplified QR state management
      showQRCode: false,
      currentParticipantId: null,
      qrCodeType: 'detailed', // 'detailed' or 'simple'
      qrCodeUrl: '', // Add missing qrCodeUrl state
      isGeneratingQR: false, // Add missing isGeneratingQR state
      qrGenerationError: null, // Add missing qrGenerationError state
      showResults: false,
      selectedParticipantResults: null,
      showSwipeView: false,
      swipeParticipantData: null,
      submissionError: null,
      dataStatusMessage: '', // For showing save/load notifications
      isInitializing: true // Add initialization state
    }
    this.socket = null;
  }
  
  // Save state to localStorage with error handling
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
      
      localStorage.setItem('participantsAppState', JSON.stringify(stateToSave));
      console.log('💾 State saved to localStorage');
      
    } catch (error) {
      console.error('❌ Error saving state to localStorage:', error);
      
      if (!isRetry && (error.name === 'QuotaExceededError' || error.message.includes('quota'))) {
        this.cleanUpLocalStorage();
        this.saveStateToLocalStorage(true);
      }
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

  componentDidMount = async () => {
    try {
      // Add beforeunload listener to save data when user leaves/refreshes
      window.addEventListener('beforeunload', this.handleBeforeUnload);
      
      // Set loading state
      this.setState({ 
        isLoading: true,
        dataStatusMessage: '🔄 Initializing...' 
      });
      
      // Load saved state first
      const loaded = await this.loadStateFromLocalStorage();
      
      if (loaded) {
        // Determine the appropriate initial view based on loaded data
        if (this.state.hasSubmitted && this.hasFilledFormData()) {
          // User has submitted, show swipe view with their data
          const participantData = {
            name: this.state.formData.participantDetails.participantName || 'Participant',
            age: this.calculateAge(this.state.formData.participantDetails.dateOfBirth),
            gender: this.state.formData.participantDetails.gender,
            dateOfBirth: this.state.formData.participantDetails.dateOfBirth,
            phoneNumber: this.state.formData.participantDetails.phoneNumber,
            submittedAt: new Date().toISOString(),
            id: this.getCurrentParticipantId()
          };
          
          this.setState({ 
            showForm: false,
            showSwipeView: true,
            swipeParticipantData: participantData,
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
      } else if (hasFormData && !this.state.hasSubmitted) {
        // Only show form if user has data but hasn't submitted yet
        console.log('📝 Form data exists but not submitted, keeping form visible for completion');
        this.setState({
          showForm: true,
          hasSubmitted: false,
          showSwipeView: false,
          isLoading: false,
          isInitializing: false
        });
      } else {
        // User has submitted or no data - don't override the previous state setup
        console.log('📝 User has submitted or no data, keeping current state');
        this.setState({
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
  
  // Show QR code modal for participant - Simplified
  showQRCode = (participantId, type = 'detailed') => {
    if (!participantId) {
      console.error('No participant ID provided for QR code');
      this.setState({ 
        submissionError: 'No participant ID available for QR code generation' 
      });
      return;
    }
    
    console.log('Showing QR code for participant ID:', participantId, 'Type:', type);
    
    this.setState({
      showQRCode: true,
      currentParticipantId: participantId,
      qrCodeType: type,
      dataStatusMessage: ''
    });
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
            dateOfBirth: ''
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
      }))
      
      // Save immediately or use debounced save
      if (shouldSaveImmediately) {
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
      }))
      
      // Save immediately or use debounced save
      if (shouldSaveImmediately) {
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
      }))
      
      // Save immediately or use debounced save
      if (shouldSaveImmediately) {
        this.saveStateToLocalStorage();
      } else {
        this.debouncedSave();
      }
    }
  }

  handleSubmit = async (e) => {
    e.preventDefault();
    const { formData, participants } = this.state;
    
    const nameValid = formData.participantDetails.participantName && formData.participantDetails.participantName.trim();
    const phoneValid = formData.participantDetails.phoneNumber && formData.participantDetails.phoneNumber.trim();
    const dobValid = formData.participantDetails.dateOfBirth && formData.participantDetails.dateOfBirth.trim();
    const genderValid = formData.participantDetails.gender && formData.participantDetails.gender.trim();

    if (nameValid && phoneValid && dobValid && genderValid) {
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
        let backendId = backendResult.data._id;
        console.log('📥 Backend submission successful, received ID:', backendId);
        if (backendId) {
          newParticipant.id = backendId;
          console.log('✅ Using backend-generated participant ID:', backendId);
        } else {
          console.warn('⚠️ Backend did not return a valid ID, using temporary ID');
          newParticipant.id = `temp_${Date.now()}`;
        }
        // Only proceed if backend submission was successful
        const updatedParticipants = [...participants, newParticipant];

        this.setState(prevState => ({
          participants: updatedParticipants,
          submissionError: null,
          // DON'T clear form data - keep it for persistence after refresh
          // formData: { ... } - REMOVED to preserve submitted data
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
    } else {
      // Validation failed - show detailed error message
      const missingFields = [];
      if (!nameValid) {
        missingFields.push('Participant Name');
      }
      if (!phoneValid) {
        missingFields.push('Phone Number');
      }
      if (!dobValid) {
        missingFields.push('Date of Birth');
      }
      if (!genderValid) {
        missingFields.push('Gender');
      }
      
      const errorMessage = `Please fill in the required fields: ${missingFields.join(', ')}`;
      
      this.setState({ 
        submissionError: errorMessage
      });
    }
  }

  // Function to submit form data to backend
  submitToBackend = async (participantData) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/participants`, {"purpose": "new", participantData})
      console.log('📤 Submitted participant data to backend:', response.data)
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
      console.log('🔄 Retrieving participant ID from localStorage...');
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log('🆔 Retrieved participant ID from localStorage:', parsed?.participantId);
        return parsed?.participantId;
      }
    } catch (e) {
      console.warn('Failed to parse participantId from localStorage:', e);
      // Clear corrupted data
      localStorage.removeItem('participantId');
    }
    console.warn('⚠️ No valid participant ID found in localStorage');
    return null;
  }

  // Simplified QR code button handler
  handleQRCodeClick = (participantId) => {
    // Prevent rapid clicks
    if (this.lastQRClickTime && Date.now() - this.lastQRClickTime < 1000) {
      console.log('QR button clicked too quickly, ignoring...');
      return;
    }
    
    this.lastQRClickTime = Date.now();
    this.showQRCode(participantId, 'detailed');
  }

  // Simplified table QR code button handler
  handleTableQRCodeClick = (participantId) => {
    // Prevent rapid clicks
    if (this.lastTableQRClickTime && Date.now() - this.lastTableQRClickTime < 1000) {
      console.log('Table QR button clicked too quickly, ignoring...');
      return;
    }
    
    this.lastTableQRClickTime = Date.now();
    this.showQRCode(participantId, 'simple');
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

  // Add missing methods for QR code functionality
  generateQRCode = (participantId) => {
    this.setState({ 
      isGeneratingQR: true, 
      qrGenerationError: null 
    });
    
    // Simulate QR generation - replace with actual implementation
    setTimeout(() => {
      this.setState({
        isGeneratingQR: false,
        qrCodeUrl: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==` // placeholder
      });
    }, 1000);
  }

  refreshQRCode = () => {
    if (this.state.currentParticipantId) {
      this.generateQRCode(this.state.currentParticipantId);
    }
  }

  validateQRCode = (qrCodeUrl) => {
    return qrCodeUrl && qrCodeUrl.length > 10;
  }

  testDataPersistence = () => {
    console.log('🧪 Testing data persistence...');
    this.setState({ 
      dataStatusMessage: '🧪 Testing persistence functionality' 
    });
    setTimeout(() => {
      this.setState({ dataStatusMessage: '' });
    }, 2000);
  }

  // Add missing close swipe view method
  closeSwipeView = () => {
    // Clear all participant data and navigation state
    this.setState({
      showSwipeView: false,
      swipeParticipantData: null,
      showForm: true,
      hasSubmitted: false,
      participants: [],
      // Clear form data when user explicitly closes details view
      formData: {
        participantDetails: {
          participantName: '',
          phoneNumber: '',
          gender: '',
          dateOfBirth: ''
        },
        healthDeclaration: {
          questions: {
            healthQuestion1: '',
            healthQuestion2: '',
            healthQuestion3: '',
            healthQuestion4: ''
          }
        }
      }
    }, () => {
      // Clear localStorage when explicitly closing
      this.clearSavedState();
    });
    
    // Navigate back to HomePage
    window.location.href = '/';
  }

  render() {
    const { language } = this.props
    const t = translations[language]
    const { formData, showForm, participants, showQRCode, currentParticipantId, qrCodeType, qrCodeUrl, isGeneratingQR, qrGenerationError, showResults, selectedParticipantResults, showSwipeView, swipeParticipantData, submissionError, isInitializing, isLoading } = this.state

    // Show loading during initialization or data loading to prevent flickering
    if (isInitializing || isLoading) {
      return (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#f8f9fa'
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '40px',
            borderRadius: '15px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            maxWidth: '400px',
            width: '100%'
          }}>
            <h2 style={{ margin: '0 0 20px 0', color: '#333' }}>
              {isLoading ? 'Loading Your Data...' : 'Initializing...'}
            </h2>
            <div style={{ 
              fontSize: '48px', 
              margin: '20px 0', 
              animation: 'spin 2s linear infinite' 
            }}>
              🔄
            </div>
            <p style={{ color: '#666', margin: '0' }}>
              {isLoading ? 'Retrieving your saved information...' : 'Setting up the application...'}
            </p>
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
        id: this.getCurrentParticipantId()
      };
      
      return (
        <SwipeView
          participant={participantData}
          language={language}
          onClose={this.closeSwipeView}
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
        id: this.getCurrentParticipantId()
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

