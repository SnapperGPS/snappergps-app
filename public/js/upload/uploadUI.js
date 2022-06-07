/****************************************************************************
 * uploadUI.js
 * March 2021
 *****************************************************************************/

/* global L, Blob, startUpload, addReferencePoint, uploadSnapshot, finishUpload, cancelUpload, device, getDeviceInformation, requestDevice, setDisconnectFunction, resetDeviceInfo, connectToDevice, isDeviceAvailable, updateCache, snapshotCountSpan, deviceIDSpan, deviceID, AM_USB_MSG_TYPE_GET_INFO */

const mapboxAccessToken = 'pk.eyJ1Ijoiamdyb3Nza3JldXoiLCJhIjoiY2tseWIxNTRoMHFvODJxbHlyanRobzBmZiJ9.xz2KrKBy5MRCf9XLOOPdzA';

const vapidPublicKey = 'BE20bzDq0YubQSxrJ2ekzU1g9rsmv7I2ZCqqwS7mO2GV0kgPJZjvQ6a04TRUMoeZ33JioQ8S0WhX7ZwpESO4sEs';

const USE_MAX_VELOCITY = true;

// Status variable which locks out certain actions when upload is in process
var uploading = false;
var transferring = false;
var uploadingDevice = false;
var uploadingFile = false;
var transferringDevice = false;

// Object to manage push notification subscription
let subscriptionJson = '{}';

// Error display UI

const errorCard = document.getElementById('error-card');
const errorText = document.getElementById('error-text');

// UI elements which are duplicated for start and end points (start = 0, end = 1)

const dateInputs = [document.getElementById('start-date-input'), document.getElementById('end-date-input')];
const timeInputs = [document.getElementById('start-time-input'), document.getElementById('end-time-input')];
const timezones = [document.getElementById('start-timezone'), document.getElementById('end-timezone')];

const latInputs = [document.getElementById('start-latitude-input')]; //, document.getElementById('end-latitude-input')];
const lngInputs = [document.getElementById('start-longitude-input')]; //, document.getElementById('end-longitude-input')];

const aimsPink = window.getComputedStyle(errorCard).getPropertyValue('--aims-pink');

// Custom marker icon
const zebraIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],  // size of the icon
    iconAnchor: [12, 41],  // point of the icon which will correspond to marker's location
    popupAnchor: [1, -34],  // point from which the popup should open relative to the iconAnchor
    shadowSize: [41, 41]
});

const markers = [L.marker([null, null], {interactive: false, icon: zebraIcon}), L.marker()];

// Maximum distance between 2 plausible positions as defined in back-end.
const maxDistancePlausible = 10e3;

// Circle for confidence of start location.
const confidenceCircles = [L.circle([null, null], {
    interactive: false,
    color: aimsPink,
    fill: false,
    radius: maxDistancePlausible
}), L.circle()];

// Non-duplicated UI elements

const fileInput = document.getElementById('file-input');

const pairButton = document.getElementById('pair-button');

const uploadSelectedButton = document.getElementById('upload-selected-button');
const uploadSelectedSpinner = document.getElementById('upload-selected-spinner');

const uploadDeviceButton = document.getElementById('upload-device-button');
const uploadDeviceSpinner = document.getElementById('upload-device-spinner');

const transferButton = document.getElementById('transfer-button');
const transferSpinner = document.getElementById('transfer-spinner');

// Count snapshots found on device
const snapshotCountLabelTransfer = document.getElementById('snapshot-count-transfer');
const snapshotCountLabelUpload = document.getElementById('snapshot-count-upload');

// E-mail address field
const emailInput = document.getElementById('email-input');

// Push notifications
const notificationCheckbox = document.getElementById('notification-checkbox');
const notificationLabel = document.getElementById('notification-label');

// Max. receiver velocity
const velocityInput = document.getElementById('velocity-input');
const velocityUnitInput = document.getElementById('velocity-unit-input');

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
 * Load the TileLayer object of a given ID
 * @param {string} id ID of map tile layer used by Leaflet
 * @returns TileLayer object
 */
function getTileLayer (id) {

    // Retrieve specific base map layer from mapbox API.
    return L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
        // The following is necessary for legal reasons.
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery &copy <a href="https://www.mapbox.com/">Mapbox</a>',
        // minZoom: 1, // Default 0, change to account for zoomOffset
        // maxZoom: 19, // Default 18
        id: id,
        // tileSize: 512, // Default 256, could be fine-tuned
        // zoomOffset: -1, // Default 0, change to account for different tileSize
        accessToken: mapboxAccessToken
    });

}

/**
 * Create map object and place it in HTML object
 * @param {string} mapID DOM ID which map will be place in
 * @returns Leaflet map object
 */
function createMap (mapID) {

    const mapLayers = {
        Streets: getTileLayer('mapbox/streets-v11'),
        Outdoors: getTileLayer('mapbox/outdoors-v11'),
        Light: getTileLayer('mapbox/light-v10'),
        Dark: getTileLayer('mapbox/dark-v10'),
        Satellite: getTileLayer('mapbox/satellite-v9'),
        'Satellite & Streets': getTileLayer('mapbox/satellite-streets-v11')
    };

    const map = L.map(mapID, {
        layers: [mapLayers['Satellite & Streets']] //,
        // zoomControl: false
    });

    // L.control.zoom({position: 'topright'}).addTo(map);

    L.control.scale({position: 'bottomleft'}).addTo(map);

    L.control.layers(mapLayers).addTo(map);
    map.setView([51.753449349360785, -1.2540079829543849], 11);

    // Add search box
    var searchControl = new L.esri.Controls.Geosearch({allowMultipleResults: false, position: 'topleft'}).addTo(map);

    // Use best result as start location of track
    searchControl.on('results', function (data) {
        if (data.results.length > 0) {
            updateMap(0, data.results[0].latlng);
        }
    });

    // Assumes your Leaflet map variable is 'map'..
    L.DomUtil.addClass(map._container, 'crosshair-cursor-enabled');

    return map;

}

// Create map objects

const maps = [createMap('start-map')];

// Create canvases which cover maps to allow greying out

const canvases = [document.getElementById('start-map-canvas'), document.getElementById('end-map-canvas')];

/**
 * Given a group of connected radio buttons, get the index of the current selection
 * @param {string} radioName Name assigned to a group of radio buttons
 * @returns Index of the selected radio
 */
function getSelectedRadioValue (radioName) {

    return parseInt(document.querySelector('input[name="' + radioName + '"]:checked').value);

}

/**
 * Verify if position given is a valid set of co-ordnates
 * @param {float} lat Latitude
 * @param {float} lng Longitude
 */
function areValidCoords (lat, lng) {

    return !isNaN(lat) && !isNaN(lng) && lat > -90.0 && lat < 90.0 && lng > -180.0 && lng < 180.0;

}

/**
 * Move the marker on the given map (based on the index)
 * @param {int} index Map index
 * @param {object} latlng JSON object containing co-ordinates
 */
