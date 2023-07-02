const storageItems = ['enableAll', 'filterMode', 'channelList'];

let enableCheck;
let enableSpan;
let enabledText;
let disabledText;

window.onload = function () {
	// Find HTML elements
	const extensionNameDiv1 = document.getElementById('extensionName1');
	const extensionNameDiv2 = document.getElementById('extensionName2');
	enableCheck = document.getElementById('enableAll');
	enableSpan = document.getElementById('enableAllText');
	const optionsButton = document.getElementById('options');
	const optionsTextSpan = document.getElementById('optionsText');

	// Get localized texts
	extensionNameDiv1.innerText = browser.i18n.getMessage('extensionNameLine1');
	extensionNameDiv2.innerText = browser.i18n.getMessage('extensionNameLine2');
	enabledText = browser.i18n.getMessage('checkboxEnabled');
	disabledText = browser.i18n.getMessage('checkboxDisabled');
	enableSpan.innerText = disabledText;
	optionsTextSpan.innerText = browser.i18n.getMessage('buttonOptions');

	// Functionality
	enableCheck.disabled = true;
	enableCheck.checked = false;
	enableCheck.addEventListener('change', e => {
		browser.storage.sync.get(storageItems)
			.then(storage => {
				if (storage.enableAll !== e.target.checked) {
					storage.enableAll = e.target.checked === true;

					browser.storage.sync.set(storage)
						.catch(error => console.error(error));
				}
			})
			.catch(error => console.error(error));

		this.switchEnabled();
	});

	optionsButton.addEventListener('click', () => {
		browser.runtime.sendMessage('openOptions');
	});

	// Load settings from browser storage
	browser.storage.sync.get(storageItems)
		.then(storage => {
			enableCheck.checked = this.nulUnd(storage.enableAll) || storage.enableAll;
			enableCheck.disabled = false;

			this.switchEnabled();
		})
		.catch(error => console.error(error));
};

function switchEnabled() {
	enableSpan.innerText = enableCheck.checked === true ? enabledText : disabledText;
}

function nulUnd(object) {
	return object === undefined || object === null;
}
