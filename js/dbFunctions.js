/****************************************************************************
 * dbFunctions.js
 * March 2021
 *****************************************************************************/

const crypto = require('crypto');

/**
 * Generate a random, alphanumeric ID of length 10
 */
function generateID() {

    return crypto.randomBytes(5).toString('hex');

}

/**
 * Add a row to the Uploads table
 * @param {object} dbClient Postgres client
 * @param {string} deviceID Unique, 16 character internal EFM32 serial number
 * @param {string} email User email address
 * @param {string} subscription User push notification subscription
 * @param {float} maxVelocity Maximum receiver velocity
 * @param {string} nickname Uplaod nickname
 * @param {function} callback Function called on completion
 */
exports.addUpload = (dbClient, deviceID, email, subscription, maxVelocity, nickname, callback) => {

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();
    const msString = now.getMilliseconds().toString().padStart(3, '0');

    let dtString = year.toString();
    dtString += '-';
    dtString += month.toString();
    dtString += '-';
    dtString += day.toString();
    dtString += ' ';
    dtString += hours.toString();
    dtString += ':';
    dtString += minutes.toString();
    dtString += ':';
    dtString += seconds.toString();
    dtString += '.';
    dtString += msString;

    maxVelocity = (!isNaN(parseFloat(maxVelocity)) && isFinite(maxVelocity)) ? maxVelocity : null;

    // Earliest processing date defaults to the UNIX epoch, then gets updated once all the snapshots have been looked at and the earliest date calculated

    dbClient.query('INSERT INTO uploads(upload_id, device_id, status, earliest_processing_date, datetime, email, subscription, max_velocity, nickname) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING upload_id', [generateID(), deviceID, 'uploading', '1970-01-01 00:00:00', dtString, email, subscription, maxVelocity, nickname], callback);

};

/**
 * Create a new reference point associated with a given upload ID
 * @param {object} dbClient Postgres client
 * @param {string} uploadID Unique upload ID
 * @param {float} lat Latitiude
 * @param {float} lng Longitude
 * @param {string} timeString UTC string of the date/time when the reference point was collected
 * @param {function} callback Function called on completion
 */
exports.addReferencePoint = (dbClient, uploadID, lat, lng, timeString, callback) => {

    const values = [lat, lng, timeString, uploadID];

    dbClient.query('INSERT INTO reference_points(reference_id, lat, lng, datetime, upload_id) VALUES (DEFAULT, $1, $2, $3, $4)', values, callback);

};

/**
 * Get all reference points associated with an upload
 * @param {object} dbClient Postgres client
 * @param {string} uploadID Unique upload ID
 * @param {function} callback Function called on completion
 */
exports.getReferencePoints = (dbClient, uploadID, callback) => {

    dbClient.query('SELECT lat, lng, datetime FROM reference_points WHERE upload_id = $1', [uploadID], callback);

};

/**
 * Get the contents of the uploads table
 * @param {object} dbClient Postgres client
 * @param {function} callback Function called on completion
 */
exports.listUploads = (dbClient, callback) => {

    const selectQuery = 'SELECT * FROM uploads';

    dbClient.query(selectQuery, callback);

};

/**
 * Add a row to the Snapshots table
 * @param {object} dbClient Postgres client
 * @param {string} uploadID Unique upload ID
 * @param {string} deviceID Unique, 16 character internal EFM32 serial number
 * @param {object} datetime Datetime object representing estimated time snapshot was taken
 * @param {number} battery Floating point number representing battery level at time of snapshot
 * @param {number} hxfoCount HXFO count
 * @param {number} lxfoCount LXFO count
 * @param {number} temperature Floating point number representing temperature at time of snapshot
 * @param {object} buff Buffer containing snapshot data
 * @param {function} callback Function called on completion
 */
exports.addSnapshot = (dbClient, uploadID, datetime, battery, hxfoCount, lxfoCount, temperature, buff, callback) => {

    const year = datetime.getFullYear();
    const month = datetime.getMonth() + 1;
    const day = datetime.getDate();
    const hours = datetime.getHours();
    const minutes = datetime.getMinutes();
    const seconds = datetime.getSeconds();
    const msString = datetime.getMilliseconds().toString().padStart(3, '0');

    let dtString = year.toString();
    dtString += '-';
    dtString += month.toString();
    dtString += '-';
    dtString += day.toString();
    dtString += ' ';
    dtString += hours.toString();
    dtString += ':';
    dtString += minutes.toString();
    dtString += ':';
    dtString += seconds.toString();
    dtString += '.';
    dtString += msString;

    /* Append a double-escaped x to announce to postgres that bytea data is in the hex format, rather than escaped */
    const header = Buffer.from('\\x');
    const hexBuffer = Buffer.concat([header, buff]);

    const values = [uploadID, dtString, battery, hxfoCount, lxfoCount, temperature, hexBuffer];

    dbClient.query('INSERT INTO snapshots(snapshot_id, upload_id, datetime, battery, hxfo_count, lxfo_count, temperature, data) VALUES (DEFAULT, $1, $2, $3, $4, $5, $6, $7)', values, callback);

};