function updateMap (index, latlng) {

    markers[index].setLatLng(latlng);
    markers[index].addTo(maps[index]);

    confidenceCircles[index].setLatLng(latlng);
    confidenceCircles[index].addTo(maps[index]);

    latInputs[index].value = latlng.lat.toFixed(6);
    lngInputs[index].value = latlng.lng.toFixed(6);

    // If a start location was provided, we can allow a data upload

    if (!transferring && isDeviceAvailable() && +snapshotCountSpan.innerHTML > 0) {

        uploadDeviceButton.disabled = false;

    }

    if (fileInput.files.length > 0) {

        uploadSelectedButton.disabled = false;

    }

}

/**
 * Animate flying to a give location
 * @param {integer} index Map index
 * @param {float} lat Latitude
 * @param {float} lng Longitude
 */
function moveMapView (index, lat, lng) {

    maps[index].flyTo([lat, lng], 13);

}

/**
 * Grey out map and block interactions
 * @param {integer} index Map index
 */
function disableMap (index) {

    const map = maps[index];

    canvases[index].style.display = '';

    map._handlers.forEach((handler) => {

        handler.disable();

    });

    latInputs[index].disabled = true;
    lngInputs[index].disabled = true;

}

/**
 * Remove grey overlay and re-enable interactions
 * @param {integer} index Map index
 */
function enableMap (index) {

    const map = maps[index];

    canvases[index].style.display = 'none';

    map._handlers.forEach((handler) => {

        handler.enable();

    });

    latInputs[index].disabled = false;
    lngInputs[index].disabled = false;

}

/**
 * Re-enable UI elements of given side of the UI
 * @param {integer} index UI index
 */
function enableStartEndUI (index) {

    timeInputs[index].disabled = false;
    dateInputs[index].disabled = false;
    timezones[index].style.color = '';

}

/**
 * Disable UI elements of given side of the UI
 * @param {integer} index UI index
 */
function disableStartEndUI (index) {

    timeInputs[index].disabled = true;
    dateInputs[index].disabled = true;
    timezones[index].style.color = 'lightgray';

}

/**
 * React to the map being clicked by updating that map
 * @param {integer} index Map index
 * @param {object} latlng JSON object containing location where the map was clicked
 */
function onMapClick (index, latlng) {

    updateMap(index, latlng);

}

function displayError (errorDescription) {

    console.error(errorDescription);

    errorCard.style.display = '';
    errorText.innerHTML = errorDescription;

    window.scrollTo(0, 0);

}

/**
 * Enable all UI elements
 */
