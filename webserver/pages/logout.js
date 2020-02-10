module.exports = function (webserver, baseEndpoint) {
	
	/**
	 * Google logout - just redirect, more info in "/api/logout"
	 */
	webserver.get(baseEndpoint, function (req, res) {
		res.redirect('/api/logout');
	});
};
