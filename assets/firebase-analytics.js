import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAnalytics, logEvent, setConsent } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-analytics.js';

// Firebase project: travelplanner-ce302
const firebaseConfig = {
  apiKey: "AIzaSyD_ab6dvLFh70PoMNNFeGmU_RGm5mSM-Ec",
  authDomain: "travelplanner-ce302.firebaseapp.com",
  projectId: "travelplanner-ce302",
  storageBucket: "travelplanner-ce302.firebasestorage.app",
  messagingSenderId: "782208576101",
  appId: "1:782208576101:web:36525db2da5b7e5e3a348c",
  measurementId: "G-TXN8X8PLDX"
};

let analytics = null;

/**
 * Starts Firebase Analytics. Called only by assets/consent.js — importing this
 * module must never write a cookie on its own, which is why getAnalytics() lives
 * in here rather than at the top level.
 *
 * @param {boolean} granted  Whether the visitor has accepted. Normally true, since
 *   consent.js defers loading until then; false only in advanced consent mode,
 *   where the SDK loads early and must run storage-less until the visitor decides.
 *
 * getAnalytics() begins automatic page_view collection (enhanced measurement), so
 * visits are tracked without any further call.
 */
export function initAnalytics(granted = true) {
  if (analytics) return analytics;

  const app = initializeApp(firebaseConfig);

  // Belt and braces: Consent Mode defaults are already denied in the page <head>.
  // Saying it through the SDK too means storage follows the visitor's choice
  // regardless of gtag load ordering.
  const value = granted ? 'granted' : 'denied';
  setConsent({
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
    analytics_storage: value
  });

  analytics = getAnalytics(app);

  // Hand consent.js a stable way to log queued and future events.
  window.__owlioAnalytics = {
    logEvent: (name, params = {}) => logEvent(analytics, name, params)
  };

  return analytics;
}
