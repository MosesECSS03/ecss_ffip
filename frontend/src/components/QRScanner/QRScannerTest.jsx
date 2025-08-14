import React from 'react';
import QRScannerDemo from './components/QRScanner/QRScannerDemo';

// Simple test component to integrate into your app
function QRScannerTest() {
  return (
    <div style={{ padding: '20px', minHeight: '100vh', background: '#1a1a1a' }}>
      <QRScannerDemo
        title="🎯 Participant QR Scanner"
        subtitle="Scan participant QR codes for check-in/check-out"
        actionType="check-in"
        stationId="main-station"
        autoProcess={true}
        showHistory={true}
        showStatistics={true}
      />
    </div>
  );
}

export default QRScannerTest;
