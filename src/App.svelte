<script lang="ts">
  import { Router, Link, Route } from "svelte-routing";
  import { fade } from "svelte/transition";
  import { draw } from "svelte/transition";
  import Toggler from "./ViewMode.svelte";
  import ChatMessage from "./ChatMessages.svelte";

  // buttons and inputs

  let message: string = "";
  let username: string = "";
  let chatroom = [];
  let feedback: string;

  // make connection
  console.log("http://localhost:3000");
  const socket = new WebSocket('ws://localhost:3000');

  // Connection opened
  socket.addEventListener('open', function (event) {
  });

  // Listen for messages
  socket.addEventListener('message', function (event) {
      const data: any = JSON.parse(event.data);

      switch (data.type) {
        case "typing":
          feedback = data.username;
          break;
        case "message":
          message = "";
          feedback = "";
          chatroom = [
            ...chatroom,
            { username: data.username, message: data.message },
          ];
          break;
      }
  });

  function sendMessage() {
    socket.send(JSON.stringify({
      type: "new_message",
      username,
      message,
    }));
  }

  // Emit a username
  function sendUsername() {
    socket.send(JSON.stringify({
      type: "change_username",
      username,
    }));
  }

  // Emit typing
  function sendTyping() {
    socket.send(JSON.stringify({
      type: "typing",
      username,
    }));
  }
 
</script>

<title>Svelte chat app</title>

<div class="animate__fadeIn">
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"
  />

  <Toggler>Toggle</Toggler>
  
  <chat class="chat">
    <div class="animate__animated animate__tada">
      <section> 
        <div id="change_username">
          <input id="username" type="text" bind:value={username} />
          <button id="send_username" type="button" on:click={sendUsername}>
            Change username
          </button>
        </div>
      </section>
      <section id="input_zone">
        <input
          id="message"
          type="text"
          on:keypress={sendTyping}
          bind:value={message}
        />
        <button
          id="send_message"
          type="button"
          on:click={sendMessage}
        >
          Send
        </button>
      </section>
    </div>
    <section id="chatroom">
      {#each chatroom as c}
        <ChatMessage
          ><p>
            {new Date().toLocaleTimeString()} <br />{c.username} : {c.message}
          </p>
        </ChatMessage>
      {/each}
      <section>
        {#if feedback}
          <div in:fade out:fade>{feedback} is typing...</div>
        {/if}
      </section>
    </section>
  </chat>
</div>

<style lang="scss">
  @import "./styles/global.scss";
  @import "./styles/_darkMode.scss";
</style>
