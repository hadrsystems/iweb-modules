/**
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
package edu.mit.ll.iweb.websocket;

import edu.mit.ll.nics.common.rabbitmq.RabbitFactory;
import edu.mit.ll.nics.common.rabbitmq.RabbitPubSubProducer;
import org.atmosphere.cpr.AtmosphereHandler;
import org.atmosphere.cpr.AtmosphereRequest;
import org.atmosphere.cpr.AtmosphereResource;
import org.atmosphere.cpr.AtmosphereResource.TRANSPORT;
import org.atmosphere.cpr.AtmosphereResourceEvent;
import org.atmosphere.cpr.AtmosphereResourceEventListenerAdapter;
import org.atmosphere.cpr.AtmosphereResponse;
import org.atmosphere.cpr.Broadcaster;
import org.atmosphere.cpr.BroadcasterCache;
//import org.atmosphere.cache.SessionBroadcasterCache;
import org.atmosphere.cache.UUIDBroadcasterCache;
import org.atmosphere.client.TrackMessageSizeInterceptor;
import org.atmosphere.config.service.AtmosphereHandlerService;
import org.atmosphere.config.service.ManagedService;
import org.atmosphere.cpr.BroadcasterFactory;
import org.atmosphere.handler.AbstractReflectorAtmosphereHandler;
import org.apache.camel.CamelContext;
import org.apache.camel.Message;
import org.apache.camel.ProducerTemplate;
import org.apache.camel.component.rabbitmq.RabbitMQConstants;
import org.apache.camel.component.rabbitmq.RabbitMQConsumer;
import org.apache.camel.component.rabbitmq.RabbitMQEndpoint;
import org.apache.camel.impl.DefaultCamelContext;
import org.apache.commons.configuration.Configuration;
import org.apache.log4j.Logger;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.ObjectWriter;

import edu.mit.ll.iweb.message.MessageDecoder;
import edu.mit.ll.iweb.message.MessageEncoder;
import edu.mit.ll.iweb.message.RequestMessage;
import edu.mit.ll.iweb.message.ResponseMessage;
import edu.mit.ll.iweb.rabbit.RabbitBroadcastFilter;
import edu.mit.ll.iweb.rabbit.RabbitConsumerListener;
import edu.mit.ll.iweb.session.SessionHolder;
import edu.mit.ll.iweb.websocket.Config;

import javax.inject.Inject;
import javax.servlet.http.HttpSession;
import javax.ws.rs.client.Client;
import javax.ws.rs.client.ClientBuilder;
import javax.ws.rs.client.Entity;
import javax.ws.rs.client.Invocation.Builder;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Cookie;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.StatusType;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

/**
 * Simple annotated class that demonstrate the power of Atmosphere. This class
 * supports all transports, support message length guarantee, heart beat,
 * message cache thanks to the {@link ManagedService}.
 */
@AtmosphereHandlerService(path = "/mediator",
		broadcasterCache = UUIDBroadcasterCache.class,
		interceptors = TrackMessageSizeInterceptor.class,
		supportSession = true)
public class Mediator extends AbstractReflectorAtmosphereHandler {
	private static Logger logger = Logger.getLogger(Mediator.class);

	public static String HANDLER_PATH = "/mediator";

	private static final String INVALID_MESSAGE_FORMAT = "Invalid Message Format";
	private static final String SUBSCRIBE_EXCEPTION = "Exception subscribing";
	private static final String PUBLISH_EXCEPTION = "Exception publishing";
	private static final String SUCCESS = "Success";

	private static final String SUBSCRIBE = "subscribe";
	private static final String UNSUBSCRIBE = "unsubscribe";
	private static final String PUBLISH = "publish";
	private static final String REQUEST = "request";
	private static final String LOAD_CONFIG = "config";

	private static final String GET = "GET";
	private static final String POST = "POST";
	private static final String PUT = "PUT";
	private static final String DELETE = "DELETE";
	private static final String TOPICS = "topics";

