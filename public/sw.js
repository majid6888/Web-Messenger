// Web Messenger Service Worker
// Handles background notification clicks and focuses / opens the conversation

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const conversationId = data.conversationId;
  const targetUrl = conversationId ? `/?conv=${encodeURIComponent(conversationId)}` : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 1. If an existing window client is already open, focus it and tell it to open the conversation
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if (conversationId) {
            client.postMessage({
              type: 'OPEN_CONVERSATION',
              conversationId,
              senderId: data.senderId,
              messageId: data.messageId,
              senderName: data.senderName,
            });
          }
          return;
        }
      }

      // 2. If no window is currently open, open a new window to targetUrl
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
