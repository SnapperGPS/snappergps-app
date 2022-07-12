/****************************************************************************
 * configureUI.js
 * April 2021
 *****************************************************************************/

/* global configure, requestDevice, isDeviceAvailable, getDeviceInformation, resetDeviceInfo, setDisconnectFunction, connectToDevice, firmwareVersionSpan, firmwareDescriptionSpan, updateFirmware, updateCache, shutdown, batteryVoltage, statusString */

const intervalInput = document.getElementById('interval-input');
const intervalUnitInput = document.getElementById('interval-unit-input');
const intervalInputText = document.getElementById('interval-input-text');
const intervalInputLabel = document.getElementById('interval-input-label');

const limitStartCheckbox = document.getElementById('limit-start-checkbox');
const limitStartLabel = document.getElementById('limit-start-label');
const limitStartDateInput = document.getElementById('limit-start-date-input');
const limitStartTimeInput = document.getElementById('limit-start-time-input');
const limitStartTimezone = document.getElementById('limit-start-timezone');
const limitEndTimezone = document.getElementById('limit-end-timezone');

const limitEndCheckbox = document.getElementById('limit-end-checkbox');
const limitEndLabel = document.getElementById('limit-end-label');
const limitEndDateInput = document.getElementById('limit-end-date-input');
const limitEndTimeInput = document.getElementById('limit-end-time-input');

const pairButton = document.getElementById('pair-button');
const configureButton = document.getElementById('configure-button');
const shutdownButton = document.getElementById('shutdown-button');

const errorDisplay = document.getElementById('error-display');
const errorText = document.getElementById('error-text');

const firmwareInfo = document.getElementById('firmware-info');
const firmwareButton = document.getElementById('firmware-button');
const firmwareSpinner = document.getElementById('firmware-spinner');

// Low battery warning
const batteryWarningDisplay = document.getElementById('battery-warning-display');

// Info what receiver will do next
const statusInfo = document.getElementById('status-info');
let globalStartDate = null;

const CURRENT_FIRMWARE_DESCRIPTION = 'SnapperGPS-Basic'; // TODO

const CURRENT_FIRMWARE_VERSION = '0.0.7'; // TODO

// Threshold to show low battery warning
const batteryWarningThreshold = 2.0;

var configuring = false;
var restarting = false;

/**
 * Enable configuration user interface objects
 */
function enableUI () {

    if (isDeviceAvailable()) {

        configureButton.disabled = false;
        shutdownButton.disabled = false;

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
    configureButton.disabled = true;
    shutdownButton.disabled = true;

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
            configureButton.disabled = false;
            shutdownButton.disabled = false;

            firmwareButton.disabled = true;

            // 1) Check for firmware description.
            // 2) Look for binary with this description on server.
            // 3) Compare firmware version numbers.
            // 4) If version number on server is higher, offer download.
            if (firmwareDescriptionSpan.innerHTML === '-' || firmwareVersionSpan.innerHTML === '-') {
                firmwareButton.disabled = true;
                firmwareInfo.innerHTML = 'No firmware found on your SnapperGPS receiver.';
            } else if (firmwareVersionSpan.innerHTML !== CURRENT_FIRMWARE_VERSION || firmwareDescriptionSpan.innerHTML !== CURRENT_FIRMWARE_DESCRIPTION) {
                firmwareButton.disabled = false;
                firmwareInfo.innerHTML = `Firmware ${CURRENT_FIRMWARE_DESCRIPTION} version ${CURRENT_FIRMWARE_VERSION} is available.`;
            } else {
                firmwareButton.disabled = true;
                firmwareInfo.innerHTML = 'Your firmware is up to date.';
            }

            let timeDiffString = '';

            if (globalStartDate !== null) {

                const now = Date.now();
                const diffSeconds = (globalStartDate > now) ? (globalStartDate - now) / 1000 : 0;
                const diffMinutes = diffSeconds / 60;
                const diffHours = diffMinutes / 60;
                const diffDays = diffHours / 24;

                if (diffDays >= 1) {

                    timeDiffString += Math.floor(diffDays).toFixed(0) + (diffDays >= 2 ? ' days, ' : ' day, ');

                }

                if (diffHours >= 1 || diffDays >= 1) {

                    timeDiffString += Math.floor(diffHours % 24).toFixed(0) + (diffHours >= 2 ? ' hours, ' : 'hour');

                }

                if (diffMinutes >= 1 || diffHours >= 1 || diffDays >= 1) {

                    timeDiffString += Math.floor(diffMinutes % 60).toFixed(0) + (diffMinutes >= 2 ? ' minutes' : ' minute');
                    timeDiffString = ' in ' + timeDiffString;

                }

            } else {

                timeDiffString = ' at the chosen point in time';

            }

            switch (statusString) {

            case 'Will shutdown':
                statusInfo.innerHTML = 'Your receiver is not configured. Unplug it and it will shutdown and not gather any data.';
                break;
            case 'Erasing':
            case 'Will record':
                statusInfo.innerHTML = 'Your receiver is configured. Unplug it and it will start gathering data' + timeDiffString + '.';
                break;
            default:
                statusInfo.innerHTML = 'The status of your receiver is unknown.';

            }

        }

        pairButton.disabled = true;

    } else {

        resetDeviceInfo();
        configureButton.disabled = true;
        shutdownButton.disabled = true;
        firmwareButton.disabled = true;

        if (!restarting) {

            firmwareInfo.innerHTML = 'No receiver connected.';
            pairButton.disabled = false;

        }

        statusInfo.innerHTML = 'No receiver connected.';

        globalStartDate = null;

    }

    setTimeout(changeUIBasedOnFirmware, 50);

    batteryWarningDisplay.style.display = (batteryVoltage !== null && batteryVoltage < batteryWarningThreshold) ? '' : 'none';

    if (repeat) {

        setTimeout(checkForDevice, 500);

    }

}

