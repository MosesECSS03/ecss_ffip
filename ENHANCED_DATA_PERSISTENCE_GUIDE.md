# Enhanced Data Persistence Guide

## Overview
Your application now has comprehensive data persistence implemented across all key components. User data is automatically saved and restored when pages are reloaded, ensuring no work is lost.

## Components with Data Persistence

### 1. Participants Component (`/participants`)
**What is saved:**
- Personal information (name, date of birth, phone, gender, etc.)
- Health declaration answers
- Form submission status
- Participant list data
- Current form state

**Key Features:**
- ✅ Automatic saving on every form field change (debounced to 500ms)
- ✅ Immediate saving on form submission
- ✅ Data restoration on page reload
- ✅ 24-hour data expiration for privacy
- ✅ Error recovery for corrupted data
- ✅ Manual clear data option

### 2. Volunteers Component (`/volunteers`)
**What is saved:**
- Selected station
- Form data for each station
- QR code value
- Scan status
- Completed stations list

**Key Features:**
- ✅ Automatic saving on station selection
- ✅ Automatic saving on form input changes (debounced to 500ms)
- ✅ Immediate saving after QR scan
- ✅ Immediate saving after successful data submission
- ✅ Data restoration on page reload
- ✅ 24-hour data expiration
- ✅ Manual clear data option

### 3. Language Context (Global)
**What is saved:**
- User's selected language preference

**Key Features:**
- ✅ Persistent across all pages
- ✅ Automatic restoration on app load

## How Data Persistence Works

### Automatic Saving
Data is saved automatically when:
- User types in form fields (debounced to reduce storage writes)
- User selects options or makes choices
- User submits forms successfully
- User navigates between sections

### Automatic Loading
Data is restored when:
- Page is refreshed/reloaded
- User navigates back to the application
- Component mounts for the first time

### Storage Location
- **Browser:** Uses `localStorage` API
- **Keys:** 
  - `participantsAppState` - Participants form data
  - `volunteersAppState` - Volunteers station data
  - `selectedLanguage` - Language preference
  - `participantId` - For specific participant retrieval

### Data Expiration & Cleanup
- **Automatic expiration:** 24 hours from last update
- **Automatic cleanup:** Corrupted data is detected and removed
- **Manual cleanup:** Clear saved data buttons available

## Visual Feedback

### Status Notifications
The app shows notifications for:
- 💾 **Data saved** - Brief notification after changes
- ️ **Saved data cleared successfully** - After manual clear
- ❌ **Error messages** - If save/load fails

### User Controls
- **🗑️ Clear Saved Data** button on each form
- **Instant feedback** for all operations
- **Non-intrusive notifications** that auto-dismiss

## Benefits for Users

### For Participants
1. **Never lose registration progress** - Can refresh page safely
2. **Resume where left off** - Continue multi-step forms
3. **Offline resilience** - Form data persists even with network issues
4. **Multi-session support** - Can return later and continue

### For Volunteers
1. **Station data preserved** - Switch between stations without losing data
2. **QR scan state maintained** - Refresh won't lose scanned codes
3. **Form progress saved** - All input preserved across reloads
4. **Session continuity** - Seamless experience even with interruptions

## Technical Details

### Error Handling
- **Corrupted data detection** - Automatic cleanup and fresh start
- **Storage quota errors** - Cleanup old data and retry
- **Network timeouts** - Don't affect saved data
- **JSON parsing errors** - Graceful fallback to default state

### Performance Optimizations
- **Debounced saving** - Reduces localStorage writes
- **Selective restoration** - Only loads relevant data
- **Age-based cleanup** - Prevents storage bloat
- **Efficient serialization** - Minimal storage footprint

### Security & Privacy
- **Local storage only** - No server-side personal data storage until submission
- **Automatic expiration** - Data doesn't persist indefinitely
- **User control** - Manual clear options always available
- **No sensitive data caching** - Passwords never stored

## Browser Compatibility
- ✅ **Chrome, Firefox, Safari, Edge** - Full support
- ✅ **Mobile browsers** - Works on iOS and Android
- ✅ **Fallback handling** - Graceful degradation if localStorage unavailable

## Troubleshooting

### If Data Isn't Saving
1. Check browser's localStorage isn't disabled
2. Ensure sufficient storage space available
3. Look for JavaScript errors in browser console
4. Try clearing browser cache and reloading

### If Data Isn't Loading
1. Check browser console for error messages
2. Try the "Clear Saved Data" button and restart
3. Verify localStorage permissions in browser settings
4. Test in incognito/private browsing mode

### If Storage Gets Full
- The app automatically cleans up old data
- Manual "Clear Saved Data" button available
- 24-hour auto-expiration prevents indefinite accumulation

## Development Notes

### For Localhost (Development)
- Full persistence works exactly the same
- Data saved to browser's localhost storage
- Can test by refreshing development server

### For Hosted Environment
- Works identically to localhost
- Uses same localStorage API
- Data persists across browser sessions
- Domain-specific storage (isolated per domain)

### Testing the Feature - Step by Step
1. **Fill out the participant form** partially:
   - Enter a name (e.g., "John Doe")
   - Enter a phone number (e.g., "123-456-7890")
   - Select a gender
   - Pick a date of birth
   
2. **Check for visual confirmation**:
   - Form fields with data should have a light green border
   
3. **Test persistence**:
   - **Refresh the page** (F5 or Cmd+R)
   - **Verify**: All your entered data should reappear in the form fields
   
4. **Complete and submit the form**:
   - Fill in all required fields
   - Complete the health declaration
   - Submit the form
   
5. **Test submitted state persistence**:
   - **Refresh the page** after submission
   - **Verify**: You should see your participant details (QR code view) instead of the form
   - This confirms you've already submitted and don't need to fill the form again
   
6. **Navigate away and back**:
   - Go to another page (like /volunteers)
   - Come back to /participants
   - **Verify**: 
     - If you submitted: Shows your details/QR code
     - If you haven't submitted: Shows the form with your saved data
   
7. **Clear and restart**:
   - Click "🗑️ Clear Saved Data" to reset
   - **Verify**: Form should be empty again

### Smart View Logic
The app automatically determines what to show based on your progress:

- **Fresh User**: Shows empty registration form
- **Partial Progress**: Shows form with your saved data to continue
- **Already Submitted**: Shows your participant details and QR code (no need to fill form again)
- **Want to Edit**: Click close on details view to return to editable form

### If Fields Don't Show Restored Data
1. **Check browser console** (F12 → Console tab) for:
   - "🔄 State restored from localStorage"
   - "🔍 ParticipantForm has restored data: {object with your data}"
   
2. **Look for error messages** in console
3. **Try the test button** - it will log current form state
4. **Check localStorage** in browser dev tools:
   - Application tab → Local Storage → your domain
   - Look for `participantsAppState` key

## Future Enhancements
- Cross-device synchronization (requires server component)
- Encrypted local storage for sensitive data
- Progressive web app offline support
- Cloud backup integration

---

**Note:** This enhanced data persistence ensures a professional, user-friendly experience that prevents data loss and provides seamless form interactions across page reloads and session interruptions.
