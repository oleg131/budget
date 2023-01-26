<script>
	import Tags from 'svelte-tags-input';
	import { content, settingsStore } from '../stores/content';
	import { afterUpdate } from 'svelte';
	import Highcharts from 'highcharts';
	import _ from 'lodash';
	import { CSVToArray } from './utils';

	import Dropzone from '$lib/Dropzone.svelte';
	import Select from '$lib/Select.svelte';
	import Checkbox from '$lib/Checkbox.svelte';

	const groupBy = function (xs, key) {
		return xs.reduce(function (rv, x) {
			(rv[key(x)] = rv[key(x)] || []).push(x);
			return rv;
		}, {});
	};

	const sum = (arr) => arr.reduce((sum, x) => sum + x);

	const cumulativeSum = (array) =>
		array.map(
			(
				(sum) => (value) =>
					(sum += value)
			)(0)
		);

	let fullHeader;
	let header = ['Date', 'Description', 'Amount', 'Tags'];

	let datePos = 0;
	let descriptionPos = 1;
	let amountPos = 2;
	let tagsPos = 3;

	let rawCSV;

	function getFullCSV(rawCSV, settings) {
		if (!rawCSV) {
			return [
				['8/21/2022', 'Ext Credit Card Debit MAGGY MAID               TUSTIN       CA', '187.00'],
				['8/24/2022', 'Ext Credit Card Debit TST* EGG TUCK - KOREAT   LOS ANGELES  CA', '11.94'],
				['8/24/2022', 'Ext Credit Card Debit TST* AHGASSI GOPCHANG    LOS ANGELES  CA,', '190.10'],
				['8/24/2022', 'Ext Credit Card Debit GO POCHA                 LOS ANGELES  CA', '88.01'],
				['8/25/2022', 'Ext Credit Card Debit GO POCHA                 LOS ANGELES  CA', '188.01'],
				['8/26/2022', 'Incoming payment', '-600.05']
			];
		}

		console.log(rawCSV);

		let colsToRender = [
			fullHeader.indexOf(settings.dateCol),
			fullHeader.indexOf(settings.descriptionCol),
			fullHeader.indexOf(settings.amountCol)
		];

		console.log(colsToRender);

		fullCSV = rawCSV.map((i) => colsToRender.map((x) => i[x]));

		return fullCSV;
	}

	$: fullCSV = getFullCSV(rawCSV, settings);

	// let colsToRender = [settings.dateCol || 0, settings.descriptionCol || 0, settings.amountCol || 0];

	let selectedTag;

	function getParsedSV(fullCSV, selectedTag) {
		console.log(fullCSV);
		let parsedCSV = clone(fullCSV);

		// parsedCSV = parsedCSV.filter((row) => row[1] < 0);

		if (!!selectedTag) {
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

		console.log(parsedCSV);

		if (settings.ignoreOppositeSign) {
			parsedCSV = parsedCSV.filter((row) => row[amountPos] >= 0);
		}

		console.log(parsedCSV);

		return parsedCSV;
	}

	$: parsedCSV = getParsedSV(fullCSV, selectedTag);

	// parsedCSV.slice(1).forEach((row) => {
	// 	row[1] = parseFloat(row[1]);
	// 	row[0] = new Date(row[0]);
	// });

	const tags = JSON.parse($content);

	$: $content = JSON.stringify(
		Object.fromEntries(Object.entries(tags).filter(([k, v]) => v && v.length))
	);

	const settings = JSON.parse($settingsStore);

	$: $settingsStore = JSON.stringify(settings);

	let canvas;
	let timeCanvas;

	function clone(a) {
		return JSON.parse(JSON.stringify(a));
	}

	function getChartJSON(tags, parsedCSV) {
		// const csvData = clone(parsedCSV);

		const csvData = [];

		// for (const [entry, tagsArray] of Object.entries(tags)) {
		// 	for (let index = 0; index < csvData.length; index++) {
		// 		const row = csvData[index];
		// 		if (row[descriptionPos] === entry) {
		// 			for (const tag of tagsArray) {
		// 				csvData.push([entry, tag]);
		// 				// csvData[index][tagsPos] = tag;
		// 			}
		// 		}
		// 	}
		// }

		for (const [entry, tagsArray] of Object.entries(tags)) {
			for (const row of parsedCSV) {
				if (row[descriptionPos] === entry) {
					for (const tag of tagsArray) {
						csvData.push([null, row[descriptionPos], row[amountPos], tag]);
					}
				}
			}
		}

		console.log(tags);

		console.log(parsedCSV);

		for (const row of parsedCSV) {
			const nameTags = tags[row[descriptionPos]];
			if (!nameTags || !nameTags.length) {
				csvData.push([null, row[descriptionPos], row[amountPos], 'undefined']);
			}
		}

		const amountsByTag = Object.fromEntries(
			Object.entries(_.groupBy(csvData, (x) => x[!selectedTag ? 3 : 1]))
		);

		console.log(amountsByTag);

		Object.keys(amountsByTag).forEach((k) => {
			amountsByTag[k] = sum(amountsByTag[k].map((x) => x[2]));
		});

		const data = Object.keys(amountsByTag).map((k) => ({
			name: k,
			y: (100 * amountsByTag[k]) / sum(Object.values(amountsByTag)),
			value: amountsByTag[k]
		}));

		let dataJSON = {
			colorByPoint: true,
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

	function upload(e) {
		// let colsToRender = [1, 4, 7];

		let file = e.target.files[0];

		let reader = new FileReader();
		reader.readAsText(file);
		reader.onload = function (event) {
			let csvData = event.target.result;

			csvData = CSVToArray(csvData.trim());

			fullHeader = csvData[0];

			rawCSV = csvData.slice(1);

			// let colsToRender = [
			// 	fullHeader.indexOf(settings.dateCol),
			// 	fullHeader.indexOf(settings.amountCol),
			// 	fullHeader.indexOf(settings.descriptionCol)
			// ];

			// fullCSV = csvData.map((i) => colsToRender.map((x) => i[x]));

			// fullCSV = fullCSV.filter((i) => !!i[0]);

			// fullCSV = fullCSV.slice(1);
		};
	}

	function getTimeJSON(parsedCSV) {
		let csvData = _.cloneDeep(parsedCSV);

		csvData.forEach((row) => {
			row[0] = row[0].getTime();
		});

		// csvData.sort((row1, row2) => row1[datePos] - row2[datePos]);

		// csvData = csvData.filter((row) => row[1] < 0);

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

	afterUpdate(() => {
		setTimeout(() => {
			Highcharts.chart(canvas, chartjson);
			Highcharts.chart(timeCanvas, timejson);
		}, 50);
	});
</script>

<main class="pt-8 pb-16 lg:pt-16 lg:pb-24 bg-white dark:bg-gray-900">
	<div class="flex flex-col justify-between px-4 mx-auto max-w-screen-xl ">
		<p
			class="text-center mb-6 text-lg font-normal text-gray-500 lg:text-xl sm:px-16 xl:px-48 dark:text-gray-400"
		>
			This app lets you breakdown your credit card transaction by assigned tags.
		</p>

		<Dropzone onChange={upload} />

		<div
			class="grid grid-cols-3 gap-4 font-mono text-white text-sm text-center font-bold leading-6 bg-stripes-fuchsia rounded-lg pt-16"
		>
			<Select label="Date column" options={fullHeader} bind:selected={settings.dateCol} />
			<Select
				label="Description column"
				options={fullHeader}
				bind:selected={settings.descriptionCol}
			/>
			<div class="flex flex-col justify-center gap-4">
				<Select label="Amount column" options={fullHeader} bind:selected={settings.amountCol} />
				<Checkbox label="Spendings are negative" bind:checked={settings.spendingsNegative} />
				<Checkbox
					label="Ignore values of opposite sign"
					bind:checked={settings.ignoreOppositeSign}
				/>
			</div>
		</div>
		{#if selectedTag}
			<div class="text-center pt-16">
				<h1
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
				</h1>
			</div>
		{/if}
		<div bind:this={timeCanvas} class="pt-16">
			<slot />
		</div>
		<div bind:this={canvas} class="pt-16">
			<slot />
		</div>
	</div>

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
									>{#each row.slice(0, 3) as col}
										<td
											class="border-b border-slate-100 dark:border-slate-700 p-4 pl-8 text-slate-600 dark:text-slate-400"
											>{col}</td
										>
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
</main>
