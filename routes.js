/****************************************************************************
 * routes.js
 * March 2021
 *****************************************************************************/

const dbFunctions = require('./js/dbFunctions.js');

module.exports = function (app, dbClient) {

    /**
     * Render the homepage
     */
    app.get('/', (req, res) => {

        res.render('index');

    });

    /**
     * Render the upload page
     */
    app.get('/upload', (req, res) => {

        res.render('upload');

    });

    /**
     * Render the configuration page
     */
    app.get('/configure', (req, res) => {

        res.render('configure');

    });

    /**
     * Render the search page by default, unless an upload ID is included in the POST request. Then display the data associated with it or an error if no such data exists
     */
    app.get('/view', (req, res) => {

        const uploadID = req.query.uploadid;

        if (!uploadID) {

            res.render('search', { displayError: false });
            return;

        }

        dbFunctions.getUploadInformation(dbClient, uploadID, (err, dbRes) => {

            if (err || dbRes.rows.length === 0) {

                res.render('search', { displayError: true, uploadID: uploadID });
                return;

            }

            res.render('view', { uploadID: uploadID });

        });

    });

    /**
     * Signal the start of an upload and create a new upload record in the database
     */
    app.post('/startUpload', (req, res) => {

        if (!req.body.deviceID) {

            res.status(400).send('Unreadable receiver ID.');
            return;

        }

        const deviceID = req.body.deviceID;
        const email = req.body.email;
        const subscription = req.body.subscription;
        const maxVelocity = req.body.maxVelocity;

        dbFunctions.addUpload(dbClient, deviceID, email, subscription, maxVelocity, (err, dbRes) => {

            if (err) {

                console.log(err);
                res.status(400).send(err);
                return;

            }

            const uploadID = dbRes.rows[0].upload_id;

            res.send(uploadID.toString());

        });

    });

    /**
     * Second step of creating a new record, add a reference point from which position calculations can be done. Will be called one or more times
     */
    app.post('/addReferencePoint', (req, res) => {

        const uploadID = req.body.uploadID;
        const dtString = req.body.datetime;
        const lat = req.body.lat;
        const lng = req.body.lng;

        console.log(uploadID, dtString, lat, lng);

        if (uploadID === undefined) {

            res.status(400).send('Unreadable upload ID.');
            return;

        }

        if (dtString === undefined || lat === undefined || lng === undefined) {

            res.status(400).send('Unreadable reference point.');
            return;

        }

        dbFunctions.addReferencePoint(dbClient, uploadID, lat, lng, dtString, (err, refRes) => {

            if (err) {

                console.log(err);
                res.status(400).send(err);
                return;

            }

            res.send('Added reference point to upload with ID: ' + uploadID);

        });

    });

    /**
     * Third step in creating an upload. Upload a single snapshot, including a block of bytes which are directly uploaded to the database
     */
    app.post('/addSnapshot', (req, res) => {

        const uploadID = req.body.uploadID;
        const file = req.files.data;

        const dateString = req.body.datetime;

        const battery = req.body.battery;
        const hxfoCount = req.body.hxfoCount;
        const lxfoCount = req.body.lxfoCount;
        const temperature = req.body.temperature;

        console.log(uploadID, dateString, battery, hxfoCount, lxfoCount, temperature);

        if (uploadID === undefined) {

            res.status(400).send('Unreadable upload ID.');
            return;

        }

        if (file === undefined) {

            res.status(400).send('Unreadable file.');
            return;

        }

        if (dateString === undefined || battery === undefined || hxfoCount === undefined || lxfoCount === undefined || temperature === undefined) {

            res.status(400).send('Missing/unreadable snapshot information.');
            return;

        }

        const dt = new Date(dateString);
        const buff = file.data;

        console.log('Pushing file to DB');

        dbFunctions.addSnapshot(dbClient, uploadID, dt, battery, hxfoCount, lxfoCount, temperature, buff, (err, dbRes) => {

            if (err) {

                console.log(err);
                res.status(400).send(err);
                return;

            }

            res.send('Added data with ID: ' + uploadID);

        });

    });

    /**
     * Once all snapshots have been uploaded, instruct the server to update the processing date and upload status to allow the processing script to process it
     */
    app.post('/finishUpload', (req, res) => {

        if (!req.body.uploadID) {

            res.status(400).send('Unreadable upload ID.');
            return;

        }

        const uploadID = req.body.uploadID;

        const earliestProcessingDateString = req.body.earliestProcessingDateString;

        // The earliest processing date is calculated whilst each record is being pulled from the device
        // For this reason a placeholder value is used when an upload record is created and it is updated now

        dbFunctions.updateUploadProcessingDate(dbClient, uploadID, earliestProcessingDateString, (err, dateRes) => {

            if (err) {

                console.log(err);
                res.status(400).send(err);
                return;

            }

            // Change the upload status from 'uploading' to 'waiting'

            dbFunctions.updateUploadStatus(dbClient, uploadID, 'waiting', (err, statusRes) => {

                if (err) {

                    console.log(err);
                    res.status(400).send(err);
                    return;

                }

                res.send(uploadID);

            });

        });

    });

    /**
     * If a step in the upload process failed, cancel the entire process and delete all associated records from the database
     */
    app.post('/cancelUpload', (req, res) => {

        if (!req.body.uploadID) {

            res.status(400).send('Unreadable upload ID.');
            return;

        }

        const uploadID = req.body.uploadID;

        dbFunctions.deleteUpload(dbClient, uploadID, (err, dbRes) => {

            if (err) {

                console.log(err);
                res.status(400).send(err);
                return;

            }

            res.send('Deleted record with ID: ' + uploadID);

        });

    });

    /**
     * Render the page indicating a successful upload
     */
    app.get('/success', (req, res) => {

        const uploadID = req.query.uploadid;

        if (!uploadID) {

            res.render('index');
            return;

        }

        res.render('success', { uploadID: uploadID });

    });

    /**
     * Return all information on a single upload
     */
    app.post('/getUploadInformation', (req, res) => {

        if (!req.body.uploadID) {

            res.status(400).send('Unreadable upload ID.');
            return;

        }

        const uploadID = req.body.uploadID;

        // Pull information from uploads table

        dbFunctions.getUploadInformation(dbClient, uploadID, (err, uploadRes) => {

            if (err) {

                console.log(err);
                res.status(400).send(err);
                return;

            }

            if (uploadRes.rows.length === 0) {

                res.status(400).send('No uploads match that ID.');
                return;

            }

            const uploadDt = uploadRes.rows[0].datetime;

            const deviceID = uploadRes.rows[0].device_id;

            const maxVelocity = uploadRes.rows[0].max_velocity;

            // Pull information from reference_points table

            dbFunctions.getReferencePoints(dbClient, uploadID, (err, referenceRes) => {

                if (err) {

                    console.log(err);
                    res.status(400).send(err);
                    return;

                }

                const referencePoints = [];

                referenceRes.rows.forEach(row => {

                    referencePoints.push({ lat: row.lat, lng: row.lng, dt: row.datetime });

                });

                // Pull information from snapshots table

                dbFunctions.getSnapshotCount(dbClient, uploadID, async (err, snapshotRes) => {

                    if (err) {

                        console.log(err);
                        res.status(400).send(err);
                        return;

                    }

                    const snapshotCount = snapshotRes.rows[0].count;

                    // Bundle requested information into JSON object and return it

                    const information = {
                        datetime: uploadDt,
                        referencePoints: referencePoints,
                        snapshotCount: snapshotCount,
                        deviceID: deviceID,
                        maxVelocity: maxVelocity
                    };

                    res.json(information);

                });

            });

        });

    });

    /**
     * Return timestamps of first and last snapshot
     */
    app.post('/getFirstLastSnapshotTimestamps', (req, res) => {

        if (!req.body.uploadID) {

            res.status(400).send('Unreadable upload ID.');
            return;

        }

        const uploadID = req.body.uploadID;

        // Get timestmap of first snapshot

        dbFunctions.getFirstSnapshotTimestamp(dbClient, uploadID, (err, startRes) => {

            if (err) {

                console.log(err);
                res.status(400).send(err);
                return;

            }

            if (startRes.rows.length === 0) {

                res.status(400).send('No uploads match that ID.');
                return;

            }

            const startDt = startRes.rows[0].datetime;

            // Get timestamp of last snapshot

            dbFunctions.getLastSnapshotTimestamp(dbClient, uploadID, (err, endRes) => {

                if (err) {

                    console.log(err);
                    res.status(400).send(err);
                    return;

                }

                const endDt = endRes.rows[0].datetime;

                // Bundle requested information into JSON object and return it

                const information = {
                    startDatetime: startDt,
                    endDatetime: endDt
                };

                res.json(information);

            });

        });

    });

    /**
     * Return all processed positions associated with a given upload ID
     */
    app.post('/getPositions', (req, res) => {

        if (!req.body.uploadID) {

            res.status(400).send('Unreadable upload ID.');
            return;

        }

        const uploadID = req.body.uploadID;

        dbFunctions.getPositions(dbClient, uploadID, (err, positions) => {

            if (err) {

                console.log(err);
                res.status(400).send(err);
                return;

            }

            res.json({positions: positions});

        });

    });

    /**
     * Render the internal flash page.
     */
    app.get('/flash', (req, res) => {

        res.render('flash');

    });

    /**
     * Render the privacy policy page.
     */
    app.get('/privacy', (req, res) => {

        res.render('privacy');

    });

    /**
     * Render the animation page.
     */
    app.get('/animate', (req, res) => {

        res.render('animate');

    });

};
