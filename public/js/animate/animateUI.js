/****************************************************************************
 * animateUI.js
 * March 2022
 *****************************************************************************/


/* global L */

const mapboxAccessToken = 'pk.eyJ1Ijoiamdyb3Nza3JldXoiLCJhIjoiY2tseWIxNTRoMHFvODJxbHlyanRobzBmZiJ9.xz2KrKBy5MRCf9XLOOPdzA';

const warningDisplay = document.getElementById('warning-display');
const warningText = document.getElementById('warning-text');
const playButton = document.getElementById('play-button');
const durationInput = document.getElementById('duration-input');
const followCheckbox = document.getElementById('follow-checkbox');
const hideMapControlsCheckbox = document.getElementById('hide-map-controls-checkbox');
const hideMapScaleCheckbox = document.getElementById('hide-map-scale-checkbox');
const colorInput = document.getElementById('color-input');
const weightInput = document.getElementById('weight-input');
const opacityInput = document.getElementById('opacity-input');
const loopCheckbox = document.getElementById('loop-checkbox');
const pointLimitInput = document.getElementById('point-limit-input');

// Get colors of AIMS color scheme from CSS variables
const lineColour = window.getComputedStyle(warningDisplay).getPropertyValue('--aims-purple');
const circleColour = window.getComputedStyle(warningDisplay).getPropertyValue('--aims-pink');

// Initialize overlay layer for the track as polyline
const lineLayer = L.layerGroup();

// Map variables
var mapLayers;
var map;

// Animation variables
var polylineArray = null;
var polyline = null;
var animationInterval = null;
var animationStartTime = null;

/**
 * Request tile layer to display on a Leaflet map
 * @param {string} id Leaflet title layer ID
 * @returns Tile layer object
 */
function getTileLayer(id) {

    // Retrieve specific base map layer from mapbox API
    return L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
        attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery &copy <a href="https://www.mapbox.com/">Mapbox</a>',
        id: id,
        accessToken: mapboxAccessToken
    });

}

/**
 * Get all tile layers a user could choose to display on a map
 * @returns A JSON object of tile layers
 */
function getTileLayers() {

    return {
        Streets: getTileLayer('mapbox/streets-v11'),
        Outdoors: getTileLayer('mapbox/outdoors-v11'),
        Light: getTileLayer('mapbox/light-v10'),
        Dark: getTileLayer('mapbox/dark-v10'),
        Satellite: getTileLayer('mapbox/satellite-v9'),
        'Satellite & Streets': getTileLayer('mapbox/satellite-streets-v11')
    };

}

// Prepare page by first loading the map

mapLayers = getTileLayers();

// Create map with some overlay layers and one of the base layers.
map = L.map('display-map', {
    layers: [mapLayers.Dark, lineLayer]
});

var overlayMaps = {
    Track: lineLayer
};

// Add control to select base map layer and to disable overlay layers
var layerControl = L.control.layers(mapLayers, overlayMaps).addTo(map);

// Add map scale
var scaleControl = L.control.scale({ position: 'bottomleft' }).addTo(map);

// Get zoom cotrol handle
var zoomControl = map.zoomControl;

// Set default line color
colorInput.value = lineColour;

// Load track from local storage if it exists
if (localStorage.getItem('pointList') !== null) {
    // Add track as polyline to map
    polylineArray = JSON.parse(localStorage.getItem('pointList'));
    polyline = new L.Polyline(polylineArray, {
            color: lineColour,
            weight: 3,
            opacity: 1.0,
            smoothFactor: 1,
            interactive: false
        });
    lineLayer.addLayer(polyline);
    // Fit map to track and center it
    map.fitBounds(polyline.getBounds().pad(0.1), { maxZoom: 16 });
    // Enable inputs and buttons
    durationInput.disabled = false;
    playButton.disabled = false;
    followCheckbox.disabled = false;
    colorInput.disabled = false;
    weightInput.disabled = false;
    opacityInput.disabled = false;
    loopCheckbox.disabled = false;
    pointLimitInput.disabled = false;
    hideMapControlsCheckbox.disabled = false;
    hideMapScaleCheckbox.disabled = false;
} else {
    // If no plausible point exist, show whole world
    map.setView([0, 0], 1);

    // Display warning message
    warningText.innerHTML = 'No track to display. Go to the <a class="text-link" href="/view">download page</a> and select a track.';
    warningDisplay.style.display = '';
}

// Add event listener to play button
playButton.addEventListener('click', function () {
    // If no track is loaded, do nothing
    if (polyline !== null) {
        if (animationInterval !== null) {
            clearInterval(animationInterval);
        }
        animationStartTime = Date.now();
        // Set duration of animation in milliseconds
        const duration = parseInt(durationInput.value) * 1000;
        // Initialize animation
        const polylineLength = polylineArray.length;
        let currentVertex = 0;
        let currentIteration = 0;
        // Asynchronously animate polyline
        animationInterval = setInterval(function () {
            const elapsedTime = Date.now() - animationStartTime;
            const fraction = elapsedTime / duration - currentIteration;
            const vertexIndex = Math.min(Math.floor(fraction * polylineLength), polylineLength - 1);
            if (vertexIndex !== currentVertex) {
                const pointLimit = parseInt(pointLimitInput.value);
                if (isNaN(pointLimit) || pointLimit < 1) {
                    // No point limit, show all points
                    polyline.setLatLngs(polylineArray.slice(0, vertexIndex + 1));
                } else {
                    // Limit number of points to show
                    polyline.setLatLngs(polylineArray.slice(Math.max(0, vertexIndex - pointLimit), vertexIndex + 1));
                }
                currentVertex = vertexIndex;
                if (followCheckbox.checked) {
                    // Center map on current point
                    map.panTo(polylineArray[vertexIndex]);
                }
            }
            // Check if animation is finished
            if (fraction >= 1) {
                if (loopCheckbox.checked) {
                    // Keep looping
                    currentIteration++;
                } else {
                    clearInterval(animationInterval);
                    animationInterval = null;
                    animationStartTime = null;
                }
            }
        }, 40);  // 40 ms = 25 fps
    }
});

// Add an event listener to the checkbox to toggle the layer and zoom controls
hideMapControlsCheckbox.addEventListener('change', function () {
    if (this.checked) {
        map.removeControl(layerControl);
        map.removeControl(zoomControl);
    } else {
        layerControl.addTo(map);
        zoomControl.addTo(map);
    }
});

// Add an event listener to the checkbox to toggle the map scale
hideMapScaleCheckbox.addEventListener('change', function () {
    if (this.checked) {
        map.removeControl(scaleControl);
    } else {
        scaleControl.addTo(map);
    }
}
);

// Add an event listener to the color input to change the color of the track
colorInput.addEventListener('change', function () {
    if (polyline !== null) {
        polyline.setStyle({ color: this.value });
    }
});

// Add an event listener to the weight input to change the weight of the track
weightInput.addEventListener('change', function () {
    if (polyline !== null) {
        polyline.setStyle({ weight: this.value });
    }
});

// Add an event listener to the opacity input to change the opacity of the track
opacityInput.addEventListener('change', function () {
    if (polyline !== null) {
        polyline.setStyle({ opacity: this.value });
    }
});
