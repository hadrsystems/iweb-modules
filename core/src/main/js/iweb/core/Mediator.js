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

    var ws = null;
    
    var sessionId = null;
    
    var currentUserSessionId = null;

    var SUCCESS = "Success";
    
    var NOT_LOGGED_IN = "not_logged_in";

    var message = "/mediator";
    
    var messageQueue = [];
    
    var topics = []; //maintain a list of topics for reinitialization
    
    var initiated = false;
    
    var timeOfDisconnect = null;
    
    var cookies = []; //List of cookies to be added to a request/post. Defined in the core.properties file

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
 	        closeAsync: true //synchronous close call locks IE on connection drop
 	    };
         
		request.onOpen = function(){
			if(!initiated){
				_mediator.setTimeOfDisconnect(null);
				initiated = true;
				if(initTopics){
					_mediator.subscribe(initTopics);
				}
				//Load the config once the websocket is established
				_mediator.sendMessage({ type: "config" });
			}else{
				_mediator.onReconnect();
			}
		};
 	
 		request.onError = function(error){
 			var error = "error";
 		};
 		
 		request.onClose = function(error){
 			_mediator.onDisconnect();
 		};
 		
 		request.onReconnect = function(){
 			var onReconnect = 'reconnect';
 		};
 		
 		request.onReopen = function(){
 			//var onReopen = 'reconnect';
 			_mediator.onReconnect();
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
    };
    
    Mediator.prototype.setTimeOfDisconnect = function(time){
    	timeOfDisconnect = time;
    };
    
    Mediator.prototype.onReconnect = function(){
    	if(timeOfDisconnect != null){
			//Fire reconnect event
			EventManager.fireEvent("iweb.connection.reconnected", timeOfDisconnect);
	    	
			var completed = true;
	    	
	    	this.setTimeOfDisconnect(null);
			
			//Send queued messages
			for(var i=0; i<messageQueue.length; i++){
				//Connection was lost again
				if(!this.sendMessage(messageQueue[i])){
					completed = false;
					break;
				}
			}
			
			if(completed){
				messageQueue = []; //reset
			}else{
				messageQueue.splice(0,i); //remove successfully sent messages
			}
			
			for(var j=0; j<topics.length; j++){
				this.subscribe(topics[j]);
			}
    	}
    };
    
    Mediator.prototype.onDisconnect = function(){
    	this.setTimeOfDisconnect((new Date()).getTime());
    	EventManager.fireEvent("iweb.connection.disconnected");
    };
    
    Mediator.prototype.close = function(){
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
    	if(timeOfDisconnect == null){
    		ws.push(JSON.stringify(message));
    		return true;
		}else{
			messageQueue.push(message);
		}
    	return false;
    };
    
    Mediator.prototype.publishMessage = function(topic, message){
    	this.sendMessage({
			type: "publish",
			message: JSON.stringify(message),
			topic: topic
		});
    };

    //Subscribe to Message Bus
    Mediator.prototype.subscribe = function(topic) {
    	if(jQuery.inArray(topic, topics) == -1) { topics.push(topic); }
        this.sendMessage({ type: "subscribe", topic: topic });
    };

    //Unsubscribe from Message Bus
    Mediator.prototype.unsubscribe = function(topic) {
    	var index = jQuery.inArray(topic, topics);
    	if(index != -1){ topics.splice(index,1); }
    	
        this.sendMessage({ type: "unsubscribe", topic: topic });
    };
    
    // Send delete message to the rest api
	Mediator.prototype.sendDeleteMessage = function(url, eventName, responseType) {
		if(!responseType){
			responseType = 'json';
		}
		
		this.sendMessage({
			type: 'delete',
			url: url,
			eventName: eventName,
			responseType: responseType,
			cookieKeys: CookieManager.getCookies(url)
		});
	};
    
    // Send post message to the rest api
	Mediator.prototype.sendPostMessage = function(url, eventName, payload, responseType) {
		if(!responseType){
			responseType = 'json';
		}
		
		this.sendMessage({
			type: 'post',
			url: url,
			eventName: eventName,
			payload: JSON.stringify(payload),
			responseType: responseType,
			cookieKeys: CookieManager.getCookies(url)
		});
	};
	
	 // Send post message to the rest api
	Mediator.prototype.sendPutMessage = function(url, eventName, payload, responseType) {
		if(!responseType){
			responseType = 'json';
		}
		
		this.sendMessage({
			type: 'put',
			url: url,
			eventName: eventName,
			payload: JSON.stringify(payload),
			responseType: responseType,
			cookieKeys: CookieManager.getCookies(url)
		});
	};

    //Send request message to rest api
    Mediator.prototype.sendRequestMessage = function(url, eventName, responseType){
    	if(!responseType){
    		responseType = 'json';
    	}
    	
        this.sendMessage({
            type: "request",
            url: url,
            eventName: eventName,
            responseType: responseType,
			cookieKeys: CookieManager.getCookies(url)
        });
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
