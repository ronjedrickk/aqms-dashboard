importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyD0A5sSpOnfUkRq0nBwGKgPnTydujt2D3c',
  projectId: 'adu-aqms-28741',
  messagingSenderId: '59449331551',
  appId: '1:59449331551:web:4c1b01af4409e6016030ea'
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