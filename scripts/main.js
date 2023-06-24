/*
*** Simplified layout of YouTube video list on the subscriptions page ***
*ytd-page-manager
*└┐
* └─div#primary
<<Grid Layout>>
*   └─ytd-rich-grid-renderer
*   ┊ └─div#contents
*   ┊   ╘═ytd-rich-grid-row
*   ┊     └┐
*   ┊      ╘═ytd-rich-item-renderer[items-per-row] => var 'video'
*   ┊        └┐
*   ┊         └─ytd-rich-grid-media
*   ┊           └─div#dismissible
*   ┊             └─div#details
*   ┊               ├─a#avatar-link href="{channel url}" title="{channel title}" -> channel url: (@ChannelName)|channel/(ChannelId); var 'channelLink'
*   ┊               └┐
*   ┊                └─a#video-title-link href="{video url}" title="{video title}" -> video url: /shorts/(VideoId)|/watch?v=(VideoId); var 'videoLink'
<<List Layout>>
*   └─ytd-section-list-renderer
*     └─div#contents
*       ╘═ytd-item-section-renderer
*         └┐
*          └─ytd-shelf-renderer
*            └─div#dismissible
*              ├┐
*              │└─div#title-container
*              │  └┐
*              │   └─div#image-container
*              │     └─a href="{channel url}" title="{channel title}" -> channel url: (@ChannelName)|channel/(ChannelId); var 'channelLink'
*              │       └─yt-img-shadow#avatar
*              └─div#contents
*                └┐
*                 └─div#grid-container
*                   └┐
*                    └─div#title-wrapper
*                      └┐
*                       └─a#video-title href="{video url}" title="{video title}" -> video url: /shorts/(VideoId)|/watch?v=(VideoId); var 'videoLink'
*/
const debugMode = false; // If true, additional details are being logged
const logType_Info = 0;
const logType_Warning = 1;
const logType_Error = 2;
const logType_Debug = 3;
const subsUrlMatch = /(?:.+\.)?youtube\.com\/feed\/subscriptions(?:\?flow=\d)?\/?$/i; // Regular expression of the URL for subscriptions
const shortsUrlMatch = /((?:.+\.)?youtube\.com)\/shorts\/(.+$)/i; // Regular expression of the URL for shorts
const storageItems = ['enableAll', 'whitelistedChannels']; // Keys of the data items in the browser storage
const channelUrlMatch1 = /\/(?<name>@[^\/]+)/i;
const channelUrlMatch2 = /\/channel\/(?<name>[^\/]+)/i;
let enableAll = false;
let whitelistedChannels = [];
let settingsLoaded = false;
let queueActive = false;
let waitContainer = null;

this.log('Initializing!', logType_Info);

const app = document.querySelector('ytd-app');
if (this.notNulUnd(app)) {
	waitContainer = document.createElement('div');
	waitContainer.style.display = 'none'; // grid
	waitContainer.style.inset = '0';
	waitContainer.style.position = 'fixed';
	waitContainer.style.zIndex = '2500';
	waitContainer.innerHTML =
		'<svg version="1.1" xml:space="preserve" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" style="margin: auto; max-height: 50%; max-width: 50%; opacity: .5;">\n' +
		'	<path fill="#ffffff" d="m 417.30243,968.37394 c -8.3132,0 -16.52502,-3.92217 -20.68154,-3.92217 -12.36829,-7.84455 -20.68152,-23.43797 -20.68152,-35.10903 V 589.73341 L 11.883569,94.094999 C 3.5703456,82.423941 -0.48477133,66.735086 7.7270695,51.14164 16.040293,39.470604 28.40861,31.626053 44.933427,31.626053 H 955.02212 c 16.52502,0 28.99454,7.844551 37.2064,19.515587 8.31318,11.671058 4.15666,27.36016 -4.15652,39.031174 L 624.1176,589.73341 v 261.54698 c 0,15.59345 -8.31298,27.36016 -24.83804,35.10904 l -165.45231,78.06234 c -4.15645,3.92217 -8.21157,3.92217 -16.52482,3.92217 z" />\n' +
		'</svg>';
	app.after(waitContainer);

	const background = document.createElement('div');
	background.style.background = '#404040';
	background.style.inset = '0';
	background.style.opacity = '0.75';
	background.style.position = 'absolute';
	background.style.zIndex = '-1';
	waitContainer.append(background);
}

// Watch YouTube's navigation event (doesn't trigger a page reload)
document.addEventListener('yt-navigate-start', event => {
	this.log('document.on(yt-navigate-start)', logType_Debug, { event });

	if (shortsUrlMatch.test(event.target.baseURI)) {
		// Navigated to a short
		this.log('Redirecting shorts url.', logType_Info);
		history.back();
		location.href = event.target.baseURI.replace(shortsUrlMatch, '$1/watch?v=$2');
	}
	else if (subsUrlMatch.test(event.target.baseURI)) {
		// Navigated to the subscriptions
		// Queue filtering of the displayed videos
		this.queueFilter(1000);
	}
});

// If currently on a video in short-mode, redirect to the same video in default-mode
if (shortsUrlMatch.test(location.href)) {
	this.log('Redirecting shorts url.', logType_Info);
	location.href = location.href.replace(shortsUrlMatch, '$1/watch?v=$2');
}
// If currently on the subscriptions page, run the filter
else if (subsUrlMatch.test(location.href)) {
	// Queue filtering of the displayed videos
	this.queueFilter(1000);

	// YouTube event that triggers when the necessary parts of the page have loaded
	document.addEventListener('yt-page-data-updated', event => {
		if (this.notNulUnd(event) &&
			event.target.tagName.toLowerCase() === 'ytd-page-manager'
		) {
			// The pageManager now contains the necessary data -> queue filtering
			this.queueFilter(1000);
		}
	});

	// Load the settings from browser storage
	browser.storage.sync.get(storageItems)
		.then(storage => {
			this.log('storage.sync.get.then', logType_Debug, { storage });

			// Set 'enableAll' value if it was in storage (otherwise stay with default)
			if (this.notNulUnd(storage.enableAll))
				enableAll = storage.enableAll;

			// Set 'whitelistedChannels' value if it was in storage (otherwise stay with default)
			if (this.notNulUnd(storage.whitelistedChannels))
				whitelistedChannels = storage.whitelistedChannels;

			settingsLoaded = true;

			// Check the entire grid for videos
			this.queueFilter(250);
		})
		.catch(error => this.log('Error!', logType_Error, { error }));

	// Browser event that triggers when the settings have changed
	browser.storage.sync.onChanged.addListener(storage => {
		this.log('storage.sync.onChanged', logType_Debug, { storage });

		// Update 'enableAll' value if it has changed
		if (this.notNulUnd(storage.enableAll) &&
			this.notNulUnd(storage.enableAll.newValue)
		) {
			enableAll = storage.enableAll.newValue;
		}

		// Update 'whitelistedChannels' value if it has changed
		if (this.notNulUnd(storage.whitelistedChannels) &&
			this.notNulUnd(storage.whitelistedChannels.newValue)
		) {
			whitelistedChannels = storage.whitelistedChannels.newValue;
		}

		// Check the entire grid for videos
		this.queueFilter(250);
	});
}

function queueFilter(wait) {
	this.log('Queue filtering', logType_Debug, { queueActive, settingsLoaded });

	if (!queueActive && settingsLoaded) {
		queueActive = true;
		// Add visual indication that filter is queued
		if (enableAll && this.notNulUnd(waitContainer) && subsUrlMatch.test(location.href))
			waitContainer.style.display = 'grid';

		window.setTimeout(() => {
			queueActive = false;
			// Remove visual indication that filter is queued
			if (this.notNulUnd(waitContainer))
				waitContainer.style.display = 'none';

			// Find the div containing the videos
			const gridContainer = document.querySelector('ytd-page-manager div#primary>ytd-rich-grid-renderer>div#contents');
			if (this.notNulUnd(gridContainer) && gridContainer.checkVisibility()) {
				this.log('Filtering grid view', logType_Debug);

				// Grid view
				const videos = Array.from(gridContainer.querySelectorAll('ytd-rich-grid-row ytd-rich-item-renderer'));
				this.filterVideos(videos, true);

				// Disconnect, in case there was already an observer set
				gridObserver.disconnect();

				// Observer to watch for changes in the 'items-per-row' attribute of all of 'videoContainer' element's recursive child elements
				gridObserver.observe(gridContainer, {
					subtree: true,
					childList: false,
					attributeFilter: ['items-per-row'],
					attributeOldValue: true,
				});
			}
			else {
				const listContainer = document.querySelector('ytd-page-manager div#primary>ytd-section-list-renderer>div#contents');
				if (this.notNulUnd(listContainer) && listContainer.checkVisibility()) {
					this.log('Filtering list view', logType_Debug);

					// List view
					const videos = Array.from(listContainer.querySelectorAll('ytd-item-section-renderer'));
					this.filterVideos(videos, false);

					// Disconnect, in case there was already an observer set
					listObserver.disconnect();

					// Observer to watch for additions to child list
					listObserver.observe(listContainer, {
						subtree: false,
						childList: true,
					});
				}
			}
		}, wait);
	}
}

