# SwitchySharp 2

A fast proxy switcher for Chrome, Edge and other Chromium-based browsers: proxy profiles, URL-based
auto switch rules and online rule lists. It is rebuilt for **Manifest V3** and has a **dark design**
(a light theme is one click away).

## Why this fork exists

The original **Proxy SwitchySharp** was a popular proxy manager, but it was abandoned many years ago.
It is a Manifest V2 extension, so current versions of Chrome and Edge no longer install or run it.
Its successor, SwitchyOmega, is also a Manifest V2 extension and has the same problem.

This repository is a reworked version of SwitchySharp that works in today's browsers:

- moved to **Manifest V3**: a service worker instead of the background page, `chrome.storage`
  instead of `localStorage`, and no `eval` or synchronous network requests;
- new **dark design** for the popup and the options page, plus a reworked **light theme**,
  switchable in the options header;
- **Russian localization** and a language switcher;
- options from the old version are migrated automatically, and old `.bak` backups can still be
  restored;
- outdated parts removed: the SwitchyOmega upgrade nag, the "Network" tab, the "System Proxy" and
  quick "New Rule" / temporary rule popup items;
- a working Online Rule List example (see below).

## Features

- **Proxy profiles**: HTTP, HTTPS, FTP and SOCKS4/SOCKS5 proxies, one proxy for all protocols,
  a bypass list ("No Proxy for") and PAC scripts (by URL or imported from a file).
- **Auto Switch Mode**: chooses a profile for every URL by your switch rules (wildcard or RegExp).
  The toolbar icon shows which profile the current page uses.
- **Online Rule List**: downloads a rule list (SwitchySharp or AutoProxy/gfwlist format) on a
  schedule and sends the matching sites through the chosen profile.
- **Quick Switch**: cycle through selected profiles with a single click on the toolbar icon.
- **Startup profile**: the profile applied when the browser starts.
- **Import / Export**: export the rules as a PAC file or a rule list, and back up or restore all
  options (from a file or a URL).
- **Dark and light themes**, dark by default.
- **English, Russian and Simplified Chinese**. The language follows the browser by default and can
  be changed in the options header (the extension name in the browser always follows the browser
  language).

## Installation

### From source (developer mode)

1. Download or clone this repository.
2. Open `chrome://extensions` (or `edge://extensions`).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the repository folder (the one with `manifest.json`).

Requires Chrome / Edge 102 or newer.

## Usage

1. Click the extension icon → **Options**, open **Proxy Profiles**, create a profile and press **Save**.
2. Choose the profile in the extension menu. **Direct Connection** turns the proxy off.
3. To use different proxies for different sites, open **Switch Rules**, enable them, add rules
   and select **Auto Switch Mode** in the menu.

### Example: Online Rule List for Telegram

To open Telegram (`telegram.org`, `t.me` and their subdomains) through the profile named
**My Proxy** and every other site directly:

1. Publish a text file with the following content at any URL. A raw file on GitHub or a Gist works
   fine; a ready-made file is in [`examples/telegram.txt`](examples/telegram.txt).

   ```
   ; SwitchySharp rule list: Telegram
   #BEGIN

   [wildcard]
   *://*.telegram.org/*
   *://*.t.me/*

   #END
   ```

   One line is one site (URL pattern); add as many lines as you need.
   `*://*.t.me/*` matches `t.me` itself and all its subdomains.

2. In **Options → Switch Rules** enable **Online Rule List**, paste the file URL into
   **Rule List URL**, choose **My Proxy** in **Proxy Profile**, leave **AutoProxy Compatible List**
   unchecked and press **Save**.
3. Make sure the **Default Rule** is set to **[Direct Connection]**, then select **Auto Switch Mode**
   in the extension menu.

**Where is the proxy profile?** Not in the file. All sites of an online rule list go through the
single profile chosen in **Proxy Profile** next to **Rule List URL**. To send different sites
through different profiles, add them as **Switch Rules** instead: every rule has its own
**Proxy Profile**.

The same list in AutoProxy format is in
[`examples/telegram-autoproxy.txt`](examples/telegram-autoproxy.txt) (check
**AutoProxy Compatible List** for it). `||t.me^` means `t.me` and its subdomains; `^` ends the
domain name, so `t.media.com` does not match:

```
[AutoProxy 0.2.9]
||telegram.org^
||t.me^
```

The **Example** link next to **Online Rule List** in the options page shows the same instructions.

### Rule list format

```
; comment
#BEGIN

[wildcard]
*://*.example.com/*
https://example.org/path*

[regexp]
^https?://(www\.)?example\.net/

#END
```

Only the part between `#BEGIN` and `#END` is read. Lines starting with `;` or `!` are comments.

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `proxy` | to apply the selected proxy profile or the generated PAC script |
| `tabs` | to read the active tab's URL, show which profile Auto Switch Mode uses for it and reload the tab on switch (optional setting) |
| `storage` | to keep profiles, rules and options |
| `alarms` | to update the Online Rule List on schedule |
| `<all_urls>` (host permission) | to download PAC scripts, rule lists and online backups from the URLs you enter |

The extension does not collect or send any data. Network requests go only to the URLs you
configure (PAC scripts, rule lists and backups).

## Project structure

```
manifest.json            Manifest V3
background.js            service worker entry point
popup.html / options.html
assets/scripts/          extension logic (core.js, settings.js, profileManager.js, ruleManager.js, ...)
assets/styles/           popup and options styles (dark and light themes)
_locales/                translations
examples/                sample rule lists
```

## Credits and license

SwitchySharp 2 is developed by @alexxxdevelop.

It is based on **Proxy SwitchySharp** © 2011 Shyc2001, which in turn was based on
"Proxy Switchy!" by Mohammad Hejazi and "SwitchyPlus" by ayanamist.

Licensed under the **GNU General Public License v3.0**, see [`COPYING`](COPYING).
Bundled libraries: jQuery, jQuery UI (MIT) and parseUri by Steven Levithan (MIT).
