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
import * as XLSX from 'xlsx';


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
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'flex',
          alignItems: 'center',
          fontSize: '18px',
          fontWeight: '500'
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
    this.socket.on('participant-updated', async (data) => {
      await this.fetchParticipants()
    });
  }

  // Helper method to get all unique station names and their sub-keys from participants data
  getAllStationNamesAndKeys = (participants) => {
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

    const stationStructure = {};
    
    // Initialize all stations in the correct order with empty sets
    stationOrder.forEach(stationName => {
      stationStructure[stationName] = new Set();
    });

    // Collect all unique sub-keys for each station
    participants.forEach(participant => {
      if (participant.stations && Array.isArray(participant.stations)) {
        participant.stations.forEach(station => {
          Object.entries(station).forEach(([stationName, stationData]) => {
            // Only process stations that are in our defined order
            if (stationOrder.includes(stationName)) {
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
            }
          });
        });
      }
    });
    
    // Convert sets to arrays and ensure all stations are present (even if empty)
    const finalStructure = {};
    stationOrder.forEach(stationName => {
      finalStructure[stationName] = Array.from(stationStructure[stationName] || []);
      // If no sub-keys found, add a default 'value' key to ensure the station column appears
      if (finalStructure[stationName].length === 0) {
        finalStructure[stationName] = ['value'];
      }
    });
    
    return finalStructure;
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
          // Map station names to translation keys - using exact keys from translations.js
          const stationKeyMap = {
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

  // Export data to Excel
  exportToExcel = () => {
    const { participants } = this.state;
    const { language } = this.context;
    const t = translations[language];
    
    if (!participants || participants.length === 0) {
      alert('No data to export');
      return;
    }

    // Create export data array
    const exportData = participants.map((participant, index) => {
      const row = {
        'S/N': index + 1,
        [t.name || 'Name']: participant.name || '',
        [t.age || 'Age']: participant.age || '',
        [t.gender || 'Gender']: participant.gender ? participant.gender.charAt(0).toUpperCase() + participant.gender.slice(1) : '',
        'Date Of Birth': participant.dateOfBirth || '',
        [t.phoneNumber || 'Phone']: participant.phoneNumber || '',
        [t.height || 'Height']: participant.height || '',
        [t.weight || 'Weight']: participant.weight || '',
        'BMI': participant.bmi || '',
        'Test Date': participant.submittedAt && participant.submittedAt.date ? participant.submittedAt.date : ''
      };

      // Add station data
      if (participant.stations && Array.isArray(participant.stations)) {
        participant.stations.forEach(station => {
          Object.entries(station).forEach(([stationName, stationData]) => {
            // Get translated station name
            const getTranslatedStationName = (name) => {
              const stationKeyMap = {
                'sitStand': t.stations?.sitStand || name,
                'armBanding': t.stations?.armBanding || name,
                'marching': t.stations?.marching || name,
                'sitReach': t.stations?.sitReach || name,
                'backStretch': t.stations?.backStretch || name,
                'speedWalking': t.stations?.speedWalking || name,
                'handGrip': t.stations?.handGrip || name,
              };
              return stationKeyMap[name] || name;
            };

            const translatedStationName = getTranslatedStationName(stationName);

            if (typeof stationData === 'object' && stationData !== null) {
              Object.entries(stationData).forEach(([subKey, value]) => {
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
                const columnName = `${translatedStationName} - ${translatedSubKey}`;
                row[columnName] = value || '';
              });
            } else {
              row[translatedStationName] = stationData || '';
            }
          });
        });
      }

      return row;
    });

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // Auto-size columns
    const columnWidths = [];
    Object.keys(exportData[0] || {}).forEach((key, index) => {
      const maxLength = Math.max(
        key.length,
        ...exportData.map(row => String(row[key] || '').length)
      );
      columnWidths[index] = { wch: Math.min(Math.max(maxLength + 2, 10), 50) };
    });
    worksheet['!cols'] = columnWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Participants Data');

    // Generate filename with current date
    const currentDate = new Date().toISOString().split('T')[0];
    const filename = `ECSS_FFT_Participants_${currentDate}.xlsx`;

    // Save file
    XLSX.writeFile(workbook, filename);
  };

  render() {
    const { language } = this.context
    const t = translations[language]
    const { participants, loading, error, columnDefs, defaultColDef, rowHeight, headerHeight } = this.state

    return (
      <div className="page-container desktop-only">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1>All Participants Results</h1>
          <button 
            onClick={this.exportToExcel}
            disabled={loading || participants.length === 0}
            style={{
              backgroundColor: '#000000',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: participants.length > 0 ? 'pointer' : 'not-allowed',
              opacity: participants.length > 0 ? 1 : 0.6,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              if (participants.length > 0) {
                e.target.style.backgroundColor = '#333333';
                e.target.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = '#000000';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            📊 Export to Excel
          </button>
        </div>
        
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
                    getRowHeight={() => rowHeight}
                    pagination={true}
                    paginationPageSize={20}
                    domLayout='normal'
                    suppressHorizontalScroll={false}
                    alwaysShowHorizontalScroll={true}
                    alwaysShowVerticalScroll={false}
                    suppressColumnVirtualisation={false}
                    suppressRowVirtualisation={true}
                    onGridReady={(params) => {
                      this.gridApi = params.api;
                      this.gridColumnApi = params.columnApi;
                    }}
                    onGridSizeChanged={(params) => {
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
