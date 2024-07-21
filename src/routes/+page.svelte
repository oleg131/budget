<script>
	import { afterUpdate } from 'svelte';
	import Tags from 'svelte-tags-input';
	import Highcharts from 'highcharts';
	import _ from 'lodash';

	import { contentStore, settingsStore } from '$lib/stores/stores';
	import { CSVToArray, cumulativeSum } from '$lib/utils';

	import Dropzone from '$lib/Dropzone.svelte';
	import Select from '$lib/Select.svelte';
	import Checkbox from '$lib/Checkbox.svelte';
	import Tooltip from '../lib/Tooltip.svelte';

	const datePos = 0;
	const descriptionPos = 1;
	const amountPos = 2;
	const originalDescriptionPos = 3;
	const header = ['Date', 'Description (click to (un)ignore)', 'Amount', 'Tags'];

	const DEFAULT_FULL_CSV = [
		['8/21/2022', 'Ext Credit Card Debit MAGGY MAID               TUSTIN       CA', '187.00'],
		['8/24/2022', 'Ext Credit Card Debit TST* EGG TUCK - KOREAT   LOS ANGELES  CA', '11.94'],
		['8/24/2022', 'Ext Credit Card Debit TST* AHGASSI GOPCHANG    LOS ANGELES  CA,', '190.10'],
		['8/24/2022', 'Ext Credit Card Debit GO POCHA                 LOS ANGELES  CA', '88.01'],
		['8/25/2022', 'Ext Credit Card Debit GO POCHA                 LOS ANGELES  CA', '188.01'],
		['8/26/2022', 'Incoming payment', '-600.05']
	];

	const tags = JSON.parse($contentStore);
	$: $contentStore = JSON.stringify(
		Object.fromEntries(Object.entries(tags).filter(([k, v]) => v && v.length))
	);

	const settings = JSON.parse($settingsStore);
	$: $settingsStore = JSON.stringify(settings);

	if (!settings.descriptionRegex) {
		settings.descriptionRegex = [];
	}

	let fullHeader;
	let rawCSV;
	let selectedTag;
	let chartCanvas;
	let timeCanvas;
	let loaded = false;

	function getFullCSV(rawCSV, settings) {
		if (!rawCSV) {
			return DEFAULT_FULL_CSV;
		}

		let colsToRender = [
			fullHeader.indexOf(settings.dateCol),
			fullHeader.indexOf(settings.descriptionCol),
			fullHeader.indexOf(settings.amountCol)
		];

		fullCSV = rawCSV.map((i) => colsToRender.map((x) => i[x]));

		fullCSV.forEach((row) => {
			row[descriptionPos] = applyRegex(row[descriptionPos], settings.descriptionRegex);
		});

		return fullCSV;
	}

	$: fullCSV = getFullCSV(rawCSV, settings);

	function applyRegex(description, descriptionRegex) {
		for (const regexp of descriptionRegex) {
			if (regexp) {
				let matches;
				try {
					matches = description.match(regexp);
				} catch {}

				if (!matches) {
					continue;
				}
				let newDescription = '';
				for (let index = 0; index < matches.length; index++) {
					if (index === 0) {
						continue;
					}
					const match = matches[index];
					newDescription += match;
				}

				if (newDescription) {
					description = `${newDescription}`;
				}
			}
		}
		return description;
	}

	function getParsedSV(fullCSV, selectedTag) {
		let parsedCSV = _.cloneDeep(fullCSV);

		if (selectedTag) {
			parsedCSV = parsedCSV.filter((row) => {
				const name = row[descriptionPos];
				const nameTags = tags[name] || [];
				if (selectedTag === 'undefined' && !nameTags.length) {
					return true;
				}
				return nameTags.includes(selectedTag);
			});
		}

		parsedCSV.forEach((row) => {
			row[amountPos] = parseFloat(row[amountPos]);
			row[datePos] = new Date(row[datePos]);
		});

		if (settings.spendingsNegative) {
			parsedCSV = parsedCSV.map((row) => {
				row[amountPos] = -row[amountPos];
				return row;
			});
		}

		if (settings.ignoreOppositeSign) {
			parsedCSV = parsedCSV.filter((row) => row[amountPos] >= 0);
		}

		return parsedCSV;
	}

	function getChartJSON(tags, parsedCSV) {
		let csvData = [];

		for (const [entry, tagsArray] of Object.entries(tags)) {
			for (const row of parsedCSV) {
				if (row[descriptionPos] === entry) {
					for (const tag of tagsArray) {
						csvData.push([null, row[descriptionPos], row[amountPos], tag]);
					}
				}
			}
		}

		for (const row of parsedCSV) {
			const nameTags = tags[row[descriptionPos]];
			if (!nameTags || !nameTags.length) {
				csvData.push([null, row[descriptionPos], row[amountPos], 'undefined']);
			}
		}

		csvData = csvData.filter((row) => !isIgnored(row[descriptionPos]));

		if (selectedTag) {
			csvData = csvData.filter((row) => row[3] == selectedTag);
		}

		const amountsByTag = Object.fromEntries(
			Object.entries(_.groupBy(csvData, (x) => x[!selectedTag ? 3 : 1]))
		);

		Object.keys(amountsByTag).forEach((k) => {
			amountsByTag[k] = _.sum(amountsByTag[k].map((x) => x[2]));
		});

		const data = Object.keys(amountsByTag).map((k) => ({
			name: k,
			y: (100 * amountsByTag[k]) / _.sum(Object.values(amountsByTag)),
			value: amountsByTag[k]
		}));

		let dataJSON = {
			colorByPoint: false,
			data: data.sort((a, b) => b.y - a.y)
		};

		const chartjson = {
			chart: {
				plotBackgroundColor: null,
				plotBorderWidth: null,
				plotShadow: false,
				type: 'column'
			},
			title: {
				text: 'Amount by tag',
				align: 'left'
			},
			accessibility: {
				point: {
					valueSuffix: '%'
				}
			},
			xAxis: {
				type: 'category'
			},
			yAxis: {
				title: {
					text: 'Percentage'
				}
			},
			legend: {
				enabled: false
			},
			plotOptions: {
				series: {
					allowPointSelect: true,
					cursor: 'pointer',
					dataLabels: {
						enabled: true,
						format: '${point.value:.2f}'
					},
					events: {
						click: function (event) {
							if (selectedTag) {
								return;
							}
							const tag = data[event.point.index].name;
							selectedTag = tag;
						}
					}
				}
			},
			tooltip: {
				headerFormat: '',
				pointFormat: '<b>{point.name}</b>: {point.y:.2f}%'
			},
			series: [dataJSON]
		};

		return chartjson;
	}

	$: chartjson = getChartJSON(tags, parsedCSV);

	function getTimeJSON(parsedCSV) {
		let csvData = _.cloneDeep(parsedCSV);

		csvData = csvData.filter((row) => !isIgnored(row[descriptionPos]));

		csvData.forEach((row) => {
			row[0] = row[0].getTime();
		});

		const amountByDate = _.groupBy(csvData, (row) => row[datePos]);

		Object.keys(amountByDate).forEach((date) => {
			amountByDate[date] = _.sum(amountByDate[date].map((row) => row[amountPos]));
		});

		let data = Object.entries(amountByDate).sort((a, b) => a[0] - b[0]);

		let cs = cumulativeSum(data.map((i) => i[1]));

		data.forEach((value, index) => {
			value[0] = parseInt(value[0]);
			value[1] = _.round(cs[index], 2);
		});

		let timejson = {
			chart: {
				type: 'area'
			},
			title: {
				text: 'Total amount by date',
				align: 'left'
			},
			xAxis: {
				type: 'datetime'
			},
			yAxis: {
				title: {
					text: 'Total $'
				}
			},
			plotOptions: {
				area: {
					marker: {
						enabled: false,
						symbol: 'circle',
						radius: 2,
						states: {
							hover: {
								enabled: true
							}
						}
					}
				}
			},
			legend: {
				enabled: false
			},
			series: [
				{
					name: 'Total',
					data: data
				}
			]
		};

		return timejson;
	}

	$: timejson = getTimeJSON(parsedCSV);

	function upload(e) {
		let file = e.target.files[0];

		let reader = new FileReader();
		reader.readAsText(file);
		reader.onload = function (event) {
			let csvData = event.target.result;

			csvData = CSVToArray(csvData.trim());

			fullHeader = csvData[0];

			rawCSV = csvData.slice(1);
		};
	}

	$: loaded =
		rawCSV &&
		fullHeader.includes(settings.dateCol) &&
		fullHeader.includes(settings.descriptionCol) &&
		fullHeader.includes(settings.amountCol);

	afterUpdate(() => {
		setTimeout(() => {
			Highcharts.chart(chartCanvas, chartjson);
			Highcharts.chart(timeCanvas, timejson);
		}, 50);
	});

	$: parsedCSV = getParsedSV(fullCSV, selectedTag);

	function toggleIgnore(description) {
		if (!settings.ignoreDescriptions) {
			settings.ignoreDescriptions = [];
			settings.ignoreDescriptions.push(description);
			console.log('ignore empty, add');
		} else {
			let index = settings.ignoreDescriptions.indexOf(description);
			if (index !== -1) {
				settings.ignoreDescriptions.splice(index, 1);
				console.log('remove from ignore');
			} else {
				settings.ignoreDescriptions.push(description);
				console.log('add to ignore');
			}
		}
		settings.ignoreDescriptions = settings.ignoreDescriptions;
	}

	function isIgnored(description) {
		return settings.ignoreDescriptions && settings.ignoreDescriptions.includes(description);
	}
