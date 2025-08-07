import React, { Component } from 'react'
import QRCode from 'qrcode'
import '../Pages.css'

class QRCodeModal extends Component {
  constructor(props) {
    super(props)
    
    this.state = {
      qrCodeUrl: '',
      isGenerating: false,
      generationError: null,
      statusMessage: ''
    }
  }

  componentDidMount() {
    // Generate QR code when component mounts
    if (this.props.participantId) {
      this.generateQRCode(this.props.participantId)
    }
  }

  componentDidUpdate(prevProps) {
    // Regenerate QR code if participantId changes
    if (prevProps.participantId !== this.props.participantId && this.props.participantId) {
      this.generateQRCode(this.props.participantId)
    }
  }

  // Generate QR code with enhanced reliability
  generateQRCode = async (participantId) => {
    // Prevent multiple simultaneous QR generations
    if (this.state.isGenerating) {
      console.log('QR generation already in progress, skipping...')
      return
    }

    try {
      if (!participantId) {
        console.error('No participant ID provided for QR code generation')
        this.setState({ 
          generationError: 'No participant ID available for QR code generation' 
        })
        return
      }
      
      console.log('Generating QR code for participant ID:', participantId)
      
      // Set loading state
      this.setState({ 
        isGenerating: true, 
        generationError: null,
        statusMessage: 'Generating QR code...'
      })
      
      // Create QR code payload based on type
      let qrData
      if (this.props.type === 'detailed') {
        // Create a resilient QR code with error correction for scanning reliability
        const qrDataPayload = {
          id: participantId.toString(),
          timestamp: Date.now(),
          checksum: this.generateChecksum(participantId.toString())
        }
        qrData = JSON.stringify(qrDataPayload)
      } else {
        // Simple QR code for table participants
        qrData = participantId.toString()
      }
      
      const qrOptions = this.props.type === 'detailed' ? {
        width: 350,         // Optimized size for scanning
        margin: 2,          // Adequate margin for camera recognition
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'H' // High error correction for better scanning in poor conditions
      } : {
        width: 300,         // Reduced size for better performance
        margin: 1,          // Reduced margin
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'L' // Lower correction level for faster generation
      }
      
      const qrPromise = QRCode.toDataURL(qrData, qrOptions)
      
      // Add timeout to prevent hanging
      const timeoutDuration = this.props.type === 'detailed' ? 15000 : 10000
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('QR code generation timeout')), timeoutDuration)
      )
      
      const qrCodeUrl = await Promise.race([qrPromise, timeoutPromise])
      
      // Validate QR code was generated properly
      if (!qrCodeUrl || !qrCodeUrl.startsWith('data:image')) {
        throw new Error('Invalid QR code generated')
      }
      
      this.setState({ 
        qrCodeUrl,
        isGenerating: false,
        generationError: null,
        statusMessage: 'QR code ready for scanning!'
      })
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        this.setState({ statusMessage: '' })
      }, 3000)
      
      console.log('QR code generated successfully')
    } catch (error) {
      console.error('Error generating QR code:', error)
      
      // Attempt fallback QR generation with simpler data
      try {
        console.log('Attempting fallback QR generation...')
        const fallbackQR = await QRCode.toDataURL(participantId.toString(), {
          width: 300,
          margin: 1,
          errorCorrectionLevel: 'M'
        })
        
        this.setState({
          qrCodeUrl: fallbackQR,
          isGenerating: false,
          generationError: null,
          statusMessage: 'QR code generated (fallback mode)'
        })
        
        setTimeout(() => {
          this.setState({ statusMessage: '' })
        }, 3000)
        
      } catch (fallbackError) {
        console.error('Fallback QR generation also failed:', fallbackError)
        this.setState({
          isGenerating: false,
          generationError: error.message || 'Failed to generate QR code',
          statusMessage: 'QR code generation failed'
        })
        
        // Clear error message after 5 seconds
        setTimeout(() => {
          this.setState({ statusMessage: '', generationError: null })
        }, 5000)
      }
    }
  }

  // Helper method to generate checksum for QR data validation
  generateChecksum = (data) => {
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  // Refresh QR code
  refreshQRCode = async () => {
    if (!this.props.participantId) {
      console.error('No participant ID available for QR refresh')
      return
    }
    
    // Clear current QR and regenerate
    this.setState({ 
      qrCodeUrl: '', 
      generationError: null,
      statusMessage: 'Refreshing QR code...' 
    })
    
    await this.generateQRCode(this.props.participantId)
  }

  // QR code health check
  validateQRCode = (qrCodeUrl) => {
    if (!qrCodeUrl) return false
    if (!qrCodeUrl.startsWith('data:image')) return false
    if (qrCodeUrl.length < 100) return false // Too small to be valid
    return true
  }

  handleClose = () => {
    if (this.props.onClose) {
      this.props.onClose()
    }
  }

  handleModalClick = (e) => {
    // Don't close modal when clicking inside the modal content
    e.stopPropagation()
  }

  render() {
    const { title, subtitle, description, isVisible } = this.props
    const { qrCodeUrl, isGenerating, generationError, statusMessage } = this.state

    if (!isVisible) {
      return null
    }

    return (
      <div className="qr-modal-overlay" onClick={this.handleClose}>
        <div className="qr-modal-content" onClick={this.handleModalClick}>
          <button className="qr-modal-close" onClick={this.handleClose}>
            ×
          </button>
          
          <h2 className="qr-modal-title">
            {title || 'Participant QR Code'}
          </h2>
          
          <p className="qr-modal-subtitle">
            {subtitle || 'Present this QR code to the station master'}
          </p>
          
          {/* Status message */}
          {statusMessage && (
            <div className="qr-status-message">
              {statusMessage}
            </div>
          )}
          
          {/* QR Code display area */}
          <div className="qr-code-container">
            {isGenerating ? (
              <div className="qr-loading">
                <div className="qr-spinner">🔄</div>
                <p>Generating QR code...</p>
              </div>
            ) : generationError ? (
              <div className="qr-error">
                <div className="qr-error-icon">❌</div>
                <p>Failed to generate QR code</p>
                <p className="qr-error-message">{generationError}</p>
                <button 
                  onClick={this.refreshQRCode} 
                  className="qr-retry-btn"
                >
                  Try Again
                </button>
              </div>
            ) : qrCodeUrl ? (
              <>
                <img src={qrCodeUrl} alt="QR Code" className="qr-code-image" />
                <button 
                  onClick={this.refreshQRCode} 
                  className="qr-refresh-btn"
                  title="Refresh QR Code"
                >
                  🔄 Refresh
                </button>
              </>
            ) : (
              <div className="qr-placeholder">
                <div className="qr-placeholder-icon">📱</div>
                <p>QR code will appear here</p>
              </div>
            )}
          </div>
          
          <p className="qr-modal-description">
            {description || 'Station master will scan this code to access participant data.'}
          </p>
          
          <div className="qr-modal-actions">
            <button onClick={this.handleClose} className="senior-submit-btn">
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }
}

export default QRCodeModal
