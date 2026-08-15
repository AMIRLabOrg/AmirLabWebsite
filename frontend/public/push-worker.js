self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : { title: "AMIR Lab", body: "You have a new workspace update." };
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: "/icon-192.png",
    data: { url: payload.url || "/workspace" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/workspace"));
});
