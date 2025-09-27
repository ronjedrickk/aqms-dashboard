importScripts("https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: 'AIzaSyD0A5sSpOnfUkRq0nBwGKgPnTydujt2D3c',
  projectId: 'adu-aqms-28741',
  messagingSenderId: '59449331551',
  appId: '1:59449331551:web:4c1b01af4409e6016030ea',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title, {
    body,
    icon: "/icon.png",
  });
});
