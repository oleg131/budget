// src/stores/content.js
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const DEFAULT_TAGS = {
	'Ext Credit Card Debit GO POCHA                 LOS ANGELES  CA': ['pocha'],
	'Ext Credit Card Debit TST* AHGASSI GOPCHANG    LOS ANGELES  CA': ['restaurant'],
	'Ext Credit Card Debit TST* EGG TUCK - KOREAT   LOS ANGELES  CA': ['restaurant'],
	'Ext Credit Card Debit MAGGY MAID               TUSTIN       CA': ['bills']
};

// Set the stored value or a sane default.
export const content = writable((browser && localStorage.content) || JSON.stringify(DEFAULT_TAGS));

// Anytime the store changes, update the local storage value.
content.subscribe((value) => {
	if (browser) return (localStorage.content = value);
});

export const settingsStore = writable((browser && localStorage.settings) || '{}');
settingsStore.subscribe((value) => {
	if (browser) return (localStorage.settings = value);
});
