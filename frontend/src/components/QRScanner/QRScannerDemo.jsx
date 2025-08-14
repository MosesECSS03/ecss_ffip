import React, { Component } from 'react';
import OptimizedQRScanner from './OptimizedQRScanner';
import './QRScannerDemo.css';

class QRScannerDemo extends Component {
  constructor(props) {
    super(props);
    
    this.state = {
      scanResults: [],
      showScanner: false,
      participantData: null,
      isProcessing: false,
      connectionStatus: 'disconnected', // connected, connecting, disconnected
      statistics: {
        totalScans: 0,
        successfulScans: 0,
        failedScans: 0,
        averageProcessingTime: 0
      }
    };
  }

  // Handle successful QR scan
  handleScanSuccess = async (scanResult) => {
    console.log('📱 QR Code scanned:', scanResult);
    
    this.setState({ isProcessing: true });
    
    try {
      // Process the scanned participant data
      const participantData = await this.fetchParticipantData(scanResult.participantId);
      
      if (participantData.success) {
        // Add to scan results
        const newScanResult = {
          ...scanResult,
          participantData: participantData.data,
          processedAt: Date.now(),
          status: 'success'
        };

        this.setState(prevState => ({
          scanResults: [newScanResult, ...prevState.scanResults.slice(0, 19)], // Keep last 20
          participantData: participantData.data,
          statistics: {
            ...prevState.statistics,
            totalScans: prevState.statistics.totalScans + 1,
            successfulScans: prevState.statistics.successfulScans + 1
          }
        }));

        // Show success notification
        this.showNotification('✅ Participant data loaded successfully!', 'success');
        
        // Auto-process based on scan type
        if (this.props.autoProcess) {
          await this.processParticipantAction(participantData.data);
        }

      } else {
        throw new Error(participantData.error || 'Failed to fetch participant data');
      }

    } catch (error) {
      console.error('❌ Error processing scan:', error);
      
      // Add failed scan to results
      const failedScanResult = {
        ...scanResult,
        error: error.message,
        processedAt: Date.now(),
        status: 'failed'
      };

      this.setState(prevState => ({
        scanResults: [failedScanResult, ...prevState.scanResults.slice(0, 19)],
        statistics: {
          ...prevState.statistics,
          totalScans: prevState.statistics.totalScans + 1,
          failedScans: prevState.statistics.failedScans + 1
        }
      }));

      this.showNotification(`❌ Error: ${error.message}`, 'error');

    } finally {
      this.setState({ isProcessing: false });
    }
  };

