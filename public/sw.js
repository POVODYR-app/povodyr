self.addEventListener('push', function (event) {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'У вас нові сповіщення',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: {
        url: data.url || '/dashboard',
      },
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'POVODYR', options)
    );
  } catch (e) {
    console.error('Помилка обробки push-повідомлення:', e);
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
