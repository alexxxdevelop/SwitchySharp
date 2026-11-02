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
var RuleManager = {};

RuleManager.PatternTypes = {
    wildcard:"wildcard",
    regexp:"regexp"
};

RuleManager.rules = {};

RuleManager.allRules = {};

RuleManager.enabled = true;

RuleManager.ruleListEnabled = false;

RuleManager.autoPacScriptPath = undefined;

RuleManager.profilesScripts = {};

RuleManager.defaultRule = {
    id:"defaultRule",
    name:"Default Rule",
    urlPattern:"",
    patternType:RuleManager.PatternTypes.wildcard,
    profileId:ProfileManager.directConnectionProfile.id
};

RuleManager.init = function init() {
    RuleManager.loadRules();
};

RuleManager.initialDefaultRule = Utils.clone(RuleManager.defaultRule);

RuleManager.loadRules = function loadRules() {
    var rules = Settings.getObject("rules") || {};
    for (var i in rules) {
        if (rules.hasOwnProperty(i)) {
            RuleManager.fixRule(rules[i]);
        }
    }

    RuleManager.rules = rules;

    RuleManager.enabled = Settings.getValue("switchRules", true);

    var rule = Settings.getObject("defaultRule");
    RuleManager.defaultRule = (typeof rule != "undefined") ? rule : Utils.clone(RuleManager.initialDefaultRule);

    RuleManager.ruleListEnabled = Settings.getValue("ruleListEnabled", false);
    RuleManager._matchers = null;
};

RuleManager.save = function saveRules() {
    Settings.setObject("rules", RuleManager.rules);
    Settings.setValue("switchRules", RuleManager.enabled);
    Settings.setObject("defaultRule", RuleManager.defaultRule);
    Settings.setValue("ruleListEnabled", RuleManager.ruleListEnabled);
};

RuleManager.isEnabled = function isEnabled() {
    return RuleManager.enabled;
};

RuleManager.setEnabled = function setEnabled(enabled) {
    RuleManager.enabled = !!enabled;
};

RuleManager.isRuleListEnabled = function isRuleListEnabled() {
    return RuleManager.ruleListEnabled;
};

RuleManager.setRuleListEnabled = function setRuleListEnabled(enabled) {
    RuleManager.ruleListEnabled = !!enabled;
};

RuleManager.getDefaultRule = function getDefaultRule() {
    return RuleManager.defaultRule;
};

RuleManager.setDefaultRule = function setDefaultRule(rule) {
    RuleManager.defaultRule = rule;
};

RuleManager.getRules = function getRules() {
    var rules = {};
    for (var i in RuleManager.rules) {
        if (RuleManager.rules.hasOwnProperty(i)) {
            var rule = RuleManager.rules[i];
            rule = RuleManager.normalizeRule(rule);
            rules[i] = rule;
        }
    }

    return rules;
};

RuleManager.setRules = function setRules(rules) {
    RuleManager.rules = Utils.clone(rules);
    RuleManager._matchers = null;
};

RuleManager.getSortedRuleArray = function getSortedRuleArray() {
    var rules = RuleManager.getRules();
    var ruleArray = [];
    for (var i in rules) {
        if (rules.hasOwnProperty(i)) {
            ruleArray[ruleArray.length] = rules[i];
        }
    }

    ruleArray = ruleArray.sort(Utils.compareNamedObjects);
    return ruleArray;
};

/**
 * Returns the profile which Auto Switch Mode uses for the given page URL.
 */