	private static final String PRIVATE = "private";

	private DefaultCamelContext context;
	private ProducerTemplate producerTemp;
	private RabbitPubSubProducer rabbitProducer;

	private final ObjectWriter objectWriter;
	private final Client jerseyClient;

	private Collection<SubscriptionValidator> subscriptionValidators;

	public Mediator() {
		context = new DefaultCamelContext();
		objectWriter = new ObjectMapper().writer();
		jerseyClient = ClientBuilder.newClient();
		subscriptionValidators = new ArrayList<SubscriptionValidator>();
	}

	public void addSubscriptionValidator(
			SubscriptionValidator subscriptionValidator) {
		this.subscriptionValidators.add(subscriptionValidator);
	}

	@Override
	public void onRequest(AtmosphereResource r) throws IOException {
		AtmosphereRequest req = r.getRequest();

		if (req.getMethod().equalsIgnoreCase(GET)) {

			logger.info("Running on code built on 10/24/2019-1");
			logger.info("Using UUIDBroadcasterCache");
			logger.info("Suspending session id " + req.getSession().getId());

			// Tell Atmosphere to allow bi-directional communication by
			// suspending.
			r.suspend();
		}

		// Message Received from the Client
		else if (req.getMethod().equalsIgnoreCase(POST)) {
			try {
				if (req.getReader() != null) {
					String body = req.getReader().readLine().trim();

					RequestMessage request = new MessageDecoder().decode(body);

					ResponseMessage response = this.onMessage(request, r);

					if (response != null) {
						r.getResponse().getWriter()
								.write(new MessageEncoder().encode(response));
					}
				}
			} catch (Exception e) {
				e.printStackTrace();
			}
		}
	}

	/****
	@Override
	public void onStateChange(AtmosphereResourceEvent event) throws IOException {
		AtmosphereResource resource = event.getResource();
		AtmosphereResponse res = resource.getResponse();

		logger.info("Broadcasting to : "
				+ (String) SessionHolder.getData(resource.getRequest()
				.getSession().getId(), "username") + " is suspended? "
				+ resource.isSuspended());

		if (resource.isSuspended()) {

			Object message = event.getMessage();
			if (message == null) {
				logger.info("Message was null for AtmosphereEvent");
				return;
			}

			if (message instanceof List) {
				for (Object s : (List<Object>) message) {

					twophaseWrite(res,s.toString());
				}
			} else {
				twophaseWrite(res,(String) message);
			}

			switch (resource.transport()) {
				case JSONP:
				case LONG_POLLING:
					event.getResource().resume();// need to send message back if
					// this is failover
					break;
				default:

					break;
			}
		} else if (!event.isResuming()) {
			logger.info("Not Resuming HTTP Session ID <"
					+ resource.getRequest().getSession().getId() + ">");
		}
	}


	private void twophaseWrite(AtmosphereResponse res,String message) throws IOException
	{

		if(res!=null)
		{
			logger.info("Atmosphere Response resource uuid: \" + res.resource().uuid()");
			//send a single character in the first writer
			logger.info("From twophaseWrite::Writing the prefix");
			res.getWriter().write("T");
			res.getWriter().flush();

			//second writer
			logger.info("From twophaseWrite::Writing the message::" + message);
			res.getWriter().write(message);
			res.getWriter().flush();

		}

	}
	*****/




	@Override
	public void destroy() {
	}

