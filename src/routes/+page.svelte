<script lang="ts">
	import CheckersGame from '$lib/components/three/Canvas.svelte';
</script>

<main>
	<CheckersGame width={8} height={8} canvasWidth={400} canvasHeight={400} turnTaking={true} />
</main>
s

<style>
	main {
		display: flex;
		justify-content: center;
		align-items: center;
		height: 100vh;
		margin: 0;
	}
</style>
