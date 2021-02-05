var ClientOAuth2 = require('client-oauth2');

export class PsaClient{
    
    async authentictate(clientId, clientSecret, username, password)
    {
        var psaAuth = new ClientOAuth2({
            clientId: clientId,
            clientSecret: clientSecret,
            accessTokenUri: 'https://idpcvs.peugeot.com/am/oauth2/access_token',
            authorizationUri: 'https://api.mpsa.com/api/connectedcar/v2/oauth/authorize',
            scopes: ['openid', 'profile']
        });

        var user = await psaAuth.owner.getToken(username, password)
        return {accessToken:user.accessToken, refreshToken:user.refreshToken};
    }

    async readVehicles(authInfo){
        
    }
}