</script>

<main class="pt-8 pb-16 lg:pt-16 lg:pb-24 bg-white dark:bg-gray-900">
	<div class="flex flex-col justify-between px-4 mx-auto max-w-screen-xl ">
		<p
			class="text-center mb-6 text-lg font-normal text-gray-500 lg:text-xl sm:px-16 xl:px-48 dark:text-gray-400"
		>
			This app lets you breakdown your credit card transaction by assigned tags.<br />
			<small>Assigned tags are stored in the browser locally. </small>
		</p>

		<Dropzone onChange={upload} />

		{#if rawCSV || 1}
			<div
				class="grid grid-cols-3 gap-4 font-mono text-sm text-center font-bold leading-6 bg-stripes-fuchsia rounded-lg pt-16"
			>
				<Select label="Date column" options={fullHeader} bind:selected={settings.dateCol} />
				<div class="flex flex-col gap-4">
					<Select
						label="Description column"
						options={fullHeader}
						bind:selected={settings.descriptionCol}
					/>
					<div class="flex flex-col items-center justify-center gap-4">
						{#each settings.descriptionRegex as regexp, i}
							<input
								type="search"
								class="w-full rounded-lg border border-gray-400 p-2"
								value={regexp}
								on:search={() => {
									settings.descriptionRegex.splice(i, 1);
									settings.descriptionRegex = settings.descriptionRegex;
								}}
								on:input={(e) => {
									settings.descriptionRegex[i] = e.target.value;
									settings.descriptionRegex = settings.descriptionRegex;
								}}
							/>
						{/each}

						<button
							type="button"
							class="w-auto cursor-pointer space-x-1 rounded-full border border-gray-200 bg-white
							px-4 py-2 text-sm font-medium text-gray-800 transition hover:border-gray-400
							 focus:border-gray-400 focus:outline-none focus:ring-0"
							on:click|preventDefault={() => {
								settings.descriptionRegex.push('');
								settings.descriptionRegex = settings.descriptionRegex;
							}}
						>
							Add regex
						</button>
						<div class="text-xs text-gray-400">
							Apply regex to the description. New description will be the concatenation of all
							capturing groups. Use backslash to escape special characters.<br /><br /> This is
							useful, if you want to apply same tag to multiple transactions of similar form.<br
							/><br />For example, if you have transactions "LYFT FRI 7PM", "LYFT SUN 1AM" etc, you
							can add regex "(LYFT).*", and all those transaction would be treated as being "LYFT"
						</div>
					</div>
				</div>

				<div class="flex flex-col justify-start gap-4">
					<Select label="Amount column" options={fullHeader} bind:selected={settings.amountCol} />
					<Checkbox label="Spendings are negative" bind:checked={settings.spendingsNegative} />
					<Checkbox
						label="Ignore values of opposite sign"
						bind:checked={settings.ignoreOppositeSign}
					/>
				</div>
			</div>
		{/if}
		{#if selectedTag}
			<div class="text-center pt-16">
				<div
					class="mb-4 text-4xl font-extrabold leading-none tracking-tight text-gray-900 md:text-5xl lg:text-6xl dark:text-white"
				>
					Selected tag: <span
						class="text-blue-600 dark:text-blue-500 cursor-pointer hover:underline"
						on:click={() => {
							selectedTag = undefined;
						}}
						on:keydown={() => {
							selectedTag = undefined;
						}}>{selectedTag}</span
					>
				</div>
				<span class="text-sm text-gray-400">(click to remove)</span>
			</div>
		{/if}
		<div bind:this={timeCanvas} class={`pt-16 ${loaded ? null : 'hidden'}`}>
			<slot />
		</div>
		<div bind:this={chartCanvas} class={`pt-16 ${loaded ? null : 'hidden'}`}>
			<slot />
		</div>
		{#if loaded}
			<div class="pt-16">
				<div class="not-prose relative bg-slate-50 rounded-xl overflow-hidden dark:bg-slate-800/25">
					<div
						style="background-position:10px 10px"
						class="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,#fff,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]"
					/>
					<div class="relative rounded-xl overflow-auto">
						<div class="shadow-sm overflow-hidden my-8">
							<table class="border-collapse table-auto w-full">
								<thead>
									<tr>
										{#each header as col}
											<th
												class="border-b dark:border-slate-600 font-medium p-4 pl-8 pt-0 pb-3 text-slate-800 dark:text-slate-200 text-left"
												>{col}</th
											>
										{/each}
									</tr>
								</thead>
								<tbody class="bg-white dark:bg-slate-800">
									{#each fullCSV as row}
										<tr
											>{#each row.slice(0, 3) as col, index}
												<td
													class="border-b border-slate-100 dark:border-slate-700 p-4 pl-8 text-slate-600 dark:text-slate-400 whitespace-pre-wrap"
													><span
														on:click={() => toggleIgnore(col)}
														on:keydown={() => toggleIgnore(col)}
														class:hover:underline={parseInt(index) === descriptionPos}
														class:cursor-pointer={parseInt(index) === descriptionPos}
														class:line-through={isIgnored(col)}>{col}</span
													>
												</td>
											{/each}
											<td
												class="border-b border-slate-100 dark:border-slate-700 p-4 pl-8 text-slate-600 dark:text-slate-400"
												><Tags bind:tags={tags[row[descriptionPos]]} /></td
											></tr
										>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
					<div
						class="absolute inset-0 pointer-events-none border border-black/5 rounded-xl dark:border-white/5"
					/>
				</div>
			</div>
		{/if}
	</div>
</main>

<style>
	:global.highcharts-root {
		font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
			'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji',
			'Segoe UI Symbol', 'Noto Color Emoji' !important;
	}
</style>
