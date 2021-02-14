const ClientOAuth2 = require('client-oauth2');
const superagent = require("superagent");
const mqtt = require("mqtt");
const crypto = require("crypto");


class PsaClient {


    constructor(clientId, clientSecret, username, password, userToken, cert, key, adapterInstance) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.username = username;
        this.password = password;
        this.userToken = userToken;
        this.cert = cert;
        this.key = key;
        this.psaAuth = new ClientOAuth2({
            clientId: this.clientId,
            clientSecret: this.clientSecret,
            accessTokenUri: 'https://idpcvs.peugeot.com/am/oauth2/access_token',
            authorizationUri: 'https://api.mpsa.com/api/connectedcar/v2/oauth/authorize',
            scopes: ['openid', 'profile']
        });
        this.adapterInstance = adapterInstance;
        
        this.customerId = "";
        this.MQTT_SERVER = "mqtt://mwa.mpsa.com"
        this.MQTT_REQ_TOPIC = "psa/RemoteServices/from/cid/"
        this.MQTT_RESP_TOPIC = "psa/RemoteServices/to/cid/"
        this.MQTT_EVENT_TOPIC = "psa/RemoteServices/events/MPHRTServices/"
        this.MQTT_TOKEN_TTL = 890
        this.mqtt_client = mqtt.connect(this.MQTT_SERVER);
        this.mqtt_client.on("error", function(err) { 
            throw err; 
        });
    }

    async connectMqtt()
    {
        // "com.psa.mym.mypeugeot":  {"realm": "clientsB2CPeugeot",  "brand_code": "AP", "app_name": "MyPeugeot"},
        var site_code = "AP_DE_ESP"
        var HOST_BRANDID_PROD = "https://id-dcr.peugeot.com/mobile-services";
        var response = null;
        try{
        response = await superagent.post(HOST_BRANDID_PROD + "/GetAccessToken")
        .set('Content-Type', 'application/json')
        .query({ "jsonRequest" : JSON.stringify({
            "siteCode": site_code, 
            "culture": "fr-FR", 
            "action": "authenticate",
            "fields": {
                "USR_EMAIL": {"value": this.username},
                "USR_PASSWORD": {"value": this.password}
            }
        })});
        } catch(err) {
            throw err;
        }
        if (response.status == 200)
        {                                                                                                                                       
            this.mqttToken = response.body.accessToken;
            try{
            var uidresponse = await superagent.post('https://mw-ap-m2c.mym.awsmpsa.com/api/v1/user?culture=fr_FR&width=1080&v=1.27.0')
                .send({"site_code": site_code, "ticket": this.mqttToken})
                .set('Content-Type','application/json;charset=UTF-8')
                .set('Source-Agent','App-Android')
                .set('Token',this.mqttToken)
                .set("User-Agent", "okhttp/4.8.0")
                .set('Version', '1.27.0')
                .cert(this.cert)
                .key(this.key)
            if (uidresponse.status == 200)
            {
                this.customerId = 'AP-' + uidresponse.body.success.id
            } else {
                throw ('Could not aqcuire mqqt customer id: ' + response.status)
            }
        } catch(err) {
            throw (err);
        }
        } else {
            throw ('Could not aqcuire mqqt access token: ' + response.status);
        }
        
        /*this.mqtt_client.addListener()
        self.refresh_remote_token()
        self.mqtt_client.tls_set_context()
        self.mqtt_client.on_connect = self.on_mqtt_connect
        self.mqtt_client.on_message = self.on_mqtt_message
        self.mqtt_client.on_disconnect = self.on_mqtt_disconnect
        self.mqtt_client.connect(MQTT_SERVER, 8885, 60)*/
    }

    async wakeup(vin){
        var message = this.createMqttRequest(vin, {"action": "state"})
        this.mqtt_client.publish(this.MQTT_REQ_TOPIC + this.customerId + "/VehCharge/state", message)
    }

    async createCorrelationId()
    {
        return crypto.randomBytes(16).toString("hex");
    }

    createMqttRequest(vin, req_parameters)
    {
        
        var date = new Date();
        var sDate = 
            date.getUTCFullYear() + "-"
            +(date.getUTCMonth()*1+1) + "-"
            +date.getUTCDate() + "T"
            +date.getUTCHours() + ":"
            +date.getUTCMinutes() + ":"
            +date.getUTCSeconds() + "Z"
        var data = {"access_token": this.userToken.access_token, "customer_id": this.customerId,
        "correlation_id": this.createCorrelationId(), "req_date": sDate, "vin": vin,
        "req_parameters": req_parameters}
        return JSON.stringify(data);
    }

    async authentictate() {
        var oldToken = this.psaAuth.createToken(this.userToken);
        try {
            var newToken = await oldToken.refresh();
            if (this.adapterInstance)
                await this.adapterInstance.setStateAsync('userToken', JSON.stringify(newToken.data), true);
            this.userToken = newToken.data;
        } catch (e) {
            await this.signIn();
        }
    }

    async signIn() {
        var token = await this.psaAuth.owner.getToken(this.username, this.password);
        if (this.adapterInstance)
            await this.adapterInstance.setStateAsync('userToken', JSON.stringify(token.data),true);
        this.userToken = token.data;
    }

    async readVehicles()
    {
        var response = await this.readApi("https://api.groupe-psa.com/connectedcar/v4/user/vehicles");
        return response._embedded.vehicles
    }

    async readChannel(channelURL)
    {
        var response = await this.readApi(channelURL);
        return response;
    }


    async readApi(url, tryNo) {
        if (!tryNo)
            tryNo = 0;
        let response;
        if (!this.userToken.access_token)
            await this.authentictate();
        try {
            response = await superagent.get(url + "?client_id=" + this.clientId)
                .set('Authorization', 'Bearer ' + this.userToken.access_token)
                .set('x-introspect-realm', 'clientsB2CPeugeot')
                //.set('accept', 'application/hal+json')
            if (response.status == 200)
            {
                return response.body;
            } else {
                throw ('Unexpected response code ' + response.status)
            }
        } catch (e) {
            if (!e.response.status || e.response.status != 401 || tryNo > 2)
                throw(e);
            await this.authentictate();
            return await this.readApi(url, ++tryNo);
        }
    }
}
module.exports.PsaClient = PsaClient;