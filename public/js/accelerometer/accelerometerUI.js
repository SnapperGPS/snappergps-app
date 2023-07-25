/****************************************************************************
 * accelerometerUI.js
 * July 2023
 *****************************************************************************/

/* global requestDevice, isDeviceAvailable, getDeviceInformation,
resetDeviceInfo, setDisconnectFunction, connectToDevice, updateFirmware,
updateCache, firmwareSize, firmwareChunkSize */

// Status variable which locks out certain actions when upload is in process
var transferring = false;
var transferringDevice = false;

// HTML elements

const pairButton = document.getElementById('pair-button');

const errorDisplay = document.getElementById('error-display');
const errorText = document.getElementById('error-text');

const downloadButton = document.getElementById('download-button');
const jsonText = document.getElementById('json-text');

const xSpan = document.getElementById('x-span');
const ySpan = document.getElementById('y-span');
const zSpan = document.getElementById('z-span');

const xSiSpan = document.getElementById('x-si-span');
const ySiSpan = document.getElementById('y-si-span');
const zSiSpan = document.getElementById('z-si-span');

// Use loop to get spans named ctrl-reg-0, ..., ctrl-reg-6
const ctrlRegSpans = [];
for (let i = 0; i < 7; i++) {
    ctrlRegSpans.push(document.getElementById('ctrl-reg-' + i + '-span'));
}

const configureAccelerometerButton = document.getElementById('configure-accelerometer-button');

const clearButton = document.getElementById('clear-button');

const downloadConfigButton = document.getElementById('download-config-button');

const transferButton = document.getElementById('download-log-button');
const transferSpinner = document.getElementById('transfer-spinner');

// Count snapshots found on device
const snapshotCountLabelTransfer = document.getElementById('snapshot-count-transfer');

// Code area
const codeTextArea = document.getElementById('code-textarea');
const output = document.getElementById('output');

// Chart

let measurements = {
    xArray: [],
    yArray: [],
    zArray: [],
    timeArray: []
}

let accelerationChart;

let chartPointColors = [];

// Length of one snapshot in bytes
const SNAPSHOT_BUFFER_SIZE = 0x1800; // On device (6 KB)
const SNAPSHOT_SIZE = 6138; // Desired 12 ms snapshot (12 ms * 4.092 MHz / 8 Bit)

// Number of bytes of one external flash page used for meta data
const METADATA_SIZE = 8;

// USB message to request start reading a new snapshot from flash memory
const AM_USB_MSG_TYPE_GET_SNAPSHOT = 0x81; // previously 0x03

// USB message to request a new page of the current snapshot
const AM_USB_MSG_TYPE_GET_SNAPSHOT_PAGE = 0x84; // previously 0x06

/**
 * Enable configuration user interface objects
 */
function enableUI() {

    if (navigator.usb && !transferring) {

        if (isDeviceAvailable()) {

            // Transfer from device buttons disabled
            // if no device is connected
            // or no snapshots on device
            if (+snapshotCountSpan.innerHTML > 0) {

                transferButton.disabled = false;

            }

        } else {

            // Allow to pair device again
            pairButton.disabled = false;

        }

    }

}

/**
 * Disable all UI elements while transferring data from device.
 */
function disableDeviceUI() {

    // Disable all device-related buttons
    pairButton.disabled = true;
    transferButton.disabled = true;

}

/**
 * Update transfer button and UI to display a spinner and "Transferring" text when snapshots are being transferred
 * @param {bool} isTransferring Is the app currently transferring snapshots
 */
function setTransferring(isTransferring) {

    transferSpinner.style.display = isTransferring ? '' : 'none';

    transferringDevice = isTransferring;
    transferring = transferringDevice;

    if (isTransferring) {

        disableDeviceUI();

    } else {

        enableUI();

    }

}

/**
 * Disable configuration user interface objects
 */
function disableUI() {

    pairButton.disabled = true;

}

// Live code

var state = {};

function log(text) {
    output.innerHTML = text;
}

/**
 * Change color of last data point in chart
 * @param {*} color 
 */
