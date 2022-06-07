// Service worker that makes the website run offline.
// Author: Jonas Beuchert
// Sources:
// https://web.dev/offline-cookbook/
// https://developers.google.com/web/fundamentals/codelabs/offline

// Cache name
const CACHE = 'snappergps-static-v1';

async function updateCache () {
    // Open 'caches' object
    caches.open(CACHE).then(function (cache) {
        // Populate 'caches' object with list of resources to cache
        return cache.addAll([
            '/',
            '/configure',
            '/upload',
            '/images/favicon.ico',
            '/css/style.css',
            '/css/upload.css',
            '/js/configure/configureComms.js',
            '/js/configure/configureUI.js',
            '/js/upload/uploadComms.js',
            '/js/upload/uploadUI.js',
            '/js/deviceCommunication.js',
            '/js/deviceInfo.js',
            '/service-worker.js',
            '/strftime-min.js',
            '/FileSaver.js',
            '/jszip.min.js',
        ]);
        // TODO: Handle fail of addAll operation
    })
    console.log('Updated all resources in cache.');
}

// Cache page assets
// Mode: on install - as a dependency
self.addEventListener('install', function (event) {
    event.waitUntil(
        updateCache,
    );
});

// Service worker intercepts requests to resources
// Mode: network, falling back to cache
// Trigger whenever request is made
self.addEventListener('fetch', event => {
    event.respondWith(
        // Try to fetch resource from network
        fetch(event.request).catch(() =>
            // If resource could not be fetched from network, get it from cache
            caches.match(event.request)
        ).then(response =>
            // // If resource could be fetched from network, open cache
            // caches.open(CACHE).then(cache =>
            //     // Put resource from network into cache
            //     cache.put(event.request, response.clone()).then(() =>
                    // Return resource from network
                    response
                // )
            // )
        ),
    );
});

// // Service worker intercepts requests to cached resources
// // Mode: cache, falling back to network
// // Trigger whenever request is made
// self.addEventListener('fetch', function (event) {
//     event.respondWith(
//         // Check if requested resource is available in cache
//         caches.match(event.request).then(function (response) {
//             // If yes, pull from cache, if not, fetch it from network
//             return response || fetch(event.request);
//         }),
//     );

//     // Update entry with latest contents from server.
//     // waitUntil() to prevent worker to be killed until cache is updated.
//     event.waitUntil(
//         update(event.request)
//     );
// });

// Open cache, perform network request, and store new response data.
// function update(request) {
//     return caches.open(CACHE).then(function (cache) {
//         // If there was no need to fetch resource from network:
//         if (!request.bodyUsed) {
//             return fetch(request).then(function (response) {
//                 // if (!response.ok) {
//                 //     throw new TypeError('Bad response status');
//                 //   }
//                 return cache.put(request, response.clone()).then(function () {
//                     return response;
//                 });
//             });
//         }
//     });
// }

// Register event listener for the 'push' event.
self.addEventListener('push', function (event) {

    console.log('Push notification received.');

    // Retrieve the textual payload from event.data (a PushMessageData object).
    // Other formats are supported (ArrayBuffer, Blob, JSON), check out the documentation
    // on https://developer.mozilla.org/en-US/docs/Web/API/PushMessageData.
    const uploadID = event.data.text();

    // Keep the service worker alive until the notification is created.
    event.waitUntil(
        // Show a notification with title 'ServiceWorker Cookbook' and use the payload
        // as the body.
        self.registration.showNotification('SnapperGPS - ' + uploadID, {
            // body: 'I have processed your data. You can go to ' +
            //       'https://snapper-gps.herokuapp.com/view?uploadid=' +
            //       uploadID + ' to view and download your track.',
            body: 'I have processed your data. Click here ' +
                  'to view and download your track.',
            icon: 'images/icon-512.png',
            // badge: 'images/icon-512.png'
            data: uploadID
        })
    );

});

self.addEventListener('notificationclick', function (event) {

    console.log('Notification click received.');

    const uploadID = event.notification.data;

    event.notification.close();

    event.waitUntil(
        clients.openWindow('https://snapper-gps.herokuapp.com/view?uploadid=' +
                           uploadID)
    );

});
