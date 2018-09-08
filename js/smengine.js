/*
 * SMEngine Library
 * This library allows web apps to run in an ordinary browser and have access
 * to the native javascript API's provided by the silver mobile client
 *
 * Unlike the native clients, SMEngine will pass all pending messages to any message
 * listeners installed at startup time (i.e. in response to the 'silvermobileready'
 * event). On the native clients, only messages sent while the app is active are passed
 * to installed listeners.
 */

if (!navigator.userAgent.match(/(iPad)|(iPhone)|(iPod)|(android)/i))
{
	window.addEventListener('load', createSMEngine);
}

function createSMEngine()
{
	// Only create the SMEngine if we are not running in a mobile client
	if (typeof _smEnvironment == "undefined")
	{
		_smEnvironment = "engine";
		console.log("Using SMEngine for Silver Mobile Javascript API emulation");
		
		// The global SMEngine variable
		smEngine = new SMEngine();
		smEngine.login(smEngineConfig);
		createSMAPIImplementation();
	}
}
		
function SMEngine()
{
	this.adapter = createSMAdapter();
	this.makeUrls = function()
	{
		// Modify these if the URL's change
		this.loginUrl = this.baseURL + "/silver-mobile/auth/signIn";
		this.pollingUrl = this.baseURL + "/smnet/services/update";
		this.interruptUrl = this.baseURL + "/smnet/services/interrupt";
		this.postEventUrl = this.baseURL + "/smnet/services/postEvent";
		this.sendMessageUrl = this.baseURL + "/smnet/services/sendMessage";
		this.messageUpdateUrl = this.baseURL + "/smnet/services/messageUpdate";
	}
	
	// App & user parameters (potentially overridden by the login configuration)
	this.baseURL = "http://localhost:8080";
	this.username = "";
	this.password = "";
	this.appkey = "appkey";
	this.appname = "appname";
	this.eventGroup = "appkey";
	
	// Polling parameters
	this.pollingInterval = 0; // Immediate return is required for accurate event handling
	this.pollingIntervalOnFailure = 10 * 1000; // Give it a minute to settle down
	this.pollingTimeout = 60 * 60 * 1000; // 1 hour
	this.maxPollingFailures = 3;
	
	// State variables
	this.lastOid = 0;
	this.eventPredicate = "";
	this.pollingTaskId = null;
	this.pollingFailures = 0;
	this.messageManager = new SMEventManager("message");
	this.eventManager = new SMEventManager("event");
	this.errorHandler = null;
	this.messages = [];
	
	this.login = function(config)
	{
		if (typeof config != "undefined")
		{
			if (config.baseURL)
			{
				this.baseURL = config.baseURL;
			}
			if (config.username)
			{
				this.username = config.username;
			}
			if (config.password)
			{
				this.password = config.password;
			}
			if (config.appkey)
			{
				this.appkey = config.appkey;
				this.appname = config.appkey;
				this.eventGroup = config.appkey;
			}
			if (config.appname)
			{
				this.appname = config.appname;
			}
			if (config.eventGroup)
			{
				this.eventGroup = config.eventGroup;
			}
		}
		this.makeUrls();
		debug("Login: " + this.loginUrl + " as " +this.username + "/" + this.password);
		loginRequest = { username: this.username, password: this.password, json: true };
		this.adapter.login(loginRequest);
	}
	
	this.loginSucceeded = function(jsonResponse)
	{
		if (jsonResponse.success)
		{
			debug("Logged in to Silver Mobile");
			var _smReadyEvent = document.createEvent("Event");
			_smReadyEvent.initEvent("silvermobileready", true, true);
			document.dispatchEvent(_smReadyEvent);
			this.fetchUpdate();
		}
		else
		{
			alert("Unable to login to Silver Mobile: " + jsonResponse.error);
		}
	}
	
	this.fetchUpdate = function()
	{
		var updateRequest = { appkey:this.appkey, sinceOid:this.lastOid, sqlPredicate:this.eventPredicate };
		debug("Waiting for update from " + this.pollingUrl + " request=" + JSON.stringify(updateRequest));
		this.adapter.fetchUpdate(updateRequest);
	}
	
	this.updateFailed = function(reason)
	{
		this.pollingFailures++;
		debug("Update request failed #" + this.pollingFailures + ": " + reason);
		// Let's go ahead and repost
		if (this.pollingFailures < this.maxPollingFailures)
		{
			smEngine.scheduleNextUpdate(this.pollingIntervalOnFailure);
		}
		else
		{
			alert("Failure requesting updates from the server after " + this.pollingFailures + " attempts: stopping update loop (" + reason + ")");
		}
	}
	
	this.processUpdate = function(update)
	{
		if (update)
		{
			if (update.success)
			{
				if (!update.events)
				{
					debug("Malformed update: no events field");
				}
				else if (update.events.length == undefined)
				{
					debug("Malformed update: events is not an array");
				}
				else if (!update.messages)
				{
					debug("Malformed update: no messages field");
				}
				else if (update.messages.length == undefined)
				{
					debug("Malformed update: messages is not an array");
				}
				else
				{
					debug("Processing " + update.events.length + " events and " + update.messages.length + " messages");
					for (var i = 0; i < update.events.length; i++)
					{
						evt = update.events[i];
						if (evt && evt.oid)
						{
							if (evt.oid > this.lastOid)
							{
								this.lastOid = evt.oid;
							}
							if (evt.appkey == smEngine.appkey)
							{
								this.eventManager.processEvent(evt);
							}
						}
					}
					for (var i = 0; i < update.messages.length; i++)
					{
						msg = update.messages[i];
						if (msg && msg.oid)
						{
							if (msg.oid > this.lastOid)
							{
								this.lastOid = msg.oid;
							}
							if (msg.appkey == smEngine.appkey)
							{
								this.messages.push(msg);
								this.messageManager.processEvent(msg);
							}
						}
					}
				}
				this.scheduleNextUpdate(this.pollingInterval);
			}
			else
			{
				alert("Server rejected update request. Stopping update loop. Error=" + update.error);
			}
		}
		else
		{
			// This is probably caused by a timeout or somthing similar, so try again
			this.scheduleNextUpdate(this.pollingInterval);
		}
	}
	
	this.scheduleNextUpdate = function(interval)
	{
		this.pollingTaskId = window.setTimeout(this.fetchUpdateRedirector, interval);
	}
	
	this.fetchUpdateRedirector = function()
	{
		// Make sure that fetchUpdate() runs in the context of smEngine
		smEngine.fetchUpdate();
	}
	
	this.setEventCriteria = function(newPredicate)
	{
		if (this.eventPredicate != newPredicate)
		{
			if (newPredicate != null)
			{
				this.eventPredicate = newPredicate;
			}
			else
			{
				this.eventPredicate = "";
			}
			this.interruptRequest();
		}
	}
	
	this.interruptRequest = function()
	{
		this.adapter.postInterruptRequest();
	}
	
	this.onError = function(error)
	{
		if (errorHandler)
		{
			errorHandler(error);
		}
	}
}

