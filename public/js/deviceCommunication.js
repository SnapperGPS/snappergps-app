/****************************************************************************
 * deviceCommunication.js
 * April 2021
 *****************************************************************************/

// USB messages to request data (time, battery, firmware version)

const AM_USB_MSG_TYPE_SET_TIME = 0x01;
const AM_USB_MSG_TYPE_GET_INFO = 0x02;
const AM_USB_MSG_TYPE_START = 0x82; // 0x04 previously
const AM_USB_MSG_TYPE_SHUTDOWN = 0x83; // 0x05 previously
const AM_USB_MSG_TYPE_FIRMWARE_INIT = 0x03; // 0x07 previously
const AM_USB_MSG_TYPE_FIRMWARE_CRC = 0x05; // 0x09 previously
const AM_USB_MSG_TYPE_FIRMWARE_FLASH = 0x06; // 0x0A previously

// const FLASH_PAGE_LENGTH = 2048; // 2 KB
// const FIRMWARE_LENGTH = 48 * 1024; // 48 KB

var device;

// Function called when a device is disconnected (usually clearing UI of information about that device)

var disconnectFunction;

/**
 * Establish a connection with a previously paired Snapper device
 */
async function connectToDevice (repeat = false) {

    if (!navigator.usb) {

        // Browser does not support WebUSB

        return;

    }

    if (!isDeviceAvailable()) {

        // No device is opened already

        console.log('Connecting');

        // Get list of all paired WebUSB devices

        let devices = await navigator.usb.getDevices();

        // Identify SnapperGPS devices

        devices = devices.filter(function (element) {

            return element.productName.toUpperCase().indexOf('SNAPPER') >= 0;

        });

        if (devices.length > 0) {

            // Connect to 1st SnapperGPS receiver in list

            device = devices[0];

            if (!device.opened) {

                try {

                    await device.open();

                } catch {

                    console.log('Problem opening USB device');

                }

            }

            if (!isDeviceAvailable()) {

                try {

                    await device.selectConfiguration(1);
                    await device.claimInterface(0);

                    setTime((timeErr) => {

                        if (timeErr) {

                            console.log(timeErr);

                        }

                    });

                } catch {

                    console.log('Problem opening USB device');

                }

            }

        }

    }

    if (repeat) {
        setTimeout(function () {
            connectToDevice(true);
        }, 1000);
    }

}

/**
 * Pages which use this script can set a custom function which is called when a device is disconnected
 * @param {function} onDisconnectFunction Function called when device is disconnected
 */
function setDisconnectFunction (onDisconnectFunction) {

    disconnectFunction = onDisconnectFunction;

}

/**
 * Order device to start recording
 * @param {float} snapshotInterval Seconds between snapshots
 * @param {object} startDt Datetime object for when the device should start collecting snapshots
 * @param {object} endDt Datetime object for when the device should stop collecting snapshots
 * @param {function} callback Function called when complete
 */
