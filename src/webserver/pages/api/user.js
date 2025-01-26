module.exports = function (webserver, endpoint) {
	webserver.get(endpoint, function (req, res) {
		res.result.setResult({
			email: res.locals.user.email,
			picture: res.locals.user.gravatarPicture(),
		}).end(200);
	});
};
