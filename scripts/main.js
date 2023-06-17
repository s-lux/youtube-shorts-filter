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
const debugMode = false; // If true, additional details are being logged
const logType_Info = 0;
const logType_Warning = 1;
const logType_Error = 2;
const logType_Debug = 3;
const subsUrlMatch = /(?:.+\.)?youtube\.com\/feed\/subscriptions\/?$/i; // Regular expression of the URL for subscriptions
const shortsUrlMatch = /((?:.+\.)?youtube\.com)\/shorts\/(.+$)/i; // Regular expression of the URL for shorts
const storageItems = ['enableAll', 'whitelistedChannels']; // Keys of the data items in the browser storage

// Shorts redirection
function checkRedirection() {
	// If currently on a video in short-mode, redirect to the same video in default-mode
	if (shortsUrlMatch.test(location.href)) {
		this.log('Redirecting shorts url.', logType_Info);
		location.href = location.href.replace(shortsUrlMatch, '$1/watch?v=$2');
		return true;
	}

	// Watch YouTube's navigation event (doesn't trigger a page reload, code above will not be run again)
	// If going to a video in short-mode, go back and redirect to the video in default-mode instead
	document.addEventListener('yt-navigate-start', event => {
		this.log('document.on(yt-navigate-start)', logType_Debug, event);

		if (shortsUrlMatch.test(event.target.baseURI)) {
			this.log('Redirecting shorts url.', logType_Info);
			history.back();
			location.href = event.target.baseURI.replace(shortsUrlMatch, '$1/watch?v=$2');
		}
	});

	return false;
}

// Shorts filtering
const channelUrlMatch1 = /\/(?<name>@[^\/]+)/i;
const channelUrlMatch2 = /\/channel\/(?<name>[^\/]+)/i;

const observer = new MutationObserver(records => {
	// Check the changes for videos
	this.findMutatedVideos(records);
});

let enableAll = true;
let whitelistedChannels = [];
let videoContainer = null;
let settingsLoaded = false;

// If already determined that we are currently on a video in short-mode, skip the rest of the code.
// Check the URL and only run the filter on the subscriptions page.
if (!this.checkRedirection() &&
	subsUrlMatch.test(location.href)
) {
	this.log('Starting up!', logType_Info);

	// This will only work if the page is done loading, for example if main.js is reloaded; otherwise wait for event "yt-page-data-updated"
	this.findVideoContainer();

	// YouTube event that triggers when the necessary parts of the page have loaded
	document.addEventListener('yt-page-data-updated', event => {
		if (videoContainer === null &&
			event !== null &&
			event.target.tagName.toLowerCase() === 'ytd-page-manager'
		) {
			// The pageManager now contains the necessary data
			this.findVideoContainer();
		}
	});

	// Load the settings from browser storage
	browser.storage.sync.get(storageItems)
		.then(storage => {
			this.log('storage.sync.get.then', logType_Debug, storage);

			// Set 'enableAll' value if it was in storage (otherwise stay with default)
			if (storage.enableAll !== undefined &&
				storage.enableAll !== null
			) {
				enableAll = storage.enableAll;
			}

			// Set 'whitelistedChannels' value if it was in storage (otherwise stay with default)
			if (storage.whitelistedChannels !== undefined &&
				storage.whitelistedChannels !== null
			) {
				whitelistedChannels = storage.whitelistedChannels;
			}
			settingsLoaded = true;

			// Check the entire grid for videos
			this.findAllVideos();
		})
		.catch(error => this.log('Error!', logType_Error, error));

	// Browser event that triggers when the settings have changed
	browser.storage.sync.onChanged.addListener(storage => {
		this.log('storage.sync.onChanged', logType_Debug, storage);

		// Update 'enableAll' value if it has changed
		if (storage.enableAll !== undefined &&
			storage.enableAll !== null &&
			storage.enableAll.newValue !== undefined &&
			storage.enableAll.newValue !== null
		) {
			enableAll = storage.enableAll.newValue;
		}

		// Update 'whitelistedChannels' value if it has changed
		if (storage.whitelistedChannels !== undefined &&
			storage.whitelistedChannels !== null &&
			storage.whitelistedChannels.newValue !== undefined &&
			storage.whitelistedChannels.newValue !== null
		) {
			whitelistedChannels = storage.whitelistedChannels.newValue;
		}

		// Check the entire grid for videos
		this.findAllVideos();
	});
}

function findVideoContainer() {
	// Find the div containing the video grid, and assign it to the 'videoContainer' variable
	videoContainer = document.querySelector('ytd-page-manager div#primary>ytd-rich-grid-renderer>div#contents');
	if (videoContainer !== null) {
		// Observer to watch for changes in the 'items-per-row' attribute of all of 'videoContainer' element's recursive child elements
		observer.observe(videoContainer, {
			subtree: true,
			childList: false,
			attributeFilter: ['items-per-row'],
			attributeOldValue: true,
		});
	}
}