async function start (snapshotInterval, startDt, endDt, callback) {

    if (isDeviceAvailable()) {

        const usbMessage = new Uint8Array([AM_USB_MSG_TYPE_START, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        usbMessage[1] = snapshotInterval & 0xFF;
        usbMessage[2] = (snapshotInterval >> 8) & 0xFF;
        usbMessage[3] = (snapshotInterval >> 16) & 0xFF;
        usbMessage[4] = (snapshotInterval >> 24) & 0xFF;

        const startTime = Math.round(startDt.valueOf() / 1000);
        usbMessage[5] = startTime & 0xFF;
        usbMessage[6] = (startTime >> 8) & 0xFF;
        usbMessage[7] = (startTime >> 16) & 0xFF;
        usbMessage[8] = (startTime >> 24) & 0xFF;

        const endTime = Math.round(endDt.valueOf() / 1000);
        usbMessage[9] = endTime & 0xFF;
        usbMessage[10] = (endTime >> 8) & 0xFF;
        usbMessage[11] = (endTime >> 16) & 0xFF;
        usbMessage[12] = (endTime >> 24) & 0xFF;

        try {

            console.log('Sending time data to device');

            let result = await device.transferOut(0x01, usbMessage);

            console.log('Checking response.');

            result = await device.transferIn(0x01, 128);

            console.log(result);
            console.log('Response received. Successfully sent start message to device');

        } catch {

            console.log('Problem writing to USB device.');

        }

    } else {

        callback('No device connected.');

    }

    callback();

}

/**
 * Send the current time to a connected device
 */
async function setTime (callback) {

    if (isDeviceAvailable()) {

        var data = new Uint8Array([AM_USB_MSG_TYPE_SET_TIME, 0, 0, 0, 0, 0, 0, 0, 0]);

        var time = Math.round((new Date()).valueOf() / 1000);
        data[1] = time & 0xFF;
        data[2] = (time >> 8) & 0xFF;
        data[3] = (time >> 16) & 0xFF;
        data[4] = (time >> 24) & 0xFF;

        try {

            console.log('Sending time data to device');

            let result = await device.transferOut(0x01, data);

            console.log('Checking response.');

            result = await device.transferIn(0x01, 128);

            console.log(result.data);
            console.log('Response received. Successfully wrote time to device');

            callback();

        } catch {

            callback('Failed to write time to USB device.');

        }

    } else {

        callback('No device connected.');

    }

}

/**
 * Order device to shutdown after unplugging
 * @param {function} callback Function called on completion
 */
async function shutdown (callback) {

    if (isDeviceAvailable()) {

        const shutdownMessage = new Uint8Array([AM_USB_MSG_TYPE_SHUTDOWN]);

        try {

            console.log('Sending shutdown instruction to device.');

            let result = await device.transferOut(0x01, shutdownMessage);

            console.log('Checking response.');

            result = await device.transferIn(0x01, 128);

            console.log('Response received. Successfully ordered USB device to shutdown.');

            callback();

        } catch {

            callback('Failed to order USB device to shutdown.');

        }

    } else {

        callback('No device connected.');

    }

}
/**
 * Order device to update firmware.
 */
async function updateFirmware (files, FIRMWARE_LENGTH = 48 * 1024, FLASH_PAGE_LENGTH = 2048) {

    console.log('Using ' + FIRMWARE_LENGTH + ' as firmware size.');
    console.log('Using ' + FLASH_PAGE_LENGTH + ' as page size.');

    // Check if a device is connected
    if (isDeviceAvailable()) {

        const firmwareInitMessage = new Uint8Array([AM_USB_MSG_TYPE_FIRMWARE_INIT]);
        const firmwareCrcMessage = new Uint8Array([AM_USB_MSG_TYPE_FIRMWARE_CRC]);
        const firmwareLoadMessage = new Uint8Array([AM_USB_MSG_TYPE_FIRMWARE_FLASH]);

        try {

            // Initialize firmware update on device
            let result = await device.transferOut(0x01, firmwareInitMessage);
            result = await device.transferIn(0x01, 128);

            let data;

            // Check if user did not provide custom firmware binary
            if (files.length === 0) {

                // Get current firmware binary on server
                // TODO: fetch from GitHub
                const response = await fetch('/firmware/snapper.bin');
                data = await response.blob();

            } else {

                data = files[0];

            }
            const firmwareBuffer = await data.arrayBuffer();
            // Firmware has fixed length of 48 KB
            const firmware = new Uint8Array(FIRMWARE_LENGTH);
            // Apply padding with 0xFF if firmware is shorter than 48 KB
            firmware.fill(0xFF);
            firmware.set(new Uint8Array(firmwareBuffer));

            // Send one page after another to device until all bytes are sent
            for (let firmwareByteIndex = 0;
                firmwareByteIndex < FIRMWARE_LENGTH;
                firmwareByteIndex += FLASH_PAGE_LENGTH) {

                // Send firmware page to device
                result = await device.transferOut(0x01, firmware.slice(
                    firmwareByteIndex, firmwareByteIndex + FLASH_PAGE_LENGTH)
                );
                result = await device.transferIn(0x01, 128);

            }

            // Get values for CRC check from external flash
            result = await device.transferOut(0x01, firmwareCrcMessage);
            result = await device.transferIn(0x01, 128);

            // Get actual CRC value from device
            const crcIs = result.data.getUint8(1) + 256 * result.data.getUint8(2);

            // Calculate desired CRC value
            const crcShall = crc16(firmware);

            // Check if operation was successful
            if (crcIs !== crcShall) {

                throw new Error('The was a problem on your SnapperGPS receiver ' +
                    'when we tried to update its firmware.');

            }

            // Load firmware from external flash to internal one
            result = await device.transferOut(0x01, firmwareLoadMessage);
            result = await device.transferIn(0x01, 128);

        } catch (err) {

            throw new Error('We failed to update the firmware ' +
                'of your SnapperGPS receiver. (' + err.message + ')');

        }

    } else {

        throw new Error('No SnapperGPS receiver is connected.');

    }

}

/**
 * Connect to a Snapper device
 */
async function requestDevice (callback) {

    if (!navigator.usb) {

        callback('Your browser does not support the WebUSB technology, '
                 + 'which is necessary to configure a SnapperGPS receiver for '
                 + 'a deployment or to upload data from a receiver to the '
                 + 'server for processing. Please switch to a Chromium-based '
                 + 'browser such as Edge or Chrome.');
        return;

    }

    console.log('Requesting USB device');

    try {

        device = await navigator.usb.requestDevice({
            filters: [{vendorId: 0x10c4}]
        });

    } catch {

        callback('We could not pair your SnapperGPS receiver. '
                 + 'Please check its USB connection.');
        return;

    }

    try {

        await device.open();
        await device.selectConfiguration(1);
        await device.claimInterface(0);

        setTime((timeErr) => {

            if (timeErr) {

                callback(timeErr);

            }

        });

        callback();

    } catch {

        callback('We could not connect to your SnapperGPS receiver. '
                 + 'Is it already claimed by another browser tab or window?');

    }

}

function crc16 (buffer) {

    var crc, byte, code;
    crc = 0x0;
    for (let i = 0; i < buffer.length; i++) {

        byte = buffer[i];
        code = (crc >>> 8) & 0xFF;
        code ^= byte & 0xFF;
        code ^= code >>> 4;
        crc = (crc << 8) & 0xFFFF;
        crc ^= code;
        code = (code << 5) & 0xFFFF;
        crc ^= code;
        code = (code << 7) & 0xFFFF;
        crc ^= code;

    }
    return crc;

}

// Check if a WebUSB device is paried, opened, and its interface is claimed.
function isDeviceAvailable () {

    return device &&
           device.opened &&
           device.configuration &&
           device.configuration.interfaces &&
           device.configuration.interfaces.length > 0 &&
           device.configuration.interfaces[0].claimed;

}

// Check if WebUSB is supported by the current browser

if (navigator.usb) {

    navigator.usb.onconnect = connectToDevice();

    navigator.usb.ondisconnect = () => {

        device = null;

        console.log('Disconnected');

        if (disconnectFunction) {

            disconnectFunction();

        }

    };

} else {

    console.error('WebUSB not supported by current browser');

}
