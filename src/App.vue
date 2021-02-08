<template>
<home-view></home-view>
</template>

<script lang="ts">
import { Options, Vue } from 'vue-class-component';
import HomeView from './views/homeView.vue'
@Options({
  components: {
    HomeView
  },
})
export default class App extends Vue {}
</script>

<style lang="scss">

</style>