function findMutatedVideos(records) {
	// If there are any changes, and the settings have been loaded
	if (records !== null) {
		// If the 'items-per-row' attributes of 'ytd-rich-item-renderer' elements have changed
		const videos = records
			.filter(record => record.type === 'attributes' &&
				record.oldValue !== null &&
				record.target.tagName.toLowerCase() === 'ytd-rich-item-renderer' &&
				!record.target.parentElement.parentElement.hidden)
			.map(record => record.target)
			.filter((element, ix, elements) => elements.indexOf(element) === ix);

		this.filterVideos(videos);
	}
}

function findAllVideos() {
	// If page contains the video grid, and the settings have been loaded
	if (videoContainer !== null && settingsLoaded === true) {
		// Find all videos
		const videos = Array.from(videoContainer.querySelectorAll('ytd-rich-grid-row ytd-rich-item-renderer'));

		this.filterVideos(videos);
	}
}

function filterVideos(videos) {
	// Check whether to keep video
	if (videos.length > 0) {
		this.log(`filtering ${videos.length} videos`, logType_Info);

		videos.forEach(video => {
			// Load video info
			const videoInfo = this.getVideoInfo(video);

			// Hide the video if global filtering is enabled, the video is a short, and the channel is not whitelisted
			// Otherwise, show it if it is currently hidden
			if (enableAll === true && videoInfo.isShort && !this.isWhitelisted(videoInfo.channelName, videoInfo.channelId)) {
				this.log('hiding video', logType_Debug, videoInfo.videoTitle);
				video.hidden = true;
			}
			else if (video.hidden === true) {
				this.log('unhiding video', logType_Debug, videoInfo.videoTitle);
				video.hidden = false;
			}
		});
	}
}

function getVideoInfo(video) {
	// Load the information necessary to determine if a video is a short, and if it is from a whitelisted channel
	// Find the 'div' element that contains all the required information
	const videoDiv = video.querySelector('ytd-rich-grid-media>div#dismissible');

	let channelName = '';
	let channelId = '';
	let videoTitle = '';
	let isShort = false;

	// Find the 'a' element that links to the video's channel
	const channelLink = getChildElement(videoDiv, ['div#details', 'a#avatar-link']);
	if (channelLink !== null) {
		// The channel's name
		channelName = channelLink.title;

		// the channel's id in '@ChannelName' format
		// or the channel's internal id
		if (channelUrlMatch1.test(channelLink.href))
			channelId = channelUrlMatch1.exec(channelLink.href).groups.name;
		else if (channelUrlMatch2.test(channelLink.href))
			channelId = channelUrlMatch2.exec(channelLink.href).groups.name;
	}

	// Find the 'a' element that links to the video
	const videoLink = getChildElement(videoDiv, ['div#details', 'a#video-title-link']);
	if (videoLink !== null) {
		// The video's title
		videoTitle = videoLink.title
		// Check if the video links to a short
		isShort = shortsUrlMatch.test(videoLink.href);
	}

	return {
		channelName,
		channelId,
		videoTitle,
		isShort,
	};
}

function getChildElement(parentElement, selectors) {
	// Unfortunately the otherwise very helpful 'querySelector' function doesn't work for all elements.
	// Assuming it is because some of the DOM is loaded after the page is done loading as far as the browser knows
	// Thus this function tries to do something similar for elements where 'querySelector' doesn't work
	this.log('getChildElement', logType_Debug, [parentElement, selectors]);

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

function isWhitelisted(channelName, channelId) {
	// Check if a channel's name or id are in the whilelist
	if (whitelistedChannels !== undefined && whitelistedChannels !== null) {
		return whitelistedChannels.find(item => (channelName !== '' && item.name.toLowerCase() === channelName.toLowerCase()) ||
			(channelId !== '' && item.name.toLowerCase() === channelId.toLowerCase())) !== undefined
	}
	else {
		return false;
	}
}

function log(message, type, details = null) {
	// Log messages to the browser's console
	switch (type) {
		case logType_Info:
		case logType_Debug: {
			if (type === logType_Info || debugMode) {
				if (details !== undefined && details !== null) {
					console.log(`YTSF: ${message}\n${JSON.stringify(details)}`);
				}
				else {
					console.log(`YTSF: ${message}`);
				}
			}
			break;
		}
		case logType_Warning: {
			if (details !== undefined && details !== null) {
				console.warn(`YTSF: ${message}\n${JSON.stringify(details)}`);
			}
			else {
				console.warn(`YTSF: ${message}`);
			}
			break;
		}
		case logType_Error: {
			if (details !== undefined && details !== null) {
				console.error(`YTSF: ${message}\n${JSON.stringify(details)}`);
			}
			else {
				console.error(`YTSF: ${message}`);
			}
			break;
		}
	}
}
