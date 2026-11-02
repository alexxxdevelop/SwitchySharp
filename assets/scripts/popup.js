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
var autoEnabled = false;

async function init() {
    await App.ready;
    App.applyTheme();
    autoEnabled = RuleManager.isEnabled();
    I18n.process(document);

    buildMenuItems();
    initUI();
    document.body.style.visibility = "visible";
}

function initUI() {
    $("#about .close").click(closePopup);
    $(".versionNumber").text(App.version);
}

function closePopup() {
    window.close();
}

/**
 * Sends the request to the service worker and closes the popup.
 */
function sendAndClose(message) {
    var timeout = new Promise(function (resolve) {
        setTimeout(resolve, 1500);
    });
    Promise.race([App.send(message), timeout]).catch(function (e) {
        Logger.log(e.toString(), Logger.Types.error);
    }).then(closePopup);
}

function openOptions() {
    chrome.runtime.openOptionsPage();
    closePopup();
}

function openUrl(url) {
    chrome.tabs.create({ url:url });
    closePopup();
    return false;
}

function openMainWebsite() {
    return openUrl("http://www.samabox.com/projects/chrome/switchy");
}

function openPlusWebsite() {
    return openUrl("http://code.google.com/p/switchyplus");
}

function openSupportWebsite() {
    return openUrl("http://code.google.com/p/switchysharp/issues/list");
}

function showAbout() {
    $("#menu").hide();
    $("#about").show();
}

function clearMenuProxyItems() {
    $("#proxies .item").remove();
}

function buildMenuProxyItems(currentProfile) {
    var profiles = ProfileManager.getSortedProfileArray();
    var menu = $("#proxies");
    var templateItem = $("#proxies .templateItem");
    var item;
    for (var i in profiles) {
        if (profiles.hasOwnProperty(i)) {
            var profile = profiles[i];
            item = templateItem.clone().attr({
                "id":profile.id || profile.name,
                "name":profile.name,
                "title":ProfileManager.profileToString(profile, true),
                "class":"item proxy " + profile.color
            });
            $("span", item).text(profile.name);
            item.click(onSelectProxyItem);
            item[0].profile = profile;
            if (ProfileManager.equals(profile, currentProfile))
                item.addClass("checked");

            menu.append(item);
        }
    }

    $("#separatorProxies").show();

    if (currentProfile.unknown && currentProfile.proxyMode != ProfileManager.ProxyModes.direct) {
        item = templateItem.clone().attr({
            "id":currentProfile.id,
            "name":currentProfile.name,
            "title":ProfileManager.profileToString(currentProfile, true),
            "class":"item proxy checked"
        });
        $("span", item).text(currentProfile.name);
        item.click(onSelectProxyItem);
        item[0].profile = currentProfile;

        menu.append(item);

    } else if (profiles.length == 0) {
        $("#separatorProxies").hide();
    }
}

function buildMenuDirectConnectionItem(currentProfile) {
    var item = $("#directConnection");
    item.click(onSelectProxyItem);
    item[0].profile = ProfileManager.directConnectionProfile;
    if (currentProfile.proxyMode == ProfileManager.ProxyModes.direct)
        item.addClass("checked");
}

function buildMenuAutomaticModeItem(currentProfile) {
    var item = $("#automaticMode");
    if (!autoEnabled) {
        item.hide();
        $("#separatorRules").hide();
        return;
    }
    item.click(onSelectProxyItem);
    item[0].profile = RuleManager.getAutomaticModeProfile();
    if (RuleManager.isAutomaticModeEnabled(currentProfile)) {
        item.addClass("checked");
        delete currentProfile.unknown; // to prevent adding <current profile> item.
    }
}

function buildMenuItems() {
    var currentProfile = ProfileManager.getCurrentProfile();
    clearMenuProxyItems();
    buildMenuDirectConnectionItem(currentProfile);
    buildMenuAutomaticModeItem(currentProfile);
    buildMenuProxyItems(currentProfile);
}

function onSelectProxyItem(e) {
    var item = $(e.currentTarget);
    var profile = item[0].profile;

    $("#menu .item").removeClass("checked");
    item.addClass("checked");

    if (profile.isAutomaticModeProfile)
        checkRulesFirstTimeUse();

    sendAndClose({ action:"applyProfile", profile:profile, refreshTab:Settings.getValue("refreshTab", false) });
}

function checkRulesFirstTimeUse() {
    if (!Settings.keyExists("rulesFirstTime")) {
        Settings.setValue("rulesFirstTime", ";]");
        if (!RuleManager.hasRules()) {
            chrome.tabs.create({ url:"options.html?rulesFirstTime=true&tab=rules" });
        }
    }
}

$(document).ready(function () {
    init().catch(function (e) {
        Logger.log(e.stack || e.toString(), Logger.Types.error);
        document.body.style.visibility = "visible";
    });
    $("#menuOptions").click(openOptions);
    $("#menuAbout").click(showAbout);
    $("#openMainWebsite").click(openMainWebsite);
    $("#openPlusWebsite").click(openPlusWebsite);
    $("#openSupportWebsite").click(openSupportWebsite);
});
