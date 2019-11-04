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
 
    var _mediator = null;
    var _interval = null;
 
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

    var cacheMap = new Map();

    var lsArray = [];
 
    function Mediator() {}
 
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
                console.log((new Date()).toLocaleString() + " Mediator onOpen initiated setting socketConnected " + socketConnected);
                _mediator.sendMessage({ type: "config" });
            }else{
                console.log((new Date()).toLocaleString() + " Mediator onOpen reconnection setting socketConnected " + socketConnected);
                _mediator.onReconnect();
            }
        };
 
        request.onError = function(error){
            console.log((new Date()).toLocaleString() + " Mediator onError called ");
 //          if (error.hasOwnProperty('messages') && (error.messages.length > 0)) {
 //               console.log((new Date()).toLocaleString() + " Mediator onError message being cached");
 //               messageQueue.push(message);
 //           }

        };
 
        request.onClose = function(error){
            socketConnected = false;
            console.log((new Date()).toLocaleString() + " Mediator onClose called  setting socketConnected " + socketConnected);
            if (typeof error.messageCode == 'undefined' || error.messageCode != 1000) {
                console.log((new Date()).toLocaleString() + " Mediator signalling disconnect...");
                _mediator.onDisconnect();
            } else {
        		_mediator.doesConnectionExist();
            }
         };
 
        //Adding handler for onClientTimeout to fix 10/1/2019 field test issue
        request.onClientTimeout = function(message){
            console.log((new Date()).toLocaleString() + " Mediator onClientTimeout called ");
            messageQueue.push(message);
            console.log((new Date()).toLocaleString() + " Mediator Will initiate reconnection after reconnectionInterval...");
    		setTimeout(function(){
      			 ws = socket.subscribe(request);
    		}, request.reconnectInterval);
         };
 
        request.onReconnect = function(){
            console.log((new Date()).toLocaleString() + " Mediator onReconnect called with socketConnected " + socketConnected);
            var onReconnect = 'reconnect';
            _mediator.onReconnect();
        };
 
        request.onReopen = function(){
            //var onReopen = 'reconnect';
            socketConnected = true;
            console.log((new Date()).toLocaleString() + " Mediator onReopen called  setting socketConnected " + socketConnected);
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
                EventManager.fireEvent(message.eventName, message.data);
            }else if(message.errorMessage){
                Ext.MessageBox.alert('Error', message.errorMessage);
            }
        };
 
        request.onMessage = onResponse;
        request.onMessagePublished = onResponse;
 
        ws = socket.subscribe(request);
        _interval = window.setInterval(
        	function() {
        		_mediator.doesConnectionExist();
        	}, 30000);
        // Update the online status icon based on connectivity
        window.addEventListener('online',  
        		function() { 
        			console.log((new Date()).toLocaleString() + " Mediator windows event signalling connection alive... ");
        			//EventManager.fireEvent("iweb.connection.reconnected", (new Date()).getTime()); 
        			});
        window.addEventListener('offline', 
        		function() { 
			  		console.log((new Date()).toLocaleString() + " Mediator windows event signalling connection lost... ");
        			//EventManager.fireEvent("iweb.connection.disconnected"); 
			  		_mediator.onDisconnect();
        			});
    };
 
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
			  console.log((new Date()).toLocaleString() + " Mediator doesConnectionExist determined connection alive... ");
            } else {
              //alert("connection doesn't exist!");
  			  console.log((new Date()).toLocaleString() + " Mediator doesConnectionExist determined connection lost... ");
  	          EventManager.fireEvent("iweb.connection.disconnected");
            }
          }
        }
    }
    
    Mediator.prototype.onReconnect = function(){
        console.log((new Date()).toLocaleString() + " Mediator onReconnect prototype called with  socketConnected " + socketConnected);
    }
    
    Mediator.prototype.onReopen = function(){
        console.log((new Date()).toLocaleString() + " Mediator onReopen prototype called with  socketConnected " + socketConnected);
        if(socketConnected){
            console.log((new Date()).toLocaleString() + " Mediator firing reconnect event ");            
            //check messageQueue has all the message from localStorage
            console.log('Before find Delta:: messageQueue:: length is::'+ messageQueue.length + JSON.stringify(messageQueue))
            ls.setItem('mqData',JSON.stringify(messageQueue)); // debugging purpose removed after testing
            var deltaCache = this.findDelta(JSON.parse(ls.getItem('lsData')), messageQueue);
            console.log('deltaCache::' + JSON.stringify(deltaCache));
            messageQueue.push.apply(messageQueue,deltaCache);           
            this.clearLocalStorage();//clear local storage after delta is added to the offline cache
            console.log('** Cleared local storage after adding delta **');
            //Fire reconnect event
            EventManager.fireEvent("iweb.connection.reconnected", (new Date()).getTime()); 
            var completed = true;
            
			for(var i=0; i<messageQueue.length; i++){
				console.log((new Date()).toLocaleString() + " Pushing message in the cache "+JSON.stringify(messageQueue[i]));
				//Connection was lost again
				if(!this.sendMessage(messageQueue[i])){
					console.log((new Date()).toLocaleString() + " Stopped Pushing message in the cache "+JSON.stringify(messageQueue[i]));
					completed = false;
					break;
				}
			}
			if(completed){
				console.log((new Date()).toLocaleString() + " Emptying cache ");
				messageQueue = []; //reset
			}else{
				console.log((new Date()).toLocaleString() + " Splicing cache ");
				messageQueue.splice(0,i); //remove successfully sent messages
			}
 
            for(var j=0; j<topics.length; j++){
                this.subscribe(topics[j]);
            }
        }
    };

    Mediator.prototype.clearLocalStorage = function () {
        lsArray = [];
        ls.clear(); 
    }    

    Mediator.prototype.findDelta = function (lstg, mq)  {      
        var delta = [];
        var mapLstg = this.convertArrayToMap(lstg);
        console.log('converted local storage map::mapLstg:: length:'+ Object.keys(mapLstg).length +':::' + JSON.stringify(mapLstg));
        var mapMq = this.convertArrayToMap(mq); 
        console.log('converted messageQueuq map::mapMq:: length:' + Object.keys(mapLstg).length+':::' + JSON.stringify(mapMq));

        for (var id in mapLstg) {
            if (!mapMq.hasOwnProperty(id)) {
                console.log('Found one delta with id:' + id +' and value:'+mapLstg[id]);
                delta.push(mapLstg[id]);
            } 
        }  
        return delta;
    }

    Mediator.prototype.convertArrayToMap = function (array) {
        var map = {};
        for (var i=0; i < array.length; i++) {
             if(array[i].type == 'post' || array[i].type == 'put'){
                var parsedKey = JSON.parse(array[i].payload).seqtime ?  JSON.parse(array[i].payload).seqtime : JSON.parse(array[i].payload).seqnum;
                console.log('parsedKey::' + parsedKey);
                map[ parsedKey] = array[i];                
             }else{
               //msg's with no payload 
             }             
                 
        }
        return map;
    }
 
    Mediator.prototype.onDisconnect = function(){
        EventManager.fireEvent("iweb.connection.disconnected");
    };
 
    Mediator.prototype.close = function(){
        console.log((new Date()).toLocaleString() + " Mediator close prototype called and inturn unsubscribe");
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
        console.log((new Date()).toLocaleString() + " Mediator sendMessage " + JSON.stringify(message) + " with  socketConnected " + socketConnected);
        if(socketConnected){
            console.log((new Date()).toLocaleString() + " Mediator message " + JSON.stringify(message) + " is on the wire");
            ws.push(JSON.stringify(message));
             // clear array as msg's pushed to websocket
            lsArray = [];
            console.log('<-- Cleared lsArray after ws.push -->');
            return true;
        }else{
        	if (message.payload != undefined) {
        		var payload = JSON.parse(message.payload);
                console.log((new Date()).toLocaleString() + " Mediator message payload " + JSON.stringify(payload) );
                if (payload.chatid == undefined) {
                    console.log((new Date()).toLocaleString() + " Mediator non-chat message " + JSON.stringify(message) + " added to cache");
                    messageQueue.push(message);
                } else {
                    console.log((new Date()).toLocaleString() + " Mediator chat message " + JSON.stringify(message) + " search on cache");
                    var element = messageQueue.find( 
                    					function(mqElement) { return JSON.parse(mqElement.payload).chatid == payload.chatid});
                    if (element == undefined) {
                        console.log((new Date()).toLocaleString() + " Mediator chat message " + JSON.stringify(message) + " not in cache, so adding");
                        messageQueue.push(message);
                    }
                }
        	}
        }
        return false;
    };

    Mediator.prototype.cacheMessage = function(message){
        lsArray.push(message);
        ls.setItem('lsData',JSON.stringify(lsArray));
        console.log('localStorage::' + ls.getItem('lsData'));
    }
 
    Mediator.prototype.publishMessage = function(topic, message){
        msg = {
            type: "publish",
            message: JSON.stringify(message),
            topic: topic
        };
        this.cacheMessage(msg);
        this.sendMessage(msg);
        
    };
 
    //Subscribe to Message Bus
    Mediator.prototype.subscribe = function(topic) {
        if(jQuery.inArray(topic, topics) == -1) { topics.push(topic); }
        msg = { type: "subscribe", topic: topic };
        this.cacheMessage(msg);
        this.sendMessage(msg);
    };
 
    //Unsubscribe from Message Bus
    Mediator.prototype.unsubscribe = function(topic) {
        var index = jQuery.inArray(topic, topics);
        if(index != -1){ topics.splice(index,1); }
        msg = { type: "unsubscribe", topic: topic };
        this.cacheMessage(msg);
        this.sendMessage(msg);
    };
 
    // Send delete message to the rest api
    Mediator.prototype.sendDeleteMessage = function(url, eventName, responseType) {
        if(!responseType){
            responseType = 'json';
        }
        console.log((new Date()).toLocaleString() + 
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
        this.cacheMessage(msg);
        this.sendMessage(msg);                 
    };
 
    // Send post message to the rest api
    Mediator.prototype.sendPostMessage = function(url, eventName, payload, responseType) {
        if(!responseType){
            responseType = 'json';
        }
        console.log((new Date()).toLocaleString() + 
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
        this.cacheMessage(msg);
        this.sendMessage(msg);        
    };
 
     // Send post message to the rest api
    Mediator.prototype.sendPutMessage = function(url, eventName, payload, responseType) {
        if(!responseType){
            responseType = 'json';
        }
        console.log((new Date()).toLocaleString() + 
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
        this.cacheMessage(msg);
        this.sendMessage(msg);
    };
 
    //Send request message to rest api
    Mediator.prototype.sendRequestMessage = function(url, eventName, responseType){
        if(!responseType){
            responseType = 'json';
        }
        console.log((new Date()).toLocaleString() + 
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
        this.cacheMessage(msg);
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