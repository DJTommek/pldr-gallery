/**
 * Errors of which message can be shown to the user.
 */
class DomainError extends Error {}

if (typeof module !== 'undefined') {
	module.exports = DomainError;
}
