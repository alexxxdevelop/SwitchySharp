/*
 This file is part of SwitchySharp.
 SwitchySharp is free software: you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation, either version 3 of the License, or
 (at your option) any later version.

 SwitchySharp is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with SwitchySharp.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
 * Settings are kept in chrome.storage.local (Manifest V3 has no background page
 * and no shared localStorage). Every context (service worker, popup, options)
 * keeps an in-memory mirror, so the getters stay synchronous.
 *
 * Storage layout:
 *   "cfg:<name>"  - simple values (formerly the "config" object in localStorage)
 *   "<name>"      - objects (profiles, rules, defaultRule, selectedProfile, ...)
 *   "__<name>"    - internal flags, never exported to backups
 */
var Settings = {};

Settings.CONFIG_PREFIX = "cfg:";
Settings.INTERNAL_PREFIX = "__";

Settings.data = {};
Settings._pending = [];
Settings._pendingKeys = {};

Settings._clone = function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
};

Settings._track = function track(keys, promise) {
    keys.forEach(function (key) {
        Settings._pendingKeys[key] = (Settings._pendingKeys[key] || 0) + 1;
    });
    var tracked = promise.catch(function (e) {
        console.error("Settings: storage write failed", e);
    }).then(function () {
        keys.forEach(function (key) {
            Settings._pendingKeys[key]--;
        });
        var i = Settings._pending.indexOf(tracked);
        if (i >= 0)
            Settings._pending.splice(i, 1);
    });
    Settings._pending.push(tracked);
    return tracked;
};

Settings._write = function write(key) {
    var value = Settings.data[key];
    if (value === undefined)
        return Settings._track([key], chrome.storage.local.remove(key));

    var items = {};
    items[key] = value;
    return Settings._track([key], chrome.storage.local.set(items));
};

/**
 * Waits until all writes issued from this context reach the storage.
 */
Settings.flush = function flush() {
    return Promise.all(Settings._pending.slice());
};

/**
 * (Re)reads all settings from chrome.storage.local.
 */
Settings.load = async function load() {
    await Settings.flush();
    var data = await chrome.storage.local.get(null);
    data = await Settings._migrateLocalStorage(data);
    Settings.data = data || {};
};

/**
 * Imports options of the old (Manifest V2) version, which lived in the
 * extension's localStorage. Only extension pages have localStorage.
 */
Settings._migrateLocalStorage = async function migrateLocalStorage(data) {
    if (data[Settings.INTERNAL_PREFIX + "legacyMigrated"] || typeof localStorage == "undefined")
        return data;

    var legacy = {};
    try {
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            legacy[key] = localStorage.getItem(key);
        }
    } catch (e) {
        legacy = {};
    }

    var items = Object.keys(legacy).length > 0 ? Settings.legacyToItems(legacy) : {};
    items[Settings.INTERNAL_PREFIX + "legacyMigrated"] = true;
    await chrome.storage.local.set(items);
    return Object.assign(data, items);
};

/**
 * Converts the old localStorage format ({key: JSON string}) to storage items.
 */
Settings.legacyToItems = function legacyToItems(legacy) {
    var items = {};
    for (var key in legacy) {
        if (!legacy.hasOwnProperty(key) || key.indexOf(Settings.INTERNAL_PREFIX) == 0)
            continue;

        var value = legacy[key];
        if (typeof value == "string") {
            try {
                value = JSON.parse(value);
            } catch (e) {
                continue;
            }
        }
        if (key == "config") {
            for (var name in value) {
                if (value.hasOwnProperty(name) && value[name] !== undefined && value[name] !== null)
                    items[Settings.CONFIG_PREFIX + name] = value[name];
            }
        } else if (value !== undefined && value !== null) {
            items[key] = value;
        }
    }
    return items;
};

/**
 * Returns all options in the old localStorage format (used by backups).
 */
Settings.exportLegacy = function exportLegacy(excludeKeys) {
    excludeKeys = excludeKeys || [];
    var result = {};
    var config = {};
    for (var key in Settings.data) {
        if (!Settings.data.hasOwnProperty(key) || key.indexOf(Settings.INTERNAL_PREFIX) == 0)
            continue;

        if (key.indexOf(Settings.CONFIG_PREFIX) == 0)
            config[key.substring(Settings.CONFIG_PREFIX.length)] = Settings.data[key];
        else if (excludeKeys.indexOf(key) < 0)
            result[key] = JSON.stringify(Settings.data[key]);
    }
    result.config = JSON.stringify(config);
    return result;
};

/**
 * Replaces all options with the given ones (old localStorage format).
 */
Settings.importLegacy = async function importLegacy(legacy) {
    await Settings.clear();
    var items = Settings.legacyToItems(legacy);
    Object.assign(Settings.data, items);
    await Settings._track(Object.keys(items), chrome.storage.local.set(items));
};

/**
 * Removes all options (internal flags are kept).
 */
Settings.clear = async function clear() {
    await Settings.flush();
    var keys = Object.keys(Settings.data).filter(function (key) {
        return key.indexOf(Settings.INTERNAL_PREFIX) != 0;
    });
    keys.forEach(function (key) {
        delete Settings.data[key];
    });
    await Settings._track(keys, chrome.storage.local.remove(keys));
};

Settings.setValue = function setValue(key, value) {
    Settings.data[Settings.CONFIG_PREFIX + key] = Settings._clone(value);
    Settings._write(Settings.CONFIG_PREFIX + key);
    return value;
};

Settings.getValue = function getValue(key, defaultValue) {
    var value = Settings.data[Settings.CONFIG_PREFIX + key];
    if (value === undefined)
        return defaultValue;

    return Settings._clone(value);
};

Settings.keyExists = function keyExists(key) {
    var value = Settings.data[Settings.CONFIG_PREFIX + key];
    return (value !== undefined && value !== null);
};

Settings.setObject = function setObject(key, object) {
    Settings.data[key] = Settings._clone(object);
    Settings._write(key);
    return object;
};

Settings.getObject = function getObject(key) {
    var value = Settings.data[key];
    if (value === undefined || value === null)
        return undefined;

    return Settings._clone(value);
};

Settings.refreshCache = function refreshCache() {
    // kept for compatibility: values are read from the in-memory mirror directly
};

Settings.listeners = [];

Settings.onChanged = function onChanged(fn) {
    Settings.listeners.push(fn);
};

// Keep the mirror in sync with writes done by other contexts.
chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName != "local")
        return;

    var changedKeys = [];
    for (var key in changes) {
        if (!changes.hasOwnProperty(key) || Settings._pendingKeys[key] > 0)
            continue; // our own newer value is on its way

        if (changes[key].newValue === undefined)
            delete Settings.data[key];
        else
            Settings.data[key] = changes[key].newValue;
        changedKeys.push(key);
    }

    if (changedKeys.length == 0)
        return;

    Settings.listeners.forEach(function (fn) {
        try {
            fn(changedKeys);
        } catch (e) {
            console.error(e);
        }
    });
});
