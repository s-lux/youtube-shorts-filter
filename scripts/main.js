/*
*** Simplified layout of YouTube video list on the subscriptions page ***
ytd-page-manager
	ytd-rich-grid-renderer
		ytd-rich-item-renderer
			ytd-rich-grid-media
				div#dismissible
					ytd-thumbnail
*** Short ***
						a#thumbnail href="/shorts/{video id}"
							ytd-thumbnail-overlay-time-status-renderer overlay-style="SHORTS"
								span#text aria-label="Shorts"
									SHORTS
*** Normal video ***
						a#thumbnail href="/watch?v={video id}"
							ytd-thumbnail-overlay-time-status-renderer overlay-style="DEFAULT"
								span#text aria-label="{video duration longform}"
									{video duration shortform}
*** Same for both ***
					div#details
						a#avatar-link title="{channel text}" href="{channel name|channel/id}"
*** Short ***
						a#video-title-link href="/shorts/{video id}"
*** Normal video ***
						a#video-title-link href="/watch?v={video id}"
*** Same for both ***
							yt-formatted-string#video-title
								{video title}

						ytd-channel-name#channel-name
							a href="{channel id}"
								{channel text}
*/
const storageItems = ["enableAll", "whitelistedChannels"];
const debugMode = false;
let enableAll = true;
let whitelistedChannels = [];

const shortsUrlMatch = /((?:.+\.)?youtube\.com)\/shorts\/(.+$)/i;

if (shortsUrlMatch.exec(location.href)) {
	this.debugLog('redirecting shorts url to video url');
	location.href = location.href.replace(shortsUrlMatch, '$1/watch?v=$2');
}

this.debugLog('startup()');
browser.storage.sync.get(storageItems)
	.then(storage => {
		this.debugLog('startup() -> storage loaded');
		this.debugLog(storage);

		if (storage.enableAll !== undefined &&
			storage.enableAll !== null
		) {
			enableAll = storage.enableAll;
		}

		if (storage.whitelistedChannels !== undefined &&
			storage.whitelistedChannels !== null
		) {
			whitelistedChannels = storage.whitelistedChannels;
		}
		this.filterShorts();
	})
	.catch(error => console.error(error));

browser.storage.sync.onChanged.addListener(storage => {
	this.debugLog('listener: storage changed');
	this.debugLog(storage);

	if (storage.enableAll !== undefined &&
		storage.enableAll !== null &&
		storage.enableAll.newValue !== undefined &&
		storage.enableAll.newValue !== null
	) {
		enableAll = storage.enableAll.newValue;
	}

	if (storage.whitelistedChannels !== undefined &&
		storage.whitelistedChannels !== null &&
		storage.whitelistedChannels.newValue !== undefined &&
		storage.whitelistedChannels.newValue !== null
	) {
		whitelistedChannels = storage.whitelistedChannels.newValue;
	}
	this.filterShorts();
});

const observer = new MutationObserver(() => this.filterShorts());
observer.observe(document.querySelector('#content'), {
	childList: true,
	subtree: true
});

document.addEventListener("yt-navigate-start", event => {
	if (shortsUrlMatch.exec(event.target.baseURI)) {
		this.debugLog('redirecting shorts url to video url');
		history.back();
		location.href = event.target.baseURI.replace(shortsUrlMatch, '$1/watch?v=$2');
	}
});