// The Event Manager class is used to process both messages & events		
function SMEventManager(typeName)
{
	this.callbacks = new Array();
	this.typeName = typeName;
	
	this.addCallback = function(callback)
	{
		debug("Adding " + typeName + " callback " + callback);
		this.callbacks.push(eval(callback));
		// If it's the first callback interrupt so we start listening for events
		if (this.callbacks.length == 1)
		{
			smEngine.interruptRequest();
		}
	}
	
	this.setCallback = function(callback)
	{
		callbacks = new Array();
		this.addCallback(callback);
	}
	
	this.processEvent = function(evt)
	{
		debug(JSON.stringify(evt));
		for (var i = 0; i < this.callbacks.length; i++)
		{
			var callback = this.callbacks[i];
			callback(evt);
		}
	}
}
		
function debug(message)
{
	if (console != undefined)
	{
		console.log(message);
	}
}

function invokeCallback(argument)
{
	cb = argument.callback + '(' + JSON.stringify(argument) + ')';
	eval(cb);
}

// Silver Mobile JavaScript API implementation
function createSMAPIImplementation()
{
	SMApplication =
	{
		appkey : smEngine.appkey,
		appname : smEngine.appname,
		eventGroup : smEngine.eventGroup,
		username : smEngine.username,
		serverURL : smEngine.baseURL + "/silver-mobile",
		platform : "browser",
		
		registerErrorHandler : function(errorHandler)
		{
			smEngine.errorHandler = eval(errorHandler);
		},
		showMessageListView : function()
		{
			alert('SMApplication.showMessageListView()');
		},
		unreadMessageCount : function(argument)
		{
			var messages = smEngine.messages.filter(function(message, index, array) {
				return message.read != isRead;
			});
			argument.count = messages.length;
			invokeCallback(argument);
		},
		log : function(argument)
		{
			console.log(argument);
		}
	};
		
	SMCamera =
	{
		getPicture : function(argument)
		{
			alert('SMCamera.getPicture(' + JSON.stringify(argument) + ')');
			invokeCallback(argument);
		}
	};
		
	SMContacts =
	{
		pickContact : function(argument)
		{
			alert('SMContacts.pickContact(' + JSON.stringify(argument) + ')');
			invokeCallback(argument);
		},
		search : function(argument)
		{
			alert('SMContacts.search(' + JSON.stringify(argument) + ')');
			invokeCallback(argument);
		},
		searchByName : function(argument)
		{
			alert('SMContacts.searchByName(' + JSON.stringify(argument) + ')');
			invokeCallback(argument);
		}
	};
	
	SMEvents =
	{
		addEventListener : function(callback)
		{
			smEngine.eventManager.addCallback(callback);
		},
		setEventCriteria : function(criteria)
		{
			smEngine.setEventCriteria(criteria);
		},
		post : function(argument)
		{
			var appkey = smEngine.appkey;
			if (typeof argument.appkey == "string")
			{
				appkey = argument.appkey;
			}
			var postData = { appkey:appkey };
			if (typeof argument.bodies == "object")
			{
				postData.bodies = argument.bodies;
			}
			else
			{
				postData.body = argument.body;
			}
			smEngine.adapter.postAjaxRequest(smEngine.postEventUrl, postData);
		}
	};
	
	SMGeolocation =
	{
		getLocation : function(argument)
		{
			if (navigator.geolocation)
			{
				this._getLocationArguments = argument;
				navigator.geolocation.getCurrentPosition(SMGeolocation._getLocationSuccess);
			}
			else
			{
				alert('Geolocation is not supported on this browser');
			}
		},
		trackLocation : function(argument)
		{
			if (navigator.geolocation)
			{
				this._trackLocationArguments = argument;
				if (typeof argument.targetapp == "undefined")
				{
					this._trackLocationArguments.targetapp = smEngine.appkey;
				}
				this._trackId = navigator.geolocation.watchPosition(SMGeolocation._trackLocationSuccess);
			}
			else
			{
				alert('Geolocation is not supported on this browser');
			}
		},
		stopTracking : function()
		{
			if (typeof this._trackId == "number")
			{
				navigator.geolocation.clearWatch(this._trackId);
				this._trackId = null;
			}
		},
		
		_getLocationSuccess : function(position)
		{
			SMGeolocation._getLocationArguments.position = position;
			invokeCallback(SMGeolocation._getLocationArguments);
		},
		_trackLocationSuccess : function(position)
		{
			var args = SMGeolocation._trackLocationArguments;
			var evt = ((typeof args.eventprototype == "object") ? args.eventprototype : {});
			evt.sourceapp = smEngine.appkey;
			evt.username = smEngine.username;
			evt.position = position;
			var postArgs = { body : evt };
			if (typeof args.targetapp == "string")
			{
				postArgs.appkey = args.targetapp;
			}
			SMEvents.post(postArgs);
		}
	}
	
	SMFile =
	{
		upload : function(argument)
		{
			alert('SMFile.upload(' + JSON.stringify(argument) + ')');
			invokeCallback(argument);
		}
	}
	
	SMMedia =
	{
		getUserMedia : function(argument)
		{
			alert('SMMedia.getUserMedia(' + JSON.stringify(argument) + ')');
			invokeCallback(argument);
		}
	}
	
	SMMessaging =
	{
		getMessages : function(argument)
		{
			if (typeof argument.messageID == "number")
			{
				argument.messages = smEngine.messages.filter(function(message, index, array) {
					return message.oid == argument.messageID;
				});
			}
			else if (typeof argument.index == "number")
			{
				if (argument.index < smEngine.messages.length)
				{
					argument.messages = [ smEngine.messages[argument.index] ];
				}
				else
				{
					argument.messages = [];
				}
			}
			else if (typeof argument.read == "boolean")
			{
				argument.messages = smEngine.messages.filter(function(message, index, array) {
					return message.read == argument.read;
				});
			}
			else
			{
				argument.messages = smEngine.messages;
			}
			invokeCallback(argument);
		},
		markRead : function(messageID)
		{
			this._markMessageRead(messageID, true);
		},
		markUnread : function(messageID)
		{
			this._markMessageRead(messageID, false);
		},
		addMessageListener : function(callback)
		{
			smEngine.messageManager.addCallback(callback);
		},
		send : function(argument)
		{
			var appkey = smEngine.appkey;
			if (typeof argument.appkey == "string")
			{
				appkey = argument.appkey;
			}
			var postData = {
				username : argument.username,
				appkey : appkey,
				subject : argument.subject,
				body : argument.body,
				data : argument.data };
			smEngine.adapter.postAjaxRequest(smEngine.sendMessageUrl, postData);
		},
		
		_markMessageRead : function(messageID, isRead)
		{
			var messages = smEngine.messages.filter(function(message, index, array) {
				return message.oid == messageID && message.read != isRead;
			});
			if (messages.length > 0)
			{
				var message = messages[0];
				message.read = isRead;
				var data = { id : message.oid, type : (isRead ? "read" : "unread") };
				smEngine.adapter.postAjaxRequest(smEngine.messageUpdateUrl, data);
			}
		}
	};
	
	SMNotification =
	{
		notify : function(argument)
		{
			if (typeof argument == "object")
			{
				alert('SMNotification.notify(' + JSON.stringify(argument) + ')');
			}
			else
			{
				alert(argument);
			}
		}
	}
}

