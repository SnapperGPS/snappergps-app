/****************************************************************************
 * statusUI.js
 * June 2021
 *****************************************************************************/

/* global FormData, sendPOSTRequest */

// Spinner while downloading
const downloadSpinner = document.getElementById('download-spinner');

// Table for downloaded data
const table = document.getElementById('status-body');

// Month selector
const monthInput = document.getElementById('month-input');

// Display data for current month
const dateTime = new Date();
const currentMonth = dateTime.getUTCFullYear() +
                     '-' +
                     ('0' + (dateTime.getUTCMonth() + 1)).slice(-2);
monthInput.max = currentMonth;
monthInput.value = currentMonth;
monthInput.onchange = async () => {

    getStatusData();

};

getStatusData();

// Download status data for certain month
async function getStatusData () {

    // Enable spinner when loading
    downloadSpinner.style.display = '';

    // Clear existing table
    table.innerHTML = '';

    // Download status data from server
    const formData = new FormData();
    formData.append('yearMonth', monthInput.value);
    sendPOSTRequest('getStatus', formData, (statusObject) => {

        const parsedStatusObject = JSON.parse(statusObject);

        // Time when snapshot set was uploaded
        const datetimeArray = parsedStatusObject.datetimeArray;

        // Upload ID
        const idArray = parsedStatusObject.idArray;

        // Statistics for real-time processing
        // Reliability of snapshot set (ratio of good fixes with confidence < 200 m)
        const nGoodArray = parsedStatusObject.nGoodArray;
        const nTotalArray = parsedStatusObject.nTotalArray;
        // Accuracy of snapshot set (median horizontal error)
        const medianArray = parsedStatusObject.medianArray;

        // Statistics for post-processing
        // Reliability of snapshot set (ratio of good fixes with confidence < 200 m)
        const nGoodArrayPost = parsedStatusObject.nGoodArrayPost;
        const nTotalArrayPost = parsedStatusObject.nTotalArrayPost;
        // Accuracy of snapshot set (median horizontal error)
        const medianArrayPost = parsedStatusObject.medianArrayPost;

        // Get current date
        const today = new Date();
        const year = today.getUTCFullYear();
        const month = today.getUTCMonth() + 1;
        const day = today.getUTCDate();

        // Populate table
        for (let idx = 0; idx < datetimeArray.length; ++idx) {

            const row = table.insertRow();
            const datetimeCell = row.insertCell(0);
            datetimeCell.innerHTML = '<a class="text-link" href="/view?uploadid=' +
                                   idArray[idx] + '">' + datetimeArray[idx] + '</a>';

            // Real-time data
            const reliabilityCell = row.insertCell(1);
            reliabilityCell.innerHTML = '' + nGoodArray[idx] + '/' + nTotalArray[idx];
            // reliabilityCell.style.color = goodRatioArray[idx] > 0.95 ? 'green' : 'red';
            const goodRatio = nGoodArray[idx] / nTotalArray[idx];
            reliabilityCell.style.color = nTotalArray[idx] > 0 ? 'rgb(' +
                                        Math.min(255 / 0.2 * (1 - goodRatio), 255) +
                                        ',' +
                                        Math.max(255 / 0.2 * (goodRatio - 0.8), 0) +
                                        ', 0)' : '#999999';
            reliabilityCell.style.textAlign = 'right';
            const accuracyCell = row.insertCell(2);
            if (medianArray[idx] === null) medianArray[idx] = Infinity;
            accuracyCell.innerHTML = '' + medianArray[idx].toFixed(0) + ' m';
            accuracyCell.style.color = nTotalArray[idx] > 0 ? 'rgb(' +
                                        Math.min(2.55 * medianArray[idx], 255) +
                                        ',' +
                                        Math.max(2.55 * (100 - medianArray[idx]), 0) +
                                        ', 0)' : '#999999';
            accuracyCell.style.textAlign = 'right';

            const recordYear = parseInt(datetimeArray[idx].slice(0, 4));
            const recordMonth = parseInt(datetimeArray[idx].slice(5, 7));
            const recordDay = parseInt(datetimeArray[idx].slice(8, 10));

            // Post-processed data
            const reliabilityPostCell = row.insertCell(3);
            const accuracyPostCell = row.insertCell(4);

            if (!(year === recordYear && month === recordMonth && day === recordDay)) {

                reliabilityPostCell.innerHTML = '' + nGoodArrayPost[idx] + '/' + nTotalArrayPost[idx];
                const goodRatioPost = nGoodArrayPost[idx] / nTotalArrayPost[idx];
                reliabilityPostCell.style.color = nTotalArrayPost[idx] > 0 ? 'rgb(' +
                                                Math.min(255 / 0.2 * (1 - goodRatioPost), 255) +
                                                ',' +
                                                Math.max(255 / 0.2 * (goodRatioPost - 0.8), 0) +
                                                ', 0)' : '#999999';
                reliabilityPostCell.style.textAlign = 'right';
                if (medianArrayPost[idx] === null) medianArrayPost[idx] = Infinity;
                accuracyPostCell.innerHTML = '' + medianArrayPost[idx].toFixed(0) + ' m';
                accuracyPostCell.style.color = nTotalArrayPost[idx] > 0 ? 'rgb(' +
                                            Math.min(2.55 * medianArrayPost[idx], 255) +
                                            ',' +
                                            Math.max(2.55 * (100 - medianArrayPost[idx]), 0) +
                                            ', 0)' : '#999999';
                accuracyPostCell.style.textAlign = 'right';

            }

        }

        // Disable spinner when not loading
        downloadSpinner.style.display = 'none';

    });

}
