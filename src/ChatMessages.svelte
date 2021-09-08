<script lang="ts">
  import { fade } from "svelte/transition";
</script>

<h3 class="message chatm" transition:fade><slot /></h3>

<style lang="scss">
  @import url("https://fonts.googleapis.com/css2?family=Urbanist:wght@600;900&display=swap");
  h3 {
    font-family: "Urbanist", sans-serif;
    font-weight: 100;
  }
</style>
