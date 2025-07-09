import React, { Component } from 'react'
import LanguageContext from '../contexts/LanguageContext'
import { translations } from '../utils/translations'
import './Pages.css'
import axios from "axios"
import { io } from 'socket.io-client' // Uncommented import for socket.io-client
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';


ModuleRegistry.registerModules([AllCommunityModule]);

const API_BASE_URL =
  window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://ecss-fft.azurewebsites.net';

class MainTrainers extends Component {
  static contextType = LanguageContext
  
  constructor(props) {
    super(props)
    this.state = {
      participants: [],
      loading: false,
      error: null,
      columnDefs: [
        { 
          headerName: 'S/N', 
          field: '_id',
          width: 100,
          valueGetter: (params) => {
            // Return the row index + 1 as serial number
            return params.node.rowIndex + 1;
          }
        },
        { 
          headerName: 'Name', 
          field: 'name',
          width: 250
        },
        { 
          headerName: 'NRIC', 
          field: 'nric',
          width: 250
        },
        { 
          headerName: 'Age', 
          field: 'age',
          width: 250
        },
        { 
          headerName: 'Gender', 
          field: 'gender',
          width: x90,
          cellRenderer: (params) => {
            return params.value ? params.value.charAt(0).toUpperCase() + params.value.slice(1) : '';
          }
        },
        { 
          headerName: 'Date Of Birth', 
          field: 'dateOfBirth',
          width: 240
        },
        { 
          headerName: 'Phone', 
          field: 'phoneNumber',
          width: 130
        },
        { 
          headerName: 'Program', 
          field: 'program',
          width: 160
        },
        { 
          headerName: 'BMI', 
          field: 'bmi',
          width: 80
        },
        { 
          headerName: 'Height', 
          field: 'height',
          width: 90
        },
        { 
          headerName: 'Weight', 
          field: 'weight',
          width: 90
        },
        { 
          headerName: 'Registered', 
          field: 'submittedAt',
          width: 140,
          valueFormatter: (params) => {
            if (params.value && params.value.date && params.value.time) {
              return `${params.value.date} ${params.value.time}`;
            }
            return 'N/A';
          }
        },
        { 
          headerName: 'Stations', 
          field: 'stations',
          width: 180,
          cellRenderer: (params) => {
            if (params.value && Array.isArray(params.value) && params.value.length > 0) {
              const stationNames = params.value.map(station => {
                return Object.keys(station).join(', ');
              }).join(' | ');
              return stationNames;
            }
            return 'No stations';
          }
        }
      ],
      defaultColDef: {
        sortable: true,
        resizable: true,
        cellStyle: {
          'white-space': 'nowrap',
          'overflow': 'hidden',
          'text-overflow': 'ellipsis',
          'display': 'flex',
          'align-items': 'center',
          'font-size': '18px',
          'font-weight': '500'
        }
      },
      rowHeight: 65,
      headerHeight: 70
    }
  }

  async componentDidMount() {
    await this.fetchParticipants()
    
    // --- SOCKET.IO ---
    this.socket = io(API_BASE_URL);
    // Listen for participant updates and refresh data live
    this.socket.on('participant-updated', (data) => {
    });
  }

  componentWillUnmount() {
    // Clean up socket connection
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  fetchParticipants = async () => {
    this.setState({ loading: true, error: null })
    
    try {
      const response = await axios.get(`${API_BASE_URL}/participants`);
      console.log("📊 Participants fetched:", response.data);
      
      this.setState({ 
        participants: response.data,
        loading: false 
      })
    } catch (error) {
      console.error('Error fetching participants:', error)
      this.setState({ 
        error: 'Failed to fetch participants',
        loading: false 
      })
    }
  }

  handleParticipantUpdate = async () => {
    // Refresh participants data when socket event is received
    console.log("🔄 Refreshing participants data...");
    await this.fetchParticipants();
  }

  render() {
    const { language } = this.context
    const t = translations[language]
    const { participants, loading, error, columnDefs, defaultColDef, rowHeight, headerHeight } = this.state

    return (
      <div className="page-container desktop-only">
        <h1>Participants</h1>
        
        {loading && <p>Loading participants...</p>}
        {error && <p className="error-message">{error}</p>}
        
        {!loading && !error && (
          <div className="participants-table-container">
            <div className="ag-theme-alpine" style={{ height: '600px', width: '100%' }}>
              <AgGridReact
                columnDefs={columnDefs}
                rowData={participants}
                defaultColDef={defaultColDef}
                rowHeight={rowHeight}
                headerHeight={headerHeight}
                pagination={true}
                paginationPageSize={20}
                domLayout='normal'
                suppressHorizontalScroll={false}
                onGridReady={(params) => {
                  this.gridApi = params.api;
                  this.gridColumnApi = params.columnApi;
                  // Auto-size columns to fit content
                  params.api.sizeColumnsToFit();
                }}
                onGridSizeChanged={(params) => {
                  // Re-size columns when grid size changes
                  params.api.sizeColumnsToFit();
                }}
              />
            </div>
            
            {participants.length === 0 && (
              <div className="no-data">
                <p>No participants found.</p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }
}

export default MainTrainers