function enableUI () {

    if (!uploading) {

        // Enable maps and time inputs
        enableMap(0);
        enableStartEndUI(0);
        enableStartEndUI(1);

        emailInput.disabled = false;  // TODO
        fileInput.disabled = false;

        if (USE_MAX_VELOCITY) {

            velocityInput.disabled = false;
            velocityUnitInput.disabled = false;

        }

        if (!transferring && fileInput.files.length > 0 && latInputs[0].value !== '' && lngInputs[0].value !== '') {

            // Can only upload if start point is provided

            uploadSelectedButton.disabled = false;

        }

    }

    if (navigator.usb && !transferring) {

        if (isDeviceAvailable()) {

            // Upload or transfer from device buttons disabled
            // if no device is connected
            // or no snapshots on device
            if (+snapshotCountSpan.innerHTML > 0) {

                if (!uploading && latInputs[0].value !== '' && lngInputs[0].value !== '') {
                    // Can only upload if start point is provided

                    uploadDeviceButton.disabled = false;

                }

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
function disableDeviceUI () {

    // Disable all device-related buttons
    pairButton.disabled = true;
    // changedeviceButton.disabled = true;
    transferButton.disabled = true;
    uploadDeviceButton.disabled = true;

}

/**
 * Disable all UI elements while uploading data to server.
 */
function disableUploadUI () {

    // Disable all upload-related buttons
    uploadSelectedButton.disabled = true;
    uploadDeviceButton.disabled = true;

    // Disable upload-related inputs
    disableMap(0);
    disableStartEndUI(0);
    disableStartEndUI(1);
    emailInput.disabled = true;
    fileInput.disabled = true;

    if (USE_MAX_VELOCITY) {

        velocityInput.disabled = true;
        velocityUnitInput.disabled = true;

    }
}

const updateTimezone = (inputIndex) => {

    if (dateInputs[inputIndex].value !== '') {

        const timeString = (timeInputs[inputIndex].value === '') ? '0:00' : timeInputs[inputIndex].value;
        let dt = new Date(dateInputs[inputIndex].value + ' ' + timeString);
        // Fix WebKit problem (WebKit does not recognise YYYY-MM-DD, but YYYY/MM/DD)
        if (isNaN(dt)) {
            console.log('Problem with input date, trying to fix it...');
            dt = new Date(dateInputs[inputIndex].value.replace(/-/g, '/') + ' ' + timeString);
        }
        let mins = dt.getTimezoneOffset();
        const sign = mins <= 0 ? '+' : '-';
        mins = Math.abs(mins);
        let h = Math.floor(mins / 60);
        let m = mins % 60;
        h = h < 10 ? '0' + h : h;
        m = m < 10 ? '0' + m : m;
        timezones[inputIndex].innerHTML = `UTC${sign}${h}:${m}`;

    } else {

        timezones[inputIndex].innerHTML = '';

    }

};

for (let inputIndex = 0; inputIndex < dateInputs.length; ++inputIndex) {

    dateInputs[inputIndex].addEventListener('change', () => updateTimezone(inputIndex));
    timeInputs[inputIndex].addEventListener('change', () => updateTimezone(inputIndex));

}

/**
 * Update device file button and UI to display a spinner and "Uploading" text when snapshots are being uploaded
 * @param {bool} isUploading Is the app currently uploading snapshots
 */
function setDeviceUploading (isUploading) {

    uploadDeviceSpinner.style.display = isUploading ? '' : 'none';

    uploadingDevice = isUploading;
    transferring = transferringDevice || uploadingDevice;
    uploading = uploadingFile || uploadingDevice;

    if (isUploading) {

        disableDeviceUI();

        disableUploadUI();

    } else {

        enableUI();

    }

}
/**
 * Update transfer button and UI to display a spinner and "Transferring" text when snapshots are being transferred
 * @param {bool} isTransferring Is the app currently transferring snapshots
 */
function setTransferring (isTransferring) {

    transferSpinner.style.display = isTransferring ? '' : 'none';

    transferringDevice = isTransferring;
    transferring = transferringDevice || uploadingDevice;

    if (isTransferring) {

        disableDeviceUI();

    } else {

        enableUI();

    }

}

/**
 * Update selected file button and UI to display a spinner and "Uploading" text when snapshots are being uploaded
 * @param {bool} isUploading Is the app currently uploading snapshots
 */
function setSelectedUploading (isUploading) {

    uploadSelectedSpinner.style.display = isUploading ? '' : 'none';

    uploadingFile = isUploading;
    uploading = uploadingFile || uploadingDevice;

    if (isUploading) {

        disableUploadUI();

    } else {

        enableUI();

    }

}

/**
 * Create a JSON object containing all information needed in the reference point table
 * @param {object} latInput UI input for latitude of reference point
 * @param {object} lngInput UI input for longitude of reference point
 * @param {object} dt datetime
 * @returns JSON object containing reference point information
 */
function createReferencePointJSON (latInput, lngInput, dt) {

    return {lat: parseFloat(latInput.value), lng: parseFloat(lngInput.value), dt: dt};

}

/**
 * Asynchronously read snapshot from USB buffer and upload it together with meta data.
 * Do not invoke this function too often in parallel, e.g., for all
 * (potentially 11,000) snapshots. Instead, cap the maximum number of
 * instances running at the same time with processDevice2ServerQueue().
 * @param {string}      uploadID Unique ID returned by startUpload().
 * @param {object}      meta Meta data object.
 * @param {ArrayBuffer} data Byte array returned from receiver after requesting meta data.
 * @return {Promise}
 */
async function getSnapshotDevice (uploadID, meta, data) {

    return new Promise((resolve) => {

        // Initialize the snapshot to upload with zeros.
        // If the incoming data is shorter than the desired length,
        // then this applies zero padding.
        const snapshotBuffer = new Uint8Array(SNAPSHOT_SIZE).fill(0);

        // Loop over buffer that has been transmitted via USB
        for (let snapshotBufferIdx = 0;
            snapshotBufferIdx < SNAPSHOT_BUFFER_SIZE - METADATA_SIZE;
            ++snapshotBufferIdx) {

            // Write received byte to buffer
            snapshotBuffer[snapshotBufferIdx] = data.getUint8(snapshotBufferIdx);

        }

        console.log('Uploading file');

        const snapshotBlob = new Blob([snapshotBuffer], {type: 'application/octet-stream'});

        resolve(uploadSnapshot(uploadID, snapshotBlob, meta.timestamp, meta.battery, 1, 1, meta.temperature));

    });

}

// Queue for snapshots that still have to be uploaded.
var device2ServerQueue;

// Boolean indicating if the queue processor is currently running.
var isProcessing = false;

// Index of the snapshot in the queue that shall be processed next.
var taskIndex;

// Indicator if all snapshots have been pushed into queue.
var isQueueFull = false;

/**
 * Upload max 4 snapshots from device in parallel.
 * Asynchronously process tasks from the device2Server queue, but make sure
 * that only max 4 tasks are running in parallel. Terminate once all tasks in
 * queue are completed.
 */
async function processDevice2ServerQueue (maxNumOfWorkers = 4) {

    // No worker is active when queue processor is started.
    var numOfWorkers = 0;

    // Indicate that queue processor is running.
    isProcessing = true;

    return new Promise(resolve => {

        const handleResult = index => result => {

            // Could store success/fail boolean in array here: array[index] = result
            if (!result) {

                displayError('We could not upload at least one of your snapshots. You might want to unplug and reconnect your SnapperGPS receiver and try again.');

            }
            // Update UI
            snapshotCountLabelUpload.innerHTML = `${index + 1} snapshots uploaded.`;
            // Worker uploaded snapshot and is now idle
            numOfWorkers--;
            // Find new task for worker
            getNextTask();

        };

        const getNextTask = () => {

            const currentIndex = taskIndex;
            // Check if a worker is idle and there are elements in the queue
            if (numOfWorkers < maxNumOfWorkers && currentIndex < device2ServerQueue.length) {

                // Move on to next snapshot in queue
                taskIndex++;
                // Indicate that one more worker is busy
                numOfWorkers++;
                // Asynchronously process next snapshot in queue
                getSnapshotDevice(device2ServerQueue[currentIndex].uploadID,
                    device2ServerQueue[currentIndex].meta,
                    device2ServerQueue[currentIndex].data
                ).then(handleResult(currentIndex)).catch(handleResult(currentIndex));
                // Move on to next snapshot in queue
                getNextTask();

            } else if (numOfWorkers === 0 && currentIndex === device2ServerQueue.length) {

                // All workers are idel and queue is empty; stop queue processor
                isProcessing = false;
                resolve(); // Could return array of success/fail booleans here: resolve(array)

            }

        };
        // Start processing first snapshot in queue
        getNextTask();

    });

}

var earliestDate, latestDate;

/**
 * React to upload button being clicked by attempting to upload data from connected device
 */
function onDeviceUploadButtonClick () {

    snapshotCountLabelUpload.innerHTML = '0 snapshots uploaded.';

    if (!isDeviceAvailable()) {

        return;

    }

    const email = emailInput.value; // User e-mail

    const maxVelocity = getMaxVelocity();

    if (isNaN(maxVelocity)) {

        return;

    }

    console.log('Max. velocity: ' + maxVelocity);

    deviceID = deviceIDSpan.innerHTML;

    setDeviceUploading(true);

    // Start upload by requesting the server create an upload instance in the database, returning its ID

    startUpload(deviceID, email, subscriptionJson, maxVelocity, async (err, uploadID) => {

        if (err) {

            console.error('Upload failed');

            errorCard.style.display = '';
            errorText.innerHTML = err;

            setDeviceUploading(false);

            return;

        }

        // Messages to communicate to device via USB
        const requestMetaDataMessage = new Uint8Array([AM_USB_MSG_TYPE_GET_SNAPSHOT]);
        const requestSnapshotMessage = new Uint8Array([AM_USB_MSG_TYPE_GET_SNAPSHOT_PAGE]);

        // Keep reading data from device until all snapshots are read
        let keepReading = true;

        latestDate = null;
        earliestDate = null;

        // Create empty queue for snapshot uplaod tasks
        device2ServerQueue = [];
        // Queue index
        taskIndex = 0;
        // Indicator if all snapshots from device have been pushed into queue
        isQueueFull = false;

        while (keepReading) {

            try {

                console.log('Request meta data.');
                // Request to start reading new record from flash memory, start with meta data
                let result = await device.transferOut(0x01, requestMetaDataMessage);

                console.log('Wait for meta data.');
                // Wait until meta data is returned
                result = await device.transferIn(0x01, 128);

                const data = result.data;

                // Check if device has sent data
                // Device uses 2nd byte of transmit buffer as valid flag
                if (data.getUint8(1) !== 0x00) {

                    console.log('Extract time stamp.');

                    const meta = new MetaData(data);

                    console.log(meta);

                    /* Following block introduced by Peter. Do we really need
                    it? The 1st snapshot from the device will always be the
                    earliest one and the last snapshot the latest one. */

                    if (!latestDate || meta.timestamp > latestDate) {

                        latestDate = meta.timestamp;

                    }

                    if (!earliestDate || meta.timestamp < earliestDate) {

                        earliestDate = meta.timestamp;

                    }

                    console.log('Start reading snapshot.');

                    // Index of next unwritten element in snapshotBuffer

                    console.log('Requesting snapshot');

                    // Send message to device to request next piece of snapshot

                    let result = await device.transferOut(0x01, requestSnapshotMessage);

                    console.log('Waiting for snapshot');
                    result = await device.transferIn(0x01, SNAPSHOT_BUFFER_SIZE - METADATA_SIZE);

                    device2ServerQueue.push({
                        uploadID: uploadID,
                        meta: meta,
                        data: result.data
                    });

                    // Check if queue processor is running
                    if (!isProcessing) {

                        // Start queue processor
                        processDevice2ServerQueue().then(async function () {

                            // After queue processor is done, check if all snapshots haven been processed
                            // If yes, complete upload.
                            if (isQueueFull) {

                                console.log('Complete upload after processDevice2ServerQueue().');
                                await postSnapshotUploadDevice(uploadID);

                            } else {

                                // If not, wait for queue processor to complete
                                console.log('Wait for onDeviceUploadButtonClick() to complete upload.');

                            }

                        }).catch(console.error);

                    }

                } else {

                    // All snapshot data has been read from flash

                    keepReading = false;

                }

            } catch (err) {

                // Stop reading if USB communication failed

                console.error(err);

                displayError('We could not read all data from your SnapperGPS receiver. You might want to unplug and reconnect it and try again.');

                cancelUpload(uploadID);

                setDeviceUploading(false);

                return;

            }

        }

        // Check if queue processor is running
        if (!isProcessing) {

            // If the queue processor is not running anymore, then all snapshots
            // are uploaded and the upload can be finalized.
            console.log('Complete upload from onDeviceUploadButtonClick().');
            await postSnapshotUploadDevice(uploadID);

        } else {

            // We will let the queue processor trigger postSnapshotUploadDevice().
            isQueueFull = true;
            console.log('Wait for processDevice2ServerQueue() to complete upload.');

        }

    });

}

/**
 * Function to execute after all individual snapshots have been uplaoded from
 * device to server. Adds reference points to database and changes the state of
 * the upload from 'uploading' to 'waiting'.
  * @param {string}      uploadID Unique ID returned by startUpload().
 */
async function postSnapshotUploadDevice (uploadID) {

    // Display progress on UI
    snapshotCountLabelUpload.innerHTML = snapshotCountLabelUpload.innerHTML + ' Completing upload.';

    // Create an array of reference points in this way so it's easy to expand to more than just two later

    const referencePoints = [];

    if (timeInputs[0].value === '' || dateInputs[0].value === '') {
        console.log('Use timestamp of first snapshot for start point.');
        var dt0 = earliestDate;
    } else {
        var dt0 = new Date(dateInputs[0].value + ' ' + timeInputs[0].value);
    }
    if (timeInputs[1].value === '' || dateInputs[1].value === '') {
        console.log('Use timestamp of last snapshot for end point.');
        var dt1 = latestDate;
    } else {
        var dt1 = new Date(dateInputs[1].value + ' ' + timeInputs[1].value);
    }
    referencePoints.push(createReferencePointJSON(latInputs[0], lngInputs[0], dt0));
    referencePoints.push(createReferencePointJSON(latInputs[0], lngInputs[0], dt1));

    // Add however many reference points are given by the user

    for (let i = 0; i < referencePoints.length; i++) {

        const point = referencePoints[i];

        const referencePointSuccess = await addReferencePoint(uploadID, point.lat, point.lng, point.dt);

        if (!referencePointSuccess) {

            displayError('Failed to set reference point.');

            cancelUpload(uploadID);

            setDeviceUploading(false);

            return;

        }

    }

    // Take the day of the latest snapshot and then the data can be processed when that navdata is available (midday the next day)

    // If the priority upload checkbox is checked, snapshots will be processed asap, regardless of available nav data

    let earliestProcessingDateString;
    switch (getSelectedRadioValue('priority-radio')) {

    case 0:
        // immidiate
        earliestProcessingDateString = '1970-01-01 01:01:01';
        break;

    case 1:
        // rapid
        earliestProcessingDateString = dateToDatabaseString(latestDate, 0);
        break;

    case 2:
        // delayed
        latestDate.setDate(latestDate.getDate() + 1);
        earliestProcessingDateString = dateToDatabaseString(latestDate, 12);
        break;

    }

    finishUpload(uploadID, earliestProcessingDateString, (response) => {

        if (!response) {

            displayError('Snapshots uploaded, however upload status could not be changed from "uploading".');

            setDeviceUploading(false);

            return;

        }

        console.log('Upload success');
        window.location.href = '/success?uploadid=' + response +
                               '&email=' + emailInput.value +
                               '&push=' + notificationCheckbox.checked;

    });

}

/**
 * Asynchronously read meta data and snapshot from JSON and upload them.
 * Do not invoke this function too often in parallel, e.g., for all
 * (potentially 11,000) snapshots. Instead, cap the maximum number of
 * instances running at the same time with processFile2ServerQueue().
 * @param {string}      uploadID Unique ID returned by startUpload().
 * @param {object}      snapshot Element of snapshot list.
 */
async function getSnapshotJSON (uploadID, snapshot) {

    return new Promise((resolve) => {

        // Get timestamp from JSON
        const dt = new Date(snapshot.timestamp);
        // Get temperature from JSON
        const temperature = snapshot.temperature;
        // Get battery voltage from JSON
        const battery = snapshot.batteryVoltage;
        // Convert base64 data to blob
        const byteCharacters = atob(snapshot.data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let j = 0; j < byteCharacters.length; ++j) {

            byteNumbers[j] = byteCharacters.charCodeAt(j);

        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {type: 'application/octet-stream'});
        // Upload everything for this snapshot
        resolve(uploadSnapshot(uploadID, blob, dt, battery, 1, 1, temperature));

    });

}

/**
 * Upload max 4 snapshots from JSON file in parallel.
 * @param {string}      uploadID Unique ID returned by startUpload().
 * @param {Array}       snapshots Array of snapshots from JSON file.
 */
function processFile2ServerQueue (uploadID, snapshots, maxNumOfWorkers = 4) {

    // Number of busy workers
    var numOfWorkers = 0;

    // Index of snapshot in queue to process next
    var taskIndex = 0;

    return new Promise(resolve => {

        const handleResult = index => result => {

            // Could store success/fail boolean in array here: array[index] = result
            if (!result) {

                displayError('We could not upload at least one of your snapshots.');

            }
            // Count snapshots on UI
            snapshotCountLabelUpload.innerHTML = `${index + 1} snapshots uploaded.`;
            // Worker is done with uploading a snapshot and now idle and ready to tackle a new one
            numOfWorkers--;
            // Find a new snapshot to upload for the worker
            getNextTask();

        };

        const getNextTask = () => {

            // Check if a worker is idle and snapshots are left in the queue
            if (numOfWorkers < maxNumOfWorkers && taskIndex < snapshots.length) {

                // Upload next snapshot in queue
                getSnapshotJSON(uploadID, snapshots[taskIndex]).then(handleResult(taskIndex)).catch(handleResult(taskIndex));
                // Move on to next snapshot in queue
                taskIndex++;
                // Indicate that one more worker is busy
                numOfWorkers++;
                // Check if we have the resources to process the next snapshot in the queue
                getNextTask();

            // Check if all workers are idle and the queue is empty
            } else if (numOfWorkers === 0 && taskIndex === snapshots.length) {

                // We are done and could return something, if desired.
                resolve(); // Could return array of success/fail booleans here: resolve(array)

            }

        };

        // Start with processing first snapshot in queue
        getNextTask();

    });

}

/**
 * React to upload button being clicked by attempting to upload provided data
 */
function onSelectedUploadButtonClick () {

    snapshotCountLabelUpload.innerHTML = '0 snapshots uploaded.';

    // uploadCount = 0;
    // uploadCountLabel.innerHTML = `${uploadCount} snapshots uploaded.`;

    const email = emailInput.value; // User e-mail

    const maxVelocity = getMaxVelocity();

    if (isNaN(maxVelocity)) {

        return;

    }

    console.log('Max. velocity: ' + maxVelocity);

    setSelectedUploading(true);

    const selectedFiles = Array.from(fileInput.files);

    // Check for single JSON file
    if (selectedFiles.length === 1 && selectedFiles[0].name.split('.').pop().toUpperCase() === 'JSON') {

        // Read JSON file
        const reader = new FileReader();
        reader.onload = function (e) {

            const dataObj = JSON.parse(e.target.result);
            // Check for valid JSON structure
            if (!dataObj.hasOwnProperty('deviceID') || !dataObj.hasOwnProperty('snapshots')) {

                console.error('Upload failed');
                errorCard.style.display = '';
                errorText.innerHTML = 'Your JSON file has the wrong format.';
                setSelectedUploading(false);
                window.scrollTo(0, 0);
                return;

            }
            // Get device ID from JSON
            const deviceID = dataObj.deviceID;
            // Create row for upload in database
            startUpload(deviceID, email, subscriptionJson, maxVelocity, async (err, uploadID) => {

                if (err) {

                    console.error('Upload failed');
                    errorCard.style.display = '';
                    errorText.innerHTML = err;
                    setSelectedUploading(false);
                    window.scrollTo(0, 0);
                    return;

                }
                console.log('Upload started.');
                // Get snapshots from JSON
                const snapshots = dataObj.snapshots;
                // Get number of snapshots
                const snapshotCount = snapshots.length;
                // Remember earliest and latest snapshot timestamps
                let earliestDate, latestDate;
                // Loop over all snapshots
                for (let i = 0; i < snapshotCount; ++i) {

                    // Check for valid JSON structure
                    if (!snapshots[i].hasOwnProperty('timestamp') ||
                            !snapshots[i].hasOwnProperty('temperature') ||
                            !snapshots[i].hasOwnProperty('batteryVoltage') ||
                            !snapshots[i].hasOwnProperty('data')) {

                        console.error('Upload failed');
                        errorCard.style.display = '';
                        errorText.innerHTML = 'A snapshot in your JSON file has the wrong format.';
                        setSelectedUploading(false);
                        window.scrollTo(0, 0);
                        return;

                    }

                    // Get timestamp from JSON
                    const dt = new Date(snapshots[i].timestamp);

                    if (!(dt instanceof Date) || isNaN(dt)) {

                        console.error('Upload failed');
                        errorCard.style.display = '';
                        errorText.innerHTML = 'A timestamp in your JSON file has the wrong format.';
                        setSelectedUploading(false);
                        window.scrollTo(0, 0);
                        return;

                    }

                    if (!latestDate || dt > latestDate) {

                        latestDate = dt;

                    }
                    if (!earliestDate || dt < earliestDate) {

                        earliestDate = dt;

                    }
                    
                }

                await processFile2ServerQueue(uploadID, snapshots);

                // Display progress on UI
                snapshotCountLabelUpload.innerHTML = snapshotCountLabelUpload.innerHTML + ' Completing upload.';

                // Create an array of reference points in this way so it's easy to expand to more than just two later

                const referencePoints = [];
                
                if (timeInputs[0].value === '' || dateInputs[0].value === '') {
                    console.log('Use timestamp of first snapshot for start point.');
                    var dt0 = earliestDate;
                } else {
                    var dt0 = new Date(dateInputs[0].value + ' ' + timeInputs[0].value);
                    // Fix WebKit problem (WebKit does not recognise YYYY-MM-DD, but YYYY/MM/DD)
                    if (isNaN(dt0)) {
                        console.log('Problem with input date, trying to fix it...');
                        dt0 = new Date(dateInputs[0].value.replace(/-/g, '/') + ' ' + timeInputs[0].value);
                    }
                }
                if (timeInputs[1].value === '' || dateInputs[1].value === '') {
                    console.log('Use timestamp of last snapshot for end point.');
                    var dt1 = latestDate;
                } else {
                    var dt1 = new Date(dateInputs[1].value + ' ' + timeInputs[1].value);
                    // Fix WebKit problem (WebKit does not recognise YYYY-MM-DD, but YYYY/MM/DD)
                    if (isNaN(dt1)) {
                        console.log('Problem with input date, trying to fix it...');
                        dt1 = new Date(dateInputs[1].value.replace(/-/g, '/') + ' ' + timeInputs[1].value);
                    }
                }
                referencePoints.push(createReferencePointJSON(latInputs[0], lngInputs[0], dt0));
                referencePoints.push(createReferencePointJSON(latInputs[0], lngInputs[0], dt1));

                // Add however many reference points are given by the user

                for (let i = 0; i < referencePoints.length; i++) {

                    const point = referencePoints[i];

                    const referencePointSuccess = await addReferencePoint(uploadID, point.lat, point.lng, point.dt);

                    if (!referencePointSuccess) {

                        displayError('Failed to set reference point.');

                        cancelUpload(uploadID);

                        setDeviceUploading(false);

                        return;

                    }

                }

                // Take the day of the latest snapshot and then the data can be processed when that navdata is available (the next morning)

                // If the priority upload checkbox is checked, snapshots will be processed asap, regardless of available nav data

                let earliestProcessingDateString;
                switch (getSelectedRadioValue('priority-radio')) {

                case 0:
                    // immidiate
                    earliestProcessingDateString = '1970-01-01 01:01:01';
                    break;

                case 1:
                    // rapid
                    earliestProcessingDateString = dateToDatabaseString(latestDate, 0);
                    break;

                case 2:
                    // delayed
                    latestDate.setDate(latestDate.getDate() + 1);
                    earliestProcessingDateString = dateToDatabaseString(latestDate, 12);
                    break;

                }

                finishUpload(uploadID, earliestProcessingDateString, (response) => {

                    if (!response) {

                        displayError('Snapshots uploaded, however upload status could not be changed from "uploading".');

                        setSelectedUploading(false);

                        return;

                    }

                    console.log('Upload success');
                    window.location.href = '/success?uploadid=' + response +
                                           '&email=' + emailInput.value +
                                           '&push=' + notificationCheckbox.checked;

                });

            });

        };
        reader.readAsText(selectedFiles[0]);
        return;

    }

    // .bin files

    const deviceID = 'AAAABBBBCCCCDDDD';

    startUpload(deviceID, email, subscriptionJson, maxVelocity, async (err, uploadID) => {

        if (err) {

            displayError(err);

            setSelectedUploading(false);

            return;

        }

        const snapshotCount = selectedFiles.length;
        let i = 0;

        let latestDate, earliestDate;

        let uploadSuccess = true;

        // Using a while loop rather than a for loop so this code can more easily be converted into grabbing an unknown number of snapshots from the device
        while (i < snapshotCount) {

            const file = selectedFiles[i];
            const fileName = file.name;

            try {

                try {

                    const year = parseInt(fileName.slice(0, 4));
                    const month = parseInt(fileName.slice(4, 6)) - 1;
                    const day = parseInt(fileName.slice(6, 8));
                    const hours = parseInt(fileName.slice(9, 11));
                    const minutes = parseInt(fileName.slice(11, 13));
                    const seconds = parseInt(fileName.slice(13, 15));
                    const milliseconds = (fileName[13] === '_') ? parseInt(fileName.slice(16, 19)) : 0;

                    var dt = new Date(Date.UTC(year, month, day, hours, minutes, seconds, milliseconds));

                } catch {

                    throw new Error('The name of at least one of your selected binary snapshot files is invalid. ' +
                                    'It must follow the scheme YYYYMMDD_hhmmss.mmm.bin.');

                }

                if (!(dt instanceof Date) || isNaN(dt)) {

                    throw new Error('The name of at least one of your selected binary snapshot files is invalid. ' +
                                    'It must follow the scheme YYYYMMDD_hhmmss.mmm.bin.');

                }

                if (!latestDate || dt > latestDate) {

                    latestDate = dt;

                }

                if (!earliestDate || dt < earliestDate) {

                    earliestDate = dt;

                }

                try {

                    console.log('Uploading file ' + i);

                    uploadSuccess = await uploadSnapshot(uploadID, file, dt, 1, 1, 1, 1);

                } catch {

                    throw new Error('We could not upload at least one of your snapshots. ' +
                                    'Please try again.');

                }

                if (!uploadSuccess) {

                    throw new Error('We could not upload at least one of your snapshots. ' +
                                    'Please try again.');

                }

            } catch (err) {

                displayError(err.message);

                cancelUpload(uploadID);

                setSelectedUploading(false);

                return;

            }

            snapshotCountLabelUpload.innerHTML = `${++i} snapshots uploaded.`;

        }

        // Display progress on UI
        snapshotCountLabelUpload.innerHTML = snapshotCountLabelUpload.innerHTML + ' Completing upload.';

        // Create an array of reference points in this way so it's easy to expand to more than just two later

        const referencePoints = [];
        
        if (timeInputs[0].value === '' || dateInputs[0].value === '') {
            console.log('Use timestamp of first snapshot for start point.');
            var dt0 = earliestDate;
        } else {
            var dt0 = new Date(dateInputs[0].value + ' ' + timeInputs[0].value);
            // Fix WebKit problem (WebKit does not recognise YYYY-MM-DD, but YYYY/MM/DD)
            if (isNaN(dt0)) {
                console.log('Problem with input date, trying to fix it...');
                dt0 = new Date(dateInputs[0].value.replace(/-/g, '/') + ' ' + timeInputs[0].value);
            }
        }
        if (timeInputs[1].value === '' || dateInputs[1].value === '') {
            console.log('Use timestamp of last snapshot for end point.');
            var dt1 = latestDate;
        } else {
            var dt1 = new Date(dateInputs[1].value + ' ' + timeInputs[1].value);
            // Fix WebKit problem (WebKit does not recognise YYYY-MM-DD, but YYYY/MM/DD)
            if (isNaN(dt1)) {
                console.log('Problem with input date, trying to fix it...');
                dt1 = new Date(dateInputs[1].value.replace(/-/g, '/') + ' ' + timeInputs[1].value);
            }
        }
        referencePoints.push(createReferencePointJSON(latInputs[0], lngInputs[0], dt0));
        referencePoints.push(createReferencePointJSON(latInputs[0], lngInputs[0], dt1));

        // Add however many reference points are given by the user

        for (let i = 0; i < referencePoints.length; i++) {

            const point = referencePoints[i];

            const referencePointSuccess = await addReferencePoint(uploadID, point.lat, point.lng, point.dt);

            if (!referencePointSuccess) {

                displayError('Failed to set reference point.');

                cancelUpload(uploadID);

                setDeviceUploading(false);

                return;

            }

        }

        // Take the day of the latest snapshot and then the data can be processed when that navdata is available (the next morning)

        // If the priority upload checkbox is checked, snapshots will be processed asap, regardless of available nav data

        let earliestProcessingDateString;
        switch (getSelectedRadioValue('priority-radio')) {

        case 0:
            // immidiate
            earliestProcessingDateString = '1970-01-01 01:01:01';
            break;

        case 1:
            // rapid
            earliestProcessingDateString = dateToDatabaseString(latestDate, 0);
            break;

        case 2:
            // delayed
            latestDate.setDate(latestDate.getDate() + 1);
            earliestProcessingDateString = dateToDatabaseString(latestDate, 12);
            break;

        }

        finishUpload(uploadID, earliestProcessingDateString, (response) => {

            if (!response) {

                displayError('Snapshots uploaded, however upload status could not be changed from "uploading".');

                setSelectedUploading(false);

                return;

            }

            console.log('Upload success');
            window.location.href = '/success?uploadid=' + response +
                                   '&email=' + emailInput.value +
                                   '&push=' + notificationCheckbox.checked;

        });

    });

}

function dateToDatabaseString (latestDate, hours) {

    const year = latestDate.getFullYear();
    const month = latestDate.getMonth() + 1;
    const day = latestDate.getDate();

    let latestDateString = year.toString();
    latestDateString += '-';
    latestDateString += month.toString();
    latestDateString += '-';
    latestDateString += day.toString();
    latestDateString += ' ';
    latestDateString += (('00' + hours).slice(-3) + ':00:00.0');

    return latestDateString;

}

/**
 * Prepare a grey overlay canvas used to make it obvious a map is not usable
 * @param {object} canvas Grey overlay canvas
 */
function initialiseCanvas (canvas) {

    const ctx = canvas.getContext('2d');
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = 'lightgray';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

}

/**
 * Prepare map interactions
 * @param {integer} index Map index
 */
function initialiseMapUI (index) {

    // Add listener which adds marker to map

    maps[index].on('click', (event) => {

        onMapClick(index, event.latlng);

    });
    
    // Add functionality for updating map from textboxes

    latInputs[index].addEventListener('change', () => {

        const inputLat = parseFloat(latInputs[index].value);
        const inputLng = parseFloat(lngInputs[index].value);

        if (areValidCoords(inputLat, inputLng)) {

            updateMap(index, {lat: inputLat, lng: inputLng});
            moveMapView(index, inputLat, inputLng);

        }

    });

    lngInputs[index].addEventListener('change', () => {

        const inputLat = parseFloat(latInputs[index].value);
        const inputLng = parseFloat(lngInputs[index].value);

        if (areValidCoords(inputLat, inputLng)) {

            updateMap(index, {lat: inputLat, lng: inputLng});
            moveMapView(index, inputLat, inputLng);

        }

    });

    // Fill in overlay canvas to allow "greying out"

    initialiseCanvas(canvases[index]);

}

/**
 * Looping function which checks to see if WebUSB device has been connected
 */
function checkForDevice (repeat = true) {

    if (isDeviceAvailable()) {

        if (!transferring) {

            // Only talk to device if it is currently not read out.

            getDeviceInformation();

            // Upload/transfer button disabled if no device present
            if (+snapshotCountSpan.innerHTML > 0) {

                if (!uploading && latInputs[0].value !== '' && lngInputs[0].value !== '') {
                    // Can only upload if start point is provided

                    uploadDeviceButton.disabled = false;

                }

                transferButton.disabled = false;

            }

        }

        pairButton.disabled = true;

    } else {

        resetDeviceInfo();

        if (!transferring) {

            uploadDeviceButton.disabled = true;

            transferButton.disabled = true;

            pairButton.disabled = false;

        }

    }

    if (repeat) {

        setTimeout(checkForDevice, 500);

    }

}

function reportCoordinateError (index) {

    latInputs[index].value = '';
    lngInputs[index].value = '';

    latInputs[index].style.border = '2px solid red';
    lngInputs[index].style.border = '2px solid red';

    setTimeout(() => {

        latInputs[index].style.border = '';
        lngInputs[index].style.border = '';

    }, 6000);

}

function checkInputs () {

    let invalidCoords = false;

    const lat0 = parseFloat(latInputs[0].value);
    const lng0 = parseFloat(lngInputs[0].value);

    if (latInputs[0].value === '' || lngInputs[0].value === '') {

        displayError('Please provide the coordinates of your start locations.');

        latInputs[0].style.border = (latInputs[0].value === '') ? '2px solid red' : '';
        lngInputs[0].style.border = (lngInputs[0].value === '') ? '2px solid red' : '';

        setTimeout(() => {

            latInputs[0].style.border = '';
            lngInputs[0].style.border = '';

        }, 6000);

        return false;

    }

    if (!areValidCoords(lat0, lng0)) {

        invalidCoords = true;

        reportCoordinateError(0);

    }

    if (dateInputs[0] !== '' && dateInputs[1] !== '' && timeInputs[0] !== '' && timeInputs[1] !== '' ) {

        let startDt = new Date(dateInputs[0].value + ' ' + timeInputs[0].value);
        // Fix WebKit problem (WebKit does not recognise YYYY-MM-DD, but YYYY/MM/DD)
        if (isNaN(startDt)) {
            console.log('Problem with input date, trying to fix it...');
            startDt = new Date(dateInputs[0].value.replace(/-/g, '/') + ' ' + timeInputs[0].value);
        }
        let endDt = new Date(dateInputs[1].value + ' ' + timeInputs[1].value);
        // Fix WebKit problem (WebKit does not recognise YYYY-MM-DD, but YYYY/MM/DD)
        if (isNaN(endDt)) {
            console.log('Problem with input date, trying to fix it...');
            endDt = new Date(dateInputs[1].value.replace(/-/g, '/') + ' ' + timeInputs[1].value);
        }

        if (startDt > endDt) {

            displayError('Time/date of start point must come before end point.');

            timeInputs[0].style.border = '2px solid red';
            timeInputs[1].style.border = '2px solid red';
            dateInputs[0].style.border = '2px solid red';
            dateInputs[1].style.border = '2px solid red';

            setTimeout(() => {

                timeInputs[0].style.border = '';
                timeInputs[1].style.border = '';
                dateInputs[0].style.border = '';
                dateInputs[1].style.border = '';

            }, 6000);

            return false;

        }

    }

    if (invalidCoords) {

        displayError('Invalid co-ordinates.');
        return false;

    }

    errorCard.style.display = 'none';

    return true;

}

/**
   * Meta data object.
   * @param  {ArrayBuffer}  data Byte array returned from receiver after requesting meta data.
   * @return {Object}       meta Meta data object
   *    @return {Date}      meta.timestamp Timestamp of snapshot
   *    @return {Number}    meta.temperature Temperature measurement in degrees Celsius
   *    @return {Number}    meta.battery Battery voltage measurement in volts
   */
function MetaData (data) {

    // Get timestamp of snapshot
    const seconds = data.getUint8(2) + 256 * (data.getUint8(3) + 256 * (data.getUint8(4) + 256 * data.getUint8(5)));
    const milliseconds = Math.round((data.getUint8(6) + 256 * data.getUint8(7)) / 1024 * 1000);
    this.timestamp = new Date(seconds * 1000 + milliseconds);

    // Convert tenths of degrees Celsius to degrees Celsius
    this.temperature = (data.getUint8(10) + 256 * (data.getUint8(11) + 256 * (data.getUint8(12) + 256 * data.getUint8(13))) - 1024) / 10.0;

    // Convert hundreds of volts to volts
    this.battery = (data.getUint8(14) + 256 * (data.getUint8(15) + 256 * (data.getUint8(16) + 256 * data.getUint8(17)))) / 100.0;

}

pairButton.addEventListener('click', () => {

    requestDevice((err) => {

        if (err) {

            displayError(err);

        } else {

            errorCard.style.display = 'none';

        }

    });

});

// Set function which is called when connection to a WebUSB device is lost

setDisconnectFunction(() => {

    resetDeviceInfo();
    uploadDeviceButton.disabled = true;
    transferButton.disabled = true;

});

// Add button click events

uploadSelectedButton.addEventListener('click', () => {

    if (checkInputs()) {

        onSelectedUploadButtonClick();

    } else {

        window.scrollTo(0, 0);

    }

});

uploadDeviceButton.addEventListener('click', () => {

    if (checkInputs()) {

        onDeviceUploadButtonClick();

    } else {

        window.scrollTo(0, 0);

    }

});

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

    // Create zip file that will be returned
    let zip = new JSZip();

    // Messages to communicate to device via USB
    const requestMetaDataMessage = new Uint8Array([AM_USB_MSG_TYPE_GET_SNAPSHOT]);
    const requestSnapshotMessage = new Uint8Array([AM_USB_MSG_TYPE_GET_SNAPSHOT_PAGE]);

    // Arrays for meta data
    let timestampArray = [];
    let temperatureArray = [];
    let filenameArray = [];
    let batteryArray = [];

    // Count the received snapshots
    let snapshotCount = 0;

    // Keep reading data from device until all snapshots are read
    let keepReading = true;

    while (keepReading) {

        const snapshotBuffer = new Uint8Array(SNAPSHOT_SIZE).fill(0);

        try {

            console.log('Request meta data.');
            // Request to start reading new record from flash memory, start with meta data
            let result = await device.transferOut(0x01, requestMetaDataMessage);

            console.log('Wait for meta data.');
            // Wait until meta data is returned
            result = await device.transferIn(0x01, 128);

            const data = result.data;

            // Check if device has sent data
            // Device uses 2nd byte of transmit buffer as valid flag
            if (data.getUint8(1) !== 0x00) {

                // Get metadata

                console.log('Extract time stamp.');

                const meta = new MetaData(data);

                console.log(meta);

                // Append current meta data to arrays
                timestampArray.push(meta.timestamp);
                temperatureArray.push(meta.temperature);
                batteryArray.push(meta.battery);

                console.log('Start reading snapshot.');

                // Index of next unwritten element in snapshotBuffer

                let snapshotBufferIdx = 0;

                console.log('Requesting snapshot');

                // Send message to device to request next piece of snapshot

                let result = await device.transferOut(0x01, requestSnapshotMessage);

                console.log('Waiting for snapshot');
                result = await device.transferIn(0x01, SNAPSHOT_BUFFER_SIZE - METADATA_SIZE);

                // Loop over buffer that has been transmitted via USB

                while (snapshotBufferIdx < SNAPSHOT_BUFFER_SIZE - METADATA_SIZE) {

                    // Write received byte to buffer and increment counter

                    snapshotBuffer[snapshotBufferIdx] = result.data.getUint8(snapshotBufferIdx);
                    ++snapshotBufferIdx;

                }

                // Construct filename from timestamp
                const dt = meta.timestamp;
                const filename = dt.getUTCFullYear() + ('0' + (dt.getUTCMonth() + 1)).slice(-2) +
                            ('0' + dt.getUTCDate()).slice(-2) + '_' + ('0' + dt.getUTCHours()).slice(-2) +
                            ('0' + dt.getUTCMinutes()).slice(-2) + ('0' + dt.getUTCSeconds()).slice(-2) +
                            '_' + ('00' + dt.getUTCMilliseconds()).slice(-3) +
                            '.bin';


                // Add file to zip folder
                zip.file(filename, snapshotBuffer);

                // Add filename to meta data
                filenameArray.push(filename);

                // Append meta data and raw snapshot to data object for JSON file
                jsonData.snapshots.push({
                    timestamp: meta.timestamp.toISOString(),
                    temperature: meta.temperature,
                    batteryVoltage: meta.battery,
                    data: btoa(String.fromCharCode.apply(null, snapshotBuffer))
                });

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

    snapshotCountLabelTransfer.innerHTML = snapshotCountLabelMemory + ' Preparing ZIP download.';

    // Turn meta data into .csv file

    const rows = [['filename', 'timestamp', 'temperature', 'battery']];

    function fixPrecision (value, precision) {

        try {

            return value.toFixed(precision);

        } catch {

            return value;

        }

    }

    // Loop over all data and add rows to csv array.
    for (let i = 0; i < snapshotCount; ++i) {

        // UNIX time [s] to UTC.
        const datetime = timestampArray[i].toISOString();

        const temperature = fixPrecision(temperatureArray[i], 1);
        const battery = fixPrecision(batteryArray[i], 2);

        rows.push([filenameArray[i], datetime, temperature, battery]);

    }

    const csvContent = rows.map(e => e.join(',')).join('\n');

    // Add CSV file with meta data to zip folder
    zip.file('metadata.csv', csvContent);

    // Construct zip filename from current time
    const zipName = jsonData.deviceID + timeString + '.zip';

    console.log('Save zip file.');
    // Generate zip file asynchronously
    zip.generateAsync({type: 'blob'}).then(function (content) {

        // Force down of the zip file
        saveAs(content, zipName);

        snapshotCountLabelTransfer.innerHTML = snapshotCountLabelMemory;

    });

    console.log('Save operation done.');

    setTransferring(false);

};

/**
 * Create an encoded URI to download positions data
 * @param {string} content Text content to be downloaded
 */
function createDownloadLink (content, fileName) {

    const encodedUri = encodeURI(content);

    // Create hidden <a> tag to apply download to

    const link = document.createElement('a');

    link.setAttribute('href', encodedUri);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);

    // Click link

    link.click();

}

fileInput.addEventListener('change', function () {

    if (fileInput.files.length > 0 && latInputs[0].value !== '' && lngInputs[0].value !== '') {
        // Can only upload if start point is provided

        uploadSelectedButton.disabled = false;

    } else {

        uploadSelectedButton.disabled = true;

    }

});

notificationCheckbox.onchange = async () => {

    // This function is needed because Chrome doesn't accept a base64 encoded string
    // as value for applicationServerKey in pushManager.subscribe yet
    // https://bugs.chromium.org/p/chromium/issues/detail?id=802280
    function urlBase64ToUint8Array (base64String) {
        var padding = '='.repeat((4 - base64String.length % 4) % 4);
        var base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');

        var rawData = window.atob(base64);
        var outputArray = new Uint8Array(rawData.length);

        for (var i = 0; i < rawData.length; ++i) {

            outputArray[i] = rawData.charCodeAt(i);

        }
        return outputArray;

    }

    navigator.serviceWorker.ready.then(function (registration) {

        // Use the PushManager to get the user's subscription to the push service.
        return registration.pushManager.getSubscription().then(async function (subscription) {

            // If a subscription was found, return it.
            if (subscription) {

                console.log('Already subscribed.');

                if (!notificationCheckbox.checked) {

                    // subscription.unsubscribe();

                    subscriptionJson = '{}';

                    console.log('Unsubscribed.');

                    return;

                } else {

                    return subscription;

                }

            }

            if (!notificationCheckbox.checked) {

                return;

            } else {

                // Chrome doesn't accept the base64-encoded (string) vapidPublicKey yet
                const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

                // Otherwise, subscribe the user (userVisibleOnly allows to specify that we don't plan to
                // send notifications that don't have a visible effect for the user).
                return registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: convertedVapidKey
                });

            }

        });

    }).then(function (subscription) {

        if (notificationCheckbox.checked) {

            // Turn subscription details into JSON to send to server.
            subscriptionJson = JSON.stringify(subscription);
            console.log('We will send a push notfication with the link when processing is complete.');
            console.log(subscriptionJson);

        }

    }).catch(function (err) {

        console.log(err);
        console.log('Since you did not allow push messages, you will not be notified in the web app when processing is complete.');
        displayError('We could not enable push notifications for you. ' +
                    'Please enter an email address or use our Telegram bot ' +
                    'if you want to receive updates about the processing progress.');
        notificationCheckbox.checked = false;

    });

};

function getMaxVelocity () {

    if (velocityInput.value === '') {

        return null;

    } else {

        let maxVelocity = parseFloat(velocityInput.value);

        if (maxVelocity <= 0) {

            displayError('Please enter a maximum velocity that is greater than zero or leave the field blank.');

            velocityInput.style.border = '2px solid red';

            setTimeout(() => {

                velocityInput.style.border = '';

            }, 6000);

            return NaN;

        }

        if (velocityUnitInput.value === 'km/h') {

            maxVelocity /= 3.6;

        } else if (velocityUnitInput.value === 'mph') {

            maxVelocity /= 2.2369362920544;

        }

        return maxVelocity;

    }

}

if (!USE_MAX_VELOCITY) {

    velocityInput.disabled = true;
    velocityUnitInput.disabled = true;

}

if (!navigator.usb) {

    pairButton.disabled = true;
    transferButton.disabled = true;
    uploadDeviceButton.disabled = true;

} else {

    // Check to see if a device is already connected

    checkForDevice(true);

    connectToDevice(true);

}

// Check if service worker exists, which is required for push notifications.
if ('serviceWorker' in navigator) {

    // Wait until service worker is ready.
    navigator.serviceWorker.ready.then(function (registration) {

        // Check if browser supports push notifications.
        if (registration.pushManager) {

            // Allow user to subscribe to push notifications by checking checkbox.
            notificationCheckbox.disabled = false;
            notificationLabel.style.color = '';

            // Use the PushManager to get the user's subscription to the push service.
            registration.pushManager.getSubscription().then(async function (subscription) {

                // If a subscription was found, check checkbox.
                if (subscription) {

                    notificationCheckbox.checked = true;

                    // Turn subscription details into JSON to send to server.
                    subscriptionJson = JSON.stringify(subscription);
                    console.log('We will send a push notfication with the link when processing is complete.');
                    console.log(subscriptionJson);

                }

            });

        }

    });

}

// Prepare the start/end location maps
initialiseMapUI(0);

updateCache();