// If start/end datetime is enabled or disabled, update the UI

limitStartCheckbox.addEventListener('change', () => {

    limitStartDateInput.disabled = !limitStartCheckbox.checked;
    limitStartTimeInput.disabled = !limitStartCheckbox.checked;
    limitStartLabel.style.color = limitStartCheckbox.checked ? '' : 'lightgray';
    limitStartTimezone.style.color = limitStartCheckbox.checked ? '' : 'lightgray';

});

limitEndCheckbox.addEventListener('change', () => {

    limitEndDateInput.disabled = !limitEndCheckbox.checked;
    limitEndTimeInput.disabled = !limitEndCheckbox.checked;
    limitEndLabel.style.color = limitEndCheckbox.checked ? '' : 'lightgray';
    limitEndTimezone.style.color = limitEndCheckbox.checked ? '' : 'lightgray';

});

const convertDatetimeToTimezone = (dateInput, timeInput) => {

    const timeString = (timeInput.value === '') ? '0:00' : timeInput.value;
    const dt = new Date(dateInput.value + ' ' + timeString);
    let mins = dt.getTimezoneOffset();
    const sign = mins <= 0 ? '+' : '-';
    mins = Math.abs(mins);
    let h = Math.floor(mins / 60);
    let m = mins % 60;
    h = h < 10 ? '0' + h : h;
    m = m < 10 ? '0' + m : m;
    return `UTC${sign}${h}:${m}`;

};

function updateStartTimezone () {

    if (limitStartDateInput.value !== '') {

        limitStartTimezone.innerHTML = convertDatetimeToTimezone(
            limitStartDateInput, limitStartTimeInput);

    } else {

        limitStartTimezone.innerHTML = '';

    }

}

function updateEndTimezone () {

    if (limitEndDateInput.value !== '') {

        limitEndTimezone.innerHTML = convertDatetimeToTimezone(
            limitEndDateInput, limitEndTimeInput);

    } else {

        limitEndTimezone.innerHTML = '';

    }

}

limitStartDateInput.addEventListener('change', () => updateStartTimezone());
limitStartTimeInput.addEventListener('change', () => updateStartTimezone());
limitEndDateInput.addEventListener('change', () => updateEndTimezone());
limitEndTimeInput.addEventListener('change', () => updateEndTimezone());

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

function onConfigureClick () {

    // Check a device is connected and if a configuration isn't already in progress

    if (isDeviceAvailable() && !configuring) {

        disableUI();

        configuring = true;

        let startDt, endDt;

        if (limitStartCheckbox.checked) {

            const startTimeString = (limitStartTimeInput.value === '') ? '0:00' : limitStartTimeInput.value;
            startDt = new Date(limitStartDateInput.value + ' ' + startTimeString);

        } else {

            // No start date selected - start right away
            startDt = new Date(0); // 00:00:00 01/01/1970

        }

        if (limitEndCheckbox.checked) {

            const endTimeString = (limitEndTimeInput.value === '') ? '0:00' : limitEndTimeInput.value;
            endDt = new Date(limitEndDateInput.value + ' ' + endTimeString);

        } else {

            // No end date selected - run "forever"
            endDt = new Date(0xFFFFFFFF * 1000); // 06:28:15 07/02/2106

        }

        let interval = parseInt(intervalInput.value);

        if (intervalUnitInput.value === 'minutes') {

            interval *= 60;

        }

        configure(interval, startDt, endDt, (err) => {

            if (err) {

                displayError(err);

                globalStartDate = null;

            } else {

                errorDisplay.style.display = 'none';

                globalStartDate = startDt;

            }

            configuring = false;
            enableUI();

        });

    }

}

