/***** BEGIN LICENSE BLOCK ***** {{{
Version: MPL 1.1/GPL 2.0/LGPL 2.1

The contents of this file are subject to the Mozilla Public License Version
1.1 (the "License"); you may not use this file except in compliance with
the License. You may obtain a copy of the License at
http://www.mozilla.org/MPL/

Software distributed under the License is distributed on an "AS IS" basis,
WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
for the specific language governing rights and limitations under the
License.

Copyright (c) 2006-2009 by Martin Stubenschrott <stubenschrott@vimperator.org>

Alternatively, the contents of this file may be used under the terms of
either the GNU General Public License Version 2 or later (the "GPL"), or
the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
in which case the provisions of the GPL or the LGPL are applicable instead
of those above. If you wish to allow use of your version of this file only
under the terms of either the GPL or the LGPL, and not to allow others to
use your version of this file under the terms of the MPL, indicate your
decision by deleting the provisions above and replace them with the notice
and other provisions required by the GPL or the LGPL. If you do not delete
the provisions above, a recipient may use your version of this file under
the terms of any one of the MPL, the GPL or the LGPL.
}}} ***** END LICENSE BLOCK *****/

/** @scope modules */

// do NOT create instances of this class yourself, use the helper method
// options.add() instead
/**
 * A class representing configuration options. Instances are created by the
 * {@link Options} class.
 *
 * @param {string[]} names The names by which this option is identified.
 * @param {string} description A short one line description of the option.
 * @param {string} type The option's value data type (see {@link Option#type}).
 * @param {string} defaultValue The default value for this option.
 * @param {Object} extraInfo An optional extra configuration hash. The
 *     following properties are supported.
 *         scope     - see {@link Option#scope}
 *         setter    - see {@link Option#setter}
 *         getter    - see {@link Option#getter}
 *         completer - see {@link Option#completer}
 *         valdator  - see {@link Option#validator}
 *         checkHas  - see {@link Option#checkHas}
 * @optional
 * @private
 */
function Option(names, description, type, defaultValue, extraInfo) //{{{
{
    if (!extraInfo)
        extraInfo = {};

    /** @property {string} The option's canonical name. */
    this.name = names[0];
    /** @property {string[]} All names by which this option is identified. */
    this.names = names;
    /**
     * @property {string} The option's data type. One of:
     *     "boolean"    - Boolean E.g. true
     *     "number"     - Integer E.g. 1
     *     "string"     - String E.g. "Vimperator"
     *     "charlist"   - Character list E.g. "rb"
     *     "stringlist" - String list E.g. "homepage,quickmark,tabopen,paste"
     */
    this.type = type;
    /**
     * @property {number} The scope of the option. This can be local, global,
     * or both.
     * @see Options#OPTION_SCOPE_LOCAL
     * @see Options#OPTION_SCOPE_GLOBAL
     * @see Options#OPTION_SCOPE_BOTH
     */
    this.scope = (extraInfo.scope & options.OPTION_SCOPE_BOTH) || options.OPTION_SCOPE_GLOBAL; // XXX set to BOTH by default someday? - kstep
    /**
     * @property {string} This option's description, as shown in :optionusage.
     */
    this.description = description || "";

    /**
     * @property {value} The option's default value. This value will be used
     * unless the option is explicitly set either interactively or in an RC
     * file or plugin.
     */
    this.defaultValue = (defaultValue === undefined) ? null : defaultValue; // "", 0 are valid default values

    /**
     * @property {function} The function called when the option value is set.
     */
    this.setter = extraInfo.setter || null;
    /**
     * @property {function} The function called when the option value is read.
     */
    this.getter = extraInfo.getter || null;
    /**
     * @property {function(CompletionContext, Args)} This option's completer.
     * @see CompletionContext
     */
    this.completer = extraInfo.completer || null;
    /**
     * @property {function} The function called to validate the option's value
     * when set.
     */
    this.validator = extraInfo.validator || null;
    /**
     * @property The function called to determine whether the option already
     * contains a specified value.
     * @see #has
     */
    this.checkHas = extraInfo.checkHas || null;
    /**
     * @property {boolean} Set to true whenever the option is first set. This
     * is useful to see whether it was changed from its default value
     * interactively or by some RC file.
     */
    this.hasChanged = false;

    // add no{option} variant of boolean {option} to this.names
    if (this.type == "boolean")
    {
        this.names = []; // reset since order is important
        for (let [,name] in Iterator(names))
        {
            this.names.push(name);
            this.names.push("no" + name);
        }
    }

    if (this.globalvalue == undefined)
        this.globalvalue = this.defaultValue;
}

