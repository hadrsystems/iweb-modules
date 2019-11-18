/*
 * Copyright (c) 2008-2016, Massachusetts Institute of Technology (MIT)
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 * list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation
 * and/or other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its contributors
 * may be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
define(["ext", "jquery", "atmosphere", "./EventManager", "./CookieManager"],
        function(Ext, jQuery, atmosphere, EventManager, CookieManager) {
    "use strict";
 
    var _DEBUG = false;
    
    var _mediator = null;

    var _CONNECTION_CHECK_INTERVAL = 20000;
    var stopConnectionCheck = false;
 
    var ws = null;
 
    var sessionId = null;
 
    var currentUserSessionId = null;
 
    var SUCCESS = "Success";
 
    var NOT_LOGGED_IN = "not_logged_in";
 
    var message = "/mediator";
 
    var messageQueue = [];
 
    var topics = []; //maintain a list of topics for reinitialization
 
    var initiated = false;
 
    var socketConnected = false;
 
    var cookies = []; //List of cookies to be added to a request/post. Defined in the core.properties file

    var ls = window.localStorage;

    var lsArray = [];
 
    function Mediator() {}
    function Logger() {}
    var logger = new Logger();
 
    function init(initTopics) {
 
        _mediator = new Mediator();
 
        var socket = atmosphere;
 
        var request = {
            url: 'mediator',
            contentType : "application/json",
            logLevel : 'debug',
            transport : 'websocket' ,
            trackMessageLength : true,
            reconnectInterval : 5000,
            fallbackTransport: 'websocket',
            maxReconnectOnClose : 17280, //24 hours -- whatever the token expiration is...
            closeAsync: true,//synchronous close call locks IE on connection drop
        };
 
        request.onOpen = function(){
            socketConnected = true;
            if(!initiated){
                initiated = true;
                if(initTopics){
                    _mediator.subscribe(initTopics);
                }
                //Load the config once the websocket is established
                logger.log(" Mediator onOpen initiated setting socketConnected " + socketConnected);
                _mediator.sendMessage({ type: "config" });
            }else{
                logger.log(" Mediator onOpen reconnection setting socketConnected " + socketConnected);
                _mediator.onReconnect();
            }
        };
 
        request.onError = function(error){
            logger.log(" Mediator onError called ");
 //          if (error.hasOwnProperty('messages') && (error.messages.length > 0)) {
 //               logger.log(" Mediator onError message being cached");
 //               messageQueue.push(message);
 //           }

        };
 
        request.onClose = function(error){
            socketConnected = false;
            logger.log(" Mediator onClose called  setting socketConnected " + socketConnected);
            if (typeof error.messageCode == 'undefined' || error.messageCode != 1000) {
                logger.log(" Mediator signalling disconnect...");
                _mediator.onDisconnect();
            } else {
        		_mediator.doesConnectionExist();
            }
         };
 
        //Adding handler for onClientTimeout to fix 10/1/2019 field test issue
        request.onClientTimeout = function(message){
            messageQueue.push(message);
            logger.log(" Mediator onClientTimeout Will initiate reconnection after reconnectionInterval...");
    		setTimeout(function(){
      			 ws = socket.subscribe(request);
    		}, request.reconnectInterval);
         };
 
        request.onReconnect = function(){
        	logger.log(" Mediator onReconnect called with socketConnected " + socketConnected);
            var onReconnect = 'reconnect';
            _mediator.onReconnect();
        };
 
        request.onReopen = function(){
            //var onReopen = 'reconnect';
            socketConnected = true;
            logger.log(" Mediator onReopen called  setting socketConnected " + socketConnected);
            _mediator.onReopen();
        };
 
        var onResponse = function(response) {
            var responseBody = response.responseBody; //JSON string
            var message = atmosphere.util.parseJSON(responseBody);
            if (message.data != null) {//Check to see if there is data
                if(message.responseType == "json"){
                    try{
                        message.data = JSON.parse(message.data);
                    }catch(e){} //JS Logging?
                }
                if (message.eventName.startsWith('iweb.NICS.collabroom.') &&
                		message.eventName.endsWith('.chat')) {
                    try{
            			logger.log((new Date()).toLocaleString() 
            					+ " Mediator onResponse event " + message.eventName 
            					+ " with data: " + JSON.stringify(message.data));
                    }catch(e){} //JS Logging?
                	
                }
                EventManager.fireEvent(message.eventName, message.data);
            }else if(message.errorMessage){
                Ext.MessageBox.alert('Error', message.errorMessage);
            }
        };
 
        request.onMessage = onResponse;
        request.onMessagePublished = onResponse;
 
        ws = socket.subscribe(request);
        
        function connectionCheck()
        {
    		_mediator.doesConnectionExist();
    		if (!stopConnectionCheck)
    			window.setTimeout(connectionCheck, _CONNECTION_CHECK_INTERVAL);
        }
		window.setTimeout(connectionCheck, _CONNECTION_CHECK_INTERVAL);

		// Update the online status icon based on connectivity
        window.addEventListener('online',  
        		function() { 
					stopConnectionCheck = true;
        			logger.logAlways(" Mediator windows event signalling connection alive... ");
        			EventManager.fireEvent("iweb.connection.reconnected", (new Date()).getTime()); 
        			});
        window.addEventListener('offline', 
        		function() { 
					stopConnectionCheck = true;
			  		logger.logAlways(" Mediator windows event signalling connection lost... ");
			  		socketConnected = false;
 			  		_mediator.onDisconnect();
        			});
    };
 
    Logger.prototype.log = function (msg) {
    	if (_DEBUG) { console.log((new Date()).toLocaleString() + msg); }
    }
    Logger.prototype.logAlways = function (msg) {
    	console.log((new Date()).toLocaleString() + msg);
    }
    
    // synchrnous call to check if connection exists
    Mediator.prototype.doesConnectionExist = function () {
        var xhr = new XMLHttpRequest();
        
        var file = "login/images/scout_logo.png";
        var randomNum = Math.round(Math.random() * 10000);
     
        xhr.timeout = 2000; // time in milliseconds
        xhr.open('HEAD', file + "?rand=" + randomNum, true);
        xhr.send();
         
        xhr.addEventListener("readystatechange", processRequest, false);
        function processRequest(e) {
          if (xhr.readyState == 4) {
            if (xhr.status >= 200 && xhr.status < 304) {
              //alert("connection exists!");
    	      EventManager.fireEvent("iweb.connection.reconnected");
			  logger.logAlways(" Mediator doesConnectionExist determined connection alive... ");
            } else {
              //alert("connection doesn't exist!");
              logger.logAlways(" Mediator doesConnectionExist determined connection lost... ");
		  	  socketConnected = false;
  	          EventManager.fireEvent("iweb.connection.disconnected");
            }
          }
        }
    }
    
    Mediator.prototype.onReconnect = function(){
    	logger.log(" Mediator onReconnect prototype called with  socketConnected " + socketConnected); 
    }
    
    Mediator.prototype.onReopen = function(){
        logger.log(" Mediator onReopen prototype called with  socketConnected " + socketConnected);
        if(socketConnected){
            //check messageQueue has all the message from localStorage
        	logger.log('Before find Delta:: messageQueue:: length is::'+ messageQueue.length + JSON.stringify(messageQueue));
            ls.setItem('mqData',JSON.stringify(messageQueue)); // debugging purpose removed after testing
            var deltaCache = this.findDelta(JSON.parse(ls.getItem('lsData')), messageQueue);
        	logger.log('deltaCache::' + JSON.stringify(deltaCache));
            messageQueue.push.apply(messageQueue,deltaCache);           
            this.clearLocalStorage();//clear local storage after delta is added to the offline cache
            logger.log('** Cleared local storage after adding delta **');
            
            var completed = true;
            
			for(var i=0; i<messageQueue.length; i++){
				logger.log(" Mediator processing message from cache "+JSON.stringify(messageQueue[i]));
				//Connection was lost again
				if(!this.sendMessage(messageQueue[i])){
					logger.log(" Mediator sopped processing message from cache "+JSON.stringify(messageQueue[i]));
					completed = false;
					break;
				}
			}
			if(completed){
				logger.log(" Mediator emptying cache ");
				messageQueue = []; //reset
			}else{
				logger.log(" Mediator splicing cache ");
				messageQueue.splice(0,i); //remove successfully sent messages
			}
 
            for(var j=0; j<topics.length; j++){
                this.subscribe(topics[j]);
            }
            //Fire reconnect event
            logger.log(" Mediator firing reconnect event ");          
            EventManager.fireEvent("iweb.connection.reconnected", (new Date()).getTime()); 
        }
    };

    Mediator.prototype.clearLocalStorage = function () {
        lsArray = [];
        ls.clear(); 
    }    

    Mediator.prototype.findDelta = function (lstg, mq)  {      
        var delta = [];
        var mapLstg = this.convertArrayToMap(lstg);
        logger.log('converted local storage map::mapLstg:: length:'+ Object.keys(mapLstg).length +':::' + JSON.stringify(mapLstg));
        var mapMq = this.convertArrayToMap(mq); 
        logger.log('converted messageQueue map::mapMq:: length:' + Object.keys(mapLstg).length+':::' + JSON.stringify(mapMq));

        for (var id in mapLstg) {
            if (!mapMq.hasOwnProperty(id)) {
                logger.log('Found one delta with id:' + id +' and value:'+mapLstg[id]);
                delta.push(mapLstg[id]);
            } 
        }  
        return delta;
    }

    Mediator.prototype.convertArrayToMap = function (array) {
        var map = {};
        if (array != null) {
            for (var i=0; i < array.length; i++) {
                if(array[i].type == 'post' || array[i].type == 'put'){
                   //var parsedKey = JSON.parse(array[i].payload).seqtime ?  JSON.parse(array[i].payload).seqtime : JSON.parse(array[i].payload).seqnum;
                   if(JSON.parse(array[i].payload).seqtime != null){//only markers are allowed
                    parsedKey = JSON.parse(array[i].payload).seqtime;
                    console.log('parsedKey::' + parsedKey);
                    map[ parsedKey] = array[i];  
                }                              
             }else{
               //msg's with no payload 
             }                    
                    
           }
        }
        return map;
    }
 
    Mediator.prototype.onDisconnect = function(){
        EventManager.fireEvent("iweb.connection.disconnected");
    };
 
    Mediator.prototype.close = function(){
    	logger.log(" Mediator close prototype called and inturn unsubscribe");
        atmosphere.unsubscribe();
    };
 
    //Set rest api
    Mediator.prototype.setRestAPI = function(url) {
        this.restApiUrl = url;
    };
 
    //Return configured rest api url
    Mediator.prototype.getRestAPI = function() {
        return this.restApiUrl;
    };
 
    //Send Message on Rabbit Bus
    Mediator.prototype.sendMessage = function(message) {
    	var chatidOfMessage = undefined;
    	if (message.eventName != undefined) {
    		if ((message.eventName.indexOf('feature.') >= 0) || (message.eventName.indexOf('chat') >= 0)) {
                logger.logAlways(" Mediator sendMessage " + JSON.stringify(message) + " with  socketConnected " + socketConnected);
            	if (message.payload != undefined) {
            		var payload = JSON.parse(message.payload);
                    if (payload.chatid == undefined) {
                        this.cacheMessage(message);
                    } else {
                    	chatidOfMessage = payload.chatid;
                    }
            	}
    		}
    	}
        if (socketConnected) {
            logger.log(" Mediator message " + JSON.stringify(message) + " is on the wire");
            ws.push(JSON.stringify(message));
             // clear array as msg's pushed to websocket
            lsArray = [];
            logger.log('<-- Cleared lsArray after ws.push -->');
            return true;
        }else{
        	if (message.payload != undefined) {
                logger.log(" Mediator message payload " + message.payload );
                if (chatidOfMessage == undefined) {
                	logger.log(" Mediator non-chat message " + JSON.stringify(message) + " added to cache");
                    messageQueue.push(message);
                } else {
                	logger.log(" Mediator chat message " + JSON.stringify(message) + " search on cache");
                    var index = messageQueue.findIndex( 
                    					function(mqElement) { return JSON.parse(mqElement.payload).chatid == chatidOfMessage});
                    if (index != -1) {
                    	logger.log(" Mediator chat message " + JSON.stringify(message) + " in cache, removing");
                        var removedItem = messageQueue.splice(index, 1);
                    }
                    logger.log(" Mediator chat message " + JSON.stringify(message) + " added to cache");
                    messageQueue.push(message);
                }
        	}
        }
        return false;
    };

    Mediator.prototype.cacheMessage = function(message){
        lsArray.push(message);
        ls.setItem('lsData',JSON.stringify(lsArray));
        logger.log('localStorage::' + ls.getItem('lsData'));
    }
 
    Mediator.prototype.publishMessage = function(topic, message){
        msg = {
            type: "publish",
            message: JSON.stringify(message),
            topic: topic
        };
//        this.cacheMessage(msg);
        this.sendMessage(msg);
        
    };
 
    //Subscribe to Message Bus
    Mediator.prototype.subscribe = function(topic) {
        if(jQuery.inArray(topic, topics) == -1) { topics.push(topic); }
        msg = { type: "subscribe", topic: topic };
//        this.cacheMessage(msg);
        this.sendMessage(msg);
    };
 
    //Unsubscribe from Message Bus
    Mediator.prototype.unsubscribe = function(topic) {
        var index = jQuery.inArray(topic, topics);
        if(index != -1){ topics.splice(index,1); }
        msg = { type: "unsubscribe", topic: topic };
//        this.cacheMessage(msg);
        this.sendMessage(msg);
    };
 
    // Send delete message to the rest api
    Mediator.prototype.sendDeleteMessage = function(url, eventName, responseType) {
        if(!responseType){
            responseType = 'json';
        }
    	logger.log(
        		' Mediator Attempting to DELETE message to ' + url +
        		' event ' + eventName 
                );
        msg = {
            type: 'delete',
            url: url,
            eventName: eventName,
            responseType: responseType,
            cookieKeys: CookieManager.getCookies(url)
        };
//        this.cacheMessage(msg);
        this.sendMessage(msg);                 
    };
 
    // Send post message to the rest api
    Mediator.prototype.sendPostMessage = function(url, eventName, payload, responseType) {
        if(!responseType){
            responseType = 'json';
        }
    	logger.log(
        		' Mediator Attempting to POST message to ' + url +
        		' event ' + eventName +
                ' with payload:' + JSON.stringify(payload)
                );
        msg = {
            type: 'post',
            url: url,
            eventName: eventName,
            payload: JSON.stringify(payload),
            responseType: responseType,
            cookieKeys: CookieManager.getCookies(url)
        };
//        this.cacheMessage(msg);
        this.sendMessage(msg);        
    };
 
     // Send post message to the rest api
    Mediator.prototype.sendPutMessage = function(url, eventName, payload, responseType) {
        if(!responseType){
            responseType = 'json';
        }
    	logger.log(
        		' Mediator Attempting to PUT message to ' + url +
        		' event ' + eventName +
        		' with payload:' + JSON.stringify(payload)
                );
        msg = {
            type: 'put',
            url: url,
            eventName: eventName,
            payload: JSON.stringify(payload),
            responseType: responseType,
            cookieKeys: CookieManager.getCookies(url)
        };
//       this.cacheMessage(msg);
        this.sendMessage(msg);
    };
 
    //Send request message to rest api
    Mediator.prototype.sendRequestMessage = function(url, eventName, responseType){
        if(!responseType){
            responseType = 'json';
        }
    	logger.log(
        		' Mediator Attempting to sendRequestMessage to ' + url +
        		' event ' + eventName 
                );
        msg = {
            type: "request",
            url: url,
            eventName: eventName,
            responseType: responseType,
            cookieKeys: CookieManager.getCookies(url)
        };
//        this.cacheMessage(msg);
        this.sendMessage(msg);        
    };
 
    Mediator.prototype.setSessionId = function(id){
        sessionId = id;
    };
 
    Mediator.prototype.getSessionId = function(){
        return sessionId;
    };
 
    Mediator.prototype.setReinitalizeUrl = function(url){
        ws.request.url = url;
    };
 
    Mediator.prototype.setCookies = function(url, cookies){
        CookieManager.addCookies(url, cookies);
    };
 
    /*** NEED TO MOVE THIS OUT ***/
    Mediator.prototype.setCurrentUserSessionId = function(id){
        currentUserSessionId = id;
    };
 
    Mediator.prototype.getCurrentUserSessionId = function(){
        return currentUserSessionId;
    };
    /****************************/
 
    return {
        initialize: function(initTopics, callback) {
            init(initTopics, callback);
        },
 
        getInstance: function() {
            if (_mediator) {
                return _mediator;
            }
            //throw not initialized exception
        }
    };
});