/*
 This file is part of SwitchySharp.
 SwitchySharp is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.
 */

// Manifest V3 service worker entry point.
importScripts(
    "assets/libs/parseUri.js",
    "assets/scripts/logger.js",
    "assets/scripts/settings.js",
    "assets/scripts/i18n.js",
    "assets/scripts/utils.js",
    "assets/scripts/plugin.js",
    "assets/scripts/profileManager.js",
    "assets/scripts/ruleManager.js",
    "assets/scripts/core.js",
    "assets/scripts/main.js"
);
