// Custom service worker source — next-pwa's swSrc option runs this through
// webpack (InjectManifest mode) instead of auto-generating a worker from its
// default Workbox template, which is what's needed to add push/
// notificationclick handling. self.__WB_MANIFEST is replaced at build time
// with the precache list next-pwa would otherwise have generated on its own,
// so this fully replaces the default output, not adds to it.
import { precacheAndRoute } from "workbox-precaching";

precacheAndRoute(self.__WB_MANIFEST);

// Web Push payloads are sent as JSON from lib/push.ts — see that file for
// the exact shape ({ title, body, url, tag }).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "GrabOn", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "GrabOn";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    // A shared tag means a second notification for the same order (e.g.
    // status changing twice in quick succession) replaces the first
    // instead of stacking a pile of near-duplicate notifications.
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Focuses an already-open tab on the target URL if one exists, otherwise
// opens a new one — clicking a notification shouldn't pile up duplicate tabs.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
