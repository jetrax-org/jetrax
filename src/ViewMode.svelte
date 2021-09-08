<script>
  function toggle() {
    window.document.body.classList.toggle("dark-mode");
  }
</script>

<button on:click={toggle} class="toggler">
  <slot />
</button>

<style lang="scss">
  @import "./styles/_viewModeButton.scss";
</style>
