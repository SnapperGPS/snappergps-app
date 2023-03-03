/****************************************************************************
 * viewComms.js
 * April 2021
 *****************************************************************************/

/* global FormData, sendPOSTRequest */

/**
 * Request start/end locations of points in a given upload
 * @param {string} uploadID Uniquer upload ID assigned by database
 * @param {function} callback Function called on completion
 */
function loadUploadData(uploadID, callback) {

    const formData = new FormData();
    formData.append('uploadID', uploadID);

    sendPOSTRequest('getUploadInformation', formData, callback);

}

/**
 * Request positions and the corresponding corrected timestamps for a given upload
 * @param {string} uploadID Unique upload ID
 * @param {function} callback Function called on completion
 */
function getPositions(uploadID, callback) {

    const formData = new FormData();
    formData.append('uploadID', uploadID);

    sendPOSTRequest('getPositions', formData, callback);

}

/**
 * Request first and last snapshot timestamp
 * @param {string} uploadID Unique upload ID
 * @param {function} callback Function called on completion
 */
function getFirstLastSnapshotTimestamps(uploadID, callback) {

    const formData = new FormData();
    formData.append('uploadID', uploadID);

    sendPOSTRequest('getFirstLastSnapshotTimestamps', formData, callback);

}