function createSMAdapter()
{
	if (typeof Ext != "undefined")
	{
		return new SMAdapter_Sencha();
	}
	else if (typeof jQuery != "undefined")
	{
		return new SMAdapter_JQuery();
	}
	else
	{
		alert("No server connection: unable to determine AJAX transport mechanism.");
		return new SMAdapter_Noop();
	}
}

function SMAdapter_Sencha()
{
	this.login = function(loginRequest)
	{
		Ext.Ajax.request({
			url: smEngine.loginUrl,
			method: "POST",
			params: loginRequest,
			success: this.onLoginSuccess,
			failure: this.onLoginFailure
		});
	}
	
	this.fetchUpdate = function(updateRequest)
	{
		Ext.Ajax.request({
			url: smEngine.pollingUrl,
			method: "POST",
			jsonData: updateRequest,
			timeout: smEngine.pollingTimeout,
			// Response functions
			success: this.onUpdateSuccess,
			failure: this.onUpdateFailure
		});
	}
			
	this.postInterruptRequest = function()
	{
		Ext.Ajax.request({
			url: smEngine.interruptUrl,
			failure: this.ajaxFailure
		});
	}
	
	this.postAjaxRequest = function(url, request)
	{
		Ext.Ajax.request({
			url: url,
			method: "POST",
			jsonData: request,
			// Response functions
			failure: this.ajaxFailure
		});
	}
	
	// Response functions	
	this.onLoginSuccess = function(ajaxResponse, opts)
	{
		try
		{
			var jsonResponse = JSON.parse(ajaxResponse.responseText);
			smEngine.loginSucceeded(jsonResponse);
		}
		catch (err)
		{
			debug("Error parsing login response: " + err + " response="+ ajaxResponse.responseText);
		}
	}
	
	this.onLoginFailure = function(ajaxResponse, opts)
	{
		smEngine.adapter.ajaxFailure(ajaxResponse, opts);
		alert("Error logging in to Silver Mobile server: " + ajaxResponse.status + "/" + ajaxResponse.statusText);
	}
			
	this.onUpdateSuccess = function(ajaxResponse, opts)
	{
		debug("Update request completed normally");
		var update = null;
		try
		{
			update = JSON.parse(ajaxResponse.responseText);
		}
		catch (err)
		{
			debug("Error parsing update: " + err + " response=" + ajaxResponse.responseText);
		}
		smEngine.processUpdate(update);
	}
	
	this.onUpdateFailure = function(ajaxResponse, opts)
	{
		smEngine.adapter.ajaxFailure(ajaxResponse, opts);
		smEngine.updateFailed(ajaxResponse.statusText);
	}
		
	this.ajaxFailure = function(ajaxResponse, opts)
	{
		debug("Ajax failure: URL=" + ajaxResponse.request.options.url + " status=" +
			ajaxResponse.status + "/" + ajaxResponse.statusText + " (" + ajaxResponse.responseText + ")");
	}
}