	/**
	 * @param message
	 *            an instance of {@link Message}
	 * @return
	 * @throws IOException
	 */
	private ResponseMessage onMessage(RequestMessage message,
									  AtmosphereResource resource) throws IOException {
		ResponseMessage response = new ResponseMessage();
		try {
			String type = message.getType();
			if (type == null) {
				response.setErrorMessage(INVALID_MESSAGE_FORMAT);
			} else {
				/** Move this to client **/
				String token = (String) SessionHolder
						.getData(resource.getRequest().getSession().getId(),
								SessionHolder.TOKEN);

				String username = (String) SessionHolder.getData(resource
						.getRequest().getSession().getId(), "username");
				/*************************/

				if (type.equalsIgnoreCase(SUBSCRIBE)) {
					return this.subscribe(message.getTopic(), resource);
				} else if (type.equalsIgnoreCase(UNSUBSCRIBE)) {
					return this.unsubscribe(message.getTopic(), resource);
				} else if (type.equalsIgnoreCase(PUBLISH)) {
					return this.publish(message.getTopic(),
							message.getMessage());
				} else if (type.equalsIgnoreCase(REQUEST)) {
					return this.request(message, token, username);
				} else if (type.equalsIgnoreCase(POST)) {
					return this.post(message, token, username);
				} else if (type.equalsIgnoreCase(PUT)) {
					return this.put(message, token, username);
				} else if (type.equalsIgnoreCase(DELETE)) {
					return this.delete(message, token, username);
				} else if (type.equalsIgnoreCase(LOAD_CONFIG)) {
					return this.loadConfig(resource.getRequest().getSession()
							.getId());
				}
			}
		} catch (Exception e) {
			// log exception
			e.printStackTrace();
		}
		return response;
	}

	/**
	 * Return the producer template used to publish messages
	 *
	 * @return
	 */
	private ProducerTemplate getPublisher() {
		if (this.producerTemp == null) {
			this.producerTemp = context.createProducerTemplate();
		}
		return this.producerTemp;
	}

	private RabbitPubSubProducer getRabbitProducer() throws IOException
	{
		if (rabbitProducer == null)
		{
			rabbitProducer = RabbitFactory.makeRabbitPubSubProducer(
					Config.getInstance().getConfiguration().getString(Config.RABBIT_HOSTNAME_KEY),
					Config.getInstance().getConfiguration().getString(Config.RABBIT_EXCHANGENAME_KEY),
					Config.getInstance().getConfiguration().getString(Config.RABBIT_USERNAME_KEY),
					Config.getInstance().getConfiguration().getString(Config.RABBIT_USERPWD_KEY));
		}

		return rabbitProducer;
	}

	/**
	 * Return array of subscribed topics for this request
	 *
	 * @param request
	 * @return
	 */
	private List<String> getTopics(AtmosphereRequest request) {
		HttpSession session = request.getSession();
		List<String> topics = (List<String>) session.getAttribute(TOPICS);
		if (topics == null) {
			topics = new ArrayList<String>();
			session.setAttribute(TOPICS, topics);
		}
		return topics;
	}

	/**
	 * Add the topic the Atmosphere request Susbcribe to the topic on the rabbit
	 * listener
	 *
	 * @param topic
	 * @param resource
	 * @return
	 */
	private ResponseMessage subscribe(String topic, AtmosphereResource resource) {
		logger.info("Subscribing to topic " + topic);
		ResponseMessage message = new ResponseMessage();

		try {

			/** Blocking **/
			for (SubscriptionValidator sv : this.subscriptionValidators) {
				if (!sv.validate(resource, topic)) {
					// Send back exception
					message.setSuccessMessage(SUBSCRIBE_EXCEPTION);
					return message;
				}
			}

			// Add new pattern to the topic array stored in the request
			getTopics(resource.getRequest()).add(topic);

			// Send back success
			message.setSuccessMessage(SUCCESS);

		} catch (Exception e) {
			// log exception
			e.printStackTrace();
			message.setErrorMessage(SUBSCRIBE_EXCEPTION);
		}
		return message;
	}

