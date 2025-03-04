const DomainError = require('./DomainError.js');

/**
 * Error message will be shown in the response.
 */
class HttpResponseError extends DomainError {
	constructor(message, httpCode = 500) {
		super(message);

		/**
		 * @var {number}
		 */
		this.httpCode = httpCode;
	}
}

module.exports = HttpResponseError;
