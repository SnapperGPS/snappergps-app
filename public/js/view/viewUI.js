/****************************************************************************
 * viewUI.js
 * March 2021
 *****************************************************************************/

// Geodesy for smoothing
import LatLon, { Nvector, Cartesian, Ned, Dms } from 'https://cdn.jsdelivr.net/npm/geodesy@2/latlon-nvector-ellipsoidal.js';

/* global loadUploadData, getPositions, L */

const mapboxAccessToken = 'pk.eyJ1Ijoiamdyb3Nza3JldXoiLCJhIjoiY2tseWIxNTRoMHFvODJxbHlyanRobzBmZiJ9.xz2KrKBy5MRCf9XLOOPdzA';

const uploadID = document.getElementById('upload-id').getAttribute('value');

var dateTime = null;
var referencePoints = [];
var processedPositionCount = null;
var snapshotCount = 0;
var deviceID = null;

const deviceIdDisplay = document.getElementById('device-id-display');
const uploadDateDisplay = document.getElementById('upload-date-display');
const processedPositionCountDisplay = document.getElementById('processed-position-count-display');

const downloadCSVButton = document.getElementById('download-csv-button');
const downloadGeoJSONButton = document.getElementById('download-geojson-button');
const downloadKMLButton = document.getElementById('download-kml-button');
const downloadJSONButton = document.getElementById('download-json-button');

// Label for percentage of failed fixes
const percentageLbl = document.getElementById('percentage-lbl');

// Spinner while downloading
const downloadSpinner = document.getElementById('download-spinner');

// Date range selector
const startDateInput = document.getElementById('start-date-input');
const endDateInput = document.getElementById('end-date-input');
const startTimeInput = document.getElementById('start-time-input');
const endTimeInput = document.getElementById('end-time-input');

// Warning
const processingWarningDisplay = document.getElementById('processing-warning-display');
const processingWarningText = document.getElementById('processing-warning-text');

// Smoothing
const smoothInput = document.getElementById('smooth-input');
const smoothSpinner = document.getElementById('smooth-spinner');
const smoothSpan = document.getElementById('smooth-span');

let startDateTime;
let endDateTime;

const lineColour = window.getComputedStyle(deviceIdDisplay).getPropertyValue('--aims-purple');
const circleColour = window.getComputedStyle(deviceIdDisplay).getPropertyValue('--aims-pink');

// Initialize overlay layers for the tracks.
const markersLayer = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 36  // zoomLevel => zoomLevel < 18 ? 80 : 0
    // spiderLegPolylineOptions: {weight: 0.0, color: '#222', opacity: 0.0}
}); // For points (as markers)
const lineLayer = L.layerGroup(); // For track (as polyline)
const circlesLayer = L.layerGroup(); // For confidences (as circles)
var mapLayers;
var map;

// Custom marker icon
const zebraIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],  // size of the icon
    iconAnchor: [12, 41],  // point of the icon which will correspond to marker's location
    popupAnchor: [1, -34],  // point from which the popup should open relative to the iconAnchor
    shadowSize: [41, 41]
});

// Positions (raw at first, later potentially smoothed)
var positions = {};
// Raw positions from database (although, some could have been removed)
var raw_positions = {};

/**
 * Request tile layer to display on a Leaflet map
 * @param {string} id Leaflet title layer ID
 * @returns Tile layer object
 */
function getTileLayer (id) {

    // Retrieve specific base map layer from mapbox API
    return L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery &copy <a href="https://www.mapbox.com/">Mapbox</a>',
        // minZoom: 1,
        // maxZoom: 19,
        id: id,
        // tileSize: 512,
        // zoomOffset: -1,
        accessToken: mapboxAccessToken
    });

}

/**
 * Get all tile layers a user could choose to display on a map
 * @returns A JSON object of tile layers
 */
function getTileLayers () {

    return {
        Streets: getTileLayer('mapbox/streets-v11'),
        Outdoors: getTileLayer('mapbox/outdoors-v11'),
        Light: getTileLayer('mapbox/light-v10'),
        Dark: getTileLayer('mapbox/dark-v10'),
        Satellite: getTileLayer('mapbox/satellite-v9'),
        'Satellite & Streets': getTileLayer('mapbox/satellite-streets-v11')
    };

}

/**
 * Request information needed to fill in UI and map
 * @param {function} callback Function called on completion
 */