function colorChart(color) {
    chartPointColors[chartPointColors.length - 1] = color;
    accelerationChart.update();
}

async function executeCode(x, y, z) {
    const codeToExecute = codeTextArea.value;
    try {
        eval(codeToExecute);
    } catch (e) {
        log(e);
    }
}

/**
 * Looping function which checks for presence of WebUSB device
 */
function checkForDevice(repeat = true) {

    if (isDeviceAvailable()) {

        if (!transferring) {

            // Only talk to device if it is currently not read out.

            getDeviceInformation();

            getDeviceInformationAcceleration();

            // Upload/transfer button disabled if no device present
            if (+snapshotCountSpan.innerHTML > 0) {

                transferButton.disabled = false;

            }

            const x = Math.trunc(parseFloat(xSpan.innerHTML));
            const y = Math.trunc(parseFloat(ySpan.innerHTML));
            const z = Math.trunc(parseFloat(zSpan.innerHTML));
            if (x && y && z) {

                const time = timeSpan.innerHTML;
                const datetime = Date.UTC(time.substr(0, 4),
                                        time.substr(5, 2),
                                        time.substr(8, 2),
                                        time.substr(11, 2),
                                        time.substr(14, 2),
                                        time.substr(17, 2),
                                        time.substr(20, 3));
                measurements.timeArray.push(datetime / 1000.0);

                measurements.xArray.push(x);
                measurements.yArray.push(y);
                measurements.zArray.push(z);

                jsonText.innerHTML = JSON.stringify(measurements, null, 4);

                accelerationChart.data.labels.push((datetime / 1000.0 - measurements.timeArray[0]).toFixed(1));
                accelerationChart.data.datasets[0].data.push(x);
                accelerationChart.data.datasets[1].data.push(y);
                accelerationChart.data.datasets[2].data.push(z);
                chartPointColors.push('rgb(255, 99, 132)');

                accelerationChart.update();

                // Execute user code
                executeCode(x, y, z);

            }

        }

        pairButton.disabled = true;

    } else {

        resetDeviceInfo();

        if (!transferring) {

            transferButton.disabled = true;

            pairButton.disabled = false;

        }

    }

    if (repeat) {

        setTimeout(checkForDevice, 500);

    }

}

/**
 * Report an error to the user
 * @param {string} err Error text to be shown to the user
 */
function displayError(err) {

    console.error(err);

    errorDisplay.style.display = '';
    errorText.innerHTML = err;

    window.scrollTo(0, 0);

}

// Connect to a WebUSB device

pairButton.addEventListener('click', () => {

    requestDevice((err) => {

        if (err) {

            displayError(err);

        } else {

            errorDisplay.style.display = 'none';

        }

    });

});
/**
 * Create an encoded URI to download positions data
 * @param {string} content Text content to be downloaded
 */
function createDownloadLink(content, fileName) {

    const encodedUri = encodeURI(content);

    // Create hidden <a> tag to apply download to

    const link = document.createElement('a');

    link.setAttribute('href', encodedUri);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);

    // Click link

    link.click();

}

downloadButton.addEventListener('click', () => {
    // Return JSON file
    const jsonContent = 'data:text/json;charset=utf-8,' +
                        JSON.stringify(measurements, null, 4);
    createDownloadLink(jsonContent, 'accelerations.json');
});
/**
   * Meta data object.
   * @param  {ArrayBuffer}  data Byte array returned from receiver after requesting meta data.
   * @return {Object}       meta Meta data object
   *    @return {Date}      meta.timestamp Timestamp of snapshot
   *    @return {Number}    meta.temperature Temperature measurement in degrees Celsius
   *    @return {Number}    meta.battery Battery voltage measurement in volts
   */
function MetaData(data) {

    // Get timestamp of snapshot
    const seconds = data.getUint8(2) + 256 * (data.getUint8(3) + 256 * (data.getUint8(4) + 256 * data.getUint8(5)));
    const milliseconds = Math.round((data.getUint8(6) + 256 * data.getUint8(7)) / 1024 * 1000);
    this.timestamp = new Date(seconds * 1000 + milliseconds);

    // Convert tenths of degrees Celsius to degrees Celsius
    this.temperature = (data.getUint8(10) + 256 * (data.getUint8(11) + 256 * (data.getUint8(12) + 256 * data.getUint8(13))) - 1024) / 10.0;

    // Convert hundreds of volts to volts
    this.battery = (data.getUint8(14) + 256 * (data.getUint8(15) + 256 * (data.getUint8(16) + 256 * data.getUint8(17)))) / 100.0;

}

