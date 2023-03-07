/****************************************************************************
 * deviceInfo.js
 * April 2021
 *****************************************************************************/

/* global strftime, device, AM_USB_MSG_TYPE_GET_INFO, firmwareSize, firmwareChunkSize */

const strftimeUTC = strftime.utc();

// Information which can be pulled from the device

var time = null;
var milliseconds = null;
var batteryVoltage = null;
var firmwareDescription = null;
var firmwareVersion = [null, null, null];
var statusString = null;
var snapshotCount = null;
var deviceID = null;
var firmwareSize = null;
var firmwareChunkSize = null;

// UI elements

const deviceIDSpan = document.getElementById('device-id-span');
const timeSpan = document.getElementById('time-span');
const batteryVoltageSpan = document.getElementById('battery-voltage-span');
const firmwareDescriptionSpan = document.getElementById('firmware-description-span');
const firmwareVersionSpan = document.getElementById('firmware-version-span');
const snapshotCountSpan = document.getElementById('snapshot-count-span');
const statusSpan = document.getElementById('status-span');

/**
 * Reset UI elements to placeholder values
 */
function resetDeviceInfo() {

    timeSpan.innerHTML = '-';
    batteryVoltageSpan.innerHTML = '-';
    firmwareDescriptionSpan.innerHTML = '-';
    firmwareVersionSpan.innerHTML = '-';
    snapshotCountSpan.innerHTML = '-';
    statusSpan.innerHTML = '-';
    deviceIDSpan.innerHTML = '-';

    time = null;
    milliseconds = null;
    batteryVoltage = null;
    firmwareDescription = null;
    firmwareVersion = [null, null, null];
    statusString = null;
    snapshotCount = null;
    deviceID = null;
    var firmwareSize = null;
    var firmwareChunkSize = null;

}

/**
 * Use collected device information to fill in UI elements
 */
function updateDeviceInfo() {

    if (deviceID !== null) {

        deviceIDSpan.innerHTML = deviceID.toString(16).toUpperCase();

    } else {

        deviceIDSpan.innerHTML = '-';

    }

    if (time !== null) {

        timeSpan.innerHTML = strftimeUTC('%Y-%m-%d %H:%M:%S', new Date(time * 1000)) +
                             '.' + ('0000' + milliseconds).slice(-3) + ' (UTC)';

    } else {

        timeSpan.innerHTML = '-';

    }

    if (batteryVoltage !== null) {

        batteryVoltageSpan.innerHTML = (batteryVoltage).toFixed(2) + ' V';

    } else {

        batteryVoltageSpan.innerHTML = '-';

    }

    if (firmwareDescription !== null) {

        firmwareDescriptionSpan.innerHTML = firmwareDescription;

    } else {

        firmwareDescriptionSpan.innerHTML = '-';

    }

    if (firmwareVersion[0] !== null) {

        firmwareVersionSpan.innerHTML = firmwareVersion[0] + '.' + firmwareVersion[1] + '.' + firmwareVersion[2];

    } else {

        firmwareVersionSpan.innerHTML = '-';

    }

    if (snapshotCount !== null) {

        snapshotCountSpan.innerHTML = snapshotCount.toString();

    } else {

        snapshotCountSpan.innerHTML = '-';

    }

    if (statusString !== null) {

        statusSpan.innerHTML = statusString;

    } else {

        statusSpan.innerHTML = '-';

    }

}

/**
 * Request information from a connected Snapper device
 */
async function getDeviceInformation() {

    if (device) {

        const data = new Uint8Array([AM_USB_MSG_TYPE_GET_INFO]);

        try {

            // Send request packet and wait for response

            let result = await device.transferOut(0x01, data);

            result = await device.transferIn(0x01, 128);

            // Read device time
            time = result.data.getUint8(1) + 256 * (result.data.getUint8(2) + 256 * (result.data.getUint8(3) + 256 * result.data.getUint8(4)));
            milliseconds = Math.round((result.data.getUint8(5) + 256 * result.data.getUint8(6)) / 1024 * 1000);

            // Temperature in tenths of degrees kelvin
            // Convert to degrees celsius
            // const tempK = result.data.getUint8(5) + 256 * (result.data.getUint8(6) + 256 * (result.data.getUint8(7) + 256 * result.data.getUint8(8)));
            // temp = ((tempK - 2731.5) / 10);

            // Read battery voltage
            batteryVoltage = (result.data.getUint8(9) + 256 * (result.data.getUint8(10) + 256 * (result.data.getUint8(11) + 256 * result.data.getUint8(12)))) / 100;
            // previously 10, 11, 12, 13

            // Read device ID
            deviceID = BigInt(0);
            for (let i = 20; i >= 13; --i) { // previously 21..14

                deviceID *= BigInt(256);
                deviceID += BigInt(result.data.getUint8(i));

            }

            // Read firmware
            firmwareDescription = '';
            for (let i = 21; i < 53; ++i) { // previously 22..54

                firmwareDescription += String.fromCharCode(result.data.getUint8(i));

            }

            firmwareVersion = [];
            for (let i = 53; i < 56; ++i) { // previously 54..57

                firmwareVersion.push(result.data.getUint8(i));

            }

            firmwareSize = result.data.getUint8(56) + 256 * (result.data.getUint8(57) + 256 * (result.data.getUint8(58) + 256 * result.data.getUint8(59)));
            firmwareChunkSize = result.data.getUint8(60) + 256 * result.data.getUint8(61);

            // // Read the following only if firmware description contains SnapperGPS
            // if (firmwareDescription.includes('SnapperGPS')) {

            // Read device state
            switch (result.data.getUint8(62)) { // previously 9

                case 0:
                    statusString = 'Will shutdown';
                    break;
                case 1:
                    statusString = 'Will record';
                    break;
                case 2:
                    statusString = 'Erasing';
                    break;
                default:
                    statusString = 'Undefined';

            }

            // Read number of snapshots on device
            snapshotCount = result.data.getUint8(63) + 256 * (result.data.getUint8(64)); // previously ?

            // } else {

            //     statusString = null;
            //     snapshotCount = null;

            // }

            updateDeviceInfo();

        } catch (err) {

            console.error(err);

            resetDeviceInfo();

        }

    }

}