function getInformation (callback) {

    loadUploadData(uploadID, (informationRes) => {

        if (!informationRes) {

            return;

        }

        const responseJSON = JSON.parse(informationRes);

        dateTime = responseJSON.datetime;

        referencePoints = responseJSON.referencePoints;

        snapshotCount = responseJSON.snapshotCount;

        deviceID = responseJSON.deviceID;

        callback();

    });

}

/**
 * Fill UI with data from the database
 */
function populateFields () {

    deviceIdDisplay.innerText = deviceID;

    uploadDateDisplay.innerText = (dateTime === null) ? '-' : (new Date(dateTime)).toString().replace('GMT', 'UTC');

    processedPositionCountDisplay.innerText = (processedPositionCount === null ? '?' : processedPositionCount.toString()) +
                                              '/' +
                                              snapshotCount.toString();

}

/**
 * Given a set of locations and timestamps, draw the path to the map
 * @param {array} positions Array of JSON objects containing positions and corrected timestamps
 */
function populateMap (positions) {

    // Clear map first
    markersLayer.clearLayers();
    lineLayer.clearLayers();
    circlesLayer.clearLayers();

    // Loop over data and add content to map.
    var pointList = [];
    for (let i = 0; i < positions.length; i++) {
        // Extract point.
        let lat, lng;
        if (isPositionValid(positions[i])) {
            lat = positions[i].estimated_lat;
            lng = positions[i].estimated_lng;
        } else {
            lat = 0;
            lng = 0;
        }
        // Get timestamp
        const timestamp = positions[i].timestamp;
        var date = new Date(timestamp * 1000); // Unix time [s] to UTC
        if (date >= startDateTime && date <= endDateTime) {
            // Add marker.
            const marker = L.marker([lat, lng], {icon: zebraIcon, riseOnHover: true}); // .addTo(myMap);
            // Do not add marker to map by default because it slows down
            // everything if 10,000 points are present.
            // Check if point is good.
            if (isPositionPlausible(positions[i])) {
                const confidence = positions[i].estimated_horizontal_error;
                // Add point to track.
                pointList.push(new L.LatLng(lat, lng));
                // Add circle for confidence.
                const circle = L.circle([lat, lng], {
                    color: circleColour,
                    fillColor: circleColour,
                    fillOpacity: 0.5,
                    radius: confidence,
                    stroke: false
                });
                // Add timestamp as popup to circle.
                circle.bindPopup(
                    date.toUTCString().replace('GMT', 'UTC') +
                    '<br>' +
                    '<button class="btn btn-primary btn-sm" onClick="removePosition(' + i + ')">Remove</button>'
                );
                // Place popup in the centre.
                circle.on('click', ev => ev.target.openPopup(ev.target.getLatLng()));
                // Add confidence circle to respective layer for easy disabling.
                circlesLayer.addLayer(circle);
            } else {
                positions[i].estimated_horizontal_error = null;
                // Make marker of non-plausible point almost invisible.
                marker.setOpacity(0.3);
            }
            // Add timestamp as popup to marker.
            marker.bindPopup(date.toUTCString().replace('GMT', 'UTC'));
            // Add marker to respective layer to allow easy enabling.
            markersLayer.addLayer(marker);
        }
    }

    if (pointList.length > 0) {

        // Add track as polyline to map.
        var polyline = new L.Polyline(pointList, {
            color: lineColour,
            weight: 3,
            opacity: 1.0,
            smoothFactor: 1,
            interactive: false
        });
        // polyline.addTo(map);  // Do not add line to map by default
        // Add polyline to respective layer to allow easy disabling.
        lineLayer.addLayer(polyline);
        // Fit bounds of map to track.
        map.fitBounds(polyline.getBounds().pad(0.1), {maxZoom: 16});
        // Padding to guarantee some space around everything

    } else {

        // If no plausible point exist, show whole world
        map.setView([0, 0], 1);

    }

    if (positions.length > 0 && percentageLbl.innerHTML === '-') {

        // Provide percentage of failed fixes.
        percentageLbl.innerHTML = (Number.parseFloat(
                                        100.0 * (1.0 - pointList.length
                                                        / positions.length)
                                    ).toFixed(1)
                                    + '%');

        // Display warning if fix rate is low
        if (pointList.length === 0) {
            processingWarningDisplay.style.display = '';
            processingWarningText.innerHTML = 'SnapperGPS did not find any confident location estimates for your uploaded snapshots. ' +
                'Check the troubleshooting section on ' +
                 "<a class='text-link' href='/'>the home page</a> " +
                 'and the ' +
                 "<a class='text-link' href='https://github.com/SnapperGPS/snappergps-pcb/discussions'>the discussions on GitHub</a> " +
                 'to improve your results.';
        } else if (pointList.length / positions.length < 0.7) {
            processingWarningDisplay.style.display = '';
            processingWarningText.innerHTML = 'SnapperGPS did not find confident location estimates for quite a few of your uploaded snapshots. ' +
                'Check the troubleshooting section on ' +
                 "<a class='text-link' href='/'>the home page</a> " +
                 'and the ' +
                 "<a class='text-link' href='https://github.com/SnapperGPS/snappergps-pcb/discussions'>the discussions on GitHub</a> " +
                 'to improve your results.';
        }

        if (pointList.length > 0) {
            enableOrDisableSmoothing(false);
        }

    }

}

