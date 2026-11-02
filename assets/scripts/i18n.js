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
var I18n = {};

I18n.AUTO = "auto";
I18n.DEFAULT_LOCALE = "en";

// Available UI languages (names are shown in their own language).
I18n.languages = {
    en:"English",
    ru:"Русский",
    zh_CN:"简体中文"
};

I18n.language = I18n.AUTO;
I18n.messages = null; // null: use chrome.i18n (the browser's UI language)
I18n.fallbackMessages = null;
I18n._cache = {};

I18n._readLocale = async function readLocale(locale) {
    if (!I18n._cache[locale]) {
        var response = await fetch(chrome.runtime.getURL("_locales/" + locale + "/messages.json"));
        var messages = await response.json();
        // message names are case-insensitive, like in chrome.i18n
        var map = {};
        for (var name in messages) {
            if (messages.hasOwnProperty(name))
                map[name.toLowerCase()] = messages[name];
        }
        I18n._cache[locale] = map;
    }
    return I18n._cache[locale];
};

/**
 * Selects the UI language: "auto" (the browser's language) or one of |I18n.languages|.
 * The extension name and description in the browser always follow the browser's language.
 */
I18n.load = async function load(language) {
    if (!language || language == I18n.AUTO || !I18n.languages.hasOwnProperty(language)) {
        I18n.language = I18n.AUTO;
        I18n.messages = null;
        I18n.fallbackMessages = null;
        return;
    }
    try {
        I18n.messages = await I18n._readLocale(language);
        I18n.fallbackMessages = (language == I18n.DEFAULT_LOCALE) ? null : await I18n._readLocale(I18n.DEFAULT_LOCALE);
        I18n.language = language;
    } catch (e) {
        console.error("I18n: can't load locale " + language, e);
        I18n.language = I18n.AUTO;
        I18n.messages = null;
        I18n.fallbackMessages = null;
    }
};

I18n.getMessage = function getMessage(messageName, substitution) {
    if (!I18n.messages) // Chrome falls back to "default_locale" by itself
        return chrome.i18n.getMessage(messageName, substitution) || "";

    var key = String(messageName).toLowerCase();
    var entry = I18n.messages[key] || (I18n.fallbackMessages && I18n.fallbackMessages[key]);
    if (!entry || typeof entry.message != "string")
        return "";

    var substitutions = (substitution === undefined || substitution === null) ? [] : [].concat(substitution);
    return entry.message.replace(/\$(\d)/g, function (match, index) {
        var value = substitutions[index - 1];
        return value === undefined ? "" : String(value);
    });
};

I18n.process = function process(node) {
    return I18nTemplate.process(node);
};

//-------------------------------------------------------

/**
 * i18nTemplate: http://src.chromium.org/viewvc/chrome/trunk/src/chrome/browser/resources/i18n_template.js
 */
var I18nTemplate = (function () {
    var handlers = {
        /**
         * This handler sets the textContent of the element.
         */
        'data-i18n-content':function (element, attributeValue) {
            element.innerHTML/*textContent*/ = I18n.getMessage(attributeValue);
        },

        /**
         * This is used to set HTML attributes and DOM properties,. The syntax
         * is: attributename:key; .domProperty:key; .nested.dom.property:key
         */
        'data-i18n-values':function (element, attributeValue) {
            var parts = attributeValue.replace(/\s/g, '').split(/;/);
            for (var j = 0; j < parts.length; j++) {
                var a = parts[j].match(/^([^:]+):(.+)$/);
                if (a) {
                    var propName = a[1];
                    var propExpr = a[2];

                    var value = I18n.getMessage(propExpr);
                    if (propName.charAt(0) == '.') {
                        var path = propName.slice(1).split('.');
                        var object = element;
                        while (object && path.length > 1) {
                            object = object[path.shift()];
                        }
                        if (object) {
                            object[path] = value;
                            // In case we set innerHTML (ignoring others) we need to
                            // recursively check the content
                            if (path.toString() === 'innerHTML') {
                                process(element);
                            }
                        }
                    } else {
                        element.setAttribute(propName, value);
                    }
                }
            }
        }
    };

    var attributeNames = [];
    for (var key in handlers) {
        if (handlers.hasOwnProperty(key)) {
            attributeNames.push(key);
        }
    }
    var selector = '[' + attributeNames.join('],[') + ']';

    function process(node) {
        var elements = node.querySelectorAll(selector);
        for (var element, i = 0; element = elements[i]; i++) {
            for (var j = 0; j < attributeNames.length; j++) {
                var name = attributeNames[j];
                var att = element.getAttribute(name);
                if (att != null) {
                    handlers[name](element, att);
                }
            }
        }
    }

    return {
        process:process
    };
})();
