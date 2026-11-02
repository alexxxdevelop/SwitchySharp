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
 * Service worker logic. All event listeners are registered synchronously at the
 * top level (Manifest V3 requirement), the handlers wait for |App.ready|.
 */
var iconDir = "/assets/images/";
var iconInactivePath = iconDir + "inactive.png";
var RULE_LIST_ALARM = "ruleListReload";

function noop() {
}

function logError(e) {
    Logger.log(e && e.stack ? e.stack : String(e), Logger.Types.error);
}

/**
 * Runs once per browser session (startup, install, update, re-enable).
 */
async function initialize() {
    // sync the saved state with the current browser proxy settings
    ProxyPlugin.updateProxyCallback = noop;
    await ProxyPlugin.refresh();
    ProxyPlugin.updateProxyCallback = undefined;

    checkFirstTime();
    await applySavedOptions();
    scheduleRuleList(true);
}

function checkFirstTime() {
    if (!Settings.keyExists("firstTime")) {
        Settings.setValue("firstTime", ":]");
        if (!ProfileManager.hasProfiles()) {
            openOptions(true);
            return true;
        }
    }
    return false;
}

async function openOptions(firstTime) {
    var baseUrl = chrome.runtime.getURL("options.html");
    var tabs = await chrome.tabs.query({ url:baseUrl + "*" });
    if (tabs.length > 0) { // check if Options page is open already
        await chrome.tabs.update(tabs[0].id, { active:true });
        await chrome.windows.update(tabs[0].windowId, { focused:true });
        return;
    }
    await chrome.tabs.create({ url:baseUrl + (firstTime ? "?firstTime=true" : "") });
}

async function applySavedOptions() {
    var pid = Settings.getValue("startupProfileId", "");
    var profile;

    if (pid != "")
        profile = ProfileManager.getProfile(pid);
    if (!profile || !profile.id) // no startup profile or it was deleted
        profile = ProfileManager.getSelectedProfile();

    if (profile != undefined)
        await ProfileManager.applyProfile(profile);
    setIconInfo(profile);
    applyQuickSwitch();
}

function applyQuickSwitch() {
    chrome.action.setPopup({ popup:Settings.getValue("quickSwitch", false) ? "" : "popup.html" });
}

async function refreshTab() {
    var tabs = await chrome.tabs.query({ active:true, lastFocusedWindow:true });
    if (tabs.length > 0)
        await chrome.tabs.reload(tabs[0].id);
}

function setIconBadge(text) {
    if (text == undefined)
        text = "";

    chrome.action.setBadgeBackgroundColor({ color:[90, 180, 50, 255] });
    chrome.action.setBadgeText({ text:text });
}

function setIconTitle(title) {
    if (title == undefined)
        title = "";

    chrome.action.setTitle({ title:title });
}

function setIcon(path) {
    chrome.action.setIcon({ path:path }).catch(logError);
}

function setIconInfo(profile) {
    if (!profile)
        profile = ProfileManager.getCurrentProfile();

    if (RuleManager.isAutomaticModeEnabled(profile)) {
        setAutoSwitchIcon();
        return;
    }

    var title = "";
    if (profile.proxyMode == ProfileManager.ProxyModes.direct || profile.proxyMode == ProfileManager.ProxyModes.system) {
        setIcon(iconInactivePath);
        title += profile.name;
    } else {
        setIcon(iconDir + "icon-" + (profile.color || "blue") + ".png");
        title += ProfileManager.profileToString(profile, true);
    }

    setIconTitle(title);
}

async function setAutoSwitchIcon(url) {
    if (!RuleManager.isAutomaticModeEnabled(undefined))
        return false;

    if (url == undefined) {
        var tabs = await chrome.tabs.query({ active:true, lastFocusedWindow:true });
        url = tabs.length > 0 ? tabs[0].url : "";
    }

    var profile = RuleManager.getProfileByUrl(url);
    setIcon(iconDir + "icon-auto-" + (profile.color || "blue") + ".png");
    setIconTitle(I18n.getMessage("proxy_autoSwitchIconTitle", profile.name));
    return true;
}

