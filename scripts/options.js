const storageItems = ['enableAll', 'filterMode', 'channelList'];

let enableCheck; // DOM element
let enableSpan; // DOM element
let modeCheck; // DOM element
let modeSpan; // DOM element
let listTitleSpan; // DOM element
let listInputText; // DOM element
let channelTable; // DOM element
let rowTemplate; // DOM element
let enabledText; // string
let disabledText; // string
let modeWhitelist; // string
let modeBlacklist; // string
let blacklistTitle; // string
let whitelistTitle; // string
let removeText; // string
let channelList; // Array

window.onload = function () {
	// Find HTML elements
	enableCheck = document.getElementById('enableAll');
	enableSpan = document.getElementById('enableAllText');
	modeCheck = document.getElementById('mode');
	modeSpan = document.getElementById('modeText');
	listTitleSpan = document.getElementById('listTitle');
	listInputText = document.getElementById('listInput');
	channelTable = document.getElementById('channelTable');
	rowTemplate = document.getElementById('rowTemplate');
	const extensionNameDiv = document.getElementById('extensionName');
	const listAddButton = document.getElementById('listAdd');
	const versionLabelSpan = document.getElementById('versionLabel')
	const versionNumberLink = document.getElementById('versionNumber');
	const developerLabelSpan = document.getElementById('developerLabel');
	const developerNameLink = document.getElementById('developerName');

	// Get localized texts
	extensionNameDiv.innerText = browser.i18n.getMessage('extensionName');
	enabledText = browser.i18n.getMessage('checkboxEnabled');
	disabledText = browser.i18n.getMessage('checkboxDisabled');
	enableSpan.innerText = disabledText;
	modeWhitelist = browser.i18n.getMessage('checkboxWhitelistMode');
	modeBlacklist = browser.i18n.getMessage('checkboxBlacklistMode');
	modeSpan.innerText = modeWhitelist;
	blacklistTitle = browser.i18n.getMessage('blacklistTitle');
	whitelistTitle = browser.i18n.getMessage('whitelistTitle');
	listTitleSpan.innerText = whitelistTitle;
	listInputText.placeholder = browser.i18n.getMessage('listAddText');
	listAddButton.value = browser.i18n.getMessage('listAddButton');
	removeText = browser.i18n.getMessage('listRemoveButton');

	// Manifest Data
	const manifest = browser.runtime.getManifest();
	versionLabelSpan.innerText = browser.i18n.getMessage('version');
	versionNumberLink.href = `${manifest.homepage_url}/tag/v${manifest.version}`;
	versionNumberLink.innerText = manifest.version;
	developerLabelSpan.innerText = browser.i18n.getMessage('developer');
	developerNameLink.href = manifest.developer.url;
	developerNameLink.innerText = manifest.developer.name;

	// Functionality
	enableCheck.disabled = true;
	enableCheck.checked = false;
	enableCheck.addEventListener('change', e => {
		browser.storage.sync.get(storageItems)
			.then(storage => {
				if (storage.enableAll !== e.target.checked) {
					storage.enableAll = e.target.checked;

					browser.storage.sync.set(storage)
						.catch(error => console.error(error));
				}
			})
			.catch(error => console.error(error));

		this.switchEnabled();
	});

	modeCheck.disabled = true;
	modeCheck.checked = false;
	modeCheck.addEventListener('change', e => {
		browser.storage.sync.get(storageItems)
			.then(storage => {
				if ((storage.filterMode === 'whitelist') !== e.target.checked) {
					storage.filterMode = e.target.checked ? 'whitelist' : 'blacklist';

					browser.storage.sync.set(storage)
						.catch(error => console.error(error));
				}
			})
			.catch(error => console.error(error));

		this.switchMode();
	});

	listAddButton.addEventListener('click', () => {
		addChannelEvent();
	});

	// Load settings from browser storage
	browser.storage.sync.get(storageItems)
		.then(storage => {
			enableCheck.checked = this.nulUnd(storage.enableAll) || storage.enableAll;
			enableCheck.disabled = false;
			this.switchEnabled();

			modeCheck.checked = this.nulUnd(storage.filterMode) || storage.filterMode === 'whitelist';
			modeCheck.disabled = false;
			this.switchMode();

			channelList = storage.channelList;
			this.drawChannels();
		})
		.catch(error => console.error(error));

	// Browser event that triggers when the settings have changed
	browser.storage.sync.onChanged.addListener(storage => {
		// Update 'enableAll' value if it has changed
		if (!this.nulUnd(storage.enableAll) &&
			!this.nulUnd(storage.enableAll.newValue)
		) {
			enableCheck.checked = storage.enableAll.newValue;
			this.switchEnabled();
		}
	});
};

