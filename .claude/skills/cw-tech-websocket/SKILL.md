---
name: cw-tech-websocket
description: "Implement or review WebSocket connections, rooms, event relays, or live updates in Cadenway."
---

# Websocket for Cadenway

The realtime gateway owns authenticated connections, rooms, presence and relays; the webapp consumes its public realtime interface. Read the relevant AsyncAPI contracts and existing `cw-rooms-and-relays` or realtime conventions before changing behavior. Respect organization and room authorization, connection cleanup, expiry and cross-instance state; validate reconnection and event handling with targeted tests when the infrastructure is available.

## Connecting from the webapp

This is the target protocol, owned by cadenway-realtime-gateway (`cw-rooms-and-relays` there).

- Client: `socket.io-client`, set up once in `core/` and never opened from a store or a component.
- Ticket: the handshake carries a single-use ticket valid 60 seconds in `auth.token`. A ticket is
  spent by one connection attempt, so every attempt, reconnections included, asks for a new one.
- Rooms: `org:<id>`, `list:<id>`, `task:<id>` and the member's personal room `member:<id>`.
- Messages arrive in the envelope `{ id, type, at, version, data }`; `data` carries ids and changed
  fields only.
- Reload: there is no connection state recovery. After every connection or reconnection the client
  rejoins its rooms and refetches through the API what it displays; a message is a signal to
  refetch, never the data itself.
- Revocation: the gateway closes the socket when the session is revoked, the member is removed or
  the role changes; treat that close like a signed-out session, not like a network drop.

Consult the official documentation for the version actually used: https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API.