function getChildElement(parentElement, selectors) {
	const selectorMatch1 = /^(?<tag>[\w-]+)(#(?<id>[^#\[\.]+))?\s*?(?<attrs>\[.+\])?$/i;
	const selectorMatch2 = /\[(?<name>[\w-]+?)\s*?=\s*?(?:"(?<val1>.*?)"|(?<val2>.*?))\]/ig;
	let childElement = null;

	for (let i = 0; i < selectors.length; i++) {
		const groups = selectorMatch1.exec(selectors[i]).groups;
		const tag = groups.tag || '';
		const id = groups.id || '';
		const attributes = Array.from((groups.attrs || '').matchAll(selectorMatch2))
			.map(attr => ({
				name: attr.groups.name,
				value: attr.groups.val1 || attr.groups.val2
			}));

		const elements = Array.from((childElement || parentElement).getElementsByTagName(tag))
			.filter(element => (id === '' || element.id === id) &&
				attributes.every(a => a.value.split(' ').indexOf(element[a.name]) !== -1));

		if (elements.length === 1)
			childElement = elements[0];
		else {
			childElement = null;
			break;
		}
	}

	return childElement;
}

function filterShorts() {
	// Check the path and only run the filter on pages where filtering is currently implemented.
	const pathMatch = /^\/feed\/subscriptions\/?$/i;
	if (!pathMatch.test(location.pathname)) {
		return;
	}

	this.debugLog('filterShorts()', whitelistedChannels);

	// const videos = Array.from(document.querySelectorAll('ytd-page-manager ytd-rich-grid-renderer ytd-rich-item-renderer ytd-rich-grid-media>div#dismissible'));
	// videos.forEach(video => {
	// 	const videoLink1 = getChildElement(video, ['ytd-thumbnail', 'a#thumbnail']);
	// 	if (videoLink1 === null) return;

	// 	// if (shortsUrlMatch.exec(videoLink1.href)) {
	// 	// 	videoLink1.href = videoLink1.href.replace(shortsUrlMatch, '$1/watch?v=$2');
	// 	// }

	// 	const statusRenderer = getChildElement(videoLink1, ['ytd-thumbnail-overlay-time-status-renderer']);
	// 	if (statusRenderer === null) return;

	// 	if (statusRenderer.attributes['overlay-style'].value === 'shorts') {
	// 		video.style.display = 'hidden';
	// 	}

	// 	const videoDetails = getChildElement(video, ['div#details']);
	// 	if (videoDetails === null) return;

	// 	const videoLink2 = getChildElement(videoDetails, ['a#video-title-link']);
	// 	if (videoLink2 === null) return;

	// 	// const videoText2 = getChildElement(videoLink2, ['yt-formatted-string#video-title']);
	// 	// if (videoText2 === null) return;

	// 	const channelLink = getChildElement(videoDetails, ['a#avatar-link']); // Option 1
	// 	//const channelLink = getChildElement(videoDetails, ['ytd-channel-name#channel-name', 'a']); // Option 2
	// 	if (channelLink === null) return;

	// 	const channelTitle = channelLink.title; // Option 1
	// 	//const channelTitle = channelLink.innerText; // Option 2
	// 	const channelUrl = channelLink.href;

	// 	return {
	// 		channelTitle,
	// 		channelUrl,
	// 		type,
	// 		videoTitle: videoLink2.title,
	// 		videoUrl: videoLink2.href,
	// 	};
	// });

	const channelUrlMatch1 = /\/(?<name>@[^\/]+)/i;
	const channelUrlMatch2 = /\/channel\/(?<name>[^\/]+)/i;

	// Find all videos
	const videos = Array.from(document.querySelectorAll('ytd-page-manager ytd-rich-grid-renderer ytd-rich-item-renderer'))
		.map(video => {
			let channelId = '';
			let channelName = '';

			const channelLink = getChildElement(video, ['ytd-rich-grid-media', 'div#dismissible', 'div#details', 'a#avatar-link']);
			if (channelLink !== null) {
				channelName = channelLink.title;

				if (channelUrlMatch1.test(channelLink.href))
					channelId = channelUrlMatch1.exec(channelLink.href).groups.name;
				else if (channelUrlMatch2.test(channelLink.href))
					channelId = channelUrlMatch2.exec(channelLink.href).groups.name;
			}

			let isShort = false;
			const videoLink = getChildElement(video, ['ytd-thumbnail', 'a#thumbnail']);

			if (videoLink !== null) {
				const statusRenderer = getChildElement(videoLink, ['ytd-thumbnail-overlay-time-status-renderer']);
				isShort = (statusRenderer !== null && statusRenderer.attributes['overlay-style'].value.toLowerCase() === 'shorts');
			}

			return {
				channelName,
				channelId,
				isShort,
				tag: video
			};
		});

	this.debugLog('videos[].length', videos.length);

	if (whitelistedChannels !== undefined &&
		whitelistedChannels !== null
	) {
		// Check whether to keep video
		videos.forEach(video => {
			let keep = video.isShort !== true ||
				whitelistedChannels.find(wlc => wlc.name.toLowerCase() === video.channelName.toLowerCase() ||
					wlc.name.toLowerCase() === video.channelId.toLowerCase()) !== undefined;

			if (enableAll === true && keep !== true) {
				this.debugLog('hiding video');
				//this.debugLog(video);
				video.tag.hidden = true;
			}
			else if (video.tag.hidden === true) {
				this.debugLog('unhiding video');
				//this.debugLog(video);
				video.tag.hidden = false;
			}
		});
	}
	else {
		videos.forEach(video => {
			if (enableAll === true && video.isShort === true) {
				this.debugLog('hiding video');
				//this.debugLog(video);
				video.tag.hidden = true;
			}
			else if (video.tag.hidden === true) {
				this.debugLog('unhiding video');
				//this.debugLog(video);
				video.tag.hidden = false;
			}
		});
	}
}

function debugLog(message, info = null) {
	if (debugMode) {
		console.log(`YTFS: ${message}`);
		if (info !== undefined && info !== null) {
			console.log(`YTFS: ${JSON.stringify(info)}`);
		}
	}
}
