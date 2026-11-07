"use strict";

const CACHE_NAME = "coin999-schedule-v6";

const APP_ASSETS = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json",
    "./icons/icon.svg",
    "./icons/icon-192.png",
    "./icons/icon-512.png"
];

const DATA_ASSETS = [
    "./data.json",
    "./i18n.json",
    "./schedule-dictionaries.json"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll([
                ...APP_ASSETS,
                ...DATA_ASSETS
            ]);
        })
    );

    self.skipWaiting();
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );

    self.clients.claim();
});

self.addEventListener("fetch", event => {
    const request = event.request;

    if (request.method !== "GET") {
        return;
    }

    const url = new URL(request.url);

    if (url.origin === self.location.origin && url.pathname.endsWith("/calendar.ics")) {
        event.respondWith(calendarResponse(url));
        return;
    }

    const isDataFile =
        url.pathname.endsWith("/data.json") ||
        url.pathname.endsWith("/i18n.json") ||
        url.pathname.endsWith("/schedule-dictionaries.json");

    if (isDataFile) {
        event.respondWith(networkFirst(request));
        return;
    }

    event.respondWith(cacheFirst(request));
});

// "Add to calendar": app.js builds the .ics text and passes it base64url-encoded
// in ?d=. Serving it from a real same-origin URL with text/calendar lets iOS
// show its native "Add to Calendar" sheet (blob: URLs don't).
const MAX_ICS_LENGTH = 16000;

function calendarResponse(url) {
    const encoded = url.searchParams.get("d") || "";
    const rawName = url.searchParams.get("name") || "event.ics";
    const filename = /^[\w.-]{1,80}\.ics$/.test(rawName) ? rawName : "event.ics";

    let ics = "";

    try {
        const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
        const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
        const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));

        ics = new TextDecoder().decode(bytes);
    } catch (error) {
        ics = "";
    }

    if (ics.length > MAX_ICS_LENGTH || !ics.startsWith("BEGIN:VCALENDAR") || !ics.trimEnd().endsWith("END:VCALENDAR")) {
        return new Response("Invalid calendar data", { status: 400 });
    }

    return new Response(ics, {
        headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store"
        }
    });
}

async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
        return cachedResponse;
    }

    const networkResponse = await fetch(request);

    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkResponse.clone());

    return networkResponse;
}

async function networkFirst(request) {
    const cache = await caches.open(CACHE_NAME);

    try {
        const networkResponse = await fetch(request);
        cache.put(request, networkResponse.clone());
        return networkResponse;
    } catch (error) {
        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        throw error;
    }
}