RuleManager.getProfileByUrl = function getProfileByUrl(url) {
    if (!url || !(/^(https?|ftp|wss?):\/\//i).test(url))
        return ProfileManager.directConnectionProfile;

    var i = url.indexOf("#");
    if (i > 0) url = url.substr(0, i);
    var host = parseUri(url)["authority"];
    return ProfileManager.getProfile(RuleManager.urlToProfile(url, host));
};

RuleManager.ruleExistsForUrl = function ruleExistsForUrl(url) {
    var rules = RuleManager.rules;
    for (var i in rules) {
        if (rules.hasOwnProperty(i)) {
            var rule = rules[i];
            if (RuleManager.matchPattern(url, rule.urlPattern, rule.patternType)) {
                return true;
            }
        }
    }
    return false;
};

RuleManager.downloadPacScript = async function downloadPacScript(url) {
    try {
        return await Utils.fetchText(url, 10000);
    } catch (e) {
        Logger.log("Error downloading PAC file! (" + url + ") " + e, Logger.Types.warning);
        return "";
    }
};

RuleManager.downloadProfilesPacScripts = async function downloadProfilesPacScripts() {
    var scripts = {};
    var rules = RuleManager.getRules();
    rules["default"] = RuleManager.getDefaultRule();
    var counter = 1;
    for (var i in rules) {
        if (rules.hasOwnProperty(i)) {
            var rule = rules[i];
            var profile = ProfileManager.getProfile(rule.profileId);
            if (profile == undefined) {
                continue;
            }

            if (profile.proxyMode != ProfileManager.ProxyModes.auto) {
                continue;
            }

            if (scripts[profile.id])
                continue; // already downloaded for another rule

            var script = await RuleManager.downloadPacScript(profile.proxyConfigUrl);
            if (!script || script.length == 0) {
                scripts[profile.id] = {functionName:"", script:""};
                continue;
            }

            var functionName = "Proxy" + counter++;
            script = "var " + functionName + " = (function(){\r\n\t" +
                script.replace(/([\r\n]+)/g, "\r\n\t") + "\r\n\treturn FindProxyForURL;\r\n})();\r\n";
            scripts[profile.id] = {functionName:functionName, script:script};
        }
    }

    return scripts;
};

RuleManager.saveAutoPacScript = async function saveAutoPacScript() {
    RuleManager.profilesScripts = await RuleManager.downloadProfilesPacScripts();

    var script = RuleManager.generateAutoPacScript();
    ProxyPlugin.writeAutoPacFile(script);
};

RuleManager.wildcardToRegexp = function wildcardToRegexp(pattern) {
    pattern = pattern.replace(/([\\\+\|\{\}\[\]\(\)\^\$\.#])/g, "\\$1");
//	pattern = pattern.replace(/\./g, "\\.");
    pattern = pattern.replace(/\*/g, ".*");
    pattern = pattern.replace(/\?/g, ".");
//	var regexp = /*new RegExp*/("^" + pattern + "$");
    return pattern;
};

RuleManager.shExpMatch = function shExpMatch(url, pattern) {
    var pCharCode;
    var isAggressive = false;
    var pIndex;
    var urlIndex = 0;
    var lastIndex;
    var patternLength = pattern.length;
    var urlLength = url.length;
    for (pIndex = 0; pIndex < patternLength; pIndex += 1) {
        pCharCode = pattern.charCodeAt(pIndex); // use charCodeAt for performance, see http://jsperf.com/charat-charcodeat-brackets
        if (pCharCode === 63) { // use if instead of switch for performance, see http://jsperf.com/switch-if
            if (isAggressive) {
                urlIndex += 1;
            }
            isAggressive = false;
            urlIndex += 1;
        }
        else if (pCharCode === 42) {
            if (pIndex === patternLength - 1) {
                return urlIndex <= urlLength;
            }
            else {
                isAggressive = true;
            }
        }
        else {
            if (isAggressive) {
                lastIndex = urlIndex;
                urlIndex = url.indexOf(String.fromCharCode(pCharCode), lastIndex + 1);
                if (urlIndex < 0) {
                    if (url.charCodeAt(lastIndex) !== pCharCode) {
                        return false;
                    }
                    urlIndex = lastIndex;
                }
                isAggressive = false;
            }
            else {
                if (urlIndex >= urlLength || url.charCodeAt(urlIndex) !== pCharCode) {
                    return false;
                }
            }
            urlIndex += 1;
        }
    }
    return urlIndex === urlLength;
};


RuleManager.regExpMatch = function regExpMatch(url, pattern) {
    var regexp = new RegExp(pattern);
    return regexp.test(url);
};

RuleManager.matchPattern = function matchPattern(url, pattern, patternType) {
    if (patternType == RuleManager.PatternTypes.regexp)
        return RuleManager.regExpMatch(url, pattern);

    return RuleManager.shExpMatch(url, pattern);
};

RuleManager.ruleToString = function ruleToString(rule, prettyPrint) {
    if (!prettyPrint)
        return "Rule: " + JSON.stringify(rule);

    var result = [];
    if (rule.name != undefined)
        result.push(rule.name);

    if (rule.urlPattern != undefined && rule.urlPattern.trim().length > 0) {
        result.push("URL Pattern: " + rule.patternType + "(" + rule.urlPattern + ")");
    }
    if (rule.profileId != undefined && rule.profileId.trim().length > 0)
        result.push("Proxy Profile: " + ProfileManager.getProfiles()[rule.profileId]);

    return result.join("\r\n");
};

/**
 * Normalizes the rule's URL pattern the way the PAC script uses it.
 * Returns undefined for invalid patterns.
 */
RuleManager.preparePattern = function preparePattern(rule) {
    var urlPattern = rule.urlPattern || "";
    var isRegexp = (rule.patternType == RuleManager.PatternTypes.regexp);

    // Check Non-ASCII chars
    for (var i = 0; i < urlPattern.length; i++) {
        var code = urlPattern.charCodeAt(i);
        if (code >= 128) {
            Logger.log('Invalid non-ASCII char "' + urlPattern[i] + '" (U+' + code.toString(16).toUpperCase() + ')' + " in " + urlPattern, Logger.Types.warning);
            return undefined;
        }
    }

    if (!isRegexp) {
        if (urlPattern[0] == "@")
            urlPattern = urlPattern.substring(1);
        else {
            if (urlPattern.indexOf("://") <= 0 && urlPattern[0] != "*")
                urlPattern = "*" + urlPattern;

            if (urlPattern[urlPattern.length - 1] != "*")
                urlPattern += "*";
        }
    }
    // just declare to see whether regular expression rule is valid
    try {
        new RegExp(isRegexp ? urlPattern : RuleManager.wildcardToRegexp(urlPattern));
    }
    catch (e) {
        Logger.log("Invalid " + (isRegexp ? "regular expression" : "wildcard") + " : " + urlPattern, Logger.Types.warning);
        return undefined;
    }

    var urlPattern2 = null;
    if (!isRegexp) {
        if (urlPattern.indexOf("://*.") > 0) urlPattern2 = urlPattern.replace("://*.", "://");
        else if (urlPattern.indexOf("*.") == 0) urlPattern2 = "*://" + urlPattern.substring(2);
    }

    return { isRegexp:isRegexp, pattern:urlPattern, pattern2:urlPattern2 };
};

RuleManager.ruleToExpr = function ruleToExpr(rule) {
    var p = RuleManager.preparePattern(rule);
    if (!p)
        return '(false)';

    var matchFunc = (p.isRegexp ? "regExpMatch" : "shExpMatch");
    var script = "(";
    script += matchFunc + "(url, " + JSON.stringify(p.pattern) + ")";
    if (p.pattern2)
        script += " || shExpMatch(url, " + JSON.stringify(p.pattern2) + ")";

    return script + ")";
};

/**
 * Builds a matching function for the rule (same logic as |ruleToExpr|, without eval).
 */
RuleManager.ruleToMatcher = function ruleToMatcher(rule) {
    var p = RuleManager.preparePattern(rule);
    if (!p)
        return function () {
            return false;
        };

    if (p.isRegexp) {
        var regexp = new RegExp(p.pattern);
        return function (url) {
            return regexp.test(url);
        };
    }
    return function (url) {
        return RuleManager.shExpMatch(url, p.pattern) || (p.pattern2 != null && RuleManager.shExpMatch(url, p.pattern2));
    };
};

RuleManager._getPacRuleProxy = function getPacRuleProxy(profileId) {
    var proxy = "DIRECT";
    if (profileId != ProfileManager.directConnectionProfile.id) {
        var profile = ProfileManager.getProfile(profileId);
        if (profile != undefined && profile.proxyMode == ProfileManager.ProxyModes.manual) {
            if (profile.proxyHttp && profile.proxyHttp.length > 0)
                proxy = "PROXY " + profile.proxyHttp;

            if (profile.proxySocks && profile.proxySocks.length > 0
                && !profile.useSameProxy && profile.proxySocks != profile.proxyHttp) { // workaround for Gnome
                if (profile.socksVersion == 5)
                    proxy = "SOCKS5 " + profile.proxySocks + (proxy != "DIRECT" ? "; " + proxy : "");
                else
                    proxy = "SOCKS " + profile.proxySocks + (proxy != "DIRECT" ? "; " + proxy : "");
            }
        }
    }
    return proxy;
};

RuleManager.getPacRuleProxy = function getPacRuleProxy(profileId) {
    var proxy = "'DIRECT'";
    if (profileId != ProfileManager.directConnectionProfile.id) {
        var profile = ProfileManager.getProfile(profileId);
        if (profile != undefined && profile.proxyMode != ProfileManager.ProxyModes.direct) {
            if (profile.proxyMode == ProfileManager.ProxyModes.manual) {
                if (profile.proxyHttp && profile.proxyHttp.length > 0)
                    proxy = "PROXY " + profile.proxyHttp;

                if (profile.proxySocks && profile.proxySocks.length > 0
                    && !profile.useSameProxy && profile.proxySocks != profile.proxyHttp) { // workaround for Gnome
                    if (profile.socksVersion == 5)
                        proxy = "SOCKS5 " + profile.proxySocks + (proxy != "'DIRECT'" ? "; DIRECT" : "");
                    else
                        proxy = "SOCKS " + profile.proxySocks + (proxy != "'DIRECT'" ? "; DIRECT" : "");
                }
                if (proxy != "'DIRECT'") proxy = "'" + proxy + "'";

            } else if (profile.proxyMode == ProfileManager.ProxyModes.auto) {
                var script = RuleManager.profilesScripts[profile.id];
                if (script) {
                    proxy = script.functionName + "(url, host)";
                }
            }
        }
    }
    return proxy;
};

RuleManager.getPacDefaultProxy = function getPacDefaultProxy(defaultProfile) {
    // TODO: merge RuleManager.getPacDefaultProxy and RuleManager.getPacRuleProxy in one function
    var proxy = "'DIRECT'";
    if (defaultProfile != undefined && defaultProfile.proxyMode != ProfileManager.ProxyModes.direct) {
        if (defaultProfile.proxyMode == ProfileManager.ProxyModes.manual) {
            if (defaultProfile.proxyHttp && defaultProfile.proxyHttp.length > 0)
                proxy = "PROXY " + defaultProfile.proxyHttp;

            if (defaultProfile.proxySocks && defaultProfile.proxySocks.length > 0
                && !defaultProfile.useSameProxy && defaultProfile.proxySocks != defaultProfile.proxyHttp) { // workaround for Gnome
                if (defaultProfile.socksVersion == 5)
                    proxy = "SOCKS5 " + defaultProfile.proxySocks + (proxy != "'DIRECT'" ? "; DIRECT" : "");
                else
                    proxy = "SOCKS " + defaultProfile.proxySocks + (proxy != "'DIRECT'" ? "; DIRECT" : "");
            }
            if (proxy != "'DIRECT'") proxy = "'" + proxy + "'";

        } else if (defaultProfile.proxyMode == ProfileManager.ProxyModes.auto) {
            var script = RuleManager.profilesScripts[defaultProfile.id];
            if (script && script.functionName && script.functionName != "") {
                proxy = script.functionName + "(url, host)";
            }
        }
    }
    return proxy;
};

RuleManager.generatePacScript = function generatePacScript(rules, defaultProfile) {
    var script = "";
    var i;

    for (i in RuleManager.profilesScripts) {
        if (RuleManager.profilesScripts.hasOwnProperty(i)) {
            var profileScript = RuleManager.profilesScripts[i];
            script += profileScript.script;
        }
    }

    script += "function regExpMatch(url, pattern) {\
    try { return new RegExp(pattern).test(url); } catch(ex) { return false; }\
    }\n\
    function FindProxyForURL(url, host) {\n";

    var proxy;
    for (i in rules) {
        if (rules.hasOwnProperty(i)) {
            var rule = rules[i];
            var expr = RuleManager.ruleToExpr(rule);
            if (rule.proxy) { // predefined proxy (see |generateAutoPacScript|)
                proxy = rule.proxy;
            }
            else {
                proxy = RuleManager.getPacRuleProxy(rule.profileId);
            }
            script += "\tif " + expr + " return " + proxy + ";\n";
        }
    }
    if (defaultProfile.proxyExceptions) {
        var proxyExceptionsList = defaultProfile.proxyExceptions.split(';');
        for (i in proxyExceptionsList) {
            if (proxyExceptionsList.hasOwnProperty(i)) {
                script += "\tif(shExpMatch(host, '" + proxyExceptionsList[i].trim() + "')) return 'DIRECT';\n";
            }
        }
    }

    proxy = RuleManager.getPacDefaultProxy(defaultProfile);
    script += "\treturn " + proxy + ";\n}";

    return script;
};

RuleManager._matchers = null;

/**
 * Compiles the current rules (including the online rule list) into matching functions.
 */
RuleManager.buildMatchers = function buildMatchers() {
    var ruleSet = RuleManager.buildRuleSet();
    var matchers = [];
    for (var i in ruleSet.rules) {
        if (ruleSet.rules.hasOwnProperty(i)) {
            var rule = ruleSet.rules[i];
            matchers.push({ match:RuleManager.ruleToMatcher(rule), profileId:rule.profileId });
        }
    }
    return {
        matchers:matchers,
        defaultProfileId:(ruleSet.defaultProfile && ruleSet.defaultProfile.id) || ProfileManager.directConnectionProfile.id
    };
};

/**
 * Returns the id of the profile that Auto Switch Mode applies to the URL
 * (mirrors FindProxyForURL of the generated PAC script).
 */
RuleManager.urlToProfile = function urlToProfile(url, host) {
    if (!RuleManager._matchers)
        RuleManager._matchers = RuleManager.buildMatchers();

    var matchers = RuleManager._matchers.matchers;
    for (var i = 0; i < matchers.length; i++) {
        try {
            if (matchers[i].match(url, host))
                return matchers[i].profileId;
        } catch (e) {
        }
    }
    return RuleManager._matchers.defaultProfileId;
};

RuleManager.generateRuleList = function generateRuleList() {
    var rules = RuleManager.getRules();
    var allRules = undefined;
    if (RuleManager.isEnabled() && RuleManager.isRuleListEnabled())
        allRules = Settings.getObject("ruleListRules");

    if (!allRules) {
        allRules = {
            wildcard:[],
            regexp:[]
        };
    }
    for (var i in rules) {
        if (rules.hasOwnProperty(i)) {
            var rule = rules[i];
            if (rule.patternType == RuleManager.PatternTypes.regexp) {
                allRules.regexp.push(rule.urlPattern);
            }
            else {
                allRules.wildcard.push(rule.urlPattern);
            }
        }
    }
    var wildcardRules = "[wildcard]\r\n" + allRules.wildcard.join("\r\n");
    var regexpRules = "[regexp]\r\n" + allRules.regexp.join("\r\n");
    var header = "; Summary: SwitchySharp Exported Rule List\r\n"
        + "; Date: " + new Date().toLocaleDateString();

    return header + "\r\n\r\n#BEGIN\r\n\r\n" + wildcardRules + "\r\n\r\n" + regexpRules + "\r\n\r\n#END";
};

RuleManager.ruleListToScript = function ruleListToScript() {
//	if (!RuleManager.isRuleListEnabled())
//		return "";
//
//	var defaultProfile = RuleManager.getAutomaticModeProfile(false);	
//	var defaultProxy = RuleManager.getPacDefaultProxy(defaultProfile);
//	var ruleListRules = Settings.getObject("ruleListRules");
//	var ruleListProfileId = Settings.getValue("ruleListProfileId");
//	var ruleListProxy = RuleManager.getPacRuleProxy(ruleListProfileId);
//	if (ruleListRules == undefined)
//		return "";
//	
//	// start with reverse rules (starting with '!') (top priority)
//	for (var i = 0; i < ruleListRules.wildcard.length; i++) {
//		var urlPattern = ruleListRules.wildcard[i];
//		if (urlPattern[0] == '!') {
//			urlPattern = urlPattern.substr(1);
//			rules["__ruleW" + i] = {
//				urlPattern: urlPattern,
//				patternType: RuleManager.PatternTypes.wildcard,
//				profileId : ruleListProfileId,
//				proxy: defaultProxy
//			};
//		}
//	}
//	for (var i = 0; i < ruleListRules.regexp.length; i++) {
//		var urlPattern = ruleListRules.regexp[i];
//		if (urlPattern[0] == '!') {
//			urlPattern = urlPattern.substr(1);
//			rules["__ruleR" + i] = {
//				urlPattern: urlPattern,
//				patternType: RuleManager.PatternTypes.regexp,
//				profileId : ruleListProfileId,
//				proxy: defaultProxy
//			};
//		}
//	}
//	
//	// normal rules
//	for (var i = 0; i < ruleListRules.wildcard.length; i++) {
//		var urlPattern = ruleListRules.wildcard[i];
//		if (urlPattern[0] != '!') {
//			urlPattern = urlPattern.substr(1);
//			rules["__ruleW" + i] = {
//				urlPattern: urlPattern,
//				patternType: RuleManager.PatternTypes.wildcard,
//				profileId : ruleListProfileId,
//				proxy: ruleListProxy
//			};
//		}
//	}
//	for (var i = 0; i < ruleListRules.regexp.length; i++) {
//		var urlPattern = ruleListRules.regexp[i];
//		if (urlPattern[0] != '!') {
//			urlPattern = urlPattern.substr(1);
//			rules["__ruleR" + i] = {
//				urlPattern: urlPattern,
//				patternType: RuleManager.PatternTypes.regexp,
//				profileId : ruleListProfileId,
//				proxy: ruleListProxy
//			};
//		}
//	}
};

RuleManager.generateAutoPacScript = function generateAutoPacScript() {
    var ruleSet = RuleManager.buildRuleSet();
    RuleManager.allRules = ruleSet.rules;

    return RuleManager.generatePacScript(ruleSet.rules, ruleSet.defaultProfile);
};

/**
 * Collects the switch rules and the online rule list in the order they are checked.
 */
RuleManager.buildRuleSet = function buildRuleSet() {
    var rules = RuleManager.getRules();
    var defaultProfile = ProfileManager.getProfile(RuleManager.getDefaultRule().profileId);
    var defaultProxy = RuleManager.getPacDefaultProxy(defaultProfile);
    var i, urlPattern;
    if (RuleManager.isEnabled() && RuleManager.isRuleListEnabled()) {
        var ruleListRules = Settings.getObject("ruleListRules");
        var ruleListProfileId = Settings.getValue("ruleListProfileId", -1);
        var ruleListProxy = RuleManager.getPacRuleProxy(ruleListProfileId);
        if (ruleListRules != undefined) {
            // start with reverse rules (starting with '!') (top priority)
            for (i = 0; i < ruleListRules.wildcard.length; i++) {
                urlPattern = ruleListRules.wildcard[i];
                if (urlPattern[0] == '!') {
                    urlPattern = urlPattern.substr(1);
                    rules["__ruleW" + i] = {
                        urlPattern:urlPattern,
                        patternType:RuleManager.PatternTypes.wildcard,
                        profileId:defaultProfile.id,
                        proxy:defaultProxy
                    };
                }
            }
            for (i = 0; i < ruleListRules.regexp.length; i++) {
                urlPattern = ruleListRules.regexp[i];
                if (urlPattern[0] == '!') {
                    urlPattern = urlPattern.substr(1);
                    rules["__ruleR" + i] = {
                        urlPattern:urlPattern,
                        patternType:RuleManager.PatternTypes.regexp,
                        profileId:defaultProfile.id,
                        proxy:defaultProxy
                    };
                }
            }
            // normal rules
            for (i = 0; i < ruleListRules.wildcard.length; i++) {
                urlPattern = ruleListRules.wildcard[i];
                if (urlPattern[0] != '!') {
                    rules["__ruleW" + i] = {
                        urlPattern:urlPattern,
                        patternType:RuleManager.PatternTypes.wildcard,
                        profileId:ruleListProfileId,
                        proxy:ruleListProxy
                    };
                }
            }
            for (i = 0; i < ruleListRules.regexp.length; i++) {
                urlPattern = ruleListRules.regexp[i];
                if (urlPattern[0] != '!') {
                    rules["__ruleR" + i] = {
                        urlPattern:urlPattern,
                        patternType:RuleManager.PatternTypes.regexp,
                        profileId:ruleListProfileId,
                        proxy:ruleListProxy
                    };
                }
            }
        }
    }

    return { rules:rules, defaultProfile:defaultProfile };
};

RuleManager.getAutoPacScriptPath = function getAutoPacScriptPath(withSalt) {
    if (RuleManager.autoPacScriptPath == undefined) {
        try {
            RuleManager.autoPacScriptPath = ProxyPlugin.autoPacScriptPath;
        } catch (ex) {
            Logger.log("Plugin Error @RuleManager.getAutoPacScriptPath() > " + ex.toString(), Logger.Types.error);
            return undefined;
        }
    }

    return RuleManager.autoPacScriptPath + (withSalt ? "?" + new Date().getTime() : "");
};

RuleManager.getAutomaticModeProfile = function getAutomaticModeProfile() {
    return ProfileManager.autoSwitchProfile;
};

RuleManager.isAutomaticModeEnabled = function isAutomaticModeEnabled(currentProfile) {
    if (currentProfile == undefined)
        currentProfile = ProfileManager.getCurrentProfile();

    return (currentProfile.proxyMode == ProfileManager.ProxyModes.auto) && (currentProfile.id == ProfileManager.autoSwitchProfile.id);
};

/**
 * Downloads the online rule list.
 * Resolves to null if the rule list is disabled, otherwise to true/false (success).
 */
RuleManager.loadRuleList = async function loadRuleList() {
    if (!RuleManager.isEnabled() || !RuleManager.isRuleListEnabled())
        return null;

    var ruleListUrl = Settings.getValue("ruleListUrl", "");
    var data;
    try {
        data = await Utils.fetchText(ruleListUrl, 10000);
    } catch (e) {
        Logger.log("Error downloading rule list file! " + e, Logger.Types.warning);
        return false;
    }

    if (data.length > 1024 * 1024 * 4) { // bigger than 4 megabytes
        Logger.log("Too big rule list file!", Logger.Types.error);
        return false;
    }

    await RuleManager.parseRuleList(data);
    Settings.setValue("lastListUpdate", new Date().toString());
    await Settings.flush();
    return true;
};

RuleManager.parseRuleList = function parseRuleList(data) {
    if (Settings.getValue("ruleListAutoProxy", false))
        return RuleManager.parseAutoProxyRuleList(data);

    return RuleManager.parseSwitchyRuleList(data);
};

RuleManager.parseSwitchyRuleList = function parseSwitchyRuleList(data) {
    if (data == null)
        return;

    data = (/#BEGIN((?:.|[\n\r])+)#END/i).exec(data);
    if (!data || data.length < 2)
        return;

    data = data[1].trim();
    var lines = data.split(/[\r\n]+/);
    var rules = {
        wildcard:[],
        regexp:[]
    };
    var patternType = RuleManager.PatternTypes.wildcard;
    for (var index = 0; index < lines.length; index++) {
        var line = lines[index].trim();

        if (line.length == 0 || line[0] == ';' || line[0] == '!') // comment line
            continue;

        if (line.toLowerCase() == "[wildcard]") {
            patternType = RuleManager.PatternTypes.wildcard;
            continue;
        }

        if (line.toLowerCase() == "[regexp]") {
            patternType = RuleManager.PatternTypes.regexp;
            continue;
        }

        if (line[0] == '[') // unknown section
            continue;

        rules[patternType].push(line);
    }

    Settings.setObject("ruleListRules", rules);
    RuleManager._matchers = null;

    if (RuleManager.isAutomaticModeEnabled(undefined)) {
        var profile = RuleManager.getAutomaticModeProfile();
        return ProfileManager.applyProfile(profile);
    }
};

RuleManager.parseAutoProxyRuleList = function parseAutoProxyRuleList(data) {
    if (data == null || data.length < 2) {
        Logger.log("Too small AutoProxy rules file!", Logger.Types.warning);
        return;
    }

    if (data.substr(0, 10) != "[AutoProxy") {
        try {
            data = Utils.base64Decode(data); //Base64 encoded AutoProxy list
        } catch (e) {
            data = "";
        }
        if (data.substr(0, 10) != "[AutoProxy") {
            Logger.log("Invalid AutoProxy rules file!", Logger.Types.warning);
            return;
        }
    }

    var lines = data.split(/[\r\n]+/);
    var rules = {
        wildcard:[],
        regexp:[]
    };
    var patternType;
    var separatorRegexp = "(?:[^\\w\\-.%\\u0080-\\uFFFF]|$)"; // AutoProxy "^": any char except letters, digits, "_-.%"
    for (var index = 0; index < lines.length; index++) {
        var line = lines[index].trim();

        if (line.length == 0 || line[0] == ';' || line[0] == '!' || line[0] == '[') // comment line
            continue;

        var exclude = false;
        if (line.substr(0, 2) == "@@") {
            exclude = true;
            line = line.substring(2);
        }
        if (line[0] == '+') {
            line = line.substring(1);
        }
        if (line[0] == '/' && line[line.length - 1] == '/') { // regexp pattern
            patternType = RuleManager.PatternTypes.regexp;
            line = line.substring(1, line.length - 1);
        }
        else if (line.substr(0, 2) == "||") { // domain and its subdomains, "^" marks the end of the domain
            patternType = RuleManager.PatternTypes.regexp;
            line = '^[\\w\\-]+:\\/+(?!\\/)(?:[^\\/]+\\.)?' + RuleManager.wildcardToRegexp(line.substring(2));
            line = line.replace(/\\\^/g, separatorRegexp);
        }
        else if (line.indexOf('^') > -1) {
            patternType = RuleManager.PatternTypes.regexp;
            line = RuleManager.wildcardToRegexp(line);
            line = line.replace(/\\\^/g, separatorRegexp);
        }
        else if (line[0] == "|") {
            patternType = RuleManager.PatternTypes.wildcard;
            if (line[line.length - 1] == "|")
                line = "@" + line.substring(1, line.length - 2);
            else
                line = "@" + line.substring(1) + "*";
        }
        else {
            patternType = RuleManager.PatternTypes.wildcard;
            line = "http://*" + line;
        }

        if (exclude)
            line = "!" + line;

        rules[patternType].push(line);
    }

    Settings.setObject("ruleListRules", rules);
    RuleManager._matchers = null;

    if (RuleManager.isAutomaticModeEnabled(undefined)) {
        var profile = RuleManager.getAutomaticModeProfile();
        return ProfileManager.applyProfile(profile);
    }
};

RuleManager.normalizeRule = function normalizeRule(rule) {
    var newRule = {
        name:"",
        urlPattern:"",
        patternType:RuleManager.PatternTypes.wildcard,
        profileId:ProfileManager.directConnectionProfile.id
    };
    Object.assign(newRule, rule);
    return newRule;
};

RuleManager.fixRule = function fixRule(rule) {
    if (rule.patternType == "regex") // backward compatibility
        rule.patternType = RuleManager.PatternTypes.regexp;

    return rule;
};

RuleManager.hasRules = function hasRules() {
    for (var i in RuleManager.rules) {
        if (RuleManager.rules.hasOwnProperty(i)) {
            return true;
        }
    }

    return false;
};

RuleManager.equals = function equals(rule1, rule2) {
    return (rule1.urlPattern == rule2.urlPattern
        && rule1.patternType == rule2.patternType
        && rule1.profileId == rule2.profileId);
};

RuleManager.contains = function contains(rule) {
    var rules = RuleManager.getRules();
    for (var i in rules) {
        if (rules.hasOwnProperty(i)) {
            if (RuleManager.equals(rules[i], rule)) {
                return rules[i];
            }
        }
    }
    return undefined;
};