/**
 * Create an encoded URI to download positions data
 * @param {int} positionIdx Index of position to be removed
 */
function removePosition (positionIdx) {

    positions[positionIdx].estimated_horizontal_error = null;

    populateMap(positions);

    raw_positions[positionIdx].estimated_horizontal_error = null;

}
window.removePosition = removePosition;

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

function fixPrecision (value, precision) {

    try {

        if (value === null) {

            return '';

        } else {

            return value.toFixed(precision);

        }

    } catch {

        return value;

    }

}

// Download buttons for the upload records as CSV, GeoJSON, JSON or KML file.

/**
 * Download data as .csv file.
 *
 * Yields .csv file with the following columns:
 *  datetime
 *  latitude
 *  longitude
 *  confidence
 *  temperature
 *  battery
 *  id
 */
downloadCSVButton.addEventListener('click', () => {

    const rows = [['datetime', 'latitude', 'longitude', 'confidence', 'temperature', 'battery', 'id']];

    // Loop over all data and add rows to csv array.
    for (let i = 0; i < positions.length; ++i) {

        // UNIX time [s] to UTC.
        const dateTime = new Date(positions[i].timestamp * 1000);
        if (dateTime >= startDateTime && dateTime <= endDateTime) {

            const lat = fixPrecision(positions[i].estimated_lat, 6);
            const lng = fixPrecision(positions[i].estimated_lng, 6);
            const confidence = fixPrecision(positions[i].estimated_horizontal_error, 1);
            const temperature = fixPrecision(positions[i].temperature, 1);
            const battery = fixPrecision(positions[i].battery, 2);

            rows.push([dateTime.toISOString(), lat, lng, confidence, temperature, battery, i]);

        }

    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');

    createDownloadLink(csvContent, uploadID + '.csv');

});

downloadJSONButton.addEventListener('click', () => {

    const elements = [];
    // Loop over all data and add rows to JSON object.
    for (let i = 0; i < positions.length; ++i) {

        const dateTime = new Date(positions[i].timestamp * 1000);

        if (dateTime >= startDateTime && dateTime <= endDateTime) {

            elements.push({

                // UNIX time [s] to UTC.
                datetime: dateTime.toISOString(),

                latitude: positions[i].estimated_lat,
                longitude: positions[i].estimated_lng,

                confidence: positions[i].estimated_horizontal_error,
                temperature: positions[i].temperature,
                battery: positions[i].battery,

                id: i

            });

        }

    }

    const jsonContent = 'data:text/json;charset=utf-8,' + JSON.stringify(elements, null, 4);

    createDownloadLink(jsonContent, uploadID + '.json');

});

/**
 * Convert markers layer into GeoJSON object.
 *
 * Populate default 'coordinates' fields.
 * Add custom 'timestamp' property.
 *
 * @return {GeoJSON}  json object.
 */
function getGeoJson () {

    const json = markersLayer.toGeoJSON();
    // Loop over all data to add timestamps.
    let j = 0; // Index for json elements
    for (let i = 0; i < positions.length; ++i) {

        // UNIX time [s] to UTC.
        var date = new Date(positions[i].timestamp * 1000);
        if (date >= startDateTime && date <= endDateTime) {

            // Add timestamp, temperature, and battery property.
            json.features[j].properties.timestamp = date.toISOString();
            json.features[j].properties.confidence = positions[i].estimated_horizontal_error;
            json.features[j].properties.temperature = positions[i].temperature;
            json.features[j].properties.battery = positions[i].battery;
            // Add ID property.
            json.features[j++].properties.id = i;

        }

    }
    return json;

}

/**
 * Download data as .json file (GeoJSON format).
 *
 * Populate default 'coordinates' fields.
 * Add custom 'timestamp' property.
 */
downloadGeoJSONButton.onclick = async () => {

    // Convert marker layer to json object and json object to string.
    const jsonStr = 'data:text/csv;charset=utf-8,' + JSON.stringify(getGeoJson(), null, 4);

    // Provide download.
    createDownloadLink(jsonStr, uploadID + '.json');

};

downloadKMLButton.addEventListener('click', () => {

    let kmlContent = 'data:text/kml;charset=utf-8,';

    kmlContent += '<?xml version="1.0" encoding="UTF-8"?>\n';
    kmlContent += '<kml xmlns="http://www.opengis.net/kml/2.2">\n';
    kmlContent += '\t<Document>\n';
    kmlContent += '\t<name>SnapperGPS track ' + uploadID + '</name>\n';
    // TODO: Add description, e.g., link to website
    kmlContent += '\t<description></description>\n';

    for (let i = 0; i < positions.length; ++i) {

        // Check if point is valid.
        let lat, lng;
        if (isPositionValid(positions[i])) {
            lat = fixPrecision(positions[i].estimated_lat, 6);
            lng = fixPrecision(positions[i].estimated_lng, 6);
        } else {
            lat = 0;
            lng = 0;
        }

        const dt = new Date(positions[i].timestamp * 1000);

        if (dt >= startDateTime && dt <= endDateTime) {

            const confidence = fixPrecision(positions[i].estimated_horizontal_error, 1);
            const temperature = fixPrecision(positions[i].temperature, 1);
            const battery = fixPrecision(positions[i].battery, 2);

            kmlContent += '\t\t<Placemark>\n';
            kmlContent += '\t\t\t<name>' + i.toString() + '</name>\n';
            kmlContent += '\t\t\t<ExtendedData>\n';
            kmlContent += '\t\t\t\t<Data name="confidence">\n';
            kmlContent += '\t\t\t\t\t<value>' + confidence + '</value>\n';
            kmlContent += '\t\t\t\t</Data>\n';
            kmlContent += '\t\t\t\t<Data name="temperature">\n';
            kmlContent += '\t\t\t\t\t<value>' + temperature + '</value>\n';
            kmlContent += '\t\t\t\t</Data>\n';
            kmlContent += '\t\t\t\t<Data name="battery">\n';
            kmlContent += '\t\t\t\t\t<value>' + battery + '</value>\n';
            kmlContent += '\t\t\t\t</Data>\n';
            kmlContent += '\t\t\t</ExtendedData>\n';
            kmlContent += '\t\t\t<TimeStamp>\n';
            kmlContent += '\t\t\t\t<when>' + dt.toISOString() + '</when>\n';
            kmlContent += '\t\t\t</TimeStamp>\n';
            kmlContent += '\t\t\t<Point>\n';
            kmlContent += '\t\t\t\t<coordinates>' + lng + ',' + lat + '</coordinates>\n';
            kmlContent += '\t\t\t</Point>\n';
            kmlContent += '\t\t</Placemark>\n';

        }

    }

    kmlContent += '\t</Document>\n';
    kmlContent += '</kml>';

    createDownloadLink(kmlContent, uploadID + '.kml');

});

/**
 * Check if a point from the database has valid coordinates.
 */
function isPositionValid (position) {
    // Extract point.
    const lat = position.estimated_lat;
    const lng = position.estimated_lng;
    return (!isNaN(lat) && !isNaN(lng)
            && !(lat === null) && !(lng === null)
            && !(lat === undefined) && !(lng === undefined)
            && lat > -90.0 && lat < 90.0
            && lng > -180.0 && lng < 180.0)
}

/**
 * Check if a point from the database is a good fix.
 */
function isPositionPlausible (position) {
    // Extract point.
    const lat = position.estimated_lat;
    const lng = position.estimated_lng;
    const confidence = position.estimated_horizontal_error;
    return (!isNaN(lat) && !isNaN(lng)
            && !(lat === null) && !(lng === null)
            && !(lat === undefined) && !(lng === undefined)
            && lat > -90.0 && lat < 90.0
            && lng > -180.0 && lng < 180.0
            && !isNaN(confidence)
            && !(confidence === null)
            && !(confidence === undefined)
            && confidence < 200)
}

function enableOrDisableButtons (disableButtons) {

    downloadCSVButton.disabled = disableButtons;
    downloadJSONButton.disabled = disableButtons;
    downloadKMLButton.disabled = disableButtons;
    downloadGeoJSONButton.disabled = disableButtons;

}

function enableOrDisableSmoothing (disableSmoothing) {
    smoothInput.disabled = disableSmoothing;
}

startDateInput.addEventListener('change', () => {

    startDateTime = new Date(startDateInput.value + ' ' + startTimeInput.value + 'Z');
    // Fix WebKit problem
    if (isNaN(startDateTime)) {
        console.log('Problem with input date, trying to fix it...');
        startDateTime = new Date(startDateInput.value + 'T' + startTimeInput.value + 'Z');
    }

    enableOrDisableButtons(startDateTime > new Date(positions[processedPositionCount - 1].timestamp * 1000) ||
                           endDateTime < new Date(positions[0].timestamp * 1000) ||
                           startDateTime > endDateTime);

    populateMap(positions);

});

startTimeInput.addEventListener('change', () => {

    startDateTime = new Date(startDateInput.value + ' ' + startTimeInput.value + 'Z');
    // Fix WebKit problem
    if (isNaN(startDateTime)) {
        console.log('Problem with input date, trying to fix it...');
        startDateTime = new Date(startDateInput.value + 'T' + startTimeInput.value + 'Z');
    }

    enableOrDisableButtons(startDateTime > new Date(positions[processedPositionCount - 1].timestamp * 1000) ||
                           endDateTime < new Date(positions[0].timestamp * 1000) ||
                           startDateTime > endDateTime);

    populateMap(positions);

});

endDateInput.addEventListener('change', () => {

    endDateTime = new Date(endDateInput.value + ' ' + endTimeInput.value + 'Z');
    // Fix WebKit problem
    if (isNaN(endDateTime)) {
        console.log('Problem with input date, trying to fix it...');
        endDateTime = new Date(endDateInput.value + 'T' + endTimeInput.value + 'Z');
    }

    enableOrDisableButtons(startDateTime > new Date(positions[processedPositionCount - 1].timestamp * 1000) ||
                           endDateTime < new Date(positions[0].timestamp * 1000) ||
                           startDateTime > endDateTime);

    populateMap(positions);

});

endTimeInput.addEventListener('change', () => {

    endDateTime = new Date(endDateInput.value + ' ' + endTimeInput.value + 'Z');
    // Fix WebKit problem
    if (isNaN(endDateTime)) {
        console.log('Problem with input date, trying to fix it...');
        endDateTime = new Date(endDateInput.value + 'T' + endTimeInput.value + 'Z');
    }

    enableOrDisableButtons(startDateTime > new Date(positions[processedPositionCount - 1].timestamp * 1000) ||
                           endDateTime < new Date(positions[0].timestamp * 1000) ||
                           startDateTime > endDateTime);

    populateMap(positions);

});

smoothInput.addEventListener('change', () => {

    // Indicate smoothing with spinning spinner
    smoothSpinner.style.display = '';
    smoothSpan.innerHTML = 'Smoothing';

    // Disable all buttons during smoothing
    enableOrDisableSmoothing(true);
    enableOrDisableButtons(true);

    // Get smoothing parameter
    const sigma_noise = Math.pow(10, parseFloat(smoothInput.value));

    if (sigma_noise === 100.0) {
        console.log('Reset.')
        positions = JSON.parse(JSON.stringify(raw_positions));
    } else {
        
        const reference_latlon = new LatLon(referencePoints[0].lat, referencePoints[0].lng, 0.0);

        let firstPlausiblePositionIdx = 0;
        while (!isPositionPlausible(raw_positions[firstPlausiblePositionIdx]) && firstPlausiblePositionIdx < positions.length) { ++firstPlausiblePositionIdx };
        console.log('First plausible position at index ' + firstPlausiblePositionIdx + '.');

        if (firstPlausiblePositionIdx < positions.length) {

            // State transition
            const F = 1.0;

            // Observation model
            const H = 1.0;

            // A priori state estimate at time k given observations up to and including at
            // time k-1
            const xn_prio = Array(positions.length).fill(NaN);
            const xe_prio = Array(positions.length).fill(NaN);
            // A priori estimate covariance matrix (a measure of the estimated accuracy of
            // the state estimate)
            const Pn_prio = Array(positions.length).fill(NaN);
            const Pe_prio = Array(positions.length).fill(NaN);
            // A posteriori state estimate at time k given observations up to and including
            // at time k
            const xn_post = Array(positions.length).fill(NaN);
            const xe_post = Array(positions.length).fill(NaN);
            // A posteriori estimate covariance matrix (a measure of the estimated accuracy
            // of the state estimate)
            const Pn_post = Array(positions.length).fill(NaN);
            const Pe_post = Array(positions.length).fill(NaN);

            // Initialise with 1st observation
            const init_position = raw_positions[firstPlausiblePositionIdx];
            const init_latlon = new LatLon(init_position.estimated_lat, init_position.estimated_lng, 0.0);
            const init_ned = reference_latlon.deltaTo(init_latlon);
            xn_post[0] = init_ned.north;
            xe_post[0] = init_ned.east;
            Pn_post[0] = init_position.estimated_horizontal_error / Math.sqrt(2);
            Pe_post[0] = init_position.estimated_horizontal_error / Math.sqrt(2);

            // Forward pass, same as regular Kalman filter
            for (let k = 1; k < positions.length; ++k) {

                // console.log('Forward pass ' + (k+1) + "/" + positions.length);

                const position = raw_positions[k];
                const prev_position = raw_positions[k-1];
                const dT = position.timestamp - prev_position.timestamp;
                // console.log('dT = ' + dT + ' s');

                // Predicted (a priori) state estimate
                xn_prio[k] = F * xn_post[k-1];  // KF
                xe_prio[k] = F * xe_post[k-1];  // KF
                // Covariance of process noise
                const Q = sigma_noise * dT;
                // Predicted (a priori) estimate covariance
                Pn_prio[k] = F * Pn_post[k-1] * F + Q;
                Pe_prio[k] = F * Pe_post[k-1] * F + Q;

                // Check if observation is valid
                if (isPositionPlausible(position)) {

                    // Observation
                    const latlon = new LatLon(position.estimated_lat, position.estimated_lng, 0.0);
                    const ned = reference_latlon.deltaTo(latlon);
                    const zn = ned.north;
                    const ze = ned.east;

                    // Innovation or measurement pre-fit residual
                    const yn = zn - H * xn_prio[k];
                    const ye = ze - H * xe_prio[k];
                    // Covariance of observation noise
                    const R = position.estimated_horizontal_error / Math.sqrt(2);
                    // Innovation (or pre-fit residual) covariance
                    const Sn = H * Pn_prio[k] * H + R;
                    const Se = H * Pe_prio[k] * H + R;
                    // Optimal Kalman gain
                    const Kn = Pn_prio[k] * H * (1.0 / Sn);
                    const Ke = Pe_prio[k] * H * (1.0 / Se);
                    // Updated (a posteriori) state estimate
                    xn_post[k] = xn_prio[k] + Kn * yn;
                    xe_post[k] = xe_prio[k] + Ke * ye;
                    // Updated (a posteriori) estimate covariance
                    Pn_post[k] = (1.0 - Kn * H) * Pn_prio[k];
                    Pe_post[k] = (1.0 - Ke * H) * Pe_prio[k];

                } else {

                    // Ignore invalid observation, just propagate state
                    xn_post[k] = xn_prio[k];
                    xe_post[k] = xe_prio[k];
                    Pn_post[k] = Pn_prio[k];
                    Pe_post[k] = Pe_prio[k];

                }

            }

            // Smoothed state estimates
            const xn_smooth = Array(positions.length).fill(NaN);
            const xe_smooth = Array(positions.length).fill(NaN);
            // Smoothed covariances
            const Pn_smooth = Array(positions.length).fill(NaN);
            const Pe_smooth = Array(positions.length).fill(NaN);
            
            // Initialise with last filtered estimate
            xn_smooth[positions.length-1] = xn_post[positions.length-1];
            xe_smooth[positions.length-1] = xe_post[positions.length-1];
            Pn_smooth[positions.length-1] = Pn_post[positions.length-1];
            Pe_smooth[positions.length-1] = Pe_post[positions.length-1];
            
            // Backward pass
            for (let k = positions.length - 2; k >= 0; --k) {
                // console.log('Backward pass ' + (positions.length - k) + "/" + positions.length);
                const Cn = Pn_post[k] * F * (1.0 / Pn_prio[k+1]);
                const Ce = Pe_post[k] * F * (1.0 / Pe_prio[k+1]);
                xn_smooth[k] = xn_post[k] + Cn * (xn_smooth[k+1] - xn_prio[k+1]);
                xe_smooth[k] = xe_post[k] + Ce * (xe_smooth[k+1] - xe_prio[k+1]);
                Pn_smooth[k] = Pn_post[k] + Cn * (Pn_smooth[k+1] - Pn_prio[k+1]) * Cn;
                Pe_smooth[k] = Pe_post[k] + Ce * (Pe_smooth[k+1] - Pe_prio[k+1]) * Ce;
            }

            // Convert to latitude/longitude
            for (let i = 0; i < positions.length; ++i) {
                const ned = new Ned(xn_smooth[i], xe_smooth[i], 0.0);
                const latlon = reference_latlon.destinationPoint(ned);
                positions[i].estimated_lat = latlon._lat;
                positions[i].estimated_lng = latlon._lon;
                positions[i].estimated_horizontal_error = Math.sqrt(Math.pow(Pn_smooth[i], 2) + Math.pow(Pe_smooth[i], 2));
            }

        } else {

            console.log('Could not find plausible position.');

        }
    }

    // Update map with smoothed track
    populateMap(positions);

    // Enable all buttons again
    enableOrDisableSmoothing(false);
    enableOrDisableButtons(false);

    // Stop spinner
    smoothSpinner.style.display = 'none';
    smoothSpan.innerHTML = '';
});

// Prepare page by first loading the map

console.log('Loading map');

mapLayers = getTileLayers();
// Create map with some overlay layers and one of the base layers.
// (Skip markersLayer because it slows down everything if 10,000 points are present.)
// Skip line layer because it might look cumbersome
map = L.map('display-map', {
    layers: [mapLayers.Dark, circlesLayer]
});

var overlayMaps = {
    Track: lineLayer,
    Markers: markersLayer,
    Confidences: circlesLayer
};

// Add control to select base map layer and to disable overlay layers.
L.control.layers(mapLayers, overlayMaps).addTo(map);

L.control.scale({position: 'bottomleft'}).addTo(map);

console.log('Loading upload ID', uploadID);

// Request upload information from server

getInformation(() => {

    populateFields();

    // Fill map with processed positions (if any exist)

    getPositions(uploadID, (positionRes) => {

        positions = JSON.parse(positionRes).positions;

        processedPositionCount = positions.length;

        const disableButtons = (processedPositionCount === null ||
                                processedPositionCount === 0);

        enableOrDisableButtons(disableButtons);

        if (!disableButtons) {

            // Initialize date-time range picker

            startDateTime = new Date(positions[0].timestamp * 1000); // Unix time [s] to UTC
            endDateTime = new Date(Math.ceil(positions[processedPositionCount - 1].timestamp / 60) * 60 * 1000); // Unix time [s] to UTC, round-up

            startDateInput.value = startDateTime.toISOString().substr(0, 10);
            endDateInput.value = endDateTime.toISOString().substr(0, 10);
            startTimeInput.value = startDateTime.toISOString().substr(11, 5);
            endTimeInput.value = endDateTime.toISOString().substr(11, 5);

            startDateInput.disabled = false;
            endDateInput.disabled = false;
            startTimeInput.disabled = false;
            endTimeInput.disabled = false;

        }

        populateMap(positions);

        populateFields();

        // Disable spinner when not loading
        downloadSpinner.style.display = 'none';

        // Display warning if no snpahsots processed
        if (processedPositionCount === null || processedPositionCount === 0) {
            processingWarningDisplay.style.display = '';
            processingWarningText.innerHTML = 'SnappperGPS has not processed your snapshots yet.';
        }

        // Remember raw positions from database
        raw_positions = JSON.parse(positionRes).positions;

    });

});
