/***** BEGIN LICENSE BLOCK ***** {{{
 Copyright © 2008-2009 by Kris Maglione <maglione.k at Gmail>
 Distributable under the terms of the MIT license, which allows
 for sublicensing under any compatible license, including the MPL,
 GPL, and MPL. Anyone who changes this file is welcome to relicense
 it under any or all of those licenseses.
}}} ***** END LICENSE BLOCK *****/

var EXPORTED_SYMBOLS = ["storage", "Timer"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;
const Cu = Components.utils;

// XXX: does not belong here
function Timer(minInterval, maxInterval, callback)
{
    let timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
    this.doneAt = 0;
    this.latest = 0;
    this.notify = function (aTimer)
    {
        timer.cancel();
        this.latest = 0;
        /* minInterval is the time between the completion of the command and the next firing. */
        this.doneAt = Date.now() + minInterval;

        try
        {
            callback(this.arg);
        }
        finally
        {
            this.doneAt = Date.now() + minInterval;
        }
    };
    this.tell = function (arg)
    {
        if (arguments.length > 0)
            this.arg = arg;

        let now = Date.now();
        if (this.doneAt == -1)
            timer.cancel();

        let timeout = minInterval;
        if (now > this.doneAt && this.doneAt > -1)
            timeout = 0;
        else if (this.latest)
            timeout = Math.min(timeout, this.latest - now);
        else
            this.latest = now + maxInterval;

        timer.initWithCallback(this, Math.max(timeout, 0), timer.TYPE_ONE_SHOT);
        this.doneAt = -1;
    };
    this.reset = function ()
    {
        timer.cancel();
        this.doneAt = 0;
    };
    this.flush = function ()
    {
        if (this.doneAt == -1)
            this.notify();
    };
}

function getFile(name)
{
    let file = storage.infoPath.clone();
    file.append(name);
    return file;
}

function readFile(file)
{
    let fileStream = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
    let stream = Cc["@mozilla.org/intl/converter-input-stream;1"].createInstance(Ci.nsIConverterInputStream);

    try
    {
        fileStream.init(file, -1, 0, 0);
        stream.init(fileStream, "UTF-8", 4096, Ci.nsIConverterInputStream.DEFAULT_REPLACEMENT_CHARACTER); // 4096 bytes buffering

        let hunks = [];
        let res = {};
        while (stream.readString(4096, res) != 0)
            hunks.push(res.value);

        stream.close();
        fileStream.close();

        return hunks.join("");
    }
    catch (e) {}
}

function writeFile(file, data)
{
    if (!file.exists())
        file.create(file.NORMAL_FILE_TYPE, 0600);

    let fileStream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
    let stream = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);

    fileStream.init(file, 0x20 | 0x08 | 0x02, 0600, 0); // PR_TRUNCATE | PR_CREATE | PR_WRITE
    stream.init(fileStream, "UTF-8", 0, 0);

    stream.writeString(data);

    stream.close();
    fileStream.close();
}

var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
var prefService = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService)
                            .getBranch("extensions.liberator.datastore.");
var json = Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);

function getCharPref(name)
{
    try
    {
        return prefService.getComplexValue(name, Ci.nsISupportsString).data;
    }
    catch (e) {}
}

function setCharPref(name, value)
{
    var str = Cc['@mozilla.org/supports-string;1'].createInstance(Ci.nsISupportsString);
    str.data = value;
    return prefService.setComplexValue(name, Ci.nsISupportsString, str);
}

function loadPref(name, store, type)
{
    if (store)
        var pref = getCharPref(name);
    if (!pref && storage.infoPath)
        var file = readFile(getFile(name));
    if (pref || file)
        var result = json.decode(pref || file);
    if (pref)
    {
        prefService.clearUserPref(name);
        savePref({ name: name, store: true, serial: pref })
    }
    if (result instanceof type)
        return result;
}

function savePref(obj)
{
    if (obj.store && storage.infoPath)
        writeFile(getFile(obj.name), obj.serial);
}

var prototype = {
    fireEvent: function (event, arg) { storage.fireEvent(this.name, event, arg) },
    save: function () { savePref(this) },
};

