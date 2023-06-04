/****************************************************************************
 * uploadComms.js
 * March 2021
 *****************************************************************************/

/* global FormData, sendPOSTRequest, connectToDevice */

// Maximum number of attempts to upload a snapshot before giving up
const MAX_ATTEMPTS = 5;

/**
 * Attempt to upload a given FormData object
 * @param {object} formData FormData object containing upload ID, snapshot data, and information
 * @param {integer} attempt Attempt number of upload. If exceeds MAX_ATTEMPTS, give up
 * @param {function} individualPostCallback Function called when this file is successfully uploaded or the process fails
 */
function postSnapshot(formData, attempt, individualPostCallback) {

    if (attempt >= MAX_ATTEMPTS) {

        console.log('Gave up trying to upload snapshot after ' + MAX_ATTEMPTS + ' tries');

        individualPostCallback(false);
        return;

    }

    sendPOSTRequest('addSnapshot', formData, (postRes) => {

        if (!postRes) {

            console.log('Failed to post snapshot (Attempt ' + (attempt + 1) + ').');

            postSnapshot(formData, attempt + 1, individualPostCallback);
            return;

        }

        individualPostCallback(true);

    });

}

/**
 * Create an upload instance to allow snpahots to be uploaded to the database. Callback returns the error (if any) and the upload ID
 * At least one of either the start or end location must be included as an estimate
 * @param {string} deviceID Unique ID assigned to each Snapper device
 * @param {string} email User email address
 * @param {string} subscription User push notification subscription
 * @param {string} maxVelocity Maximum receiver velocity
 * @param {function} callback Function called on completion
 */
function startUpload(deviceID, email, subscription, maxVelocity, nickname, callback) {

    const formData = new FormData();
    formData.append('deviceID', deviceID);
    formData.append('email', email);
    formData.append('subscription', subscription);
    formData.append('maxVelocity', maxVelocity);
    formData.append('nickname', nickname)

    sendPOSTRequest('startUpload', formData, (startRes) => {

        if (!startRes) {

            callback('Could not start upload process. No response from server.');
            return;

        }

        const uploadID = startRes;

        console.log('Started uploading files using upload ID ' + uploadID);

        callback(false, uploadID);

    });

}

/**
 * Using an existing upload ID, submit snapshots to the database
 * @param {string} uploadID Unique ID returned by startUpload()
 * @param {object} data Buffer of snapshot data
 * @param {object} dt Datetime object for when the snapshot was created
 * @param {float} battery Battery level when snapshot was created
 * @param {int} hxfoCount HXFO clock count when snapshot was created
 * @param {int} lxfoCount LXFO clock count when snapshot was created
 * @param {float} temperature Temperature when snapshot was created
 * @returns Promise of flag indicating the success of uploading the snapshot after a set number of attempts
 */
function uploadSnapshot(uploadID, data, dt, battery, hxfoCount, lxfoCount, temperature) {

    return new Promise((resolve) => {

        // Bundle information into FormData object which can be sent in a POST request
        const formData = new FormData();
        formData.append('data', data, 'snapshot.dat');
        formData.append('uploadID', uploadID);
        formData.append('datetime', dt.toISOString());
        formData.append('battery', battery);
        formData.append('hxfoCount', hxfoCount);
        formData.append('lxfoCount', lxfoCount);
        formData.append('temperature', temperature);

        console.log('Uploading a snapshot using upload ID ' + uploadID);

        postSnapshot(formData, 0, (success) => {

            resolve(success);

        });

    });

}

function addReferencePoint(uploadID, lat, lng, time) {

    return new Promise((resolve) => {

        const formData = new FormData();
        formData.append('uploadID', uploadID);
        formData.append('datetime', time.toISOString());
        formData.append('lat', lat);
        formData.append('lng', lng);

        console.log('Adding a reference point to upload with ID ' + uploadID);

        sendPOSTRequest('addReferencePoint', formData, (postRes) => {

            if (!postRes) {

                resolve(false);
                return;

            }

            resolve(true);

        });

    });

}

/**
 * Update upload status from "uploading" to "waiting" to allow processing script to process it
 * @param {string} uploadID Unique ID returned by startUpload()
 * @param {function} callback Function called on completion
 */
function finishUpload(uploadID, earliestProcessingDateString, callback) {

    const formData = new FormData();
    formData.append('uploadID', uploadID);
    formData.append('earliestProcessingDateString', earliestProcessingDateString);

    console.log('Finishing upload process');

    sendPOSTRequest('finishUpload', formData, callback);

}

/**
 * In the event of failure, delete upload and all snapshots associated with it
 * @param {string} uploadID Unique ID returned by startUpload()
 */
function cancelUpload(uploadID) {

    console.log('Cancelling upload with upload ID ' + uploadID);

    const formData = new FormData();
    formData.append('uploadID', uploadID);

    sendPOSTRequest('cancelUpload', formData);

}

connectToDevice();
