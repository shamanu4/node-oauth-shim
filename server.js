// Demonstation of integration
let oauthshim = require('./index.js'),
	express = require('express');

let app = express();

// Define a path where to put this OAuth Shim
app.all('/proxy', oauthshim);

// Load credentials from database
const {Client} = require('pg');

const client = new Client({
	user: process.env.PGUSER || 'postgres',
	password: process.env.PGPASSWORD || '',
	host: process.env.PGHOST || 'localhost',
	port: process.env.PGPORT || 5432,
	database: process.env.PGDB || 'livecodingtv',
});

const query =
	"SELECT provider, client_id, secret from socialaccount_socialapp " +
	"WHERE provider IN ('linkedin_oauth2', 'twitter', 'github');"

const domain = process.env.FQDN || "www.liveedu.tv";

client.connect();

function frontend_network_mapping(network) {
	if (network === "windowslive") {
		return "windows"
	}
	if (network === "linkedin_oauth2") {
		return "linkedin"
	}
	return network
}

let creds = require('./credentials-template.json');

client.query(query, (err, res) => {
	res.rows.forEach(function (element) {
		const network = frontend_network_mapping(element.provider)
		creds.forEach(function (e) {
			if (e.name === network) {
				e.domain = domain;
				e.client_id = element.client_id;
				e.client_secret = element.secret;
			}
		});
	});
	client.end();
	console.log("Credentials prepared:");
	// console.log(creds);

	// After all data is returned, close connection and start server
	oauthshim.init(creds);
	// Set application to listen on PORT
	app.listen(process.env.PORT);
	console.log('OAuth Shim listening on ' + process.env.PORT);
});
