/****************************************************************************
 * viewUI.js
 * March 2021
 *****************************************************************************/

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
//     iconUrl: 'images/marker-icon.png',
//     iconSize: [56 / 2, 82 / 2], // size of the icon
//     iconAnchor: [56 / 4, 82 / 2], // point of the icon which will correspond to marker's location
//     popupAnchor: [0, -76 / 2] // point from which the popup should open relative to the iconAnchor
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

var positions = {};

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
            //  Do not add marker to map by default because it slows down
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
                }).addTo(map); // Add to map by default
                // Add timestamp as popup to circle.
                circle.bindPopup(date.toUTCString().replace('GMT', 'UTC'));
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

    }

}

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

    });

});
