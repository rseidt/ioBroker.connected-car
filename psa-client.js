var ClientOAuth2 = require('client-oauth2');
var superagent = require("superagent");

class PsaClient {


    constructor(clientId, clientSecret, username, password, userToken, adapterInstance) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.username = username;
        this.password = password;
        this.userToken = userToken;
        this.psaAuth = new ClientOAuth2({
            clientId: this.clientId,
            clientSecret: this.clientSecret,
            accessTokenUri: 'https://idpcvs.peugeot.com/am/oauth2/access_token',
            authorizationUri: 'https://api.mpsa.com/api/connectedcar/v2/oauth/authorize',
            scopes: ['openid', 'profile']
        });
        this.adapterInstance = adapterInstance;
    }

    async authentictate() {
        var oldToken = this.psaAuth.createToken(this.userToken);
        try {
            var newToken = await oldToken.refresh();
            if (this.adapterInstance)
                await this.adapterInstance.setStateAsync('userToken', JSON.stringify(newToken.data), true);
            this.userToken = newToken;
        } catch (e) {
            await this.signIn();
        }
    }

    async signIn() {
        var token = await this.psaAuth.owner.getToken(this.username, this.password);
        if (this.adapterInstance)
            await this.adapterInstance.setStateAsync('userToken', JSON.stringify(token.data),true);
        this.userToken = token;
    }

    async readVehicles(tryNo) {
        if (!tryNo)
            tryNo = 0;
        let response;
        if (!this.userToken.access_token)
            await this.authentictate();
        try {
            console.log('starting request.');
            response = await superagent.get("https://api.groupe-psa.com/connectedcar/v4/user/vehicles?client_id=" + this.clientId)
                .set('Authorization', 'Bearer ' + this.userToken.access_token)
                .set('x-introspect-realm', 'clientsB2CPeugeot')
                .set('accept', 'application/hal+json')
            if (response.status == 200)
            {
                return response.body._embedded.vehicles;
            } else {
                throw ('Unexpected response code ' + response.status)
            }
        } catch (e) {
            if (!e.response.status || e.response.status != 401 || tryNo > 2)
                throw(e);
            await this.authentictate();
            response = await this.readVehicles(++tryNo);
        }
    }
}
module.exports.PsaClient = PsaClient;