function checkInputs () {

    if (parseInt(intervalInput.value) <= 0) {

        displayError('Please enter a snapshot interval that is greater than zero.');

        intervalInput.style.border = '2px solid red';

        setTimeout(() => {

            intervalInput.style.border = '';

        }, 6000);

        return false;

    }

    if (limitStartCheckbox.checked && limitStartDateInput.value === '') {

        displayError('Please enter a start date.');

        limitStartDateInput.style.border = '2px solid red';

        setTimeout(() => {

            limitStartDateInput.style.border = '';

        }, 6000);

        return false;

    }

    if (limitEndCheckbox.checked && limitEndDateInput.value === '') {

        displayError('Please enter an end date.');

        limitEndDateInput.style.border = '2px solid red';

        setTimeout(() => {

            limitEndDateInput.style.border = '';

        }, 6000);

        return false;

    }

    if (limitStartCheckbox.checked && limitEndCheckbox.checked) {

        const startTimeString = (limitStartTimeInput.value === '') ? '0:00' : limitStartTimeInput.value;
        const startDt = new Date(limitStartDateInput.value + ' ' + startTimeString);

        const endTimeString = (limitEndTimeInput.value === '') ? '0:00' : limitEndTimeInput.value;
        const endDt = new Date(limitEndDateInput.value + ' ' + endTimeString);

        if (startDt > endDt) {

            displayError('Please provide an end date that comes after the start date.');

            limitStartTimeInput.style.border = '2px solid red';
            limitStartDateInput.style.border = '2px solid red';
            limitEndTimeInput.style.border = '2px solid red';
            limitEndDateInput.style.border = '2px solid red';

            setTimeout(() => {

                limitStartTimeInput.style.border = '';
                limitStartDateInput.style.border = '';
                limitEndTimeInput.style.border = '';
                limitEndDateInput.style.border = '';

            }, 6000);

            return false;

        }

    }

    return true;

}

configureButton.addEventListener('click', () => {

    if (checkInputs()) {

        onConfigureClick();

    } else {

        window.scrollTo(0, 0);

    }

});

shutdownButton.addEventListener('click', () => {

    if (isDeviceAvailable() && !configuring) {

        disableUI();

        shutdown((err) => {

            if (err) {

                displayError(err);

            } else {

                errorDisplay.style.display = 'none';

            }

            enableUI();

        });

    }

});

firmwareButton.addEventListener('click', () => {

    // Check if device is connected and not busy
    if (isDeviceAvailable() && !configuring) {

        disableUI();

        // Change button style
        setUpdating(true);

        firmwareInfo.innerHTML = 'Sending firmware.';

        updateFirmware([]).then(() => {

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

    configureButton.disabled = true;
    shutdownButton.disabled = true;
    firmwareButton.disabled = true;
    firmwareInfo.innerHTML = 'No firmware found.';

});

// Disable certain inputs if certain firmware is loaded
function changeUIBasedOnFirmware () {

    const firmwareDescription = firmwareDescriptionSpan.innerHTML;

    if (firmwareDescription === 'SnapperGPS-Saltwater' ||
        firmwareDescription === 'SnapperGPS-Saltwater-Log' ||
        firmwareDescription === 'SnapperGPS-Saltwater-Lin' ||
        firmwareDescription === 'SnapperGPS-Saltwater-Exp') {

        intervalInputText.style.color = 'lightgray';
        intervalInputLabel.style.color = 'lightgray';
        intervalInput.disabled = true;
        intervalInput.style.color = 'lightgray';
        intervalUnitInput.disabled = true;

    } else {

        intervalInputText.style.color = '';
        intervalInputLabel.style.color = '';
        intervalInput.disabled = false;
        intervalInput.style.color = '';
        intervalUnitInput.disabled = false;

    }

}

// Let start date/time default to next hour
const dateTime = new Date();
dateTime.setHours(dateTime.getHours() + Math.ceil(dateTime.getMinutes() / 60));
const today = dateTime.getFullYear() + '-' + ('0' + (dateTime.getMonth() + 1)).slice(-2) + '-' + ('0' + dateTime.getDate()).slice(-2);
const nextHour = ('0' + dateTime.getHours()).slice(-2) + ':00';

limitStartDateInput.value = today;
limitStartTimeInput.value = nextHour;

updateStartTimezone();

if (!navigator.usb) {

    pairButton.disabled = true;
    // changedeviceButton.disabled = true;
    firmwareButton.disabled = true;

} else {

    // Check to see if a device is already connected

    checkForDevice(true);

    connectToDevice(true);

}

updateCache();