function scheduleRuleList(loadNow) {
    if (RuleManager.isEnabled() && RuleManager.isRuleListEnabled()) {
        var interval = Math.max(1, parseInt(Settings.getValue("ruleListReload", 720), 10) || 720);
        chrome.alarms.create(RULE_LIST_ALARM, { delayInMinutes:interval, periodInMinutes:interval });
        if (loadNow)
            RuleManager.loadRuleList().catch(logError);
    } else {
        chrome.alarms.clear(RULE_LIST_ALARM);
    }
}

function getQuickSwitchProfile() {
    var currentProfile = ProfileManager.getCurrentProfile();
    var quickSwitchProfiles = Settings.getObject("quickSwitchProfiles") || [];
    if (quickSwitchProfiles.length == 0)
        return undefined;

    var index = quickSwitchProfiles.indexOf(currentProfile.id);
    var profileId = quickSwitchProfiles[(index + 1) % quickSwitchProfiles.length];
    var profile = ProfileManager.getProfile(profileId);
    return (profile && profile.id) ? profile : undefined;
}

async function handleMessage(message) {
    await App.reloadState(); // the sender has changed the storage

    switch (message.action) {
        case "applyProfile":
            await ProfileManager.applyProfile(message.profile);
            setIconInfo(message.profile);
            if (message.refreshTab)
                await refreshTab();
            return {};

        case "optionsSaved":
            if (message.applyProfile)
                await ProfileManager.applyProfile(message.applyProfile);
            if (message.applyAutoProfile)
                await ProfileManager.applyProfile(RuleManager.getAutomaticModeProfile());
            if (message.loadRuleList)
                await RuleManager.loadRuleList();
            scheduleRuleList(false);
            setIconInfo();
            applyQuickSwitch();
            await Settings.flush();
            return {};

        case "loadRuleList":
            var result = await RuleManager.loadRuleList();
            scheduleRuleList(false);
            setIconInfo();
            return { result:result, lastListUpdate:Settings.getValue("lastListUpdate", "") };

        case "refreshIcon":
            setIconInfo();
            applyQuickSwitch();
            return {};

        case "openOptions":
            await openOptions(message.firstTime);
            return {};
    }
    return {};
}

// ---- Event listeners (must be registered synchronously) ----

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (!message || !message.action)
        return false;

    App.ready.then(function () {
        return handleMessage(message);
    }).then(function (response) {
        sendResponse(response);
    }, function (e) {
        logError(e);
        sendResponse({ error:String(e) });
    });
    return true;
});

chrome.proxy.settings.onChange.addListener(function (details) {
    App.ready.then(function () {
        ProxyPlugin.updateProxy(details);
    }).catch(logError);
});

chrome.action.onClicked.addListener(function () { // fired only when the popup is disabled (Quick Switch)
    App.ready.then(async function () {
        if (!Settings.getValue("quickSwitch", false)) return;

        var profile = getQuickSwitchProfile();
        if (profile == undefined) return;

        await ProfileManager.applyProfile(profile);
        setIconInfo(profile);

        if (Settings.getValue("refreshTab", false))
            await refreshTab();
    }).catch(logError);
});

chrome.tabs.onActivated.addListener(function (activeInfo) {
    App.ready.then(function () {
        return chrome.tabs.get(activeInfo.tabId);
    }).then(function (tab) {
        return setAutoSwitchIcon(tab.url || "");
    }).catch(noop);
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    if (changeInfo.status == "complete" && tab.active) {
        App.ready.then(function () {
            return setAutoSwitchIcon(tab.url || "");
        }).catch(noop);
    }
});

chrome.alarms.onAlarm.addListener(function (alarm) {
    if (alarm.name == RULE_LIST_ALARM) {
        App.ready.then(function () {
            return RuleManager.loadRuleList();
        }).catch(logError);
    }
});

Settings.onChanged(function (keys) {
    App.refreshManagers();
    if (keys.indexOf(Settings.CONFIG_PREFIX + "language") >= 0) // the UI language was changed in the options
        App.loadLanguage().then(function () {
            setIconInfo();
        }).catch(logError);
});

// Initialize once per browser session; chrome.storage.session is cleared on
// browser restart and when the extension is installed, updated or re-enabled.
App.ready.then(async function () {
    var session = await chrome.storage.session.get("initialized");
    if (!session.initialized) {
        await chrome.storage.session.set({ initialized:true });
        await initialize();
    }
}).catch(logError);