/**
 * 
 * @param {*} data 
 * @returns Dictionary with three arrays, x, y, z (each containing acceleration values in g)
 */
function accelerations(data) {

    let lsb_value = 1;
    // Range of accelerometer in g
    const range = 2;
    if (range == 2)
      lsb_value = 4;
    if (range == 4)
      lsb_value = 8;
    if (range == 8)
      lsb_value = 16;
    if (range == 16)
      lsb_value = 48;

    // Conversion factor for acceleration values
    const LIS3DH_LSB16_TO_KILO_LSB10 = 64000;

    // Number of accelerations in data (for each axis)
    const accelerationsCount = data.getUint8(0);

    // console.log('Accelerations count: ' + accelerationsCount + '.');

    const accelerationsDict = {
        x: [],
        y: [],
        z: []
    };

    for (let i = 0; i < accelerationsCount; ++i) {

        const x = data.getInt16(1 + 2 * i);
        const y = data.getInt16(1 + 2 * (i + accelerationsCount));
        const z = data.getInt16(1 + 2 * (i + 2 * accelerationsCount));

        // Check if at least one value is non-zero
        if (x !== 0 || y !== 0 || z !== 0) {

            // Convert to g
            accelerationsDict.x.push(x * lsb_value / LIS3DH_LSB16_TO_KILO_LSB10);
            accelerationsDict.y.push(y * lsb_value / LIS3DH_LSB16_TO_KILO_LSB10);
            accelerationsDict.z.push(z * lsb_value / LIS3DH_LSB16_TO_KILO_LSB10);

        }

    }

    // Return all three arrays
    return accelerationsDict;

}

