# Frontend Data Persistence Guide

## Overview
Your app now automatically saves and restores user data when refreshing the page, so users won't lose their progress.

## What Data is Saved
- **Form data**: All participant details and health declaration answers
- **Participants list**: Previously registered participants
- **Current step**: Where the user was in the form process
- **Language selection**: User's chosen language (already implemented in LanguageContext)

## How It Works

### Automatic Saving
Data is automatically saved to browser localStorage when:
- User types in any form field
- User submits the form successfully
- Participant data is updated from the backend
- Language is changed (via LanguageContext)

### Automatic Loading
Data is automatically restored when:
- Page loads/refreshes
- User navigates back to the app
- App component mounts

### Data Expiration
- Saved data expires after **24 hours** to prevent stale data
- Expired data is automatically cleared

## User Controls

### Clear Saved Data Button
- Red "🗑️ Clear Saved Data" button appears on form pages
- Instantly clears all saved form data
- Shows confirmation message
- Useful for starting over or troubleshooting

### Visual Feedback
The app shows notifications for:
- 💾 Data saved (appears briefly after changes)
- 🔄 Data restored from previous session (on page load)
- 🗑️ Saved data cleared successfully
- ❌ Error messages if save/load fails

## Technical Details

### Storage Location
- Uses browser's `localStorage`
- Key: `participantsAppState`
- Language: `selectedLanguage` (managed by LanguageContext)
- Participant ID: `participantId` (for specific participant retrieval)

### Data Structure
```json
{
  "participants": [...],
  "selectedLanguage": "en",
  "currentStep": 1,
  "formData": {...},
  "currentParticipantIndex": 0,
  "lastUpdated": 1641234567890
}
```

### Error Handling
- Corrupted data is automatically cleared
- Network errors don't affect saved data
- Graceful fallback to default state

## Benefits
1. **No lost work**: Users can refresh without losing progress
2. **Better UX**: Seamless continuation of tasks
3. **Offline resilience**: Form data persists even with network issues
4. **Multi-session support**: Users can return later and continue

## Privacy & Security
- Data stored locally in browser only
- No sensitive data transmitted unless user submits
- Data expires automatically
- User can manually clear at any time

## Browser Compatibility
- Works in all modern browsers that support localStorage
- Fallback handling for browsers without localStorage support
- No external dependencies required
