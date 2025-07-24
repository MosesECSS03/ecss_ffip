const axios = require('axios');
//
// OneSignal App ID and REST API Key
const ONESIGNAL_APP_ID = '6eeef348-a40d-48a8-845e-8d604951d5f2';
const ONESIGNAL_API_KEY = 'Basic os_v2_app_n3xpgsfebvekrbc6rvqesuov6jieg5savoeuypnmdncephj4ii3bzr7fpnzy4bk7c3bhimdx7i4lebur7qdwqojsxw6ic3qu6rw6ura';


/**
 * Send a OneSignal push notification to all users or specific users as a visible banner.
 * @param {Object} params
 * @param {string} params.title - Notification title
 * @param {string} params.message - Notification message
 * @param {string} [params.url] - Optional URL to open on click
 * @param {string[]} [params.playerIds] - Optional array of OneSignal player IDs to target specific users
 */
async function sendOneSignalNotification({ title, message, url}) {
  console.log("Sending OneSignal notification with:", { title, message, url});
  try {
    const data = {
      app_id: ONESIGNAL_APP_ID,
      contents: { en: message },
      headings: { en: title },
      priority: 10,
      ttl: 259200,
      //url: url,
      android_sound: "default",
      ios_sound: "default",
      chrome_web_icon: "https://ecss.org.sg/wp-content/uploads/2023/03/cropped-EN_Logo_RGB_Normal_Small-01.png", // Optional: your icon URL
      chrome_web_image: "https://ecss.org.sg/wp-content/uploads/2023/03/cropped-EN_Logo_RGB_Normal_Small-01.png", // Optional: banner image
      // Remove content_available/mutable_content to avoid silent notifications
    };
      data.include_player_ids = [
      "4297137a-65af-4551-89c0-4a0566bb63e7",
      "18111175-e4b2-4820-b2ad-60d5a53a5ba9",
      "0b21bd83-6afb-4a21-8efc-561f2fbd9efe"
    ];
    console.log("OneSignal request payload:", JSON.stringify(data));

    const response = await axios.post(
      'https://onesignal.com/api/v1/notifications',
      data,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': ONESIGNAL_API_KEY
        }
      }
    );

    //console.log("OneSignal API response:", response.data);
    return response.data;
  } catch (error) {
    console.error("OneSignal API error:", error.response ? error.response.data : error.message);
    throw error;
  }
}

module.exports = { sendOneSignalNotification };