transferButton.onclick = async () => {

    snapshotCountLabelTransfer.innerHTML = '0 snapshots transferred.';

    if (!isDeviceAvailable()) {

        return;

    }

    setTransferring(true);

    const data = new Uint8Array([AM_USB_MSG_TYPE_GET_INFO]);

    try {

        // Send request packet and wait for response
        let result = await device.transferOut(0x01, data);
        result = await device.transferIn(0x01, 128);

        // Read device ID
        deviceID = BigInt(0);
        for (let i = 20; i >= 13; --i) { // previously 21..14

            deviceID *= BigInt(256);
            deviceID += BigInt(result.data.getUint8(i));

        }

        // Read firmware
        firmwareDescription = '';
        for (let i = 21; i < 53; ++i) { // previously 22..54

            const char = result.data.getUint8(i);
            if (char > 0) {

                firmwareDescription += String.fromCharCode(char);

            }

        }
        var firmwareVersion = [];
        for (let i = 53; i < 56; ++i) { // previously: -> 54..57

            firmwareVersion.push(result.data.getUint8(i));

        }

    } catch (err) {

        console.error(err);

    }

    // ID to string
    deviceID = deviceID.toString(16).toUpperCase();

    // Crate object that holds data for JSON file
    let jsonData = {
        deviceID: deviceID,
        firmwareDescription: firmwareDescription,
        firmwareVersion: firmwareVersion[0] + '.' + firmwareVersion[1] + '.' + firmwareVersion[2],
        snapshots: []
    };

    // Messages to communicate to device via USB
    const requestMetaDataMessage = new Uint8Array([AM_USB_MSG_TYPE_GET_SNAPSHOT]);
    const requestSnapshotMessage = new Uint8Array([AM_USB_MSG_TYPE_GET_SNAPSHOT_PAGE]);

    // Count the received snapshots
    let snapshotCount = 0;

    // Guess interval between acceleration measurements (since they don't have timestamps)
    let accelerationMeasurementInterval = 0;
    let previousTimestamp = 0;

    // Keep reading data from device until all snapshots are read
    let keepReading = true;

    while (keepReading) {

        try {

            // Request to start reading new record from flash memory, start with meta data
            let result = await device.transferOut(0x01, requestMetaDataMessage);

            // Wait until meta data is returned
            result = await device.transferIn(0x01, 128);

            const data = result.data;

            // Check if device has sent data
            // Device uses 2nd byte of transmit buffer as valid flag
            if (data.getUint8(1) !== 0x00) {

                // Get metadata

                const meta = new MetaData(data);

                // console.log(meta);

                // Send message to device to request next piece of snapshot

                let result = await device.transferOut(0x01, requestSnapshotMessage);

                // Waiting for snapshot
                result = await device.transferIn(0x01, SNAPSHOT_BUFFER_SIZE - METADATA_SIZE);

                const accelerationsDict = accelerations(result.data);

                // Check if size of jsonData.snapshots is greater than zero
                // If so, this is the second snapshot and we can calculate the interval between acceleration measurements
                if (jsonData.snapshots.length === 0) {

                    // Append snapshot to data object for JSON file
                    jsonData.snapshots.push({
                        timestamp: meta.timestamp.toISOString(),
                        acceleration_x: accelerationsDict.x[accelerationsDict.x.length - 1],
                        acceleration_y: accelerationsDict.y[accelerationsDict.y.length - 1],
                        acceleration_z: accelerationsDict.z[accelerationsDict.z.length - 1]

                    });

                } else {

                    const snapshotInterval = (meta.timestamp.getTime() - previousTimestamp.getTime());

                    accelerationMeasurementInterval = snapshotInterval / accelerationsDict.x.length;

                    // Round to hundreds of seconds
                    // accelerationMeasurementInterval = Math.round(accelerationMeasurementInterval * 100) / 100;

                    // console.log('Acceleration measurement interval: ' + accelerationMeasurementInterval + ' ms.');

                    // Loop over accelerations and append snapshot for each
                    for (let i = 0; i < accelerationsDict.x.length; ++i) {

                        // Take meta.timestamp and subtract
                        const adjustedTimestamp = new Date(meta.timestamp.getTime() - accelerationMeasurementInterval * (accelerationsDict.x.length - i - 1));
                            
                        // Append snapshot to data object for JSON file
                        jsonData.snapshots.push({
                            // Subtract i * 0.5 sec from timestamp
                            timestamp: adjustedTimestamp.toISOString(),
                            acceleration_x: accelerationsDict.x[i],
                            acceleration_y: accelerationsDict.y[i],
                            acceleration_z: accelerationsDict.z[i]

                        });

                    }

                }

                // Add two fields to the last datapoint, "temperature" and "batteryVoltage"
                jsonData.snapshots[jsonData.snapshots.length - 1].temperature = meta.temperature;
                jsonData.snapshots[jsonData.snapshots.length - 1].batteryVoltage = meta.battery;

                previousTimestamp = meta.timestamp;

                snapshotCountLabelTransfer.innerHTML = `${++snapshotCount} snapshots transferred.`;

            } else {

                // All snapshot data has been read from flash

                keepReading = false;

            }

        } catch (err) {

            // Stop reading if USB communication failed

            console.error(err);

            // Stop reading if USB communication failed
            keepReading = false;

            displayError('We could not read all data from your SnapperGPS receiver. You might want to unplug and reconnect it and try again.');

            setTransferring(false);

            return;

        }

    }

    const snapshotCountLabelMemory = snapshotCountLabelTransfer.innerHTML;

    snapshotCountLabelTransfer.innerHTML = snapshotCountLabelMemory + ' Preparing JSON download.';

    // Generate filename from device ID and timestamp of first snapshot
    let timeString = '';
    if (jsonData.snapshots.length > 0) {
        timeString = '_' + jsonData.snapshots[0].timestamp.replaceAll('-', '').replaceAll(':', '').replace('T', '_').replace('.', '_').replace('Z', '');
    }

    // Return JSON file
    const jsonContent = 'data:text/json;charset=utf-8,' +
                        JSON.stringify(jsonData, null, 4);
    createDownloadLink(jsonContent, jsonData.deviceID + timeString + '.json');

    // Return as CSV file
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'timestamp,acceleration_x,acceleration_y,acceleration_z,temperature,batteryVoltage\n';
    for (let i = 0; i < jsonData.snapshots.length; ++i) {

        csvContent += jsonData.snapshots[i].timestamp + ',' +

                        jsonData.snapshots[i].acceleration_x + ',' +
                        jsonData.snapshots[i].acceleration_y + ',' +
                        jsonData.snapshots[i].acceleration_z + ',';
        
        // Check first if fields temperature and batteryVoltage exist

        if (jsonData.snapshots[i].temperature) {

            csvContent += jsonData.snapshots[i].temperature;

        }

        csvContent += ',';

        if (jsonData.snapshots[i].batteryVoltage) {

            csvContent += jsonData.snapshots[i].batteryVoltage;

        }

        csvContent += '\n';

    }

    createDownloadLink(csvContent, jsonData.deviceID + timeString + '.csv');

    snapshotCountLabelTransfer.innerHTML = snapshotCountLabelMemory;

    console.log('Save operation done.');

    setTransferring(false);

}