Option.prototype = {

    /** @property {value} The option's global value. @see #scope */
    get globalvalue() options.store.get(this.name),
    set globalvalue(val) { options.store.set(this.name, val); },

    /**
     * Returns <b>value</b> as an array of parsed values if the option type is
     * "charlist" or "stringlist" or else unchanged.
     *
     * @param {value} value The option value.
     * @returns {value|string[]}
     */
    parseValues: function (value)
    {
        if (this.type == "stringlist")
            return (value === "") ? [] : value.split(",");
        if (this.type == "charlist")
            return Array.slice(value);
        return value;
    },

    /**
     * Returns <b>values</b> packed in the appropriate format for the option
     * type.
     *
     * @param {value|string[]} values The option value.
     * @returns {value}
     */
    joinValues: function (values)
    {
        if (this.type == "stringlist")
            return values.join(",");
        if (this.type == "charlist")
            return values.join("");
        return values;
    },

    /** @property {value|string[]} The option value or array of values. */
    get values() this.parseValues(this.value),
    set values(values) this.setValues(values, this.scope),

    /**
     * Returns the option's value as an array of parsed values if the option
     * type is "charlist" or "stringlist" or else the simple value.
     *
     * @param {number} scope The scope to return these values from (see
     *     {@link Option#scope}).
     * @returns {value|string[]}
     */
    getValues: function (scope) this.parseValues(this.get(scope)),

    /**
     * Sets the option's value from an array of values if the option type is
     * "charlist" or "stringlist" or else the simple value.
     *
     * @param {number} scope The scope to apply these values to (see
     *     {@link Option#scope}).
     */
    setValues: function (values, scope)
    {
        this.set(this.joinValues(values), scope || this.scope);
    },

    /**
     * Returns the value of the option in the specified <b>scope</b>. The
     * (@link Option#getter) callback, if it exists, is invoked with this value
     * before it is returned.
     *
     * @param {number} scope The scope to return this value from (see
     *     {@link Option#scope}).
     * @returns {value}
     */
    get: function (scope)
    {
        if (scope)
        {
            if ((scope & this.scope) == 0) // option doesn't exist in this scope
                return null;
        }
        else
        {
            scope = this.scope;
        }

        let aValue;

        if (liberator.has("tabs") && (scope & options.OPTION_SCOPE_LOCAL))
            aValue = tabs.options[this.name];
        if ((scope & options.OPTION_SCOPE_GLOBAL) && (aValue == undefined))
            aValue = this.globalvalue;

        if (this.getter)
            return this.getter.call(this, aValue);

        return aValue;
    },

    /**
     * Sets the option value to <b>newValue</b> for the specified <b>scope</b>.
     * The (@link Option#setter) callback, if it exists, is invoked with
     * <b>newValue</b>.
     *
     * @param {value} newValue The option's new value.
     * @param {number} scope The scope to apply this value to (see
     *     {@link Option#scope}).
     */
    set: function (newValue, scope)
    {
        scope = scope || this.scope;
        if ((scope & this.scope) == 0) // option doesn't exist in this scope
            return null;

        if (this.setter)
        {
            let tmpValue = newValue;
            newValue = this.setter.call(this, newValue);

            if (newValue === undefined)
            {
                newValue = tmpValue;
                liberator.log("DEPRECATED: '" + this.name + "' setter should return a value");
            }
        }

        if (liberator.has("tabs") && (scope & options.OPTION_SCOPE_LOCAL))
            tabs.options[this.name] = newValue;
        if ((scope & options.OPTION_SCOPE_GLOBAL) && newValue != this.globalValue)
            this.globalvalue = newValue;

        this.hasChanged = true;
    },

    /**
     * @property {value} The option's current value. The option's local value,
     * or if no local value is set, this is equal to the (@link #globalvalue).
     */
    get value() this.get(),
    set value(val) this.set(val),

    /**
     * Returns whether the option value contains one or more of the specified
     * arguments.
     *
     * @returns {boolean}
     */
    has: function ()
    {
        let self = this;
        let test = function (val) values.indexOf(val) >= 0;
        if (this.checkHas)
            test = function (val) values.some(function (value) self.checkHas(value, val));
        let values = this.values;
        // return whether some argument matches
        return Array.some(arguments, function (val) test(val));
    },

    /**
     * Returns whether this option is identified by <b>name</b>.
     *
     * @param {string} name
     * @returns {boolean}
     */
    hasName: function (name) this.names.indexOf(name) >= 0,

    /**
     * Returns whether the specified <b>values</b> are valid for this option.
     * @see Option#validator
     */
    isValidValue: function (values)
    {
        if (this.validator)
            return this.validator(values);
        else
            return true;
    },

    /**
     * Resets the option to its default value.
     */
    reset: function ()
    {
        this.value = this.defaultValue;
    },

    /**
     * Sets the option's value using the specified set <b>operator</b>.
     *
     * @param {string} operator The set operator.
     * @param {value|string[]} values The value (or values) to apply.
     * @param {number} scope The scope to apply this value to (see
     *     {@link #scope}).
     * @param {boolean} invert Whether this is an invert boolean operation.
     */
    op: function (operator, values, scope, invert)
    {
        let newValue = null;
        let self = this;

        switch (this.type)
        {
            case "boolean":
                if (operator != "=")
                    break;

                if (invert)
                    newValue = !this.value;
                else
                    newValue = values;
                break;

            case "number":
                let value = Number(values); // deduce radix

                if (isNaN(value) || value != parseInt(value))
                    return "E521: Number required";

                switch (operator)
                {
                    case "+":
                        newValue = this.value + value;
                        break;
                    case "-":
                        newValue = this.value - value;
                        break;
                    case "^":
                        newValue = this.value * value;
                        break;
                    case "=":
                        newValue = value;
                        break;
                }

                break;

            case "charlist":
            case "stringlist":
                values = Array.concat(values);
                switch (operator)
                {
                    case "+":
                        newValue = util.Array.uniq(Array.concat(this.values, values), true);
                        break;
                    case "^":
                        // NOTE: Vim doesn't prepend if there's a match in the current value
                        newValue = util.Array.uniq(Array.concat(values, this.values), true);
                        break;
                    case "-":
                        newValue = this.values.filter(function (item) values.indexOf(item) == -1);
                        break;
                    case "=":
                        newValue = values;
                        if (invert)
                        {
                            let keepValues = this.values.filter(function (item) values.indexOf(item) == -1);
                            let addValues  = values.filter(function (item) self.values.indexOf(item) == -1);
                            newValue = addValues.concat(keepValues);
                        }
                        break;
                }

                break;

            case "string":
                switch (operator)
                {
                    case "+":
                        newValue = this.value + values;
                        break;
                    case "-":
                        newValue = this.value.replace(values, "");
                        break;
                    case "^":
                        newValue = values + this.value;
                        break;
                    case "=":
                        newValue = values;
                        break;
                }

                break;

            default:
                return "E685: Internal error: option type `" + option.type + "' not supported";
        }

        if (newValue == null)
            return "Operator " + operator + " not supported for option type " + this.type;
        if (!this.isValidValue(newValue))
            return "E474: Invalid argument: " + values;
        this.setValues(newValue, scope);
    }
};

