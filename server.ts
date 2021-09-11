const sockets: WebSocket[] = [];

async function handle(conn: Deno.Conn) {
  const httpConn = Deno.serveHttp(conn);
  for await (const requestEvent of httpConn) {
    await requestEvent.respondWith(await handleReq(requestEvent.request));
  }
}

async function handleReq(req: Request): Promise<Response> {
  if (req.headers.get("upgrade") != "websocket") {
    return new Response("Don't upgrade");
  }
  const { socket, response } = Deno.upgradeWebSocket(req);

  // lol is it not working if yes F lol
  // @ts-ignore: username is not a WebSocket property
  socket.username = "Anonymous";
  socket.onopen = () => console.log("New user connected");
  socket.onmessage = (e: any) => {
    const data: any = JSON.parse(e.data);
    switch (data.type) {
      case "change_username":
        // @ts-ignore username is not a WebSocket property
        socket.username = data.username;
        break;

      case "new_message":
        for (const peer of sockets) {
          peer.send(JSON.stringify({
            type: "message",
            message: data.message,
            // @ts-ignore username is not a WebSocket property
            username: socket.username,
          }));
        }
        break;
      case "typing":
        for (const peer of sockets) {
          // @ts-ignore username is not a WebSocket property
          if (peer.username != socket.username) {
            peer.send(JSON.stringify({
              type: "typing",
              // @ts-ignore username is not a WebSocket property
              username: socket.username,
            }));
          }
        }

        break;
    }
  };

  sockets.push(socket);
  return response;
}

console.log("Start");

const server = Deno.listen({ port: 3000 });

for await (const conn of server) {
  // ...handle the connection...
  await handle(conn);
}