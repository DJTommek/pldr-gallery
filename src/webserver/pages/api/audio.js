module.exports = function (webserver, endpoint) {
	// Code for streaming is for audio the same as for video
	require('./helpers/audio-video')(webserver, endpoint);
};
