module.exports = function (webserver, endpoint) {
	webserver.get(endpoint, function (req, res) {
		res.setHeader("Content-Type", "application/json");
		res.statusCode = 200;
		res.result.setResult({
			email: res.locals.user.email,
			picture: res.locals.user.gravatarPicture(),
		}).end();
	});
};