// Set the function which will be called when a WebUSB device is disconnected

setDisconnectFunction(() => {

    // Wipe the device information panel

    resetDeviceInfo();
    transferButton.disabled = true;

});


/**
 * Request information from a connected Snapper device
 */
async function getDeviceInformationAcceleration() {

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

            // Read acceleration (int16_t), consider signed integer
            const xIn = result.data.getInt16(65);
            const yIn = result.data.getInt16(67);
            const zIn = result.data.getInt16(69);

            // console.log(result.data);
            // console.log(xIn, yIn, zIn);

            updateDeviceInfo();

            // /** A structure to represent scales **/
            // typedef enum {
            //     LIS3DH_RANGE_16_G = 0b11, // +/- 16g
            //     LIS3DH_RANGE_8_G = 0b10,  // +/- 8g
            //     LIS3DH_RANGE_4_G = 0b01,  // +/- 4g
            //     LIS3DH_RANGE_2_G = 0b00   // +/- 2g (default value)
            // } lis3dh_range_t;

            let lsb_value = 1;
            const range = 2;
            if (range == 2)
              lsb_value = 4;
            if (range == 4)
              lsb_value = 8;
            if (range == 8)
              lsb_value = 16;
            if (range == 16)
              lsb_value = 48;
            const LIS3DH_LSB16_TO_KILO_LSB10 = 64000;
            const g = 9.80665;
            const xSi = xIn * lsb_value * g / LIS3DH_LSB16_TO_KILO_LSB10;
            const ySi = yIn * lsb_value * g / LIS3DH_LSB16_TO_KILO_LSB10;
            const zSi = zIn * lsb_value * g / LIS3DH_LSB16_TO_KILO_LSB10;
            const xG = xIn * lsb_value / LIS3DH_LSB16_TO_KILO_LSB10;
            const yG = yIn * lsb_value / LIS3DH_LSB16_TO_KILO_LSB10;
            const zG = zIn * lsb_value / LIS3DH_LSB16_TO_KILO_LSB10;

            if (xIn !== null) {

                xSpan.innerHTML = xIn;
                
                xSiSpan.innerHTML = (xG).toFixed(3) + ' g, ' + (xSi).toFixed(3) + ' m/s<sup>2</sup>';

            } else {

                xSpan.innerHTML = '-';

                xSiSpan.innerHTML = '-';

            }

            if (yIn !== null) {

                ySpan.innerHTML = yIn;

                ySiSpan.innerHTML = (yG).toFixed(3) + ' g, ' + (ySi).toFixed(3) + ' m/s<sup>2</sup>';

            } else {

                ySpan.innerHTML = '-';

                ySiSpan.innerHTML = '-';

            }

            if (zIn !== null) {

                zSpan.innerHTML = zIn;

                zSiSpan.innerHTML = (zG).toFixed(3) + ' g, ' + (zSi).toFixed(3) + ' m/s<sup>2</sup>';

            } else {

                zSpan.innerHTML = '-';

                zSiSpan.innerHTML = '-';

            }

            // Fill spans ctrlRegSpans with control register values displayed as binary numbers with leading zeros up to 8 bits
            for (let i = 0; i < ctrlRegSpans.length; ++i) {
                    
                ctrlRegSpans[i].innerHTML = (result.data.getUint8(71 + i)).toString(2).padStart(8, '0');

            }

        transferButton.disabled = false;

        } catch (err) {

            console.error(err);

            resetDeviceInfo();

            transferButton.disabled = true;

        }

    }

}

