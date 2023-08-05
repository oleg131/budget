<script>
	let tooltipVisible = false;
	export let text = '';
</script>

<div class="relative">
	<div
		on:mouseover={() => (tooltipVisible = true)}
		on:focus={() => (tooltipVisible = true)}
		on:mouseout={() => (tooltipVisible = false)}
		on:blur={() => (tooltipVisible = false)}
		class="focus:outline-none"
	>
		<slot />
	</div>

	{#if tooltipVisible}
		<div class="absolute top-0 left-0 mt-12 p-2 bg-black text-white text-xs rounded">
			{text}
		</div>
	{/if}
</div>
