<script lang="ts">
  import { Router, Link, Route } from "svelte-routing";
  import { fade } from "svelte/transition";
  import { draw } from "svelte/transition";
  import Toggler from "./ViewMode.svelte";
  import ChatMessage from "./ChatMessages.svelte";
  import { io } from "socket.io-client";

  // buttons and inputs

  let message: string = "";
  let username: string = "";
  let chatroom = [];
  let feedback: string;

  // make connection
  var socket = io("http://localhost:3000");
  console.log("http://localhost:3000");

  function sendMessage() {
    socket.emit("new_message", { message });
  }
  // Listen on new_message

  // Emit a username
  function sendUsername() {
    socket.emit("change_username", { username });
  }

  // Emit typing
  function sendTyping() {
    socket.emit("typing");
  }

  // Listen on typing
  socket.on("typing", (data) => {
    feedback = data.username;
  });
  socket.on("new_message", (data) => {
    message = "";
    feedback = "";
    chatroom = [
      ...chatroom,
      { username: data.username, message: data.message },
    ];
    // console.log(chatroom)
  });
</script>

<title>Svelte chat app</title>

<div class="animate__fadeIn ">
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <script
    src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/2.0.4/socket.io.js"></script>
  <link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css"
  />

  <Toggler>Toggle</Toggler>
  <main>
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
          class="vertical-align"
          type="text"
          on:keypress={sendTyping}
          bind:value={message}
        />
        <button
          id="send_message"
          class="vertical-align"
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
  </main>
</div>

<style lang="scss">
  @import "./styles/global.scss";
  @import "./styles/_darkMode.scss";
</style>