	/**
	 * Remove the topic from the Atmosphere request Unsubscribe the topic from
	 * the rabbit listener
	 *
	 * @param topic
	 * @param resource
	 * @return
	 */
	private ResponseMessage unsubscribe(String topic,
										AtmosphereResource resource) {
		logger.info("Unsubscribing from topic " + topic);
		ResponseMessage message = new ResponseMessage();
		try {
			// Remove topic from request
			getTopics(resource.getRequest()).remove(topic);

			// Send back success
			message.setSuccessMessage(SUCCESS);
		} catch (Exception e) {
			// log exception
			e.printStackTrace();
			message.setErrorMessage(SUBSCRIBE_EXCEPTION);
		}
		return message;
	}

	/**
	 *
	 * @param topic
	 * @param message
	 * @return
	 */
	private ResponseMessage publish(String topic, String message) {
		ResponseMessage responseMessage = new ResponseMessage();
		try {
			logger.info("in Publish method");
//            logger.info("Rabbit endpoint: " + Config.getInstance().getRabbitMQEndpoint().toString());

			getRabbitProducer().produce(topic, message);

//            Config.getInstance().getRabbitMQEndpoint().getEndpointUri();
//            this.getPublisher().sendBody(
//                    "rabbitmq://localhost:5672/iweb.amq.topic?exchangeType=topic&password=guest&routingKey=iweb.nics.email.alert&username=guest", message);
			logger.info("Publishing on topic: " + topic);
			logger.info("Publishing message: " + message);
			responseMessage.setSuccessMessage(SUCCESS);
		} catch (Exception e) {
			e.printStackTrace();
			responseMessage.setErrorMessage(PUBLISH_EXCEPTION);
		}
		return responseMessage;
	}

	/**
	 * DELETE
	 *
	 * @param request
	 * @param sessionId
	 * @return
	 */
	private ResponseMessage delete(RequestMessage request, String token,
								   String username) {
		String responseType = request.getResponseType();

		ResponseMessage responseMessage = new ResponseMessage();
		responseMessage.setEventName(request.getEventName());
		responseMessage.setResponseType(responseType);

		WebTarget target = jerseyClient.target(request.getUrl());
		Builder builder = target.request(responseType);
		this.setCookies(builder, request.getCookieKeys(), token, username);

		Response response = builder.delete();

		handleResponse(response, responseMessage);

		response.close();

		return responseMessage;
	}

	/**
	 * POST
	 *
	 * @param url
	 * @param eventName
	 * @param payload
	 * @param responseType
	 * @return
	 */
	private ResponseMessage post(RequestMessage request, String token,
								 String username) {
		String responseType = request.getResponseType();

		ResponseMessage responseMessage = new ResponseMessage();
		responseMessage.setEventName(request.getEventName());
		responseMessage.setResponseType(responseType);

		WebTarget target = jerseyClient.target(request.getUrl());
		Builder builder = target.request(responseType);
		this.setCookies(builder, request.getCookieKeys(), token, username);

		Entity<String> entity = Entity.entity(request.getPayload(),
				MediaType.APPLICATION_JSON);
		Response response = builder.post(entity);

		handleResponse(response, responseMessage);

		response.close();

		return responseMessage;
	}

	/**
	 * POST
	 *
	 * @param url
	 * @param eventName
	 * @param payload
	 * @param responseType
	 * @return
	 */
	private ResponseMessage put(RequestMessage request, String token,
								String username) {
		String responseType = request.getResponseType();

		ResponseMessage responseMessage = new ResponseMessage();
		responseMessage.setEventName(request.getEventName());
		responseMessage.setResponseType(responseType);

		WebTarget target = jerseyClient.target(request.getUrl());
		Builder builder = target.request(responseType);
		this.setCookies(builder, request.getCookieKeys(), token, username);

		Entity<String> entity = Entity.entity(request.getPayload(),
				MediaType.APPLICATION_JSON);
		Response response = builder.put(entity);

		handleResponse(response, responseMessage);

		response.close();

		return responseMessage;
	}

