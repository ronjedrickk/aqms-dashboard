importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);

  const { title, body } = payload.notification || {};
  if (title) {
    self.registration.showNotification(title, {
      body,
      icon: '/icon.png',
      badge: '/badge.png',
      timestamp: Date.now(),
      vibrate: [200, 100, 200],
      tag: 'aqms-alert',
      requireInteraction: true
    });
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'view') {
    // Open specific page when "View Details" is clicked
    clients.openWindow('/dashboard');
  } else {
    // Default action when notification is clicked
    clients.openWindow('/');
  }
});