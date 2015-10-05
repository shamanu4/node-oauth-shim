//
// OAuth2
// Process OAuth2 exchange
//

var request = require('./utils/request');
var param = require('./utils/param');
var url = require('url');
var error_credentials = require('./error_credentials');

module.exports = function(p, callback) {

	// Missing Credentials
	if (!p.client_secret) {
		callback(error_credentials(p));
		return;
	}

	// Make the OAuth2 request
	var post = null;
	if (p.code) {
		post = {
			code: p.code,
			client_id: p.client_id || p.id,
			client_secret: p.client_secret,
			grant_type: 'authorization_code',
			redirect_uri: encodeURIComponent(p.redirect_uri)
		};
	}
	else if (p.refresh_token) {
		post = {
			refresh_token: p.refresh_token,
			client_id: p.client_id || p.id,
			client_secret: p.client_secret,
			grant_type: 'refresh_token',
		};
	}

	// Get the grant_url
	var grant_url = p.oauth ? p.oauth.grant : false;

	if (!grant_url) {
		return callback({
			error: 'required_grant',
			error_message: 'Missing parameter state.oauth.grant url',
			state: p.state || ''
		});
	}

	//log('OAUTH2-GRANT-REQUEST', grant_url, post);

	// Convert the post object literal to a string
	post = param(post, function(r) {return r;});

	// Create the request
	var r = url.parse(grant_url);
	r.method = 'POST';
	r.headers = {
		'Content-length': post.length,
		'Content-type': 'application/x-www-form-urlencoded'
	};

	// Workaround for Vimeo, which requires an extra Authorization header
	// TODO: Make this generic (configurable from outside library)
	if (p.authorisation === 'header') {
		r.headers.Authorization = 'basic ' + new Buffer(p.client_id + ':' + p.client_secret).toString('base64');
	}

	//opts.body = post;
	request(r, post, function(err, res, body) {

		var data = {};

		if (body) {
			//log(body);
			try {
				data = JSON.parse(body);
			}
			catch (e) {
				try {
					data = param(body.toString('utf8', 0, body.length));
				}
				catch (e2) {
					console.error('Grant response is not valid JSON');
				}
			}
		}

		// Check responses
		if (err || !body || (!('access_token' in data) && !('error' in data))) {
			if (!data || typeof(data) !== 'object') {
				data = {};
			}
			data.error = 'invalid_grant';
			if (err) {
				data.error_message = 'Could not find the authenticating server, ' + grant_url;
			}
			else {
				data.error_message = 'Could not get a sensible response from the authenticating server, ' + grant_url;
			}
		}
		else if ('access_token' in data && !('expires_in' in data)) {
			data.expires_in = 3600;
		}

		if (p.state) {
			data.state = p.state || '';
		}

		// If the refresh token was on the original request lets return it.
		if (p.refresh_token && !data.refresh_token) {
			data.refresh_token = p.refresh_token;
		}


		// Return to the handler
		callback(data);
	});
};
