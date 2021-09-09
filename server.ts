import { Application, Router, send } from "https://deno.land/x/oak/mod.ts";

const app = new Application();
const router = new Router();
const sockets: WebSocket[] = [];

router
  .get("/socket", async (context) => {
    const socket = await context.upgrade();
    if (!socket || !context.isUpgradable) {
      return;
    }
    // lol is it not working if yes F lol 
    // @ts-ignore: username is not a WebSocket property
    socket.username = "Anonymous";
    socket.onopen = () => console.log("New user connected");
    socket.onmessage = (e) => {
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
  });

app.use(router.routes());
app.use(router.allowedMethods());

app.use(async (context) => {
  await send(context, context.request.url.pathname, {
    root: `${Deno.cwd()}/public`,
    index: "index.html",
  });
});

console.log("Start");
await app.listen({ port: 3000 });
