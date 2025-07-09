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
          width: 75,
          valueGetter: (params) => {
            // Return the row index + 1 as serial number
            return params.node.rowIndex + 1;
          }
        },
        { 
          headerName: 'Name', 
          field: 'name',
          width: 150
        },
        { 
          headerName: 'NRIC', 
          field: 'nric',
          width: 150
        },
        { 
          headerName: 'Age', 
          field: 'age',
          width: 75
        },
        { 
          headerName: 'Gender', 
          field: 'gender',
          width: 100,
          cellRenderer: (params) => {
            return params.value ? params.value.charAt(0).toUpperCase() + params.value.slice(1) : '';
          }
        },
        { 
          headerName: 'Date Of Birth', 
          field: 'dateOfBirth',
          width: 150
        },
        { 
          headerName: 'Phone', 
          field: 'phoneNumber',
          width: 150
        },
        { 
          headerName: 'Height', 
          field: 'height',
          width: 100
        },
        { 
          headerName: 'Weight', 
          field: 'weight',
          width: 100
        },
        { 
          headerName: 'BMI', 
          field: 'bmi',
          width: 100
        },
        { 
          headerName: 'Test Date', 
          field: 'submittedAt',
          width: 150,
          valueFormatter: (params) => {
            if (params.value && params.value.date && params.value.time) {
              return `${params.value.date}`;
            }
            return '';
          }
        },
        // Station columns will be added dynamically
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

  // Helper method to get all unique station names and their sub-keys from participants data
  getAllStationNamesAndKeys = (participants) => {
    const stationStructure = {};
    participants.forEach(participant => {
      if (participant.stations && Array.isArray(participant.stations)) {
        participant.stations.forEach(station => {
          Object.entries(station).forEach(([stationName, stationData]) => {
            if (!stationStructure[stationName]) {
              stationStructure[stationName] = new Set();
            }
            if (typeof stationData === 'object' && stationData !== null) {
              Object.keys(stationData).forEach(key => {
                stationStructure[stationName].add(key);
              });
            } else {
              // For simple values, use 'value' as the key
              stationStructure[stationName].add('value');
            }
          });
        });
      }
    });
    
    // Convert sets to arrays
    Object.keys(stationStructure).forEach(stationName => {
      stationStructure[stationName] = Array.from(stationStructure[stationName]);
    });
    
    return stationStructure;
  }

  // Helper method to create dynamic station columns with sub-columns
  createStationColumns = (stationStructure) => {
    const { language } = this.context;
    const t = translations[language];
    const columns = [];
    
    Object.entries(stationStructure).forEach(([stationName, subKeys]) => {
      subKeys.forEach(subKey => {
        // Get translated station name
        const getTranslatedStationName = (name) => {
          // Map station names to translation keys
          const stationKeyMap = {
            'heightWeight': t.stations?.heightWeight || name,
            'sitStand': t.stations?.sitStand || name,
            'armBanding': t.stations?.armBanding || name,
            'marching': t.stations?.marching || name,
            'sitReach': t.stations?.sitReach || name,
            'backStretch': t.stations?.backStretch || name,
            'speedWalking': t.stations?.speedWalking || name,
            'handGrip': t.stations?.handGrip || name,
          };
          
          // Try to find a match or return the original name
          return stationKeyMap[name] || name;
        };

        const translatedStationName = getTranslatedStationName(stationName);

        // Get translated sub-key name
        const getTranslatedSubKey = (key) => {
          const subKeyMap = {
            'score1': t.score1 || key,
            'score2': t.score2 || key,
            'remarks': t.remarks || key,
            'result': t.result || key,
            'height': t.height || key,
            'weight': t.weight || key,
            'leftRight': t.leftRight || key,
            'time': t.time || key,
            'score': t.score || key
          };
          
          return subKeyMap[key] || key;
        };

        const translatedSubKey = getTranslatedSubKey(subKey);

        // Create a custom header component for multi-line display
        const headerComponent = (props) => {
          if (subKey === 'value') {
            // For simple values, just show the translated station name
            return (
              <div style={{ 
                textAlign: 'center', 
                lineHeight: '1.2', 
                whiteSpace: 'pre-line',
                fontSize: '14px',
                fontWeight: '600',
                padding: '4px'
              }}>
                {translatedStationName}
              </div>
            );
          } else {
            // For complex values, show translated station name on first line and translated sub-key on second line
            return (
              <div style={{ 
                textAlign: 'center', 
                lineHeight: '1.2', 
                whiteSpace: 'pre-line',
                fontSize: '14px',
                fontWeight: '600',
                padding: '4px'
              }}>
                {translatedStationName}<br/>{translatedSubKey}
              </div>
            );
          }
        };
        
        // Set width based on column type - remarks columns get wider width
        let columnWidth = 150; // default width
        if (subKey.toLowerCase().includes('remarks') || subKey.toLowerCase().includes('remark')) {
          columnWidth = 300;
        }
        
        const columnDef = {
          headerName: '', // Empty since we're using custom header component
          field: `station_${stationName}_${subKey}`,
          width: columnWidth,
          headerClass: 'multi-line-header',
          headerComponent: headerComponent, // Always use custom header component
          valueGetter: (params) => {
            if (params.data.stations && Array.isArray(params.data.stations)) {
              for (let station of params.data.stations) {
                if (station[stationName]) {
                  const stationData = station[stationName];
                  if (typeof stationData === 'object' && stationData !== null) {
                    return stationData[subKey] || '';
                  } else if (subKey === 'value') {
                    return stationData;
                  }
                }
              }
            }
            return '';
          }
        };
        
        columns.push(columnDef);
      });
    });
    
    return columns;
  }

  // Update column definitions with station columns
  updateColumnDefsWithStations = (participants) => {
    const stationStructure = this.getAllStationNamesAndKeys(participants);
    const stationColumns = this.createStationColumns(stationStructure);
    
    // Get base columns (everything except the dynamic station columns)
    const baseColumns = this.state.columnDefs;
    
    // Combine base columns with station columns
    const updatedColumnDefs = [...baseColumns, ...stationColumns];
    
    this.setState({ columnDefs: updatedColumnDefs });
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
      });
      
      // Update column definitions with station columns after data is loaded
      this.updateColumnDefsWithStations(response.data);
      
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
        <h1>All Participants Results </h1>
        
        {loading && <p>Loading participants...</p>}
        {error && <p className="error-message">{error}</p>}
        
        {!loading && !error && (
          <div className="participants-table-container">
            <div className="ag-theme-alpine" style={{ height: '600px', width: '100%' }}>
              <AgGridReact
                columnDefs={columnDefs}
                rowData={participants}
                defaultColDef={defaultColDef}
                headerHeight={headerHeight}
                getRowHeight={() => 'auto'}
                pagination={true}
                paginationPageSize={participants.length}
                domLayout='normal'
                suppressHorizontalScroll={false}
                alwaysShowHorizontalScroll={true}
                alwaysShowVerticalScroll={false}
                suppressColumnVirtualisation={false}
                suppressRowVirtualisation={true}
                enableBrowserTooltips={true}
                onGridReady={(params) => {
                  this.gridApi = params.api;
                  this.gridColumnApi = params.columnApi;
                }}
                onGridSizeChanged={(params) => {
                  // Allow natural scrolling
                  if (params.api) {
                    params.api.resetRowHeights();
                  }
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