	/**
	 * GET
	 *
	 * @param url
	 * @param eventName
	 * @param responseType
	 * @return
	 */
	private ResponseMessage request(RequestMessage request, String token,
									String username) {
		String responseType = request.getResponseType();
		ResponseMessage responseMessage = new ResponseMessage();
		responseMessage.setEventName(request.getEventName());
		responseMessage.setResponseType(responseType);

		WebTarget target = jerseyClient.target(request.getUrl());
		Builder builder = target.request(responseType);
		this.setCookies(builder, request.getCookieKeys(), token, username);

		Response response = builder.get();

		handleResponse(response, responseMessage);

		response.close();

		return responseMessage;
	}

	/**
	 * Load the config file
	 *
	 * @param sessionId
	 * @return
	 * @throws IOException
	 */
	private ResponseMessage loadConfig(String sessionId) throws IOException {
		Map<String, Object> config = new HashMap<String, Object>();
		ResponseMessage response = new ResponseMessage();

		Configuration systemConfig = Config.getInstance().getConfiguration();
		try {
			for (Iterator<String> itr = systemConfig.getKeys(); itr.hasNext();) {
				String key = itr.next();

				String[] properties = key.split("\\.");

				if (properties.length != 0
						&& !properties[0].equalsIgnoreCase(PRIVATE)) {

					// No dot notation
					if (properties.length == 1) {
						config.put(key, systemConfig.getProperty(key));
					} else {
						boolean newProperty = true;
						Map<String, Object> root;
						Map<String, Object> currentMap;

						if (config.containsKey(properties[0])) {
							root = (Map) config.get(properties[0]);
							newProperty = false;
						} else {
							root = new HashMap<String, Object>();
						}
						currentMap = root;

						for (int i = 1; i < properties.length; i++) {
							if (i == properties.length - 1) {
								currentMap.put(properties[i],
										systemConfig.getProperty(key));
							} else {
								if (i == 1 && root.containsKey(properties[i])) {
									currentMap = (Map) root.get(properties[i]);
								} else if (currentMap
										.containsKey(properties[i])) {
									currentMap = (Map) currentMap
											.get(properties[i]);
								} else {
									Map<String, Object> newMap = new HashMap<String, Object>();
									currentMap.put(properties[i], newMap);
									currentMap = newMap;
								}
							}
						}
						if (properties.length > 0 && newProperty) {
							config.put(properties[0], root);
						}
					}
				}
			}
		} catch (Exception e) {
			e.printStackTrace();
		}
		response.setEventName(LOAD_CONFIG);
		response.setData(objectWriter.writeValueAsString(config));
		return response;
	}

	/**
	 * Handle POST/GET Responses
	 *
	 * @param response
	 * @param responseMessage
	 * @return
	 */
	private ResponseMessage handleResponse(Response response,
										   ResponseMessage responseMessage) {
		String message = response.readEntity(String.class);
		responseMessage.setData(message);

		StatusType status = response.getStatusInfo();
		if (Response.Status.Family.SERVER_ERROR.equals(status.getFamily())
				|| Response.Status.Family.CLIENT_ERROR.equals(status
				.getFamily())) {
			responseMessage.setErrorMessage(status.getReasonPhrase());
		} else {
			responseMessage.setSuccessMessage(status.getReasonPhrase());
		}
		return responseMessage;
	}

	/**
	 * Set Cookies on the Get/Post
	 *
	 * @param builder
	 * @param cookieKeys
	 *            - sent from the client and are defined in the core.properties
	 *            file
	 * @param sessionId
	 */
	private void setCookies(Builder builder, Collection<String> cookieKeys,
							String token, String username) {
		if (cookieKeys != null) {
			Collection<Cookie> cookies = SessionHolder.getCookieStore(
					cookieKeys, token);
			for (Cookie c : cookies) {
				builder.cookie(c);
			}
		}
		if (username != null) {
			builder.header("CUSTOM-uid", username);
		}
	}
}