function ObjectStore(name, store, data)
{
    var object = data || {};

    this.__defineGetter__("store", function () store);
    this.__defineGetter__("name", function () name);
    this.__defineGetter__("serial", function () json.encode(object));

    this.set = function set(key, val)
    {
        var defined = key in object;
        var orig = object[key];
        object[key] = val;
        if (!defined)
            this.fireEvent("add", key);
        else if (orig != val)
            this.fireEvent("change", key);
    };

    this.remove = function remove(key)
    {
        var ret = object[key];
        delete object[key];
        this.fireEvent("remove", key);
        return ret;
    };

    this.get = function get(val) object[val];

    this.clear = function ()
    {
        object = {};
    };

    this.__iterator__ = function () Iterator(object);
}
ObjectStore.prototype = prototype;

function ArrayStore(name, store, data)
{
    var array = data || [];

    this.__defineGetter__("store",  function () store);
    this.__defineGetter__("name",   function () name);
    this.__defineGetter__("serial", function () json.encode(array));
    this.__defineGetter__("length", function () array.length);

    this.set = function set(index, value)
    {
        var orig = array[index];
        array[index] = value;
        this.fireEvent("change", index);
    };

    this.push = function push(value)
    {
        array.push(value);
        this.fireEvent("push", array.length);
    };

    this.pop = function pop(value)
    {
        var ret = array.pop();
        this.fireEvent("pop", array.length);
        return ret;
    };

    this.truncate = function truncate(length, fromEnd)
    {
        var ret = array.length;
        if (array.length > length)
        {
            if (fromEnd)
                array.splice(0, array.length - length);
            array.length = length;
            this.fireEvent("truncate", length);
        }
        return ret;
    };

    // XXX: Awkward.
    this.mutate = function mutate(aFuncName)
    {
        var funcName = aFuncName;
        arguments[0] = array;
        array = Array[funcName].apply(Array, arguments);
        this.fireEvent("change", null);
    };

    this.get = function get(index)
    {
        return index >= 0 ? array[index] : array[array.length + index];
    };

    this.__iterator__ = function () Iterator(array);
}
ArrayStore.prototype = prototype;

var keys = {};
var observers = {};
var timers = {};

var storage = {
    newObject: function newObject(key, constructor, store, type, reload)
    {
        if (!(key in keys) || reload)
        {
            if (key in this && !reload)
                throw Error;
            keys[key] = new constructor(key, store, loadPref(key, store, type || Object));
            timers[key] = new Timer(1000, 10000, function () storage.save(key));
            this.__defineGetter__(key, function () keys[key]);
        }
        return keys[key];
    },

    newMap: function newMap(key, store)
    {
        return this.newObject(key, ObjectStore, store);
    },

    newArray: function newArray(key, store)
    {
        return this.newObject(key, ArrayStore, store, Array);
    },

    addObserver: function addObserver(key, callback, ref)
    {
        if (ref)
        {
            if (!ref.liberatorStorageRefs)
                ref.liberatorStorageRefs = [];
            ref.liberatorStorageRefs.push(callback);
            var callbackRef = Cu.getWeakReference(callback);
        }
        else
        {
            callbackRef = { get: function () callback };
        }
        this.removeDeadObservers();
        if (!(key in observers))
            observers[key] = [];
        if (!observers[key].some(function (o) o.callback.get() == callback))
            observers[key].push({ ref: ref && Cu.getWeakReference(ref), callback: callbackRef });
    },

    removeObserver: function (key, callback)
    {
        this.removeDeadObservers();
        if (!(key in observers))
            return;
        observers[key] = observers[key].filter(function (elem) elem.callback.get() != callback);
        if (observers[key].length == 0)
            delete obsevers[key];
    },

    removeDeadObservers: function ()
    {
        for (let [key, ary] in Iterator(observers))
        {
            observers[key] = ary = ary.filter(function (o) o.callback.get() && (!o.ref || o.ref.get() && o.ref.get().liberatorStorageRefs))
            if (!ary.length)
                delete observers[key];
        }
    },

    get observers() observers,

    fireEvent: function fireEvent(key, event, arg)
    {
        this.removeDeadObservers();
        // Safe, since we have our own Array object here.
        for each (let observer in observers[key])
            observer.callback.get()(key, event, arg);
        timers[key].tell();
    },

    save: function save(key)
    {
        savePref(keys[key]);
    },

    saveAll: function storeAll()
    {
        for each (obj in keys)
            savePref(obj);
    },
};

// vim: set fdm=marker sw=4 sts=4 et ft=javascript:
