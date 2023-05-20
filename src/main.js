/*
*** Simplified layout of YouTube video list on the subscriptions page ***
ytd-page-manager
	ytd-browse
	ytd-two-column-browse-results-renderer
	div id="primary"
	ytd-section-list-renderer
		div id="contents"
		ytd-item-section-renderer
		div id="contents"
		ytd-shelf-renderer
			div id="dismissible"
			div id="contents"
			ytd-grid-renderer
			div id="items"
*** Important stuff starts here ***
				ytd-grid-video-renderer
				div id="dismissible"
				ytd-thumbnail
*** Short ***
				a id="thumbnail" href="/shorts/{video id}"
*** Normal video ***
				a id="thumbnail" href="/watch?v={video id}"
*** Same for both ***
					yt-image
					img
					div id="overlays"
*** Short ***
					ytd-thumbnail-overlay-time-status-renderer overlay-style="SHORTS"
					span id="text" aria-label="Shorts"
					SHORTS
*** Normal video ***
					ytd-thumbnail-overlay-time-status-renderer overlay-style="DEFAULT"
					span id="text" aria-label="{video duration longform}"
					{video duration shortform}
*** Same for both ***
				div id="details"
				div id="text-metadata"
					div id="meta"
					h3
*** Short ***
					a id="video-title" href="/shorts/gyDADf-c_hw"
*** Normal video ***
					a id="video-title" href="/watch?v=LjO5hkJzf0A"
*** Same for both ***
					div id="metadata-container"
					div id="metadata"
					div id="byline-container"
						ytd-channel-name
						div id="container"
						div id="text-container"
						yt-formatted-string
							a href="{channel id}"
							{channel text}
*/
let debugMode = false;
let whitelistedChannels = [];
let observer = null;

this.debugLog('startup()');
browser.storage.sync.get(["whitelistedChannels"])
	.then(storage => {
		this.debugLog('startup() -> storage loaded');
		this.debugLog(storage);
		whitelistedChannels = storage.whitelistedChannels;
		this.filterShorts();
	})
	.catch(error => console.error(error));

browser.storage.onChanged.addListener(storage => {
	this.debugLog('listener: storage changed');
	this.debugLog(storage);
	whitelistedChannels = storage.whitelistedChannels.newValue;
	this.filterShorts();
});

observer = new MutationObserver(() => this.filterShorts());
observer.observe(document.querySelector('#content'), {
	childList: true,
	subtree: true
});

function filterShorts() {
	// Check the path and only run the filter on pages where filtering is currently implemented.
	let pathMatch = /\/subscriptions\/?$/;
	if (!pathMatch.test(document.location.pathname)) {
		return;
	}

	console.log('filterShorts');
	this.debugLog('filterShorts()', whitelistedChannels);

	// Find all shorts
	let shorts = Array.from(document.getElementsByTagName('ytd-grid-video-renderer'))
		.filter(video => {
			let timeStatus = video.getElementsByTagName('ytd-thumbnail-overlay-time-status-renderer').item(0);
			return timeStatus !== null &&
				timeStatus.attributes['overlay-style'] !== undefined &&
				timeStatus.attributes['overlay-style'].value.toLowerCase() === 'shorts';
		});

	this.debugLog('shorts.length: ' + shorts.length.toString());
	if (whitelistedChannels !== undefined &&
		whitelistedChannels !== null
	) {
		// Check whether to keep short
		shorts.forEach(short => {
			let keep = false;

			let channelName = short.getElementsByTagName('ytd-channel-name').item(0);
			if (channelName !== null) {
				let formattedString = channelName.getElementsByTagName('yt-formatted-string').item(0);
				if (formattedString !== null) {
					let link = formattedString.getElementsByTagName('a').item(0);
					if (link !== null) {
						if (whitelistedChannels.find(wlc => wlc.name.toLowerCase() === link.text.toLowerCase()) !== undefined) {
							// Channel name matches whitelist entry, keep short
							keep = true;
						}
						else {
							let channelIdMatch = /\/(?<name>@.+?)(\/.*)?$/i.exec(link.href);
							// If channel id matches whitelist entry, keep short
							keep = channelIdMatch !== null &&
								channelIdMatch.groups.name !== null &&
								whitelistedChannels.find(wlc => wlc.name.toLowerCase() === channelIdMatch.groups.name.toLowerCase()) !== undefined;
						}
					}
				}
			}
			if (keep === true) {
				if (short.hidden === true) {
					this.debugLog('unhiding short');
					this.debugLog(short);
					short.hidden = false;
				}

				// // Replace URL
				// this.debugLog('replacing url');
				// this.debugLog(short);
				// Array.from(short.getElementsByTagName('a'))
				// 	.filter(a => /^.*\/shorts\/.+$/i.test(a.href))
				// 	.forEach(a => a.href = a.href.replace(/\/shorts\//i, '/watch?v='));
			}
			else {
				this.debugLog('hiding short');
				this.debugLog(short);
				short.hidden = true;
			}
		});
	}
	else {
		shorts.forEach(short => {
			this.debugLog('hiding short');
			this.debugLog(short);
			short.hidden = true;
		});
	}
}

function debugLog(message, info = null) {
	if (debugMode) {
		console.log(message);
		if (info !== undefined && info !== null) {
			console.log(info);
		}
	}
}