// TODO: Run this by default?
/**
 * Validates the specified <b>values</b> against values generated by the
 * option's completer function.
 *
 * @param {value|string[]} values The value or array of values to validate.
 * @returns {boolean}
 */
Option.validateCompleter = function (values)
{
    liberator.log(values instanceof Array)
    let context = CompletionContext("");
    let res = context.fork("", 0, this, this.completer);
    if (!res)
        res = context.allItems.items.map(function (item) [item.text]);
    return Array.concat(values).every(function (value) res.some(function (item) item[0] == value));
}; //}}}

/**
 * @instance options
 */
function Options() //{{{
{
    ////////////////////////////////////////////////////////////////////////////////
    ////////////////////// PRIVATE SECTION /////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    const SAVED = "liberator.saved.";

    const optionHash = {};

    const prefContexts = [];

    function optionObserver(key, event, option)
    {
        // Trigger any setters.
        let opt = options.get(option);
        if (event == "change" && opt)
            opt.set(opt.value, options.OPTION_SCOPE_GLOBAL);
    }

    storage.newMap("options", false);
    storage.addObserver("options", optionObserver, window);

    function storePreference(name, value)
    {
        if (prefContexts.length)
        {
            let val = loadPreference(name, null);
            if (val != null)
                prefContexts[prefContexts.length - 1][name] = val;
        }

        let type = services.get("pref").getPrefType(name);
        switch (typeof value)
        {
            case "string":
                if (type == Ci.nsIPrefBranch.PREF_INVALID || type == Ci.nsIPrefBranch.PREF_STRING)
                {
                    let supportString = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
                    supportString.data = value;
                    services.get("pref").setComplexValue(name, Ci.nsISupportsString, supportString);
                }
                else if (type == Ci.nsIPrefBranch.PREF_INT)
                    liberator.echoerr("E521: Number required after =: " + name + "=" + value);
                else
                    liberator.echoerr("E474: Invalid argument: " + name + "=" + value);
                break;
            case "number":
                if (type == Ci.nsIPrefBranch.PREF_INVALID || type == Ci.nsIPrefBranch.PREF_INT)
                    services.get("pref").setIntPref(name, value);
                else
                    liberator.echoerr("E474: Invalid argument: " + name + "=" + value);
                break;
            case "boolean":
                if (type == Ci.nsIPrefBranch.PREF_INVALID || type == Ci.nsIPrefBranch.PREF_BOOL)
                    services.get("pref").setBoolPref(name, value);
                else if (type == Ci.nsIPrefBranch.PREF_INT)
                    liberator.echoerr("E521: Number required after =: " + name + "=" + value);
                else
                    liberator.echoerr("E474: Invalid argument: " + name + "=" + value);
                break;
            default:
                liberator.echoerr("Unknown preference type: " + typeof value + " (" + name + "=" + value + ")");
        }
    }

    function loadPreference(name, forcedDefault, defaultBranch)
    {
        let defaultValue = null; // XXX
        if (forcedDefault != null)  // this argument sets defaults for non-user settable options (like extensions.history.comp_history)
            defaultValue = forcedDefault;

        let branch = defaultBranch ? services.get("pref").getDefaultBranch("") : services.get("pref");
        let type = services.get("pref").getPrefType(name);
        try
        {
            switch (type)
            {
                case Ci.nsIPrefBranch.PREF_STRING:
                    let value = branch.getComplexValue(name, Ci.nsISupportsString).data;
                    // try in case it's a localized string (will throw an exception if not)
                    if (!services.get("pref").prefIsLocked(name) && !services.get("pref").prefHasUserValue(name) &&
                        RegExp("chrome://.+/locale/.+\\.properties").test(value))
                            value = branch.getComplexValue(name, Ci.nsIPrefLocalizedString).data;
                    return value;
                case Ci.nsIPrefBranch.PREF_INT:
                    return branch.getIntPref(name);
                case Ci.nsIPrefBranch.PREF_BOOL:
                    return branch.getBoolPref(name);
                default:
                    return defaultValue;
            }
        }
        catch (e)
        {
            return defaultValue;
        }
    }

    function setAction(args, modifiers)
    {
        let bang = args.bang;
        if (!args.length)
            args[0] = "";

        for (let [,arg] in args)
        {
            if (bang)
            {
                let onlyNonDefault = false;
                let reset = false;
                let invertBoolean = false;

                if (args[0] == "")
                {
                    var name = "all";
                    onlyNonDefault = true;
                }
                else
                {
                    var [matches, name, postfix, valueGiven, operator, value] =
                    arg.match(/^\s*?([a-zA-Z0-9\.\-_{}]+)([?&!])?\s*(([-+^]?)=(.*))?\s*$/);
                    reset = (postfix == "&");
                    invertBoolean = (postfix == "!");
                }

                if (name == "all" && reset)
                    liberator.echoerr("You can't reset all options, it could make " + config.hostApplication + " unusable.");
                else if (name == "all")
                    options.listPrefs(onlyNonDefault, "");
                else if (reset)
                    options.resetPref(name);
                else if (invertBoolean)
                    options.invertPref(name);
                else if (valueGiven)
                {
                    switch (value)
                    {
                        case undefined:
                            value = "";
                            break;
                        case "true":
                            value = true;
                            break;
                        case "false":
                            value = false;
                            break;
                        default:
                            if (/^\d+$/.test(value))
                                value = parseInt(value, 10);
                    }
                    options.setPref(name, value);
                }
                else
                {
                    options.listPrefs(onlyNonDefault, name);
                }
                return;
            }

            let opt = options.parseOpt(arg, modifiers);
            if (!opt)
            {
                liberator.echoerr("Error parsing :set command: " + arg);
                return;
            }

            let option = opt.option;
            if (option == null && !opt.all)
            {
                liberator.echoerr("No such option: " + opt.name);
                return;
            }

            // reset a variable to its default value
            if (opt.reset)
            {
                if (opt.all)
                {
                    for (let option in options)
                        option.reset();
                }
                else
                {
                    option.reset();
                }
            }
            // read access
            else if (opt.get)
            {
                if (opt.all)
                {
                    options.list(opt.onlyNonDefault, opt.scope);
                }
                else
                {
                    if (option.type == "boolean")
                        liberator.echo((opt.optionValue ? "  " : "no") + option.name);
                    else
                        liberator.echo("  " + option.name + "=" + opt.optionValue);
                }
            }
            // write access
            // NOTE: the behavior is generally Vim compatible but could be
            // improved. i.e. Vim's behavior is pretty sloppy to no real benefit
            else
            {
                if (opt.option.type == "boolean")
                {
                    if (opt.valueGiven)
                    {
                        liberator.echoerr("E474: Invalid argument: " + arg);
                        return;
                    }
                    opt.values = !opt.unsetBoolean;
                }
                let res = opt.option.op(opt.operator || "=", opt.values, opt.scope, opt.invert);
                if (res)
                    liberator.echoerr(res);
            }
        }
    }

    function setCompleter(context, args, modifiers)
    {
        let filter = context.filter;

        if (args.bang) // list completions for about:config entries
        {
            if (filter[filter.length - 1] == "=")
            {
                context.advance(filter.length);
                filter = filter.substr(0, filter.length - 1);
                context.completions = [
                        [loadPreference(filter, null, false), "Current Value"],
                        [loadPreference(filter, null, true), "Default Value"]
                ].filter(function ([k]) k != null);
                return;
            }

            return completion.preference(context);
        }

        let opt = options.parseOpt(filter, modifiers);
        let prefix = opt.prefix;

        if (context.filter.indexOf("=") == -1)
        {
            if (prefix)
                context.filters.push(function ({ item: opt }) opt.type == "boolean" || prefix == "inv" && opt.values instanceof Array);
            return completion.option(context, opt.scope);
        }
        else if (prefix == "no")
            return;

        if (prefix)
            context.advance(prefix.length);

        let option = opt.option;
        context.advance(context.filter.indexOf("=") + 1);

        if (!option)
        {
            context.message = "No such option: " + opt.name;
            context.highlight(0, name.length, "SPELLCHECK");
        }

        if (opt.get || opt.reset || !option || prefix)
            return;

        if (!opt.value)
        {
            context.fork("default", 0, this, function (context) {
                context.title = ["Extra Completions"];
                context.completions = [
                        [option.value, "Current value"],
                        [option.defaultValue, "Default value"]
                ].filter(function (f) f[0] != "");
            });
        }

        context.fork("values", 0, completion, "optionValue", opt.name, opt.operator);
    }

    //
    // Firefox preferences which need to be changed to work well with Vimperator
    //

    // work around Firefox popup blocker
    // TODO: Make this work like safeSetPref
    var popupAllowedEvents = loadPreference("dom.popup_allowed_events", "change click dblclick mouseup reset submit");
    if (!/keypress/.test(popupAllowedEvents))
    {
        storePreference("dom.popup_allowed_events", popupAllowedEvents + " keypress");
        liberator.registerObserver("shutdown", function ()
        {
            if (loadPreference("dom.popup_allowed_events", "")
                    == popupAllowedEvents + " keypress")
                storePreference("dom.popup_allowed_events", popupAllowedEvents);
        });
    }

    // safeSetPref might try to echomsg. Need commandline.
    liberator.registerObserver("load_commandline", function () {
        // TODO: maybe reset in .destroy()?
        // TODO: move to buffer.js
        // we have our own typeahead find implementation
        options.safeSetPref("accessibility.typeaheadfind.autostart", false);
        options.safeSetPref("accessibility.typeaheadfind", false); // actually the above setting should do it, but has no effect in Firefox
    });

    // start with saved session
    storePreference("browser.startup.page", 3);

    /////////////////////////////////////////////////////////////////////////////}}}
    ////////////////////// COMMANDS ////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    commands.add(["let"],
        "Set or list a variable",
        function (args)
        {
            args = args.string;

            if (!args)
            {
                let str =
                    <table>
                    {
                        template.map(liberator.globalVariables, function ([i, value]) {
                            let prefix = typeof value == "number"   ? "#" :
                                         typeof value == "function" ? "*" :
                                                                      " ";
                            return <tr>
                                        <td style="width: 200px;">{i}</td>
                                        <td>{prefix}{value}</td>
                                   </tr>
                        })
                    }
                    </table>;
                if (str.*.length())
                    liberator.echo(str, commandline.FORCE_MULTILINE);
                else
                    liberator.echomsg("No variables found");
                return;
            }

            let matches;
            // 1 - type, 2 - name, 3 - +-., 4 - expr
            if (matches = args.match(/([$@&])?([\w:]+)\s*([-+.])?=\s*(.+)/))
            {
                if (!matches[1])
                {
                    let reference = liberator.variableReference(matches[2]);
                    if (!reference[0] && matches[3])
                    {
                        liberator.echoerr("E121: Undefined variable: " + matches[2]);
                        return;
                    }

                    let expr = liberator.evalExpression(matches[4]);
                    if (expr === undefined)
                    {
                        liberator.echoerr("E15: Invalid expression: " + matches[4]);
                        return;
                    }
                    else
                    {
                        if (!reference[0])
                        {
                            if (reference[2] == "g")
                                reference[0] = liberator.globalVariables;
                            else
                                return; // for now
                        }

                        if (matches[3])
                        {
                            if (matches[3] == "+")
                                reference[0][reference[1]] += expr;
                            else if (matches[3] == "-")
                                reference[0][reference[1]] -= expr;
                            else if (matches[3] == ".")
                                reference[0][reference[1]] += expr.toString();
                        }
                        else
                            reference[0][reference[1]] = expr;
                    }
                }
            }
            // 1 - name
            else if (matches = args.match(/^\s*([\w:]+)\s*$/))
            {
                let reference = liberator.variableReference(matches[1]);
                if (!reference[0])
                {
                    liberator.echoerr("E121: Undefined variable: " + matches[1]);
                    return;
                }

                let value = reference[0][reference[1]];
                let prefix = typeof value == "number"   ? "#" :
                             typeof value == "function" ? "*" :
                                                          " ";
                liberator.echo(reference[1] + "\t\t" + prefix + value);
            }
        },
        {
            literal: 0
        }
    );

    commands.add(["setl[ocal]"],
        "Set local option",
        function (args)
        {
            return setAction(args, { scope: options.OPTION_SCOPE_LOCAL });
        },
        {
            bang: true,
            count: true,
            completer: function (context, args)
            {
                return setCompleter(context, args, { scope: options.OPTION_SCOPE_LOCAL });
            },
            literal: 0
        }
    );

    commands.add(["setg[lobal]"],
        "Set global option",
        function (args)
        {
            return setAction(args, { scope: options.OPTION_SCOPE_GLOBAL });
        },
        {
            bang: true,
            count: true,
            completer: function (context, args)
            {
                return setCompleter(context, args, { scope: options.OPTION_SCOPE_GLOBAL });
            },
            literal: 0
        }
    );

    commands.add(["se[t]"],
        "Set an option",
        function (args)
        {
            return setAction(args);
        },
        {
            bang: true,
            completer: function (context, args)
            {
                return setCompleter(context, args);
            },
            serial: function () [
                {
                    command: this.name,
                    arguments: [opt.type == "boolean" ? (opt.value ? "" : "no") + opt.name
                                                      : opt.name + "=" + opt.value]
                }
                for (opt in options)
                if (!opt.getter && opt.value != opt.defaultValue && (opt.scope & options.OPTION_SCOPE_GLOBAL))
            ]
        });

    commands.add(["unl[et]"],
        "Delete a variable",
        function (args)
        {
            //let names = args.split(/ /);
            //if (typeof names == "string") names = [names];

            //let length = names.length;
            //for (let i = 0, name = names[i]; i < length; name = names[++i])
            for (let [,name] in args)
            {
                let reference = liberator.variableReference(name);
                if (!reference[0])
                {
                    if (!args.bang)
                        liberator.echoerr("E108: No such variable: " + name);
                    return;
                }

                delete reference[0][reference[1]];
            }
        },
        {
            argCount: "+",
            bang: true
        });

    /////////////////////////////////////////////////////////////////////////////}}}
    ////////////////////// PUBLIC SECTION //////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////{{{

    // TODO: Does this belong elsewhere?
    liberator.registerObserver("load_completion", function ()
    {
        completion.setFunctionCompleter(options.get, [function () ([o.name, o.description] for (o in options))]);
        completion.setFunctionCompleter([options.getPref, options.safeSetPref, options.setPref, options.resetPref, options.invertPref],
                [function () services.get("pref")
                                     .getChildList("", { value: 0 })
                                     .map(function (pref) [pref, ""])]);
    });

    const self = {

        /**
         * @property {number} Global option scope.
         * @final
         */
        OPTION_SCOPE_GLOBAL: 1,

        /**
         * @property {number} Local option scope. Options in this scope only
         *     apply to the current tab/buffer.
         * @final
         */
        OPTION_SCOPE_LOCAL: 2,

        /**
         * @property {number} Both local and global option scope.
         * @final
         */
        OPTION_SCOPE_BOTH: 3,

        /** @property {Iterator(Option)} @private */
        __iterator__: function ()
        {
            let sorted = [o for ([i, o] in Iterator(optionHash))].sort(function (a, b) String.localeCompare(a.name, b.name));
            return (v for ([k, v] in Iterator(sorted)));
        },

        /** @property {Object} Observes preference value changes. */
        prefObserver: {
            register: function ()
            {
                // better way to monitor all changes?
                this._branch = services.get("pref").getBranch("").QueryInterface(Ci.nsIPrefBranch2);
                this._branch.addObserver("", this, false);
            },

            unregister: function ()
            {
                if (this._branch)
                    this._branch.removeObserver("", this);
            },

            observe: function (subject, topic, data)
            {
                if (topic != "nsPref:changed")
                    return;

                // subject is the nsIPrefBranch we're observing (after appropriate QI)
                // data is the name of the pref that's been changed (relative to subject)
                switch (data)
                {
                    case "accessibility.browsewithcaret":
                        let value = options.getPref("accessibility.browsewithcaret", false);
                        liberator.mode = value ? modes.CARET : modes.NORMAL;
                        break;
                }
             }
        },

        /**
         * Adds a new option.
         *
         * @param {string[]} names All names for the option.
         * @param {string} description A description of the option.
         * @param {string} type The option type (see {@link Option#type}).
         * @param {value} defaultValue The option's default value.
         * @param {Object} extra An optional extra configuration hash (see
         *     {@link Map#extraInfo}).
         * @optional
         * @returns {boolean} Whether the option was created.
         */
        add: function (names, description, type, defaultValue, extraInfo)
        {
            if (!extraInfo)
                extraInfo = {};

            let option = new Option(names, description, type, defaultValue, extraInfo);

            if (!option)
                return false;

            if (option.name in optionHash)
            {
                // never replace for now
                liberator.log("Warning: '" + names[0] + "' already exists, NOT replacing existing option.", 1);
                return false;
            }

            // quickly access options with options["wildmode"]:
            this.__defineGetter__(option.name, function () option.value);
            this.__defineSetter__(option.name, function (value) { option.value = value; });

            optionHash[option.name] = option;
            return true;
        },

        /**
         * Returns the option with <b>name</b> in the specified <b>scope</b>.
         *
         * @param {string} name The option's name.
         * @param {number} scope The option's scope (see {@link Option#scope}).
         * @optional
         * @returns {Option} The matching option.
         */
        get: function (name, scope)
        {
            if (!scope)
                scope = options.OPTION_SCOPE_BOTH;

            if (name in optionHash)
                return (optionHash[name].scope & scope) && optionHash[name];

            for (let opt in Iterator(options))
            {
                if (opt.hasName(name))
                    return (opt.scope & scope) && opt;
            }

            return null;
        },

        /**
         * Lists all options in <b>scope</b> or only those with changed values
         * if <b>onlyNonDefault</b> is specified.
         *
         * @param {boolean} onlyNonDefault Limit the list to prefs with a
         *     non-default value.
         * @param {number} scope Only list options in this scope (see
         *     {@link Option#scope}).
         */
        list: function (onlyNonDefault, scope)
        {
            if (!scope)
                scope = options.OPTION_SCOPE_BOTH;

            let opts = function (opt) {
                for (let opt in Iterator(options))
                {
                    let option = {
                        isDefault: opt.value == opt.defaultValue,
                        name:      opt.name,
                        default:   opt.defaultValue,
                        pre:       "\u00a0\u00a0", // Unicode nonbreaking space.
                        value:     <></>
                    };

                    if (onlyNonDefault && option.isDefault)
                        continue;
                    if (!(opt.scope & scope))
                        continue;

                    if (opt.type == "boolean")
                    {
                        if (!opt.value)
                            option.pre = "no";
                        option.default = (option.default ? "" : "no") + opt.name;
                    }
                    else
                    {
                        option.value = <>={template.highlight(opt.value)}</>;
                    }
                    yield option;
                }
            };

            let list = template.options("Options", opts());
            commandline.echo(list, commandline.HL_NORMAL, commandline.FORCE_MULTILINE);
        },

        /**
         * Lists all preferences matching <b>filter</b> or only those with
         * changed values if <b>onlyNonDefault</b> is specified.
         *
         * @param {boolean} onlyNonDefault Limit the list to prefs with a
         *     non-default value.
         * @param {string} filter The list filter. A null filter lists all
         *     prefs.
         * @optional
         */
        listPrefs: function (onlyNonDefault, filter)
        {
            if (!filter)
                filter = "";

            let prefArray = services.get("pref").getChildList("", { value: 0 });
            prefArray.sort();
            let prefs = function () {
                for (let [,pref] in Iterator(prefArray))
                {
                    let userValue = services.get("pref").prefHasUserValue(pref);
                    if (onlyNonDefault && !userValue || pref.indexOf(filter) == -1)
                        continue;

                    value = options.getPref(pref);

                    let option = {
                        isDefault: !userValue,
                        default:   loadPreference(pref, null, true),
                        value:     <>={template.highlight(value, true, 100)}</>,
                        name:      pref,
                        pre:       "\u00a0\u00a0" // Unicode nonbreaking space.
                    };

                    yield option;
                }
            };

            let list = template.options(config.hostApplication + " Options", prefs());
            commandline.echo(list, commandline.HL_NORMAL, commandline.FORCE_MULTILINE);
        },

        /**
         * Parses a :set command.
         *
         * @param {string} args The :set command's argument string.
         * @param {Object} modifiers A hash of parsing modifiers. These are:
         *     scope - see {@link Option#scope}
         * @optional
         * @returns {Object} The parsed command object.
         */
        parseOpt: function parseOpt(args, modifiers)
        {
            let ret = {};
            let matches, prefix, postfix, valueGiven;

            [matches, prefix, ret.name, postfix, valueGiven, ret.operator, ret.value] =
            args.match(/^\s*(no|inv)?([a-z_]*)([?&!])?\s*(([-+^]?)=(.*))?\s*$/) || [];

            ret.args = args;
            ret.onlyNonDefault = false; // used for :set to print non-default options
            if (!args)
            {
                ret.name = "all";
                ret.onlyNonDefault = true;
            }

            if (matches)
                ret.option = options.get(ret.name, ret.scope);

            ret.prefix = prefix;
            ret.postfix = postfix;

            ret.all = (ret.name == "all");
            ret.get = (ret.all || postfix == "?" || (ret.option && ret.option.type != "boolean" && !valueGiven));
            ret.invert = (prefix == "inv" || postfix == "!");
            ret.reset = (postfix == "&");
            ret.unsetBoolean = (prefix == "no");

            ret.scope = modifiers && modifiers.scope;

            if (!ret.option)
                return ret;

            if (ret.value === undefined)
                ret.value = "";

            ret.optionValue = ret.option.get(ret.scope);
            ret.optionValues = ret.option.getValues(ret.scope);

            ret.values = ret.option.parseValues(ret.value);

            return ret;
        },

        /** @property {Object} The options store. */
        get store() storage.options,

        /**
         * Returns the value of the preference <b>name</b>.
         *
         * @param {string} name The preference name.
         * @param {value} forcedDefault The the default value for this
         *     preference. Used for internal liberator preferences.
         */
        getPref: function (name, forcedDefault)
        {
            return loadPreference(name, forcedDefault);
        },

        /**
         * Sets the preference <b>name</b> to </b>value</b> but warns the user
         * if the value is changed from its default.
         *
         * @param {string} name The preference name.
         * @param {value} value The new preference value.
         */
        // FIXME: Well it used to. I'm looking at you mst! --djk
        safeSetPref: function (name, value)
        {
            let val = loadPreference(name, null, false);
            let def = loadPreference(name, null, true);
            let lib = loadPreference(SAVED + name);
            if (lib == null && val != def || val != lib)
                liberator.echomsg("Warning: setting preference " + name + ", but it's changed from its default value.");
            storePreference(name, value);
            storePreference(SAVED + name, value);
        },

        /**
         * Sets the preference <b>name</b> to </b>value</b>.
         *
         * @param {string} name The preference name.
         * @param {value} value The new preference value.
         */
        setPref: function (name, value)
        {
            storePreference(name, value);
        },

        /**
         * Resets the preference <b>name</b> to its default value.
         *
         * @param {string} name The preference name.
         */
        resetPref: function (name)
        {
            try
            {
                services.get("pref").clearUserPref(name);
            }
            catch (e)
            {
                // ignore - thrown if not a user set value
            }
        },

        /**
         * Toggles the value of the boolean preference <b>name</b>.
         *
         * @param {string} name The preference name.
         */
        invertPref: function (name)
        {
            if (services.get("pref").getPrefType(name) == Ci.nsIPrefBranch.PREF_BOOL)
                this.setPref(name, !this.getPref(name));
            else
                liberator.echoerr("E488: Trailing characters: " + name + "!");
        },

        /**
         * Pushes a new preference context onto the context stack.
         *
         * @see #withContext
         */
        pushContext: function ()
        {
            prefContexts.push({});
        },

        /**
         * Pops the top preference context from the stack.
         *
         * @see #withContext
         */
        popContext: function ()
        {
            for (let [k, v] in Iterator(prefContexts.pop()))
                storePreference(k, v);
        },

        /**
         * Executes <b>fn</b> with a new preference context. When <b>fn</b>
         * returns, the context is popped and any preferences set via
         * {@link #setPref} or {@link #invertPref} are restored to their
         * previous values.
         *
         * @param {function} fn The function to call.
         * @param {Object} fn The 'this' object with which to call <b>fn</b>
         * @see #pushContext
         * @see #popContext
         */
        withContext: function (fn, self)
        {
            try
            {
                this.pushContext();
                return fn.call(self);
            }
            finally
            {
                this.popContext();
            }
        }
    }; //}}}

    self.prefObserver.register();
    liberator.registerObserver("shutdown", function () {
            self.prefObserver.unregister();
    });

    return self;

}; //}}}

// vim: set fdm=marker sw=4 ts=4 et:
