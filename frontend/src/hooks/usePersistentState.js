import { useState, useEffect, useCallback, useRef } from 'react';
import dataManager, { DATA_KEYS } from './dataManager';

/**
 * Custom hook for consistent data persistence across components
 * @param {string} key - Data key for storage
 * @param {object} initialState - Initial state if no saved data exists
 * @param {object} options - Configuration options
 * @returns {object} - State and persistence utilities
 */
export function usePersistentState(key, initialState = {}, options = {}) {
  const {
    autoSave = true,
    saveDelay = 500,
    maxAge = 24 * 60 * 60 * 1000, // 24 hours
    onLoad = null,
    onSave = null,
    onError = null
  } = options;

  const [state, setState] = useState(initialState);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  
  const saveTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setStatusMessage('Loading saved data...');
        
        const savedData = dataManager.load(key);
        
        if (savedData) {
          setState(savedData);
          setLastSaved(Date.now());
          setStatusMessage('Data restored successfully');
          
          if (onLoad) {
            onLoad(savedData);
          }
          
          console.log(`🔄 Restored state for [${key}]:`, savedData);
        } else {
          setState(initialState);
          setStatusMessage('Starting fresh');
          console.log(`📝 No saved state for [${key}], using initial state`);
        }
      } catch (error) {
        console.error(`❌ Error loading state for [${key}]:`, error);
        setState(initialState);
        setStatusMessage('Failed to load saved data');
        
        if (onError) {
          onError(error, 'load');
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
          setIsInitialized(true);
          
          // Clear status message after delay
          setTimeout(() => {
            if (isMountedRef.current) {
              setStatusMessage('');
            }
          }, 3000);
        }
      }
    };

    loadData();
  }, [key, initialState, onLoad, onError]);

  // Debounced save function
  const debouncedSave = useCallback((dataToSave) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;

      try {
        const result = dataManager.save(key, dataToSave, maxAge);
        
        if (result.success) {
          setLastSaved(Date.now());
          if (onSave) {
            onSave(dataToSave);
          }
        } else {
          console.error(`❌ Failed to save state for [${key}]:`, result.error);
          if (onError) {
            onError(new Error(result.error), 'save');
          }
        }
      } catch (error) {
        console.error(`❌ Error saving state for [${key}]:`, error);
        if (onError) {
          onError(error, 'save');
        }
      }
    }, saveDelay);
  }, [key, maxAge, saveDelay, onSave, onError]);

  // Update state with automatic saving
  const updateState = useCallback((newState) => {
    if (typeof newState === 'function') {
      setState(prevState => {
        const updatedState = newState(prevState);
        if (autoSave && isInitialized) {
          debouncedSave(updatedState);
        }
        return updatedState;
      });
    } else {
      setState(newState);
      if (autoSave && isInitialized) {
        debouncedSave(newState);
      }
    }
  }, [autoSave, isInitialized, debouncedSave]);

  // Manual save function
  const saveNow = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    try {
      const result = dataManager.save(key, state, maxAge);
      
      if (result.success) {
        setLastSaved(Date.now());
        setStatusMessage('Data saved');
        
        if (onSave) {
          onSave(state);
        }
        
        // Clear message after delay
        setTimeout(() => {
          if (isMountedRef.current) {
            setStatusMessage('');
          }
        }, 2000);
        
        return { success: true };
      } else {
        setStatusMessage('Failed to save data');
        if (onError) {
          onError(new Error(result.error), 'save');
        }
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error(`❌ Error in manual save for [${key}]:`, error);
      setStatusMessage('Save failed');
      if (onError) {
        onError(error, 'save');
      }
      return { success: false, error: error.message };
    }
  }, [key, state, maxAge, onSave, onError]);

  // Clear saved data
  const clearSaved = useCallback(() => {
    try {
      const result = dataManager.remove(key);
      
      if (result.success) {
        setState(initialState);
        setLastSaved(null);
        setStatusMessage('Data cleared');
        
        // Clear message after delay
        setTimeout(() => {
          if (isMountedRef.current) {
            setStatusMessage('');
          }
        }, 2000);
        
        return { success: true };
      } else {
        setStatusMessage('Failed to clear data');
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error(`❌ Error clearing data for [${key}]:`, error);
      setStatusMessage('Clear failed');
      return { success: false, error: error.message };
    }
  }, [key, initialState]);

  // Reset to initial state without clearing saved data
  const resetState = useCallback(() => {
    setState(initialState);
    setStatusMessage('State reset');
    
    // Clear message after delay
    setTimeout(() => {
      if (isMountedRef.current) {
        setStatusMessage('');
      }
    }, 2000);
  }, [initialState]);

  // Check if data exists in storage
  const dataExists = useCallback(() => {
    return dataManager.exists(key);
  }, [key]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // Final save on unmount if auto-save is enabled
      if (autoSave && isInitialized) {
        dataManager.save(key, state, maxAge);
      }
    };
  }, [autoSave, isInitialized, key, state, maxAge]);

  return {
    // State
    state,
    setState: updateState,
    
    // Status
    isLoading,
    isInitialized,
    lastSaved,
    statusMessage,
    
    // Actions
    saveNow,
    clearSaved,
    resetState,
    dataExists,
    
    // Utilities
    hasUnsavedChanges: lastSaved === null || (lastSaved < Date.now() - saveDelay * 2)
  };
}