  // Fetch participant data from backend
  fetchParticipantData = async (participantId) => {
    try {
      // Use your existing database connectivity
      const response = await fetch(`/api/participants/${participantId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Scan-ID': Date.now().toString(),
          'X-Device-ID': this.getDeviceId()
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('Database fetch error:', error);
      
      // Fallback to offline data if available
      const offlineData = this.getOfflineParticipantData(participantId);
      
      if (offlineData) {
        return {
          success: true,
          data: offlineData,
          offline: true
        };
      }

      return {
        success: false,
        error: error.message
      };
    }
  };

  // Process participant action (check-in, check-out, etc.)
  processParticipantAction = async (participantData) => {
    try {
      const actionType = this.props.actionType || 'check-in';
      
      const response = await fetch('/api/participants/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          participantId: participantData.id,
          action: actionType,
          timestamp: Date.now(),
          stationId: this.props.stationId || 'default',
          deviceId: this.getDeviceId()
        })
      });

      if (!response.ok) {
        throw new Error(`Action failed: ${response.statusText}`);
      }

      const result = await response.json();
      this.showNotification(`✅ ${actionType} completed for ${participantData.name}`, 'success');
      
      return result;

    } catch (error) {
      this.showNotification(`❌ Action failed: ${error.message}`, 'error');
      throw error;
    }
  };

  // Get offline participant data (cached)
  getOfflineParticipantData = (participantId) => {
    try {
      const cached = localStorage.getItem(`participant_${participantId}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };

  // Get unique device ID
  getDeviceId = () => {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  };

  // Validate QR code format
  validateQRFormat = (data) => {
    // Accept numeric participant IDs or JSON with id field
    if (/^\d+$/.test(data)) {
      return true;
    }

    try {
      const parsed = JSON.parse(data);
      return parsed.id !== undefined && /^\d+$/.test(parsed.id);
    } catch {
      return false;
    }
  };

  // Handle scanner errors
  handleScanError = (error) => {
    console.error('Scanner error:', error);
    this.showNotification(`📷 Camera error: ${error.message}`, 'error');
  };

  // Show notification
  showNotification = (message, type = 'info') => {
    // You can integrate with your existing notification system
    console.log(`${type.toUpperCase()}: ${message}`);
    
    // Simple toast notification
    const toast = document.createElement('div');
    toast.className = `qr-toast qr-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  };

  // Toggle scanner visibility
  toggleScanner = () => {
    this.setState(prevState => ({
      showScanner: !prevState.showScanner
    }));
  };

  // Clear scan history
  clearScanHistory = () => {
    this.setState({
      scanResults: [],
      statistics: {
        totalScans: 0,
        successfulScans: 0,
        failedScans: 0,
        averageProcessingTime: 0
      }
    });
  };

  render() {
    const {
      scanResults,
      showScanner,
      participantData,
      isProcessing,
      statistics
    } = this.state;

    const {
      title = "QR Code Scanner",
      subtitle = "Scan participant QR codes",
      showHistory = true,
      showStatistics = true
    } = this.props;

    return (
      <div className="qr-scanner-demo">
        {/* Header */}
        <div className="qr-demo-header">
          <h2>{title}</h2>
          <p>{subtitle}</p>
          
          <button
            onClick={this.toggleScanner}
            className={`qr-toggle-btn ${showScanner ? 'active' : ''}`}
          >
            {showScanner ? '📷 Close Scanner' : '📱 Open Scanner'}
          </button>
        </div>

        {/* Scanner */}
        {showScanner && (
          <div className="qr-scanner-section">
            <OptimizedQRScanner
              onScanSuccess={this.handleScanSuccess}
              onError={this.handleScanError}
              validateFormat={this.validateQRFormat}
              showControls={true}
              showPerformance={showStatistics}
              singleScan={false}
              autoStart={true}
              className="demo-scanner"
            />
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="qr-processing">
            <div className="qr-spinner">🔄</div>
            <p>Processing participant data...</p>
          </div>
        )}

        {/* Current Participant */}
        {participantData && (
          <div className="qr-current-participant">
            <h3>👤 Current Participant</h3>
            <div className="participant-info">
              <p><strong>ID:</strong> {participantData.id}</p>
              <p><strong>Name:</strong> {participantData.name}</p>
              <p><strong>Status:</strong> {participantData.status}</p>
              {participantData.station && (
                <p><strong>Station:</strong> {participantData.station}</p>
              )}
            </div>
          </div>
        )}

        {/* Statistics */}
        {showStatistics && statistics.totalScans > 0 && (
          <div className="qr-statistics">
            <h3>📊 Scan Statistics</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-value">{statistics.totalScans}</span>
                <span className="stat-label">Total Scans</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{statistics.successfulScans}</span>
                <span className="stat-label">Successful</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{statistics.failedScans}</span>
                <span className="stat-label">Failed</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">
                  {statistics.totalScans > 0 
                    ? Math.round((statistics.successfulScans / statistics.totalScans) * 100)
                    : 0}%
                </span>
                <span className="stat-label">Success Rate</span>
              </div>
            </div>
          </div>
        )}

        {/* Scan History */}
        {showHistory && scanResults.length > 0 && (
          <div className="qr-scan-history-section">
            <div className="history-header">
              <h3>📝 Scan History</h3>
              <button onClick={this.clearScanHistory} className="clear-history-btn">
                Clear History
              </button>
            </div>
            
            <div className="history-list">
              {scanResults.map((result, index) => (
                <div 
                  key={`${result.scanTime}-${index}`} 
                  className={`history-item ${result.status}`}
                >
                  <div className="history-main">
                    <span className="participant-id">
                      {result.status === 'success' ? '✅' : '❌'} 
                      ID: {result.participantId}
                    </span>
                    <span className="scan-time">
                      {new Date(result.scanTime).toLocaleTimeString()}
                    </span>
                  </div>
                  
                  {result.participantData && (
                    <div className="history-details">
                      <span>{result.participantData.name}</span>
                      {result.offline && <span className="offline-badge">Offline</span>}
                    </div>
                  )}
                  
                  {result.error && (
                    <div className="history-error">
                      {result.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
}

export default QRScannerDemo;
