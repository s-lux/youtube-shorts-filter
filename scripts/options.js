const storageItems = ["enableAll", "whitelistedChannels"];

window.onload = function() {
	let addButton = document.getElementById("whitelistChannelAdd");
	addButton.value = browser.i18n.getMessage("addButton");
	addButton.addEventListener("click", () => {
		addChannelEvent();
	});

	// Get localized texts
	document.getElementById("titleText").innerText = browser.i18n.getMessage("extensionName");
	document.getElementById("whitelistLegendLabel").innerText = browser.i18n.getMessage("groupLegendWhitelist");
	document.getElementById("whitelistChannelNameLabel").innerText = browser.i18n.getMessage("channelNameLabel");
	document.getElementById("whitelistChannelAdd").value = browser.i18n.getMessage("addButton");

	// Version
	document.getElementById("versionLabel").innerText = browser.i18n.getMessage("version");
	const manifest = browser.runtime.getManifest();
	document.getElementById("versionNumber").innerText = manifest.version;

	drawChannels();
};

function drawChannels() {
	browser.storage.sync.get(storageItems)
		.then(storage => {
			if (storage.whitelistedChannels !== undefined &&
				storage.whitelistedChannels !== null
			) {
				const buttonText = browser.i18n.getMessage("removeButton");
				const channelsTable = document.getElementById("channelList");

				// Delete existing table
				while (channelsTable.rows.length > 0) {
					channelsTable.deleteRow(0);
				}

				for (i = 0; i < storage.whitelistedChannels.length; i++) {
					const channel = storage.whitelistedChannels[i];

					const row = channelsTable.insertRow();

					const cell1 = row.insertCell();
					cell1.innerText = channel.name;

					const cell2 = row.insertCell();
					let removeButton = document.createElement("input");
					removeButton.id = "remove" + channel.id.toString();
					removeButton.type = "button";
					removeButton.className = "button"
					removeButton.value = buttonText;
					cell2.appendChild(removeButton);

					removeButton.addEventListener("click", e => {
						this.removeChannelEvent(e.target.id);
					});
				}
			}
		})
		.catch(error => console.error(error));
}

function addChannelEvent() {
	let add = document.getElementById("whitelistChannelName");
	const channel = add.value;
	add.value = "";

	if (channel == undefined || channel == null || channel == "")
		return;

	browser.storage.sync.get(storageItems)
		.then(storage => {
			if (storage.whitelistedChannels === undefined ||
				storage.whitelistedChannels === null
			) {
				storage.whitelistedChannels = [];
			}
			const maxId = storage.whitelistedChannels
				.map(item => item.id)
				.reduce((a, b) => Math.max(a, b), -1);

			storage.whitelistedChannels.push({
				id: maxId + 1,
				name: channel
			});

			storage.whitelistedChannels.sort((a, b) => {
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
	if (buttonId.length <= 6)
		return;

	const id = buttonId.substr(6);

	browser.storage.sync.get(storageItems)
		.then(storage => {
			if (storage.whitelistedChannels !== undefined &&
				storage.whitelistedChannels !== null
			) {
				const channel = storage.whitelistedChannels.find(item => item.id == id)

				if (channel !== undefined &&
					channel !== null
				) {
					const ix = storage.whitelistedChannels.indexOf(channel);
					storage.whitelistedChannels.splice(ix, 1);
					this.saveChannels(storage);
				}
			}
		})
		.catch(error => console.error(error));
}

function saveChannels(storage) {
	browser.storage.sync.set(storage)
		.then(() => {
			this.drawChannels();
		})
		.catch(error => console.error(error));
}
