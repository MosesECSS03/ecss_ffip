import React, { Component } from 'react';
import QrScanner from 'qr-scanner';
import './QRScanner.css';

class OptimizedQRScanner extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      isScanning: false,
      hasCamera: false,
      cameraError: null,
      lastScanResult: null,
      scanHistory: [],
      performance: {
        scanCount: 0,
        averageScanTime: 0,
        lastScanTime: 0
      },
      cameraStatus: 'initializing', // initializing, ready, scanning, error
      preferredCamera: 'environment', // environment (back), user (front)
      torchSupported: false,
      torchEnabled: false
    };

    this.videoRef = React.createRef();
    this.scanner = null;
    this.scanStartTime = 0;
    this.lastValidScan = 0;
    this.scanCooldown = 1000; // Prevent duplicate scans within 1 second
    this.mountedTime = Date.now();
  }

  async componentDidMount() {
    await this.initializeScanner();
  }

  componentWillUnmount() {
    this.cleanup();
  }

  // Initialize scanner with optimal settings
  initializeScanner = async () => {
    try {
      console.log('🎥 Initializing QR Scanner...');
      
      // Check camera availability first
      const hasCamera = await QrScanner.hasCamera();
      
      if (!hasCamera) {
        throw new Error('No camera available on this device');
      }

      this.setState({ 
        hasCamera: true,
        cameraStatus: 'ready'
      });

      // Get video element
      const videoElement = this.videoRef.current;
      if (!videoElement) {
        throw new Error('Video element not found');
      }

      // Create scanner with optimized settings
      this.scanner = new QrScanner(
        videoElement,
        this.handleScanResult,
        {
          // Optimization settings for best performance
          preferredCamera: this.state.preferredCamera,
          highlightScanRegion: true,
          highlightCodeOutline: true,
          
          // Performance optimizations
          maxScansPerSecond: 5, // Limit to 5 scans per second for better performance
          
          // Error handling
          onDecodeError: this.handleScanError,
          
          // Video constraints for optimal scanning
          videoConstraints: {
            facingMode: this.state.preferredCamera,
            width: { ideal: 1920, max: 1920 },
            height: { ideal: 1080, max: 1080 },
            frameRate: { ideal: 30, max: 30 }
          }
        }
      );

      // Check torch support
      const torchSupported = await QrScanner.hasFlash();
      this.setState({ torchSupported });

      console.log('✅ QR Scanner initialized successfully');
      
      // Auto-start if requested
      if (this.props.autoStart !== false) {
        await this.startScanning();
      }

    } catch (error) {
      console.error('❌ Failed to initialize QR Scanner:', error);
      this.setState({
        cameraError: error.message,
        cameraStatus: 'error'
      });
      
      if (this.props.onError) {
        this.props.onError(error);
      }
    }
  };

  // Handle successful scan with validation and optimization
  handleScanResult = (result) => {
    const now = Date.now();
    
    // Prevent duplicate scans within cooldown period
    if (now - this.lastValidScan < this.scanCooldown) {
      return;
    }

    // Validate QR code format
    if (!this.validateScanResult(result)) {
      console.warn('Invalid QR code format:', result);
      return;
    }

    // Calculate scan performance
    const scanTime = now - this.scanStartTime;
    const performance = this.calculatePerformance(scanTime);

    // Process the scan result
    const processedResult = this.processScanResult(result);

    // Update state
    this.setState({
      lastScanResult: processedResult,
      scanHistory: [processedResult, ...this.state.scanHistory.slice(0, 9)], // Keep last 10 scans
      performance
    });

    this.lastValidScan = now;

    console.log('🎯 QR Code scanned successfully:', processedResult);

    // Provide haptic feedback if available
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }

    // Call parent callback with processed result
    if (this.props.onScanSuccess) {
      this.props.onScanSuccess(processedResult);
    }

    // Auto-stop scanning if single scan mode
    if (this.props.singleScan) {
      this.stopScanning();
    }
  };

  // Validate scan result format
  validateScanResult = (result) => {
    if (!result || !result.data) return false;
    
    const data = result.data.trim();
    if (data.length === 0) return false;

    // Custom validation based on your QR code format
    if (this.props.validateFormat) {
      return this.props.validateFormat(data);
    }

    // Default validation - accept participant IDs or JSON data
    if (/^\d+$/.test(data)) {
      return true; // Simple participant ID
    }

    try {
      const parsed = JSON.parse(data);
      return parsed.id !== undefined; // JSON with ID field
    } catch {
      return false;
    }
  };

  // Process scan result for optimal data transfer
  processScanResult = (result) => {
    const rawData = result.data.trim();
    
    try {
      // Try to parse as JSON first (detailed QR codes)
      const parsed = JSON.parse(rawData);
      
      // Validate checksum if present
      if (parsed.checksum) {
        const calculatedChecksum = this.generateChecksum(parsed.id.toString());
        if (parsed.checksum !== calculatedChecksum) {
          console.warn('QR code checksum mismatch');
        }
      }

      return {
        type: 'detailed',
        participantId: parsed.id,
        timestamp: parsed.timestamp || Date.now(),
        checksum: parsed.checksum,
        rawData,
        scanTime: Date.now(),
        valid: true
      };
    } catch {
      // Simple participant ID
      return {
        type: 'simple',
        participantId: rawData,
        timestamp: Date.now(),
        rawData,
        scanTime: Date.now(),
        valid: /^\d+$/.test(rawData)
      };
    }
  };

  // Generate checksum for validation
  generateChecksum = (data) => {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  };

  // Calculate performance metrics
  calculatePerformance = (scanTime) => {
    const currentPerf = this.state.performance;
    const newScanCount = currentPerf.scanCount + 1;
    const newAverageScanTime = ((currentPerf.averageScanTime * currentPerf.scanCount) + scanTime) / newScanCount;

    return {
      scanCount: newScanCount,
      averageScanTime: Math.round(newAverageScanTime),
      lastScanTime: scanTime
    };
  };

  // Handle scan errors gracefully
  handleScanError = (error) => {
    // Only log actual errors, not normal "no QR code found" states
    if (error && error.message && !error.message.includes('No QR code found')) {
      console.warn('QR scan error:', error.message);
    }
  };

  // Start scanning with performance optimization
  startScanning = async () => {
    if (!this.scanner || this.state.isScanning) {
      return;
    }

    try {
      this.scanStartTime = Date.now();
      
      await this.scanner.start();
      
      this.setState({
        isScanning: true,
        cameraStatus: 'scanning',
        cameraError: null
      });

      console.log('🔍 QR scanning started');

      if (this.props.onScanStart) {
        this.props.onScanStart();
      }

    } catch (error) {
      console.error('❌ Failed to start scanning:', error);
      this.setState({
        cameraError: error.message,
        cameraStatus: 'error'
      });

      if (this.props.onError) {
        this.props.onError(error);
      }
    }
  };

  // Stop scanning
  stopScanning = () => {
    if (!this.scanner || !this.state.isScanning) {
      return;
    }

    try {
      this.scanner.stop();
      
      this.setState({
        isScanning: false,
        cameraStatus: 'ready'
      });

      console.log('⏹️ QR scanning stopped');

      if (this.props.onScanStop) {
        this.props.onScanStop();
      }

    } catch (error) {
      console.error('❌ Failed to stop scanning:', error);
    }
  };

  // Toggle camera (front/back)
  toggleCamera = async () => {
    if (!this.scanner) return;

    try {
      const newCamera = this.state.preferredCamera === 'environment' ? 'user' : 'environment';
      
      await this.scanner.setCamera(newCamera);
      
      this.setState({ preferredCamera: newCamera });
      
      console.log(`📷 Switched to ${newCamera} camera`);

    } catch (error) {
      console.error('❌ Failed to switch camera:', error);
    }
  };

  // Toggle torch/flashlight
  toggleTorch = async () => {
    if (!this.scanner || !this.state.torchSupported) {
      return;
    }

    try {
      const newTorchState = !this.state.torchEnabled;
      
      await this.scanner.turnFlashlight(newTorchState);
      
      this.setState({ torchEnabled: newTorchState });
      
      console.log(`🔦 Torch ${newTorchState ? 'enabled' : 'disabled'}`);

    } catch (error) {
      console.error('❌ Failed to toggle torch:', error);
    }
  };

  // Cleanup resources
  cleanup = () => {
    if (this.scanner) {
      try {
        this.scanner.stop();
        this.scanner.destroy();
      } catch (error) {
        console.warn('Cleanup warning:', error);
      }
      this.scanner = null;
    }
  };

  // Clear scan history
  clearHistory = () => {
    this.setState({
      scanHistory: [],
      performance: {
        scanCount: 0,
        averageScanTime: 0,
        lastScanTime: 0
      }
    });
  };

  render() {
    const {
      isScanning,
      hasCamera,
      cameraError,
      lastScanResult,
      scanHistory,
      performance,
      cameraStatus,
      preferredCamera,
      torchSupported,
      torchEnabled
    } = this.state;

    const {
      className = '',
      showControls = true,
      showHistory = false,
      showPerformance = false,
      style = {}
    } = this.props;

    return (
      <div className={`qr-scanner-container ${className}`} style={style}>
        {/* Video Element */}
        <div className="qr-scanner-video-container">
          <video
            ref={this.videoRef}
            className="qr-scanner-video"
            playsInline
            muted
          />
          
          {/* Scanner Overlay */}
          <div className="qr-scanner-overlay">
            <div className="qr-scanner-viewfinder">
              <div className="qr-scanner-corner qr-scanner-corner-tl"></div>
              <div className="qr-scanner-corner qr-scanner-corner-tr"></div>
              <div className="qr-scanner-corner qr-scanner-corner-bl"></div>
              <div className="qr-scanner-corner qr-scanner-corner-br"></div>
            </div>
          </div>

          {/* Status Indicator */}
          <div className={`qr-scanner-status qr-scanner-status-${cameraStatus}`}>
            {cameraStatus === 'initializing' && '🔄 Initializing...'}
            {cameraStatus === 'ready' && '📷 Ready to scan'}
            {cameraStatus === 'scanning' && '🔍 Scanning...'}
            {cameraStatus === 'error' && '❌ Camera error'}
          </div>

          {/* Error Display */}
          {cameraError && (
            <div className="qr-scanner-error">
              <p>❌ {cameraError}</p>
              <button onClick={this.initializeScanner} className="qr-retry-btn">
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Controls */}
        {showControls && hasCamera && !cameraError && (
          <div className="qr-scanner-controls">
            <button
              onClick={isScanning ? this.stopScanning : this.startScanning}
              className={`qr-control-btn qr-scan-btn ${isScanning ? 'scanning' : ''}`}
            >
              {isScanning ? '⏹️ Stop' : '▶️ Start'}
            </button>

            <button
              onClick={this.toggleCamera}
              className="qr-control-btn qr-camera-btn"
              title={`Switch to ${preferredCamera === 'environment' ? 'front' : 'back'} camera`}
            >
              🔄 Camera
            </button>

            {torchSupported && (
              <button
                onClick={this.toggleTorch}
                className={`qr-control-btn qr-torch-btn ${torchEnabled ? 'active' : ''}`}
                title={`${torchEnabled ? 'Disable' : 'Enable'} flashlight`}
              >
                🔦 Flash
              </button>
            )}
          </div>
        )}

        {/* Last Scan Result */}
        {lastScanResult && (
          <div className="qr-scan-result">
            <h3>✅ Last Scan</h3>
            <p><strong>Participant ID:</strong> {lastScanResult.participantId}</p>
            <p><strong>Type:</strong> {lastScanResult.type}</p>
            <p><strong>Time:</strong> {new Date(lastScanResult.scanTime).toLocaleTimeString()}</p>
          </div>
        )}

        {/* Performance Metrics */}
        {showPerformance && performance.scanCount > 0 && (
          <div className="qr-performance">
            <h4>📊 Performance</h4>
            <p>Scans: {performance.scanCount}</p>
            <p>Avg Time: {performance.averageScanTime}ms</p>
            <p>Last Scan: {performance.lastScanTime}ms</p>
          </div>
        )}

        {/* Scan History */}
        {showHistory && scanHistory.length > 0 && (
          <div className="qr-scan-history">
            <div className="qr-history-header">
              <h4>📝 Recent Scans</h4>
              <button onClick={this.clearHistory} className="qr-clear-btn">
                Clear
              </button>
            </div>
            <div className="qr-history-list">
              {scanHistory.map((scan, index) => (
                <div key={`${scan.scanTime}-${index}`} className="qr-history-item">
                  <span className="qr-history-id">{scan.participantId}</span>
                  <span className="qr-history-time">
                    {new Date(scan.scanTime).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default OptimizedQRScanner;