function switchEnabled() {
	enableSpan.innerText = enableCheck.checked === true ? enabledText : disabledText;
}

function switchMode() {
	modeSpan.innerText = modeCheck.checked === true ? modeWhitelist : modeBlacklist;
	listTitleSpan.innerText = modeCheck.checked === true ? whitelistTitle : blacklistTitle;
}

function drawChannels() {
	// Delete existing table
	while (channelTable.children.length > 0) {
		channelTable.children[0].remove();
	}

	if (!this.nulUnd(channelList)) {
		channelList.forEach(channel => {
			const row = rowTemplate.cloneNode(true);
			const checkInput = row.querySelector('input#enableTemplate');
			checkInput.id = `enable${channel.id}`;
			checkInput.checked = channel.enabled;

			checkInput.addEventListener('change', e => {
				this.checkChannelEvent(e.target.id, e.target.checked);
			});

			const checkLabel = row.querySelector('label[for="enableTemplate"]');
			checkLabel.setAttribute('for', checkInput.id);

			const channelNameDiv = row.querySelector('div.list-sub-row>div.channel-name');
			channelNameDiv.innerText = channel.name;

			const channelRemoveButton = row.querySelector('div.list-sub-row>div.remove>input[type="button"]');
			channelRemoveButton.id = `remove${channel.id}`;
			channelRemoveButton.value = removeText;

			channelRemoveButton.addEventListener('click', e => {
				this.removeChannelEvent(e.target.id);
			});

			channelTable.appendChild(row);
		});

	}
}

function addChannelEvent() {
	const channelText = listInputText.value;
	listInputText.value = '';

	if (this.nulUnd(channelText) || channelText === '')
		return;

	browser.storage.sync.get(storageItems)
		.then(storage => {
			if (this.nulUnd(storage.channelList)) {
				storage.channelList = [];
			}
			const maxId = storage.channelList
				.map(item => item.id)
				.reduce((a, b) => Math.max(a, b), -1);

			storage.channelList.push({
				id: maxId + 1,
				name: channelText,
				enabled: true
			});

			storage.channelList.sort((a, b) => {
				const nameA = a.name.toUpperCase();
				const nameB = b.name.toUpperCase();

				if (nameA < nameB) {
					return -1;
				}
				if (nameA > nameB) {
					return 1;
				}
				return 0;
			});

			this.saveChannels(storage);
		})
		.catch(error => console.error(error));
}

function removeChannelEvent(buttonId) {
	if (buttonId.length <= 6 || buttonId.substr(0, 6) !== 'remove')
		return;

	const id = buttonId.substr(6);

	browser.storage.sync.get(storageItems)
		.then(storage => {
			if (!this.nulUnd(storage.channelList)) {
				const channel = storage.channelList.find(item => item.id == id) // don't use ===, because item.id is int, id is string

				if (!this.nulUnd(channel)) {
					const ix = storage.channelList.indexOf(channel);
					storage.channelList.splice(ix, 1);
					this.saveChannels(storage);
				}
			}
		})
		.catch(error => console.error(error));
}

function checkChannelEvent(checkId, checked) {
	if (checkId.length <= 6 || checkId.substr(0, 6) !== 'enable')
		return;

	const id = checkId.substr(6);

	browser.storage.sync.get(storageItems)
		.then(storage => {
			if (!this.nulUnd(storage.channelList)) {
				const channel = storage.channelList.find(item => item.id == id) // don't use ===, because item.id is int, id is string

				if (!this.nulUnd(channel)) {
					channel.enabled = checked;
					this.saveChannels(storage);
				}
			}
		})
		.catch(error => console.error(error));
}

function saveChannels(storage) {
	browser.storage.sync.set(storage)
		.then(() => {
			channelList = storage.channelList;
			this.drawChannels();
		})
		.catch(error => console.error(error));
}

function nulUnd(object) {
	return object === undefined || object === null;
}