/**
 * Hook specifically for form persistence
 * @param {string} formKey - Unique key for the form
 * @param {object} initialFormData - Initial form data structure
 * @param {object} options - Additional options
 * @returns {object} - Form state and utilities
 */
export function usePersistentForm(formKey, initialFormData = {}, options = {}) {
  const {
    hasSubmitted,
    onSubmit = null,
    onFormDataChange = null,
    ...persistOptions
  } = options;

  const persistence = usePersistentState(
    `${DATA_KEYS.FORM_AUTOSAVE}_${formKey}`,
    {
      formData: initialFormData,
      hasSubmitted: false,
      lastModified: null
    },
    {
      ...persistOptions,
      onLoad: (data) => {
        if (onFormDataChange) {
          onFormDataChange(data.formData);
        }
        if (persistOptions.onLoad) {
          persistOptions.onLoad(data);
        }
      }
    }
  );

  // Update form data
  const updateFormData = useCallback((newFormData) => {
    const updateFn = typeof newFormData === 'function' 
      ? (prev) => ({
          ...prev,
          formData: typeof newFormData === 'function' ? newFormData(prev.formData) : newFormData,
          lastModified: Date.now()
        })
      : (prev) => ({
          ...prev,
          formData: newFormData,
          lastModified: Date.now()
        });

    persistence.setState(updateFn);
    
    if (onFormDataChange) {
      const finalData = typeof newFormData === 'function' 
        ? newFormData(persistence.state.formData)
        : newFormData;
      onFormDataChange(finalData);
    }
  }, [persistence, onFormDataChange]);

  // Mark form as submitted
  const markAsSubmitted = useCallback(() => {
    persistence.setState(prev => ({
      ...prev,
      hasSubmitted: true,
      submittedAt: Date.now()
    }));
    
    if (onSubmit) {
      onSubmit(persistence.state.formData);
    }
  }, [persistence, onSubmit]);

  // Check if form has data
  const hasFormData = useCallback(() => {
    const { formData } = persistence.state;
    if (!formData || typeof formData !== 'object') return false;
    
    return Object.values(formData).some(value => {
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(nestedValue => 
          nestedValue && nestedValue.toString().trim() !== ''
        );
      }
      return value && value.toString().trim() !== '';
    });
  }, [persistence.state]);

  return {
    ...persistence,
    formData: persistence.state.formData,
    hasSubmitted: persistence.state.hasSubmitted,
    lastModified: persistence.state.lastModified,
    updateFormData,
    markAsSubmitted,
    hasFormData,
    
    // Form-specific status
    isFormEmpty: !hasFormData(),
    shouldShowForm: !persistence.state.hasSubmitted || !hasFormData(),
    shouldShowDetails: persistence.state.hasSubmitted && hasFormData()
  };
}

/**
 * Hook for managing submission state with persistence
 * @param {string} key - Storage key
 * @param {object} options - Configuration options
 * @returns {object} - Submission state and utilities
 */
export function usePersistentSubmission(key, options = {}) {
  const { onSubmissionSuccess = null, onSubmissionError = null } = options;

  const persistence = usePersistentState(
    `${DATA_KEYS.PARTICIPANTS_STATE}_submission_${key}`,
    {
      isSubmitted: false,
      submissionData: null,
      submittedAt: null,
      participantId: null,
      error: null
    },
    options
  );

  // Handle successful submission
  const handleSubmissionSuccess = useCallback((submissionData, participantId) => {
    persistence.setState({
      isSubmitted: true,
      submissionData,
      submittedAt: Date.now(),
      participantId,
      error: null
    });

    // Store participant ID separately for quick access
    if (participantId) {
      dataManager.save(DATA_KEYS.PARTICIPANTS_ID, { participantId });
    }

    if (onSubmissionSuccess) {
      onSubmissionSuccess(submissionData, participantId);
    }
  }, [persistence, onSubmissionSuccess]);

  // Handle submission error
  const handleSubmissionError = useCallback((error) => {
    persistence.setState(prev => ({
      ...prev,
      error: error.message || 'Submission failed'
    }));

    if (onSubmissionError) {
      onSubmissionError(error);
    }
  }, [persistence, onSubmissionError]);

  // Clear submission state
  const clearSubmission = useCallback(() => {
    persistence.clearSaved();
    dataManager.remove(DATA_KEYS.PARTICIPANTS_ID);
  }, [persistence]);

  return {
    ...persistence,
    isSubmitted: persistence.state.isSubmitted,
    submissionData: persistence.state.submissionData,
    submittedAt: persistence.state.submittedAt,
    participantId: persistence.state.participantId,
    error: persistence.state.error,
    handleSubmissionSuccess,
    handleSubmissionError,
    clearSubmission
  };
}

export default usePersistentState;
