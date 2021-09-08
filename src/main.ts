import App from "./App.svelte";

const mainApp = new App({
  target: document.body,
  props: {
    name: "world",
  },
});
export default mainApp;
