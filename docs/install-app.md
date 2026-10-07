---
title: Install the app
description: "Install Mitra as an app on a computer, an Android phone, an iPhone or an iPad, so it opens in a window of its own."
---

Mitra runs in your browser, and you can also install it as an app. Nothing comes from an app store: your browser gives Mitra its own window and icon, and you open it from your dock, taskbar, start menu or home screen like any other app.

Installing is worth it for three reasons:

- Mitra opens in its own window, away from your browser tabs, and its notifications show under its own name and icon.
- On an iPhone or iPad, it's the only way to get [reminders](reminders.md).
- On a computer, Mitra can open `.ics` files and `webcal://` links for you. See [Calendar files](calendar-files.md).

The installed app is always called Mitra and has Mitra's icon, even when your server gives the instance [a name of its own](configuration.md#name-your-instance).

## On a computer

In Chrome, Edge and other Chromium-based browsers, open Mitra and click the install icon at the end of the address bar. When the browser offers to install Mitra, the sidebar also shows an **Install as an App** button at the bottom. You can also go through the browser's menu: in Chrome, **Cast, save, and share → Install page as app**, and in Edge, **Apps → Install this site as an app**.

In Safari on a Mac, choose **File → Add to Dock**.

Once installed, Mitra opens in its own window. If that window is already open when you open a calendar file or link, Mitra brings it to the front instead of opening a second one.

## On Android

Open Mitra in Chrome, open the browser menu (**⋮**) and choose **Install app** or **Add to Home screen**. Mitra then shows up with your other apps.

Reminders work in the browser on Android too, so installing is up to you.

## On iPhone and iPad

Open Mitra in Safari, tap the Share button, then **Add to Home Screen**. From then on, open Mitra from its icon on your home screen.

On iPhone and iPad, notifications only work in the installed app, from iOS and iPadOS 16.4 onwards. Allow them from inside the installed app: Safari and the app are separate, and only the app can get reminders.

> [!NOTE]
> If your server sits behind a reverse proxy that signs you in with a cookie, installing still works. Mitra asks for its app description (the web app manifest) with your cookies, so the proxy lets the request through.
