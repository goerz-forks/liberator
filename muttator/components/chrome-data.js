/* Adds support for data: URIs with chrome privileges
 * and fragment identifiers.
 *
 * "chrome-data:" <content-type> [; <flag>]* "," [<data>]
 *
 * By Kris Maglione, ideas from Ed Anuff's nsChromeExtensionHandler.
 *
 * Licenced under the MIT License, which allows for sublicensing
 * under any compatible license, including the GNU GPL and the MPL.
 */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const NS_BINDING_ABORTED = 0x804b0002;
const nsIProtocolHandler = Components.interfaces.nsIProtocolHandler;

const ioService = Components.classes["@mozilla.org/network/io-service;1"]
                            .getService(Components.interfaces.nsIIOService);

let channel = Components.classesByID["{61ba33c0-3031-11d3-8cd0-0060b0fc14a3}"]
                        .getService(Components.interfaces.nsIProtocolHandler)
                        .newChannel(ioService.newURI("chrome://liberator/content/data", null, null))
                        .QueryInterface(Components.interfaces.nsIRequest);
const systemPrincipal = channel.owner;
channel.cancel(NS_BINDING_ABORTED);
delete channel;

var instance;
function ChromeData() {}
ChromeData.prototype = {
    contractID:       "@mozilla.org/network/protocol;1?name=chrome-data",
    classID:          Components.ID("{c1b67a07-18f7-4e13-b361-2edcc35a5a0d}"),
    classDescription: "Data URIs with chrome privileges",
    QueryInterface:   XPCOMUtils.generateQI([Components.interfaces.nsIProtocolHandler]),
    _xpcom_factory: {
        createInstance: function (outer, iid)
        {
            if (!instance)
            instance = new ChromeData();
            if (outer != null)
            throw Components.results.NS_ERROR_NO_AGGREGATION;
            return instance.QueryInterface(iid);
        }
    },

    scheme: "chrome-data",
    defaultPort: -1,
    allowPort: function (port, scheme) false,
    protocolFlags: nsIProtocolHandler.URI_NORELATIVE
         | nsIProtocolHandler.URI_NOAUTH
         | nsIProtocolHandler.URI_IS_UI_RESOURCE,

    newURI: function (spec, charset, baseURI)
    {
        var uri = Components.classes["@mozilla.org/network/standard-url;1"]
                            .createInstance(Components.interfaces.nsIStandardURL)
                            .QueryInterface(Components.interfaces.nsIURI);
        uri.init(1, -1, spec, charset, null);
        return uri;
    },

    newChannel: function (uri)
    {
        try
        {
            if (uri.scheme == this.scheme)
            {
                let newURI = ioService.newURI(uri.spec.replace(/^.*?:\/*(.*)(?:#.*)?/, "data:$1"), null, null);
                let channel = ioService.newChannelFromURI(newURI);
                channel.owner = systemPrincipal;
                channel.originalURI = uri;
                return channel;
            }
        }
        catch (e) {}
        throw Components.results.NS_ERROR_FAILURE;
    }
};

var components = [ChromeData];

function NSGetModule(compMgr, fileSpec)
{
    return XPCOMUtils.generateModule(components);
}

// vim: set fdm=marker sw=4 ts=4 et:
