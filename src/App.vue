<template>
  <Chat msg="Welcome to Your Vue.js App"/>
</template>

<script>
import Chat from './components/ChatInterface.vue'

export default {
  name: 'App',
  components: {
    Chat
  },
  data() {
    return {
      pageTitle: 'Vue App'
    };
  },
  computed: {
    title: {
      get() {
        return this.pageTitle;
      },
      set(value) {
        this.pageTitle = value;
        document.title = value;
      }
    }
  },
  mounted() {
    this.title = "Programmer Assistant"; // This will also update the document title
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