function SMAdapter_JQuery()
{
	this.login = function(loginRequest)
	{
		jQuery.ajax({
			url: smEngine.loginUrl,
			type: "POST",
			dataType: 'json',
			data: loginRequest,
			success: this.onLoginSuccess,
			error: this.onLoginFailure
		});
	}
	
	this.fetchUpdate = function(updateRequest)
	{
		jQuery.ajax({
			url: smEngine.pollingUrl,
			type: "POST",
			contentType: 'application/json; charset=utf-8',
			dataType: 'json',
			data: JSON.stringify(updateRequest),
			timeout: smEngine.pollingTimeout,
			// Response functions
			success: this.onUpdateSuccess,
			error: this.onUpdateFailure
		});
	}
			
	this.postInterruptRequest = function()
	{
		jQuery.ajax({
			url: smEngine.interruptUrl,
			error: this.ajaxFailure
		});
	}
	
	this.postAjaxRequest = function(url, request)
	{
		jQuery.ajax({
			url: url,
			type: "POST",
			contentType: 'application/json; charset=utf-8',
			data: JSON.stringify(request),
			// Response functions
			error: this.ajaxFailure
		});
	}
	
	this.onLoginSuccess = function(data)
	{
		smEngine.loginSucceeded(data)
	}
	
	this.onLoginFailure = function(jqXHR, textStatus, errorThrown)
	{
		smEngine.adapter.ajaxFailure(jqXHR, textStatus, errorThrown);
		alert("Error logging in to Silver Mobile server: " + textStatus + "/" + errorThrown);
	}
	
	this.onUpdateSuccess = function(data)
	{
		smEngine.processUpdate(data);
	}
	
	this.onUpdateFailure = function(jqXHR, textStatus, errorThrown)
	{
		smEngine.adapter.ajaxFailure(jqXHR, textStatus, errorThrown);
		smEngine.updateFailed(errorThrown);
	}
			
	this.ajaxFailure = function(jqXHR, textStatus, errorThrown)
	{
		debug("Ajax failure: status=" + jqXHR.status + "/" + jqXHR.statusText + " - " +
			textStatus + "/" + errorThrown);
	}
}

function SMAdapter_Noop()
{
	this.login = function(loginRequest)
	{
		smEngine.loginSucceeded({ success : true });
	}
	
	this.fetchUpdate = function(updateRequest)
	{
	}
			
	this.postInterruptRequest = function()
	{
	}
	
	this.postAjaxRequest = function(url, request)
	{
	}
}