/**
 * For an existing upload, change the status to one of the predefined enum values
 * @param {object} dbClient Postgres client
 * @param {string} uploadID Unique upload ID
 * @param {string} status New status using the following enums: 'uploading', 'waiting', 'processing', 'complete'
 * @param {function} callback Function called on completion
 */
exports.updateUploadStatus = (dbClient, uploadID, status, callback) => {

    dbClient.query('UPDATE uploads SET status = $1 WHERE upload_id = $2 RETURNING *', [status, uploadID], callback);

};

/**
 * Update the date which an upload should be processed
 * @param {object} dbClient Postgres client
 * @param {string} uploadID Unique upload ID
 * @param {string} earliestProcessingDateString UTC string of the date/time of the earliest point an upload can be processed
 * @param {function} callback Function called upon completion
 */
exports.updateUploadProcessingDate = (dbClient, uploadID, earliestProcessingDateString, callback) => {

    dbClient.query('UPDATE uploads SET earliest_processing_date = $1 WHERE upload_id = $2 RETURNING *', [earliestProcessingDateString, uploadID], callback);

};

/**
 * Delete an existing upload and all associated snapshots (table is set to CASCADE DELETE)
 * @param {object} dbClient Postgres client
 * @param {string} uploadID Unique upload ID
 * @param {function} callback Fucntion called on completion
 */
exports.deleteUpload = (dbClient, uploadID, callback) => {

    dbClient.query('DELETE FROM uploads WHERE upload_id = $1', [uploadID], callback);

};

/**
 * Request the information about an upload needed to process a snapshot
 * @param {object} dbClient Postgres client
 * @param {string} uploadID Unique upload ID
 * @param {function} callback Function called on completion
 */
exports.getUploadInformation = (dbClient, uploadID, callback) => {

    dbClient.query('SELECT datetime, device_id, max_velocity, nickname FROM uploads WHERE upload_id = $1', [uploadID], callback);

};

/**
 * Get the number of snapshots associated with a given upload
 * @param {object} dbClient Postgres client
 * @param {string} uploadID Unique upload ID
 * @param {function} callback Function called on completion
 */
exports.getSnapshotCount = (dbClient, uploadID, callback) => {

    dbClient.query('SELECT COUNT(snapshot_id) FROM snapshots WHERE upload_id = $1', [uploadID], callback);

};

/**
 * Get timestamp of first snapshot associated with a given upload
 * @param {object} dbClient Postgres client
 * @param {string} uploadID Unique upload ID
 * @param {function} callback Function called on completion
 */
exports.getFirstSnapshotTimestamp = (dbClient, uploadID, callback) => {

    dbClient.query('SELECT datetime FROM snapshots WHERE upload_id = $1 ORDER BY datetime ASC LIMIT 1', [uploadID], callback);

};

/**
 * Get timestamp of last snapshot associated with a given upload
 * @param {object} dbClient Postgres client
 * @param {string} uploadID Unique upload ID
 * @param {function} callback Function called on completion
 */
exports.getLastSnapshotTimestamp = (dbClient, uploadID, callback) => {

    dbClient.query('SELECT datetime FROM snapshots WHERE upload_id = $1 ORDER BY datetime DESC LIMIT 1', [uploadID], callback);

};

/**
 * Given an upload ID, return an array of position objects including the GPS position and a corrected timestamp
 * @param {object} dbClient Postgres client
 * @param {string} uploadID Unique upload ID
 * @param {function} callback Function called on completion
 */
exports.getPositions = async (dbClient, uploadID, callback) => {

    const positions = [];

    // Get all snapshots associated with the given upload ID

    const response = await dbClient.query('SELECT * FROM (SELECT DISTINCT ON (temp.snapshot_id) datetime, temperature, battery, estimated_lat, estimated_lng, estimated_time_correction, estimated_horizontal_error FROM (SELECT snapshot_id, datetime, temperature, battery FROM snapshots WHERE upload_id = $1) AS temp INNER JOIN positions ON temp.snapshot_id=positions.snapshot_id ORDER BY temp.snapshot_id, position_id DESC) as temp2 ORDER BY datetime ASC', [uploadID]);

    for (let i = 0; i < response.rows.length; i++) {

        positions.push({
            estimated_lat: response.rows[i].estimated_lat,
            estimated_lng: response.rows[i].estimated_lng,
            timestamp: (response.rows[i].datetime.getTime() / 1000) + response.rows[i].estimated_time_correction,
            temperature: response.rows[i].temperature,
            battery: response.rows[i].battery,
            estimated_horizontal_error: response.rows[i].estimated_horizontal_error
        });

    }

    callback(false, positions);

};
