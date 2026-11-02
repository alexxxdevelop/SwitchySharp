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
 * Shared bootstrap for the service worker, the popup and the options page.
 * Settings are loaded asynchronously, so wait for |App.ready| before using
 * ProfileManager / RuleManager / ProxyPlugin.
 */
var App = {};

App.manifest = chrome.runtime.getManifest();
App.version = App.manifest.version;

/**
 * Re-reads everything from the storage.
 */
App.reloadState = async function reloadState() {
    await Settings.load();
    await App.loadLanguage();
    App.refreshManagers();
};

/**
 * Loads the UI language chosen in the options ("auto" = the browser's language).
 */
App.loadLanguage = async function loadLanguage() {
    await I18n.load(Settings.getValue("language", I18n.AUTO));
    ProfileManager.initNames();
};

App.setLanguage = function setLanguage(language) {
    Settings.setValue("language", I18n.languages.hasOwnProperty(language) ? language : I18n.AUTO);
};

App.Themes = {
    dark:"dark",
    light:"light"
};

App.getTheme = function getTheme() {
    return Settings.getValue("theme", App.Themes.dark) == App.Themes.light ? App.Themes.light : App.Themes.dark;
};

/**
 * Applies the saved colour theme to the current page (dark by default).
 */
App.applyTheme = function applyTheme() {
    if (typeof document != "undefined")
        document.documentElement.setAttribute("data-theme", App.getTheme());
};

App.setTheme = function setTheme(theme) {
    Settings.setValue("theme", theme == App.Themes.light ? App.Themes.light : App.Themes.dark);
    App.applyTheme();
};

/**
 * Rebuilds the managers' state from the in-memory settings.
 */
App.refreshManagers = function refreshManagers() {
    ProfileManager.loadProfiles();
    RuleManager.loadRules();
    ProxyPlugin.loadState();
};

/**
 * Sends a request to the service worker. Resolves to its response.
 */
App.send = async function send(message) {
    await Settings.flush(); // the service worker must see our latest writes
    var response = await chrome.runtime.sendMessage(message);
    if (response && response.error)
        throw new Error(response.error);

    return response || {};
};

App.ready = App.reloadState();
