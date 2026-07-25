import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAnalytics, logEvent } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-analytics.js';

// Firebase project: travelplanner-ce302
// TODO: register a Web app in the Firebase console (Project settings → Your apps → Web)
// with Google Analytics enabled, then paste the web apiKey, appId and measurementId below.
// The iOS/Android apiKey and appId from firebase_options.dart will NOT work here.
const firebaseConfig = {
  apiKey: "AIzaSyD_ab6dvLFh70PoMNNFeGmU_RGm5mSM-Ec",
  authDomain: "travelplanner-ce302.firebaseapp.com",
  projectId: "travelplanner-ce302",
  storageBucket: "travelplanner-ce302.firebasestorage.app",
  messagingSenderId: "782208576101",
  appId: "1:782208576101:web:36525db2da5b7e5e3a348c",
  measurementId: "G-TXN8X8PLDX"
};

const app = initializeApp(firebaseConfig);

// getAnalytics() starts automatic page_view collection (enhanced measurement),
// which is what tracks site visits — no extra call needed.
export const analytics = getAnalytics(app);
export { logEvent };

// Global function for tracking events from HTML onclick handlers
window.trackEvent = (eventName, params = {}) => {
  logEvent(analytics, eventName, params);
};