const gridObserver = new MutationObserver(records => {
	// If there are any changes, and the settings have been loaded
	if (enableAll && this.notNulUnd(records)) {
		this.log('gridObserver.observe()', logType_Debug);

		// If the 'items-per-row' attributes of 'ytd-rich-item-renderer' elements have changed
		const videos = records
			.filter(record => record.type === 'attributes' &&
				this.notNulUnd(record.oldValue) &&
				record.target.tagName.toLowerCase() === 'ytd-rich-item-renderer' &&
				record.target.parentElement.parentElement.tagName.toLowerCase() === 'ytd-rich-grid-row' &&
				!record.target.parentElement.parentElement.hidden)
			.map(record => record.target)
			.filter((element, ix, elements) => elements.indexOf(element) === ix); // This filter spits out a distinct list

		this.filterVideos(videos, true);
	}
});

const listObserver = new MutationObserver(records => {
	// If there are any changes, and the settings have been loaded
	if (enableAll && this.notNulUnd(records)) {
		this.log('listObserver.observe()', logType_Debug);

		const videos = records
			.filter(record => record.type === 'childList' &&
				record.addedNodes.length > 0)
			.flatMap(record => Array.from(record.addedNodes))
			.filter((element, ix, elements) => elements.indexOf(element) === ix); // This filter spits out a distinct list

		this.filterVideos(videos, false);
	}
});

function filterVideos(videos, gridMode) {
	// Check whether to keep video
	if (this.notNulUnd(videos) && videos.length > 0) {
		this.log('filterVideos', logType_Debug, { videos, gridMode });

		const hidden = [];
		const shown = [];
		let channelSelector;
		let videoSelector;

		if (gridMode) {
			channelSelector = 'ytd-rich-grid-media div#dismissible>div#details>a#avatar-link';
			videoSelector = 'ytd-rich-grid-media div#dismissible>div#details a#video-title-link';
		}
		else {
			channelSelector = 'ytd-shelf-renderer>div#dismissible div#title-container div#image-container>a';
			videoSelector = 'ytd-shelf-renderer>div#dismissible>div#contents div#grid-container div#title-wrapper a#video-title';
		}

		videos.forEach(video => {
			// Load the information necessary to determine if a video is a short, and if it is from a whitelisted channel
			let channelName = '';
			let channelId = '';
			let videoTitle = '';
			let isShort = false;

			// Find the 'a' element that links to the video's channel
			const channelLink = video.querySelector(channelSelector);
			if (this.notNulUnd(channelLink)) {
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
			const videoLink = video.querySelector(videoSelector);
			if (this.notNulUnd(videoLink)) {
				// The video's title
				videoTitle = videoLink.title
				// Check if the video links to a short
				isShort = shortsUrlMatch.test(videoLink.href);
			}

			// Hide the video if global filtering is enabled, the video is a short, and the channel is not whitelisted
			// Otherwise, show it if it is currently hidden
			if (enableAll && isShort && !this.isWhitelisted(channelName, channelId)) {
				hidden.push({ channelName, channelId, videoTitle });
				video.hidden = true;
			}
			else if (video.hidden === true) {
				shown.push({ channelName, channelId, videoTitle });
				video.hidden = false;
			}
		});

		if (hidden.length > 0)
			this.log('hidden videos', logType_Info, hidden);

		if (shown.length > 0)
			this.log('shown videos', logType_Info, shown);
	}
}

function isWhitelisted(channelName, channelId) {
	// Check if a channel's name or id are in the whilelist
	if (this.notNulUnd(whitelistedChannels)) {
		return whitelistedChannels.find(item => (channelName !== '' && item.name.toLowerCase() === channelName.toLowerCase()) ||
			(channelId !== '' && item.name.toLowerCase() === channelId.toLowerCase())) !== undefined
	}
	else {
		return false;
	}
}

function log(message, type, details = null) {
	// Log messages to the browser's console
	if (type === logType_Info ||
		(type === logType_Debug && debugMode) ||
		type === logType_Warning ||
		type === logType_Error
	) {
		console.group('YouTube-Shorts Filter');

		if (type === logType_Info)
			console.info(message);
		else if (type === logType_Debug && debugMode)
			console.debug(message);
		else if (type === logType_Warning)
			console.warn(message);
		else if (type === logType_Error) {
			console.error(message);
			console.trace();
		}

		if (this.notNulUnd(details))
			console.log(details);
		console.groupEnd();
	}
}

function notNulUnd(object) {
	return object !== undefined && object !== null;
}
