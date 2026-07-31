// Custom service-worker code, compiled by next-pwa's buildCustomWorker and
// prepended into the generated public/sw.js via importScripts. Workbox keeps
// handling precaching/runtime caching; this file only adds the push +
// notificationclick listeners on top.
//
// The push payload is a JSON string from the server (src/lib/push.ts):
//   { title, body, icon, badge, url, tag }
// Everything is defensive — a malformed payload still shows something instead
// of swallowing the event.

self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192.png",
    badge: data.badge || "/icons/icon-192.png",
    // Opening the notification focuses an existing window/tab for the URL
    // rather than stacking new ones.
    data: { url: data.url || "/" },
    renotify: false,
  };
  // A `tag` collapses concurrent notifications into one line in the tray
  // (e.g. many rider-available pings). Only set when the server supplied one.
  if (data.tag) {
    options.tag = data.tag;
    options.renotify = true;
  }

  event.waitUntil(self.registration.showNotification(data.title || "GrabOn", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client && "navigate" in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
