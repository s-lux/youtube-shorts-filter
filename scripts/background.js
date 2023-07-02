browser.runtime.onMessage.addListener(message => {
	switch (message) {
		case 'openOptions':
			let optionsUrl = browser.runtime.getURL('../pages/options.html');

			// Check if already open
			browser.tabs.query({
				url: optionsUrl
			})
				.then(result => {
					if (result !== undefined && result !== null && result.length > 0) {
						browser.tabs.highlight({
							tabs: [result[0].index]
						})
							.catch(error => console.error(error));
					}
					else {
						browser.tabs.create({
							url: optionsUrl
						})
							.catch(error => console.error(error));
					}
				})
				.catch(error => console.error(error));
			return false;
	}
	return false;
});
