<script>
	export let options = [];
	export let selected;
	export let label;
</script>

<div>
	<label for="countries" class="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
		>{label}</label
	>

	<select
		bind:value={selected}
		class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
	>
		{#each options as option, i}
			<option>{option}</option>
		{/each}
	</select>
</div>

<!-- <option value={options[1]}>{option[0]}</option> -->
