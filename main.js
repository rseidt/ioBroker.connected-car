'use strict';

/*
 * Created with @iobroker/create-adapter v1.26.3
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require('@iobroker/adapter-core');
const psa = require('./psa-client');
// Load your modules here, e.g.:
// const fs = require("fs");

class ConnectedCar extends utils.Adapter {


    psaClient = null;
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    constructor(options) {
        super({
            ...options,
            name: 'connected-car',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */



    async onReady() {
        // Initialize your adapter here

        this.setState('info.connection', false, true);
        var self = this;
        await this.setObjectNotExistsAsync('userToken', { type: 'state', common: { name: 'userToken', type: 'string', role: 'value', read: true, write: true }, native: {} });
        var stateUserToken = await this.getStateAsync('userToken');
        if (!stateUserToken)
            userToken = '{}';
        else
            var userToken = stateUserToken.val
            if (!userToken)
                userToken = '{}';
            else
                userToken = '' + userToken;
        
        this.psaClient = new psa.PsaClient(this.config.clientId, this.config.clientSecret, this.config.username, this.config.password, JSON.parse(userToken), this.config.cert, this.config.key, this);
        await this.psaClient.connectMqtt();
        try{
            
            var vehicles = await this.psaClient.readVehicles();
            for (var i = 0 ; i < vehicles.length; i++)
            {
                await this.psaClient.wakeup(vehicles[i].vin);
            }
            self.buildVehiclesTree(vehicles);
            self.setState('info.connection', true, true);
        } catch (e) {
            self.log.error('Error loading Vehicles: ' + e);
        }
    

        // Reset the connection indicator during startup
        

        // The adapters config (in the instance object everything under the attribute "native") is accessible via
        // this.config:


        /*
        For every state in the system there has to be also an object of type state
        Here a simple template for a boolean variable named "testVariable"
        Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
        */



        // In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
        //this.subscribeStates('userToken');
        // You can also add a subscription for multiple states. The following line watches all states starting with "lights."
        // this.subscribeStates('lights.*');
        // Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
        // this.subscribeStates('*');

        /*
            setState examples
            you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
        */
        // the variable testVariable is set to true as command (ack=false)
        // same thing, but the value is flagged "ack"
        // ack should be always set to true if the value is received from or acknowledged from the target system
        //await this.setStateAsync('testVariable', { val: true, ack: true });

        // same thing, but the state is deleted after 30s (getState will return null afterwards)
        //await this.setStateAsync('testVariable', { val: true, ack: true, expire: 30 });

        // examples for the checkPassword/checkGroup functions
        //let result = await this.checkPasswordAsync('admin', 'iobroker');
        //this.log.info('check user admin pw iobroker: ' + result);

        //result = await this.checkGroupAsync('admin', 'admin');
        //this.log.info('check group user admin group admin: ' + result);
    }

    async buildVehiclesTree(vehicles){
        var self = this;
        for (var i = 0; i<vehicles.length;i++)
        {
            var device = await this.createDeviceAsync(vehicles[i].vin);
            var channelAlerts = await this.createChannelAsync(vehicles[i].vin, 'alerts')
            var channelLastPosition = await this.createChannelAsync(vehicles[i].vin, 'lastPosition')
            var channelMaintenance = await this.createChannelAsync(vehicles[i].vin, 'maintenance')
            var channelStatus = await this.createChannelAsync(vehicles[i].vin, 'status')
            var channelTelemetry = await this.createChannelAsync(vehicles[i].vin, 'telemetry')
            var channelTrips = await this.createChannelAsync(vehicles[i].vin, 'trips')
            var channelPictures = await this.createChannelAsync(vehicles[i].vin, 'pictures')

            var alertsUrl = vehicles[i]._links.alerts.href;
            var alerts = await this.psaClient.readChannel(alertsUrl);
            console.log(JSON.stringify(alerts));
            var lastPositionUrl = vehicles[i]._links.lastPosition.href;
            var lastPos = await this.psaClient.readChannel(lastPositionUrl);
            console.log(JSON.stringify(lastPos));
            var maintenanceUrl = vehicles[i]._links.maintenance.href;
            var statusUrl = vehicles[i]._links.status.href;
            var status = await this.psaClient.readChannel(statusUrl);
            await this.buildStatusTree(status, vehicles[i].vin+'.status');
            var telemertyUrl = vehicles[i]._links.telemetry.href;
            
            var tripsUrl = vehicles[i]._links.trips.href;

            await this.setObjectNotExistsAsync(vehicles[i].vin + '.id', { type: 'state', common: { name: 'id', type: 'string', role: 'value', read: true, write: true }, native: {} });
            self.setStateAsync(vehicles[i].vin + '.id', vehicles[i].id, true);
            await this.setObjectNotExistsAsync(vehicles[i].vin + '.brand', { type: 'state', common: { name: 'brand', type: 'string', role: 'value', read: true, write: true }, native: {} });
            self.setStateAsync(vehicles[i].vin + '.brand', vehicles[i].brand, true);
            for(var j = 0;j< vehicles[i].pictures.length;j++){
                var sj = ''+j;
                while (sj.length < 3)
                    sj = '0' + sj;
                await self.setObjectNotExistsAsync(vehicles[i].vin + '.pictures.img_' + sj, { type: 'state', common: { name: 'img_' + j, type: 'string', role: 'value', read: true, write: true }, native: {} });
                self.setStateAsync(vehicles[i].vin + '.pictures.img_' + sj, vehicles[i].pictures[j], true);
            }
        }
    }

    async buildStatusTree(status, parentId)
    {
        await this.setObjectNotExistsAsync(parentId+'.lastPosition.long', { type: 'state', common: { name: 'lastPositionLong', type: 'number', role: 'value', read: true, write: false }, native: {} });
        this.setStateAsync(parentId+'.lastPosition.long', status.lastPosition.geometry.coordinates[0], true);
        await this.setObjectNotExistsAsync(parentId+'.lastPosition.lat', { type: 'state', common: { name: 'lastPositionLat', type: 'number', role: 'value', read: true, write: false }, native: {} });
        this.setStateAsync(parentId+'.lastPosition.lat', status.lastPosition.geometry.coordinates[1], true);
        await this.setObjectNotExistsAsync(parentId+'.lastPosition.alt', { type: 'state', common: { name: 'lastPositionAlt', type: 'number', role: 'value', read: true, write: false }, native: {} });
        this.setStateAsync(parentId+'.lastPosition.alt', status.lastPosition.geometry.coordinates[2], true);
        await this.setObjectNotExistsAsync(parentId+'.lastPosition.lastUpdated', { type: 'state', common: { name: 'lastPositionUpdated', type: 'string', role: 'value', read: true, write: false }, native: {} });
        this.setStateAsync(parentId+'.lastPosition.lastUpdated', status.lastPosition.properties.updatedAt, true);

        await this.setObjectNotExistsAsync(parentId+'.preconditioning.lastUpdated', { type: 'state', common: { name: 'preConditioningUpdated', type: 'string', role: 'value', read: true, write: false }, native: {} });
        this.setStateAsync(parentId+'.preconditioning.lastUpdated', status.preconditionning.airConditioning.updatedAt, true);
        await this.setObjectNotExistsAsync(parentId+'.preconditioning.enabled', { type: 'state', common: { name: 'preConditioningEnbled', type: 'boolean', role: 'value', read: true, write: false }, native: {} });
        this.setStateAsync(parentId+'.preconditioning.enabled', status.preconditionning.airConditioning.status == "Enabled", true);
        
        for (var i = 0 ; i < status.preconditionning.airConditioning.programs.length ; i++)
        {
            var s = '' + status.preconditionning.airConditioning.programs[i].slot;
            while (s.length < 2)
                s = '0' + s;
            await this.setObjectNotExistsAsync(parentId+'.preconditioning.program'+s + '.enabled', { type: 'state', common: { name: 'preConditioningProgram_' + s + '_Enabled', type: 'boolean', role: 'value', read: true, write: false }, native: {} });
            this.setStateAsync(parentId+'.preconditioning.program'+s+ '.enabled', status.preconditionning.airConditioning.programs[i].enabled == "true", true);
            await this.setObjectNotExistsAsync(parentId+'.preconditioning.program'+s + '.recurrence', { type: 'state', common: { name: 'preConditioningProgram_' + s + '_Recurrence', type: 'string', role: 'value', read: true, write: false }, native: {} });
            this.setStateAsync(parentId+'.preconditioning.program'+s+ '.recurrence', status.preconditionning.airConditioning.programs[i].recurrence, true);
            await this.setObjectNotExistsAsync(parentId+'.preconditioning.program'+s + '.start', { type: 'state', common: { name: 'preConditioningProgram_' + s + '_Start', type: 'string', role: 'value', read: true, write: false }, native: {} });
            this.setStateAsync(parentId+'.preconditioning.program'+s+ '.start', status.preconditionning.airConditioning.programs[i].start, true);
        }

        for (var i = 0; i < status.energy.length ; i++)
        {
            if (status.energy[i].type === "Electric")
            {
                await this.setObjectNotExistsAsync(parentId+'.energy.electric.level', { type: 'state', common: { name: 'electricEnergyLevel', type: 'number', role: 'value', read: true, write: false }, native: {} });
                this.setStateAsync(parentId+'.energy.electric.level', status.energy[i].level, true);
                await this.setObjectNotExistsAsync(parentId+'.energy.electric.autonomy', { type: 'state', common: { name: 'electricAutonomy', type: 'number', role: 'value', read: true, write: false }, native: {} });
                this.setStateAsync(parentId+'.energy.electric.autonomy', status.energy[i].autonomy, true);
                await this.setObjectNotExistsAsync(parentId+'.energy.electric.lastUpdated', { type: 'state', common: { name: 'electricEneryLastUpdated', type: 'string', role: 'value', read: true, write: false }, native: {} });
                this.setStateAsync(parentId+'.energy.electric.lastUpdated', status.energy[i].autonomy, true);

                await this.setObjectNotExistsAsync(parentId+'.energy.electric.plugged', { type: 'state', common: { name: 'plugged', type: 'boolean', role: 'value', read: true, write: false }, native: {} });
                this.setStateAsync(parentId+'.energy.electric.plugged', status.energy[i].charging.plugged, true);
                await this.setObjectNotExistsAsync(parentId+'.energy.electric.status', { type: 'state', common: { name: 'plugState', type: 'string', role: 'value', read: true, write: false }, native: {} });
                this.setStateAsync(parentId+'.energy.electric.status', status.energy[i].charging.status, true);
                await this.setObjectNotExistsAsync(parentId+'.energy.electric.remainingChargeTime', { type: 'state', common: { name: 'remainingChargeTime', type: 'string', role: 'value', read: true, write: false }, native: {} });
                this.setStateAsync(parentId+'.energy.electric.remainingChargeTime', status.energy[i].charging.remainingTime, true);
                await this.setObjectNotExistsAsync(parentId+'.energy.electric.chargingRate', { type: 'state', common: { name: 'remainingChargeTime', type: 'number', role: 'value', read: true, write: false }, native: {} });
                this.setStateAsync(parentId+'.energy.electric.chargingRate', status.energy[i].charging.chargingRate, true);
                await this.setObjectNotExistsAsync(parentId+'.energy.electric.chargingMode', { type: 'state', common: { name: 'chargingMode', type: 'string', role: 'value', read: true, write: false }, native: {} });
                this.setStateAsync(parentId+'.energy.electric.chargingMode', status.energy[i].charging.chargingMode, true);
                await this.setObjectNotExistsAsync(parentId+'.energy.electric.nextChargeDelayTime', { type: 'state', common: { name: 'chargingMode', type: 'string', role: 'value', read: true, write: false }, native: {} });
                this.setStateAsync(parentId+'.energy.electric.nextChargeDelayTime', status.energy[i].charging.nextDelayedTime, true);
            } else {
                await this.setObjectNotExistsAsync(parentId+'.energy.'+status.energy[i].type+'.unsupported', { type: 'state', common: { name: 'energyType' + status.energy[i].type + 'Unsupported', type: 'string', role: 'value', read: true, write: false }, native: {} });
                this.setStateAsync(parentId+'.energy.'+status.energy[i].type+'.unsupported', 'this adapter currentyl only supports energy details for electric drive', true);
            }
        }
        await this.setObjectNotExistsAsync(parentId+'.battery.voltage', { type: 'state', common: { name: 'batteryVoltage', type: 'number', role: 'value', read: true, write: false }, native: {} });
        this.setStateAsync(parentId+'.battery.voltage', status.battery.voltage, true);
        await this.setObjectNotExistsAsync(parentId+'.battery.current', { type: 'state', common: { name: 'batteryCurrent', type: 'number', role: 'value', read: true, write: false }, native: {} });
        this.setStateAsync(parentId+'.battery.current', status.battery.current, true);
        await this.setObjectNotExistsAsync(parentId+'.battery.createdAt', { type: 'state', common: { name: 'batteryCreatedAt', type: 'string', role: 'value', read: true, write: false }, native: {} });
        this.setStateAsync(parentId+'.battery.createdAt', status.battery.createdAt, true);
        await this.setObjectNotExistsAsync(parentId+'.kinetic.moving', { type: 'state', common: { name: 'moving', type: 'boolean', role: 'value', read: true, write: false }, native: {} });
        this.setStateAsync(parentId+'.kinetic.moving', status.kinetic.moving, true);
        await this.setObjectNotExistsAsync(parentId+'.kinetic.createdAt', { type: 'state', common: { name: 'kineticCreatedAt', type: 'string', role: 'value', read: true, write: false }, native: {} });
        this.setStateAsync(parentId+'.kinetic.createdAt', status.kinetic.createdAt, true);
        await this.setObjectNotExistsAsync(parentId+'.service.type', { type: 'state', common: { name: 'serviceType', type: 'string', role: 'value', read: true, write: false }, native: {} });
        this.setStateAsync(parentId+'.service.type', status.service.type, true);
        await this.setObjectNotExistsAsync(parentId+'.service.lastUpdated', { type: 'state', common: { name: 'serviceLastUpdated', type: 'string', role: 'value', read: true, write: false }, native: {} });
        this.setStateAsync(parentId+'.service.lastUpdated', status.service.updatedAt, true);
        await this.setObjectNotExistsAsync(parentId+'.odometer.mileage', { type: 'state', common: { name: 'mileage', type: 'number', role: 'value', read: true, write: false }, native: {} });
        this.setStateAsync(parentId+'.odometer.mileage', status['timed.odometer'].mileage, true);
        await this.setObjectNotExistsAsync(parentId+'.lastUpdated', { type: 'state', common: { name: 'mileage', type: 'string', role: 'value', read: true, write: false }, native: {} });
        this.setStateAsync(parentId+'.lastUpdated', status.updatedAt, true);
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     * @param {() => void} callback
     */
    onUnload(callback) {
        try {
            // Here you must clear all timeouts or intervals that may still be active
            // clearTimeout(timeout1);
            // clearTimeout(timeout2);
            // ...
            // clearInterval(interval1);

            callback();
        } catch (e) {
            callback();
        }
    }

    // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
    // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
    // /**
    //  * Is called if a subscribed object changes
    //  * @param {string} id
    //  * @param {ioBroker.Object | null | undefined} obj
    //  */
    // onObjectChange(id, obj) {
    //     if (obj) {
    //         // The object was changed
    //         this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
    //     } else {
    //         // The object was deleted
    //         this.log.info(`object ${id} deleted`);
    //     }
    // }

    /**
     * Is called if a subscribed state changes
     * @param {string} id
     * @param {ioBroker.State | null | undefined} state
     */
    onStateChange(id, state) {
        if (state) {
            // The state was changed
            this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
        } else {
            // The state was deleted
            this.log.info(`state ${id} deleted`);
        }
    }

    // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
    // /**
    //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
    //  * Using this method requires "common.message" property to be set to true in io-package.json
    //  * @param {ioBroker.Message} obj
    //  */
    // onMessage(obj) {
    //     if (typeof obj === 'object' && obj.message) {
    //         if (obj.command === 'send') {
    //             // e.g. send email or pushover or whatever
    //             this.log.info('send command');

    //             // Send response in callback if required
    //             if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
    //         }
    //     }
    // }

}

// @ts-ignore parent is a valid property on module
if (module.parent) {
    // Export the constructor in compact mode
    /**
     * @param {Partial<utils.AdapterOptions>} [options={}]
     */
    module.exports = (options) => new ConnectedCar(options);
} else {
    // otherwise start the instance directly
    new ConnectedCar();
}