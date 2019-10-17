## Synopsis

Integrated Web Extensible Bundle (IWEB) JavaScript Extensible Modules (JEMs) provides a core view, client-side pub/sub, a server-side RabbitMQ connection as well as several common JavaScript modules.

## Building

    mvn install

## Description of Modules
  - core :
    - Server-side Mediator : The server-side Mediator automatically establishes a connection to RabbitMQ running on the localhost. It will listen on the "iweb.#" topic.
    - Client-side Mediator : The client can subscribe to iweb topics using the client-side Mediator. The client-side Mediator establishes a websocket connection to the server-side Mediator
    - EventManager : The messages are delivered to the Mediator.js which uses the EventManager.js to publish the message.
    - Config : Builds the core.properties config for access on the front-end. NOTE: Any property beginning with "private" will not be posted to the client.

  - core-view : Provides a default web view

  - map : Provides an OpenStreet Map and Map Controller

  - draw-menu :
    - Drawing Tools to enable map markup
    - Application Tools including gathering Census and Weather information

## Documentation

Further documentation is available at nics-common/docs

## Tesr