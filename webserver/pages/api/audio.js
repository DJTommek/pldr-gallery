module.exports = function (webserver, endpoint) {
	// Code for streaming is for audio the same as for video
	require(__dirname + '/helpers/audio-video')(webserver, endpoint);
};
