/****************************************************************************
 * configureUI.js
 * April 2021
 *****************************************************************************/

/* global requestDevice, isDeviceAvailable, getDeviceInformation,
resetDeviceInfo, setDisconnectFunction, connectToDevice, updateFirmware,
updateCache, firmwareSize, firmwareChunkSize */

const pairButton = document.getElementById('pair-button');

const errorDisplay = document.getElementById('error-display');
const errorText = document.getElementById('error-text');

const firmwareInfo = document.getElementById('firmware-info');
const firmwareButton = document.getElementById('firmware-button');
const firmwareSpinner = document.getElementById('firmware-spinner');

// Custom firmware upload
const fileInput = document.getElementById('file-input');
// const totalSizeInput = document.getElementById('total-size-input');
// const chunkSizeInput = document.getElementById('chunk-size-input');

var configuring = false;
var restarting = false;

/**
 * Enable configuration user interface objects
 */
function enableUI () {

    if (isDeviceAvailable()) {

    } else {

        pairButton.disabled = false;

    }

}

/**
 * Disable configuration user interface objects
 */
function disableUI () {

    pairButton.disabled = true;
    firmwareButton.disabled = true;

}

/**
 * Looping function which checks for presence of WebUSB device
 */
function checkForDevice (repeat = true) {

    if (isDeviceAvailable()) {

        if (!configuring) {

            // Only talk to device if it is not busy.

            // Change button style after firmware update back
            setUpdating(false);

            // Enable everything after firmware update
            enableUI();
            restarting = false;

            getDeviceInformation();

            if (firmwareSize > 0 && firmwareChunkSize > 0) {

                if (fileInput.files.length > 0) {

                    firmwareButton.disabled = false;
                    firmwareInfo.innerHTML = 'Firmware available for update.';

                } else {

                    firmwareButton.disabled = true;

                    firmwareInfo.innerHTML = 'No firmware for update selected.';

                }

            } else {

                firmwareInfo.innerHTML = 'Your device does not support firmware updates.';

            }

        }

        pairButton.disabled = true;

    } else {

        resetDeviceInfo();
        firmwareButton.disabled = true;

        if (!restarting) {

            firmwareInfo.innerHTML = 'No receiver connected.';
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
function displayError (err) {

    console.error(err);

    errorDisplay.style.display = '';
    errorText.innerHTML = err;

    window.scrollTo(0, 0);

}

firmwareButton.addEventListener('click', () => {

    // Check if device is connected and not busy
    if (isDeviceAvailable() && !configuring) {

        disableUI();

        // Change button style
        setUpdating(true);

        firmwareInfo.innerHTML = 'Sending firmware.';

        updateFirmware(fileInput.files, firmwareSize, firmwareChunkSize).then(() => {

            // Successfully updated firmware, delete existing error message
            errorDisplay.style.display = 'none';

            // Device will restart now
            firmwareInfo.innerHTML = 'Restarting SnapperGPS receiver.';
            restarting = true;

            // Wait a bit to not trigger a connection attempt before the device has shut down
            setTimeout(function () {

                configuring = false;

            }, 1000);

        }).catch((err) => {

            // Failed to update firmware, show error message
            displayError(err.message);

            // Change button style back
            setUpdating(false);

            enableUI();

        }).finally(() => {

        });

    }

});

/**
 * Update firmware button and UI to display a spinner and "Updating..." text when snapshots are being transferred
 * @param {bool} isUpdating Is the app currently transferring snapshots
 */
function setUpdating (isUpdating) {

    configuring = isUpdating;

    firmwareSpinner.style.display = isUpdating ? '' : 'none';

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

// Set the function which will be called when a WebUSB device is disconnected

setDisconnectFunction(() => {

    // Wipe the device information panel

    resetDeviceInfo();

    firmwareButton.disabled = true;

});

if (!navigator.usb) {

    pairButton.disabled = true;
    firmwareButton.disabled = true;

} else {

    // Check to see if a device is already connected

    checkForDevice(true);

    connectToDevice(true);

}

updateCache();