// async function sendInductionConfig(rcount, offset, settlecount, clock_dividers, config, mux_config, drive_current, channel, delayMilli, i2c, callback) {

//     if (isDeviceAvailable()) {

//         // typedef struct {
//         //     uint16_t rcount;
//         //     uint16_t offset;
//         //     uint16_t settlecount;
//         //     uint16_t clock_dividers;
//         //     uint16_t config;
//         //     uint16_t mux_config;
//         //     uint16_t drive_current;
//         //     uint8_t channel;
//         //     uint8_t delayMilli;
//         //     uint8_t i2c;
//         // } usbMessageSetInductionConfigIn_t;

//         const usbMessage = new Uint8Array([0x85, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

//         usbMessage[1] = rcount & 0xFF;
//         usbMessage[2] = (rcount >> 8) & 0xFF;

//         usbMessage[3] = offset & 0xFF;
//         usbMessage[4] = (offset >> 8) & 0xFF;

//         usbMessage[5] = settlecount & 0xFF;
//         usbMessage[6] = (settlecount >> 8) & 0xFF;

//         usbMessage[7] = clock_dividers & 0xFF;
//         usbMessage[8] = (clock_dividers >> 8) & 0xFF;

//         usbMessage[9] = config & 0xFF;
//         usbMessage[10] = (config >> 8) & 0xFF;

//         usbMessage[11] = mux_config & 0xFF;
//         usbMessage[12] = (mux_config >> 8) & 0xFF;

//         usbMessage[13] = drive_current & 0xFF;
//         usbMessage[14] = (drive_current >> 8) & 0xFF;

//         usbMessage[15] = channel & 0xFF;

//         usbMessage[16] = delayMilli & 0xFF;

//         usbMessage[17] = i2c & 0xFF;

//         try {

//             console.log('Sending induction configuration to device');

//             let result = await device.transferOut(0x01, usbMessage);

//             console.log('Checking response.');

//             result = await device.transferIn(0x01, 128);

//             console.log(result);
//             console.log('Response received. Successfully sent induction configuration to device.');

//         } catch {

//             console.log('Problem writing to USB device.');

//         }

//     } else {

//         callback('No device connected.');

//     }

//     callback();

// }

// configureInductionButton.addEventListener('click', () => {

//     const rcount = parseInt(rcountInput.value);  // 0x0546
//     console.log('RCOUNT: ' + rcount.toString(16));
//     const offset = parseInt(offsetInput.value);  // 0
//     console.log('OFFSET: ' + offset.toString(16));
//     const settlecount = parseInt(settlecountInput.value);  // 30
//     console.log('SETTLECOUNT: ' + settlecount.toString(16));
//     const clock_dividers = (parseInt(finDividerInput.value) << 12) | parseInt(frefDividerInput.value);  // (1 << 12) | 2
//     console.log('CLOCK_DIVIDERS: ' + clock_dividers.toString(16));
//     const config = (parseInt(channelInput.value) << 14) | (0b1 << 13) | (parseInt(rpOverrideEnableInput.value) << 12) | (parseInt(sensorActivateSelInput.value) << 11) | (parseInt(autoAmpDisInput.value) << 10) | (parseInt(refClkSrcInput.value) << 9) | (parseInt(intbDisInput.value) << 7) | (parseInt(highCurrentDrvInput.value) << 6) | 0b000001;  // 0x1601 & 0x3fff
//     console.log('CONFIG: ' + config.toString(16));
//     const mux_config = (parseInt(autoscanEnInput.value) << 15) | (parseInt(rrSequenceInput.value) << 13) | (0b0001000001 << 3) | parseInt(deglitchInput.value);  // 0x20c
//     console.log('MUX_CONFIG: ' + mux_config.toString(16));
//     const drive_current = parseInt(driveCurrentInput.value) << 11;  // 0xa000
//     console.log('DRIVE_CURRENT: ' + drive_current.toString(16));

