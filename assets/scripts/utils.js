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
var Utils = {};

Utils.OS = {
    isMac:(/mac/i).test(navigator.userAgent), // maybe should test |navigator.platform| instead?
    isWindows:(/win/i).test(navigator.userAgent),
    isLinux:(/linux/i).test(navigator.userAgent)
};

Utils.compareStrings = function compareStrings(s1, s2) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
    var length = Math.min(s1.length, s2.length);
    for (var i = 0; i < length; i++) {
        var ch1 = s1.charCodeAt(i);
        var ch2 = s2.charCodeAt(i);
        if (ch1 != ch2)
            return ch1 - ch2;
    }

    return s1.length - s2.length;
};

Utils.compareNamedObjects = function compareNamedObjects(o1, o2) {
    return Utils.compareStrings(o1.name, o2.name);
};

Utils.clone = function clone(object) {
    return object === undefined ? undefined : JSON.parse(JSON.stringify(object));
};

/**
 * UTF-8 aware base64 encoding (compatible with the old jquery.base64 plugin).
 */
Utils.base64Encode = function base64Encode(text) {
    var bytes = new TextEncoder().encode(text.replace(/\r\n/g, "\n"));
    var binary = "";
    for (var i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(binary);
};

Utils.base64Decode = function base64Decode(data) {
    data = data.replace(/[^A-Za-z0-9+\/]/g, "");
    while (data.length % 4 != 0)
        data += "=";

    var binary = atob(data);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
};

/**
 * Downloads a text file (also works for data: URLs).
 */
Utils.fetchText = async function fetchText(url, timeout) {
    var controller = new AbortController();
    var timer = setTimeout(function () {
        controller.abort();
    }, timeout || 10000);
    try {
        var response = await fetch(url, { signal:controller.signal });
        if (!response.ok)
            throw new Error("HTTP " + response.status);

        return await response.text();
    } finally {
        clearTimeout(timer);
    }
};