//     const channel = parseInt(channelInput.value);

//     const delayMilli = parseInt(delayMilliInput.value);

//     const i2c = parseInt(i2cInput.value);

//     sendInductionConfig(rcount, offset, settlecount, clock_dividers, config, mux_config, drive_current, channel, delayMilli, i2c, (inductionConfigErr) => {

//         if (inductionConfigErr) {

//             displayError(inductionConfigErr);
//             return;

//         }

//         console.log('Successfully set induction configuration.');

//     });

// });

// downloadConfigButton.addEventListener('click', () => {

//     let data = {};

//     // Parse config data
//     data.rcount = parseInt(rcountInput.value);
//     data.offset = parseInt(offsetInput.value);
//     data.settlecount = parseInt(settlecountInput.value);
//     data.finDivider = parseInt(finDividerInput.value);
//     data.refDivider = parseInt(frefDividerInput.value);
//     data.channel = parseInt(channelInput.value);
//     data.rpOverrideEnable = parseInt(rpOverrideEnableInput.value);
//     data.sensorActivateSel = parseInt(sensorActivateSelInput.value);
//     data.autoAmpDis = parseInt(autoAmpDisInput.value);
//     data.refClkSrc = parseInt(refClkSrcInput.value);
//     data.intbDis = parseInt(intbDisInput.value);
//     data.highCurrentDrv = parseInt(highCurrentDrvInput.value);
//     data.autoscanEn = parseInt(autoscanEnInput.value);
//     data.rrSequence = parseInt(rrSequenceInput.value);
//     data.deglitch = parseInt(deglitchInput.value);
//     data.driveCurrent = parseInt(driveCurrentInput.value);

//     data.delayMilli = parseInt(delayMilliInput.value);

//     console.log(data);

//     // Return JSON file
//     const jsonContent = 'data:text/json;charset=utf-8,' +
//                         JSON.stringify(data, null, 4);
//     createDownloadLink(jsonContent, 'ldc_config.json');

// });

clearButton.addEventListener('click', () => {

    measurements.xArray = [];
    measurements.yArray = [];
    measurements.zArray = [];
    measurements.timeArray = [];
    jsonText.innerHTML = JSON.stringify(measurements, null, 4);
    accelerationChart.data.labels = [];
    accelerationChart.data.datasets.forEach((dataset) => {
        dataset.data = [];
    });
    accelerationChart.update();

});

if (!navigator.usb) {

    pairButton.disabled = true;
    transferButton.disabled = true;

} else {
    // \definecolor{AIMSpurple}{RGB}{94,37,144}  % 5E2590
    // \definecolor{AIMSpink}{RGB}{179,144,207}  % B390CF
    // \definecolor{AIMSgrey}{RGB}{153,153,153}  % 999999
    // \definecolor{AIMSdarkGrey}{RGB}{92,92,92}  % 5C5C5C
    let data = {
        labels: [],
        datasets: [{
            label: 'x',
            backgroundColor: 'rgb(94, 37, 144)',
            borderColor: 'rgb(94, 37, 144)',
            data: [],
        },
        {
            label: 'y',
            backgroundColor: 'rgb(179, 144, 207)',
            borderColor: 'rgb(179, 144, 207)',
            data: [],
        },
        {
            label: 'z',
            backgroundColor: 'rgb(92, 92, 92)',
            borderColor: 'rgb(92, 92, 92)',
            data: [],
        }]
    };

    const config = {
        type: 'line',
        data: data,
        options: {
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'time [s]'
                    }
                }
            }
        }
    };

    accelerationChart = new Chart(
        document.getElementById('accelerationChart'),
        config
    );

    // Check to see if a device is already connected

    checkForDevice(true);

    connectToDevice(true);

}

// Update website cache
updateCache();
